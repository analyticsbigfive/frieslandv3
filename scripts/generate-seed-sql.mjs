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
      const separator = idx < values.length - 1 ? ',' : ''
      return `${v.line}${separator} -- CSV ID: ${v.secteurId}`
    }).join('\n')
    sql += ';\n\n'
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

      sql += `SELECT import_visite_from_csv(\n`
      sql += `  ${sqlEscape(visiteId)},\n`
      sql += `  ${sqlEscape(pdvId)},\n`
      sql += `  ${sqlEscape(date)},\n`
      sql += `  ${sqlEscape(commercial)},\n`
      sql += `  ${sqlEscape(email)},\n`

      // EVAP
      sql += `  -- EVAP\n`
      sql += `  ${getBool(row, 'EVAP Présent?')},\n`
      sql += `  ${getProduct(row, 'EVAP : BR Gold présent?')},\n`
      sql += `  ${getProduct(row, 'EVAP : BR 160g présent?')},\n`
      sql += `  ${getProduct(row, 'EVAP : BRB 160g présent?')},\n`
      sql += `  ${getProduct(row, 'EVAP : BR 400g présent?')},\n`
      sql += `  ${getProduct(row, 'EVAP : BRB 400g présent?')},\n`
      sql += `  ${getProduct(row, 'EVAP : Pearl 400g présent?')},\n`
      sql += `  ${getBool(row, 'EVAP : Prix respectés?')},\n`

      // IMP
      sql += `  -- IMP\n`
      sql += `  ${getBool(row, 'IMP Présent?')},\n`
      sql += `  ${getProduct(row, 'IMP : BR 400g présent?')},\n`
      sql += `  ${getProduct(row, 'IMP : BR 900g présent?')},\n`
      sql += `  ${getProduct(row, 'IMP : BR 2,5 Kg présent?')},\n`
      sql += `  ${getProduct(row, 'IMP : BR 375g présent?')},\n`
      sql += `  ${getProduct(row, 'IMP : BRB 400g présent?')},\n`
      sql += `  ${getProduct(row, 'IMP : BR 20g présent?')},\n`
      sql += `  ${getProduct(row, 'IMP : BRB 25g présent?')},\n`
      sql += `  ${getBool(row, 'IMP : Prix respectés?')},\n`

      // SCM
      sql += `  -- SCM\n`
      sql += `  ${getBool(row, 'SCM Présent?')},\n`
      sql += `  ${getProduct(row, 'SCM : BR 1Kg présent?')},\n`
      sql += `  ${getProduct(row, 'SCM : BRB 1Kg présent?')},\n`
      sql += `  ${getProduct(row, 'SCM : BRB 397g présent?')},\n`
      sql += `  ${getProduct(row, 'SCM : BR 397g présent?')},\n`
      sql += `  ${getProduct(row, 'SCM : Pearl 1Kg présent?')},\n`
      sql += `  ${getBool(row, 'SCM : Prix respectés?')},\n`

      // UHT
      sql += `  -- UHT\n`
      sql += `  ${getBool(row, 'UHT Présent?')},\n`
      sql += `  ${getProduct(row, 'UHT : Demi écrémé présent?')},\n`
      sql += `  ${getBool(row, 'UHT prix respectés?')},\n`

      // Céréales
      sql += `  -- Céréales\n`
      sql += `  ${getBool(row, 'Céréales au lait Présent?')},\n`
      sql += `  ${getProduct(row, 'Céréales au lait : BRCV Présent?')},\n`
      sql += `  ${getProduct(row, 'Céréales au lait : BRCC Présent?')},\n`
      sql += `  ${getBool(row, 'Céréales au lait Prix respectés?')},\n`

      // Concurrence
      sql += `  -- Concurrence\n`
      sql += `  ${getBool(row, 'Présence de concurrents')},\n`
      sql += `  ${getBool(row, 'Concurrent EVAP présent?')},\n`
      sql += `  ${getBool(row, 'Concurrent EVAP : Cowmilk présent?')},\n`
      sql += `  ${getBool(row, 'Concurrent EVAP : autre')},\n`
      sql += `  ${sqlText(get(row, 'Nom du concurrent EVAP'))},\n`
      sql += `  ${getBool(row, 'Concurrent IMP présent?')},\n`
      sql += `  ${getBool(row, 'Concurrent IMP : Nido présent?')},\n`
      sql += `  ${getBool(row, 'Concurrent IMP : Laity présent?')},\n`
      sql += `  ${getBool(row, 'Concurrent IMP : Top lait présent?')},\n`
      sql += `  ${getBool(row, 'Concurrent IMP : autre')},\n`
      sql += `  ${sqlText(get(row, 'Nom du concurrent IMP'))},\n`
      sql += `  ${getBool(row, 'Concurrent SCM présent?')},\n`
      sql += `  ${getBool(row, 'Concurrent SCM : Top Saho présent?')},\n`
      sql += `  ${getBool(row, 'Concurrent SCM : autre')},\n`
      sql += `  ${sqlText(get(row, 'Nom du concurrent SCM'))},\n`
      sql += `  ${getBool(row, 'Concurrent UHT présent?')},\n`
      sql += `  ${getBool(row, 'Concurrent UHT : Candia présent?')},\n`
      sql += `  ${getBool(row, 'Concurrent UHT : autre')},\n`
      sql += `  ${sqlText(get(row, 'Nom du concurrent UHT'))},\n`

      // Visibilité extérieure
      sql += `  -- Visibilité extérieure\n`
      sql += `  ${getBool(row, 'Présence de visibilité extérieure')},\n`
      sql += `  ${sqlText(get(row, 'Photo branding externe'))},\n`
      sql += `  ${getBool(row, 'Full branding extérieur')},\n`
      sql += `  ${sqlText(get(row, 'État branding extérieur'))},\n`
      sql += `  ${getBool(row, 'Poster')},\n`
      sql += `  ${sqlText(get(row, 'État poster'))},\n`
      sql += `  ${getBool(row, 'Panneau privilège')},\n`
      sql += `  ${sqlText(get(row, 'État panneau privilège'))},\n`
      sql += `  ${getBool(row, 'Sign board')},\n`
      sql += `  ${sqlText(get(row, 'État sign board'))},\n`
      sql += `  ${getBool(row, 'Guirlande')},\n`
      sql += `  ${sqlText(get(row, 'État guirlande'))},\n`
      sql += `  ${getBool(row, 'Autre branding extérieur')},\n`
      sql += `  ${sqlText(get(row, 'État des autres branding externes'))},\n`

      // Visibilité intérieure
      sql += `  -- Visibilité intérieure\n`
      sql += `  ${getBool(row, 'Présence de visibilité intérieure')},\n`
      sql += `  ${sqlText(get(row, 'Photo visibilité intérieure'))},\n`
      sql += `  ${getBool(row, 'Hanger')},\n`
      sql += `  ${sqlText(get(row, 'Hanger : état'))},\n`
      sql += `  ${getBool(row, 'Tête de gondole')},\n`
      sql += `  ${sqlText(get(row, 'Tête de gondole : état'))},\n`
      sql += `  ${getBool(row, 'Maison bonnet Rouge')},\n`
      sql += `  ${sqlText(get(row, 'Maison bonnet Rouge : état'))},\n`
      sql += `  ${getBool(row, 'Réglettes')},\n`
      sql += `  ${sqlText(get(row, 'Réglettes : état'))},\n`
      sql += `  ${getBool(row, 'Zone chaude')},\n`
      sql += `  ${sqlText(get(row, 'Zone chaude : état'))},\n`
      sql += `  ${getBool(row, 'Produits dans le frigo')},\n`
      sql += `  ${sqlText(get(row, 'Produits dans le frigo : état'))},\n`
      sql += `  ${getBool(row, 'Présence de présentoirs')},\n`
      sql += `  ${sqlText(get(row, 'Présence de présentoirs : état'))},\n`
      sql += `  ${getBool(row, 'Bacs à pouch')},\n`
      sql += `  ${sqlText(get(row, 'Bacs à pouch : état'))},\n`
      sql += `  ${getBool(row, 'Autre visibilité intérieure (GT)')},\n`
      sql += `  ${sqlText(get(row, 'Autre visibilité intérieure (GT) : état'))},\n`
      sql += `  ${getBool(row, 'Habillage rayon')},\n`
      sql += `  ${sqlText(get(row, 'Habillage rayon : état'))},\n`
      sql += `  ${getBool(row, 'Merchandising')},\n`
      sql += `  ${sqlText(get(row, 'Merchandising : état'))},\n`
      sql += `  ${getBool(row, 'Autres visibilité intérieure')},\n`
      sql += `  ${sqlText(get(row, 'Autres visibilité intérieure : état'))},\n`

      // Visibilité concurrence
      sql += `  -- Visibilité concurrence\n`
      sql += `  ${getBool(row, 'Présence de visibilité')},\n`
      sql += `  ${getBool(row, 'Visibilité extérieure NIDO')},\n`
      sql += `  ${getBool(row, 'Visibilité intérieure NIDO')},\n`
      sql += `  ${getBool(row, 'Visibilité extérieure LAITY')},\n`
      sql += `  ${getBool(row, 'Visibilité intérieure LAITY')},\n`
      sql += `  ${getBool(row, 'Visibilité extérieure CANDIA')},\n`
      sql += `  ${getBool(row, 'Visibilité intérieure CANDIA')},\n`
      sql += `  ${getBool(row, 'Visibilité extérieure AUTRE')},\n`
      sql += `  ${sqlText(get(row, 'Nom du concurrent en Visibilité extérieure'))},\n`
      sql += `  ${getBool(row, 'Visibilité intérieure AUTRE')},\n`
      sql += `  ${sqlText(get(row, 'Nom du concurrent en Visibilité intérieure'))},\n`

      // Actions
      sql += `  -- Actions\n`
      sql += `  ${getBool(row, 'Exécution visibilité')},\n`
      sql += `  ${getBool(row, 'Référencement produits')},\n`
      sql += `  ${getBool(row, 'Exécution d\'activités promotionnelles')},\n`
      sql += `  ${getBool(row, 'Prospection PDV')},\n`
      sql += `  ${getBool(row, 'T st')},\n`
      sql += `  ${getBool(row, 'Vérification FIFO')},\n`
      sql += `  ${getBool(row, 'Rangement produits')},\n`
      sql += `  ${getBool(row, 'Pause d\'affiches')},\n`
      sql += `  ${getBool(row, 'Pause matériel de visibilité')},\n`

      // Yaourt
      sql += `  -- Yaourt\n`
      sql += `  ${getBool(row, 'YAOURT Présent?')},\n`
      sql += `  ${getProduct(row, 'YAOURT : BR Yogoo nature mini 90 ml?')},\n`
      sql += `  ${getProduct(row, 'YAOURT : BR Yogoo fraise mini 90 ml?')},\n`
      sql += `  ${getProduct(row, 'YAOURT : BR Yogoo fraise maxi 318 ml?')},\n`
      sql += `  ${getProduct(row, 'YAOURT : BR Yogoo nature maxi 318 ml?')},\n`
      sql += `  ${getBool(row, 'YAOURT : Prix respectés?')},\n`

      // Colonnes supplémentaires ajoutées après
      sql += `  -- Supplémentaires\n`
      sql += `  ${getBool(row, 'Concurrent EVAP : NIDO 150g présent?')},\n`
      sql += `  ${getProduct(row, 'UHT : Elopack 500 ml')},\n`
      sql += `  ${getProduct(row, 'UHT : Brique 1L')},\n`
      sql += `  ${getProduct(row, 'IMP : BRD 15g présent?')},\n`
      sql += `  ${getProduct(row, 'IMP : BRD 350g présent?')},\n`

      // Image
      sql += `  -- Image\n`
      sql += `  ${sqlText(get(row, 'Image'))}\n`

      sql += `);\n\n`
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
