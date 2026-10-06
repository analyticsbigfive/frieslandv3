/**
 * Import des visites Atom BTL (export « Bonnet Rouge », feuille « Routing
 * détaillé ») dans `visites` — cœur partagé par scripts/importer-routing-atom.mjs
 * et Admin › Imports terrain.
 *
 * 1. Merchandiseur → compte : alias d'import (Référentiels › Alias d'import),
 *    sinon nom (ordre prénom/nom indifférent), compte actif d'abord.
 * 2. PDV : par téléphone (« Contact PDV » ↔ pdv.adressage), puis nom commun à
 *    ≤ 50 m du GPS de visite, puis PDV seul à ≤ 25 m ; sinon créé (marqueur
 *    `ajoute_par`), typé d'après « Type PDV » et localisé par ses voisins.
 * 3. Visite : `visite_id = ATOM-<date>-<n° ligne>` (relance idempotente),
 *    distributeur et SSF rapprochés (bruts conservés), compteurs dans `data.atom`.
 *
 * Module pur : simulation → { resume, rapport, csv, operations, retour }.
 */
import {
  aGps, chargerAlias, cleNom, csvTexte, distributeurCanonique, haversine, jourIsoLocal, motsNom, norm, nouvelIdPdv, paquets,
  resoudreAlias, texteCellule, toutesLesLignes,
} from '../commun.mjs'

export const PREFIXE_VISITE = 'ATOM'
const RAYON_NOM_M = 50
const RAYON_SEUL_M = 25
const RAYON_ZONE_M = 1500
const NB_VOISINS = 7
const RAYON_QUARTIER_M = 500

// « Type PDV » du fichier → sous-catégorie du référentiel pour un PDV créé.
function typeDepuisFichier(typeFichier, nomPdv) {
  const t = norm(typeFichier)
  const n = norm(nomPdv)
  if (/PORRIDGE/.test(t)) return 'Porridge'
  if (/PUSHCAR/.test(t)) return 'Pushcard A'
  if (/TABLE TOP/.test(t)) return 'Table Top'
  if (/ABOKI|KIOS/.test(t)) return /ABOKI/.test(n) ? 'Aboki A' : 'Kiosk A'
  if (/SUPERETTE/.test(n) || /SUPERMARCH/.test(n)) return 'Superettes B'
  return 'Boutique C'
}

const chiffres = (s) => String(s || '').replace(/\D/g, '').replace(/^225/, '')
const telephoneValide = (s) => { const c = chiffres(s); return c.length >= 8 ? c : '' }
const gps = (s) => {
  const m = String(s || '').match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/)
  if (!m) return { lat: null, lng: null }
  const lat = Number(m[1]), lng = Number(m[2])
  return aGps(lat, lng) ? { lat, lng } : { lat: null, lng: null }
}
const entier = (v) => { const n = Number(texteCellule(v)); return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0 }
const dateIso = (v) => {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const s = String(texteCellule(v) ?? '')
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  const m2 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  return m2 ? `${m2[3]}-${m2[2]}-${m2[1]}` : ''
}

