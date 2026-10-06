/**
 * Aides communes aux scripts d'import et à l'admin : normalisation des noms,
 * distances, lecture de l'export clients DMS (classeur déjà chargé),
 * rapprochement client DMS ↔ PDV, ordre de tournée, CSV.
 *
 * AUCUNE dépendance Node (fs, path, process) : ce module tourne aussi dans le
 * navigateur de l'admin (Imports terrain). Les accès fichiers restent dans
 * scripts/lib/dms.mjs, qui réexporte tout ce module.
 *
 * Aucun code commun entre les deux référentiels à l'origine : le rapprochement
 * se fait par GPS + nom, le distributeur et le type servant à juger la
 * fiabilité. Chaque client DMS et chaque PDV n'est retenu qu'une fois.
 */
export const RAYON_NOM_M = 50 // PDV avec un mot du nom en commun
export const RAYON_SEUL_M = 25 // PDV unique, sans mot commun
const MOTS_VIDES = new Set([
  'BOUTIQUE', 'BOUTIK', 'BTQ', 'CHEZ', 'ETS', 'ETABLISSEMENT', 'SUPERETTE', 'SUPER', 'KIOSQUE',
  'ALIMENTATION', 'MAGASIN', 'CAFE', 'TABLE', 'SUPERMARCHE', 'MARCHE', 'DEMI', 'GROS', 'GROSSISTE',
  'DES', 'LES', 'MME', 'MLE', 'RETAILLER',
])

// ---------- Helpers ----------

export const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()

// Nom de personne comparable quel que soit l'ordre prénom/nom.
export const cleNom = (s) => norm(s).replace(/[^A-Z0-9 ]/g, ' ').split(' ').filter(Boolean).sort().join(' ')

export const motsNom = (s) =>
  new Set(norm(s).replace(/[^A-Z0-9 ]/g, ' ').split(' ').filter(w => w.length >= 3 && !/^\d+$/.test(w) && !MOTS_VIDES.has(w)))

// utils/trajets.ts — haversine (mètres)
export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLng = (lng2 - lng1) * (Math.PI / 180)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export const aGps = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0

// Sous-canal DMS (« Boutique  B », « Kiosk A », « Pushcard B »…) et sous-catégorie PDV
// (« Boutique B », « Kiosque », « Pushcart »…) ramenés à une même famille.
export function famille(s) {
  const n = norm(s)
  if (!n) return ''
  if (/STATION|PETROL/.test(n)) return 'STATION'
  if (/BOUTIQUE/.test(n)) return 'BOUTIQUE'
  if (/KIOS/.test(n)) return 'KIOSQUE'
  if (/PUSHCAR/.test(n)) return 'PUSHCART'
  if (/SUPERETTE|MINIMARKET/.test(n)) return 'SUPERETTE'
  if (/SUPERMA|HYPERMA/.test(n)) return 'SUPERMARCHE'
  if (/TABLE TOP|TABLIER/.test(n)) return 'TABLIER'
  if (/WHOLESAL|CASH/.test(n)) return 'GROSSISTE'
  if (/PORRIDGE/.test(n)) return 'PORRIDGE'
  if (/ABOKI/.test(n)) return 'ABOKI'
  if (/BAKERY/.test(n)) return 'BOULANGERIE'
  return 'AUTRE'
}

const comparer = (a, b, vide = '') => (!a || !b || a === vide || b === vide ? 'inconnu' : a === b ? 'oui' : 'non')

// Nom DMS → nom du référentiel `distributeur` quand l'orthographe diffère.
const ALIAS_DISTRIBUTEUR = {
  'PLAISIR BACCHUS': 'PLAISIR BACHUSS',
  'TAHIROU AMADOU': 'TAHIROU',
  DYNAMYS: 'DYNAMIS',
}

/** Nom canonique d'un distributeur DMS, d'après les noms du référentiel. */
export function distributeurCanonique(nomDms, nomsReferentiel) {
  const n = norm(nomDms)
  if (!n) return ''
  const cible = ALIAS_DISTRIBUTEUR[n] || n
  return nomsReferentiel.find(r => norm(r) === cible) || cible
}

// CSV lu par useCsvExport.parseCsv : virgule, guillemets doublés, une ligne par enregistrement.
const champCsv = (v) => `"${String(v ?? '').replace(/[\r\n]+/g, ' ').replace(/"/g, '""')}"`
/** Texte CSV (avec BOM, pour Excel) — écrit sur disque par dms.mjs, téléchargé par l'admin. */
export const csvTexte = (entete, lignes) =>
  '﻿' + [entete, ...lignes].map(l => l.map(champCsv).join(',')).join('\n') + '\n'

