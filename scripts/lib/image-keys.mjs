/**
 * Règles partagées de nommage des images AppSheet → bucket Supabase.
 *
 * Ces règles sont utilisées par audit-images-locales.mjs, upload-images-to-storage.mjs
 * et link-images-to-db.mjs. Elles DOIVENT rester identiques dans les trois : toute
 * divergence casse silencieusement la correspondance fichier ↔ référence en base.
 *
 * Convention AppSheet : <Dossier>/<entity_id>.<type>.<HHMMSS>.<ext>
 *   PDV_Images/e78fb6b4.Image.084735.jpg
 *   VISITE_Images/3eef305c.Photo visibilité intérieure.135241.jpg
 *
 * L'extension source est sans effet : seul le « stem » (nom sans extension, sans
 * diacritiques) sert de clé. Un .webp et un .jpg de même nom donnent la même clé.
 */
import { basename, extname } from 'path'

export const BUCKET = 'visite-images'
export const FOLDERS = ['PDV_Images', 'VISITE_Images']

/** Supabase Storage refuse les clés à diacritiques ("visibilité") : on les retire. */
export const sanitizeKey = name => name.normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Nom de fichier local → clé stockée dans le bucket (toujours .webp). */
export const targetKey = file => sanitizeKey(basename(file, extname(file))) + '.webp'

/** Chemin AppSheet en base → stem normalisé, comparable à une clé bucket sans .webp. */
export const stemOf = path => sanitizeKey((path.split('/').pop() || '').replace(/\.[^.]+$/, ''))

/**
 * Clés de repli, utilisées quand le match exact échoue (dérive d'horodatage entre
 * l'export AppSheet et le chemin enregistré en base). Ne sont appliquées que si
 * elles résolvent vers un fichier unique — voir buildFallbackIndex.
 */
export const fallbackKeyVisite = stem => {
  const [id, type] = stem.split('.')
  return id && type ? `${id}.${type}` : null
}
export const fallbackKeyPdv = stem => stem.split('.')[0] || null

/**
 * Index de repli clé → nom de fichier, avec les clés ambiguës (≥ 2 fichiers)
 * volontairement retirées : on ne devine jamais.
 */
export function buildFallbackIndex(fileNames, keyFn) {
  const index = new Map()
  const ambigues = new Set()
  for (const name of fileNames) {
    const key = keyFn(name.replace(/\.webp$/, ''))
    if (!key) continue
    if (index.has(key)) { ambigues.add(key); continue }
    index.set(key, name)
  }
  for (const key of ambigues) index.delete(key)
  return { index, ambigues }
}

export const publicUrl = (supabaseUrl, path) =>
  `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(path).replace(/%2F/g, '/')}`

/** Liste exhaustive des objets d'un préfixe du bucket (pagination 1000). */
export async function listBucket(supabase, prefix) {
  const names = new Set()
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000, offset })
    if (error) throw new Error(`list ${prefix}: ${error.message}`)
    for (const o of data) names.add(o.name)
    if (data.length < 1000) break
  }
  return names
}

/** Pool de workers simple, repris de upload-images-to-storage.mjs. */
export async function pool(items, concurrency, worker) {
  let idx = 0
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (idx < items.length) {
      const i = idx++
      await worker(items[i], i)
    }
  }))
}

/** Écrit un CSV simple (échappement des guillemets et des séparateurs). */
export function toCsv(header, rows) {
  const esc = v => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [header.join(','), ...rows.map(r => r.map(esc).join(','))].join('\n') + '\n'
}
