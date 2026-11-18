#!/usr/bin/env node
/**
 * Proposition de routing mensuel pour GUEHI DANIEL (portbouetone@gmail.com,
 * Port-Bouët, Bassam, Bonoua), qui a repris le 18/11/2026 un compte sans
 * aucune ligne de routing. Demande de Jean Luc : le déduire des quotas Atom
 * et des boutiques de sa zone.
 *
 * LECTURE SEULE en base. Le script écrit deux fichiers dans docs/routings/ :
 *   - routing-guehi-daniel-2026-11.csv : 24 lignes au format de l'import
 *     « Routing mensuel » (scripts/importer-routing-mensuel.mjs) ;
 *   - routing-guehi-daniel-2026-11-recap.md : ce que contient chaque jour.
 *
 * Règles :
 *   1. Boutiques : liste Atom (pdv_atom), actives, distributeur SDTP (un
 *      merchandiser ne visite que les boutiques de son distributeur), avec
 *      GPS. Une boutique à plus de 3 km de toute autre boutique SDTP est
 *      écartée, comme les petits groupes isolés hors de la zone (Adjamé…).
 *   2. Quotas : routing_quota_canal (20 du lundi au jeudi, 15 le vendredi,
 *      10 le samedi), pushcarts déduits (objectif « à trouver », jamais
 *      nommés). Les boutiques connues ne suffisent pas tout à fait : chaque
 *      jour reçoit sa part, au prorata de son quota.
 *   3. Découpage : Bassam et Bonoua d'abord, chacune sur le jour de la
 *      4e semaine dont le quota est le plus proche de son nombre de
 *      boutiques (autant de jours qu'elles en remplissent). Port-Bouët
 *      ensuite : chaque jour prend la boutique libre la plus éloignée du
 *      centre et ses plus proches voisines, pour finir par le cœur de la
 *      zone et ne pas laisser de boutiques éparpillées.
 *   4. Point de visite du jour = la boutique la plus centrale du groupe
 *      (coordonnées exactes : le moteur rattache par égalité stricte). Son
 *      nom : le quartier s'il domine, sinon le lieu noté par Atom à la
 *      visite la plus proche, sinon le nom de la boutique.
 *   6. Boutiques sans GPS (décision de Jean Luc, 18/11) : son fichier
 *      docs/routings/boutiques-sdtp-gps-quartier-2026-11-18.csv leur donne
 *      une position ESTIMÉE (rue ou quartier). Elle sert seulement à choisir
 *      leur jour : la fiche reste sans GPS, la boutique est rattachée au
 *      point de visite de son jour (pdv_point_visite_force) et la première
 *      visite lui donnera sa vraie position. Les doublons probables signalés
 *      dans le fichier restent hors routing. Le point de visite d'un jour est
 *      toujours une boutique à GPS réel. Troisième sortie :
 *      routing-guehi-daniel-2026-11-rattachements.csv, lu par
 *      scripts/rattachement-sans-gps-guehi-2026-11-18.mjs.
 *   5. SSF = celui des visites SDTP les plus proches dans l'export Atom de
 *      juin à septembre (docs/routings/BonnetRouge_Routing_…xlsx). Étiquette
 *      seulement : le moteur ne s'en sert pas.
 *
 * Usage : node scripts/routing-guehi-daniel-2026-11-18.mjs
 */
import ExcelJS from 'exceljs'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { haversine } from './lib/commun.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RACINE = resolve(__dirname, '..')
config({ path: resolve(RACINE, '.env'), quiet: true })