/** Toutes les lignes d'une requête PostgREST (plafond de 1 000 par réponse). */
export async function toutesLesLignes(requete) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await requete().range(from, from + 999)
    if (error) throw error
    out.push(...data)
    if (data.length < 1000) return out
  }
}

export const texteCellule = (v) => {
  if (v == null) return ''
  if (typeof v === 'object') {
    if ('result' in v) return texteCellule(v.result)
    if (Array.isArray(v.richText)) return v.richText.map(r => r.text).join('')
    if ('text' in v) return v.text
  }
  return v
}

export const uniques = (xs) => [...new Set(xs.filter(Boolean))]

// ---------- Export DMS ----------

/**
 * Lit l'export clients DMS, un client par `customer_code`.
 *
 * `seuilDepot` : un point GPS partagé par au moins ce nombre de clients est le
 * dépôt du distributeur, pas la boutique. Ses clients perdent leurs
 * coordonnées (`gpsEcarte = 'depot'`). Sans seuil, rien n'est écarté.
 */
export function lireDmsClasseur(wb, { seuilDepot = 0, nomFichier = 'l\'export DMS' } = {}) {
  const ws = wb.worksheets[0]
  const entetes = []
  ws.getRow(1).eachCell({ includeEmpty: true }, (c, col) => { entetes[col] = String(texteCellule(c.value) || '').trim() })
  const colOpt = (nom) => entetes.findIndex(h => h && h.toLowerCase().startsWith(nom.toLowerCase()))
  const col = (nom) => {
    const i = colOpt(nom)
    if (i < 0) throw new Error(`Colonne « ${nom} » introuvable dans ${nomFichier}`)
    return i
  }
  const C = {
    region: col('distributor_region'), distCode: col('distributor_code'), distributeur: col('distributor_name'),
    vendeurCode: col('salesman_code'), vendeur: col('salesman_name'), code: col('customer_code'), nom: col('customer_name'),
    rue: col('address1'), quartier: col('address2'), district: col('address3'), lat: col('latitude'), lng: col('longitude'),
    contact: col('contact_person'), sousCanal: col('local_sub_channel_name'), creeLe: colOpt('created_date'),
    zone: colOpt('Zone'), merch: colOpt('Merchandiseur'),
  }

  let lignesDms = 0
  const parCode = new Map()
  ws.eachRow((row, n) => {
    if (n === 1) return
    lignesDms++
    const v = (k) => (C[k] < 0 ? '' : String(texteCellule(row.getCell(C[k]).value) ?? '').trim())
    if (!v('code')) return
    const c = parCode.get(v('code'))
    const vendeur = `${v('vendeurCode')} ${v('vendeur')}`.trim()
    if (c) {
      // Même client suivi par plusieurs vendeurs / distributeurs
      c.distributeurs.push(v('distributeur')); c.distCodes.push(v('distCode')); c.vendeurs.push(vendeur)
      if (!c.zone) c.zone = v('zone')
      if (!c.merch) c.merch = v('merch')
      return
    }
    parCode.set(v('code'), {
      code: v('code'), nom: v('nom'), contact: v('contact'), region: v('region'),
      distributeurs: [v('distributeur')], distCodes: [v('distCode')], vendeurs: [vendeur],
      rue: v('rue'), quartier: v('quartier'), district: v('district'), sousCanal: v('sousCanal'),
      lat: Number(v('lat')), lng: Number(v('lng')), zone: v('zone'), merch: v('merch'),
    })
  })

  const clients = [...parCode.values()]
  for (const c of clients) {
    c.distributeurs = uniques(c.distributeurs); c.distCodes = uniques(c.distCodes); c.vendeurs = uniques(c.vendeurs)
    c.distNorm = new Set(c.distributeurs.map(norm))
    c.famille = famille(c.sousCanal)
    c.mots = motsNom(c.nom)
    c.gpsEcarte = aGps(c.lat, c.lng) ? '' : 'absent'
  }

  if (seuilDepot > 0) {
    const point = (c) => `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`
    const parPoint = new Map()
    clients.filter(c => !c.gpsEcarte).forEach(c => parPoint.set(point(c), (parPoint.get(point(c)) || 0) + 1))
    for (const c of clients) {
      if (c.gpsEcarte) continue
      const n = parPoint.get(point(c))
      if (n >= seuilDepot) {
        c.gpsEcarte = 'depot'
        c.gpsPartage = n
        c.latDms = c.lat; c.lngDms = c.lng
        c.lat = NaN; c.lng = NaN
      }
    }
  }

  return { lignesDms, clients }
}

