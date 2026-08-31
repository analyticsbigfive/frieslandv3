/**
 * Assigne aux utilisateurs leurs zones et secteurs depuis le référentiel
 * zones_secteurs (source de vérité : VisiteAfter - ZONE SECTEUR.csv).
 * Pour chaque e-mail (merchandiser OU sales rep, fusionnés) :
 *   - territoires_assignes = zones distinctes
 *   - zone_assignee        = première zone
 *   - quartiers_assignes   = secteurs distincts
 *   - region               = première région
 * Les profils absents du référentiel (admin, comptes de test) ne sont pas touchés.
 *
 * Usage : node scripts/assign-zones-to-users.mjs [--dry-run]
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
const DRY_RUN = process.argv.includes('--dry-run')

const { data: zs, error } = await supabase
  .from('zones_secteurs')
  .select('zone, secteur, region, email_merchandiser, email_sales_rep')
  .order('id')
if (error) throw error

// Groupe par e-mail : union des lignes merchandiser et sales rep
const byEmail = new Map()
function feed(email, row) {
  const key = (email || '').trim().toLowerCase()
  if (!key) return
  if (!byEmail.has(key)) byEmail.set(key, { zones: [], secteurs: [], region: null })
  const g = byEmail.get(key)
  if (row.zone && !g.zones.includes(row.zone)) g.zones.push(row.zone)
  if (row.secteur && !g.secteurs.includes(row.secteur)) g.secteurs.push(row.secteur)
  if (!g.region && row.region) g.region = row.region
}
for (const row of zs) {
  feed(row.email_merchandiser, row)
  feed(row.email_sales_rep, row)
}
console.log(`${byEmail.size} e-mails dans le référentiel`)

const { data: profiles, error: pErr } = await supabase
  .from('profiles')
  .select('id, email, nom, role')
if (pErr) throw pErr

let updated = 0, skipped = 0, failed = 0
for (const p of profiles) {
  const g = byEmail.get((p.email || '').toLowerCase())
  if (!g) { skipped++; continue }
  console.log(`  ${p.email.padEnd(40)} ${String(g.zones.length).padStart(2)} zone(s) [${g.zones.join(', ')}] · ${g.secteurs.length} secteur(s)`)
  if (DRY_RUN) { updated++; continue }
  const { error: uErr } = await supabase.from('profiles').update({
    territoires_assignes: g.zones,
    zone_assignee: g.zones[0] || null,
    quartiers_assignes: g.secteurs,
    region: g.region,
  }).eq('id', p.id)
  if (uErr) { console.error(`  ❌ ${p.email}: ${uErr.message}`); failed++; continue }
  updated++
}

console.log(`\n📊 ${updated} profils ${DRY_RUN ? 'à mettre à jour (dry-run)' : 'mis à jour'}, ${skipped} hors référentiel (intacts), ${failed} échecs`)
