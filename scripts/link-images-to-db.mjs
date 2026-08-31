/**
 * Réécrit les références d'images AppSheet (chemins relatifs .jpg) vers les
 * URLs publiques du bucket `visite-images`, pour les fichiers réellement uploadés.
 * - pdv.image_url        : PDV_Images/<pdv_id>.Image.*.jpg      → URL publique .webp
 * - visites.image_urls[] : VISITE_Images/<visite_id>.<type>.jpg → URL publique .webp
 * Relançable : les valeurs déjà en https:// sont conservées ; les références
 * sans fichier uploadé restent inchangées (prochaine passe possible).
 *
 * Usage : node scripts/link-images-to-db.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env') })

const SUPABASE_URL = process.env.SUPABASE_URL
const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const BUCKET = 'visite-images'
const publicUrl = path => `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(path).replace(/%2F/g, '/')}`

async function listBucket(prefix) {
  const names = new Set()
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000, offset })
    if (error) throw new Error(`list ${prefix}: ${error.message}`)
    for (const o of data) names.add(o.name)
    if (data.length < 1000) break
  }
  return names
}

// basename sans extension d'un chemin AppSheet ("PDV_Images/x.Image.084735.jpg" → "x.Image.084735"),
// normalisé sans diacritiques comme les clés du bucket (cf. upload-images-to-storage.mjs)
const stem = p => (p.split('/').pop() || '').replace(/\.[^.]+$/, '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')

// ── 1. PDV ───────────────────────────────────────────────────
const pdvFiles = await listBucket('PDV_Images')
const pdvStems = new Map([...pdvFiles].map(f => [f.replace(/\.webp$/, ''), f]))
console.log(`PDV_Images dans le bucket : ${pdvFiles.size}`)

let pdvUpdated = 0
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase.from('pdv')
    .select('pdv_id, image_url')
    .like('image_url', 'PDV_Images/%')
    .range(from, from + 999)
  if (error) throw error
  for (const row of data) {
    const file = pdvStems.get(stem(row.image_url))
    if (!file) continue
    const { error: uErr } = await supabase.from('pdv')
      .update({ image_url: publicUrl(`PDV_Images/${file}`) })
      .eq('pdv_id', row.pdv_id)
    if (uErr) { console.error(`  ❌ pdv ${row.pdv_id}: ${uErr.message}`); continue }
    pdvUpdated++
  }
  if (data.length < 1000) break
}
console.log(`✅ pdv.image_url réécrits : ${pdvUpdated}`)

// ── 2. Visites ───────────────────────────────────────────────
const visFiles = await listBucket('VISITE_Images')
const visStems = new Map([...visFiles].map(f => [f.replace(/\.webp$/, ''), f]))
console.log(`VISITE_Images dans le bucket : ${visFiles.size}`)

// visite_id = partie avant le premier point du nom de fichier
const visiteIds = [...new Set([...visFiles].map(f => f.split('.')[0]))]
let visUpdated = 0
for (let i = 0; i < visiteIds.length; i += 100) {
  const batch = visiteIds.slice(i, i + 100)
  const { data, error } = await supabase.from('visites')
    .select('visite_id, image_urls')
    .in('visite_id', batch)
  if (error) throw error
  for (const row of data) {
    const urls = Array.isArray(row.image_urls) ? row.image_urls : []
    let changed = false
    const next = urls.map((u) => {
      if (!u || u.startsWith('https://')) return u
      const file = visStems.get(stem(u))
      if (!file) return u
      changed = true
      return publicUrl(`VISITE_Images/${file}`)
    })
    if (!changed) continue
    const { error: uErr } = await supabase.from('visites')
      .update({ image_urls: next })
      .eq('visite_id', row.visite_id)
    if (uErr) { console.error(`  ❌ visite ${row.visite_id}: ${uErr.message}`); continue }
    visUpdated++
  }
}
console.log(`✅ visites.image_urls réécrits : ${visUpdated}`)
