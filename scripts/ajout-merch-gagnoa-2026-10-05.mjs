#!/usr/bin/env node
/**
 * Ajoute DJESSOU JEMIMA, merchandiser de Gagnoa (fichier client du 05/10/2026,
 * secteurs 509 à 530 de « ZONE SECTEUR ») :
 *   - compte créé s'il n'existe pas (mot de passe provisoire, changement imposé
 *     à la première connexion) ; un compte existant garde son mot de passe ;
 *   - profil : merchandiser, territoire GAGNOA, région CNO, commercial
 *     responsable KACOU LEONARD (cnofcgagnoa@gmail.com) ;
 *   - zones_secteurs : DJESSOU JEMIMA remplace KACOU LEONARD comme
 *     merchandiser des 22 secteurs (le secteur 508 GAGNOA/ZAPATA n'est pas
 *     dans le fichier et reste inchangé).
 *
 * Périmètre par territoire seulement (pas de quartiers) : le fichier couvre
 * tout Gagnoa, et les libellés « GAGNOA/… » de zones_secteurs ne sont pas
 * forcément ceux de pdv.quartier.
 *
 * Ensuite, pour lui donner sa tournée : node scripts/tournees-perimetre.mjs --apply
 *
 * Usage :
 *   node scripts/ajout-merch-gagnoa-2026-10-05.mjs                       # dry-run (défaut)
 *   node scripts/ajout-merch-gagnoa-2026-10-05.mjs --password=... --apply
 *   (sans --password, SEED_DEFAULT_PASSWORD du .env est utilisé)
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env') })

const APPLY = process.argv.includes('--apply')
const PASSWORD = process.argv.find(a => a.startsWith('--password='))?.split('=').slice(1).join('=')
  || process.env.SEED_DEFAULT_PASSWORD

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const MERCH = { email: 'djessoumima@gmail.com', nom: 'DJESSOU JEMIMA' }
const COMMERCIAL_EMAIL = 'cnofcgagnoa@gmail.com' // KACOU LEONARD
const ANCIEN_MERCH_EMAIL = 'cnofcgagnoa@gmail.com'
const PERIMETRE = {
  territoires_assignes: ['GAGNOA'],
  zone_assignee: 'GAGNOA',
  quartiers_assignes: [],
  region: 'CNO',
}
const SECTEURS = [
  'GAGNOA/GARAHIO', 'GAGNOA/DELBO 1 & 2', 'GAGNOA/CISSE KAMOUROU', 'GAGNOA/DIOULABOUGOU',
  'GAGNOA/SOLEIL', 'GAGNOA/DJANCA', 'GAGNOA/CAMP FONCTIONNAIRE', 'GAGNOA/AFRIDOUGOU',
  'GAGNOA/SECTEUR CIB & GUESSIO', 'GAGNOA/ZAPATA RESIDENTIEL', 'GAGNOA/SECTEUR COMMERCE',
  'GAGNOA/CAFOP & GODIABRE', 'GAGNOA/MAHIDIO', 'GAGNOA/CHATEAU', 'GAGNOA/BARHUO', 'GAGNOA/BABRE',
  'DIVO', 'OUME', 'LAKOTA', 'HIRE', 'TIASSALE', 'NDOUCI',
]

async function findAuthUser(email) {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const u = data.users.find(x => x.email?.toLowerCase() === email)
    if (u) return u
    if (data.users.length < 1000) return null
  }
}

async function main() {
  console.log(APPLY ? '=== APPLY ===' : '=== DRY-RUN (ajouter --apply pour écrire) ===')

  // 1. Commercial responsable
  const { data: commercial, error: errCom } = await supabase
    .from('profiles').select('id, nom, role').eq('email', COMMERCIAL_EMAIL).maybeSingle()
  if (errCom) throw errCom
  if (!commercial) throw new Error(`Commercial introuvable : ${COMMERCIAL_EMAIL}`)
  console.log(`Commercial : ${commercial.nom} (${commercial.role})`)

  // 2. Compte
  let user = await findAuthUser(MERCH.email)
  if (user) {
    console.log(`Compte existant ${MERCH.email} : mot de passe inchangé`)
  } else {
    console.log(`Compte absent → création de ${MERCH.email}`)
    if (APPLY) {
      if (!PASSWORD) throw new Error('Mot de passe requis : --password=... ou SEED_DEFAULT_PASSWORD')
      const { data, error } = await supabase.auth.admin.createUser({
        email: MERCH.email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { nom: MERCH.nom, role: 'merchandiser', must_change_password: true },
      })
      if (error) throw error
      user = data.user
    }
  }

  // 3. Profil (la ligne est créée par le trigger handle_new_user)
  const patch = {
    nom: MERCH.nom,
    email: MERCH.email,
    role: 'merchandiser',
    is_active: true,
    commercial_id: commercial.id,
    ...PERIMETRE,
  }
  console.log(`Profil : ${JSON.stringify(patch)}`)
  if (APPLY) {
    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)
    if (error) throw error
  }

  // 4. Référentiel zones_secteurs
  const { data: lignes, error: errZs } = await supabase
    .from('zones_secteurs').select('secteur, merchandiser')
    .eq('zone', 'GAGNOA').eq('email_merchandiser', ANCIEN_MERCH_EMAIL).in('secteur', SECTEURS)
  if (errZs) throw errZs
  console.log(`zones_secteurs : ${lignes.length}/${SECTEURS.length} secteurs passent à ${MERCH.nom}`)
  if (APPLY && lignes.length) {
    const { error } = await supabase
      .from('zones_secteurs')
      .update({ merchandiser: MERCH.nom, email_merchandiser: MERCH.email })
      .eq('zone', 'GAGNOA').eq('email_merchandiser', ANCIEN_MERCH_EMAIL).in('secteur', SECTEURS)
    if (error) throw error
  }

  console.log('\nTerminé.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