const COMPTE = 'portbouetone@gmail.com'
const DISTRIBUTEUR = 'SDTP'
const SECTEUR = 'Port-Bouët - Bassam - Bonoua'
const EXPORT_ATOM = resolve(RACINE, 'docs/routings/BonnetRouge_Routing_2026-06-01_2026-09-30.xlsx')
const SORTIE_CSV = resolve(RACINE, 'docs/routings/routing-guehi-daniel-2026-11.csv')
const ESTIMATIONS = resolve(RACINE, 'docs/routings/boutiques-sdtp-gps-quartier-2026-11-18.csv')
const SORTIE_RATTACHEMENTS = resolve(RACINE, 'docs/routings/routing-guehi-daniel-2026-11-rattachements.csv')
const SORTIE_RECAP = resolve(RACINE, 'docs/routings/routing-guehi-daniel-2026-11-recap.md')
const ISOLEMENT_M = 3000 // même seuil que rattachement_distributeur_max_m
const GROUPE_MIN = 5 // un groupe isolé plus petit est hors zone
const SSF_RAYON_M = 1500
const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
// Communes d'après la longitude : la lagune puis la Comoé séparent les trois.
const communeDe = (lng) => (lng > -3.66 ? 'Bonoua' : lng > -3.80 ? 'Grand-Bassam' : 'Port-Bouët')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const must = ({ data, error }, quoi) => { if (error) throw new Error(`${quoi} : ${error.message}`); return data }
async function tout(requete, quoi) {
  const lignes = []
  for (let i = 0; ; i += 1000) {
    const page = must(await requete().range(i, i + 999), quoi)
    lignes.push(...page)
    if (page.length < 1000) return lignes
  }
}
const plusFrequent = (valeurs) => {
  const c = new Map()
  for (const v of valeurs) if (v) c.set(v, (c.get(v) || 0) + 1)
  const tri = [...c.entries()].sort((a, b) => b[1] - a[1])
  return tri.length ? { valeur: tri[0][0], n: tri[0][1] } : null
}

// ---- Lecture -----------------------------------------------------------------
const compte = must(await supabase.from('profiles').select('id,nom,is_active,commercial_id').eq('email', COMPTE).single(), 'compte')
if (!compte.is_active) throw new Error(`${COMPTE} est désactivé : l'import ne le reconnaîtra pas`)
const commercial = compte.commercial_id
  ? must(await supabase.from('profiles').select('nom').eq('id', compte.commercial_id).single(), 'commercial')
  : null
const dejaLa = must(await supabase.from('routing_mensuel').select('id').eq('merchandiser_id', compte.id).eq('actif', true), 'routing existant')
if (dejaLa.length) throw new Error(`${compte.nom} a déjà ${dejaLa.length} ligne(s) de routing : ce script part d'un compte sans routing`)

const quotas = must(await supabase.from('routing_quota_canal').select('canal,jour_semaine,quota'), 'quotas')
const quotaJour = (j) => quotas.filter(q => q.jour_semaine === j).reduce((s, q) => s + q.quota, 0)
const nommesJour = (j) => quotas.filter(q => q.jour_semaine === j && q.canal !== 'Pushcart').reduce((s, q) => s + q.quota, 0)

const atom = new Set((await tout(() => supabase.from('pdv_atom').select('pdv_id').order('pdv_id'), 'liste Atom')).map(x => x.pdv_id))
const sdtp = (await tout(() => supabase.from('pdv')
  .select('pdv_id,nom_pdv,sous_categorie_pdv,quartier,geolocation_lat,geolocation_lng,is_active')
  .eq('distributor_name', DISTRIBUTEUR).order('pdv_id'), 'boutiques'))
  .filter(p => p.is_active !== false && atom.has(p.pdv_id))
const avecGps = sdtp.filter(p => p.geolocation_lat && p.geolocation_lng)
  .map(p => ({ ...p, lat: Number(p.geolocation_lat), lng: Number(p.geolocation_lng) }))
const dist = (a, b) => haversine(a.lat, a.lng, b.lat, b.lng)

