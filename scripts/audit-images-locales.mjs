/**
 * Audit à blanc du lot d'images local, AVANT tout upload. Lecture seule :
 * ne touche ni au bucket, ni à la base.
 *
 * Répond à trois questions :
 *   1. Combien des références AppSheet encore cassées ce lot va-t-il résoudre ?
 *   2. Quelles références resteront manquantes (→ à rechercher côté Drive) ?
 *   3. Combien de fichiers locaux ne sont référencés par rien (→ inutile de les uploader) ?
 *
 * Usage : node scripts/audit-images-locales.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readdirSync, statSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'
import {
  FOLDERS, targetKey, stemOf, fallbackKeyVisite, fallbackKeyPdv,
  buildFallbackIndex, listBucket, toCsv,
} from './lib/image-keys.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
config({ path: join(ROOT, '.env'), quiet: true })

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const SRC_ROOT = existsSync(join(ROOT, 'images-source')) ? join(ROOT, 'images-source') : join(ROOT, 'public')
const OUT = join(__dirname, 'out')
mkdirSync(OUT, { recursive: true })

const n = x => x.toLocaleString('fr-FR')
const pct = (a, b) => b ? `${(100 * a / b).toFixed(1)} %` : '—'

// ── Références encore cassées en base ────────────────────────────────────────
/** @returns Map<stem, {table, id, path}[]> */
async function refsVisites() {
  const refs = new Map()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('visites')
      .select('visite_id, image_urls').range(from, from + 999)
    if (error) throw error
    for (const row of data) {
      for (const u of row.image_urls || []) {
        if (!u || u.startsWith('http')) continue
        const s = stemOf(u)
        if (!refs.has(s)) refs.set(s, [])
        refs.get(s).push({ id: row.visite_id, path: u })
      }
    }
    if (data.length < 1000) break
  }
  return refs
}

async function refsPdv() {
  const refs = new Map()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('pdv')
      .select('pdv_id, image_url').like('image_url', 'PDV_Images/%').range(from, from + 999)
    if (error) throw error
    for (const row of data) {
      const s = stemOf(row.image_url)
      if (!refs.has(s)) refs.set(s, [])
      refs.get(s).push({ id: row.pdv_id, path: row.image_url })
    }
    if (data.length < 1000) break
  }
  return refs
}

// ── Audit d'un dossier ──────────────────────────────────────────────────────
const manquantes = []
const nonReferences = []
let totalResolues = 0

async function auditer(folder, refs, fallbackKey) {
  console.log(`\n${'━'.repeat(72)}\n📁 ${folder}\n${'━'.repeat(72)}`)

  const dir = join(SRC_ROOT, folder)
  if (!existsSync(dir)) { console.log('   (dossier absent — ignoré)'); return }

  const fichiers = readdirSync(dir).filter(f => /\.(webp|jpe?g|png)$/i.test(f))
  const vides = fichiers.filter(f => statSync(join(dir, f)).size === 0)

  // clé bucket → fichier(s) source, pour détecter les collisions
  const parCle = new Map()
  for (const f of fichiers) {
    const k = targetKey(f)
    if (!parCle.has(k)) parCle.set(k, [])
    parCle.get(k).push(f)
  }
  const collisions = [...parCle.entries()].filter(([, v]) => v.length > 1)

  const dejaBucket = await listBucket(supabase, folder)
  const disponibles = new Set([...parCle.keys(), ...dejaBucket])

  // repli sur (id, type) / (pdv_id), clés ambiguës exclues
  const { index: repli, ambigues } = buildFallbackIndex([...disponibles], fallbackKey)

  let exact = 0, parRepli = 0
  for (const [stem, cibles] of refs) {
    if (disponibles.has(`${stem}.webp`)) { exact++; continue }
    const k = fallbackKey(stem)
    if (k && repli.has(k)) { parRepli++; continue }
    for (const c of cibles) manquantes.push([folder, c.id, c.path])
  }
  const resolues = exact + parRepli
  totalResolues += resolues

  // fichiers locaux que rien ne référence
  const stemsRefs = new Set(refs.keys())
  const orphelins = [...parCle.keys()].filter(k => !stemsRefs.has(k.replace(/\.webp$/, '')))
  for (const k of orphelins) nonReferences.push([folder, parCle.get(k)[0]])

  console.log(`   fichiers locaux                  ${n(fichiers.length).padStart(8)}`)
  console.log(`   déjà dans le bucket              ${n(dejaBucket.size).padStart(8)}`)
  console.log(`   références encore cassées        ${n(refs.size).padStart(8)}`)
  console.log(`   ├─ résolues (match exact)        ${n(exact).padStart(8)}   ${pct(exact, refs.size)}`)
  console.log(`   ├─ résolues (repli id+type)      ${n(parRepli).padStart(8)}   ${pct(parRepli, refs.size)}`)
  console.log(`   └─ TOUJOURS MANQUANTES           ${n(refs.size - resolues).padStart(8)}   ${pct(refs.size - resolues, refs.size)}`)
  console.log(`   fichiers locaux non référencés   ${n(orphelins.length).padStart(8)}   (inutiles à uploader)`)
  if (vides.length) console.log(`   ⚠️  fichiers 0 octet              ${n(vides.length).padStart(8)}`)
  if (collisions.length) {
    console.log(`   ⚠️  collisions de clé             ${n(collisions.length).padStart(8)}`)
    collisions.slice(0, 3).forEach(([k, v]) => console.log(`        ${k} ← ${v.join(' + ')}`))
  }
  if (ambigues.size) console.log(`   ⚠️  clés de repli ambiguës (ignorées) ${n(ambigues.size).padStart(3)}`)
}

// ── Exécution ───────────────────────────────────────────────────────────────
console.log(`📂 Source : ${SRC_ROOT}`)
await auditer('VISITE_Images', await refsVisites(), fallbackKeyVisite)
await auditer('PDV_Images', await refsPdv(), fallbackKeyPdv)

if (manquantes.length) {
  const p = join(OUT, 'refs-manquantes.csv')
  writeFileSync(p, toCsv(['dossier', 'id', 'chemin_appsheet'], manquantes))
  console.log(`\n📄 ${n(manquantes.length)} références sans fichier → ${p}`)
}
if (nonReferences.length) {
  const p = join(OUT, 'fichiers-non-references.csv')
  writeFileSync(p, toCsv(['dossier', 'fichier'], nonReferences))
  console.log(`📄 ${n(nonReferences.length)} fichiers locaux non référencés → ${p}`)
}

console.log(`\n${'═'.repeat(72)}`)
console.log(`✅ ${n(totalResolues)} références seraient résolues par ce lot.`)
console.log(`   Lancer ensuite : node scripts/upload-images-to-storage.mjs --only-referenced`)
console.log(`${'═'.repeat(72)}`)
