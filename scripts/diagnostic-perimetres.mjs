#!/usr/bin/env node
/**
 * Diagnostic des périmètres terrain : détecte les PDV que personne ne peut voir
 * et les agents qui ne voient aucun PDV.
 *
 *   1. PDV actifs sans zone → invisibles de tout commercial/merchandiser
 *      (le scoping filtre sur pdv.zone). Export CSV pour rattachement terrain,
 *      avec le territoire candidat quand un agent les a déjà visités.
 *   2. Territoires assignés à un agent mais sans aucun PDV en base → l'agent
 *      ouvre l'application sur une liste vide.
 *
 * Lecture seule. Usage : node scripts/diagnostic-perimetres.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { writeFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env') })

const OUT_CSV = join(process.env.HOME, 'Downloads', 'pdv-sans-zone.csv')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const norm = (v) =>
  String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase()

// Toutes les lignes d'une table paginée (PostgREST plafonne à 1000).
async function fetchAll(table, columns, tune = (q) => q) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await tune(supabase.from(table).select(columns)).range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data?.length) break
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

const pdvs = await fetchAll('pdv', 'pdv_id,nom_pdv,zone,quartier,adressage,canal', q => q.eq('is_active', true))
const profils = await fetchAll('profiles', 'id,email,nom,role,territoires_assignes,zone_assignee,is_active')

// ── 1. PDV sans zone ────────────────────────────────────────────────────────
const orphelins = pdvs.filter(p => !p.zone)
const pdvParZone = new Map()
for (const p of pdvs) if (p.zone) pdvParZone.set(norm(p.zone), (pdvParZone.get(norm(p.zone)) || 0) + 1)

// Territoire candidat : agents ayant déjà visité le PDV. Retenu seulement si
// tous convergent vers un territoire unique — sinon la colonne reste vide.
const profParEmail = new Map(profils.map(p => [String(p.email || '').toLowerCase(), p]))
const profParId = new Map(profils.map(p => [p.id, p]))
const candidats = new Map()
const ids = orphelins.map(p => p.pdv_id)
for (let i = 0; i < ids.length; i += 200) {
  const { data, error } = await supabase.from('visites').select('pdv_id,email,user_id').in('pdv_id', ids.slice(i, i + 200))
  if (error) throw new Error(`visites: ${error.message}`)
  for (const v of data || []) {
    const prof = profParEmail.get(String(v.email || '').toLowerCase()) || profParId.get(v.user_id)
    const terrs = (prof?.territoires_assignes || []).filter(Boolean)
    if (!terrs.length) continue
    if (!candidats.has(v.pdv_id)) candidats.set(v.pdv_id, { terrs: new Set(), agents: new Set() })
    const c = candidats.get(v.pdv_id)
    terrs.forEach(t => c.terrs.add(norm(t)))
    c.agents.add(prof.nom || prof.email)
  }
}
// Libellé terrain le plus fréquent pour un territoire donné (ex. "PORT-BOUET")
const libelleFrequent = new Map()
for (const p of pdvs) {
  if (!p.zone) continue
  const k = norm(p.zone)
  const cur = libelleFrequent.get(k)
  const n = pdvParZone.get(k)
  if (!cur || cur.n < n) libelleFrequent.set(k, { label: p.zone, n })
}

const esc = (v) => (/[",\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''))
const rows = orphelins.map((p) => {
  const c = candidats.get(p.pdv_id)
  const unique = c && c.terrs.size === 1 ? [...c.terrs][0] : null
  return {
    pdv_id: p.pdv_id,
    nom_pdv: p.nom_pdv || '',
    canal: p.canal || '',
    adressage: p.adressage || '',
    zone_a_renseigner: '',
    territoire_candidat: unique ? (libelleFrequent.get(unique)?.label || unique) : '',
    agents_ayant_visite: c ? [...c.agents].join(' / ') : '',
  }
})
const header = Object.keys(rows[0] || { pdv_id: '' })
writeFileSync(OUT_CSV, [header.join(','), ...rows.map(r => header.map(h => esc(r[h])).join(','))].join('\n') + '\n', 'utf8')

console.log('══ 1. PDV sans territoire (invisibles du terrain) ══')
console.log(`  ${orphelins.length} PDV actifs sur ${pdvs.length}`)
console.log(`  dont ${rows.filter(r => r.territoire_candidat).length} avec un territoire candidat déduit des visites`)
console.log(`  → ${OUT_CSV}`)
console.log('  Dans l\'app : /admin/pdv, filtre Territoire = « — Sans territoire — »')

// ── 2. Territoires assignés sans aucun PDV ──────────────────────────────────
console.log('\n══ 2. Agents dont le périmètre ne contient aucun PDV ══')
const terrain = profils.filter(p => p.is_active !== false && (p.role === 'commercial' || p.role === 'merchandiser'))
let alertes = 0
for (const p of terrain) {
  const terrs = (p.territoires_assignes || []).filter(Boolean)
  const effectifs = terrs.length ? terrs : (p.zone_assignee ? [p.zone_assignee] : [])
  if (!effectifs.length) {
    console.log(`  ⚠ ${p.nom || p.email} (${p.role}) : aucun territoire assigné`)
    alertes++
    continue
  }
  const total = effectifs.reduce((n, t) => n + (pdvParZone.get(norm(t)) || 0), 0)
  if (total === 0) {
    console.log(`  ⚠ ${p.nom || p.email} (${p.role}) : 0 PDV — territoires ${effectifs.join(', ')}`)
    alertes++
  }
  else {
    const vides = effectifs.filter(t => !pdvParZone.get(norm(t)))
    if (vides.length) console.log(`  · ${p.nom || p.email} : ${total} PDV, mais aucun sur ${vides.join(', ')}`)
  }
}
if (!alertes) console.log('  Aucun agent sans PDV.')