// Groupes reliés de proche en proche (3 km) : les petits groupes sont hors zone.
const groupeDe = new Map()
let nGroupes = 0
for (const p of avecGps) {
  if (groupeDe.has(p.pdv_id)) continue
  const file = [p]
  groupeDe.set(p.pdv_id, nGroupes)
  while (file.length) {
    const x = file.pop()
    for (const y of avecGps) {
      if (!groupeDe.has(y.pdv_id) && dist(x, y) <= ISOLEMENT_M) { groupeDe.set(y.pdv_id, nGroupes); file.push(y) }
    }
  }
  nGroupes++
}
const tailles = Array.from({ length: nGroupes }, (_, g) => avecGps.filter(p => groupeDe.get(p.pdv_id) === g).length)
// La zone : tout groupe d'au moins 5 boutiques au sud de la lagune (Port-Bouët
// est sous 5,30° de latitude ; Adjamé, Cocody et Yopougon au-dessus).
const dansZone = (p) => tailles[groupeDe.get(p.pdv_id)] >= GROUPE_MIN && p.lat < 5.30
const ecartees = avecGps.filter(p => !dansZone(p))

// Boutiques sans GPS : position estimée du fichier de Jean Luc (jamais écrite sur la fiche).
function lireCsv(texte, sep) {
  const lignes = []
  let ligne = [], cellule = '', guillemets = false
  for (let i = 0; i < texte.length; i++) {
    const ch = texte[i]
    if (guillemets) {
      if (ch === '"' && texte[i + 1] === '"') { cellule += '"'; i++ }
      else if (ch === '"') guillemets = false
      else cellule += ch
    }
    else if (ch === '"') guillemets = true
    else if (ch === sep) { ligne.push(cellule); cellule = '' }
    else if (ch === '\n') { ligne.push(cellule.replace(/\r$/, '')); lignes.push(ligne); ligne = []; cellule = '' }
    else cellule += ch
  }
  if (cellule || ligne.length) { ligne.push(cellule); lignes.push(ligne) }
  const entetes = lignes.shift()
  return lignes.filter(l => l.length > 1).map(l => Object.fromEntries(entetes.map((h, i) => [h.trim(), (l[i] ?? '').trim()])))
}
const sansGps = new Map(sdtp.filter(p => !(p.geolocation_lat && p.geolocation_lng)).map(p => [p.pdv_id, p]))
const estimees = [], doublons = [], inconnues = []
if (existsSync(ESTIMATIONS)) {
  for (const l of lireCsv(readFileSync(ESTIMATIONS, 'utf8').replace(/^\ufeff/, ''), ',')) {
    const p = sansGps.get(l['Code PDV'])
    const lat = Number(l.Latitude), lng = Number(l.Longitude)
    if (!p || !lat || !lng) { inconnues.push(l['Code PDV']); continue }
    if (/doublon probable/i.test(l.Remarque || '')) { doublons.push({ ...p, remarque: l.Remarque }); continue }
    estimees.push({ ...p, lat, lng, estimee: true, quartierEstime: l['Quartier GPS'], precision: l['Précision GPS'] })
  }
}
const boutiques = [...avecGps.filter(dansZone), ...estimees]

// ---- SSF d'après les visites SDTP de l'export Atom -----------------------------
const NOMS_SSF = [
  [/didier/i, 'Yapo Dian Didier'], [/salomon/i, 'Gbeyetin Salomon'], [/dibie/i, 'Dibie Anicet'],
  [/jacob/i, 'Jacob'], [/dameogo/i, 'Dameogo Madou'],
]
const visites = []
if (existsSync(EXPORT_ATOM)) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(EXPORT_ATOM)
  const texte = c => (c == null ? '' : String(c?.result ?? c?.text ?? c).trim())
  wb.getWorksheet('Routing détaillé').eachRow((r, i) => {
    if (i === 1 || !/sdtp/i.test(texte(r.values[9]))) return
    const gps = texte(r.values[19]).match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/)
    const ssf = NOMS_SSF.find(([re]) => re.test(texte(r.values[10])))?.[1]
    if (gps) visites.push({ lat: Number(gps[1]), lng: Number(gps[2]), ssf, lieu: texte(r.values[8]) })
  })
}
else console.warn(`Export Atom introuvable (${EXPORT_ATOM}) : aucune ligne n'aura de SSF.`)
const ssfConnus = new Set(must(await supabase.from('ssf').select('nom').eq('actif', true), 'SSF').map(s => s.nom))
function ssfDuPoint(point) {
  const proches = visites.filter(v => v.ssf).map(v => ({ d: dist(point, v), ssf: v.ssf })).filter(v => v.d <= SSF_RAYON_M).sort((a, b) => a.d - b.d).slice(0, 15)
  const s = plusFrequent(proches.map(v => v.ssf))?.valeur
  return s && ssfConnus.has(s) ? s : null
}

