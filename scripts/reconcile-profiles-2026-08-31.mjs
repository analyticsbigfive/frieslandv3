/**
 * Réconciliation profils ↔ auth.users (31/08/2026).
 * Certains comptes auth existent (seed précédent) mais n'ont plus de ligne
 * dans profiles. On recrée les profils manquants d'après zones_secteurs,
 * et on retente la création des comptes auth manquants.
 * Ne touche jamais aux mots de passe des comptes existants.
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env') })

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const PASSWORD = process.env.SEED_DEFAULT_PASSWORD

// Même logique de déduplication que create-users-from-zones.mjs
const { data: zs, error: zErr } = await supabase
  .from('zones_secteurs')
  .select('zone, merchandiser, email_merchandiser, sales_rep, email_sales_rep, region')
if (zErr) throw zErr

const expected = new Map()
for (const row of zs) {
  if (row.email_merchandiser && row.merchandiser) {
    const email = row.email_merchandiser.trim().toLowerCase()
    if (!expected.has(email)) expected.set(email, { email, nom: row.merchandiser.trim(), role: 'merchandiser', zone_assignee: row.zone, region: row.region })
  }
  if (row.email_sales_rep && row.sales_rep) {
    const email = row.email_sales_rep.trim().toLowerCase()
    if (!expected.has(email)) expected.set(email, { email, nom: row.sales_rep.trim(), role: 'commercial', zone_assignee: row.zone, region: row.region })
  }
}
console.log(`${expected.size} utilisateurs attendus`)

// Tous les comptes auth existants
const authByEmail = new Map()
let page = 1
while (true) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
  if (error) throw error
  for (const u of data.users) authByEmail.set((u.email || '').toLowerCase(), u.id)
  if (data.users.length < 200) break
  page++
}
console.log(`${authByEmail.size} comptes auth existants`)

let profilsUpserts = 0, comptesCrees = 0, echecs = 0
for (const u of expected.values()) {
  let uid = authByEmail.get(u.email)
  if (!uid) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email, password: PASSWORD, email_confirm: true,
      user_metadata: { nom: u.nom, role: u.role },
    })
    if (error) { console.log(`  ❌ createUser ${u.email}: ${error.message || JSON.stringify(error)}`); echecs++; continue }
    uid = data.user.id
    comptesCrees++
    await new Promise(r => setTimeout(r, 300))
  }
  const { error: pErr } = await supabase.from('profiles').upsert({
    id: uid, email: u.email, nom: u.nom, role: u.role,
    zone_assignee: u.zone_assignee, region: u.region, is_active: true,
  }, { onConflict: 'id' })
  if (pErr) { console.log(`  ❌ profile ${u.email}: ${pErr.message}`); echecs++; continue }
  profilsUpserts++
}

console.log(`\n📊 ${comptesCrees} comptes auth créés, ${profilsUpserts} profils upsertés, ${echecs} échecs`)
const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true })
console.log(`profiles total: ${count}`)
