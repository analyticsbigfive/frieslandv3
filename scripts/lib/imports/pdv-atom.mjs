/**
 * PDV Atom géolocalisés (export « Bonnet Rouge » de l'agence, onglet « PDV »),
 * décision du 20/10/2026 : pour Atom, et seulement Atom, la référence est la
 * liste des PDV identifiés par l'agence avec leurs coordonnées GPS
 * (colonnes GPS_Lat / GPS_Lng). Le DMS n'est pas utilisé.
 *
 * 1. Rapprochement, uniquement avec les PDV Atom déjà en base (import des
 *    visites Atom, table pdv_atom) — jamais un PDV DMS ou Friesland :
 *    téléphone utilisé par une seule boutique dans le fichier et en base,
 *    sinon nom identique (cleNom) à 50 m au plus avec un seul candidat.
 *    Mesure du 20/10 : les règles plus lâches (mot commun à 50 m, seul PDV à
 *    25 m) confondaient « Aziz 2 » et « AZIZ 1 », ou deux boutiques voisines.
 * 2. PDV retrouvé : il prend la position du fichier (ancienne gardée dans
 *    pdv_gps_historique). PDV absent : créé, typé d'après « Type_PDV » et le
 *    nom, localisé (zone, territoire) par ses voisins en base — rien n'est
 *    recopié des champs zone / quartier du fichier, saisis à la main.
 * 3. Distributeur : celui de la boutique, d'après ses visites (onglet
 *    Rapports_BR, et le fichier « BonnetRouge_Routing » s'il est fourni),
 *    ramené au nom du référentiel ; à défaut celui déjà en base.
 * 4. Mesure des quartiers (règle du 20/10) : chaque PDV appartient au point
 *    de visite le plus proche parmi ceux de TOUS les merchandisers Atom ; un
 *    jour de tournée prend les PDV de son quartier dont le distributeur est
 *    celui de la ligne du routing. Un distributeur peut servir plusieurs
 *    merchandisers (Niare : Yao et Seregone) : la boutique va au point le
 *    plus proche, donc à un seul des deux.
 *
 * Module pur : simulation → { resume, rapport, csv, operations, retour, mesure }.
 */
import {
  aGps, chargerAlias, cleNom, csvTexte, distributeurCanonique, haversine, jourIsoLocal, norm, nouvelIdPdv,
  resoudreAlias, texteCellule, toutesLesLignes,
} from '../commun.mjs'

export const RAYON_NOM_M = 50
const RAYON_VOISINS_M = 1500
const NB_VOISINS = 7
const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const CANAUX = ['Superette', 'Boutique', 'Aboki & Kiosque', 'Pushcart', 'Porridge']

const chiffres = (s) => String(s ?? '').replace(/\D/g, '').replace(/^225/, '')
const telephoneValide = (s) => { const c = chiffres(s); return c.length >= 8 ? c : '' }
const nombreGps = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null }
const pairGps = (s) => {
  const m = String(s || '').match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/)
  return m ? { lat: +m[1], lng: +m[2] } : null
}

/** « Type_PDV » du fichier (+ nom) → sous-catégorie du référentiel. */
export function sousCategorieDepuisFichier(typeFichier, nomPdv) {
  const t = norm(typeFichier)
  const n = norm(nomPdv)
  if (/PORRIDGE/.test(t)) return 'Porridge'
  if (/PUSHCAR/.test(t)) return 'Pushcard A'
  if (/TABLE TOP/.test(t)) return 'Table Top'
  if (/ABOKI|KIOS/.test(t)) return /ABOKI/.test(n) ? 'Aboki A' : 'Kiosk A'
  if (/SUPERETTE|SUPERMARCH|SUPER MARCH/.test(n)) return 'Superettes B'
  return 'Boutique C'
}

// ---------------------------------------------------------------------------
// Lecture des classeurs
// ---------------------------------------------------------------------------

