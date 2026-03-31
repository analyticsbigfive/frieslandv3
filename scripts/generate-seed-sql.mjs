/**
 * Script de génération des migrations SQL à partir des CSV
 * Génère:
 *   - supabase/003_seed_zones_secteurs.sql (864 zones)
 *   - supabase/004_seed_visites.sql (20K visites en batches)
 *
 * Usage: node scripts/generate-seed-sql.mjs
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const CSV_DIR = join(ROOT, 'csv')
const SQL_DIR = join(ROOT, 'supabase')

// ============================================================
// CSV Parser (gère les guillemets, virgules internes, newlines)
// ============================================================
function parseCSV(content) {
  const rows = []
  let current = ''
  let inQuotes = false
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!inQuotes) {
      current = line
    } else {
      current += '\n' + line
    }

    // Count unescaped quotes
    let quoteCount = 0
    for (let j = 0; j < current.length; j++) {
      if (current[j] === '"') quoteCount++
    }
    inQuotes = quoteCount % 2 !== 0

    if (!inQuotes) {
      const parsed = parseCSVLine(current)
      if (parsed && parsed.length > 1) {
        rows.push(parsed)
      }
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
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++ // Skip next quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

function sqlEscape(str) {
  if (!str || str === '') return 'NULL'
  // Remove newlines from zone names (data quality issue in CSV)
  str = str.replace(/\n/g, '').replace(/\r/g, '').trim()
  if (str === '') return 'NULL'
  return "'" + str.replace(/'/g, "''") + "'"
}

function sqlBool(val) {
  if (!val || val === '') return 'FALSE'
  const v = val.toString().toUpperCase().trim()
  return (v === 'TRUE' || v === 'VRAI' || v === '1') ? 'TRUE' : 'FALSE'
}

function sqlText(val) {
  if (!val || val === '') return 'NULL'
  return sqlEscape(val)
}

// ============================================================
// 1. ZONES SECTEURS
// ============================================================
function generateZonesSecteurs() {
  console.log('📍 Lecture CSV ZONE SECTEUR...')
  const content = readFileSync(join(CSV_DIR, 'VISITE - ZONE SECTEUR.csv'), 'utf-8')
  const rows = parseCSV(content)

  // Skip header
  const header = rows[0]
  console.log(`   Header: ${header.join(' | ')}`)
  const data = rows.slice(1)
  console.log(`   ${data.length} lignes de données`)

  let sql = `-- ============================================================
-- Migration Supabase - Friesland Bonnet Rouge
-- 003_seed_zones_secteurs.sql
-- Seed complet des zones_secteurs depuis CSV (${data.length} lignes)
-- Généré automatiquement par scripts/generate-seed-sql.mjs
-- ============================================================

-- Nettoyage
TRUNCATE public.zones_secteurs RESTART IDENTITY CASCADE;

-- ============================================================
-- INSERT BATCH: zones_secteurs
-- Colonnes: zone, secteur, merchandiser, email_merchandiser,
--           sales_rep, email_sales_rep, region
-- ============================================================
-- Note: Les Secteur IDs originaux du CSV (1-596, MT-xxx, MISEAJOUR-xxx)
-- sont remplacés par des IDs auto-incrémentés (SERIAL).
-- L'ancien ID CSV est conservé en commentaire pour traçabilité.

`

  // Group by batches of 100 for readability
  const BATCH_SIZE = 100
  let batchNum = 0

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, Math.min(i + BATCH_SIZE, data.length))
    batchNum++

    sql += `-- Batch ${batchNum} (lignes ${i + 1} à ${i + batch.length})\n`
    sql += `INSERT INTO public.zones_secteurs (zone, secteur, merchandiser, email_merchandiser, sales_rep, email_sales_rep, region) VALUES\n`

    const values = batch.map((row, idx) => {
      // CSV columns: Secteur ID, Zone, Secteur, Merchandiser, e-mail, Sales rep, email Sales rep, Région
      const [secteurId, zone, secteur, merchandiser, email, salesRep, emailSalesRep, region] = row

      const line = `  (${sqlEscape(zone)}, ${sqlEscape(secteur)}, ${sqlEscape(merchandiser)}, ${sqlEscape(email)}, ${sqlEscape(salesRep)}, ${sqlEscape(emailSalesRep)}, ${sqlEscape(region || 'ABIDJAN 2')})`

      return { line, secteurId }
    })

    sql += values.map((v, idx) => {
      const isLast = idx === values.length - 1
      const separator = isLast ? ';' : ','
      return `${v.line}${separator} -- CSV ID: ${v.secteurId}`
    }).join('\n')
    sql += '\n\n'
  }

  // Add useful indexes and statistics refresh
  sql += `-- ============================================================
-- Vérification post-import
-- ============================================================
-- SELECT count(*) as total, count(DISTINCT zone) as zones, count(DISTINCT region) as regions
-- FROM public.zones_secteurs;
-- Attendu: ~${data.length} total, ~50+ zones, ~10+ régions
`

  const outputPath = join(SQL_DIR, '003_seed_zones_secteurs.sql')
  writeFileSync(outputPath, sql, 'utf-8')
  console.log(`   ✅ Écrit: ${outputPath}`)
  console.log(`   📊 ${data.length} zones_secteurs générées`)

  return data.length
}

// ============================================================
// 2. VISITES (le gros morceau!)
// ============================================================
function generateVisites() {
  console.log('\n📋 Lecture CSV VISITE...')
  const content = readFileSync(join(CSV_DIR, 'VISITE - VISITE.csv'), 'utf-8')
  const rows = parseCSV(content)

  const header = rows[0]
  console.log(`   ${header.length} colonnes dans le header`)
  const data = rows.slice(1).filter(r => r.length > 5 && r[0] && r[0].trim() !== '')
  console.log(`   ${data.length} lignes de visites`)

  // Map header indices for safety
  const h = {}
  header.forEach((col, idx) => { h[col.trim()] = idx })

  // Helper to get value by column name
  const get = (row, colName) => {
    const idx = h[colName]
    if (idx === undefined) return ''
    return (row[idx] || '').trim()
  }

  const getBool = (row, colName) => {
    const val = get(row, colName)
    return (val.toUpperCase() === 'TRUE' || val === '1') ? 'TRUE' : 'FALSE'
  }

  const getProduct = (row, colName) => {
    const val = get(row, colName)
    if (!val) return "'En rupture'"
    return sqlEscape(val)
  }

  let sql = `-- ============================================================
-- Migration Supabase - Friesland Bonnet Rouge
-- 004_seed_visites.sql
-- Import massif des visites depuis CSV (${data.length} lignes)
-- Généré automatiquement par scripts/generate-seed-sql.mjs
-- ============================================================
-- ATTENTION: Ce fichier est très volumineux (~${data.length} appels de fonction)
-- Exécuter en transaction pour permettre le rollback en cas d'erreur
-- ============================================================

BEGIN;

-- Désactiver les triggers temporairement pour la performance
ALTER TABLE public.visites DISABLE TRIGGER set_updated_at_visites;

`

  // Process in batches
  const BATCH_SIZE = 500
  let batchNum = 0
  let totalProcessed = 0

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, Math.min(i + BATCH_SIZE, data.length))
    batchNum++

    sql += `-- ============================================================\n`
    sql += `-- BATCH ${batchNum}: visites ${i + 1} à ${i + batch.length}\n`
    sql += `-- ============================================================\n\n`

    for (const row of batch) {
      const visiteId = get(row, 'Visite ID')
      const pdvId = get(row, 'PDV')
      const date = get(row, 'Date')
      const commercial = get(row, 'Commercial')
      const email = get(row, 'Email')

      if (!visiteId) continue

      // Helper: escape a value for JSONB string (double-escape single quotes for SQL, escape backslashes/double quotes for JSON)
      const jsonStr = (val) => {
        if (!val || val === '') return 'null'
        return '"' + val.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
      }
      const jsonBool = (row, colName) => {
        const val = get(row, colName)
        return (val.toUpperCase() === 'TRUE' || val === '1') ? 'true' : 'false'
      }
      const jsonProduct = (row, colName) => {
        const val = get(row, colName)
        if (!val) return '"En rupture"'
        return '"' + val.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
      }
      const jsonText = (val) => {
        if (!val || val === '') return 'null'
        return '"' + val.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
      }

      // Build the JSONB object matching p_data keys in import_visite_from_csv
      const jsonObj = `{` +
        `"visite_id": ${jsonStr(visiteId)}, ` +
        `"pdv_id": ${jsonStr(pdvId)}, ` +
        `"date": ${jsonStr(date)}, ` +
        `"commercial": ${jsonStr(commercial)}, ` +
        `"email": ${jsonStr(email)}, ` +
        // EVAP
        `"evap_present": ${jsonBool(row, 'EVAP Présent?')}, ` +
        `"evap_br_gold": ${jsonProduct(row, 'EVAP : BR Gold présent?')}, ` +
        `"evap_br_160g": ${jsonProduct(row, 'EVAP : BR 160g présent?')}, ` +
        `"evap_brb_160g": ${jsonProduct(row, 'EVAP : BRB 160g présent?')}, ` +
        `"evap_br_400g": ${jsonProduct(row, 'EVAP : BR 400g présent?')}, ` +
        `"evap_brb_400g": ${jsonProduct(row, 'EVAP : BRB 400g présent?')}, ` +
        `"evap_pearl_400g": ${jsonProduct(row, 'EVAP : Pearl 400g présent?')}, ` +
        `"evap_prix": ${jsonBool(row, 'EVAP : Prix respectés?')}, ` +
        // IMP
        `"imp_present": ${jsonBool(row, 'IMP Présent?')}, ` +
        `"imp_br_400g": ${jsonProduct(row, 'IMP : BR 400g présent?')}, ` +
        `"imp_br_900g": ${jsonProduct(row, 'IMP : BR 900g présent?')}, ` +
        `"imp_br_2_5kg": ${jsonProduct(row, 'IMP : BR 2,5 Kg présent?')}, ` +
        `"imp_br_375g": ${jsonProduct(row, 'IMP : BR 375g présent?')}, ` +
        `"imp_brb_400g": ${jsonProduct(row, 'IMP : BRB 400g présent?')}, ` +
        `"imp_br_20g": ${jsonProduct(row, 'IMP : BR 20g présent?')}, ` +
        `"imp_brb_25g": ${jsonProduct(row, 'IMP : BRB 25g présent?')}, ` +
        `"imp_brd_15g": ${jsonProduct(row, 'IMP : BRD 15g présent?')}, ` +
        `"imp_brd_350g": ${jsonProduct(row, 'IMP : BRD 350g présent?')}, ` +
        `"imp_prix": ${jsonBool(row, 'IMP : Prix respectés?')}, ` +
        // SCM
        `"scm_present": ${jsonBool(row, 'SCM Présent?')}, ` +
        `"scm_br_1kg": ${jsonProduct(row, 'SCM : BR 1Kg présent?')}, ` +
        `"scm_brb_1kg": ${jsonProduct(row, 'SCM : BRB 1Kg présent?')}, ` +
        `"scm_brb_397g": ${jsonProduct(row, 'SCM : BRB 397g présent?')}, ` +
        `"scm_br_397g": ${jsonProduct(row, 'SCM : BR 397g présent?')}, ` +
        `"scm_pearl_1kg": ${jsonProduct(row, 'SCM : Pearl 1Kg présent?')}, ` +
        `"scm_prix": ${jsonBool(row, 'SCM : Prix respectés?')}, ` +
        // UHT
        `"uht_present": ${jsonBool(row, 'UHT Présent?')}, ` +
        `"uht_demi_ecreme": ${jsonProduct(row, 'UHT : Demi écrémé présent?')}, ` +
        `"uht_elopack_500ml": ${jsonProduct(row, 'UHT : Elopack 500 ml')}, ` +
        `"uht_brique_1l": ${jsonProduct(row, 'UHT : Brique 1L')}, ` +
        `"uht_prix": ${jsonBool(row, 'UHT prix respectés?')}, ` +
        // Céréales
        `"cereales_present": ${jsonBool(row, 'Céréales au lait Présent?')}, ` +
        `"cereales_brcv": ${jsonProduct(row, 'Céréales au lait : BRCV Présent?')}, ` +
        `"cereales_brcc": ${jsonProduct(row, 'Céréales au lait : BRCC Présent?')}, ` +
        `"cereales_prix": ${jsonBool(row, 'Céréales au lait Prix respectés?')}, ` +
        // Yaourt
        `"yaourt_present": ${jsonBool(row, 'YAOURT Présent?')}, ` +
        `"yaourt_nature_mini": ${jsonProduct(row, 'YAOURT : BR Yogoo nature mini 90 ml?')}, ` +
        `"yaourt_fraise_mini": ${jsonProduct(row, 'YAOURT : BR Yogoo fraise mini 90 ml?')}, ` +
        `"yaourt_fraise_maxi": ${jsonProduct(row, 'YAOURT : BR Yogoo fraise maxi 318 ml?')}, ` +
        `"yaourt_nature_maxi": ${jsonProduct(row, 'YAOURT : BR Yogoo nature maxi 318 ml?')}, ` +
        `"yaourt_prix": ${jsonBool(row, 'YAOURT : Prix respectés?')}, ` +
        // Concurrence
        `"conc_presence": ${jsonBool(row, 'Présence de concurrents')}, ` +
        `"conc_evap_present": ${jsonBool(row, 'Concurrent EVAP présent?')}, ` +
        `"conc_evap_cowmilk": ${jsonBool(row, 'Concurrent EVAP : Cowmilk présent?')}, ` +
        `"conc_evap_nido_150g": ${jsonBool(row, 'Concurrent EVAP : NIDO 150g présent?')}, ` +
        `"conc_evap_autre": ${jsonBool(row, 'Concurrent EVAP : autre')}, ` +
        `"conc_evap_nom": ${jsonText(get(row, 'Nom du concurrent EVAP'))}, ` +
        `"conc_imp_present": ${jsonBool(row, 'Concurrent IMP présent?')}, ` +
        `"conc_imp_nido": ${jsonBool(row, 'Concurrent IMP : Nido présent?')}, ` +
        `"conc_imp_laity": ${jsonBool(row, 'Concurrent IMP : Laity présent?')}, ` +
        `"conc_imp_toplait": ${jsonBool(row, 'Concurrent IMP : Top lait présent?')}, ` +
        `"conc_imp_autre": ${jsonBool(row, 'Concurrent IMP : autre')}, ` +
        `"conc_imp_nom": ${jsonText(get(row, 'Nom du concurrent IMP'))}, ` +
        `"conc_scm_present": ${jsonBool(row, 'Concurrent SCM présent?')}, ` +
        `"conc_scm_topsaho": ${jsonBool(row, 'Concurrent SCM : Top Saho présent?')}, ` +
        `"conc_scm_autre": ${jsonBool(row, 'Concurrent SCM : autre')}, ` +
        `"conc_scm_nom": ${jsonText(get(row, 'Nom du concurrent SCM'))}, ` +
        `"conc_uht_present": ${jsonBool(row, 'Concurrent UHT présent?')}, ` +
        `"conc_uht_candia": ${jsonBool(row, 'Concurrent UHT : Candia présent?')}, ` +
        `"conc_uht_autre": ${jsonBool(row, 'Concurrent UHT : autre')}, ` +
        `"conc_uht_nom": ${jsonText(get(row, 'Nom du concurrent UHT'))}, ` +
        // Visibilité extérieure
        `"vis_ext_presence": ${jsonBool(row, 'Présence de visibilité extérieure')}, ` +
        `"vis_ext_photo": ${jsonText(get(row, 'Photo branding externe'))}, ` +
        `"vis_ext_full_branding": ${jsonBool(row, 'Full branding extérieur')}, ` +
        `"vis_ext_etat_branding": ${jsonText(get(row, 'État branding extérieur'))}, ` +
        `"vis_ext_poster": ${jsonBool(row, 'Poster')}, ` +
        `"vis_ext_etat_poster": ${jsonText(get(row, 'État poster'))}, ` +
        `"vis_ext_panneau": ${jsonBool(row, 'Panneau privilège')}, ` +
        `"vis_ext_etat_panneau": ${jsonText(get(row, 'État panneau privilège'))}, ` +
        `"vis_ext_signboard": ${jsonBool(row, 'Sign board')}, ` +
        `"vis_ext_etat_signboard": ${jsonText(get(row, 'État sign board'))}, ` +
        `"vis_ext_guirlande": ${jsonBool(row, 'Guirlande')}, ` +
        `"vis_ext_etat_guirlande": ${jsonText(get(row, 'État guirlande'))}, ` +
        `"vis_ext_autre": ${jsonBool(row, 'Autre branding extérieur')}, ` +
        `"vis_ext_etat_autre": ${jsonText(get(row, 'État des autres branding externes'))}, ` +
        // Visibilité intérieure
        `"vis_int_presence": ${jsonBool(row, 'Présence de visibilité intérieure')}, ` +
        `"vis_int_photo": ${jsonText(get(row, 'Photo visibilité intérieure'))}, ` +
        `"vis_int_hanger": ${jsonBool(row, 'Hanger')}, ` +
        `"vis_int_etat_hanger": ${jsonText(get(row, 'Hanger : état'))}, ` +
        `"vis_int_tete_gondole": ${jsonBool(row, 'Tête de gondole')}, ` +
        `"vis_int_etat_tete_gondole": ${jsonText(get(row, 'Tête de gondole : état'))}, ` +
        `"vis_int_maison_br": ${jsonBool(row, 'Maison bonnet Rouge')}, ` +
        `"vis_int_etat_maison_br": ${jsonText(get(row, 'Maison bonnet Rouge : état'))}, ` +
        `"vis_int_reglettes": ${jsonBool(row, 'Réglettes')}, ` +
        `"vis_int_etat_reglettes": ${jsonText(get(row, 'Réglettes : état'))}, ` +
        `"vis_int_zone_chaude": ${jsonBool(row, 'Zone chaude')}, ` +
        `"vis_int_etat_zone_chaude": ${jsonText(get(row, 'Zone chaude : état'))}, ` +
        `"vis_int_frigo": ${jsonBool(row, 'Produits dans le frigo')}, ` +
        `"vis_int_etat_frigo": ${jsonText(get(row, 'Produits dans le frigo : état'))}, ` +
        `"vis_int_presentoirs": ${jsonBool(row, 'Présence de présentoirs')}, ` +
        `"vis_int_etat_presentoirs": ${jsonText(get(row, 'Présence de présentoirs : état'))}, ` +
        `"vis_int_bacs": ${jsonBool(row, 'Bacs à pouch')}, ` +
        `"vis_int_etat_bacs": ${jsonText(get(row, 'Bacs à pouch : état'))}, ` +
        `"vis_int_autre_gt": ${jsonBool(row, 'Autre visibilité intérieure (GT)')}, ` +
        `"vis_int_etat_autre_gt": ${jsonText(get(row, 'Autre visibilité intérieure (GT) : état'))}, ` +
        `"vis_int_habillage": ${jsonBool(row, 'Habillage rayon')}, ` +
        `"vis_int_etat_habillage": ${jsonText(get(row, 'Habillage rayon : état'))}, ` +
        `"vis_int_merchandising": ${jsonBool(row, 'Merchandising')}, ` +
        `"vis_int_etat_merchandising": ${jsonText(get(row, 'Merchandising : état'))}, ` +
        `"vis_int_autre": ${jsonBool(row, 'Autres visibilité intérieure')}, ` +
        `"vis_int_etat_autre": ${jsonText(get(row, 'Autres visibilité intérieure : état'))}, ` +
        // Visibilité concurrence
        `"vis_conc_presence": ${jsonBool(row, 'Présence de visibilité')}, ` +
        `"vis_conc_nido_ext": ${jsonBool(row, 'Visibilité extérieure NIDO')}, ` +
        `"vis_conc_nido_int": ${jsonBool(row, 'Visibilité intérieure NIDO')}, ` +
        `"vis_conc_laity_ext": ${jsonBool(row, 'Visibilité extérieure LAITY')}, ` +
        `"vis_conc_laity_int": ${jsonBool(row, 'Visibilité intérieure LAITY')}, ` +
        `"vis_conc_candia_ext": ${jsonBool(row, 'Visibilité extérieure CANDIA')}, ` +
        `"vis_conc_candia_int": ${jsonBool(row, 'Visibilité intérieure CANDIA')}, ` +
        `"vis_conc_autre_ext": ${jsonBool(row, 'Visibilité extérieure AUTRE')}, ` +
        `"vis_conc_nom_ext": ${jsonText(get(row, 'Nom du concurrent en Visibilité extérieure'))}, ` +
        `"vis_conc_autre_int": ${jsonBool(row, 'Visibilité intérieure AUTRE')}, ` +
        `"vis_conc_nom_int": ${jsonText(get(row, 'Nom du concurrent en Visibilité intérieure'))}, ` +
        // Actions
        `"act_execution_vis": ${jsonBool(row, 'Exécution visibilité')}, ` +
        `"act_referencement": ${jsonBool(row, 'Référencement produits')}, ` +
        `"act_execution_promo": ${jsonBool(row, 'Exécution d\'activités promotionnelles')}, ` +
        `"act_prospection": ${jsonBool(row, 'Prospection PDV')}, ` +
        `"act_fifo": ${jsonBool(row, 'Vérification FIFO')}, ` +
        `"act_rangement": ${jsonBool(row, 'Rangement produits')}, ` +
        `"act_affiches": ${jsonBool(row, 'Pause d\'affiches')}, ` +
        `"act_materiel_vis": ${jsonBool(row, 'Pause matériel de visibilité')}, ` +
        // Image
        `"image": ${jsonText(get(row, 'Image'))}` +
        `}`

      // Escape single quotes in the entire JSON string for SQL
      const sqlJsonStr = jsonObj.replace(/'/g, "''")

      sql += `SELECT import_visite_from_csv('${sqlJsonStr}'::jsonb);\n`
      totalProcessed++
    }
  }

  sql += `-- Réactiver les triggers
ALTER TABLE public.visites ENABLE TRIGGER set_updated_at_visites;

COMMIT;

-- ============================================================
-- Vérification post-import
-- ============================================================
-- SELECT count(*) as total_visites,
--        count(DISTINCT pdv_id) as pdv_distincts,
--        count(DISTINCT commercial) as commerciaux,
--        min(date_visite)::date as premiere_visite,
--        max(date_visite)::date as derniere_visite
-- FROM public.visites;
-- Attendu: ~${totalProcessed} visites

-- Refresh des vues matérialisées si nécessaire
-- SELECT * FROM v_stats_visites;
`

  const outputPath = join(SQL_DIR, '004_seed_visites.sql')
  writeFileSync(outputPath, sql, 'utf-8')
  console.log(`   ✅ Écrit: ${outputPath}`)
  console.log(`   📊 ${totalProcessed} visites générées`)

  return totalProcessed
}

// ============================================================
// MAIN
// ============================================================
console.log('🚀 Génération des migrations SQL depuis les CSV\n')
console.log('=' .repeat(60))

const zonesCount = generateZonesSecteurs()
const visitesCount = generateVisites()

console.log('\n' + '='.repeat(60))
console.log('✅ Génération terminée!')
console.log(`   📍 ${zonesCount} zones_secteurs → supabase/003_seed_zones_secteurs.sql`)
console.log(`   📋 ${visitesCount} visites → supabase/004_seed_visites.sql`)
console.log('\nPour appliquer:')
console.log('  1. psql -f supabase/003_seed_zones_secteurs.sql')
console.log('  2. psql -f supabase/004_seed_visites.sql')
console.log('  (ou via le SQL Editor de Supabase Dashboard)')