// ---------- Rapprochement ----------

/** Grille de ~55 m pour ne comparer que les voisins immédiats. */
function grillePdv(pdvs, pas = 0.0005) {
  const cellule = (lat, lng) => `${Math.floor(lat / pas)}:${Math.floor(lng / pas)}`
  const grille = new Map()
  for (const p of pdvs) {
    if (!aGps(p.geolocation_lat, p.geolocation_lng)) continue
    const k = cellule(p.geolocation_lat, p.geolocation_lng)
    if (!grille.has(k)) grille.set(k, [])
    grille.get(k).push(p)
  }
  return (lat, lng) => {
    const i = Math.floor(lat / pas), j = Math.floor(lng / pas)
    const out = []
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) out.push(...(grille.get(`${i + di}:${j + dj}`) || []))
    return out
  }
}

const RANG_DIST = { oui: 0, inconnu: 1, non: 2 }

/**
 * Apparie clients DMS et PDV, un client ↔ un PDV au plus, meilleure paire
 * d'abord : nom commun, puis même distributeur, même type, distance.
 *
 * Renvoie { pairePdv, paireClient } (Map pdv_id → paire, Map code → paire).
 * Une paire : { c, p, d, statut: 'Reconnu' | 'Probable', communs,
 * memeDistributeur, memeType, motif }.
 */
export function apparier(clients, pdvs) {
  for (const p of pdvs) {
    p._distNorm = norm(p.distributor_name)
    p._famille = famille(p.sous_categorie_pdv)
    p._mots = motsNom(p.nom_pdv)
  }
  const voisins = grillePdv(pdvs)

  const paires = []
  for (const c of clients) {
    if (!aGps(c.lat, c.lng)) continue
    const proches = voisins(c.lat, c.lng)
      .map(p => ({ p, d: haversine(c.lat, c.lng, p.geolocation_lat, p.geolocation_lng) }))
      .filter(x => x.d <= RAYON_NOM_M)
    c.nbProches = proches.length
    const seuls = proches.filter(x => x.d <= RAYON_SEUL_M)
    for (const { p, d } of proches) {
      const communs = [...p._mots].filter(w => c.mots.has(w))
      const statut = communs.length ? 'Reconnu' : (seuls.length === 1 && d <= RAYON_SEUL_M ? 'Probable' : null)
      if (!statut) continue
      const memeDistributeur = !p._distNorm || !c.distNorm.size ? 'inconnu' : c.distNorm.has(p._distNorm) ? 'oui' : 'non'
      const memeType = comparer(c.famille, p._famille, 'AUTRE')
      const motif = statut === 'Reconnu'
        ? `nom commun (${communs.join(', ')}) à ${Math.round(d)} m`
        : `seul PDV à moins de ${RAYON_SEUL_M} m, nom différent`
      paires.push({ c, p, d, statut, communs, memeDistributeur, memeType, motif })
    }
  }

  paires.sort((a, b) =>
    (a.statut === 'Reconnu' ? 0 : 1) - (b.statut === 'Reconnu' ? 0 : 1)
    || RANG_DIST[a.memeDistributeur] - RANG_DIST[b.memeDistributeur]
    || (a.memeType === 'oui' ? 0 : 1) - (b.memeType === 'oui' ? 0 : 1)
    || a.d - b.d)
  const pairePdv = new Map()
  const paireClient = new Map()
  for (const x of paires) {
    if (pairePdv.has(x.p.pdv_id) || paireClient.has(x.c.code)) continue
    pairePdv.set(x.p.pdv_id, x)
    paireClient.set(x.c.code, x)
  }
  return { pairePdv, paireClient }
}

// Un seul mot commun (DIALLO, IBRAHIM…) ne suffit pas sans le même distributeur.
export const confiance = (x) => (!x ? '' : x.statut === 'Probable' ? 'Faible'
  : x.memeDistributeur === 'oui' || x.communs.length >= 2 ? 'Haute' : 'Moyenne')

const MOTIF_ECARTE = {
  absent: 'coordonnées absentes ou à 0 dans le DMS',
  depot: 'point GPS partagé avec de nombreux clients (dépôt du distributeur), écarté',
}

export function statutClient(c, paireClient) {
  if (paireClient.get(c.code)) return paireClient.get(c.code).statut
  return aGps(c.lat, c.lng) ? 'Non trouvé' : 'Sans GPS'
}

