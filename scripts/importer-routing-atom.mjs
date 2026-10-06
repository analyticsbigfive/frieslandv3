#!/usr/bin/env node
/**
 * Importe l'historique de visites Atom BTL (export « Bonnet Rouge »,
 * feuille « Routing détaillé », juin → septembre 2026) dans `visites`.
 *
 * Ces visites ont été faites avec l'outil de reporting d'Atom, pas avec l'app.
 * Les reprendre permet de compter la couverture réelle du programme (420 PDV
 * par agent et par mois) et d'exclure des tournées par quota les PDV déjà
 * visités dans le mois (etapes_quota_du_jour).
 *
 * 1. Merchandiseur → profil (ordre prénom/nom indifférent, alias ci-dessous).
 *    Inconnu : la ligne est écartée et listée dans le rapport.
 * 2. PDV : rapproché d'abord par téléphone (« Contact PDV » ↔ pdv.adressage),
 *    puis par nom commun à ≤ 50 m du GPS de visite (scripts/lib/dms.mjs),
 *    puis PDV seul à ≤ 25 m. Sinon créé (`ajoute_par = import-atom-2026-10-06`),
 *    typé d'après la colonne « Type PDV » et localisé par ses voisins comme
 *    l'import DMS (scripts/importer-dms-pdv.mjs). Un même PDV du fichier
 *    (même téléphone, ou même nom au même endroit) n'est créé qu'une fois.
 * 3. Visite : `visite_id = ATOM-<date>-<n° ligne>` (relance idempotente),
 *    distributeur et SSF rapprochés du référentiel (bruts conservés),
 *    compteurs Atom dans `data.atom`, actions déduites dans `data.actions`.
 *
 * Simulation par défaut (rapport + CSV dans ~/Downloads) ; --apply pour écrire.
 * --apply exige les migrations 20261006100000 (ssf, colonnes visites).
 *
 * Usage :
 *   node scripts/importer-routing-atom.mjs [--fichier=chemin.xlsx] [--apply]
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import ExcelJS from 'exceljs'
import { randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { aGps, cleNom, distributeurCanonique, ecrireCsv, haversine, motsNom, norm, texteCellule, toutesLesLignes } from './lib/dms.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env'), quiet: true })

const arg = (nom, defaut) => process.argv.find(a => a.startsWith(`--${nom}=`))?.split('=').slice(1).join('=') || defaut
const APPLY = process.argv.includes('--apply')
const DOWNLOADS = join(process.env.HOME, 'Downloads')
const FICHIER = arg('fichier', join(DOWNLOADS, 'BonnetRouge_Routing_2026-06-01_2026-09-30.xlsx'))
const MARQUEUR = 'import-atom-2026-10-06'
const PREFIXE_VISITE = 'ATOM'
const RAYON_NOM_M = 50
const RAYON_SEUL_M = 25
const RAYON_ZONE_M = 1500
const NB_VOISINS = 7
const RAYON_QUARTIER_M = 500

const OUT_MD = join(DOWNLOADS, 'import-routing-atom-rapport.md')
const OUT_CSV = join(DOWNLOADS, 'import-routing-atom-pdv-crees.csv')
const OUT_ECARTES = join(DOWNLOADS, 'import-routing-atom-ecartes.csv')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Nom du fichier → email du compte, quand la clé prénom/nom ne suffit pas.
const ALIAS_MERCH = {
  'DEHO WILFRIED': 'yopougonmerchtwo@gmail.com',
  'DIABATE': 'cocodymerchtwo@gmail.com',
  'BERNADIN GUIHI': 'cocodymerchtwo@gmail.com',
  'KOUADIO ATTOFE ANICET': 'koumassimerchone@gmail.com',
  'KOUADIO ATTOFE GUY': 'koumassimerchone@gmail.com',
  "MOUSTAPHA N'DIAYE": 'portbouetone@gmail.com',
  'SEREGONE CHADRAC': 'abobomerchone@gmail.com',
  'ZOGBOLOU KEVIN': 'yopougonone@gmail.com',
  'YAO VENANCE': 'abobomerchtwo@gmail.com',
  'ABBE FREDERIC': 'attecoubeone@gmail.com',
  'KOUAME HELLARION': 'cocodyone@gmail.com',
  'AKEDAN JEAN-YVES': 'marcorytreichone@gmail.com',
  'METCH DIANE': 'metch.diane@friesland-terrain.ci',
  'HIEN FILIPE': 'hien.filipe@friesland-terrain.ci',
  'VITAL YOBOUET': 'vital.yobouet@friesland-terrain.ci',
}

const ALIAS_EMAILS = new Set(Object.values(ALIAS_MERCH))

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
  const s = texteCellule(v)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  const m2 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  return m2 ? `${m2[3]}-${m2[2]}-${m2[1]}` : ''
}

// ---------- 1. Fichier ----------

const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile(FICHIER)
const ws = wb.getWorksheet('Routing détaillé') || wb.worksheets[0]
const entete = ws.getRow(1).values.slice(1).map(v => norm(texteCellule(v)))
const col = (nom) => { const i = entete.findIndex(h => h === norm(nom)); if (i < 0) throw new Error(`colonne « ${nom} » absente`); return i }
const C = {
  date: col('Date'), merch: col('Merchandiseur'), num: col('Routing (N° tournée)'), pdv: col('PDV'), type: col('Type PDV'),
  tel: col('Contact PDV'), zone: col('Zone / Quartier'), loc: col('Localisation'), distrib: col('Nom du distributeur'),
  ssf: col('SSF (avec qui)'), actions: col('Actions menées'), taches: col('Tâches accomplies'), visibilite: col('Visibilité'),
  pose: col('Pose'), affiche: col('Affiche'), branding: col('Branding'), cartons: col('Cartons'), ps: col('Perfect Store'), gps: col('GPS visite'),
}
const lignes = []
ws.eachRow((row, i) => {
  if (i === 1) return
  const v = row.values.slice(1)
  const g = gps(texteCellule(v[C.gps]))
  const date = dateIso(v[C.date])
  if (!date) return
  lignes.push({
    ligne: i, date, merch: texteCellule(v[C.merch]).trim(), num: entier(v[C.num]),
    pdv: texteCellule(v[C.pdv]).replace(/\s+/g, ' ').trim(), type: texteCellule(v[C.type]).trim(),
    tel: telephoneValide(v[C.tel]), zone: texteCellule(v[C.zone]).trim(), loc: texteCellule(v[C.loc]).trim(),
    distrib: texteCellule(v[C.distrib]).trim(), ssf: texteCellule(v[C.ssf]).trim(),
    actions: texteCellule(v[C.actions]).trim(), taches: texteCellule(v[C.taches]).trim(),
    visibilite: entier(v[C.visibilite]), pose: entier(v[C.pose]), affiche: entier(v[C.affiche]),
    branding: entier(v[C.branding]), cartons: entier(v[C.cartons]), ps: texteCellule(v[C.ps]).trim().toLowerCase() || null,
    lat: g.lat, lng: g.lng,
  })
})
console.log(`📄 ${lignes.length} lignes lues dans ${FICHIER.split('/').pop()}`)

// ---------- 2. Référentiels ----------

const [profils, pdvs, ssfs, distributeurs, types, categories, territoires, alias, visitesExistantes] = await Promise.all([
  toutesLesLignes(() => supabase.from('profiles').select('id,email,nom,role,is_active').order('id')),
  toutesLesLignes(() => supabase.from('pdv')
    .select('pdv_id,nom_pdv,adressage,zone,quartier,region,territory_code,area_code,geolocation_lat,geolocation_lng,sous_categorie_pdv,distributor_name,is_active')
    .order('pdv_id')),
  toutesLesLignes(() => supabase.from('ssf').select('id,nom,nom_brut,distributeur_id').order('id')),
  toutesLesLignes(() => supabase.from('distributeur').select('id,nom').order('id')),
  toutesLesLignes(() => supabase.from('type_pdv').select('id,nom,categorie_pdv_id').order('id')),
  toutesLesLignes(() => supabase.from('categorie_pdv').select('id,nom,canal').order('id')),
  toutesLesLignes(() => supabase.from('territoire').select('code,nom,sous_region_code').order('code')),
  toutesLesLignes(() => supabase.from('territoire_alias').select('alias,territoire_code').order('alias')),
  toutesLesLignes(() => supabase.from('visites').select('visite_id').like('visite_id', `${PREFIXE_VISITE}-%`).order('visite_id')),
])
const dejaImportees = new Set(visitesExistantes.map(v => v.visite_id))

// Comptes
const profilParEmail = new Map(profils.map(p => [p.email.toLowerCase(), p]))
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
  const aliasEmail = ALIAS_MERCH[k] || ALIAS_MERCH[cleNom(nomFichier)]
  if (aliasEmail) p = profilParEmail.get(aliasEmail) || null
  if (!p) {
    const candidats = profilsParCle.get(cleNom(nomFichier)) || []
    // Plusieurs comptes au même nom (ancien / nouveau) : compte actif d'abord,
    // puis celui de la liste Atom (emails en @gmail.com « …merch… », pas les
    // anciens comptes -two@ / -one@ remplacés le 24/09).
    const atom = (x) => ALIAS_EMAILS.has(x.email.toLowerCase())
    p = candidats.sort((a, b) => (b.is_active !== false) - (a.is_active !== false) || atom(b) - atom(a))[0] || null
  }
  merchCache.set(k, p)
  return p
}

// PDV
const typeParNom = new Map(types.map(t => [norm(t.nom), t]))
const categorieParId = new Map(categories.map(c => [c.id, c]))
function typer(sousCat) {
  const t = typeParNom.get(norm(sousCat)) || typeParNom.get(norm('Boutique C'))
  const cat = categorieParId.get(t.categorie_pdv_id)
  return {
    sous_categorie_pdv: t.nom,
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
function voisins(lat, lng, rayon) {
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
// Libellé `pdv.zone` et région majoritaires par territory_code (comme en base).
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
    const z = norm(l.zone).split(/[\/(]/)[0].trim()
    code = codeParNom.get(z) || [...codeParNom.entries()].find(([n]) => z.startsWith(n))?.[1] || null
  }
  if (!code) return { zone: null, territoryCode: null, region: null, quartier: null, areaCode: null }
  const zone = zoneParCode.get(code) || nomTerritoireParCode.get(code)
  const voisin = proches.find(({ p, d }) => d <= RAYON_QUARTIER_M && p.zone === zone && p.quartier)
  return { zone, territoryCode: code, region: regionParCode.get(code) || null, quartier: voisin?.p.quartier || null, areaCode: voisin?.p.area_code || null }
}

// Distributeurs et SSF
const nomsDistributeur = distributeurs.map(d => d.nom)
const distributeurParNom = new Map(distributeurs.map(d => [norm(d.nom), d]))
// Orthographes de l'export Atom → nom du référentiel `distributeur`.
const ALIAS_DISTRIB = [
  [/^BOUSSOURA/, 'BOUSSOURA SARL'],
  [/^SODICO|^SODICI|^SODICOM/, 'SODICOM-CI'],
  [/NIARE/, 'ETABLISSEMENT NIARE & FRERES'],
  [/^NDA$|NOUVEAUX DISTRIBUTEURS/, 'NOUVEAUX DISTRIBUTEURS ASSOCIES'],
  [/^SIDECOM/, 'SIDECOM'],
  [/^PLAISIR/, 'PLAISIR BACHUSS'],
  [/^DYNAMI|^DINAMY/, 'DYNAMIS'],
  [/^PRODISMA/, 'PRODISMA'],
  [/^SDTP/, 'SDTP'],
  [/^SDHPA/, 'SDHPA'],
  [/HIDJABE/, 'ETS HIDJABE'],
]
const distribCache = new Map()
function distributeurDe(brut) {
  const k = norm(brut).replace(/[^A-Z0-9& ]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!k) return null
  if (!distribCache.has(k)) {
    const alias = ALIAS_DISTRIB.find(([re]) => re.test(k))?.[1]
    const canon = alias || distributeurCanonique(brut, nomsDistributeur)
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
const ssfDe = (brut) => ssfParVariante.get(cleNom(brut)) || null

// ---------- 3. Rapprochement ----------

const idsPris = new Set(pdvs.map(p => p.pdv_id))
const nouvelId = () => { for (;;) { const id = randomUUID().slice(0, 8); if (!idsPris.has(id)) { idsPris.add(id); return id } } }
const aujourdhui = new Date().toISOString().slice(0, 10)

const creations = new Map() // clé fichier → ligne pdv à créer
const ecartees = []
const visites = []
const stats = { tel: 0, nom: 0, seul: 0, cree: 0, reutilise: 0, sansCompte: 0, deja: 0, sansGps: 0, ssfOk: 0, distribOk: 0 }

function clePdvFichier(l) {
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
  let pdvId, viaPdv
  if (creations.has(cle)) { pdvId = creations.get(cle).ligne.pdv_id; viaPdv = 'créé (même fichier)'; stats.reutilise++ }
  else {
    const trouve = trouverPdv(l)
    if (trouve) { pdvId = trouve.p.pdv_id; viaPdv = trouve.via }
    else {
      const loc = localiser(l)
      const type = typer(typeDepuisFichier(l.type, l.pdv))
      const ligne = {
        pdv_id: nouvelId(),
        nom_pdv: l.pdv || `PDV ${l.ligne}`,
        canal: type.canal, categorie_pdv: type.categorie_pdv, sous_categorie_pdv: type.sous_categorie_pdv,
        region: loc.region, zone: loc.zone, quartier: loc.quartier, territory_code: loc.territoryCode, area_code: loc.areaCode,
        geolocation_lat: l.lat, geolocation_lng: l.lng, rayon_geofence: 200,
        adressage: l.tel || l.loc || null,
        distributor_name: distributeurDe(l.distrib)?.nom || null,
        date_creation: l.date, ajoute_par: MARQUEUR, is_active: true,
        gps_source: aGps(l.lat, l.lng) ? 'atom' : 'atom-absent',
      }
      creations.set(cle, { ligne, l })
      pdvId = ligne.pdv_id
      viaPdv = 'créé'
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
    _via: viaPdv,
  })
}

// ---------- 4. Rapport ----------

const parCompte = new Map()
for (const v of visites) {
  const k = v.email
  if (!parCompte.has(k)) parCompte.set(k, { n: 0, pdv: new Set(), jours: new Set() })
  const x = parCompte.get(k); x.n++; x.pdv.add(v.pdv_id); x.jours.add(v.date_visite.slice(0, 10))
}
const inconnus = [...new Set(ecartees.map(e => e.merch))]
const rapport = `# Import des visites Atom (${FICHIER.split('/').pop()}) — ${APPLY ? 'APPLIQUÉ' : 'simulation'} du ${aujourdhui}

- Lignes lues : ${lignes.length} ; déjà importées : ${stats.deja} ; écartées (merchandiseur inconnu) : ${stats.sansCompte}
- Visites à créer : ${visites.length}, dont ${stats.sansGps} sans GPS
- PDV reconnus : ${stats.tel} par téléphone, ${stats.nom} par nom à ≤ ${RAYON_NOM_M} m, ${stats.seul} seul PDV à ≤ ${RAYON_SEUL_M} m
- PDV créés : ${creations.size} (réutilisés sur ${stats.reutilise} autres visites), marqueur \`${MARQUEUR}\`
- Distributeur rapproché : ${stats.distribOk}/${visites.length} ; SSF rapproché : ${stats.ssfOk}/${visites.length}

## Par compte

| Compte | Visites | PDV distincts | Jours |
|---|---|---|---|
${[...parCompte.entries()].sort((a, b) => b[1].n - a[1].n).map(([k, x]) => `| ${k} | ${x.n} | ${x.pdv.size} | ${x.jours.size} |`).join('\n')}

## Merchandiseurs inconnus (lignes écartées)

${inconnus.length ? inconnus.map(n => `- ${n} (${ecartees.filter(e => e.merch === n).length} lignes)`).join('\n') : '—'}

## Distributeurs non reconnus

${[...new Set(visites.filter(v => !v.distributeur_id && v.distributeur_brut).map(v => v.distributeur_brut))].slice(0, 30).map(d => `- ${d}`).join('\n') || '—'}

## SSF non reconnus (30 premiers)

${[...new Set(visites.filter(v => !v.ssf_id && v.ssf_brut).map(v => v.ssf_brut))].slice(0, 30).map(d => `- ${d}`).join('\n') || '—'}

## Retour arrière

\`\`\`sql
delete from public.visites where visite_id like '${PREFIXE_VISITE}-%';
delete from public.pdv where ajoute_par = '${MARQUEUR}';
\`\`\`
`
writeFileSync(OUT_MD, rapport)
ecrireCsv(OUT_CSV, ['pdv_id', 'nom_pdv', 'sous_categorie_pdv', 'zone', 'quartier', 'territory_code', 'lat', 'lng', 'adressage', 'distributor_name', 'type_fichier', 'zone_fichier'],
  [...creations.values()].map(({ ligne, l }) => [ligne.pdv_id, ligne.nom_pdv, ligne.sous_categorie_pdv, ligne.zone, ligne.quartier, ligne.territory_code, ligne.geolocation_lat, ligne.geolocation_lng, ligne.adressage, ligne.distributor_name, l.type, l.zone]))
ecrireCsv(OUT_ECARTES, ['ligne', 'date', 'merchandiseur', 'pdv', 'motif'], ecartees.map(e => [e.ligne, e.date, e.merch, e.pdv, e.motif]))
console.log(rapport)
console.log(`📝 ${OUT_MD}\n📝 ${OUT_CSV}\n📝 ${OUT_ECARTES}`)

// ---------- 5. Écriture ----------

if (!APPLY) { console.log('\nSimulation : rien n\'a été écrit. Relancer avec --apply.'); process.exit(0) }

const { error: colErr } = await supabase.from('visites').select('ssf_id').limit(1)
if (colErr) { console.error(`❌ ${colErr.message} — appliquer d'abord supabase/nouveau/20261006100000_friesland_employeur_atom_ssf.sql`); process.exit(1) }

const lots = (xs, n) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))

console.log(`🏪 Création de ${creations.size} PDV…`)
let crees = 0
for (const lot of lots([...creations.values()].map(x => x.ligne), 500)) {
  const { error } = await supabase.from('pdv').insert(lot)
  if (error) throw new Error(`PDV (${crees} créés, relance possible) : ${error.message}`)
  crees += lot.length
}
console.log(`   ✅ ${crees} PDV créés`)

console.log(`📋 Insertion de ${visites.length} visites par lots de 200 (calcul perfect store par trigger)…`)
let inserees = 0
for (const lot of lots(visites.map(({ _via, ...v }) => v), 200)) {
  const { error } = await supabase.from('visites').upsert(lot, { onConflict: 'visite_id', ignoreDuplicates: true })
  if (error) throw new Error(`visites (${inserees} insérées, relance possible) : ${error.message}`)
  inserees += lot.length
  if (inserees % 2000 === 0 || inserees === visites.length) console.log(`   ${inserees}/${visites.length}`)
}
console.log(`   ✅ ${inserees} visites importées`)

const { error: refreshErr } = await supabase.rpc('refresh_stats_dashboard')
console.log(refreshErr ? `⚠️  refresh_stats_dashboard : ${refreshErr.message}` : '📊 Statistiques rafraîchies.')
