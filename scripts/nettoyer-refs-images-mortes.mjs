/**
 * Nettoie les références d'images définitivement irrécupérables, après le passage
 * de link-images-to-db.mjs.
 *
 * 1. visites.image_urls : entrées pointant vers VISITE_Files_/ — dossier jamais
 *    uploadé, et dont les fichiers sources AppSheet font 0 octet.
 * 2. pdv.image_url : valeurs qui ne sont pas un chemin mais un message d'erreur
 *    AppSheet ("Unable to load image data…").
 *
 * Les valeurs supprimées sont archivées dans scripts/out/refs-mortes-supprimees.csv.
 *
 * Usage : node scripts/nettoyer-refs-images-mortes.mjs [--apply]
 *         (sans --apply : simulation, aucune écriture)
 */
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'
import { pool, toCsv } from './lib/image-keys.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env'), quiet: true })

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const APPLY = process.argv.includes('--apply')
console.log(APPLY ? '⚠️  Mode --apply : écriture en base.\n' : '🔍 Simulation (ajouter --apply pour écrire).\n')

const supprimees = []
/** Une référence est morte si ce n'est ni une URL, ni un chemin des dossiers uploadés. */
const estMorte = u => typeof u === 'string' && u.length > 0
  && !u.startsWith('http')
  && !u.startsWith('VISITE_Images/') && !u.startsWith('PDV_Images/')

// ── 1. visites.image_urls ────────────────────────────────────────────────────
const visites = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase.from('visites')
    .select('visite_id, image_urls').range(from, from + 999)
  if (error) throw error
  for (const r of data) if ((r.image_urls || []).some(estMorte)) visites.push(r)
  if (data.length < 1000) break
}
console.log(`visites concernées : ${visites.length}`)

let vOk = 0
await pool(visites, 8, async (row) => {
  const restantes = (row.image_urls || []).filter(u => !estMorte(u))
  for (const u of row.image_urls || []) if (estMorte(u)) supprimees.push(['visites', row.visite_id, u])
  if (!APPLY) { vOk++; return }
  const { error } = await supabase.from('visites')
    .update({ image_urls: restantes }).eq('visite_id', row.visite_id)
  if (error) { console.error(`  ❌ visite ${row.visite_id}: ${error.message}`); return }
  vOk++
})
console.log(`✅ visites nettoyées : ${vOk}\n`)

// ── 2. pdv.image_url ─────────────────────────────────────────────────────────
const pdvs = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase.from('pdv')
    .select('pdv_id, image_url').not('image_url', 'is', null).range(from, from + 999)
  if (error) throw error
  for (const r of data) if (estMorte(r.image_url)) pdvs.push(r)
  if (data.length < 1000) break
}
console.log(`PDV concernés : ${pdvs.length}`)
pdvs.slice(0, 5).forEach(r => console.log(`   ${r.pdv_id} → ${r.image_url.slice(0, 70)}…`))

let pOk = 0
await pool(pdvs, 8, async (row) => {
  supprimees.push(['pdv', row.pdv_id, row.image_url])
  if (!APPLY) { pOk++; return }
  const { error } = await supabase.from('pdv').update({ image_url: null }).eq('pdv_id', row.pdv_id)
  if (error) { console.error(`  ❌ pdv ${row.pdv_id}: ${error.message}`); return }
  pOk++
})
console.log(`✅ PDV nettoyés : ${pOk}`)

if (supprimees.length) {
  const OUT = join(__dirname, 'out')
  mkdirSync(OUT, { recursive: true })
  const p = join(OUT, 'refs-mortes-supprimees.csv')
  writeFileSync(p, toCsv(['table', 'id', 'valeur_supprimee'], supprimees))
  console.log(`\n📄 ${supprimees.length} valeurs archivées → ${p}`)
}
