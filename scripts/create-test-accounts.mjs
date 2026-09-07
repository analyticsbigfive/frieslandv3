#!/usr/bin/env node
/**
 * Comptes de test — un par rôle — pour vérifier le cloisonnement 1.0.4 sur
 * téléphone et dans le dashboard. Idempotent : un compte existant est mis à
 * jour (rôle, périmètre), jamais dupliqué. Mot de passe = SEED_DEFAULT_PASSWORD
 * du .env (jamais imprimé).
 *
 * Périmètre terrain : zone ZONE_QA (défaut BOUAKE 1, la plus active fin août
 * 2026), sans contrainte de quartier — le commercial QA voit donc toutes les
 * visites de ce territoire, le merchandiser QA n'en a aucune à lui.
 *
 * Usage : node scripts/create-test-accounts.mjs [--zone "BOUAKE 1"]
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config()

const URL = process.env.SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const PASSWORD = process.env.SEED_DEFAULT_PASSWORD
if (!URL || !SERVICE || !PASSWORD) {
  console.error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY et SEED_DEFAULT_PASSWORD requis dans .env')
  process.exit(1)
}
const zoneArg = process.argv.indexOf('--zone')
const ZONE = zoneArg > -1 ? process.argv[zoneArg + 1] : 'BOUAKE 1'

const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })

const COMPTES = [
  { email: 'qa.admin@friesland-test.ci', nom: 'QA Admin', role: 'admin', zone: null },
  { email: 'qa.superviseur@friesland-test.ci', nom: 'QA Superviseur', role: 'superviseur', zone: null },
  { email: 'qa.merchandiser@friesland-test.ci', nom: 'QA Merchandiser', role: 'merchandiser', zone: ZONE },
  { email: 'qa.commercial@friesland-test.ci', nom: 'QA Commercial', role: 'commercial', zone: ZONE },
]

async function trouverUser(email) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw error
  return data.users.find(u => u.email?.toLowerCase() === email)
}

for (const c of COMPTES) {
  let user = await trouverUser(c.email)
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: c.email, password: PASSWORD, email_confirm: true,
      user_metadata: { nom: c.nom, role: c.role, must_change_password: false },
    })
    if (error) { console.error('❌', c.email, error.message); process.exit(1) }
    user = data.user
  }
  else {
    await admin.auth.admin.updateUserById(user.id, {
      password: PASSWORD,
      user_metadata: { ...user.user_metadata, nom: c.nom, role: c.role, must_change_password: false },
    })
  }
  const { error: pe } = await admin.from('profiles').upsert({
    id: user.id, email: c.email, nom: c.nom, role: c.role, is_active: true,
    zone_assignee: c.zone, territoires_assignes: c.zone ? [c.zone] : [], quartiers_assignes: [], region: null,
  }, { onConflict: 'id' })
  if (pe) { console.error('❌ profil', c.email, pe.message); process.exit(1) }
  console.log(`✅ ${c.role.padEnd(12)} ${c.email}${c.zone ? `  (zone ${c.zone})` : ''}`)
}
console.log('\nMot de passe : SEED_DEFAULT_PASSWORD du .env.')