/** Lieu noté par Atom à la visite la plus proche (300 m au plus). */
function lieuDuPoint(point) {
  const v = visites.filter(x => x.lieu).map(x => ({ d: dist(point, x), lieu: x.lieu })).sort((a, b) => a.d - b.d)[0]
  return v && v.d <= 300 ? v.lieu : ''
}

// ---- Découpage en 24 jours ---------------------------------------------------
const cases = []
for (let semaine = 1; semaine <= 4; semaine++) for (let j = 1; j <= 6; j++) cases.push({ semaine, jour: j, quota: quotaJour(j), nommes: nommesJour(j) })
const besoin = cases.reduce((s, c) => s + c.nommes, 0)

function remplir(c, groupe) {
  c.groupe = groupe
  if (!groupe.length) return
  // Boutique la plus centrale : somme des distances aux autres la plus faible.
  // Parmi les boutiques à GPS réel ; à défaut, la boutique réelle la plus proche du groupe.
  const reelles = groupe.filter(p => !p.estimee)
  const candidates = reelles.length ? reelles : [avecGps.filter(dansZone).sort((a, b) => dist(groupe[0], a) - dist(groupe[0], b))[0]]
  c.point = candidates.map(p => ({ p, s: groupe.reduce((t, q) => t + dist(p, q), 0) })).sort((a, b) => a.s - b.s)[0].p
  c.rayon = Math.round(Math.max(...groupe.map(p => dist(c.point, p))))
  c.commune = communeDe(c.point.lng)
  c.ssf = ssfDuPoint(c.point)
  const q = plusFrequent(groupe.map(p => (p.quartier || p.quartierEstime || '').trim()))
  c.quartier = q && q.n >= groupe.length / 3 ? q.valeur : ''
}

// Bassam et Bonoua : jours de la 4e semaine, quota le plus proche du nombre de boutiques.
const libres = new Set(boutiques)
for (const commune of ['Bonoua', 'Grand-Bassam']) {
  let reste = boutiques.filter(p => communeDe(p.lng) === commune)
  while (reste.length >= GROUPE_MIN) {
    const dispo = cases.filter(c => !c.groupe).sort((a, b) => b.semaine - a.semaine || Math.abs(a.nommes - reste.length) - Math.abs(b.nommes - reste.length))
    const c = dispo.filter(x => x.semaine === dispo[0].semaine)[0]
    const depart = [...reste].sort((a, b) => b.lng - a.lng)[0]
  if (!depart) break
    const groupe = [...reste].sort((a, b) => dist(depart, a) - dist(depart, b)).slice(0, c.nommes)
    remplir(c, groupe)
    for (const p of groupe) libres.delete(p)
    reste = reste.filter(p => !groupe.includes(p))
  }
}

