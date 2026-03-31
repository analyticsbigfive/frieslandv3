/**
 * Script de génération de la migration SQL des PDV à partir du CSV
 * Génère: supabase/005_seed_pdv.sql (~24 800 PDV)
 *
 * Usage: node scripts/generate-seed-pdv.mjs
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
  str = str.replace(/\n/g, '').replace(/\r/g, '').trim()
  if (str === '') return 'NULL'
  return "'" + str.replace(/'/g, "''") + "'"
}

function sqlInt(val) {
  if (!val || val === '') return 'NULL'
  const n = parseInt(val, 10)
  return isNaN(n) ? 'NULL' : n.toString()
}

function parseGeolocation(geo) {
  if (!geo || geo === '') return { lat: 'NULL', lng: 'NULL' }
  const clean = geo.replace(/"/g, '').replace(/ /g, '')
  const parts = clean.split(',')
  if (parts.length === 2) {
    const lat = parseFloat(parts[0])
    const lng = parseFloat(parts[1])
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat: lat.toString(), lng: lng.toString() }
    }
  }
  return { lat: 'NULL', lng: 'NULL' }
}

function parseDate(dateStr) {
  if (!dateStr || dateStr === '') return 'NULL'
  // Format DD/MM/YYYY
  const parts = dateStr.split('/')
  if (parts.length === 3) {
    const [day, month, year] = parts
    return `'${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}'`
  }
  return 'NULL'
}

// ============================================================
// GÉNÉRATION PDV
// ============================================================
function generatePDV() {
  console.log('🏪 Lecture CSV VISITE - PDV...')
  const content = readFileSync(join(CSV_DIR, 'VISITE - PDV.csv'), 'utf-8')
  const rows = parseCSV(content)

  // Header
  const header = rows[0]
  console.log(`   Header (${header.length} colonnes): ${header.join(' | ')}`)

  // Data rows (skip header, filter empty rows)
  const data = rows.slice(1).filter(r => r.length > 1 && r[0] && r[0].trim() !== '')
  console.log(`   ${data.length} PDV à importer`)

  // Map header indices
  const h = {}
  header.forEach((col, idx) => { h[col.trim()] = idx })

  const get = (row, colName) => {
    const idx = h[colName]
    if (idx === undefined) return ''
    return (row[idx] || '').trim()
  }

  let sql = `-- ============================================================
-- Migration Supabase - Friesland Bonnet Rouge
-- 005_seed_pdv.sql
-- Seed complet des Points de Vente depuis CSV (${data.length} PDV)
-- Généré automatiquement par scripts/generate-seed-pdv.mjs
-- ============================================================
-- ATTENTION: Ce fichier est volumineux (~${data.length} lignes)
-- Exécuter via le SQL Editor de Supabase ou psql
-- ============================================================

BEGIN;

-- Nettoyage des PDV existants (optionnel - décommenter si besoin)
-- TRUNCATE public.pdv RESTART IDENTITY CASCADE;

`

  // Process in batches of 200 for INSERT ... VALUES
  const BATCH_SIZE = 200
  let batchNum = 0
  let totalProcessed = 0
  let skipped = 0

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, Math.min(i + BATCH_SIZE, data.length))
    batchNum++

    sql += `-- ============================================================\n`
    sql += `-- BATCH ${batchNum}: PDV ${i + 1} à ${i + batch.length}\n`
    sql += `-- ============================================================\n`
    sql += `INSERT INTO public.pdv (\n`
    sql += `  pdv_id, nom_pdv, canal, categorie_pdv, sous_categorie_pdv,\n`
    sql += `  autre_sous_categorie, region, zone, secteur,\n`
    sql += `  geolocation_lat, geolocation_lng, adressage, image_url,\n`
    sql += `  date_creation, ajoute_par, jour_routing, position_routing,\n`
    sql += `  canal_routing, sales_rep_routing\n`
    sql += `) VALUES\n`

    const values = []

    for (const row of batch) {
      const pdvId = get(row, 'PDV ID')
      if (!pdvId) {
        skipped++
        continue
      }

      const nomPdv = get(row, 'Nom du PDV')
      const canal = get(row, 'Canal') || 'General trade'
      const categoriePdv = get(row, 'Catégorie de PDV') || 'Point de vente détail'
      const sousCategoriePdv = get(row, 'Sous-catégorie de PDV') || 'Boutique C'
      const autreSousCategorie = get(row, 'Autre sous-catégorie de pdv')
      const region = get(row, 'Région')
      const zone = get(row, 'Zone')
      const secteur = get(row, 'Secteur')
      const geolocation = get(row, 'Geolocation')
      const adressage = get(row, 'Adressage')
      const image = get(row, 'Image')
      const date = get(row, 'Date')
      const ajoutePar = get(row, 'Ajouté par')
      const jourRouting = get(row, 'Jour du routing')
      const positionRouting = get(row, 'Position dans le routing')
      const canalRouting = get(row, 'Canal de routing')
      const salesRepRouting = get(row, 'Sales Rep routing')

      const { lat, lng } = parseGeolocation(geolocation)
      const dateVal = parseDate(date)

      const line = `  (${sqlEscape(pdvId)}, ${sqlEscape(nomPdv || 'PDV ' + pdvId)}, ${sqlEscape(canal)}, ${sqlEscape(categoriePdv)}, ${sqlEscape(sousCategoriePdv)}, ` +
        `${sqlEscape(autreSousCategorie)}, ${sqlEscape(region)}, ${sqlEscape(zone)}, ${sqlEscape(secteur)}, ` +
        `${lat}, ${lng}, ${sqlEscape(adressage)}, ${sqlEscape(image)}, ` +
        `${dateVal}, ${sqlEscape(ajoutePar)}, ${sqlEscape(jourRouting)}, ${sqlInt(positionRouting)}, ` +
        `${sqlEscape(canalRouting)}, ${sqlEscape(salesRepRouting)})`

      values.push(line)
      totalProcessed++
    }

    if (values.length > 0) {
      sql += values.join(',\n')
      sql += `\nON CONFLICT (pdv_id) DO UPDATE SET\n`
      sql += `  nom_pdv = EXCLUDED.nom_pdv,\n`
      sql += `  canal = EXCLUDED.canal,\n`
      sql += `  categorie_pdv = EXCLUDED.categorie_pdv,\n`
      sql += `  sous_categorie_pdv = EXCLUDED.sous_categorie_pdv,\n`
      sql += `  autre_sous_categorie = EXCLUDED.autre_sous_categorie,\n`
      sql += `  region = EXCLUDED.region,\n`
      sql += `  zone = EXCLUDED.zone,\n`
      sql += `  secteur = EXCLUDED.secteur,\n`
      sql += `  geolocation_lat = EXCLUDED.geolocation_lat,\n`
      sql += `  geolocation_lng = EXCLUDED.geolocation_lng,\n`
      sql += `  adressage = EXCLUDED.adressage,\n`
      sql += `  image_url = EXCLUDED.image_url,\n`
      sql += `  date_creation = EXCLUDED.date_creation,\n`
      sql += `  ajoute_par = EXCLUDED.ajoute_par,\n`
      sql += `  jour_routing = EXCLUDED.jour_routing,\n`
      sql += `  position_routing = EXCLUDED.position_routing,\n`
      sql += `  canal_routing = EXCLUDED.canal_routing,\n`
      sql += `  sales_rep_routing = EXCLUDED.sales_rep_routing,\n`
      sql += `  updated_at = NOW();\n\n`
    }
  }

  sql += `COMMIT;

-- ============================================================
-- Vérification post-import
-- ============================================================
-- SELECT count(*) as total_pdv,
--        count(DISTINCT zone) as zones,
--        count(DISTINCT region) as regions,
--        count(DISTINCT canal) as canaux,
--        count(*) FILTER (WHERE geolocation_lat IS NOT NULL) as avec_geo
-- FROM public.pdv;
-- Attendu: ~${totalProcessed} PDV

-- Stats par zone
-- SELECT zone, count(*) as nb_pdv
-- FROM public.pdv
-- GROUP BY zone
-- ORDER BY nb_pdv DESC
-- LIMIT 20;
`

  const outputPath = join(SQL_DIR, '005_seed_pdv.sql')
  writeFileSync(outputPath, sql, 'utf-8')
  console.log(`   ✅ Écrit: ${outputPath}`)
  console.log(`   📊 ${totalProcessed} PDV générés (${skipped} lignes vides ignorées)`)

  return totalProcessed
}

// ============================================================
// MAIN
// ============================================================
console.log('🚀 Génération de la migration SQL des PDV\n')
console.log('=' .repeat(60))

const pdvCount = generatePDV()

console.log('\n' + '='.repeat(60))
console.log('✅ Génération terminée!')
console.log(`   🏪 ${pdvCount} PDV → supabase/005_seed_pdv.sql`)
console.log('\nPour appliquer:')
console.log('  psql -f supabase/005_seed_pdv.sql')
console.log('  (ou via le SQL Editor de Supabase Dashboard)')
