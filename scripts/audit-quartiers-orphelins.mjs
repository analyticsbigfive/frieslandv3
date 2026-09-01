#!/usr/bin/env node
/**
 * Audit : recense les valeurs pdv.quartier « orphelines », c.-à-d. absentes
 *  - de tous les profiles.quartiers_assignes (comparaison exacte, comme useUserScope), et
 *  - de la table quartier.
 * Propose un rapprochement fuzzy (normalisation + Levenshtein + inclusion) vers
 * les quartiers assignés des profils couvrant la même zone, ou vers la table quartier.
 * Aucune écriture. Sortie console + JSON dans scripts/out/.
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '..', '..', '..', '.env') })
if (!process.env.SUPABASE_URL) config({ path: resolve(__dirname, '..', '.env') })

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const norm = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[’']/g, "'").replace(/\s+/g, ' ').trim().toUpperCase()
const compact = (s) => norm(s).replace(/[^A-Z0-9]/g, '')

function levenshtein(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 99
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[a.length][b.length]
}

// candidats : [{label, source}] ; renvoie {label, source, how} ou null
function fuzzyFind(candidates, value) {
  const c = compact(value)
  if (!c) return null
  for (const cand of candidates) if (compact(cand.label) === c) return { ...cand, how: 'compact-equal' }
  let best = null
  for (const cand of candidates) {
    const qc = compact(cand.label)
    if (c.length >= 5 && qc.length >= 5) {
      const d = levenshtein(c, qc)
      if (d <= 2 && (!best || d < best.d)) best = { ...cand, d }
    }
  }
  if (best) return { ...best, how: `levenshtein-${best.d}` }
  for (const cand of candidates) {
    const qc = compact(cand.label)
    if (c.length >= 4 && qc.length >= 4 && (qc.includes(c) || c.includes(qc))) return { ...cand, how: 'substring' }
  }
  return null
}

// ─── Chargement ─────────────────────────────────────────────────────────────
async function fetchAll(table, cols) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(cols).range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

const [pdvs, quarts, profiles] = await Promise.all([
  fetchAll('pdv', 'id,zone,quartier'),
  fetchAll('quartier', 'id,nom,zone_id'),
  fetchAll('profiles', 'id,email,nom,role,territoires_assignes,quartiers_assignes,zone_assignee'),
])

console.log(`pdv=${pdvs.length}, quartier=${quarts.length}, profiles=${profiles.length}`)

// Toutes les valeurs exactes couvrantes (comme useUserScope : match exact)
const allAssignedExact = new Set()
for (const p of profiles) for (const q of p.quartiers_assignes || []) if (q) allAssignedExact.add(q)
const quartierTableExact = new Set(quarts.map((q) => q.nom))

// zone (norm) -> profils couvrant cette zone (via territoires_assignes / zone_assignee)
const profilesByZone = new Map()
for (const p of profiles) {
  const zones = new Set([...(p.territoires_assignes || []), p.zone_assignee].filter(Boolean).map(norm))
  for (const z of zones) {
    if (!profilesByZone.has(z)) profilesByZone.set(z, [])
    profilesByZone.get(z).push(p)
  }
}

// ─── Groupement des pdv.quartier par zone ───────────────────────────────────
// zone -> Map(quartierValue -> count)
const byZone = new Map()
let pdvSansQuartier = 0
for (const pdv of pdvs) {
  const q = (pdv.quartier || '').trim()
  if (!q) { pdvSansQuartier++; continue }
  const z = pdv.zone || '(SANS ZONE)'
  if (!byZone.has(z)) byZone.set(z, new Map())
  const m = byZone.get(z)
  m.set(q, (m.get(q) || 0) + 1)
}

const report = { generatedAt: new Date().toISOString(), zones: [] }
let totalOrphelins = 0, totalPdvOrphelins = 0

for (const [zone, quartierCounts] of [...byZone.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const zoneProfiles = profilesByZone.get(norm(zone)) || []
  // candidats fuzzy : quartiers assignés des profils de la zone, sinon tous les assignés + table quartier
  const zoneCandidates = []
  const seenCand = new Set()
  for (const p of zoneProfiles) for (const q of p.quartiers_assignes || []) {
    if (q && !seenCand.has(q)) { seenCand.add(q); zoneCandidates.push({ label: q, source: `assigné(${p.email})` }) }
  }
  const globalCandidates = []
  const seenG = new Set()
  for (const p of profiles) for (const q of p.quartiers_assignes || []) {
    if (q && !seenG.has(q)) { seenG.add(q); globalCandidates.push({ label: q, source: `assigné(${p.email})` }) }
  }
  for (const q of quarts) if (!seenG.has(q.nom)) { seenG.add(q.nom); globalCandidates.push({ label: q.nom, source: 'table quartier' }) }

  const orphelins = []
  for (const [val, count] of quartierCounts) {
    if (allAssignedExact.has(val) || quartierTableExact.has(val)) continue
    const local = fuzzyFind(zoneCandidates, val)
    const global_ = local ? null : fuzzyFind(globalCandidates, val)
    const match = local || global_
    orphelins.push({
      quartier: val, pdvCount: count,
      proposition: match ? { vers: match.label, source: match.source, methode: match.how, portee: local ? 'zone' : 'global' } : null,
    })
    totalOrphelins++
    totalPdvOrphelins += count
  }
  if (orphelins.length) {
    report.zones.push({
      zone,
      profils: zoneProfiles.map((p) => `${p.email} [${p.role}] (${(p.quartiers_assignes || []).length} quartiers)`),
      quartiersAssignesZone: zoneCandidates.map((c) => c.label),
      orphelins: orphelins.sort((a, b) => b.pdvCount - a.pdvCount),
    })
  }
}

// ─── Sortie ─────────────────────────────────────────────────────────────────
for (const z of report.zones) {
  console.log(`\n═══ ZONE ${z.zone} ═══`)
  console.log(`  Profils couvrant la zone : ${z.profils.length ? z.profils.join(' ; ') : 'AUCUN'}`)
  if (z.quartiersAssignesZone.length) console.log(`  Quartiers assignés (zone) : ${z.quartiersAssignesZone.join(', ')}`)
  for (const o of z.orphelins) {
    const prop = o.proposition
      ? `→ « ${o.proposition.vers} » [${o.proposition.methode}, ${o.proposition.portee}, ${o.proposition.source}]`
      : '→ AUCUNE CORRESPONDANCE (quartier réellement manquant ?)'
    console.log(`  ✗ « ${o.quartier} » (${o.pdvCount} PDV) ${prop}`)
  }
}
console.log(`\n── Synthèse ──`)
console.log(`Valeurs pdv.quartier orphelines : ${totalOrphelins} (${totalPdvOrphelins} PDV) sur ${report.zones.length} zones`)
console.log(`PDV sans quartier : ${pdvSansQuartier}`)

mkdirSync(join(__dirname, 'out'), { recursive: true })
const outPath = join(__dirname, 'out', 'quartiers-orphelins.json')
writeFileSync(outPath, JSON.stringify(report, null, 2))
console.log(`→ ${outPath}`)
