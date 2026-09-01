#!/usr/bin/env node
/**
 * Pousse les affectations de ~/Downloads/affectations_par_secteur.csv dans Supabase :
 *   1. Complète le référentiel : nouvelles areas (table zone) + nouveaux quartiers
 *      pour les secteurs absents — en réutilisant l'existant quand une variante
 *      orthographique existe (ex. DOKUI plutôt que créer « Plateau Dokoui »).
 *   2. Met à jour les profils (territoires_assignes, quartiers_assignes,
 *      zone_assignee, region) des commerciaux/merchandisers matchés par nom,
 *      avec l'orthographe CSV (alignée sur pdv.zone / pdv.quartier pour le scoping).
 *   3. Crée les comptes manquants (Muriel Siotene, Azoumi Kena).
 *
 * Usage :
 *   node scripts/push-affectations.mjs             # dry-run (défaut) : affiche tout, n'écrit rien
 *   node scripts/push-affectations.mjs --apply     # exécute les écritures
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { readFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env') })

const APPLY = process.argv.includes('--apply')
const SRC_PATH = join(process.env.HOME, 'Downloads', 'affectations_par_secteur.csv')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
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

function parseCsvLine(line) {
  const out = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQ) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++ } else inQ = false } else cur += c
    } else if (c === '"') inQ = true
    else if (c === ',') { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur)
  return out
}

// Zone CSV -> territoire référentiel (quand pas d'homonyme direct)
const ZONE_ALIAS = {
  'ATTECOUBE-PLATEAU': 'PLATEAU',
  'ADIAKE': 'ABOISSO', 'ADAOU': 'ABOISSO', 'AYAME': 'ABOISSO', 'BIANOUAN': 'ABOISSO',
  'MAFERE': 'ABOISSO', 'ETUEBOUE': 'ABOISSO',
  'ASSINIE MAFIA': 'BASSAM', 'BONOUA': 'BASSAM',
  'PORT-BOUET': 'PORT BOUET',
}
// Zones CSV = localités rurales → area dédiée sous le territoire
const RURAL_AREA_ZONES = new Set(['ADIAKE', 'ETUEBOUE', 'ADAOU', 'BIANOUAN', 'MAFERE', 'ASSINIE MAFIA', 'BONOUA'])
// Alias manuels secteur → quartier existant (norm(zone CSV)|norm(secteur))
const MANUAL_ALIAS = {
  'ABOBO 1|PLATEAU DOKOUI': 'DOKUI',
  'ATTECOUBE-PLATEAU|BRAMAKOTE': 'BRAMACOTÉ',
}
// Secteurs = localités déjà référencées à juste titre dans un autre territoire : réutiliser, ne pas créer
const LOCALITY_REUSE = new Set([
  'ANYAMA', 'AZAGUIE', 'EBIMPE', 'KOBAKRO', 'PAILLET', 'WILLIAMSVILLE',
  'DABOU', 'FRESCO', 'GRAND LAHOU', "N'DOUCI", 'YAOU', 'ASSE',
])

// ─── Chargement référentiel + profils ───────────────────────────────────────
const [{ data: terrs, error: e1 }, { data: areas, error: e2 }, { data: quarts, error: e3 }, { data: profiles, error: e4 }] =
  await Promise.all([
    supabase.from('territoire').select('code,nom'),
    supabase.from('zone').select('id,code,nom,territoire_code'),
    supabase.from('quartier').select('id,zone_id,nom,ordre'),
    supabase.from('profiles').select('id,email,nom,role,zone_assignee,territoires_assignes,quartiers_assignes,region'),
  ])
for (const e of [e1, e2, e3, e4]) if (e) throw new Error(e.message)

const terrByNorm = new Map(terrs.map((t) => [norm(t.nom), t]))
const areaById = new Map(areas.map((a) => [a.id, a]))
const areasByTerrCode = new Map()
for (const a of areas) {
  if (!areasByTerrCode.has(a.territoire_code)) areasByTerrCode.set(a.territoire_code, [])
  areasByTerrCode.get(a.territoire_code).push(a)
}
// quartiers par territoire (norm)
const qByTerr = new Map()
const terrCodeByNorm = new Map(terrs.map((t) => [norm(t.nom), t.code]))
for (const q of quarts) {
  const a = areaById.get(q.zone_id)
  if (!a) continue
  const t = terrs.find((x) => x.code === a.territoire_code)
  if (!t) continue
  const k = norm(t.nom)
  if (!qByTerr.has(k)) qByTerr.set(k, [])
  qByTerr.get(k).push(q)
}
const allQuartierNorms = new Set(quarts.map((q) => norm(q.nom)))
const maxOrdreByZone = new Map()
for (const q of quarts) maxOrdreByZone.set(q.zone_id, Math.max(maxOrdreByZone.get(q.zone_id) || 0, q.ordre || 0))

function existsInTerritoire(tKey, secteur) {
  const list = qByTerr.get(tKey) || []
  const c = compact(secteur)
  for (const q of list) if (norm(q.nom) === norm(secteur) || compact(q.nom) === c) return q.nom
  let best = null
  for (const q of list) {
    const qc = compact(q.nom)
    if (c.length >= 5 && qc.length >= 5) {
      const d = levenshtein(c, qc)
      if (d <= 2 && (!best || d < best.d)) best = { d, nom: q.nom }
    }
  }
  if (best) return best.nom
  for (const q of list) {
    const qc = compact(q.nom)
    if (c.length >= 5 && qc.length >= 5 && (qc.includes(c) || c.includes(qc))) return q.nom
  }
  return null
}

// ─── Lecture CSV source ─────────────────────────────────────────────────────
const srcLines = readFileSync(SRC_PATH, 'utf8').split(/\r?\n/).filter((l) => l.trim())
const rows = srcLines.slice(1).map(parseCsvLine).filter((r) => r.length >= 6 && r[1].trim())

// ─── 1. Plan référentiel : areas + quartiers à créer ────────────────────────
// key: terrNorm|secteurNorm -> {terr, zoneCsv, secteur, reuse|create, area}
const seen = new Map()
const newAreas = new Map() // key code -> {code, nom, territoire_code}
const newQuartiers = [] // {areaCode(new)|zone_id, nom, terr}

function areaKeyForCreation(zoneCsv, terr) {
  const zn = norm(zoneCsv)
  if (RURAL_AREA_ZONES.has(zn)) {
    const code = compact(zoneCsv).slice(0, 10)
    if (!newAreas.has(code)) newAreas.set(code, { code, nom: zoneCsv.trim().toUpperCase(), territoire_code: terr.code })
    return code
  }
  const code = ('AUT' + compact(terr.code)).slice(0, 10)
  if (!newAreas.has(code)) newAreas.set(code, { code, nom: `AUTRES ${terr.nom.toUpperCase()}`, territoire_code: terr.code })
  return code
}

const reusedAliases = []
for (const r of rows) {
  const zone = r[1].trim(), secteur = r[2].trim()
  if (!secteur) continue
  const zn = norm(zone)
  const tKey = terrByNorm.has(zn) ? zn : norm(ZONE_ALIAS[zn] || '')
  const terr = terrByNorm.get(tKey)
  if (!terr) { console.error(`⚠️ Zone inconnue: ${zone}`); continue }
  const key = `${tKey}|${norm(secteur)}`
  if (seen.has(key)) continue

  const manual = MANUAL_ALIAS[`${zn}|${norm(secteur)}`]
  if (manual) { seen.set(key, 'alias'); reusedAliases.push(`${zone} | ${secteur} → ${manual} (alias manuel)`); continue }
  const existing = existsInTerritoire(tKey, secteur)
  if (existing) { seen.set(key, 'exists'); continue }
  if (LOCALITY_REUSE.has(norm(secteur)) && allQuartierNorms.has(norm(secteur))) {
    seen.set(key, 'locality')
    reusedAliases.push(`${zone} | ${secteur} → quartier existant (autre territoire, localité)`)
    continue
  }
  seen.set(key, 'create')
  newQuartiers.push({ areaCode: areaKeyForCreation(zone, terr), nom: secteur, terr: terr.nom })
}

// ─── 2. Plan profils ────────────────────────────────────────────────────────
// personne+rôle -> {nom, role, zones[], secteurs[], region}
const persons = new Map()
function feed(nom, role, zone, secteur, region) {
  if (!nom) return
  const key = `${norm(nom)}|${role}`
  if (!persons.has(key)) persons.set(key, { nom, role, zones: [], secteurs: [], region: null })
  const p = persons.get(key)
  if (zone && !p.zones.includes(zone)) p.zones.push(zone)
  if (secteur && !p.secteurs.includes(secteur)) p.secteurs.push(secteur)
  if (!p.region && region) p.region = region
}
for (const r of rows) {
  const [, zone, secteur, merch, commercial, region] = r.map((x) => x.trim())
  feed(merch, 'merchandiser', zone, secteur, region)
  feed(commercial, 'commercial', zone, secteur, region)
}

const profileUpdates = [] // {profile, payload}
const unmatchedPersons = []
for (const p of persons.values()) {
  const matches = profiles.filter((pr) => compact(pr.nom) === compact(p.nom) && pr.role === p.role)
  const terrNoms = [...new Set(p.zones.map((z) => {
    const zn = norm(z)
    const tKey = terrByNorm.has(zn) ? zn : norm(ZONE_ALIAS[zn] || '')
    return (terrByNorm.get(tKey) || {}).nom
  }).filter(Boolean))]
  const territoires = [...new Set([...p.zones, ...terrNoms.filter((t) => !p.zones.some((z) => norm(z) === norm(t)))])]
  const payload = {
    territoires_assignes: territoires,
    zone_assignee: p.zones[0] || null,
    quartiers_assignes: p.secteurs,
    region: p.region,
  }
  if (!matches.length) { unmatchedPersons.push(p); continue }
  for (const profile of matches) profileUpdates.push({ profile, payload, person: p })
}

// Comptes à créer pour les personnes sans profil
const CREATE_EMAILS = {
  'MURIEL SIOTENE': 'muriel.siotene@friesland.ci',
  'AZOUMI KENA': 'azoumi.kena@friesland.ci',
}
const toCreateAccounts = []
for (const p of unmatchedPersons) {
  const email = CREATE_EMAILS[norm(p.nom)]
  if (email) {
    const dup = persons.get(`${norm(p.nom)}|${p.role}`)
    toCreateAccounts.push({ ...p, email })
  }
}
const trulyUnmatched = unmatchedPersons.filter((p) => !CREATE_EMAILS[norm(p.nom)])

// ─── Affichage du plan ──────────────────────────────────────────────────────
console.log(`\n══ RÉFÉRENTIEL ══`)
console.log(`Areas à créer (${newAreas.size}) :`)
for (const a of newAreas.values()) console.log(`  + zone[code=${a.code}] "${a.nom}" (territoire ${a.territoire_code})`)
console.log(`\nQuartiers à créer (${newQuartiers.length}) :`)
const byArea = new Map()
for (const q of newQuartiers) {
  if (!byArea.has(q.areaCode)) byArea.set(q.areaCode, [])
  byArea.get(q.areaCode).push(q.nom)
}
for (const [code, noms] of byArea) console.log(`  ${code} (${newAreas.get(code)?.territoire_code}) : ${noms.join(', ')}`)
console.log(`\nSecteurs réutilisant un quartier existant (${reusedAliases.length}) :`)
for (const a of reusedAliases) console.log(`  = ${a}`)

console.log(`\n══ PROFILS ══`)
console.log(`Mises à jour (${profileUpdates.length} comptes) :`)
for (const { profile, payload } of profileUpdates) {
  console.log(`  ~ ${profile.nom} <${profile.email}> [${profile.role}]`)
  console.log(`      territoires: ${JSON.stringify(profile.territoires_assignes)} → ${JSON.stringify(payload.territoires_assignes)}`)
  console.log(`      quartiers:   ${(profile.quartiers_assignes || []).length} → ${payload.quartiers_assignes.length}, region: ${profile.region} → ${payload.region}`)
}
console.log(`\nComptes à créer (${toCreateAccounts.length}) :`)
for (const c of toCreateAccounts) console.log(`  + ${c.nom} <${c.email}> [${c.role}] — ${c.zones.join(', ')} (${c.secteurs.length} secteurs, region ${c.region})`)
if (trulyUnmatched.length) {
  console.log(`\nPersonnes du CSV sans compte ni création prévue (${trulyUnmatched.length}) :`)
  for (const p of trulyUnmatched) console.log(`  ! ${p.nom} [${p.role}] — ${p.zones.join(', ')}`)
}

if (!APPLY) {
  console.log(`\n🔎 DRY-RUN : aucune écriture. Relancer avec --apply pour exécuter.`)
  process.exit(0)
}

// ─── Application ────────────────────────────────────────────────────────────
console.log(`\n══ APPLICATION ══`)
// 1. Areas
const areaIdByCode = new Map()
for (const a of newAreas.values()) {
  const { data, error } = await supabase.from('zone').insert({ code: a.code, nom: a.nom, territoire_code: a.territoire_code }).select('id').single()
  if (error) throw new Error(`Insert area ${a.code}: ${error.message}`)
  areaIdByCode.set(a.code, data.id)
  console.log(`  ✓ area ${a.code} (id ${data.id})`)
}
// 2. Quartiers
let created = 0
for (const q of newQuartiers) {
  const zoneId = areaIdByCode.get(q.areaCode)
  const ordre = (maxOrdreByZone.get(zoneId) || 0) + 1
  maxOrdreByZone.set(zoneId, ordre)
  const { error } = await supabase.from('quartier').insert({ zone_id: zoneId, nom: q.nom, ordre })
  if (error) throw new Error(`Insert quartier ${q.nom}: ${error.message}`)
  created++
}
console.log(`  ✓ ${created} quartiers créés`)
// 3. Profils
for (const { profile, payload } of profileUpdates) {
  const { error } = await supabase.from('profiles').update(payload).eq('id', profile.id)
  if (error) throw new Error(`Update profile ${profile.email}: ${error.message}`)
}
console.log(`  ✓ ${profileUpdates.length} profils mis à jour`)
// 4. Comptes
for (const c of toCreateAccounts) {
  const password = process.env.SEED_DEFAULT_PASSWORD
  if (!password) throw new Error('SEED_DEFAULT_PASSWORD manquant dans .env')
  const { data, error } = await supabase.auth.admin.createUser({
    email: c.email, password, email_confirm: true,
    user_metadata: { nom: c.nom, role: c.role },
  })
  if (error) { console.error(`  ✗ createUser ${c.email}: ${error.message}`); continue }
  const terrNoms = [...new Set(c.zones.map((z) => {
    const zn = norm(z)
    const tKey = terrByNorm.has(zn) ? zn : norm(ZONE_ALIAS[zn] || '')
    return (terrByNorm.get(tKey) || {}).nom
  }).filter(Boolean))]
  const payload = {
    nom: c.nom, role: c.role,
    territoires_assignes: [...new Set([...c.zones, ...terrNoms.filter((t) => !c.zones.some((z) => norm(z) === norm(t)))])],
    zone_assignee: c.zones[0] || null,
    quartiers_assignes: c.secteurs,
    region: c.region,
    is_active: true,
  }
  const { error: pe } = await supabase.from('profiles').upsert({ id: data.user.id, email: c.email, ...payload })
  if (pe) console.error(`  ✗ profile ${c.email}: ${pe.message}`)
  else console.log(`  ✓ compte créé ${c.email} (id ${data.user.id})`)
}
console.log('\n✅ Terminé.')
