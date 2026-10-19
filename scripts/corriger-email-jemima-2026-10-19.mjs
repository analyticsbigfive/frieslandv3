#!/usr/bin/env node
/**
 * Mme DJESSOU JEMIMA : email de connexion djessoumima@gmail.com remplacé par
 * son adresse professionnelle Jemima.Djessou@frieslandcampina.com (demande du
 * 19/10/2026). Rôle et périmètre inchangés.
 *
 * Le changement depuis Paramètres › Utilisateurs échouait sans le dire : le
 * formulaire n'envoyait pas l'email (corrigé par la route
 * /api/admin/users/[id]/email). Ce script fait la même chose pour son compte,
 * sans attendre le déploiement :
 *   1. auth.users : email changé par l'API admin, confirmé d'office (pas de
 *      mail). Pas d'UPDATE SQL direct : auth.identities resterait sur l'ancien.
 *   2. profiles.email : même valeur.
 * Email stocké en minuscules, comme tous les comptes ; la connexion ignore la
 * casse, elle peut le saisir avec ses majuscules. Son mot de passe ne change pas.
 *
 * Tout est lu et affiché avant la première écriture. Simulation par défaut.
 *
 * Usage :
 *   node scripts/corriger-email-jemima-2026-10-19.mjs            # simulation
 *   node scripts/corriger-email-jemima-2026-10-19.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env'), quiet: true })
const APPLY = process.argv.includes('--apply')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const ANCIEN = 'djessoumima@gmail.com'
const NOUVEAU = 'Jemima.Djessou@frieslandcampina.com'.toLowerCase()

const ok = ({ data, error }, quoi) => { if (error) throw new Error(`${quoi} : ${error.message}`); return data }

const profil = ok(await supabase.from('profiles').select('id,nom,email,role,is_active').ilike('email', ANCIEN).maybeSingle(), 'profil')
if (!profil) {
  const dejaFait = ok(await supabase.from('profiles').select('id,nom,email').ilike('email', NOUVEAU).maybeSingle(), 'profil')
  if (dejaFait) { console.log(`Déjà fait : ${dejaFait.nom} <${dejaFait.email}>.`); process.exit(0) }
  throw new Error(`Aucun profil pour ${ANCIEN}`)
}
const { user } = ok(await supabase.auth.admin.getUserById(profil.id), 'compte auth')
console.log(`Profil : ${profil.nom} <${profil.email}> — rôle ${profil.role}, ${profil.is_active ? 'actif' : 'inactif'}`)
console.log(`Auth   : <${user.email}>, dernière connexion ${user.last_sign_in_at ?? 'jamais'}`)

const pris = ok(await supabase.from('profiles').select('id,nom').ilike('email', NOUVEAU).neq('id', profil.id), 'unicité')
if (pris.length) throw new Error(`${NOUVEAU} déjà utilisé par ${pris.map(p => p.nom).join(', ')}`)

console.log(`\nNouvel email (auth + profil) : ${NOUVEAU}`)

if (!APPLY) {
  console.log('\nSIMULATION : aucune écriture. Relancer avec --apply.')
  process.exit(0)
}

ok(await supabase.auth.admin.updateUserById(profil.id, { email: NOUVEAU, email_confirm: true }), 'email auth')
const r = await supabase.from('profiles').update({ email: NOUVEAU }).eq('id', profil.id)
if (r.error) {
  await supabase.auth.admin.updateUserById(profil.id, { email: user.email, email_confirm: true })
  throw new Error(`profil : ${r.error.message} (email auth rétabli sur ${user.email})`)
}
console.log(`\n✅ ${profil.nom} se connecte désormais avec ${NOUVEAU} (même mot de passe).`)
console.log(`Retour arrière : relancer avec ANCIEN et NOUVEAU inversés.`)