// Port-Bouët : le reste, au prorata du quota de chaque jour encore vide.
const vides = cases.filter(c => !c.groupe)
const besoinVides = vides.reduce((s, c) => s + c.nommes, 0)
const part = Math.min(1, libres.size / besoinVides)
for (const c of vides) c.taille = Math.floor(c.nommes * part)
let surplus = Math.min(libres.size, besoinVides) - vides.reduce((s, c) => s + c.taille, 0)
for (const c of [...vides].sort((a, b) => (b.nommes * part - b.taille) - (a.nommes * part - a.taille))) {
  if (surplus <= 0) break
  c.taille++
  surplus--
}
for (const c of vides) {
  const l = [...libres]
  if (!l.length) { c.groupe = []; continue }
  const centre = { lat: l.reduce((s, p) => s + p.lat, 0) / l.length, lng: l.reduce((s, p) => s + p.lng, 0) / l.length }
  const depart = l.sort((a, b) => dist(centre, b) - dist(centre, a))[0]
  const groupe = [...libres].sort((a, b) => dist(depart, a) - dist(depart, b)).slice(0, c.taille)
  remplir(c, groupe)
  for (const p of groupe) libres.delete(p)
}
// Nom du point : le quartier s'il domine, sinon l'adresse de la boutique centrale.
const vus = new Map()
const propre = (s) => String(s || '').replace(/[;\n\r]+/g, ' ').replace(/\s+/g, ' ').trim()
for (const c of cases) {
  if (!c.point) continue
  const base = propre(c.quartier || lieuDuPoint(c.point) || `Boutique ${c.point.nom_pdv}`).slice(0, 48) || c.commune
  const n = (vus.get(base.toUpperCase()) || 0) + 1
  vus.set(base.toUpperCase(), n)
  c.nom = n === 1 ? base : `${base} (${n})`
}

// ---- Sorties -----------------------------------------------------------------
const pleines = cases.filter(c => c.point)
const csv = [
  'Zone;Commune;Quartier;Merchandiser;Distributeur;Sales rep;Jour;Occurrence;Point de visite;SSF;Type SSF;Latitude;Longitude;Rayon',
  ...pleines.map(c => [
    SECTEUR, c.commune, propre(c.quartier), compte.nom, DISTRIBUTEUR, commercial?.nom || '', JOURS[c.jour - 1], c.semaine,
    c.nom, c.ssf || 'Aucun SSF', '', c.point.lat, c.point.lng, Math.min(3000, Math.max(100, c.rayon)),
  ].join(';')),
].join('\n') + '\n'
writeFileSync(SORTIE_CSV, csv)

writeFileSync(SORTIE_RATTACHEMENTS, ['Code PDV;Point de visite;Quartier estimé;Précision;Jour;Semaine',
  ...pleines.flatMap(c => c.groupe.filter(p => p.estimee).map(p => [p.pdv_id, c.nom, propre(p.quartierEstime), propre(p.precision), JOURS[c.jour - 1], c.semaine].join(';'))),
  // Sans jour ce mois-ci (quota atteint) : rattachées au point le plus proche, en réserve.
  ...[...libres].filter(p => p.estimee).map((p) => {
    const c = [...pleines].sort((x, y) => dist(p, x.point) - dist(p, y.point))[0]
    return [p.pdv_id, c.nom, propre(p.quartierEstime), propre(p.precision), 'réserve', ''].join(';')
  })].join('\n') + '\n')

