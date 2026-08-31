/**
 * Uniformise le mot de passe des comptes issus de zones_secteurs
 * (merchandisers + commerciaux) avec SEED_DEFAULT_PASSWORD.
 * Ne touche PAS aux autres comptes (admin, merchandiser Treichville…).
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
if (!PASSWORD) { console.error('SEED_DEFAULT_PASSWORD manquant'); process.exit(1) }

const { data: zs, error } = await supabase
  .from('zones_secteurs')
  .select('email_merchandiser, email_sales_rep')
if (error) throw error

const emails = new Set()
for (const r of zs) {
  if (r.email_merchandiser) emails.add(r.email_merchandiser.trim().toLowerCase())
  if (r.email_sales_rep) emails.add(r.email_sales_rep.trim().toLowerCase())
}
console.log(`${emails.size} e-mails cibles`)

const authByEmail = new Map()
let page = 1
while (true) {
  const { data, error: e } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
  if (e) throw e
  for (const u of data.users) authByEmail.set((u.email || '').toLowerCase(), u.id)
  if (data.users.length < 200) break
  page++
}

let ok = 0, ko = 0
for (const email of emails) {
  const uid = authByEmail.get(email)
  if (!uid) { console.log(`  ⚠️ absent de auth: ${email}`); ko++; continue }
  const { error: uErr } = await supabase.auth.admin.updateUserById(uid, { password: PASSWORD })
  if (uErr) { console.log(`  ❌ ${email}: ${uErr.message}`); ko++; continue }
  ok++
  await new Promise(r => setTimeout(r, 150))
}
console.log(`\n📊 ${ok} mots de passe uniformisés, ${ko} échecs`)
