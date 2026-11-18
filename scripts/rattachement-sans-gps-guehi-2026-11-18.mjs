#!/usr/bin/env node
/**
 * Suite de scripts/routing-guehi-daniel-2026-11-18.mjs, à lancer APRÈS l'import
 * du routing (scripts/importer-routing-mensuel.mjs … --jours=0 --apply).
 *
 * Décisions de Jean Luc du 18/11/2026 pour les boutiques SDTP sans GPS :
 *   1. Elles sont rattachées au point de visite de leur jour
 *      (pdv_point_visite_force, comme la liste de Treichville du 05/11), à
 *      partir de leur position ESTIMÉE (fichier
 *      docs/routings/boutiques-sdtp-gps-quartier-2026-11-18.csv). Aucun GPS
 *      n'est écrit sur la fiche : la première visite donnera la vraie position.
 *   2. Le quartier estimé est écrit dans le quartier de la fiche (vide
 *      aujourd'hui), pour que le merchandiser sache où chercher.
 *
 * Puis : rattachement recalculé pour ces boutiques et tournées des jours à
 * venir générées (--jours=N, 7 par défaut, 0 pour aucune).
 *
 * Simulation par défaut ; avec --apply, le retour arrière est écrit dans
 * ~/Downloads.
 *
 * Usage :
 *   node scripts/rattachement-sans-gps-guehi-2026-11-18.mjs [--jours=7] [--apply]
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RACINE = resolve(__dirname, '..')
config({ path: resolve(RACINE, '.env'), quiet: true })
const APPLY = process.argv.includes('--apply')
const JOURS = Number(process.argv.find(a => a.startsWith('--jours='))?.split('=')[1] ?? 7)

const COMPTE = 'portbouetone@gmail.com'
const FICHIER = resolve(RACINE, 'docs/routings/routing-guehi-daniel-2026-11-rattachements.csv')
const MOTIF = 'SDTP sans GPS : quartier estimé (fichier du 18/11/2026)'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const must = ({ data, error }, quoi) => { if (error) throw new Error(`${quoi} : ${error.message}`); return data }

// ---- Lecture -----------------------------------------------------------------
const [, ...lignes] = readFileSync(FICHIER, 'utf8').trim().split('\n')
const demandes = lignes.map((l) => { const [pdv_id, point_visite, quartier] = l.split(';'); return { pdv_id, point_visite, quartier } })

const compte = must(await supabase.from('profiles').select('id,nom,is_active').eq('email', COMPTE).single(), 'compte')
const routing = must(await supabase.from('routing_mensuel').select('point_visite,latitude,longitude')
  .eq('merchandiser_id', compte.id).eq('actif', true), 'routing')
if (!routing.length) throw new Error(`${compte.nom} n'a pas de routing : lancer d'abord l'import du routing mensuel`)
const points = new Set(routing.filter(r => r.latitude != null && r.longitude != null).map(r => r.point_visite))
const sansPoint = [...new Set(demandes.map(d => d.point_visite))].filter(p => !points.has(p))
if (sansPoint.length) throw new Error(`Points de visite absents du routing chargé : ${sansPoint.join(' | ')}`)

const ids = demandes.map(d => d.pdv_id)
const fiches = must(await supabase.from('pdv').select('pdv_id,nom_pdv,quartier,geolocation_lat,geolocation_lng,is_active,distributor_name').in('pdv_id', ids), 'fiches')
const parId = new Map(fiches.map(f => [f.pdv_id, f]))
const retenues = [], ecartees = []
for (const d of demandes) {
  const f = parId.get(d.pdv_id)
  if (!f) ecartees.push(`${d.pdv_id} : fiche introuvable`)
  else if (f.is_active === false) ecartees.push(`${d.pdv_id} : fiche désactivée`)
  else if (f.geolocation_lat && f.geolocation_lng) ecartees.push(`${d.pdv_id} : a maintenant un GPS, rattachée par sa position`)
  else if (f.distributor_name !== 'SDTP') ecartees.push(`${d.pdv_id} : distributeur ${f.distributor_name}`)
  else retenues.push({ ...d, fiche: f })
}
const dejaForcees = must(await supabase.from('pdv_point_visite_force').select('pdv_id,merchandiser_id,point_visite,motif').in('pdv_id', ids), 'rattachements existants')
const quartiers = retenues.filter(r => r.quartier && !String(r.fiche.quartier || '').trim())

console.log(`${compte.nom} : ${retenues.length} boutique(s) sans GPS à rattacher sur ${demandes.length} (${dejaForcees.length} déjà rattachée(s), remplacée(s)).`)
const parPoint = {}
for (const r of retenues) parPoint[r.point_visite] = (parPoint[r.point_visite] || 0) + 1
for (const [p, n] of Object.entries(parPoint).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${p}`)
console.log(`Quartier écrit sur ${quartiers.length} fiche(s) au quartier vide (${retenues.length - quartiers.length} déjà renseignée(s), non touchée(s)).`)
for (const e of ecartees) console.log(`  écartée — ${e}`)
console.log(JOURS > 0 ? `Tournées recalculées sur ${JOURS} jour(s) à venir.` : 'Aucune tournée recalculée.')

if (!APPLY) {
  console.log('\nSimulation : rien n’a été écrit. Relancer avec --apply.')
  process.exit(0)
}

// ---- Retour arrière, puis écritures ------------------------------------------
const fichierRetour = join(homedir(), 'Downloads', `retour-rattachement-sans-gps-guehi-2026-11-18-${Date.now()}.json`)
writeFileSync(fichierRetour, JSON.stringify({
  pdv_point_visite_force_avant: dejaForcees,
  pdv_point_visite_force_ajoutes: retenues.map(r => r.pdv_id),
  quartiers_avant: quartiers.map(r => ({ pdv_id: r.pdv_id, quartier: r.fiche.quartier })),
}, null, 2))
console.log(`\nRetour arrière : ${fichierRetour}`)

must(await supabase.from('pdv_point_visite_force').upsert(
  retenues.map(r => ({ pdv_id: r.pdv_id, merchandiser_id: compte.id, point_visite: r.point_visite, motif: MOTIF })),
  { onConflict: 'pdv_id' },
).select('pdv_id'), 'rattachements')
console.log(`  ✓ ${retenues.length} rattachement(s)`)

const parQuartier = {}
for (const r of quartiers) (parQuartier[r.quartier] ??= []).push(r.pdv_id)
for (const [q, liste] of Object.entries(parQuartier)) {
  must(await supabase.from('pdv').update({ quartier: q }).in('pdv_id', liste).select('pdv_id'), `quartier ${q}`)
}
console.log(`  ✓ quartier sur ${quartiers.length} fiche(s)`)

const n = must(await supabase.rpc('recalculer_quartiers_atom', { p_pdv_ids: retenues.map(r => r.pdv_id) }), 'recalcul du rattachement')
console.log(`  ✓ rattachement recalculé : ${n} boutique(s)`)

if (JOURS > 0) {
  const t = must(await supabase.rpc('recalculer_tournees_a_venir', { p_user_id: compte.id, p_jours: JOURS }), 'tournées')
  console.log(`  ✓ tournées : ${JSON.stringify(t)}`)
}
