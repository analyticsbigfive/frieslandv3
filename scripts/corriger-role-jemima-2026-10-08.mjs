#!/usr/bin/env node
/**
 * Mme DJESSOU JEMIMA (djessoumima@gmail.com) est commerciale, pas
 * merchandiser (réunion client du 08/10/2026, Emmanuel). Créée merchandiser
 * pour Gagnoa le 05/10 (ajout-merch-gagnoa-2026-10-05.mjs).
 *
 *   1. Profil : role = commercial, commercial_id = NULL (un commercial n'a pas
 *      de commercial responsable), employeur = friesland, direction = north.
 *      Territoires et quartiers conservés (son périmètre de commerciale).
 *   2. Ses règles de tournée : désactivées (is_active = false).
 *   3. Ses tournées à venir qui n'ont pas commencé (toutes les étapes en
 *      attente) : supprimées. La tournée du jour et les visites restent.
 *   4. Signalé : les merchandisers encore rattachés à Gagnoa, pour vérifier
 *      que le territoire garde quelqu'un sur le terrain.
 *
 * Tout est lu et affiché avant la première écriture. Simulation par défaut.
 *
 * Usage :
 *   node scripts/corriger-role-jemima-2026-10-08.mjs            # simulation
 *   node scripts/corriger-role-jemima-2026-10-08.mjs --apply
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

const EMAIL = 'djessoumima@gmail.com'
const aujourdhui = new Date().toISOString().slice(0, 10)

const ok = ({ data, error }, quoi) => { if (error) throw new Error(`${quoi} : ${error.message}`); return data }

const profil = ok(await supabase.from('profiles').select('*').ilike('email', EMAIL).maybeSingle(), 'profil')
if (!profil) throw new Error(`Aucun profil pour ${EMAIL}`)
console.log(`Profil : ${profil.nom} <${profil.email}> — rôle ${profil.role}, employeur ${profil.employeur}, direction ${profil.direction ?? '—'}`)
console.log(`  territoires : ${(profil.territoires_assignes || []).join(', ') || '—'} ; quartiers : ${(profil.quartiers_assignes || []).length}`)

const regles = ok(await supabase.from('routing_templates').select('id,label,is_active,days_of_week').eq('user_id', profil.id), 'règles')
const tournees = await toutesLesLignes(() => supabase.from('routings')
  .select('id,date_routing,status,routing_pdv(status)').eq('user_id', profil.id).gt('date_routing', aujourdhui).order('id'))
const intactes = tournees.filter(t => t.status === 'pending' && (t.routing_pdv || []).every(e => e.status === 'pending'))
const { count: nbVisites } = await supabase.from('visites').select('id', { count: 'exact', head: true }).eq('user_id', profil.id)
const equipe = ok(await supabase.from('profiles').select('nom,email').eq('commercial_id', profil.id), 'équipe')

console.log(`\nRègles de tournée : ${regles.length} (${regles.filter(r => r.is_active !== false).length} actives)`)
for (const r of regles) console.log(`  - ${r.label} ${r.is_active === false ? '(déjà inactive)' : ''}`)
console.log(`Tournées à venir : ${tournees.length}, dont ${intactes.length} pas commencées (supprimées)`)
console.log(`Visites enregistrées : ${nbVisites ?? '?'} (conservées)`)
if (equipe.length) console.log(`Comptes qui la désignent comme commerciale : ${equipe.map(e => e.nom).join(', ')}`)

// Qui reste sur ses territoires comme merchandiser ?
const territoires = (profil.territoires_assignes || []).filter(Boolean)
const merchs = ok(await supabase.from('profiles').select('nom,email,territoires_assignes,zone_assignee,is_active')
  .eq('role', 'merchandiser').neq('id', profil.id), 'merchandisers')
const surPlace = merchs.filter(m => m.is_active !== false
  && [...(m.territoires_assignes || []), m.zone_assignee].some(t => territoires.includes(t)))
console.log(`\nMerchandisers actifs restant sur ${territoires.join(', ') || 'ses territoires'} : ${surPlace.length ? surPlace.map(m => `${m.nom} <${m.email}>`).join(', ') : 'AUCUN — à signaler au client'}`)

const patch = { role: 'commercial', commercial_id: null, employeur: 'friesland', direction: 'north' }
console.log(`\nProfil après correction : ${JSON.stringify(patch)}`)

if (!APPLY) {
  console.log('\nSIMULATION : aucune écriture. Relancer avec --apply.')
  process.exit(0)
}

// direction : migration 20261008110000 ; sans elle, le reste est appliqué.
let r = await supabase.from('profiles').update(patch).eq('id', profil.id)
if (r.error && /direction/i.test(r.error.message)) {
  const { direction, ...sansDirection } = patch
  r = await supabase.from('profiles').update(sansDirection).eq('id', profil.id)
  console.log('⚠ Colonne direction absente (migration 20261008110000) : à régler ensuite dans Paramètres › Utilisateurs.')
}
ok(r, 'profil')
if (regles.some(x => x.is_active !== false)) ok(await supabase.from('routing_templates').update({ is_active: false }).eq('user_id', profil.id), 'règles')
for (let i = 0; i < intactes.length; i += 200) {
  ok(await supabase.from('routings').delete().in('id', intactes.slice(i, i + 200).map(t => t.id)), 'tournées à venir')
}
console.log(`\n✅ ${profil.nom} est commerciale ; ${regles.length} règle(s) désactivée(s), ${intactes.length} tournée(s) à venir supprimée(s).`)
console.log('Retour arrière : role = merchandiser, commercial_id = (KACOU LEONARD), règles is_active = true, puis Maintenance › Recalculer les tournées.')