const type = (p) => (/super/i.test(p.sous_categorie_pdv || '') ? 'superette' : /kiosk|aboki/i.test(p.sous_categorie_pdv || '') ? 'kiosque' : /push/i.test(p.sous_categorie_pdv || '') ? 'pushcart' : 'boutique')
const compter = (groupe) => {
  const c = { boutique: 0, superette: 0, kiosque: 0, pushcart: 0 }
  for (const p of groupe) c[type(p)]++
  return c
}
const parCommune = {}
for (const c of pleines) (parCommune[c.commune] ??= { jours: 0, boutiques: 0 }), parCommune[c.commune].jours++, parCommune[c.commune].boutiques += c.groupe.length
const recap = [
  `# Routing proposé pour ${compte.nom} (${DISTRIBUTEUR})`,
  '',
  `Calculé le ${new Date().toISOString().slice(0, 10)} par \`scripts/routing-guehi-daniel-2026-11-18.mjs\`. Rien n'est chargé dans l'application.`,
  '',
  '## Chiffres',
  '',
  `- Boutiques Atom actives chez ${DISTRIBUTEUR} : ${sdtp.length}, dont ${avecGps.length} avec GPS.`,
  `- Dans la zone (Port-Bouët, Bassam, Bonoua) : ${boutiques.length}, dont ${estimees.length} sans GPS placées par leur quartier estimé (fiche laissée sans GPS). Écartées car hors zone ou isolées : ${ecartees.length}. Doublons probables laissés hors routing : ${doublons.length}. Sans GPS et sans estimation : ${sansGps.size - estimees.length - doublons.length}.`,
  `- Quota du mois : ${cases.reduce((s, c) => s + c.quota, 0)} visites, dont ${cases.reduce((s, c) => s + c.quota - c.nommes, 0)} pushcarts à trouver ; ${besoin} boutiques à nommer.`,
  `- Boutiques placées : ${pleines.reduce((s, c) => s + c.groupe.length, 0)} sur ${besoin}. Manque sur le mois : ${besoin - pleines.reduce((s, c) => s + c.groupe.length, 0)}.`,
  '',
  '## Jours par commune',
  '',
  '| Commune | Jours par mois | Boutiques |',
  '|---|---|---|',
  ...Object.entries(parCommune).map(([k, v]) => `| ${k} | ${v.jours} | ${v.boutiques} |`),
  '',
  '## Les 24 jours',
  '',
  '| Semaine | Jour | Point de visite | Commune | SSF | Boutiques | dont sans GPS | dont superettes | dont kiosques | Quota du jour | Pushcarts à trouver | Manque | Plus loin du point |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ...cases.map((c) => {
    if (!c.point) return `| ${c.semaine} | ${JOURS[c.jour - 1]} | — (aucune boutique) | | | 0 | 0 | 0 | 0 | ${c.quota} | ${c.quota - c.nommes} | ${c.nommes} | |`
    const t = compter(c.groupe)
    return `| ${c.semaine} | ${JOURS[c.jour - 1]} | ${c.nom} | ${c.commune} | ${c.ssf || 'Aucun'} | ${c.groupe.length} | ${c.groupe.filter(p => p.estimee).length} | ${t.superette} | ${t.kiosque} | ${c.quota} | ${c.quota - c.nommes} | ${c.nommes - c.groupe.length} | ${(c.rayon / 1000).toFixed(1)} km |`
  }),
  '',
  '## Doublons probables (hors routing, rien n\'est fusionné)',
  '',
  ...(doublons.length ? doublons.map(p => `- ${propre(p.nom_pdv)} (${p.pdv_id}) : ${propre(p.remarque)}`) : ['Aucun.']),
  '',
  '## Boutiques écartées',
  '',
  ...(ecartees.length ? ecartees.map(p => `- ${propre(p.nom_pdv)} (${p.pdv_id}) : ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`) : ['Aucune.']),
  '',
].join('\n')
writeFileSync(SORTIE_RECAP, recap)

console.log(`${compte.nom} : ${boutiques.length} boutiques dans la zone, dont ${estimees.length} sans GPS placées par quartier estimé (${ecartees.length} écartées, ${doublons.length} doublons, ${inconnues.length} lignes du fichier ignorées), ${besoin} à nommer par mois, ${libres.size} non placées.`)
for (const [k, v] of Object.entries(parCommune)) console.log(`  ${k.padEnd(13)} ${String(v.jours).padStart(2)} jour(s), ${v.boutiques} boutiques`)
for (const c of cases) console.log(`  S${c.semaine} ${JOURS[c.jour - 1].padEnd(8)} ${String(c.groupe.length).padStart(2)}/${c.nommes} (${String(c.groupe.filter(p => p.estimee).length).padStart(2)} sans GPS)  ${(c.commune || '').padEnd(12)} ${(c.ssf || 'Aucun SSF').padEnd(17)} ${c.point ? `${(c.rayon / 1000).toFixed(1)} km  ${c.nom}` : '—'}`)
console.log(`\nÉcrit : ${SORTIE_CSV}\n        ${SORTIE_RATTACHEMENTS}\n        ${SORTIE_RECAP}`)
