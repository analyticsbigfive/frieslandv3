#!/usr/bin/env node
/**
 * Croise l'export clients DMS annoté par le client (colonnes « Zone » et
 * « Merchandiseur » ajoutées à la main) avec nos comptes et nos PDV.
 *
 * Le croisement se fait par le territoire : chaque merchandiser du fichier est
 * rattaché à son compte, et ses tournées couvrent tous les PDV actifs de son
 * périmètre (même règle que l'import des tournées). Le rapprochement client
 * DMS ↔ PDV (GPS + nom) ne sert qu'au rapport : les deux référentiels n'ont
 * aucun code commun.
 *
 * Sorties dans ~/Downloads (aucune écriture en base) :
 *   - tournees-dms-<debut>.csv      tournées au format du modèle, réimportable (Routing → Importer)
 *   - croisement-dms-pdv.csv        une ligne par client DMS affecté, avec le PDV rapproché
 *   - clients-dms-a-renvoyer.csv    clients sans PDV reconnu ou sans GPS, à faire vérifier
 *   - croisement-dms-rapport.md     synthèse par merchandiser + anomalies
 *
 * Usage :
 *   node scripts/croiser-dms-tournees.mjs [--dms=chemin.xlsx] [--debut=2026-10-05] [--par-jour=20]
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import ExcelJS from 'exceljs'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env'), quiet: true })

const arg = (nom, defaut) => process.argv.find(a => a.startsWith(`--${nom}=`))?.split('=').slice(1).join('=') || defaut

const DOWNLOADS = join(process.env.HOME, 'Downloads')
const DMS_PATH = arg('dms', join(DOWNLOADS, '20260929_115747.xlsx'))
const DATE_DEBUT = arg('debut', '2026-10-05')
const PDV_PAR_JOUR = Number(arg('par-jour', 20))
const JOURS_OUVRES = [1, 2, 3, 4, 5, 6] // lundi → samedi (getUTCDay)
const JOURS_EXCLUS = [] // jours fériés éventuels, 'AAAA-MM-JJ'

// Nom du fichier → compte, quand le nom seul ne suffit pas (deux comptes « Deheo Wilfried »).
const COMPTE_FORCE = {
  'DEHEO WILFRIED': 'yopougonmerchtwo@gmail.com',
}

// Rapprochement client DMS ↔ PDV
const RAYON_NOM_M = 50 // PDV avec un mot du nom en commun
const RAYON_SEUL_M = 25 // PDV unique, sans mot commun
const BBOX_ABIDJAN = { latMin: 5.1, latMax: 5.65, lngMin: -4.5, lngMax: -3.7 }
const MOTS_VIDES = new Set([
  'BOUTIQUE', 'BOUTIK', 'BTQ', 'CHEZ', 'ETS', 'ETABLISSEMENT', 'SUPERETTE', 'SUPER', 'KIOSQUE',
  'ALIMENTATION', 'MAGASIN', 'CAFE', 'TABLE', 'SUPERMARCHE', 'MARCHE', 'DEMI', 'GROS', 'GROSSISTE',
  'DES', 'LES', 'MME', 'MLE', 'RETAILLER',
])

const OUT_TOURNEES = join(DOWNLOADS, `tournees-dms-${DATE_DEBUT}.csv`)
const OUT_CROISEMENT = join(DOWNLOADS, 'croisement-dms-pdv.csv')
const OUT_RENVOI = join(DOWNLOADS, 'clients-dms-a-renvoyer.csv')
const OUT_MD = join(DOWNLOADS, 'croisement-dms-rapport.md')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ---------- Helpers ----------

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()

// Nom de personne comparable quel que soit l'ordre prénom/nom.
const cleNom = (s) => norm(s).replace(/[^A-Z0-9 ]/g, ' ').split(' ').filter(Boolean).sort().join(' ')

const motsNom = (s) =>
  new Set(norm(s).replace(/[^A-Z0-9 ]/g, ' ').split(' ').filter(w => w.length >= 3 && !/^\d+$/.test(w) && !MOTS_VIDES.has(w)))

// utils/trajets.ts — haversine (mètres)
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLng = (lng2 - lng1) * (Math.PI / 180)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const aGps = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0

// composables/useRoutingExcel.ts — libellés du modèle
const SANS_TERRITOIRE = '(SANS TERRITOIRE)'
const SANS_QUARTIER = '(SANS QUARTIER)'
const SEP_MERCH = ' — '
const SEP_PDV = ' · '
function libelle(v, vide) {
  const s = String(v ?? '').replace(/[*?~]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase()
  return s || vide
}
const cle = (v) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// composables/useUserScope.ts — pdvInScope sans alias, comme l'appelle l'import (stores/routing.ts)
function profileTerritories(p) {
  const multi = (p?.territoires_assignes || []).filter(Boolean)
  if (multi.length) return multi
  return p?.zone_assignee ? [p.zone_assignee] : []
}
function pdvInScope(pdv, p) {
  const terrs = profileTerritories(p)
  if (terrs.length && !terrs.includes(pdv.zone || '')) return false
  const quartiers = (p?.quartiers_assignes || []).filter(Boolean)
  if (quartiers.length && pdv.quartier && !quartiers.includes(pdv.quartier)) return false
  return true
}

const pad = (n) => String(n).padStart(2, '0')
const jourFr = (iso) => iso.split('-').reverse().join('/')

function joursOuvres(debutIso, n) {
  const out = []
  const d = new Date(`${debutIso}T00:00:00Z`)
  while (out.length < n) {
    const iso = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
    if (JOURS_OUVRES.includes(d.getUTCDay()) && !JOURS_EXCLUS.includes(iso)) out.push(iso)
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

// CSV lu par useCsvExport.parseCsv : virgule, guillemets doublés, une ligne par enregistrement.
const champCsv = (v) => `"${String(v ?? '').replace(/[\r\n]+/g, ' ').replace(/"/g, '""')}"`
const ecrireCsv = (chemin, entete, lignes) =>
  writeFileSync(chemin, '﻿' + [entete, ...lignes].map(l => l.map(champCsv).join(',')).join('\n') + '\n', 'utf8')

async function toutesLesLignes(requete) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await requete().range(from, from + 999)
    if (error) throw error
    out.push(...data)
    if (data.length < 1000) return out
  }
}

const texteCellule = (v) => {
  if (v == null) return ''
  if (typeof v === 'object') {
    if ('result' in v) return texteCellule(v.result)
    if (Array.isArray(v.richText)) return v.richText.map(r => r.text).join('')
    if ('text' in v) return v.text
  }
  return v
}

// ---------- 1. Export DMS ----------

const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile(DMS_PATH)
const ws = wb.worksheets[0]
const entetes = []
ws.getRow(1).eachCell({ includeEmpty: true }, (c, col) => { entetes[col] = String(texteCellule(c.value) || '').trim() })
const col = (nom) => {
  const i = entetes.findIndex(h => h && h.toLowerCase().startsWith(nom.toLowerCase()))
  if (i < 0) throw new Error(`Colonne « ${nom} » introuvable dans ${DMS_PATH}`)
  return i
}
const C = {
  distributeur: col('distributor_name'), vendeurCode: col('salesman_code'), vendeur: col('salesman_name'),
  code: col('customer_code'), nom: col('customer_name'), rue: col('address1'), quartier: col('address2'),
  district: col('address3'), lat: col('latitude'), lng: col('longitude'), sousCanal: col('local_sub_channel_name'),
  zone: col('Zone'), merch: col('Merchandiseur'),
}

let lignesDms = 0
const clients = []
const vus = new Set()
ws.eachRow((row, n) => {
  if (n === 1) return
  lignesDms++
  const v = (k) => String(texteCellule(row.getCell(C[k]).value) ?? '').trim()
  if (!v('merch')) return
  if (vus.has(v('code'))) return
  vus.add(v('code'))
  clients.push({
    code: v('code'), nom: v('nom'), distributeur: v('distributeur'), vendeur: `${v('vendeurCode')} ${v('vendeur')}`.trim(),
    rue: v('rue'), quartier: v('quartier'), district: v('district'), sousCanal: v('sousCanal'),
    lat: Number(v('lat')), lng: Number(v('lng')), zone: v('zone'), merch: v('merch'),
  })
})
const lignesAffectees = (() => { let k = 0; ws.eachRow((r, n) => { if (n > 1 && String(texteCellule(r.getCell(C.merch).value) ?? '').trim()) k++ }); return k })()

// ---------- 2. Comptes ----------

const profils = await toutesLesLignes(() => supabase.from('profiles')
  .select('id,email,nom,role,is_active,zone_assignee,territoires_assignes,quartiers_assignes')
  .in('role', ['merchandiser', 'commercial']).order('id'))
const merchsActifs = profils.filter(p => p.role === 'merchandiser' && p.is_active !== false && p.email)

const nomsFichier = [...new Set(clients.map(c => c.merch))].sort((a, b) => a.localeCompare(b, 'fr'))
const merchs = nomsFichier.map((nomFichier) => {
  const forcé = COMPTE_FORCE[norm(nomFichier)]
  const candidats = forcé
    ? merchsActifs.filter(p => p.email.toLowerCase() === forcé)
    : merchsActifs.filter(p => cleNom(p.nom) === cleNom(nomFichier))
  const zones = [...new Set(clients.filter(c => c.merch === nomFichier).map(c => c.zone))]
  return {
    nomFichier, zones,
    distributeurs: [...new Set(clients.filter(c => c.merch === nomFichier).map(c => c.distributeur))],
    profil: candidats.length === 1 ? candidats[0] : null,
    candidats,
  }
})
for (const m of merchs) m.label = m.profil ? `${String(m.profil.nom || '').trim() || m.profil.email}${SEP_MERCH}${m.profil.email.toLowerCase()}` : ''

// ---------- 3. Périmètres ----------

for (const m of merchs.filter(m => m.profil)) {
  const terrs = profileTerritories(m.profil)
  m.pdvTerritoire = terrs.length
    ? await toutesLesLignes(() => supabase.from('pdv')
      .select('pdv_id,nom_pdv,zone,quartier,geolocation_lat,geolocation_lng')
      .eq('is_active', true).in('zone', terrs).order('pdv_id'))
    : []
  m.pdvPerimetre = m.pdvTerritoire.filter(p => pdvInScope(p, m.profil))
  m.idsPerimetre = new Set(m.pdvPerimetre.map(p => p.pdv_id))
}

// ---------- 4. Ordre GPS et journées ----------

const mediane = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }

// PDV géolocalisés à plus de GPS_DOUTEUX_M du centre du périmètre : coordonnées
// fausses (un PDV d'Adjamé à 100 km), qui casseraient la journée où ils tombent.
const GPS_DOUTEUX_M = 15000
function gpsFiable(pdvs) {
  const avec = pdvs.filter(p => aGps(p.geolocation_lat, p.geolocation_lng))
  if (!avec.length) return () => false
  const lat = mediane(avec.map(p => p.geolocation_lat))
  const lng = mediane(avec.map(p => p.geolocation_lng))
  return p => aGps(p.geolocation_lat, p.geolocation_lng) && haversine(lat, lng, p.geolocation_lat, p.geolocation_lng) <= GPS_DOUTEUX_M
}

// Chaîne du plus proche voisin depuis le PDV le plus à l'ouest ; les PDV sans GPS
// fiable ferment la marche, groupés par quartier.
function ordreGps(pdvs) {
  const fiable = gpsFiable(pdvs)
  const avec = pdvs.filter(fiable)
  const sans = pdvs.filter(p => !fiable(p))
    .sort((a, b) => String(a.quartier || '').localeCompare(String(b.quartier || ''), 'fr') || a.pdv_id.localeCompare(b.pdv_id))
  const restants = [...avec]
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

const lignesTournees = []
for (const m of merchs.filter(m => m.profil)) {
  const ordre = ordreGps(m.pdvPerimetre)
  const jours = joursOuvres(DATE_DEBUT, Math.ceil(ordre.length / PDV_PAR_JOUR))
  m.jours = jours
  m.sansGps = m.pdvPerimetre.filter(p => !aGps(p.geolocation_lat, p.geolocation_lng))
  const fiable = gpsFiable(m.pdvPerimetre)
  m.gpsDouteux = m.pdvPerimetre.filter(p => aGps(p.geolocation_lat, p.geolocation_lng) && !fiable(p))
  ordre.forEach((p, k) => {
    const nom = String(p.nom_pdv || '').replace(/\s+/g, ' ').trim() || 'SANS NOM'
    lignesTournees.push([
      m.label, jourFr(jours[Math.floor(k / PDV_PAR_JOUR)]),
      libelle(p.zone, SANS_TERRITOIRE), libelle(p.quartier, SANS_QUARTIER),
      `${nom}${SEP_PDV}${p.pdv_id}`, (k % PDV_PAR_JOUR) + 1,
      '', '', '', '', '', '',
    ])
  })
}

// ---------- 5. Tournées déjà en base sur la période ----------

for (const m of merchs.filter(m => m.profil && m.jours.length)) {
  const { data, error } = await supabase.from('routings')
    .select('date_routing').eq('user_id', m.profil.id)
    .gte('date_routing', m.jours[0]).lte('date_routing', m.jours.at(-1))
  if (error) throw error
  m.tourneesExistantes = (data || []).map(r => r.date_routing).sort()
}

// ---------- 6. Rapprochement client DMS ↔ PDV ----------

const pdvAbidjan = (await toutesLesLignes(() => supabase.from('pdv')
  .select('pdv_id,nom_pdv,zone,quartier,geolocation_lat,geolocation_lng')
  .eq('is_active', true)
  .gte('geolocation_lat', BBOX_ABIDJAN.latMin).lte('geolocation_lat', BBOX_ABIDJAN.latMax)
  .gte('geolocation_lng', BBOX_ABIDJAN.lngMin).lte('geolocation_lng', BBOX_ABIDJAN.lngMax)
  .order('pdv_id'))).map(p => ({ ...p, mots: motsNom(p.nom_pdv) }))

const DEG = RAYON_NOM_M / 111000 * 1.5
const merchParNom = new Map(merchs.map(m => [m.nomFichier, m]))
for (const c of clients) {
  const m = merchParNom.get(c.merch)
  c.compte = m.profil?.email || ''
  if (!aGps(c.lat, c.lng)) { c.statut = 'Sans GPS'; c.motif = 'coordonnées absentes ou à 0 dans le DMS'; continue }
  const proches = pdvAbidjan
    .filter(p => Math.abs(p.geolocation_lat - c.lat) < DEG && Math.abs(p.geolocation_lng - c.lng) < DEG)
    .map(p => ({ p, d: haversine(c.lat, c.lng, p.geolocation_lat, p.geolocation_lng) }))
    .filter(x => x.d <= RAYON_NOM_M)
    .sort((a, b) => a.d - b.d)
  const mots = motsNom(c.nom)
  const parNom = proches.find(x => [...x.p.mots].some(w => mots.has(w)))
  const seuls = proches.filter(x => x.d <= RAYON_SEUL_M)
  const choix = parNom || (seuls.length === 1 ? seuls[0] : null)
  if (!choix) {
    c.statut = 'Non trouvé'
    c.motif = seuls.length > 1
      ? `${seuls.length} PDV à moins de ${RAYON_SEUL_M} m, aucun nom commun`
      : proches.length ? `PDV le plus proche à ${Math.round(proches[0].d)} m, nom différent` : `aucun PDV à moins de ${RAYON_NOM_M} m`
    continue
  }
  Object.assign(c, { pdv: choix.p, distance: Math.round(choix.d) })
  const base = parNom ? 'Reconnu' : 'Probable'
  if (m.profil && !m.idsPerimetre.has(choix.p.pdv_id)) {
    c.statut = 'Hors périmètre'
    c.motif = `${base.toLowerCase()} : PDV en ${choix.p.zone || '?'} / ${choix.p.quartier || '?'}, hors périmètre du compte`
  } else {
    c.statut = base
    c.motif = parNom ? 'nom commun à moins de 50 m' : `seul PDV à moins de ${RAYON_SEUL_M} m`
  }
}

// ---------- Sorties CSV ----------

const ENTETE_TOURNEES = ['Merchandiser', 'Date', 'Territoire', 'Quartier', 'Point de vente', 'Ordre',
  'Relevé de stock', 'Encaissement', 'Photos', 'Merchandising', 'Prospection', 'Notes']
ecrireCsv(OUT_TOURNEES, ENTETE_TOURNEES, lignesTournees)

const ligneClient = (c) => [
  c.code, c.nom, c.distributeur, c.vendeur, c.sousCanal, c.rue, c.quartier, c.district,
  aGps(c.lat, c.lng) ? c.lat : '', aGps(c.lat, c.lng) ? c.lng : '', c.zone, c.merch, c.compte || 'AUCUN COMPTE',
  c.statut, c.motif, c.pdv?.pdv_id || '', c.pdv?.nom_pdv || '', c.distance ?? '', c.pdv?.zone || '', c.pdv?.quartier || '',
]
ecrireCsv(OUT_CROISEMENT, [
  'Code client', 'Nom client', 'Distributeur', 'Vendeur', 'Sous-canal', 'Adresse', 'Quartier DMS', 'District DMS',
  'Latitude', 'Longitude', 'Zone (fichier)', 'Merchandiser (fichier)', 'Compte', 'Statut', 'Motif',
  'pdv_id', 'Nom PDV', 'Distance (m)', 'Territoire PDV', 'Quartier PDV',
], clients.map(ligneClient))

const aRenvoyer = clients.filter(c => c.statut === 'Non trouvé' || c.statut === 'Sans GPS')
ecrireCsv(OUT_RENVOI, [
  'Code client', 'Nom client', 'Distributeur', 'Vendeur', 'Sous-canal', 'Adresse', 'Quartier DMS', 'District DMS',
  'Latitude', 'Longitude', 'Zone (fichier)', 'Merchandiser (fichier)', 'Motif',
], aRenvoyer.map(c => [c.code, c.nom, c.distributeur, c.vendeur, c.sousCanal, c.rue, c.quartier, c.district,
  aGps(c.lat, c.lng) ? c.lat : '', aGps(c.lat, c.lng) ? c.lng : '', c.zone, c.merch, `${c.statut} — ${c.motif}`]))

// ---------- Anomalies ----------

const anomalies = []
for (const m of merchs) {
  const nb = clients.filter(c => c.merch === m.nomFichier).length
  if (!m.profil) {
    anomalies.push(m.candidats.length
      ? `**${m.nomFichier}** : ${m.candidats.length} comptes possibles (${m.candidats.map(p => p.email).join(', ')}) — non planifié, à trancher dans COMPTE_FORCE (${nb} clients DMS).`
      : `**${m.nomFichier}** : aucun compte merchandiser actif à ce nom — non planifié (${nb} clients DMS, ${m.distributeurs.join(', ')}).`)
    continue
  }
  const terrs = profileTerritories(m.profil)
  const terrsNorm = terrs.map(t => cleNom(t))
  for (const z of m.zones) {
    const parties = z.split('/').map(cleNom)
    if (!parties.every(p => terrsNorm.includes(p))) {
      anomalies.push(`**${m.nomFichier}** : zone « ${z} » dans le fichier, mais le compte ${m.profil.email} est sur ${terrs.join(', ')} — le territoire du compte a été retenu.`)
    }
  }
  const exclus = m.pdvTerritoire.filter(p => !m.idsPerimetre.has(p.pdv_id))
  if (exclus.length) {
    const parQuartier = {}
    exclus.forEach(p => { parQuartier[p.quartier] = (parQuartier[p.quartier] || 0) + 1 })
    const detail = Object.entries(parQuartier).sort((a, b) => b[1] - a[1]).map(([q, n]) => `${q} (${n})`).join(', ')
    anomalies.push(`**${m.nomFichier}** : ${exclus.length} PDV de ${terrs.join(', ')} exclus par la liste de quartiers du compte — ${detail}.`)
  }
  if (m.pdvTerritoire.length && m.pdvPerimetre.length < m.pdvTerritoire.length / 4) {
    const quartiers = (m.profil.quartiers_assignes || []).filter(Boolean)
    const pdvQ = await toutesLesLignes(() => supabase.from('pdv').select('pdv_id,zone').eq('is_active', true).in('quartier', quartiers).order('pdv_id'))
    const parZone = {}
    pdvQ.forEach(p => { if (p.zone) parZone[p.zone] = (parZone[p.zone] || 0) + 1 })
    // Territoires qui portent l'essentiel de ces quartiers (≥ 10 %), pas les homonymes isolés.
    const zonesQ = Object.entries(parZone).filter(([, n]) => n >= pdvQ.length / 10).sort((a, b) => b[1] - a[1])
    const autres = merchsActifs.filter(p => p.id !== m.profil.id && profileTerritories(p).some(t => zonesQ.some(([z]) => z === t)))
    anomalies.push(`**${m.nomFichier}** : seulement ${m.pdvPerimetre.length} PDV planifiables sur ${m.pdvTerritoire.length} — ses quartiers assignés sont ceux de `
      + `${zonesQ.map(([z, n]) => `${z} (${n} PDV)`).join(', ') || '?'}, pas de ${terrs.join(', ')}. Territoire ou liste de quartiers à corriger dans son profil`
      + `${autres.length ? ` ; compte(s) déjà sur ces territoires : ${autres.map(p => `${p.email} (${profileTerritories(p).join(', ')})`).join(', ')}` : ''}.`)
  }
  if (m.sansGps.length || m.gpsDouteux.length) {
    const liste = m.gpsDouteux.map(p => `${p.nom_pdv} · ${p.pdv_id}`).join(', ')
    anomalies.push(`**${m.nomFichier}** : ${m.sansGps.length} PDV sans GPS et ${m.gpsDouteux.length} à plus de ${GPS_DOUTEUX_M / 1000} km du centre du périmètre`
      + `${liste ? ` (${liste})` : ''} — placés en fin de cycle, par quartier.`)
  }
  if (m.tourneesExistantes?.length) {
    anomalies.push(`**${m.nomFichier}** : ${m.tourneesExistantes.length} tournée(s) déjà en base sur la période (${m.tourneesExistantes.map(jourFr).join(', ')}) — un import en mode Fusion y ajouterait les PDV.`)
  }
}
const zoneVersMerchs = {}
merchs.forEach(m => m.zones.forEach(z => { (zoneVersMerchs[z] ||= []).push(m.nomFichier) }))
Object.entries(zoneVersMerchs).filter(([, ms]) => ms.length > 1)
  .forEach(([z, ms]) => anomalies.push(`Zone « ${z} » attribuée à ${ms.length} merchandisers dans le fichier : ${ms.join(', ')}.`))

// ---------- Rapport ----------

const STATUTS = ['Reconnu', 'Probable', 'Hors périmètre', 'Non trouvé', 'Sans GPS']
const compte = (liste, s) => liste.filter(c => c.statut === s).length
const synthese = merchs.map((m) => {
  const cs = clients.filter(c => c.merch === m.nomFichier)
  return `| ${m.nomFichier} | ${m.distributeurs.join(', ')} | ${m.zones.join(', ')} | ${m.profil?.email || '**aucun**'} | ${m.profil ? profileTerritories(m.profil).join(', ') : '—'} | `
    + `${m.profil ? m.pdvPerimetre.length : '—'} | ${m.jours?.length ? `${m.jours.length} (${jourFr(m.jours[0])} → ${jourFr(m.jours.at(-1))})` : '—'} | `
    + `${cs.length} | ${STATUTS.map(s => compte(cs, s)).join(' | ')} |`
})

const md = `# Croisement export DMS ↔ comptes et PDV

Source : \`${DMS_PATH.split('/').pop()}\` — ${lignesDms} lignes, dont ${lignesAffectees} avec un merchandiser (${clients.length} clients distincts). `
+ `Les ${lignesDms - lignesAffectees} lignes sans merchandiser sont ignorées.

Tournées : tous les PDV actifs du périmètre de chaque compte (règle de l'import), ${PDV_PAR_JOUR} par jour, `
+ `du lundi au samedi à partir du ${jourFr(DATE_DEBUT)}, dans l'ordre du plus proche voisin. Aucune écriture en base.

## Synthèse

| Merchandiser (fichier) | Distributeur | Zone (fichier) | Compte | Territoires du compte | PDV planifiés | Jours | Clients DMS | ${STATUTS.join(' | ')} |
|---|---|---|---|---|---|---|---|${STATUTS.map(() => '---').join('|')}|
${synthese.join('\n')}

Statuts du rapprochement client DMS ↔ PDV (GPS + nom, pour information — les tournées n'en dépendent pas) :
- **Reconnu** : PDV à ${RAYON_NOM_M} m ou moins avec un mot du nom en commun.
- **Probable** : seul PDV à ${RAYON_SEUL_M} m ou moins, nom différent.
- **Hors périmètre** : PDV rapproché, mais en dehors du périmètre du compte.
- **Non trouvé** / **Sans GPS** : repris dans \`clients-dms-a-renvoyer.csv\` (${aRenvoyer.length} clients).

## Anomalies

${anomalies.map(a => `- ${a}`).join('\n') || '- Aucune.'}

## Fichiers

- \`${OUT_TOURNEES.split('/').pop()}\` — ${lignesTournees.length} visites, format du modèle (réimportable par Routing → Importer).
- \`${OUT_CROISEMENT.split('/').pop()}\` — ${clients.length} clients DMS avec le PDV rapproché.
- \`${OUT_RENVOI.split('/').pop()}\` — ${aRenvoyer.length} clients à faire vérifier.
`
writeFileSync(OUT_MD, md, 'utf8')

// ---------- 7. Contrôle : relecture du CSV comme l'import de l'app ----------

function parseCsvLine(line) { // composables/useCsvExport.ts
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ } else inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) { result.push(current); current = '' } else current += char
  }
  result.push(current)
  return result
}
const texte = readFileSync(OUT_TOURNEES, 'utf8')
const lignes = texte.split('\n').filter(l => l.trim())
const hdr = parseCsvLine(lignes[0]).map(h => cle(h))
const iEmail = hdr.indexOf('merchandiser'); const iDate = hdr.indexOf('date'); const iPdv = hdr.indexOf('point de vente')
const profilParEmail = new Map(profils.map(p => [p.email.toLowerCase(), p]))
const pdvParId = new Map(merchs.filter(m => m.profil).flatMap(m => m.pdvTerritoire.map(p => [p.pdv_id, p])))
const refus = []
const cles = new Set()
lignes.slice(1).forEach((l, k) => {
  const v = parseCsvLine(l).map(s => s.trim())
  const email = (v[iEmail].match(/[^\s—<>()]+@[^\s—<>()]+/)?.[0] || v[iEmail]).toLowerCase()
  const fr = v[iDate].match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  const date = fr ? `${fr[3]}-${pad(Number(fr[2]))}-${pad(Number(fr[1]))}` : v[iDate]
  const pdvId = v[iPdv].includes('·') ? v[iPdv].split('·').pop().trim() : v[iPdv]
  const p = profilParEmail.get(email)
  const pdv = pdvParId.get(pdvId)
  const dup = `${email}|${date}|${pdvId}`
  if (!p) refus.push(`ligne ${k + 2} : merchandiser ${email} introuvable`)
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) refus.push(`ligne ${k + 2} : date « ${v[iDate]} »`)
  else if (!pdv) refus.push(`ligne ${k + 2} : PDV ${pdvId} introuvable`)
  else if (!pdvInScope(pdv, p)) refus.push(`ligne ${k + 2} : PDV ${pdvId} hors périmètre`)
  else if (cles.has(dup)) refus.push(`ligne ${k + 2} : PDV ${pdvId} en double le ${date}`)
  cles.add(dup)
})

console.log(`Export DMS : ${lignesDms} lignes, ${lignesAffectees} affectées, ${clients.length} clients distincts`)
for (const m of merchs) {
  console.log(`  ${m.nomFichier.padEnd(18)} → ${(m.profil?.email || 'AUCUN COMPTE').padEnd(28)} `
    + (m.profil ? `${m.pdvPerimetre.length} PDV, ${m.jours.length} jours` : ''))
}
console.log(`Statuts DMS : ${STATUTS.map(s => `${s} ${compte(clients, s)}`).join(', ')} (total ${clients.length})`)
console.log(`Contrôle import : ${lignes.length - 1} lignes, ${refus.length} refus attendu(s)`)
refus.slice(0, 20).forEach(r => console.log(`  ${r}`))
console.log(`\n${OUT_TOURNEES}\n${OUT_CROISEMENT}\n${OUT_RENVOI}\n${OUT_MD}`)
