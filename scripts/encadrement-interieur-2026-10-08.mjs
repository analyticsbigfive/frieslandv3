#!/usr/bin/env node
/**
 * Comptes de l'intérieur enregistrés comme merchandisers alors qu'ils sont
 * commerciaux (sales officers). Réunion client du 08/10/2026, Emmanuel : « la
 * jeune dame […] de l'intérieur, elle est commerciale, elle n'est pas
 * merchandiseuse » ; M. Assamoi Tresor dirige l'intérieur.
 *
 * Hypothèse retenue : l'intérieur fonctionnera comme Abidjan. Les commerciaux
 * y encadrent les merchandisers d'une agence (l'agence de l'intérieur, pas
 * encore créée), comme Rachid ou Armande encadrent ceux d'Atom.
 *
 * Pour chaque compte de COMPTES :
 *   1. profil : role = commercial, commercial_id = NULL, employeur = friesland,
 *      direction = north (si la colonne existe : migration 20261008110000).
 *      Les territoires restent : c'est le périmètre du commercial ;
 *   2. ses règles de tournée sont désactivées ;
 *   3. ses tournées à venir qui n'ont pas commencé sont supprimées. Celle du
 *      jour, celles commencées et les visites restent.
 * Le rapport signale aussi :
 *   - l'équipe de chacun (merchandisers d'agence de ses territoires : à
 *     constituer quand l'agence de l'intérieur aura ses merchandisers) ;
 *   - les territoires qui n'ont plus aucun merchandiser actif ;
 *   - les autres comptes « merchandiser » de l'intérieur à l'adresse de
 *     commercial (cnefc…, cnofc…, fcouest…), à confirmer avant correction.
 *
 * Tout est lu et affiché avant la première écriture. Simulation par défaut.
 *
 * Usage :
 *   node scripts/encadrement-interieur-2026-10-08.mjs            # simulation
 *   node scripts/encadrement-interieur-2026-10-08.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { toutesLesLignes } from './lib/dms.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env'), quiet: true })
const APPLY = process.argv.includes('--apply')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Comptes à passer commerciaux (décision du 08/10 : Jemima ; hypothèse : Assamoi).
const COMPTES = [
  { email: 'djessoumima@gmail.com', motif: 'Emmanuel, réunion du 08/10 : commerciale, pas merchandiseuse' },
  { email: 'cnefcyamoussoukro@gmail.com', motif: 'M. Assamoi Tresor dirige l’intérieur (réunion du 08/10)' },
]
// Adresses des comptes de commerciaux FrieslandCampina (KACOU LEONARD : cnofcgagnoa@).
const ADRESSE_COMMERCIAL = /^(cnefc|cnofc|fcouest|fcest|fcnord)/i

const aujourdhui = new Date().toISOString().slice(0, 10)
const ok = ({ data, error }, quoi) => { if (error) throw new Error(`${quoi} : ${error.message}`); return data }
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim()

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------
const profils = await toutesLesLignes(() => supabase.from('profiles')
  .select('id,nom,email,role,employeur,is_active,territoires_assignes,zone_assignee,commercial_id').order('id'))
const nomDe = new Map(profils.map(p => [p.id, p.nom]))
const { error: sansDirection } = await supabase.from('profiles').select('direction').limit(1)
const colonneDirection = !sansDirection
const territoiresDe = p => [...(p.territoires_assignes || []), p.zone_assignee].filter(Boolean).map(norm)
const merchsActifs = profils.filter(p => p.role === 'merchandiser' && p.is_active !== false)

const plan = []
for (const c of COMPTES) {
  const p = profils.find(x => x.email?.toLowerCase() === c.email)
  if (!p) { console.log(`⚠ ${c.email} : aucun profil`); continue }
  const regles = ok(await supabase.from('routing_templates').select('id,label,is_active').eq('user_id', p.id), `règles de ${p.nom}`)
  const tournees = await toutesLesLignes(() => supabase.from('routings')
    .select('id,date_routing,status,routing_pdv(status)').eq('user_id', p.id).gt('date_routing', aujourdhui).order('id'))
  const intactes = tournees.filter(t => t.status === 'pending' && (t.routing_pdv || []).every(e => e.status === 'pending'))
  const { count: visites } = await supabase.from('visites').select('id', { count: 'exact', head: true }).eq('user_id', p.id)
  const equipeActuelle = profils.filter(x => x.commercial_id === p.id)
  const terr = territoiresDe(p)
  // Merchandisers d'agence de ses territoires (hypothèse Abidjan : son équipe).
  const equipeAgence = merchsActifs.filter(m => m.id !== p.id && m.employeur && m.employeur !== 'friesland' && territoiresDe(m).some(t => terr.includes(t)))
  plan.push({ c, p, regles, tournees, intactes, visites, equipeActuelle, terr, equipeAgence })
}

// ---------------------------------------------------------------------------
// Rapport
// ---------------------------------------------------------------------------
console.log(`\nHypothèse : à l'intérieur comme à Abidjan, les commerciaux encadrent les merchandisers d'une agence.\n`)
for (const x of plan) {
  const { p } = x
  console.log(`■ ${p.nom} <${p.email}> — ${x.c.motif}`)
  console.log(`  Aujourd'hui : ${p.role}, employeur ${p.employeur || '—'}, responsable ${nomDe.get(p.commercial_id) || '—'}, territoires ${x.terr.join(', ') || '—'}`)
  console.log(`  Après       : commercial, sans responsable, employeur friesland${colonneDirection ? ', direction north' : ' (direction north à régler après la migration 20261008110000)'}, mêmes territoires`)
  console.log(`  Règles      : ${x.regles.filter(r => r.is_active !== false).map(r => `« ${r.label} »`).join(', ') || 'aucune active'} → désactivées`)
  console.log(`  Tournées    : ${x.tournees.length} à venir, dont ${x.intactes.length} pas commencées → supprimées`)
  console.log(`  Visites     : ${x.visites ?? '?'} (conservées)`)
  if (x.equipeActuelle.length) console.log(`  Le désignent comme commercial : ${x.equipeActuelle.map(e => e.nom).join(', ')}`)
  console.log(`  Équipe (hypothèse) : ${x.equipeAgence.length ? x.equipeAgence.map(m => m.nom).join(', ') : 'aucun merchandiser d’agence sur ses territoires pour l’instant — à constituer quand l’agence de l’intérieur aura ses merchandisers'}`)
  console.log('')
}

// Territoires qui n'auraient plus de merchandiser actif.
const corriges = new Set(plan.map(x => x.p.id))
const restants = merchsActifs.filter(m => !corriges.has(m.id))
const orphelins = [...new Set(plan.flatMap(x => x.terr))].filter(t => !restants.some(m => territoiresDe(m).includes(t)))
console.log(`Territoires sans merchandiser actif après correction : ${orphelins.length ? orphelins.join(', ') : 'aucun'}`)

// Autres comptes « merchandiser » à l'adresse de commercial : signalés seulement.
const suspects = merchsActifs.filter(m => !corriges.has(m.id) && ADRESSE_COMMERCIAL.test(m.email || ''))
if (suspects.length) {
  console.log(`\nÀ confirmer (adresse de commercial, rôle merchandiser — NON modifiés par ce script) :`)
  for (const m of suspects) console.log(`  - ${m.nom} <${m.email}> — ${territoiresDe(m).join(', ')}`)
}

if (!APPLY) {
  console.log('\nSIMULATION : aucune écriture. Relancer avec --apply pour corriger les comptes listés en ■.')
  process.exit(0)
}

// ---------------------------------------------------------------------------
// Écriture
// ---------------------------------------------------------------------------
for (const x of plan) {
  const patch = { role: 'commercial', commercial_id: null, employeur: 'friesland', ...(colonneDirection ? { direction: 'north' } : {}) }
  ok(await supabase.from('profiles').update(patch).eq('id', x.p.id), `profil de ${x.p.nom}`)
  if (x.regles.some(r => r.is_active !== false)) ok(await supabase.from('routing_templates').update({ is_active: false }).eq('user_id', x.p.id), `règles de ${x.p.nom}`)
  for (let i = 0; i < x.intactes.length; i += 200) {
    ok(await supabase.from('routings').delete().in('id', x.intactes.slice(i, i + 200).map(t => t.id)), `tournées de ${x.p.nom}`)
  }
  console.log(`✅ ${x.p.nom} : commercial ; ${x.regles.length} règle(s) désactivée(s), ${x.intactes.length} tournée(s) à venir supprimée(s).`)
}
console.log('Retour arrière : role = merchandiser (et commercial_id d’avant), règles is_active = true, puis Maintenance › Recalculer les tournées.')