function lignesFeuille(ws) {
  if (!ws) return []
  const entetes = []
  const out = []
  ws.eachRow((row, n) => {
    const cell = (i) => { const v = texteCellule(row.getCell(i).value); return v == null ? '' : String(v).trim() }
    if (n === 1) { row.eachCell({ includeEmpty: true }, (c, i) => { entetes[i] = norm(texteCellule(c.value) ?? '') }); return }
    const o = { _ligne: n }
    entetes.forEach((h, i) => { if (h) o[h] = cell(i) })
    out.push(o)
  })
  return out
}
const champ = (o, ...noms) => { for (const k of noms) { const v = o[norm(k)]; if (v) return v } return '' }

/**
 * wb : classeur « BONNET ROUGE … » (onglets PDV et Rapports_BR) ;
 * wbRouting (facultatif) : « BonnetRouge_Routing … » (onglet Routing détaillé).
 */
export function lirePdvAtom(wb, wbRouting = null) {
  const feuille = (w, nom) => w?.worksheets.find(s => norm(s.name) === norm(nom))
  const pdvs = lignesFeuille(feuille(wb, 'PDV')).map(o => ({
    ligne: o._ligne,
    sourceId: champ(o, 'ID_PDV'),
    nom: champ(o, 'Nom_PDV'),
    type: champ(o, 'Type_PDV'),
    tel: telephoneValide(champ(o, 'Contact_Telephone')),
    localisation: champ(o, 'Localisation'),
    lat: nombreGps(champ(o, 'GPS_Lat')),
    lng: nombreGps(champ(o, 'GPS_Lng')),
    creePar: champ(o, 'Créé_par', 'Cree_par'),
  })).filter(p => p.nom || p.sourceId)
  const visites = [
    ...lignesFeuille(feuille(wb, 'Rapports_BR')).map(o => ({
      source: 'Rapports_BR', idPdv: champ(o, 'ID_PDV'), nom: champ(o, 'Nom PDV'), tel: telephoneValide(champ(o, 'Contact PDV')),
      distributeur: champ(o, 'Distributeur'), date: champ(o, 'Date'), gps: pairGps(champ(o, 'GPS (lat,lng)')),
    })),
    ...lignesFeuille(feuille(wbRouting, 'Routing détaillé')).map(o => ({
      source: 'Routing détaillé', idPdv: '', nom: champ(o, 'PDV'), tel: telephoneValide(champ(o, 'Contact PDV')),
      distributeur: champ(o, 'Nom du distributeur'), date: champ(o, 'Date'), gps: pairGps(champ(o, 'GPS visite')),
    })),
  ].filter(v => v.distributeur)
  return { pdvs, visites }
}

// ---------------------------------------------------------------------------
// Données de la base
// ---------------------------------------------------------------------------

export async function chargerDonneesPdvAtom(sb, { onEtape, toutes = toutesLesLignes } = {}) {
  onEtape?.('PDV Atom et voisins')
  const profils = await toutes(() => sb.from('profiles').select('id,nom,employeur,role,is_active').order('id'))
  const idsAtom = profils.filter(p => p.employeur === 'atom').map(p => p.id)
  let pdvAtomIds = []
  try { pdvAtomIds = (await toutes(() => sb.from('pdv_atom').select('pdv_id').order('pdv_id'))).map(x => x.pdv_id) }
  catch { /* table pas encore créée : on s'appuie sur la marque des imports Atom */ }
  const colonnes = 'pdv_id,nom_pdv,adressage,telephone,zone,quartier,region,territory_code,area_code,geolocation_lat,geolocation_lng,gps_source,sous_categorie_pdv,distributor_name,ajoute_par,created_by,is_active'
  const pdvs = await toutes(() => sb.from('pdv').select(colonnes).order('pdv_id'))
  const marques = new Set(pdvAtomIds)
  const estAtom = (p) => marques.has(p.pdv_id) || ['atom', 'atom-absent', 'atom-fichier'].includes(p.gps_source)
    || /^import-(atom|pdv-atom)-/.test(p.ajoute_par || '') || (p.created_by && idsAtom.includes(p.created_by))
  onEtape?.('Référentiels et routing')
  const [distributeurs, types, categories, aliasImport, lignesRouting, quotas] = await Promise.all([
    toutes(() => sb.from('distributeur').select('id,nom').order('id')),
    toutes(() => sb.from('type_pdv').select('id,nom,categorie_pdv_id').order('id')),
    toutes(() => sb.from('categorie_pdv').select('id,nom,canal').order('id')),
    chargerAlias(sb, toutes),
    toutes(() => sb.from('routing_mensuel').select('id,merchandiser_id,jour_semaine,semaine_du_mois,point_visite,latitude,longitude,distributeur')
      .eq('actif', true).in('merchandiser_id', idsAtom.length ? idsAtom : ['00000000-0000-0000-0000-000000000000']).order('id')),
    toutes(() => sb.from('routing_quota_canal').select('canal,jour_semaine,quota').order('canal')),
  ])
  let canaux = []
  try { canaux = await toutes(() => sb.from('canal_atom_sous_categorie').select('sous_categorie,canal').order('sous_categorie')) }
  catch { /* défaut ci-dessous */ }
  return {
    profils, pdvs, pdvsAtom: pdvs.filter(estAtom), distributeurs, types, categories, aliasImport,
    lignesRouting, quotas, canaux,
  }
}

