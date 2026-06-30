// Probe ciblé : vérifie les OBJETS des migrations récentes (019/022/023),
// pas seulement l'existence des tables. Read-only via PostgREST (service role).
// Usage: node scripts/probe-migrations.mjs
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config()

const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
if (!URL || !KEY) { console.error('❌ SUPABASE_URL + clé requis'); process.exit(1) }
const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const results = []
const check = async (label, fn) => {
  try { results.push([label, await fn()]) }
  catch (e) { results.push([label, `ERR ${String(e).slice(0, 60)}`]) }
}

// ⚠️ NE PAS utiliser { head: true } chaîné avec .limit() : combo qui avale
// silencieusement les erreurs PostgREST (faux positifs "existe" constatés en
// prod le 2026-06-30). Toujours un select non-head pour la fiabilité.

// helper: column exists? (select that column; PostgREST errors if absent)
const colExists = async (table, col) => {
  const { error } = await sb.from(table).select(col).limit(1)
  if (!error) return '✅ présente'
  if (/column .* does not exist|could not find/i.test(error.message)) return '❌ ABSENTE'
  return `? ${error.message.slice(0, 40)}`
}
const rowCount = async (table, filterCol, filterVals) => {
  let q = sb.from(table).select('*', { count: 'exact' }).limit(1)
  if (filterCol) q = q.in(filterCol, filterVals)
  const { count, error } = await q
  if (error) return `ERR ${error.message.slice(0, 40)}`
  return count
}
const tableExists = async (table) => {
  const { error } = await sb.from(table).select('*').limit(1)
  if (!error) return '✅ existe'
  if (/does not exist|find the table|schema cache/i.test(error.message)) return '❌ ABSENTE'
  return `? ${error.message.slice(0, 40)}`
}

// 023 — canal sur pos_types + table category_weights
await check('023 pos_types.canal', () => colExists('pos_types', 'canal'))
await check('023 category_weights (table)', () => tableExists('category_weights'))

// 022 — visibilité (3 groupes) + poids OSA MT
await check('022 visibility_standards [B/MM/K]', () =>
  rowCount('visibility_standards', 'standard_group', ['BOUTIQUE', 'MINI MARKET', 'KIOSQUE']))
await check('022 availability_weights MT', () =>
  rowCount('availability_weights', 'trade_type', ['MT']))

console.log('\n══ Probe migrations récentes ══')
for (const [l, v] of results) console.log(`  ${String(v).padEnd(14)} ${l}`)
