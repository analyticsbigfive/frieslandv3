/**
 * Upload des photos AppSheet vers le bucket Supabase `visite-images`.
 * Source : images-source/{PDV_Images,VISITE_Images} si présent, sinon
 * public/{PDV_Images,VISITE_Images}.
 * - .webp uploadé tel quel ; .jpg/.jpeg/.png converti en WebP (sharp, q78, max 1600px)
 * - chemin bucket = <Dossier>/<basename>.webp
 * - relançable : les objets déjà présents dans le bucket sont sautés
 *
 * Usage : node scripts/upload-images-to-storage.mjs [--force]  (--force ré-uploade tout)
 */
import { createClient } from '@supabase/supabase-js'
import { readdirSync, readFileSync, existsSync } from 'fs'
import { join, dirname, extname, basename } from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
config({ path: join(ROOT, '.env') })

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const BUCKET = 'visite-images'
const FORCE = process.argv.includes('--force')
const FOLDERS = ['PDV_Images', 'VISITE_Images']

const SRC_ROOT = existsSync(join(ROOT, 'images-source')) ? join(ROOT, 'images-source') : join(ROOT, 'public')
console.log(`📂 Source : ${SRC_ROOT}`)

// Supabase Storage refuse les clés à diacritiques ("visibilité") : on les
// retire du nom cible. Le script link-images-to-db.mjs applique la même règle.
const sanitizeKey = name => name.normalize('NFD').replace(/[̀-ͯ]/g, '')

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

async function toWebpBuffer(filePath) {
  const ext = extname(filePath).toLowerCase()
  const raw = readFileSync(filePath)
  if (ext === '.webp') return raw
  // Conversion pour les futurs dépôts en jpg/png
  return sharp(raw).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78 }).toBuffer()
}

let uploaded = 0, skipped = 0, failed = 0

for (const folder of FOLDERS) {
  const dir = join(SRC_ROOT, folder)
  if (!existsSync(dir)) { console.log(`(pas de dossier ${folder}, ignoré)`); continue }

  const files = readdirSync(dir).filter(f => /\.(webp|jpe?g|png)$/i.test(f))
  const existing = FORCE ? new Set() : await listBucket(folder)
  console.log(`\n🖼  ${folder}: ${files.length} fichiers locaux, ${existing.size} déjà dans le bucket`)

  let idx = 0
  async function worker() {
    while (idx < files.length) {
      const file = files[idx++]
      const target = sanitizeKey(basename(file, extname(file))) + '.webp'
      if (existing.has(target)) { skipped++; continue }
      try {
        const buf = await toWebpBuffer(join(dir, file))
        const { error } = await supabase.storage.from(BUCKET)
          .upload(`${folder}/${target}`, buf, { contentType: 'image/webp', upsert: true })
        if (error) throw new Error(error.message)
        uploaded++
        if (uploaded % 200 === 0) console.log(`   ${uploaded} uploadés…`)
      }
      catch (e) {
        failed++
        if (failed <= 5) console.error(`   ❌ ${folder}/${file}: ${e.message}`)
      }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
}

console.log(`\n📊 ${uploaded} uploadés, ${skipped} déjà présents, ${failed} échecs`)
if (failed) process.exitCode = 2