/** Canal Atom d'une sous-catégorie (même règle que canal_atom() en base). */
export function canalAtom(sousCat, canaux = []) {
  const c = canaux.find(x => x.sous_categorie === sousCat)
  if (c) return c.canal
  const s = norm(sousCat)
  if (/SUPERETTE/.test(s)) return 'Superette'
  if (/BOUTIQUE/.test(s)) return 'Boutique'
  if (/ABOKI|KIOSK|TABLE TOP/.test(s)) return 'Aboki & Kiosque'
  if (/PUSHCAR/.test(s)) return 'Pushcart'
  if (/PORRIDGE/.test(s)) return 'Porridge'
  return null
}

// ---------------------------------------------------------------------------
// Quartiers : point de visite le plus proche parmi tous les merchandisers Atom
// ---------------------------------------------------------------------------

/**
 * Regroupe les lignes du routing par point (coordonnées à 1 m près) : Maroc 1
 * à 4 de Zogbolou partagent un point, donc un quartier.
 */
export function pointsDuRouting(lignes) {
  const points = new Map()
  for (const l of lignes) {
    if (!aGps(+l.latitude, +l.longitude)) continue
    const k = `${(+l.latitude).toFixed(5)},${(+l.longitude).toFixed(5)}`
    if (!points.has(k)) points.set(k, { cle: k, lat: +l.latitude, lng: +l.longitude, lignes: [] })
    points.get(k).lignes.push(l)
  }
  return [...points.values()]
}

/**
 * Quartier d'un PDV : le point le plus proche. Si ce point sert plusieurs
 * merchandisers, la boutique va à la ligne dont le distributeur est le sien,
 * puis au premier merchandiser par identifiant (règle fixe, une seule tournée).
 */
export function quartierDe(p, points, distributeurPdv) {
  let meilleur = null
  for (const pt of points) {
    const d = haversine(p.lat, p.lng, pt.lat, pt.lng)
    if (!meilleur || d < meilleur.d) meilleur = { pt, d }
  }
  if (!meilleur) return null
  const merchs = [...new Set(meilleur.pt.lignes.map(l => l.merchandiser_id))].sort()
  const duDistrib = merchs.filter(m => meilleur.pt.lignes.some(l => l.merchandiser_id === m && norm(l.distributeur) === norm(distributeurPdv)))
  const merch = (duDistrib[0] || merchs[0])
  return { cle: meilleur.pt.cle, distance: Math.round(meilleur.d), merchandiserId: merch, lignes: meilleur.pt.lignes.filter(l => l.merchandiser_id === merch) }
}

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------

