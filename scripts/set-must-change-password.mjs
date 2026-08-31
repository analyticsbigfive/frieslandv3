/**
 * Pose user_metadata.must_change_password = true sur les comptes seedés
 * (merchandisers + commerciaux de zones_secteurs). Le middleware global
 * must-change-password.global.ts force alors le changement au prochain login.
 *
 * Usage :
 *   node scripts/set-must-change-password.mjs           # les 32 comptes seed
 *   node scripts/set-must-change-password.mjs --clear   # retire le flag
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
const CLEAR = process.argv.includes('--clear')
const FLAG = !CLEAR

const { data: zs, error } = await supabase
  .from('zones_secteurs')
  .select('email_merchandiser, email_sales_rep')
if (error) throw error

const emails = new Set()
for (const r of zs) {
  if (r.email_merchandiser) emails.add(r.email_merchandiser.trim().toLowerCase())
  if (r.email_sales_rep) emails.add(r.email_sales_rep.trim().toLowerCase())
}
console.log(`${emails.size} e-mails cibles — must_change_password → ${FLAG}`)

const authByEmail = new Map()
let page = 1
while (true) {
  const { data, error: e } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
  if (e) throw e
  for (const u of data.users) authByEmail.set((u.email || '').toLowerCase(), u)
  if (data.users.length < 200) break
  page++
}

let ok = 0, ko = 0
for (const email of emails) {
  const user = authByEmail.get(email)
  if (!user) { console.log(`  ⚠️ absent de auth: ${email}`); ko++; continue }
  const { error: uErr } = await supabase.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, must_change_password: FLAG },
  })
  if (uErr) { console.log(`  ❌ ${email}: ${uErr.message}`); ko++; continue }
  ok++
  await new Promise(r => setTimeout(r, 120))
}
console.log(`\n📊 ${ok} comptes mis à jour, ${ko} échecs`)
