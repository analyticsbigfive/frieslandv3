/**
 * Upload des photos AppSheet vers le bucket Supabase `visite-images`.
 * Source : images-source/{PDV_Images,VISITE_Images} si présent, sinon
 * public/{PDV_Images,VISITE_Images}.
 * - .webp uploadé tel quel (pas de ré-encodage : évite une perte de génération)
 * - .jpg/.jpeg/.png converti en WebP (sharp, q78, effort 6, max 1600px)
 * - chemin bucket = <Dossier>/<basename>.webp
 * - relançable : les objets déjà présents dans le bucket sont sautés
 *
 * Usage : node scripts/upload-images-to-storage.mjs [--only-referenced] [--force]
 *   --only-referenced  n'uploade que les fichiers réellement référencés en base
 *                      (le lot Drive contient tout l'historique AppSheet, dont
 *                       l'essentiel ne correspond à aucune ligne en base)
 *   --force            ré-uploade tout, même ce qui est déjà dans le bucket
 */
import { createClient } from '@supabase/supabase-js'
import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname, extname } from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'
import sharp from 'sharp'
import {
  BUCKET, FOLDERS, targetKey, stemOf, fallbackKeyVisite, fallbackKeyPdv,
  listBucket, pool, toCsv,
} from './lib/image-keys.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
config({ path: join(ROOT, '.env'), quiet: true })

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const FORCE = process.argv.includes('--force')
const ONLY_REF = process.argv.includes('--only-referenced')

const SRC_ROOT = existsSync(join(ROOT, 'images-source')) ? join(ROOT, 'images-source') : join(ROOT, 'public')
const OUT = join(__dirname, 'out')
console.log(`📂 Source : ${SRC_ROOT}${ONLY_REF ? '  (--only-referenced)' : ''}`)

async function toWebpBuffer(filePath) {
  const raw = readFileSync(filePath)
  if (!raw.length) throw new Error('fichier vide (0 octet)')
  if (extname(filePath).toLowerCase() === '.webp') return raw
  return sharp(raw).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78, effort: 6 }).toBuffer()
}

/**
 * Clés réellement attendues par la base, pour --only-referenced.
 * On retient le stem exact ET la clé de repli, pour ne pas priver
 * link-images-to-db.mjs de son second passage.
 */
async function clesReferencees(folder) {
  const stems = new Set(), replis = new Set()
  const fallbackKey = folder === 'PDV_Images' ? fallbackKeyPdv : fallbackKeyVisite
  const ajouter = (chemin) => {
    const s = stemOf(chemin)
    stems.add(s)
    const k = fallbackKey(s)
    if (k) replis.add(k)
  }

  if (folder === 'PDV_Images') {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('pdv')
        .select('image_url').like('image_url', 'PDV_Images/%').range(from, from + 999)
      if (error) throw error
      for (const r of data) ajouter(r.image_url)
      if (data.length < 1000) break
    }
  }
  else {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('visites')
        .select('image_urls').range(from, from + 999)
      if (error) throw error
      for (const r of data) for (const u of r.image_urls || []) {
        if (u && !u.startsWith('http')) ajouter(u)
      }
      if (data.length < 1000) break
    }
  }
  return { stems, replis, fallbackKey }
}

let uploaded = 0, skipped = 0, ignores = 0, failed = 0
const echecs = []

for (const folder of FOLDERS) {
  const dir = join(SRC_ROOT, folder)
  if (!existsSync(dir)) { console.log(`(pas de dossier ${folder}, ignoré)`); continue }

  let files = readdirSync(dir).filter(f => /\.(webp|jpe?g|png)$/i.test(f))
  const total = files.length
  const existing = FORCE ? new Set() : await listBucket(supabase, folder)

  if (ONLY_REF) {
    const { stems, replis, fallbackKey } = await clesReferencees(folder)
    files = files.filter((f) => {
      const s = targetKey(f).replace(/\.webp$/, '')
      if (stems.has(s)) return true
      const k = fallbackKey(s)
      return !!(k && replis.has(k))
    })
    ignores += total - files.length
  }

  console.log(`\n🖼  ${folder}: ${total} fichiers locaux`
    + (ONLY_REF ? `, ${files.length} référencés en base` : '')
    + `, ${existing.size} déjà dans le bucket`)

  await pool(files, 6, async (file) => {
    const target = targetKey(file)
    if (existing.has(target)) { skipped++; return }
    try {
      const buf = await toWebpBuffer(join(dir, file))
      const { error } = await supabase.storage.from(BUCKET)
        .upload(`${folder}/${target}`, buf, { contentType: 'image/webp', upsert: true })
      if (error) throw new Error(error.message)
      uploaded++
      if (uploaded % 500 === 0) console.log(`   ${uploaded} uploadés…`)
    }
    catch (e) {
      failed++
      echecs.push([folder, file, e.message])
      if (failed <= 5) console.error(`   ❌ ${folder}/${file}: ${e.message}`)
    }
  })
}

console.log(`\n📊 ${uploaded} uploadés, ${skipped} déjà présents`
  + (ONLY_REF ? `, ${ignores} non référencés ignorés` : '') + `, ${failed} échecs`)

if (echecs.length) {
  mkdirSync(OUT, { recursive: true })
  const p = join(OUT, 'upload-echecs.csv')
  writeFileSync(p, toCsv(['dossier', 'fichier', 'erreur'], echecs))
  console.log(`📄 Liste complète des échecs → ${p}`)
  process.exitCode = 2
}