/** Lignes de la feuille « Routing détaillé » (ou de la première feuille). */
export function lireExcelRoutingAtom(classeur) {
  const ws = classeur.getWorksheet('Routing détaillé') || classeur.worksheets[0]
  if (!ws) throw new Error('Classeur vide')
  const entete = ws.getRow(1).values.slice(1).map(v => norm(texteCellule(v)))
  const col = (nom) => { const i = entete.findIndex(h => h === norm(nom)); if (i < 0) throw new Error(`Colonne « ${nom} » absente de la feuille ${ws.name}`); return i }
  const C = {
    date: col('Date'), merch: col('Merchandiseur'), num: col('Routing (N° tournée)'), pdv: col('PDV'), type: col('Type PDV'),
    tel: col('Contact PDV'), zone: col('Zone / Quartier'), loc: col('Localisation'), distrib: col('Nom du distributeur'),
    ssf: col('SSF (avec qui)'), actions: col('Actions menées'), taches: col('Tâches accomplies'), visibilite: col('Visibilité'),
    pose: col('Pose'), affiche: col('Affiche'), branding: col('Branding'), cartons: col('Cartons'), ps: col('Perfect Store'), gps: col('GPS visite'),
  }
  const txt = (v) => String(texteCellule(v) ?? '').trim()
  const lignes = []
  ws.eachRow((row, i) => {
    if (i === 1) return
    const v = row.values.slice(1)
    const date = dateIso(v[C.date])
    if (!date) return
    const g = gps(txt(v[C.gps]))
    lignes.push({
      ligne: i, date, merch: txt(v[C.merch]), num: entier(v[C.num]),
      pdv: txt(v[C.pdv]).replace(/\s+/g, ' '), type: txt(v[C.type]),
      tel: telephoneValide(txt(v[C.tel])), zone: txt(v[C.zone]), loc: txt(v[C.loc]),
      distrib: txt(v[C.distrib]), ssf: txt(v[C.ssf]), actions: txt(v[C.actions]), taches: txt(v[C.taches]),
      visibilite: entier(v[C.visibilite]), pose: entier(v[C.pose]), affiche: entier(v[C.affiche]),
      branding: entier(v[C.branding]), cartons: entier(v[C.cartons]), ps: txt(v[C.ps]).toLowerCase() || null,
      lat: g.lat, lng: g.lng,
    })
  })
  return lignes
}

export async function chargerDonneesRoutingAtom(sb, { onEtape, toutes = toutesLesLignes } = {}) {
  onEtape?.('Comptes et PDV')
  const [profils, pdvs] = await Promise.all([
    toutes(() => sb.from('profiles').select('id,email,nom,role,is_active').order('id')),
    toutes(() => sb.from('pdv')
      .select('pdv_id,nom_pdv,adressage,zone,quartier,region,territory_code,area_code,geolocation_lat,geolocation_lng,sous_categorie_pdv,distributor_name,is_active')
      .order('pdv_id')),
  ])
  onEtape?.('Référentiels et visites déjà importées')
  const [ssfs, distributeurs, types, categories, territoires, alias, visitesExistantes, aliasImport] = await Promise.all([
    toutes(() => sb.from('ssf').select('id,nom,nom_brut,distributeur_id').order('id')),
    toutes(() => sb.from('distributeur').select('id,nom').order('id')),
    toutes(() => sb.from('type_pdv').select('id,nom,categorie_pdv_id').order('id')),
    toutes(() => sb.from('categorie_pdv').select('id,nom,canal').order('id')),
    toutes(() => sb.from('territoire').select('code,nom,sous_region_code').order('code')),
    toutes(() => sb.from('territoire_alias').select('alias,territoire_code').order('alias')),
    toutes(() => sb.from('visites').select('visite_id').like('visite_id', `${PREFIXE_VISITE}-%`).order('visite_id')),
    chargerAlias(sb, toutes),
  ])
  return { profils, pdvs, ssfs, distributeurs, types, categories, territoires, alias, visitesExistantes, aliasImport }
}