export function simulerPdvAtom(lu, donnees, options = {}) {
  const aujourdhui = options.aujourdhui || jourIsoLocal()
  const marqueur = options.marqueur || `import-pdv-atom-${aujourdhui}`
  const fichier = options.fichier || 'export Bonnet Rouge'
  const { profils, pdvs, pdvsAtom, distributeurs, types, categories, aliasImport, lignesRouting, quotas, canaux } = donnees

  // ---------- Distributeurs ----------
  const nomsDistributeur = distributeurs.map(d => d.nom)
  const distributeurParNom = new Map(distributeurs.map(d => [norm(d.nom), d]))
  const cacheDistrib = new Map()
  const distributeurDe = (brut) => {
    const k = norm(brut)
    if (!k) return null
    if (!cacheDistrib.has(k)) {
      const canon = resoudreAlias(brut, aliasImport, 'distributeur') || distributeurCanonique(brut, nomsDistributeur)
      cacheDistrib.set(k, distributeurParNom.get(norm(canon))?.nom || null)
    }
    return cacheDistrib.get(k)
  }
  const nonReconnus = new Map()
  const votesParId = new Map()
  const votesParCle = new Map()
  const votesParTel = new Map()
  const voter = (map, k, nom) => { if (!k) return; if (!map.has(k)) map.set(k, new Map()); const m = map.get(k); m.set(nom, (m.get(nom) || 0) + 1) }
  for (const v of lu.visites) {
    const nom = distributeurDe(v.distributeur)
    if (!nom) { nonReconnus.set(v.distributeur, (nonReconnus.get(v.distributeur) || 0) + 1); continue }
    voter(votesParId, v.idPdv, nom)
    voter(votesParCle, `${cleNom(v.nom)}|${v.tel}`, nom)
    voter(votesParTel, v.tel, nom)
  }
  const nbTelFichier = new Map()
  for (const p of lu.pdvs) if (p.tel) nbTelFichier.set(p.tel, (nbTelFichier.get(p.tel) || 0) + 1)
  const majorite = (m) => m ? [...m.entries()].sort((a, b) => b[1] - a[1])[0] : null
  function distributeurFichier(p) {
    const v = majorite(votesParId.get(p.sourceId)) || majorite(votesParCle.get(`${cleNom(p.nom)}|${p.tel}`))
      || (p.tel && nbTelFichier.get(p.tel) === 1 ? majorite(votesParTel.get(p.tel)) : null)
    return v ? v[0] : null
  }

  // ---------- Index des PDV Atom en base ----------
  const nbTelBase = new Map()
  const parTel = new Map()
  for (const b of pdvsAtom) {
    for (const t of new Set([telephoneValide(b.adressage), telephoneValide(b.telephone)].filter(Boolean))) {
      nbTelBase.set(t, (nbTelBase.get(t) || 0) + 1)
      parTel.set(t, b)
    }
  }
  const parNom = new Map()
  for (const b of pdvsAtom) { const k = cleNom(b.nom_pdv); if (!parNom.has(k)) parNom.set(k, []); parNom.get(k).push(b) }

  // Voisins (toute la base) pour localiser un PDV créé.
  const PAS = 0.01
  const grille = new Map()
  for (const b of pdvs) {
    if (!aGps(b.geolocation_lat, b.geolocation_lng) || !b.territory_code) continue
    const k = `${Math.floor(b.geolocation_lat / PAS)}:${Math.floor(b.geolocation_lng / PAS)}`
    if (!grille.has(k)) grille.set(k, [])
    grille.get(k).push(b)
  }
  const voisins = (lat, lng, rayon) => {
    const i = Math.floor(lat / PAS), j = Math.floor(lng / PAS)
    const out = []
    for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) {
      for (const b of grille.get(`${i + di}:${j + dj}`) || []) {
        const d = haversine(lat, lng, b.geolocation_lat, b.geolocation_lng)
        if (d <= rayon) out.push({ b, d })
      }
    }
    return out.sort((x, y) => x.d - y.d)
  }
  function localiser(p) {
    if (!aGps(p.lat, p.lng)) return {}
    const proches = voisins(p.lat, p.lng, RAYON_VOISINS_M).slice(0, NB_VOISINS)
    if (!proches.length) return {}
    const vote = new Map()
    for (const { b } of proches) vote.set(b.territory_code, (vote.get(b.territory_code) || 0) + 1)
    const max = Math.max(...vote.values())
    const ref = proches.find(({ b }) => vote.get(b.territory_code) === max).b
    return { zone: ref.zone || null, territory_code: ref.territory_code, region: ref.region || null }
  }

  // ---------- Types ----------
  const typeParNom = new Map(types.map(t => [norm(t.nom), t]))
  const categorieParId = new Map(categories.map(c => [c.id, c]))
  function typer(sousCat) {
    const t = typeParNom.get(norm(sousCat)) || typeParNom.get(norm('Boutique C'))
    const cat = categorieParId.get(t?.categorie_pdv_id)
    return {
      sous_categorie_pdv: t?.nom || sousCat,
      categorie_pdv: cat?.nom || 'Small/Medium Grocery GT',
      canal: (cat?.canal || '').toUpperCase() === 'MT' ? 'Modern trade' : 'General trade',
    }
  }

  // ---------- Rapprochement ----------
  const idsPris = new Set(pdvs.map(b => b.pdv_id))
  const pris = new Set()
  const stats = { lignes: lu.pdvs.length, avecGps: 0, telephone: 0, nom: 0, crees: 0, creesSansGps: 0, deplaces: 0, deplacesPlus50: 0, distribFichier: 0, distribBase: 0, sansDistributeur: 0, doublonsFichier: 0 }
  const resultats = []
  const vus = new Set()
  for (const p of lu.pdvs) {
    if (p.sourceId && vus.has(p.sourceId)) { stats.doublonsFichier++; continue }
    if (p.sourceId) vus.add(p.sourceId)
    const gps = aGps(p.lat, p.lng)
    if (gps) stats.avecGps++
    let b = null
    let via = ''
    if (p.tel && nbTelFichier.get(p.tel) === 1 && nbTelBase.get(p.tel) === 1 && !pris.has(parTel.get(p.tel).pdv_id)) {
      b = parTel.get(p.tel); via = 'téléphone'
    }
    if (!b && gps) {
      const cands = (parNom.get(cleNom(p.nom)) || []).filter(x => !pris.has(x.pdv_id) && aGps(x.geolocation_lat, x.geolocation_lng)
        && haversine(p.lat, p.lng, x.geolocation_lat, x.geolocation_lng) <= RAYON_NOM_M)
      if (cands.length === 1) { b = cands[0]; via = `nom identique à ${Math.round(haversine(p.lat, p.lng, b.geolocation_lat, b.geolocation_lng))} m` }
    }
    const distribF = distributeurFichier(p)
    if (b) {
      pris.add(b.pdv_id)
      stats[via === 'téléphone' ? 'telephone' : 'nom']++
      const ecart = gps && aGps(b.geolocation_lat, b.geolocation_lng) ? Math.round(haversine(p.lat, p.lng, b.geolocation_lat, b.geolocation_lng)) : null
      const bouge = gps && (ecart == null || ecart > 0)
      if (bouge) stats.deplaces++
      if (ecart != null && ecart > 50) stats.deplacesPlus50++
      const distributeur = distribF || b.distributor_name || null
      if (distribF) stats.distribFichier++
      else if (b.distributor_name) stats.distribBase++
      else stats.sansDistributeur++
      resultats.push({ p, action: 'maj', via, b, ecart, bouge, distributeur, sousCat: b.sous_categorie_pdv, pdvId: b.pdv_id })
    }
    else {
      stats.crees++
      if (!gps) stats.creesSansGps++
      if (distribF) stats.distribFichier++
      else stats.sansDistributeur++
      resultats.push({ p, action: 'creer', via: '', distributeur: distribF, sousCat: sousCategorieDepuisFichier(p.type, p.nom), pdvId: nouvelIdPdv(idsPris) })
    }
  }
  const nonRetrouves = pdvsAtom.filter(b => !pris.has(b.pdv_id) && /^import-atom-/.test(b.ajoute_par || ''))

  // ---------- Quartiers et quotas ----------
  const mesure = mesurerQuartiers({ resultats, pdvsAtom, pris, lignesRouting, quotas, canaux, profils })

  // ---------- Opérations ----------
  const operations = []
  const creations = resultats.filter(r => r.action === 'creer').map(r => {
    const t = typer(r.sousCat)
    const loc = localiser(r.p)
    return {
      pdv_id: r.pdvId, nom_pdv: (r.p.nom || `PDV Atom ${r.p.sourceId}`).slice(0, 300), ...t,
      zone: loc.zone || null, territory_code: loc.territory_code || null, region: loc.region || null,
      geolocation_lat: aGps(r.p.lat, r.p.lng) ? r.p.lat : null, geolocation_lng: aGps(r.p.lat, r.p.lng) ? r.p.lng : null,
      rayon_geofence: 200, adressage: r.p.tel || r.p.localisation || null, telephone: r.p.tel || null,
      distributor_name: r.distributeur || null, ajoute_par: marqueur, is_active: true,
      gps_source: aGps(r.p.lat, r.p.lng) ? 'atom-fichier' : 'atom-absent',
    }
  })
  for (let i = 0; i < creations.length; i += 500) operations.push({ type: 'pdv.creer', lignes: creations.slice(i, i + 500) })
  const positions = resultats.filter(r => r.action === 'maj' && r.bouge).map(r => ({ pdv_id: r.pdvId, lat: r.p.lat, lng: r.p.lng, source: 'atom-fichier' }))
  for (let i = 0; i < positions.length; i += 500) operations.push({ type: 'pdv.gps', motif: fichier, lignes: positions.slice(i, i + 500) })
  const distribs = resultats.filter(r => r.action === 'maj' && r.distributeur && r.distributeur !== r.b.distributor_name)
    .map(r => ({ pdv_id: r.pdvId, valeurs: { distributor_name: r.distributeur } }))
  for (let i = 0; i < distribs.length; i += 200) operations.push({ type: 'pdv.maj', lignes: distribs.slice(i, i + 200) })
  const marques = resultats.map(r => ({ pdv_id: r.pdvId, source_id: r.p.sourceId || null }))
  for (let i = 0; i < marques.length; i += 500) operations.push({ type: 'pdv_atom.enregistrer', lignes: marques.slice(i, i + 500) })

  // Retour arrière : positions d'origine, distributeurs d'origine, PDV créés.
  const retour = []
  const anciennes = resultats.filter(r => r.action === 'maj' && r.bouge && aGps(r.b.geolocation_lat, r.b.geolocation_lng))
    .map(r => ({ pdv_id: r.pdvId, lat: r.b.geolocation_lat, lng: r.b.geolocation_lng, source: r.b.gps_source || 'atom' }))
  for (let i = 0; i < anciennes.length; i += 500) retour.push({ type: 'pdv.gps', motif: `retour ${marqueur}`, lignes: anciennes.slice(i, i + 500) })
  const distribAvant = resultats.filter(r => r.action === 'maj' && r.distributeur && r.distributeur !== r.b.distributor_name && r.b.distributor_name)
    .map(r => ({ pdv_id: r.pdvId, valeurs: { distributor_name: r.b.distributor_name } }))
  for (let i = 0; i < distribAvant.length; i += 200) retour.push({ type: 'pdv.maj', lignes: distribAvant.slice(i, i + 200) })
  const ids = creations.map(c => c.pdv_id)
  for (let i = 0; i < ids.length; i += 500) retour.push({ type: 'pdv.supprimer', marqueur, pdv_ids: ids.slice(i, i + 500) })

  // ---------- Rapport ----------
  const resume = {
    fichier, marqueur, lignes: stats.lignes, avecGps: stats.avecGps,
    retrouvesTelephone: stats.telephone, retrouvesNom: stats.nom, positionsChangees: stats.deplaces, deplacesPlus50m: stats.deplacesPlus50,
    aCreer: stats.crees, aCreerSansGps: stats.creesSansGps,
    distributeurVisites: stats.distribFichier, distributeurBase: stats.distribBase, sansDistributeur: stats.sansDistributeur,
    pdvAtomEnBaseAbsentsDuFichier: nonRetrouves.length, doublonsFichier: stats.doublonsFichier, operations: operations.length,
  }
  const md = []
  md.push(`# PDV Atom géolocalisés — simulation du ${aujourdhui}`, '')
  md.push(`Fichier : ${fichier}. Marqueur : \`${marqueur}\`.`, '')
  md.push('## Rapprochement avec les PDV Atom déjà en base', '')
  md.push('| | PDV |', '|---|---|')
  md.push(`| Lignes de l'onglet PDV | ${stats.lignes} (${stats.avecGps} avec GPS) |`)
  md.push(`| Retrouvés par téléphone (numéro utilisé par une seule boutique) | ${stats.telephone} |`)
  md.push(`| Retrouvés par nom identique à ${RAYON_NOM_M} m au plus, une seule boutique possible | ${stats.nom} |`)
  md.push(`| Position remplacée par celle du fichier | ${stats.deplaces} (dont ${stats.deplacesPlus50} de plus de 50 m) |`)
  md.push(`| À créer | ${stats.crees} (dont ${stats.creesSansGps} sans GPS) |`)
  md.push(`| PDV Atom en base absents du fichier (pas touchés) | ${nonRetrouves.length} |`)
  if (stats.doublonsFichier) md.push(`| Lignes en double dans le fichier (même ID_PDV, ignorées) | ${stats.doublonsFichier} |`)
  md.push('', '## Distributeur des boutiques', '')
  md.push(`- D'après les visites : ${stats.distribFichier}. D'après la base : ${stats.distribBase}. **Sans distributeur : ${stats.sansDistributeur}** — ces boutiques n'entreront dans aucune tournée tant qu'on ne connaît pas leur distributeur.`)
  if (nonReconnus.size) md.push(`- Distributeurs écrits dans les visites et non reconnus : ${[...nonReconnus.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, n]) => `« ${k} » (${n})`).join(', ')}.`)
  md.push('', ...mesure.rapport)

  const csv = {
    'pdv-atom-rapprochement.csv': csvTexte(
      ['action', 'via', 'pdv_id', 'id_fichier', 'nom_fichier', 'nom_base', 'type_fichier', 'distributeur', 'lat', 'lng', 'ecart_m', 'quartier_merchandiser', 'quartier_point', 'distance_point_m'],
      resultats.map(r => {
        const q = mesure.parPdv.get(r.pdvId)
        return [r.action === 'maj' ? 'retrouvé' : 'à créer', r.via, r.pdvId, r.p.sourceId, r.p.nom, r.b?.nom_pdv || '', r.p.type, r.distributeur || '',
          r.p.lat ?? '', r.p.lng ?? '', r.ecart ?? '', q?.merchandiser || '', q?.point || '', q?.distance ?? '']
      })),
    'pdv-atom-absents-du-fichier.csv': csvTexte(['pdv_id', 'nom_pdv', 'distributeur', 'lat', 'lng'],
      nonRetrouves.map(b => [b.pdv_id, b.nom_pdv, b.distributor_name || '', b.geolocation_lat ?? '', b.geolocation_lng ?? ''])),
    'pdv-atom-quotas.csv': mesure.csv,
  }
  return { resume, rapport: md.join('\n'), csv, operations, retour, marqueur, mesure }
}