export function motifClient(c, paireClient) {
  const x = paireClient.get(c.code)
  if (x) return x.motif
  if (!aGps(c.lat, c.lng)) return MOTIF_ECARTE[c.gpsEcarte] || MOTIF_ECARTE.absent
  return c.nbProches ? `${c.nbProches} PDV à moins de ${RAYON_NOM_M} m, aucun retenu (nom différent ou déjà pris)` : `aucun PDV à moins de ${RAYON_NOM_M} m`
}

// ---------- Ordre de tournée ----------

export const mediane = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }

/**
 * Ordre de passage : chaîne du plus proche voisin depuis le PDV le plus à
 * l'ouest. Les PDV sans GPS, ou à plus de `gpsDouteuxM` du centre du lot
 * (coordonnées fausses qui casseraient la tournée), ferment la marche, groupés
 * par quartier. Repris de scripts/croiser-dms-tournees.mjs.
 */
export function ordreGps(pdvs, { gpsDouteuxM = 15000 } = {}) {
  const avecGps = pdvs.filter(p => aGps(p.geolocation_lat, p.geolocation_lng))
  let fiable = () => false
  if (avecGps.length) {
    const lat = mediane(avecGps.map(p => p.geolocation_lat))
    const lng = mediane(avecGps.map(p => p.geolocation_lng))
    fiable = p => aGps(p.geolocation_lat, p.geolocation_lng) && haversine(lat, lng, p.geolocation_lat, p.geolocation_lng) <= gpsDouteuxM
  }
  const restants = pdvs.filter(fiable)
  const sans = pdvs.filter(p => !fiable(p))
    .sort((a, b) => String(a.quartier || '').localeCompare(String(b.quartier || ''), 'fr') || a.pdv_id.localeCompare(b.pdv_id))
  const chaine = []
  if (restants.length) {
    let i = restants.reduce((best, p, k) => (p.geolocation_lng < restants[best].geolocation_lng ? k : best), 0)
    while (restants.length) {
      const cur = restants.splice(i, 1)[0]
      chaine.push(cur)
      let dMin = Infinity
      restants.forEach((p, k) => {
        const d = haversine(cur.geolocation_lat, cur.geolocation_lng, p.geolocation_lat, p.geolocation_lng)
        if (d < dMin) { dMin = d; i = k }
      })
    }
  }
  return [...chaine, ...sans]
}

// ---------- CSV ----------

// Inverse de ecrireCsv : champs entre guillemets, guillemets doublés.
function lireLigneCsv(l) {
  const out = []
  let i = 0
  while (i < l.length) {
    if (l[i] === ',') { i++; continue }
    if (l[i] !== '"') { const fin = l.indexOf(',', i); out.push(l.slice(i, fin < 0 ? l.length : fin)); i = fin < 0 ? l.length : fin; continue }
    i++
    let s = ''
    for (;;) {
      if (l[i] === '"' && l[i + 1] === '"') { s += '"'; i += 2 }
      else if (l[i] === '"' || i >= l.length) { i++; break }
      else s += l[i++]
    }
    out.push(s)
  }
  return out
}

/** Lit un CSV écrit par ecrireCsv : tableau d'objets indexés par l'en-tête. */
export function lireCsv(texte) {
  const lignes = texte.replace(/^﻿/, '').split('\n').filter(Boolean)
  const entete = lireLigneCsv(lignes[0])
  return lignes.slice(1).map(l => { const v = lireLigneCsv(l); return Object.fromEntries(entete.map((k, i) => [k, v[i] ?? ''])) })
}

// ---------- Alias des fichiers d'import (table alias_import) ----------

