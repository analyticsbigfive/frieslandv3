/**
 * Réécrit les références d'images AppSheet (chemins relatifs) vers les URLs
 * publiques du bucket `visite-images`, pour les fichiers réellement uploadés.
 * - pdv.image_url        : PDV_Images/<pdv_id>.Image.*        → URL publique .webp
 * - visites.image_urls[] : VISITE_Images/<visite_id>.<type>.* → URL publique .webp
 * - visites.data (JSON)  : visibilite.interieure.photo_visibilite et
 *                          visibilite.exterieure.photo_branding, copies AppSheet des
 *                          mêmes chemins → même URL ; chemin irrécupérable
 *                          (VISITE_Files_/…, jamais uploadé) → null, archivé dans out/.
 *
 * Matching : stem exact (nom sans extension, sans diacritiques). En cas d'échec,
 * repli sur (visite_id, type) / (pdv_id) — uniquement si la clé résout vers un
 * fichier unique, jamais en cas d'ambiguïté.
 *
 * Relançable : les valeurs déjà en https:// sont conservées ; les références sans
 * fichier uploadé restent inchangées et sont listées dans scripts/out/.
 *
 * Usage : node scripts/link-images-to-db.mjs [--dry-run]
 */
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'
import {
  stemOf, fallbackKeyVisite, fallbackKeyPdv, buildFallbackIndex,
  listBucket, publicUrl, pool, toCsv,
} from './lib/image-keys.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env'), quiet: true })

const SUPABASE_URL = process.env.SUPABASE_URL
const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const DRY = process.argv.includes('--dry-run')
const OUT = join(__dirname, 'out')
if (DRY) console.log('🔍 Mode --dry-run : aucune écriture en base.\n')

const nonResolues = []
const jsonNettoyes = []

/** Champs de visites.data qui dupliquent une photo de image_urls. */
const CHAMPS_JSON = [
  ['visibilite', 'interieure', 'photo_visibilite'],
  ['visibilite', 'exterieure', 'photo_branding'],
]
/** Chemin ni URL, ni dans un dossier uploadé : rien ne pourra le résoudre. */
const estIrrecuperable = u => !u.startsWith('VISITE_Images/') && !u.startsWith('PDV_Images/')

/** Résolveur pour un dossier : stem exact, puis repli désambiguïsé. */
async function resolveur(folder, fallbackKey) {
  const fichiers = await listBucket(supabase, folder)
  const exact = new Map([...fichiers].map(f => [f.replace(/\.webp$/, ''), f]))
  const { index: repli, ambigues } = buildFallbackIndex([...fichiers], fallbackKey)
  console.log(`${folder} dans le bucket : ${fichiers.size} fichiers`
    + (ambigues.size ? ` (${ambigues.size} clés de repli ambiguës, ignorées)` : ''))

  let viaRepli = 0
  const resoudre = (chemin) => {
    const s = stemOf(chemin)
    const direct = exact.get(s)
    if (direct) return publicUrl(SUPABASE_URL, `${folder}/${direct}`)
    const k = fallbackKey(s)
    const secours = k && repli.get(k)
    if (!secours) return null
    viaRepli++
    return publicUrl(SUPABASE_URL, `${folder}/${secours}`)
  }
  return { resoudre, stats: () => viaRepli }
}

// ── 1. PDV ───────────────────────────────────────────────────────────────────
{
  const { resoudre, stats } = await resolveur('PDV_Images', fallbackKeyPdv)

  const aTraiter = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('pdv')
      .select('pdv_id, image_url').like('image_url', 'PDV_Images/%').range(from, from + 999)
    if (error) throw error
    aTraiter.push(...data)
    if (data.length < 1000) break
  }

  let ok = 0, ko = 0
  await pool(aTraiter, 8, async (row) => {
    const url = resoudre(row.image_url)
    if (!url) { ko++; nonResolues.push(['pdv', row.pdv_id, row.image_url]); return }
    if (DRY) { ok++; return }
    const { error } = await supabase.from('pdv').update({ image_url: url }).eq('pdv_id', row.pdv_id)
    if (error) { console.error(`  ❌ pdv ${row.pdv_id}: ${error.message}`); ko++; return }
    ok++
    if (ok % 2000 === 0) console.log(`   ${ok} PDV réécrits…`)
  })
  console.log(`✅ pdv.image_url réécrits : ${ok} (dont ${stats()} par repli), ${ko} non résolus\n`)
}

