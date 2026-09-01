#!/usr/bin/env node
/**
 * Traite les points résiduels du scoping zone/quartier (suite de harmonize-quartiers.mjs) :
 *  1. Ajoute aux profils les variantes de casse exactes des zones pdv déjà couvertes
 *     en insensible à la casse (le filtre serveur de stores/pdv.ts compare en exact) ;
 *  2. Affecte les zones pdv sans aucun profil couvrant (ATTECOUBE, MARCORY TREICHVILLE,
 *     YOPOUGON) aux profils des territoires voisins correspondants ;
 *  3. Complète le référentiel Modern Trade : territoire MT + area + quartiers
 *     YOPOUGON MT et MARCORY-KOUMASSI-PORT BOUET MT.
 *
 * Usage :
 *   node scripts/fix-zones-residuelles.mjs           # dry-run (défaut)
 *   node scripts/fix-zones-residuelles.mjs --apply   # exécute les écritures
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve, dirname } from 'node:path'
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

// 2. zones pdv orphelines -> emails des profils à qui les affecter
const ZONE_ASSIGN = {
  'ATTECOUBE': ['attecoubeone@gmail.com', 'abidjannordfcadjame@gmail.com'],
  'MARCORY TREICHVILLE': ['marcorytreichone@gmail.com', 'abidjansudfctreichville@gmail.com', 'abidjansudfcmarcory@gmail.com', 'merchandiser@friesland.ci'],
  'YOPOUGON': ['merchandiser@friesland.ci', 'yopougonone@gmail.com', 'yopougontwo@gmail.com', 'abidjannordfcyopougon1@gmail.com', 'abidjannordfcyopougon3@gmail.com'],
}

// 3. référentiel Modern Trade
const MT = {
  territoire: { code: 'MT', nom: 'MODERN TRADE', sous_region_code: 'SOUTH1' },
  area: { code: 'AUTMT', nom: 'AUTRES MODERN TRADE', territoire_code: 'MT' },
  quartiers: ['YOPOUGON MT', 'MARCORY-KOUMASSI-PORT BOUET MT'],
}

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

const [pdvs, profiles, terrs, quarts] = await Promise.all([
  fetchAll('pdv', 'zone'),
  fetchAll('profiles', 'id,email,role,territoires_assignes,zone_assignee'),
  fetchAll('territoire', 'code,nom'),
  fetchAll('quartier', 'id,nom,zone_id,ordre'),
])

const pdvZones = [...new Set(pdvs.map((p) => p.zone).filter(Boolean))]

// ── 1. variantes de casse exactes manquantes ────────────────────────────────
const terrAdds = new Map() // email -> Set(zones à ajouter)
function addTerr(email, zone) {
  if (!terrAdds.has(email)) terrAdds.set(email, new Set())
  terrAdds.get(email).add(zone)
}
for (const p of profiles) {
  if (p.role === 'admin' || p.role === 'superviseur') continue
  const terrsP = (p.territoires_assignes || []).length ? p.territoires_assignes : (p.zone_assignee ? [p.zone_assignee] : [])
  if (!terrsP.length) continue
  const tn = new Set(terrsP.map(norm))
  for (const z of pdvZones) if (tn.has(norm(z)) && !terrsP.includes(z)) addTerr(p.email, z)
}

// ── 2. zones orphelines ─────────────────────────────────────────────────────
for (const [zone, emails] of Object.entries(ZONE_ASSIGN)) {
  if (!pdvZones.includes(zone)) continue
  for (const email of emails) {
    const p = profiles.find((x) => x.email === email)
    if (!p) { console.error(`⚠️ profil introuvable: ${email}`); continue }
    const terrsP = (p.territoires_assignes || []).length ? p.territoires_assignes : (p.zone_assignee ? [p.zone_assignee] : [])
    if (!terrsP.includes(zone)) addTerr(email, zone)
  }
}

// ── 3. Modern Trade ─────────────────────────────────────────────────────────
const needTerr = !terrs.some((t) => norm(t.nom) === norm(MT.territoire.nom))
const { data: existingArea } = await supabase.from('zone').select('id').eq('code', MT.area.code).maybeSingle()
const existingQuartiers = new Set(quarts.map((q) => norm(q.nom)))
const mtQuartiersToCreate = MT.quartiers.filter((q) => !existingQuartiers.has(norm(q)))

// ── Plan ────────────────────────────────────────────────────────────────────
console.log(`══ TERRITOIRES DES PROFILS (${terrAdds.size} profils) ══`)
for (const [email, zones] of terrAdds) {
  const p = profiles.find((x) => x.email === email)
  console.log(`  ~ ${email} : ${JSON.stringify(p.territoires_assignes)} + ${JSON.stringify([...zones])}`)
}
console.log(`\n══ RÉFÉRENTIEL MODERN TRADE ══`)
console.log(`  territoire ${MT.territoire.code} "${MT.territoire.nom}" : ${needTerr ? 'à créer' : 'existe'}`)
console.log(`  area ${MT.area.code} "${MT.area.nom}" : ${existingArea ? 'existe' : 'à créer'}`)
console.log(`  quartiers à créer : ${mtQuartiersToCreate.length ? mtQuartiersToCreate.join(', ') : 'aucun'}`)

if (!APPLY) {
  console.log(`\n🔎 DRY-RUN : aucune écriture. Relancer avec --apply pour exécuter.`)
  process.exit(0)
}

console.log(`\n══ APPLICATION ══`)
for (const [email, zones] of terrAdds) {
  const p = profiles.find((x) => x.email === email)
  const next = [...(p.territoires_assignes || [])]
  for (const z of zones) if (!next.includes(z)) next.push(z)
  const { error } = await supabase.from('profiles').update({ territoires_assignes: next }).eq('id', p.id)
  if (error) throw new Error(`UPDATE profile ${email}: ${error.message}`)
  console.log(`  ✓ ${email} : ${next.length} territoires`)
}
if (needTerr) {
  const { error } = await supabase.from('territoire').insert(MT.territoire)
  if (error) throw new Error(`INSERT territoire MT: ${error.message}`)
  console.log(`  ✓ territoire ${MT.territoire.code}`)
}
let areaId = existingArea?.id
if (!areaId) {
  const { data, error } = await supabase.from('zone').insert(MT.area).select('id').single()
  if (error) throw new Error(`INSERT area ${MT.area.code}: ${error.message}`)
  areaId = data.id
  console.log(`  ✓ area ${MT.area.code} (id ${areaId})`)
}
let ordre = Math.max(0, ...quarts.filter((q) => q.zone_id === areaId).map((q) => q.ordre || 0))
for (const nom of mtQuartiersToCreate) {
  ordre++
  const { error } = await supabase.from('quartier').insert({ zone_id: areaId, nom, ordre })
  if (error) throw new Error(`INSERT quartier ${nom}: ${error.message}`)
  console.log(`  ✓ quartier "${nom}"`)
}
console.log('\n✅ Terminé.')