/**
 * Nombre de boutiques par merchandiser et par type sous la règle des quartiers,
 * comparé aux quotas du mois (somme des quotas de ses 24 jours).
 */
export function mesurerQuartiers({ resultats, pdvsAtom, pris, lignesRouting, quotas, canaux, profils }) {
  const points = pointsDuRouting(lignesRouting)
  const nomDe = new Map(profils.map(p => [p.id, p.nom]))
  const pool = [
    ...resultats.map(r => ({ id: r.pdvId, lat: aGps(r.p.lat, r.p.lng) ? r.p.lat : r.b?.geolocation_lat, lng: aGps(r.p.lat, r.p.lng) ? r.p.lng : r.b?.geolocation_lng, distributeur: r.distributeur, sousCat: r.sousCat })),
    ...pdvsAtom.filter(b => !pris.has(b.pdv_id)).map(b => ({ id: b.pdv_id, lat: b.geolocation_lat, lng: b.geolocation_lng, distributeur: b.distributor_name, sousCat: b.sous_categorie_pdv })),
  ]
  const merchs = [...new Set(lignesRouting.map(l => l.merchandiser_id))]
  const besoin = new Map(merchs.map(m => [m, Object.fromEntries(CANAUX.map(c => [c, 0]))]))
  for (const l of lignesRouting) for (const q of quotas.filter(q => q.jour_semaine === l.jour_semaine)) besoin.get(l.merchandiser_id)[q.canal] += q.quota
  const dispo = new Map(merchs.map(m => [m, Object.fromEntries(CANAUX.map(c => [c, 0]))]))
  const parPdv = new Map()
  const horsTournee = { sansGps: 0, sansDistributeur: 0, autreDistributeur: 0, sansCanal: 0 }
  const parJour = new Map()
  for (const p of pool) {
    if (!aGps(p.lat, p.lng)) { horsTournee.sansGps++; continue }
    const q = quartierDe(p, points, p.distributeur)
    if (!q) continue
    const ligne = q.lignes[0]
    parPdv.set(p.id, { merchandiser: nomDe.get(q.merchandiserId) || '', point: ligne?.point_visite || '', distance: q.distance })
    if (!p.distributeur) { horsTournee.sansDistributeur++; continue }
    if (norm(p.distributeur) !== norm(ligne?.distributeur)) { horsTournee.autreDistributeur++; continue }
    const canal = canalAtom(p.sousCat, canaux)
    if (!canal) { horsTournee.sansCanal++; continue }
    dispo.get(q.merchandiserId)[canal]++
    for (const l of q.lignes) { const k = `${l.merchandiser_id}|${l.point_visite}`; parJour.set(k, (parJour.get(k) || 0) + 1 / q.lignes.length) }
  }
  const rapport = ['## Boutiques par merchandiser et par type (règle des quartiers)', '',
    'Chaque boutique va au point de visite le plus proche parmi ceux des 9 merchandisers Atom, puis entre dans la tournée si son distributeur est celui de ce jour. Besoin = somme des quotas de ses jours sur le mois.', '',
    `| Merchandiser | ${CANAUX.map(c => `${c} (dispo / besoin)`).join(' | ')} | Total |`, `|---|${CANAUX.map(() => '---').join('|')}|---|`]
  const lignesCsv = []
  for (const m of merchs.sort((a, b) => String(nomDe.get(a)).localeCompare(String(nomDe.get(b))))) {
    const d = dispo.get(m), b = besoin.get(m)
    const tot = CANAUX.reduce((s, c) => s + d[c], 0), totB = CANAUX.reduce((s, c) => s + b[c], 0)
    rapport.push(`| ${nomDe.get(m)} | ${CANAUX.map(c => `${d[c] < b[c] ? '**' : ''}${d[c]} / ${b[c]}${d[c] < b[c] ? '**' : ''}`).join(' | ')} | ${tot} / ${totB} |`)
    lignesCsv.push([nomDe.get(m), ...CANAUX.flatMap(c => [d[c], b[c]]), tot, totB])
  }
  rapport.push('', `Hors tournée : ${horsTournee.autreDistributeur} boutiques dont le distributeur n'est pas celui du point de visite le plus proche, ${horsTournee.sansDistributeur} sans distributeur, ${horsTournee.sansGps} sans GPS, ${horsTournee.sansCanal} de type inconnu.`)
  const jours = [...parJour.entries()].map(([k, n]) => ({ k, n: Math.round(n) })).sort((a, b) => a.n - b.n)
  if (jours.length) {
    rapport.push('', '### Points de visite les moins fournis', '')
    for (const { k, n } of jours.slice(0, 15)) {
      const [m, pt] = k.split('|')
      rapport.push(`- ${nomDe.get(m)} — ${pt} : ${n} boutique(s) de son distributeur`)
    }
  }
  const csv = csvTexte(['merchandiser', ...CANAUX.flatMap(c => [`${c} dispo`, `${c} besoin`]), 'total dispo', 'total besoin'], lignesCsv)
  return { rapport, csv, parPdv, dispo, besoin, horsTournee, jours: JOURS }
}