// ── 2. Visites ───────────────────────────────────────────────────────────────
{
  const { resoudre, stats } = await resolveur('VISITE_Images', fallbackKeyVisite)

  const aTraiter = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('visites')
      .select('visite_id, image_urls, data').range(from, from + 999)
    if (error) throw error
    for (const r of data) {
      const tableauRelatif = (r.image_urls || []).some(u => u && !u.startsWith('http'))
      const jsonRelatif = CHAMPS_JSON.some(([a, b, c]) => {
        const v = r.data?.[a]?.[b]?.[c]
        return typeof v === 'string' && v && !v.startsWith('http')
      })
      if (tableauRelatif || jsonRelatif) aTraiter.push(r)
    }
    if (data.length < 1000) break
  }
  console.log(`visites avec au moins une référence relative : ${aTraiter.length}`)

  let ok = 0, ko = 0, jsonOk = 0
  await pool(aTraiter, 8, async (row) => {
    let change = false
    const suivant = (row.image_urls || []).map((u) => {
      if (!u || u.startsWith('https://')) return u
      const url = resoudre(u)
      if (!url) { ko++; nonResolues.push(['visites', row.visite_id, u]); return u }
      change = true
      return url
    })

    // Copies JSON : même résolution ; on ne touche qu'aux chaînes relatives.
    let data = row.data
    for (const [a, b, c] of CHAMPS_JSON) {
      const v = data?.[a]?.[b]?.[c]
      if (typeof v !== 'string' || !v || v.startsWith('http')) continue
      let nouvelle
      if (estIrrecuperable(v)) { nouvelle = null; jsonNettoyes.push(['visites', row.visite_id, `data.${a}.${b}.${c}`, v]) }
      else {
        nouvelle = resoudre(v)
        if (!nouvelle) { ko++; nonResolues.push(['visites', row.visite_id, `data.${a}.${b}.${c}: ${v}`]); continue }
      }
      // copie superficielle par niveau : on ne mute pas la ligne lue
      data = { ...data, [a]: { ...data[a], [b]: { ...data[a][b], [c]: nouvelle } } }
      change = true
      jsonOk++
    }

    if (!change || DRY) { if (change) ok++; return }
    const patch = { image_urls: suivant }
    if (data !== row.data) patch.data = data
    const { error } = await supabase.from('visites')
      .update(patch).eq('visite_id', row.visite_id)
    if (error) { console.error(`  ❌ visite ${row.visite_id}: ${error.message}`); return }
    ok++
    if (ok % 1000 === 0) console.log(`   ${ok} visites réécrites…`)
  })
  console.log(`✅ visites réécrites : ${ok} (dont ${stats()} par repli), ${jsonOk} champs data.*.photo_* alignés, ${ko} références non résolues`)
}

if (jsonNettoyes.length) {
  mkdirSync(OUT, { recursive: true })
  const p = join(OUT, 'json-photos-irrecuperables.csv')
  writeFileSync(p, toCsv(['table', 'id', 'champ', 'valeur_remplacee_par_null'], jsonNettoyes))
  console.log(`\n📄 ${jsonNettoyes.length} champs JSON irrécupérables mis à null → ${p}`)
}

if (nonResolues.length) {
  mkdirSync(OUT, { recursive: true })
  const p = join(OUT, 'refs-non-resolues.csv')
  writeFileSync(p, toCsv(['table', 'id', 'chemin_appsheet'], nonResolues))
  console.log(`\n📄 ${nonResolues.length} références sans fichier correspondant → ${p}`)
}
