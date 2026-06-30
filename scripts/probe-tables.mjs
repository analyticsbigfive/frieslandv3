// Probe read-only : quelles tables existent réellement dans la base live.
// Usage: node scripts/probe-tables.mjs
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config()

const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
if (!URL || !KEY) { console.error('❌ SUPABASE_URL + clé requis dans .env'); process.exit(1) }

const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const tables = [
  // perfect store (013_016)
  'perfect_store_score_config', 'perfect_store_tier_config',
  'availability_weights', 'availability_standards', 'visibility_standards',
  // referentiels (020/021 = vides)
  'distributeurs', 'geo_divisions', 'geo_sub_regions', 'geo_territories', 'geo_areas', 'pos_types',
  // transactionnel old
  'pdv', 'visites', 'profiles',
  // nouveau/
  'distributeur', 'territoire', 'territoire_distributeur', 'categorie_pdv', 'type_pdv',
  'point_de_vente', 'visite', 'poids_reference', 'seuil_disponibilite',
  'element_visibilite', 'standard_visibilite', 'reference_produit',
]

// ⚠️ NE PAS chaîner { head: true } avec .limit() : avale silencieusement les
// erreurs PostgREST (faux positifs "existe" constatés en prod le 2026-06-30).
const exists = [], missing = []
for (const t of tables) {
  const { error } = await sb.from(t).select('*').limit(1)
  if (error && /does not exist|find the table|schema cache/i.test(error.message)) missing.push(t)
  else if (error) exists.push(`${t} (?: ${error.message.slice(0, 40)})`)
  else exists.push(t)
}
console.log('✅ EXISTENT:\n  ' + (exists.join('\n  ') || '(aucune)'))
console.log('\n❌ ABSENTES:\n  ' + (missing.join('\n  ') || '(aucune)'))
