/**
 * Import massif du 31/08/2026 via l'API REST Supabase (pas d'accès psql).
 * Source : csv/VISITE - {ZONE SECTEUR,PDV,VISITE}.csv (exportés de VISITE (3).xlsx)
 *
 * Étapes (voir supabase/MIGRATION_IMPORT_2026-08-31.md) :
 *   1. Suppression des données démo PS-* / PS-VIS-*
 *   2. Remplacement complet de zones_secteurs (881 lignes)
 *   3. Upsert des PDV par lots de 500 (on_conflict pdv_id)
 *   4. Visites via RPC import_visite_from_csv (upsert visite_id), concurrence 15
 *
 * Usage :
 *   node scripts/import-rest-2026-08-31.mjs --step=demo|zones|pdv|visites|all [--limit=N]
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
config({ path: join(ROOT, '.env') })

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants dans .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const args = process.argv.slice(2)
const STEP = (args.find(a => a.startsWith('--step=')) || '--step=all').split('=')[1]
const LIMIT = parseInt((args.find(a => a.startsWith('--limit=')) || '--limit=0').split('=')[1], 10)

// ── CSV parser (identique aux générateurs existants) ────────
function parseCSV(content) {
  const rows = []
  let current = ''
  let inQuotes = false
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    current = inQuotes ? current + '\n' + lines[i] : lines[i]
    let quoteCount = 0
    for (let j = 0; j < current.length; j++) if (current[j] === '"') quoteCount++
    inQuotes = quoteCount % 2 !== 0
    if (!inQuotes) {
      const parsed = parseCSVLine(current)
      if (parsed && parsed.length > 1) rows.push(parsed)
      current = ''
    }
  }
  return rows
}

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim()); current = ''
    } else current += char
  }
  result.push(current.trim())
  return result
}

function loadCsv(name, requireFirstCol = true) {
  const rows = parseCSV(readFileSync(join(ROOT, 'csv', name), 'utf-8'))
  const header = rows[0]
  // Normalise l'apostrophe typographique (même correctif que generate-seed-sql.mjs)
  const h = {}
  header.forEach((col, idx) => { h[col.trim().replace(/’/g, "'")] = idx })
  const data = rows.slice(1).filter(r => !requireFirstCol || (r[0] && r[0].trim() !== ''))
  const get = (row, col) => {
    const idx = h[col]
    return idx === undefined ? '' : (row[idx] || '').trim()
  }
  return { data, get }
}

const asBool = v => (v || '').toUpperCase() === 'TRUE' || v === '1'
const orNull = v => (v && v !== '') ? v : null
const product = v => (v && v !== '') ? v : 'En rupture'

function parseGeo(geo) {
  if (!geo) return { lat: null, lng: null }
  const parts = geo.replace(/"/g, '').replace(/ /g, '').split(',')
  if (parts.length === 2) {
    const lat = parseFloat(parts[0]); const lng = parseFloat(parts[1])
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng }
  }
  return { lat: null, lng: null }
}

function parseDateDMY(s) {
  if (!s) return null
  const p = s.split('/')
  if (p.length === 3) return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`
  return null
}

async function fail(step, error) {
  console.error(`❌ ${step}: ${error.message || JSON.stringify(error)}`)
  process.exit(1)
}

// ── 1. Nettoyage des données démo ───────────────────────────
async function stepDemo() {
  console.log('🧹 Suppression des données démo PS-* …')
  const del1 = await supabase.from('visites').delete().like('visite_id', 'PS-VIS-%').select('visite_id')
  if (del1.error) await fail('delete visites démo', del1.error)
  const del2 = await supabase.from('pdv').delete().like('pdv_id', 'PS-%').select('pdv_id')
  if (del2.error) await fail('delete pdv démo', del2.error)
  console.log(`   ✅ ${del1.data.length} visites démo et ${del2.data.length} PDV démo supprimés`)
}

// ── 2. zones_secteurs ────────────────────────────────────────
async function stepZones() {
  // Certaines lignes (PORT-BOUET…) n'ont pas de Secteur ID mais sont valides :
  // on filtre sur la présence d'une Zone, pas de l'ID.
  const loaded = loadCsv('VISITE - ZONE SECTEUR.csv', false)
  const get = loaded.get
  const data = loaded.data.filter(r => get(r, 'Zone'))
  console.log(`📍 zones_secteurs : remplacement complet (${data.length} lignes)…`)
  const del = await supabase.from('zones_secteurs').delete().gte('id', 0).select('id')
  if (del.error) await fail('delete zones_secteurs', del.error)
  console.log(`   ${del.data.length} anciennes lignes supprimées`)

  const rows = data.map(r => ({
    zone: orNull(get(r, 'Zone')),
    secteur: orNull(get(r, 'Secteur')),
    merchandiser: orNull(get(r, 'Merchandiser')),
    email_merchandiser: orNull(get(r, 'e-mail')),
    sales_rep: orNull(get(r, 'Sales rep')),
    email_sales_rep: orNull(get(r, 'email Sales rep')),
    region: orNull(get(r, 'Région')) || 'ABIDJAN 2',
  }))
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from('zones_secteurs').insert(rows.slice(i, i + 200))
    if (error) await fail(`insert zones batch ${i}`, error)
  }
  console.log(`   ✅ ${rows.length} zones/secteurs insérés`)
}

// ── 3. PDV ───────────────────────────────────────────────────
async function stepPdv() {
  const { data, get } = loadCsv('VISITE - PDV.csv')
  const src = LIMIT > 0 ? data.slice(0, LIMIT) : data
  console.log(`🏪 PDV : upsert de ${src.length} lignes par lots de 500…`)
  let done = 0
  for (let i = 0; i < src.length; i += 500) {
    const rows = src.slice(i, i + 500).map(r => {
      const { lat, lng } = parseGeo(get(r, 'Geolocation'))
      return {
        pdv_id: get(r, 'PDV ID'),
        nom_pdv: get(r, 'Nom du PDV') || 'PDV ' + get(r, 'PDV ID'),
        canal: get(r, 'Canal') || 'General trade',
        categorie_pdv: get(r, 'Catégorie de PDV') || 'Point de vente détail',
        sous_categorie_pdv: get(r, 'Sous-catégorie de PDV') || 'Boutique C',
        autre_sous_categorie: orNull(get(r, 'Autre sous-catégorie de pdv')),
        region: orNull(get(r, 'Région')),
        zone: orNull(get(r, 'Zone')),
        // Schéma live : pdv.secteur a été renommé pdv.quartier (migration 20260716230000)
        quartier: orNull(get(r, 'Secteur')),
        geolocation_lat: lat,
        geolocation_lng: lng,
        adressage: orNull(get(r, 'Adressage')),
        image_url: orNull(get(r, 'Image')),
        date_creation: parseDateDMY(get(r, 'Date')),
        ajoute_par: orNull(get(r, 'Ajouté par')),
        jour_routing: orNull(get(r, 'Jour du routing')),
        position_routing: get(r, 'Position dans le routing') ? parseInt(get(r, 'Position dans le routing'), 10) || null : null,
        canal_routing: orNull(get(r, 'Canal de routing')),
        sales_rep_routing: orNull(get(r, 'Sales Rep routing')),
      }
    })
    const { error } = await supabase.from('pdv').upsert(rows, { onConflict: 'pdv_id' })
    if (error) await fail(`upsert pdv batch ${i}`, error)
    done += rows.length
    if (done % 2500 === 0 || done === src.length) console.log(`   ${done}/${src.length}`)
  }
  console.log(`   ✅ ${done} PDV upsertés`)
}

// ── 4. Visites via RPC ───────────────────────────────────────
function buildVisitePayload(r, get) {
  return {
    visite_id: get(r, 'Visite ID'),
    pdv_id: get(r, 'PDV'),
    date: get(r, 'Date'),
    commercial: get(r, 'Commercial'),
    email: get(r, 'Email'),
    evap_present: asBool(get(r, 'EVAP Présent?')),
    evap_br_gold: product(get(r, 'EVAP : BR Gold présent?')),
    evap_br_160g: product(get(r, 'EVAP : BR 160g présent?')),
    evap_brb_160g: product(get(r, 'EVAP : BRB 160g présent?')),
    evap_br_400g: product(get(r, 'EVAP : BR 400g présent?')),
    evap_brb_400g: product(get(r, 'EVAP : BRB 400g présent?')),
    evap_pearl_400g: product(get(r, 'EVAP : Pearl 400g présent?')),
    evap_prix: asBool(get(r, 'EVAP : Prix respectés?')),
    imp_present: asBool(get(r, 'IMP Présent?')),
    imp_br_400g: product(get(r, 'IMP : BR 400g présent?')),
    imp_br_900g: product(get(r, 'IMP : BR 900g présent?')),
    imp_br_2_5kg: product(get(r, 'IMP : BR 2,5 Kg présent?')),
    imp_br_375g: product(get(r, 'IMP : BR 375g présent?')),
    imp_brb_400g: product(get(r, 'IMP : BRB 400g présent?')),
    imp_br_20g: product(get(r, 'IMP : BR 20g présent?')),
    imp_brb_25g: product(get(r, 'IMP : BRB 25g présent?')),
    imp_brd_15g: product(get(r, 'IMP : BRD 15g présent?')),
    imp_brd_350g: product(get(r, 'IMP : BRD 350g présent?')),
    imp_prix: asBool(get(r, 'IMP : Prix respectés?')),
    scm_present: asBool(get(r, 'SCM Présent?')),
    scm_br_1kg: product(get(r, 'SCM : BR 1Kg présent?')),
    scm_brb_1kg: product(get(r, 'SCM : BRB 1Kg présent?')),
    scm_brb_397g: product(get(r, 'SCM : BRB 397g présent?')),
    scm_br_397g: product(get(r, 'SCM : BR 397g présent?')),
    scm_pearl_1kg: product(get(r, 'SCM : Pearl 1Kg présent?')),
    scm_prix: asBool(get(r, 'SCM : Prix respectés?')),
    uht_present: asBool(get(r, 'UHT Présent?')),
    uht_demi_ecreme: product(get(r, 'UHT : Demi écrémé présent?')),
    uht_elopack_500ml: product(get(r, 'UHT : Elopack 500 ml')),
    uht_brique_1l: product(get(r, 'UHT : Brique 1L')),
    uht_prix: asBool(get(r, 'UHT prix respectés?')),
    cereales_present: asBool(get(r, 'Céréales au lait Présent?')),
    cereales_brcv: product(get(r, 'Céréales au lait : BRCV Présent?')),
    cereales_brcc: product(get(r, 'Céréales au lait : BRCC Présent?')),
    cereales_prix: asBool(get(r, 'Céréales au lait Prix respectés?')),
    yaourt_present: asBool(get(r, 'YAOURT Présent?')),
    yaourt_nature_mini: product(get(r, 'YAOURT : BR Yogoo nature mini 90 ml?')),
    yaourt_fraise_mini: product(get(r, 'YAOURT : BR Yogoo fraise mini 90 ml?')),
    yaourt_fraise_maxi: product(get(r, 'YAOURT : BR Yogoo fraise maxi 318 ml?')),
    yaourt_nature_maxi: product(get(r, 'YAOURT : BR Yogoo nature maxi 318 ml?')),
    yaourt_prix: asBool(get(r, 'YAOURT : Prix respectés?')),
    conc_presence: asBool(get(r, 'Présence de concurrents')),
    conc_evap_present: asBool(get(r, 'Concurrent EVAP présent?')),
    conc_evap_cowmilk: asBool(get(r, 'Concurrent EVAP : Cowmilk présent?')),
    conc_evap_nido_150g: asBool(get(r, 'Concurrent EVAP : NIDO 150g présent?')),
    conc_evap_autre: asBool(get(r, 'Concurrent EVAP : autre')),
    conc_evap_nom: orNull(get(r, 'Nom du concurrent EVAP')),
    conc_imp_present: asBool(get(r, 'Concurrent IMP présent?')),
    conc_imp_nido: asBool(get(r, 'Concurrent IMP : Nido présent?')),
    conc_imp_laity: asBool(get(r, 'Concurrent IMP : Laity présent?')),
    conc_imp_toplait: asBool(get(r, 'Concurrent IMP : Top lait présent?')),
    conc_imp_autre: asBool(get(r, 'Concurrent IMP : autre')),
    conc_imp_nom: orNull(get(r, 'Nom du concurrent IMP')),
    conc_scm_present: asBool(get(r, 'Concurrent SCM présent?')),
    conc_scm_topsaho: asBool(get(r, 'Concurrent SCM : Top Saho présent?')),
    conc_scm_autre: asBool(get(r, 'Concurrent SCM : autre')),
    conc_scm_nom: orNull(get(r, 'Nom du concurrent SCM')),
    conc_uht_present: asBool(get(r, 'Concurrent UHT présent?')),
    conc_uht_candia: asBool(get(r, 'Concurrent UHT : Candia présent?')),
    conc_uht_autre: asBool(get(r, 'Concurrent UHT : autre')),
    conc_uht_nom: orNull(get(r, 'Nom du concurrent UHT')),
    vis_ext_presence: asBool(get(r, 'Présence de visibilité extérieure')),
    vis_ext_photo: orNull(get(r, 'Photo branding externe')),
    vis_ext_full_branding: asBool(get(r, 'Full branding extérieur')),
    vis_ext_etat_branding: orNull(get(r, 'État branding extérieur')),
    vis_ext_poster: asBool(get(r, 'Poster')),
    vis_ext_etat_poster: orNull(get(r, 'État poster')),
    vis_ext_panneau: asBool(get(r, 'Panneau privilège')),
    vis_ext_etat_panneau: orNull(get(r, 'État panneau privilège')),
    vis_ext_signboard: asBool(get(r, 'Sign board')),
    vis_ext_etat_signboard: orNull(get(r, 'État sign board')),
    vis_ext_guirlande: asBool(get(r, 'Guirlande')),
    vis_ext_etat_guirlande: orNull(get(r, 'État guirlande')),
    vis_ext_autre: asBool(get(r, 'Autre branding extérieur')),
    vis_ext_etat_autre: orNull(get(r, 'État des autres branding externes')),
    vis_int_presence: asBool(get(r, 'Présence de visibilité intérieure')),
    vis_int_photo: orNull(get(r, 'Photo visibilité intérieure')),
    vis_int_hanger: asBool(get(r, 'Hanger')),
    vis_int_etat_hanger: orNull(get(r, 'Hanger : état')),
    vis_int_tete_gondole: asBool(get(r, 'Tête de gondole')),
    vis_int_etat_tete_gondole: orNull(get(r, 'Tête de gondole : état')),
    vis_int_maison_br: asBool(get(r, 'Maison bonnet Rouge')),
    vis_int_etat_maison_br: orNull(get(r, 'Maison bonnet Rouge : état')),
    vis_int_reglettes: asBool(get(r, 'Réglettes')),
    vis_int_etat_reglettes: orNull(get(r, 'Réglettes : état')),
    vis_int_zone_chaude: asBool(get(r, 'Zone chaude')),
    vis_int_etat_zone_chaude: orNull(get(r, 'Zone chaude : état')),
    vis_int_frigo: asBool(get(r, 'Produits dans le frigo')),
    vis_int_etat_frigo: orNull(get(r, 'Produits dans le frigo : état')),
    vis_int_presentoirs: asBool(get(r, 'Présence de présentoirs')),
    vis_int_etat_presentoirs: orNull(get(r, 'Présence de présentoirs : état')),
    vis_int_bacs: asBool(get(r, 'Bacs à pouch')),
    vis_int_etat_bacs: orNull(get(r, 'Bacs à pouch : état')),
    vis_int_autre_gt: asBool(get(r, 'Autre visibilité intérieure (GT)')),
    vis_int_etat_autre_gt: orNull(get(r, 'Autre visibilité intérieure (GT) : état')),
    vis_int_habillage: asBool(get(r, 'Habillage rayon')),
    vis_int_etat_habillage: orNull(get(r, 'Habillage rayon : état')),
    vis_int_merchandising: asBool(get(r, 'Merchandising')),
    vis_int_etat_merchandising: orNull(get(r, 'Merchandising : état')),
    vis_int_autre: asBool(get(r, 'Autres visibilité intérieure')),
    vis_int_etat_autre: orNull(get(r, 'Autres visibilité intérieure : état')),
    vis_conc_presence: asBool(get(r, 'Présence de visibilité')),
    vis_conc_nido_ext: asBool(get(r, 'Visibilité extérieure NIDO')),
    vis_conc_nido_int: asBool(get(r, 'Visibilité intérieure NIDO')),
    vis_conc_laity_ext: asBool(get(r, 'Visibilité extérieure LAITY')),
    vis_conc_laity_int: asBool(get(r, 'Visibilité intérieure LAITY')),
    vis_conc_candia_ext: asBool(get(r, 'Visibilité extérieure CANDIA')),
    vis_conc_candia_int: asBool(get(r, 'Visibilité intérieure CANDIA')),
    vis_conc_autre_ext: asBool(get(r, 'Visibilité extérieure AUTRE')),
    vis_conc_nom_ext: orNull(get(r, 'Nom du concurrent en Visibilité extérieure')),
    vis_conc_autre_int: asBool(get(r, 'Visibilité intérieure AUTRE')),
    vis_conc_nom_int: orNull(get(r, 'Nom du concurrent en Visibilité intérieure')),
    act_execution_vis: asBool(get(r, 'Exécution visibilité')),
    act_referencement: asBool(get(r, 'Référencement produits')),
    act_execution_promo: asBool(get(r, "Exécution d'activités promotionnelles")),
    act_prospection: asBool(get(r, 'Prospection PDV')),
    act_fifo: asBool(get(r, 'Vérification FIFO')),
    act_rangement: asBool(get(r, 'Rangement produits')),
    act_affiches: asBool(get(r, "Pause d'affiches")),
    act_materiel_vis: asBool(get(r, 'Pause matériel de visibilité')),
    image: orNull(get(r, 'Image')),
  }
}

// RPC avec timeout dur + retries : sans cela un appel qui ne répond jamais
// bloque son worker pour toujours (cause du blocage du premier run).
async function rpcWithRetry(payload, tries = 4) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30_000)
    try {
      const { error } = await supabase
        .rpc('import_visite_from_csv', { p_data: payload })
        .abortSignal(controller.signal)
      clearTimeout(timer)
      if (!error) return null
      if (attempt === tries) return error.message || JSON.stringify(error)
    }
    catch (e) {
      clearTimeout(timer)
      if (attempt === tries) return e.message || String(e)
    }
    await new Promise(r => setTimeout(r, 1000 * attempt))
  }
}

async function fetchExistingVisiteIds() {
  const ids = new Set()
  // PostgREST plafonne à 1000 lignes par requête (max-rows Supabase par défaut)
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('visites').select('visite_id').range(from, from + PAGE - 1)
    if (error) throw new Error(`lecture visite_ids: ${error.message}`)
    for (const r of data) ids.add(r.visite_id)
    if (data.length < PAGE) break
  }
  return ids
}

async function stepVisites() {
  const { data, get } = loadCsv('VISITE - VISITE.csv')
  const existing = await fetchExistingVisiteIds()
  console.log(`   ${existing.size} visites déjà en base — elles seront sautées`)
  const src = (LIMIT > 0 ? data.slice(0, LIMIT) : data)
    .filter(r => get(r, 'Visite ID') && !existing.has(get(r, 'Visite ID')))
  const CONCURRENCY = 8
  console.log(`📋 Visites : ${src.length} appels RPC import_visite_from_csv (concurrence ${CONCURRENCY})…`)
  let done = 0
  const errors = []
  let idx = 0
  const started = Date.now()

  async function worker() {
    while (idx < src.length) {
      const i = idx++
      const payload = buildVisitePayload(src[i], get)
      const err = await rpcWithRetry(payload)
      if (err) {
        errors.push({ visite_id: payload.visite_id, error: err })
        if (errors.length <= 5) console.error(`   ⚠️ ${payload.visite_id}: ${err}`)
      }
      done++
      if (done % 500 === 0) {
        const rate = done / ((Date.now() - started) / 1000)
        console.log(`   ${done}/${src.length} (${rate.toFixed(1)}/s, ${errors.length} erreurs)`)
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  console.log(`   ✅ ${done - errors.length} visites importées, ${errors.length} erreurs`)
  if (errors.length) {
    console.log('   Premières erreurs :', JSON.stringify(errors.slice(0, 10), null, 2))
    process.exitCode = 2
  }
}

// ── Main ─────────────────────────────────────────────────────
const steps = { demo: stepDemo, zones: stepZones, pdv: stepPdv, visites: stepVisites }
if (STEP === 'all') {
  await stepDemo(); await stepZones(); await stepPdv(); await stepVisites()
} else if (steps[STEP]) {
  await steps[STEP]()
} else {
  console.error(`❌ étape inconnue: ${STEP} (demo|zones|pdv|visites|all)`)
  process.exit(1)
}
console.log('🏁 Terminé')
