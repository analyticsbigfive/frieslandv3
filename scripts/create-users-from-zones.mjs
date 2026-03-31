/**
 * Script de création des utilisateurs Supabase à partir de la table zones_secteurs
 *
 * Lit les merchandisers et sales_reps uniques depuis zones_secteurs,
 * puis crée un compte auth + profile pour chacun.
 *
 * Pré-requis:
 *   - Variables d'environnement SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY
 *     (soit dans .env, soit passées en ligne de commande)
 *   - npm install @supabase/supabase-js dotenv
 *
 * Usage:
 *   node scripts/create-users-from-zones.mjs
 *   node scripts/create-users-from-zones.mjs --dry-run    # prévisualiser sans créer
 *   node scripts/create-users-from-zones.mjs --password=MonMotDePasse123
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env') })

// ── Config ──────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Variables manquantes: SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY')
  console.error('   Ajoutez SUPABASE_SERVICE_ROLE_KEY dans votre fichier .env')
  console.error('   (Trouvable dans Supabase Dashboard > Settings > API > service_role)')
  process.exit(1)
}

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const passwordArg = args.find(a => a.startsWith('--password='))
const DEFAULT_PASSWORD = passwordArg ? passwordArg.split('=')[1] : 'Friesland2024!'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Étape 1: Lire les emails uniques depuis zones_secteurs ──
async function fetchUniqueUsers() {
  const { data, error } = await supabase
    .from('zones_secteurs')
    .select('zone, merchandiser, email_merchandiser, sales_rep, email_sales_rep, region')

  if (error) throw new Error(`Erreur lecture zones_secteurs: ${error.message}`)

  const usersMap = new Map()

  for (const row of data) {
    // Merchandiser
    if (row.email_merchandiser && row.merchandiser) {
      const email = row.email_merchandiser.trim().toLowerCase()
      if (!usersMap.has(email)) {
        usersMap.set(email, {
          email,
          nom: row.merchandiser.trim(),
          role: 'merchandiser',
          zone_assignee: row.zone,
          region: row.region,
          zones: new Set([row.zone]),
        })
      } else {
        usersMap.get(email).zones.add(row.zone)
      }
    }

    // Sales rep
    if (row.email_sales_rep && row.sales_rep) {
      const email = row.email_sales_rep.trim().toLowerCase()
      if (!usersMap.has(email)) {
        usersMap.set(email, {
          email,
          nom: row.sales_rep.trim(),
          role: 'commercial',
          zone_assignee: row.zone,
          region: row.region,
          zones: new Set([row.zone]),
        })
      } else {
        usersMap.get(email).zones.add(row.zone)
      }
    }
  }

  return [...usersMap.values()]
}

// ── Étape 2: Vérifier les utilisateurs existants ────────────
async function fetchExistingEmails() {
  const { data, error } = await supabase
    .from('profiles')
    .select('email')

  if (error) throw new Error(`Erreur lecture profiles: ${error.message}`)
  return new Set(data.map(p => p.email.toLowerCase()))
}

// ── Étape 3: Créer les comptes ──────────────────────────────
async function createUser(userData) {
  // Créer l'utilisateur auth (email confirmé automatiquement)
  const { data, error } = await supabase.auth.admin.createUser({
    email: userData.email,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: {
      nom: userData.nom,
      role: userData.role,
    },
  })

  if (error) {
    return { success: false, email: userData.email, error: error.message }
  }

  // Mettre à jour le profile avec zone et region
  // (le trigger DB crée le profile automatiquement au signup)
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      nom: userData.nom,
      role: userData.role,
      zone_assignee: userData.zone_assignee,
      region: userData.region,
    })
    .eq('id', data.user.id)

  if (profileError) {
    return { success: true, email: userData.email, warning: `Profile update failed: ${profileError.message}` }
  }

  return { success: true, email: userData.email, id: data.user.id }
}

// ── Main ────────────────────────────────────────────────────
async function main() {
  console.log('🔍 Lecture des utilisateurs depuis zones_secteurs...\n')

  const users = await fetchUniqueUsers()
  console.log(`   ${users.length} emails uniques trouvés\n`)

  const existingEmails = await fetchExistingEmails()
  console.log(`   ${existingEmails.size} utilisateurs déjà existants dans profiles\n`)

  const toCreate = users.filter(u => !existingEmails.has(u.email))
  const alreadyExist = users.filter(u => existingEmails.has(u.email))

  if (alreadyExist.length > 0) {
    console.log(`⏩ ${alreadyExist.length} utilisateur(s) déjà existant(s):`)
    alreadyExist.forEach(u => console.log(`   - ${u.email} (${u.nom})`))
    console.log()
  }

  if (toCreate.length === 0) {
    console.log('✅ Tous les utilisateurs existent déjà. Rien à faire.')
    return
  }

  console.log(`📝 ${toCreate.length} utilisateur(s) à créer:\n`)
  toCreate.forEach(u => {
    console.log(`   ${u.nom.padEnd(30)} ${u.email.padEnd(40)} ${u.role.padEnd(15)} zone: ${u.zone_assignee}`)
  })
  console.log()

  if (DRY_RUN) {
    console.log('🔶 Mode --dry-run: aucun utilisateur créé.')
    console.log(`   Relancez sans --dry-run pour créer les ${toCreate.length} comptes.`)
    console.log(`   Mot de passe par défaut: ${DEFAULT_PASSWORD}`)
    return
  }

  console.log(`🚀 Création des comptes (mot de passe: ${DEFAULT_PASSWORD})...\n`)

  let created = 0
  let errors = 0

  for (const userData of toCreate) {
    const result = await createUser(userData)
    if (result.success) {
      created++
      const warn = result.warning ? ` ⚠️ ${result.warning}` : ''
      console.log(`   ✅ ${userData.email} → ${userData.nom} (${userData.role})${warn}`)
    } else {
      errors++
      console.log(`   ❌ ${userData.email} → ${result.error}`)
    }

    // Petite pause pour ne pas surcharger l'API
    await new Promise(r => setTimeout(r, 200))
  }

  console.log(`\n📊 Résultat: ${created} créé(s), ${errors} erreur(s), ${alreadyExist.length} déjà existant(s)`)
  console.log(`\n💡 Les utilisateurs peuvent se connecter avec:`)
  console.log(`   Email: leur email`)
  console.log(`   Mot de passe: ${DEFAULT_PASSWORD}`)
  console.log(`   ⚠️  Pensez à leur demander de changer leur mot de passe !`)
}

main().catch(err => {
  console.error('💥 Erreur fatale:', err.message)
  process.exit(1)
})
