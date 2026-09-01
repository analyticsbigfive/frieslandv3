#!/usr/bin/env node
/**
 * Harmonise pdv.quartier avec les affectations (profiles.quartiers_assignes)
 * pour que le scoping exact de composables/useUserScope.ts retrouve tous les PDV.
 *
 * Classes :
 *  A-auto   : variante orthographique (égalité après normalisation compacte) d'un
 *             quartier assigné/référencé → UPDATE pdv.quartier vers l'orthographe canonique.
 *  A-manuel : alias validés à la main (MANUAL_ALIAS) → même UPDATE.
 *  B        : quartier réellement manquant → INSERT dans la table quartier (area
 *             « AUTRES <TERRITOIRE> », motif de push-affectations.mjs) + ajout aux
 *             quartiers_assignes de chaque profil restreint (liste non vide) couvrant la zone.
 *
 * Usage :
 *   node scripts/harmonize-quartiers.mjs           # dry-run (défaut) : n'écrit rien
 *   node scripts/harmonize-quartiers.mjs --apply   # exécute les écritures
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '..', '..', '..', '.env') })
if (!process.env.SUPABASE_URL) config({ path: resolve(__dirname, '..', '.env') })

const APPLY = process.argv.includes('--apply')

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

// Zone pdv -> territoire (quand pas d'homonyme direct). null = pas de territoire (warn).
const ZONE_ALIAS = {
  'ATTECOUBE-PLATEAU': 'PLATEAU',
  'PORT-BOUET': 'PORT BOUET',
  'YOPOUGON': 'YOPOUGON 1',
  'MARCORY TREICHVILLE': 'MARCORY',
}
// Alias validés manuellement : norm(zone)|norm(variante pdv) -> orthographe canonique (affectations)
const MANUAL_ALIAS = {
  'KOUMASSI|KOUMASSI 05': 'TERMINUS 05',
  'KOUMASSI|DJE KONAN': 'MARCHE DJE KONAN',
  'YOPOUGON|SOGEFIA': 'SOGEPHIA',
  'MARCORY|RESIDENTIELLE': 'RÉSIDENTIEL',
  'MARCORY|STE THERESE': 'Sainte-Thérèse',
  'PORT-BOUET|GONZAGUE': 'GONZAGUEVILLE',
  'TREICHVILLE|ARRAS': 'Aras',
  'MARCORY TREICHVILLE|SANS- FIL': 'Sans-fil',
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

const [pdvs, quarts, areas, terrs, profiles] = await Promise.all([
  fetchAll('pdv', 'id,zone,quartier'),
  fetchAll('quartier', 'id,nom,zone_id,ordre'),
  fetchAll('zone', 'id,code,nom,territoire_code'),
  fetchAll('territoire', 'code,nom'),
  fetchAll('profiles', 'id,email,nom,role,territoires_assignes,quartiers_assignes,zone_assignee'),
])
console.log(`pdv=${pdvs.length} quartier=${quarts.length} zone=${areas.length} territoire=${terrs.length} profiles=${profiles.length}`)

const assignedExact = new Set()
for (const p of profiles) for (const q of p.quartiers_assignes || []) if (q) assignedExact.add(q)
const tableExact = new Set(quarts.map((q) => q.nom))
const tableCompact = new Map() // compact -> nom existant
for (const q of quarts) if (!tableCompact.has(compact(q.nom))) tableCompact.set(compact(q.nom), q.nom)

const terrByNorm = new Map(terrs.map((t) => [norm(t.nom), t]))
const maxOrdreByZone = new Map()
for (const q of quarts) maxOrdreByZone.set(q.zone_id, Math.max(maxOrdreByZone.get(q.zone_id) || 0, q.ordre || 0))

// profils couvrant chaque zone pdv (norm) via territoires_assignes / zone_assignee
const profByZone = new Map()
for (const p of profiles) {
  const zs = new Set([...(p.territoires_assignes || []), p.zone_assignee].filter(Boolean).map(norm))
  for (const z of zs) {
    if (!profByZone.has(z)) profByZone.set(z, [])
    profByZone.get(z).push(p)
  }
}

function terrForZone(zoneName) {
  const zn = norm(zoneName)
  if (terrByNorm.has(zn)) return terrByNorm.get(zn)
  const alias = ZONE_ALIAS[zn]
  return alias ? terrByNorm.get(norm(alias)) || null : null
}

// area « AUTRES <TERRITOIRE> » existante ou à créer (motif push-affectations)
const areaByCode = new Map(areas.map((a) => [a.code, a]))
const newAreas = new Map()
function autresAreaCode(terr) {
  const code = ('AUT' + compact(terr.code)).slice(0, 10)
  if (!areaByCode.has(code) && !newAreas.has(code)) {
    newAreas.set(code, { code, nom: `AUTRES ${terr.nom.toUpperCase()}`, territoire_code: terr.code })
  }
  return code
}

// ─── Détection des orphelins ────────────────────────────────────────────────
const byZone = new Map() // zone -> Map(quartier -> count)
for (const pdv of pdvs) {
  const q = (pdv.quartier || '').trim()
  if (!q) continue
  const z = pdv.zone || ''
  if (!byZone.has(z)) byZone.set(z, new Map())
  const m = byZone.get(z)
  m.set(q, (m.get(q) || 0) + 1)
}

// candidats canoniques : quartiers assignés des profils de la zone, puis globaux, puis table
const globalAssigned = [...assignedExact]

const updates = []      // {zone, from, to, count, via}
const missing = []      // {zone, quartier, count, terr, areaCode|null, profils: [], fuzzyRejete|null}
const zonesSansProfil = new Set()

for (const [zone, counts] of [...byZone.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const zoneProfiles = profByZone.get(norm(zone)) || []
  if (!zoneProfiles.length) zonesSansProfil.add(zone || '(SANS ZONE)')
  const zoneAssigned = []
  const s = new Set()
  for (const p of zoneProfiles) for (const q of p.quartiers_assignes || []) if (q && !s.has(q)) { s.add(q); zoneAssigned.push(q) }

  for (const [val, count] of counts) {
    if (assignedExact.has(val) || tableExact.has(val)) continue

    const manual = MANUAL_ALIAS[`${norm(zone)}|${norm(val)}`]
    if (manual) { updates.push({ zone, from: val, to: manual, count, via: 'alias manuel' }); continue }

    const c = compact(val)
    const auto = zoneAssigned.find((q) => compact(q) === c)
      || globalAssigned.find((q) => compact(q) === c)
      || tableCompact.get(c)
    if (auto) { updates.push({ zone, from: val, to: auto, count, via: 'compact-égal' }); continue }

    // fuzzy informatif uniquement (jamais appliqué automatiquement)
    let fuzzy = null
    for (const q of [...zoneAssigned, ...globalAssigned]) {
      const qc = compact(q)
      if (c.length >= 5 && qc.length >= 5) {
        const d = levenshtein(c, qc)
        if (d <= 2 && (!fuzzy || d < fuzzy.d)) fuzzy = { d, q }
      }
    }
    if (!fuzzy) for (const q of [...zoneAssigned, ...globalAssigned]) {
      const qc = compact(q)
      if (c.length >= 4 && qc.length >= 4 && (qc.includes(c) || c.includes(qc))) { fuzzy = { q, d: 'sub' }; break }
    }

    const terr = terrForZone(zone)
    missing.push({
      zone, quartier: val, count,
      terr: terr?.nom || null,
      areaCode: terr ? autresAreaCode(terr) : null,
      profils: zoneProfiles.filter((p) => (p.quartiers_assignes || []).length).map((p) => p.email),
      fuzzyRejete: fuzzy ? `${fuzzy.q} (${fuzzy.d === 'sub' ? 'inclusion' : `lev${fuzzy.d}`})` : null,
    })
  }
}

// ─── Classe C : valeurs pdv couvertes globalement mais invisibles de TOUS les
// profils restreints de la zone (ex. SICOGI vs Sicogi chez koumassione).
// Variante de casse d'un quartier de la zone → UPDATE pdv ; sinon → ajout aux affectations.
const zoneAdds = [] // {zone, quartier, count, profils}
for (const [zone, counts] of byZone) {
  const zp = (profByZone.get(norm(zone)) || []).filter((p) => (p.quartiers_assignes || []).length)
  if (!zp.length) continue
  const union = new Set()
  for (const p of zp) for (const q of p.quartiers_assignes) union.add(q)
  const unionCompact = new Map()
  for (const q of union) if (!unionCompact.has(compact(q))) unionCompact.set(compact(q), q)
  for (const [val, count] of counts) {
    if (union.has(val)) continue
    if (!assignedExact.has(val) && !tableExact.has(val)) continue // déjà géré en A/B
    const caseVariant = unionCompact.get(compact(val))
    if (caseVariant) updates.push({ zone, from: val, to: caseVariant, count, via: 'casse (profils zone)' })
    else zoneAdds.push({ zone, quartier: val, count, profils: zp.map((p) => p.email) })
  }
}

// consolidation profils : email -> quartiers à ajouter
const profileAdds = new Map()
for (const m of [...missing, ...zoneAdds]) for (const email of m.profils) {
  if (!profileAdds.has(email)) profileAdds.set(email, [])
  const list = profileAdds.get(email)
  if (!list.includes(m.quartier)) list.push(m.quartier)
}

// ─── Affichage du plan ──────────────────────────────────────────────────────
console.log(`\n══ CLASSE A — corrections pdv.quartier (${updates.length} valeurs, ${updates.reduce((n, u) => n + u.count, 0)} PDV) ══`)
for (const u of updates.sort((a, b) => a.zone.localeCompare(b.zone) || b.count - a.count))
  console.log(`  ~ [${u.zone}] "${u.from}" → "${u.to}" (${u.count} PDV, ${u.via})`)

console.log(`\n══ CLASSE B — quartiers manquants (${missing.length} valeurs, ${missing.reduce((n, m) => n + m.count, 0)} PDV) ══`)
for (const m of missing.sort((a, b) => a.zone.localeCompare(b.zone) || b.count - a.count)) {
  console.log(`  + [${m.zone}] "${m.quartier}" (${m.count} PDV)`)
  console.log(`      table quartier : ${m.areaCode ? `area ${m.areaCode} (territoire ${m.terr})` : '⚠️ AUCUN TERRITOIRE — insertion sautée'}`)
  console.log(`      affectations   : ${m.profils.length ? m.profils.join(', ') : '⚠️ aucun profil restreint sur la zone'}`)
  if (m.fuzzyRejete) console.log(`      fuzzy rejeté   : ${m.fuzzyRejete}`)
}

if (zoneAdds.length) {
  console.log(`\n══ CLASSE C — quartiers existants à ajouter aux profils de la zone (${zoneAdds.length}) ══`)
  for (const m of zoneAdds) console.log(`  + [${m.zone}] "${m.quartier}" (${m.count} PDV) → ${m.profils.join(', ')}`)
}

if (newAreas.size) {
  console.log(`\nAreas « AUTRES » à créer (${newAreas.size}) :`)
  for (const a of newAreas.values()) console.log(`  + zone[code=${a.code}] "${a.nom}" (territoire ${a.territoire_code})`)
}

console.log(`\nProfils à compléter (${profileAdds.size}) :`)
for (const [email, qs] of profileAdds) {
  const p = profiles.find((x) => x.email === email)
  console.log(`  ~ ${email} : ${(p.quartiers_assignes || []).length} → ${(p.quartiers_assignes || []).length + qs.length} quartiers (+ ${qs.join(', ')})`)
}

if (zonesSansProfil.size)
  console.log(`\n⚠️ Zones pdv sans aucun profil couvrant (scoping impossible, à traiter séparément) : ${[...zonesSansProfil].join(', ')}`)

mkdirSync(join(__dirname, 'out'), { recursive: true })
const planPath = join(__dirname, 'out', 'harmonize-plan.json')
writeFileSync(planPath, JSON.stringify({ generatedAt: new Date().toISOString(), updates, missing, profileAdds: Object.fromEntries(profileAdds), newAreas: [...newAreas.values()], zonesSansProfil: [...zonesSansProfil] }, null, 2))
console.log(`\n→ ${planPath}`)

if (!APPLY) {
  console.log(`\n🔎 DRY-RUN : aucune écriture. Relancer avec --apply pour exécuter.`)
  process.exit(0)
}

// ─── Application ────────────────────────────────────────────────────────────
console.log(`\n══ APPLICATION ══`)
// 1. UPDATE pdv
for (const u of updates) {
  const { error, count } = await supabase.from('pdv')
    .update({ quartier: u.to }, { count: 'exact' })
    .eq('zone', u.zone).eq('quartier', u.from)
  if (error) throw new Error(`UPDATE pdv [${u.zone}] ${u.from}: ${error.message}`)
  console.log(`  ✓ [${u.zone}] "${u.from}" → "${u.to}" (${count} lignes)`)
}
// 2. Areas manquantes
const areaIdByCode = new Map(areas.map((a) => [a.code, a.id]))
for (const a of newAreas.values()) {
  const { data, error } = await supabase.from('zone').insert({ code: a.code, nom: a.nom, territoire_code: a.territoire_code }).select('id').single()
  if (error) throw new Error(`INSERT area ${a.code}: ${error.message}`)
  areaIdByCode.set(a.code, data.id)
  console.log(`  ✓ area ${a.code} (id ${data.id})`)
}
// 3. INSERT quartier
let inserted = 0
for (const m of missing) {
  if (!m.areaCode) { console.log(`  ⚠️ quartier "${m.quartier}" [${m.zone}] non inséré (pas de territoire)`); continue }
  const zoneId = areaIdByCode.get(m.areaCode)
  const ordre = (maxOrdreByZone.get(zoneId) || 0) + 1
  maxOrdreByZone.set(zoneId, ordre)
  const { error } = await supabase.from('quartier').insert({ zone_id: zoneId, nom: m.quartier, ordre })
  if (error) throw new Error(`INSERT quartier ${m.quartier}: ${error.message}`)
  inserted++
}
console.log(`  ✓ ${inserted} quartiers insérés`)
// 4. UPDATE profiles
for (const [email, qs] of profileAdds) {
  const p = profiles.find((x) => x.email === email)
  const next = [...(p.quartiers_assignes || [])]
  for (const q of qs) if (!next.includes(q)) next.push(q)
  const { error } = await supabase.from('profiles').update({ quartiers_assignes: next }).eq('id', p.id)
  if (error) throw new Error(`UPDATE profile ${email}: ${error.message}`)
  console.log(`  ✓ ${email} : ${next.length} quartiers`)
}
console.log('\n✅ Terminé.')