/** Texte d'un fichier ramené à la forme des motifs d'alias : majuscules, sans accents ni ponctuation. */
export const motifAlias = (texte) => norm(texte).replace(/[^A-Z0-9& ]/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * Cible d'un alias (e-mail, nom de distributeur, nom de SSF) pour un texte de
 * fichier, ou null. Modes : exact (aussi quel que soit l'ordre des mots),
 * commence (par le motif), contient (le motif).
 */
export function resoudreAlias(texte, aliases, type) {
  const k = motifAlias(texte)
  if (!k) return null
  const cle = cleNom(texte)
  const siens = (aliases || []).filter(a => a.type === type)
  return siens.find(a => a.mode === 'exact' && (a.motif === k || cleNom(a.motif) === cle))?.cible
    || siens.find(a => a.mode === 'commence' && k.startsWith(a.motif))?.cible
    || siens.find(a => a.mode === 'contient' && k.includes(a.motif))?.cible
    || null
}

// Alias repris de la migration 20261007110000, utilisés tant qu'elle n'est pas
// appliquée (lecture de alias_import impossible).
export const ALIAS_PAR_DEFAUT = [
  ['merchandiser', 'DEHO WILFRIED', 'exact', 'yopougonmerchtwo@gmail.com'],
  ['merchandiser', 'DEHEO WILFRIED', 'exact', 'yopougonmerchtwo@gmail.com'],
  ['merchandiser', 'DIABATE', 'exact', 'cocodymerchtwo@gmail.com'],
  ['merchandiser', 'BERNADIN GUIHI', 'exact', 'cocodymerchtwo@gmail.com'],
  ['merchandiser', 'GUIHI BERNADIN', 'exact', 'cocodymerchtwo@gmail.com'],
  ['merchandiser', 'KOUADIO ATTOFE ANICET', 'exact', 'koumassimerchone@gmail.com'],
  ['merchandiser', 'KOUADIO ATTOFE GUY', 'exact', 'koumassimerchone@gmail.com'],
  ['merchandiser', 'MOUSTAPHA N DIAYE', 'exact', 'portbouetone@gmail.com'],
  ['merchandiser', 'SEREGONE CHADRAC', 'exact', 'abobomerchone@gmail.com'],
  ['merchandiser', 'ZOGBOLOU KEVIN', 'exact', 'yopougonone@gmail.com'],
  ['merchandiser', 'YAO VENANCE', 'exact', 'abobomerchtwo@gmail.com'],
  ['merchandiser', 'ABBE FREDERIC', 'exact', 'attecoubeone@gmail.com'],
  ['merchandiser', 'KOUAME HELLARION', 'exact', 'cocodyone@gmail.com'],
  ['merchandiser', 'AKEDAN JEAN YVES', 'exact', 'marcorytreichone@gmail.com'],
  ['merchandiser', 'METCH DIANE', 'exact', 'metch.diane@friesland-terrain.ci'],
  ['merchandiser', 'HIEN FILIPE', 'exact', 'hien.filipe@friesland-terrain.ci'],
  ['merchandiser', 'VITAL YOBOUET', 'exact', 'vital.yobouet@friesland-terrain.ci'],
  ['distributeur', 'BOUSSOURA', 'commence', 'BOUSSOURA SARL'],
  ['distributeur', 'SODICO', 'commence', 'SODICOM-CI'],
  ['distributeur', 'SODICI', 'commence', 'SODICOM-CI'],
  ['distributeur', 'NIARE', 'contient', 'ETABLISSEMENT NIARE & FRERES'],
  ['distributeur', 'NDA', 'exact', 'NOUVEAUX DISTRIBUTEURS ASSOCIES'],
  ['distributeur', 'NOUVEAUX DISTRIBUTEURS', 'contient', 'NOUVEAUX DISTRIBUTEURS ASSOCIES'],
  ['distributeur', 'SIDECOM', 'commence', 'SIDECOM'],
  ['distributeur', 'PLAISIR', 'commence', 'PLAISIR BACHUSS'],
  ['distributeur', 'DYNAMI', 'commence', 'DYNAMIS'],
  ['distributeur', 'DINAMY', 'commence', 'DYNAMIS'],
  ['distributeur', 'PRODISMA', 'commence', 'PRODISMA'],
  ['distributeur', 'SDTP', 'commence', 'SDTP'],
  ['distributeur', 'SDHPA', 'commence', 'SDHPA'],
  ['distributeur', 'HIDJABE', 'contient', 'ETS HIDJABE'],
  ['distributeur', 'PLAISIR BACCHUS', 'exact', 'PLAISIR BACHUSS'],
  ['distributeur', 'TAHIROU AMADOU', 'exact', 'TAHIROU'],
  ['distributeur', 'DYNAMYS', 'exact', 'DYNAMIS'],
].map(([type, motif, mode, cible]) => ({ type, motif, mode, cible }))

/** Alias de la base, sinon ceux par défaut (migration pas encore appliquée). */
export async function chargerAlias(sb, toutes = toutesLesLignes) {
  try {
    const lignes = await toutes(() => sb.from('alias_import').select('type,motif,mode,cible').order('id'))
    return lignes.length ? lignes : ALIAS_PAR_DEFAUT
  }
  catch {
    return ALIAS_PAR_DEFAUT
  }
}

/** Identifiant court de PDV (8 caractères), absent de `pris`. */
export function nouvelIdPdv(pris) {
  for (;;) {
    const id = globalThis.crypto.randomUUID().slice(0, 8)
    if (!pris.has(id)) { pris.add(id); return id }
  }
}

/** Découpe une liste en paquets de `taille`. */
export const paquets = (xs, taille) => Array.from({ length: Math.ceil(xs.length / taille) }, (_, i) => xs.slice(i * taille, (i + 1) * taille))

export const jourIsoLocal = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