export function simulerRoutingAtom(lignes, donnees, options = {}) {
  const aujourdhui = options.aujourdhui || jourIsoLocal()
  const marqueur = options.marqueur || `import-atom-${aujourdhui}`
  const fichier = options.fichier || 'export Atom'
  const { profils, pdvs, ssfs, distributeurs, types, categories, territoires, alias, visitesExistantes, aliasImport } = donnees
  const dejaImportees = new Set(visitesExistantes.map(v => v.visite_id))

  // ---------- Comptes ----------
  const profilParEmail = new Map(profils.filter(p => p.email).map(p => [p.email.toLowerCase(), p]))
  const emailsAlias = new Set(aliasImport.filter(a => a.type === 'merchandiser').map(a => String(a.cible).toLowerCase()))
  const profilsParCle = new Map()
  for (const p of profils.filter(p => p.role === 'merchandiser' && p.nom)) {
    const k = cleNom(p.nom)
    if (!profilsParCle.has(k)) profilsParCle.set(k, [])
    profilsParCle.get(k).push(p)
  }
  const merchCache = new Map()
  function compteDe(nomFichier) {
    const k = norm(nomFichier)
    if (merchCache.has(k)) return merchCache.get(k)
    let p = null
    const email = resoudreAlias(nomFichier, aliasImport, 'merchandiser')
    if (email) p = profilParEmail.get(String(email).toLowerCase()) || null
    if (!p) {
      const candidats = profilsParCle.get(cleNom(nomFichier)) || []
      // Plusieurs comptes au même nom : compte actif d'abord, puis celui cité
      // dans les alias (comptes Atom en service).
      const atom = (x) => emailsAlias.has(String(x.email).toLowerCase())
      p = [...candidats].sort((a, b) => (b.is_active !== false) - (a.is_active !== false) || atom(b) - atom(a))[0] || null
    }
    merchCache.set(k, p)
    return p
  }

  // ---------- PDV ----------
  const typeParNom = new Map(types.map(t => [norm(t.nom), t]))
  const categorieParId = new Map(categories.map(c => [c.id, c]))
  function typer(sousCat) {
    const t = typeParNom.get(norm(sousCat)) || typeParNom.get(norm('Boutique C'))
    const cat = categorieParId.get(t?.categorie_pdv_id)
    return {
      sous_categorie_pdv: t?.nom || 'Boutique C',
      categorie_pdv: cat?.nom || 'Small/Medium Grocery GT',
      canal: (cat?.canal || '').toUpperCase() === 'MT' ? 'Modern trade' : 'General trade',
    }
  }
  const pdvParTel = new Map()
  for (const p of pdvs) {
    const t = telephoneValide(p.adressage)
    if (t && !pdvParTel.has(t)) pdvParTel.set(t, p)
  }
  const PAS = 0.01
  const grille = new Map()
  for (const p of pdvs) {
    if (!aGps(p.geolocation_lat, p.geolocation_lng)) continue
    p._mots = motsNom(p.nom_pdv)
    const k = `${Math.floor(p.geolocation_lat / PAS)}:${Math.floor(p.geolocation_lng / PAS)}`
    if (!grille.has(k)) grille.set(k, [])
    grille.get(k).push(p)
  }
  const voisins = (lat, lng, rayon) => {
    const i = Math.floor(lat / PAS), j = Math.floor(lng / PAS)
    const out = []
    for (let di = -2; di <= 2; di++) {
      for (let dj = -2; dj <= 2; dj++) {
        for (const p of grille.get(`${i + di}:${j + dj}`) || []) {
          const d = haversine(lat, lng, p.geolocation_lat, p.geolocation_lng)
          if (d <= rayon) out.push({ p, d })
        }
      }
    }
    return out.sort((a, b) => a.d - b.d)
  }
  const nomTerritoireParCode = new Map(territoires.map(t => [t.code, t.nom]))
  const codeParNom = new Map()
  for (const t of territoires) codeParNom.set(norm(t.nom), t.code)
  for (const a of alias) if (!codeParNom.has(norm(a.alias))) codeParNom.set(norm(a.alias), a.territoire_code)
  const zoneParCode = new Map()
  const regionParCode = new Map()
  {
    const compte = new Map()
    for (const p of pdvs) {
      if (!p.territory_code || !p.zone) continue
      const k = `${p.territory_code}|${p.zone}|${p.region || ''}`
      compte.set(k, (compte.get(k) || 0) + 1)
    }
    const meilleur = new Map()
    for (const [k, n] of compte) {
      const [code, zone, region] = k.split('|')
      if ((meilleur.get(code)?.n || 0) < n) meilleur.set(code, { n, zone, region })
    }
    for (const [code, { zone, region }] of meilleur) { zoneParCode.set(code, zone); regionParCode.set(code, region) }
  }
  function localiser(l) {
    let code = null
    let proches = []
    if (aGps(l.lat, l.lng)) {
      proches = voisins(l.lat, l.lng, RAYON_ZONE_M).filter(x => x.p.territory_code)
      const vote = new Map()
      proches.slice(0, NB_VOISINS).forEach(({ p }) => vote.set(p.territory_code, (vote.get(p.territory_code) || 0) + 1))
      const max = Math.max(0, ...vote.values())
      code = proches.slice(0, NB_VOISINS).find(({ p }) => vote.get(p.territory_code) === max)?.p.territory_code || null
    }
    if (!code) {
      // « Cocody 2 », « Adjamé/Attécoubé », « Yopougon zone industrielle »…
      const z = norm(l.zone).split(/[/(]/)[0].trim()
      code = codeParNom.get(z) || [...codeParNom.entries()].find(([n]) => z.startsWith(n))?.[1] || null
    }
    if (!code) return { zone: null, territoryCode: null, region: null, quartier: null, areaCode: null }
    const zone = zoneParCode.get(code) || nomTerritoireParCode.get(code)
    const voisin = proches.find(({ p, d }) => d <= RAYON_QUARTIER_M && p.zone === zone && p.quartier)
    return { zone, territoryCode: code, region: regionParCode.get(code) || null, quartier: voisin?.p.quartier || null, areaCode: voisin?.p.area_code || null }
  }

  // ---------- Distributeurs et SSF ----------
  const nomsDistributeur = distributeurs.map(d => d.nom)
  const distributeurParNom = new Map(distributeurs.map(d => [norm(d.nom), d]))
  const distribCache = new Map()
  function distributeurDe(brut) {
    const k = norm(brut).replace(/[^A-Z0-9& ]/g, ' ').replace(/\s+/g, ' ').trim()
    if (!k) return null
    if (!distribCache.has(k)) {
      const canon = resoudreAlias(brut, aliasImport, 'distributeur') || distributeurCanonique(brut, nomsDistributeur)
      distribCache.set(k, distributeurParNom.get(norm(canon)) || null)
    }
    return distribCache.get(k)
  }
  const ssfParVariante = new Map()
  for (const s of ssfs) {
    for (const v of [s.nom, ...String(s.nom_brut || '').split('|')]) {
      const k = cleNom(v)
      if (k && !ssfParVariante.has(k)) ssfParVariante.set(k, s)
    }
  }
  const ssfParNom = new Map(ssfs.map(s => [norm(s.nom), s]))
  const ssfDe = (brut) => {
    if (!brut) return null
    const viaAlias = resoudreAlias(brut, aliasImport, 'ssf')
    return (viaAlias && ssfParNom.get(norm(viaAlias))) || ssfParVariante.get(cleNom(brut)) || null
  }

  // ---------- Rapprochement ----------
  const idsPris = new Set(pdvs.map(p => p.pdv_id))
  const creations = new Map() // clé fichier → ligne pdv à créer
  const ecartees = []
  const visites = []
  const stats = { tel: 0, nom: 0, seul: 0, cree: 0, reutilise: 0, sansCompte: 0, deja: 0, sansGps: 0, ssfOk: 0, distribOk: 0 }
  const clePdvFichier = (l) => {
    if (l.tel) return `tel:${l.tel}`
    if (aGps(l.lat, l.lng)) return `nom:${cleNom(l.pdv)}@${l.lat.toFixed(3)},${l.lng.toFixed(3)}`
    return `nom:${cleNom(l.pdv)}@${norm(l.zone)}`
  }
  function trouverPdv(l) {
    if (l.tel && pdvParTel.has(l.tel)) { stats.tel++; return { p: pdvParTel.get(l.tel), via: 'téléphone' } }
    if (!aGps(l.lat, l.lng)) return null
    const proches = voisins(l.lat, l.lng, RAYON_NOM_M)
    const mots = motsNom(l.pdv)
    const commun = proches.find(({ p }) => [...p._mots].some(w => mots.has(w)))
    if (commun) { stats.nom++; return { p: commun.p, via: `nom commun à ${Math.round(commun.d)} m` } }
    const seuls = proches.filter(x => x.d <= RAYON_SEUL_M)
    if (seuls.length === 1) { stats.seul++; return { p: seuls[0].p, via: `seul PDV à ${Math.round(seuls[0].d)} m` } }
    return null
  }

  for (const l of lignes) {
    const visiteId = `${PREFIXE_VISITE}-${l.date}-${l.ligne}`
    if (dejaImportees.has(visiteId)) { stats.deja++; continue }
    const compte = compteDe(l.merch)
    if (!compte) { stats.sansCompte++; ecartees.push({ ...l, motif: `merchandiseur inconnu : ${l.merch}` }); continue }
    if (!aGps(l.lat, l.lng)) stats.sansGps++

    const cle = clePdvFichier(l)
    let pdvId
    if (creations.has(cle)) { pdvId = creations.get(cle).ligne.pdv_id; stats.reutilise++ }
    else {
      const trouve = trouverPdv(l)
      if (trouve) pdvId = trouve.p.pdv_id
      else {
        const loc = localiser(l)
        const type = typer(typeDepuisFichier(l.type, l.pdv))
        const ligne = {
          pdv_id: nouvelIdPdv(idsPris),
          nom_pdv: l.pdv || `PDV ${l.ligne}`,
          canal: type.canal, categorie_pdv: type.categorie_pdv, sous_categorie_pdv: type.sous_categorie_pdv,
          region: loc.region, zone: loc.zone, quartier: loc.quartier, territory_code: loc.territoryCode, area_code: loc.areaCode,
          geolocation_lat: l.lat, geolocation_lng: l.lng, rayon_geofence: 200,
          adressage: l.tel || l.loc || null,
          distributor_name: distributeurDe(l.distrib)?.nom || null,
          date_creation: l.date, ajoute_par: marqueur, is_active: true,
          gps_source: aGps(l.lat, l.lng) ? 'atom' : 'atom-absent',
        }
        creations.set(cle, { ligne, l })
        pdvId = ligne.pdv_id
        stats.cree++
      }
    }

    const distrib = distributeurDe(l.distrib)
    const ssf = ssfDe(l.ssf)
    if (distrib) stats.distribOk++
    if (ssf) stats.ssfOk++
    const heure = 8 * 60 + Math.max(0, l.num - 1) * 20 // 08:00, puis 20 min par étape
    const dateVisite = `${l.date}T${String(Math.floor(heure / 60) % 24).padStart(2, '0')}:${String(heure % 60).padStart(2, '0')}:00Z`
    visites.push({
      visite_id: visiteId,
      pdv_id: pdvId,
      user_id: compte.id,
      date_visite: dateVisite,
      commercial: compte.nom,
      email: compte.email,
      geolocation_lat: l.lat, geolocation_lng: l.lng,
      geofence_validated: false, precision_gps: null,
      status: 'soumis', sync_status: 'synced', synced_at: new Date().toISOString(),
      distributeur_id: distrib?.id || null, distributeur_brut: l.distrib || null,
      ssf_id: ssf?.id || null, ssf_brut: l.ssf || null,
      image_urls: [],
      data: {
        source: 'bonnet-rouge-export',
        actions: {
          referencement_produits: false, execution_activites_promotionnelles: false, prospection_pdv: false,
          verification_fifo: false, rangement_produits: false,
          pose_affiches: l.affiche > 0, pose_materiel_visibilite: l.pose > 0 || l.visibilite > 0 || l.branding > 0,
        },
        commentaires: [l.taches, l.actions].filter(Boolean).join(' · ').slice(0, 1000) || undefined,
        atom: {
          routing_num: l.num, type_pdv: l.type, visibilite: l.visibilite, pose: l.pose, affiche: l.affiche,
          branding: l.branding, cartons: l.cartons, perfect_store: l.ps, taches: l.taches || null, actions: l.actions || null,
          zone: l.zone || null, localisation: l.loc || null,
        },
      },
    })
  }

  // ---------- Opérations et retour arrière ----------
  const lignesPdv = [...creations.values()].map(x => x.ligne)
  const operations = [
    ...paquets(lignesPdv, 500).map(lignes => ({ type: 'pdv.creer', lignes })),
    ...paquets(visites, 200).map(lignes => ({ type: 'visites.importer', lignes })),
  ]
  const retour = [
    ...paquets(visites.map(v => v.visite_id), 500).map(visite_ids => ({ type: 'visites.supprimer', visite_ids })),
    ...paquets(lignesPdv.map(p => p.pdv_id), 500).map(pdv_ids => ({ type: 'pdv.supprimer', marqueur, pdv_ids })),
  ]

  // ---------- Rapport ----------
  const parCompte = new Map()
  for (const v of visites) {
    if (!parCompte.has(v.email)) parCompte.set(v.email, { n: 0, pdv: new Set(), jours: new Set() })
    const x = parCompte.get(v.email); x.n++; x.pdv.add(v.pdv_id); x.jours.add(v.date_visite.slice(0, 10))
  }
  const inconnus = [...new Set(ecartees.map(e => e.merch))]
  const rapport = `# Import des visites Atom — ${fichier}

- Lignes lues : ${lignes.length} ; déjà importées : ${stats.deja} ; écartées (merchandiseur inconnu) : ${stats.sansCompte}
- Visites à créer : ${visites.length}, dont ${stats.sansGps} sans GPS
- PDV reconnus : ${stats.tel} par téléphone, ${stats.nom} par nom à ≤ ${RAYON_NOM_M} m, ${stats.seul} seul PDV à ≤ ${RAYON_SEUL_M} m
- PDV créés : ${creations.size} (réutilisés sur ${stats.reutilise} autres visites), marqueur \`${marqueur}\`
- Distributeur rapproché : ${stats.distribOk}/${visites.length} ; SSF rapproché : ${stats.ssfOk}/${visites.length}

## Par compte

${parCompte.size ? `| Compte | Visites | PDV distincts | Jours |\n|---|---|---|---|\n${[...parCompte.entries()].sort((a, b) => b[1].n - a[1].n).map(([k, x]) => `| ${k} | ${x.n} | ${x.pdv.size} | ${x.jours.size} |`).join('\n')}` : 'Aucune visite à créer.'}

## Merchandiseurs inconnus (lignes écartées)

${inconnus.length ? inconnus.map(n => `- ${n} (${ecartees.filter(e => e.merch === n).length} lignes) — à rattacher dans Référentiels › Alias d'import`).join('\n') : 'Aucun.'}

## Distributeurs non reconnus

${[...new Set(visites.filter(v => !v.distributeur_id && v.distributeur_brut).map(v => v.distributeur_brut))].slice(0, 30).map(d => `- ${d}`).join('\n') || 'Aucun.'}

## SSF non reconnus (30 premiers)

${[...new Set(visites.filter(v => !v.ssf_id && v.ssf_brut).map(v => v.ssf_brut))].slice(0, 30).map(d => `- ${d}`).join('\n') || 'Aucun.'}

## Retour arrière

Bouton « Annuler le lot » (Admin › Imports terrain) ou \`--retour=<fichier>\` : les visites de ce lot sont supprimées, puis les PDV qu'il a créés et qui n'ont pas d'autre visite.
`
  const csv = {
    'import-routing-atom-pdv-crees.csv': csvTexte(['pdv_id', 'nom_pdv', 'sous_categorie_pdv', 'zone', 'quartier', 'territory_code', 'lat', 'lng', 'adressage', 'distributor_name', 'type_fichier', 'zone_fichier'],
      [...creations.values()].map(({ ligne, l }) => [ligne.pdv_id, ligne.nom_pdv, ligne.sous_categorie_pdv, ligne.zone, ligne.quartier, ligne.territory_code, ligne.geolocation_lat, ligne.geolocation_lng, ligne.adressage, ligne.distributor_name, l.type, l.zone])),
    'import-routing-atom-ecartes.csv': csvTexte(['ligne', 'date', 'merchandiseur', 'pdv', 'motif'], ecartees.map(e => [e.ligne, e.date, e.merch, e.pdv, e.motif])),
  }
  const resume = {
    lignes: lignes.length, dejaImportees: stats.deja, ecartees: stats.sansCompte, visites: visites.length,
    pdvCrees: creations.size, ssfRapproches: stats.ssfOk, distributeursRapproches: stats.distribOk, operations: operations.length,
  }
  return { resume, rapport, csv, operations, retour, marqueur }
}
