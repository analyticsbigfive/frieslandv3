/**
 * create-commercial-accounts.mjs
 * 
 * Script pour créer les comptes auth Supabase et profils
 * pour les 19 commerciaux identifiés dans les CSV.
 * 
 * Utilise le service_role key pour créer les comptes admin-side.
 * 
 * Usage: node scripts/create-commercial-accounts.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config() // charge le .env

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis dans .env')
  process.exit(1)
}

// Client admin avec service_role key
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// Les 19 commerciaux extraits du CSV VISITE avec leurs emails réels
const commerciaux = [
  { nom: 'KADIA CINDY EMMANUELLA', email: 'abidjannordfccocody1@gmail.com', role: 'merchandiser', zone: 'COCODY 1', region: 'ABIDJAN 2' },
  { nom: 'ARMANDE KOUAKOUSSUI', email: 'abidjannordfcyopougon3@gmail.com', role: 'merchandiser', zone: 'YOPOUGON 3', region: 'ABIDJAN 2' },
  { nom: 'GAI KAMI', email: 'abidjannordfcyopougon3-2@gmail.com', role: 'merchandiser', zone: 'YOPOUGON 3', region: 'ABIDJAN 2' },  // Email dédupliqué
  { nom: 'N\'GUESSAN OPHELIA', email: 'abidjansudfcmarcory@gmail.com', role: 'merchandiser', zone: 'MARCORY', region: 'ABIDJAN 1' },
  { nom: 'RACHID ASSIROU', email: 'abidjannordabobo1@gmail.com', role: 'merchandiser', zone: 'ABOBO 1', region: 'ABIDJAN 2' },
  { nom: 'MURIEL SIOTENE', email: 'abidjannordfccocody1-2@gmail.com', role: 'merchandiser', zone: 'COCODY 1', region: 'ABIDJAN 2' },  // Email dédupliqué
  { nom: 'GUE HERMAN', email: 'cnefcbouake01@gmail.com', role: 'commercial', zone: 'BOUAKE', region: 'CENTRE' },
  { nom: 'ASSAMOI TRESOR', email: 'cnefcyamoussoukro@gmail.com', role: 'commercial', zone: 'YAMOUSSOUKRO', region: 'CENTRE' },
  { nom: 'COULIBALY PADIE', email: 'cnefckorhogo@gmail.com', role: 'commercial', zone: 'KORHOGO', region: 'NORD' },
  { nom: 'OUATTARA ZANGA', email: 'cnefcabengourou@gmail.com', role: 'commercial', zone: 'ABENGOUROU', region: 'EST' },
  { nom: 'SEWINDE NOUHOUN', email: 'nsinwinde@gmail.com', role: 'commercial', zone: '', region: '' },
  { nom: 'FLORENT N\'DJA', email: 'cnofcdaloa@gmail.com', role: 'commercial', zone: 'DALOA', region: 'OUEST' },
  { nom: 'EBROTTIE CHRISTIAN', email: 'fcouestsanpedro@gmail.com', role: 'commercial', zone: 'SAN PEDRO', region: 'OUEST' },
  { nom: 'KACOU LEONARD', email: 'cnofcgagnoa@gmail.com', role: 'commercial', zone: 'GAGNOA', region: 'OUEST' },
  { nom: 'ISMAEL KOUAKOU', email: 'kouakouismael.pro@gmail.com', role: 'commercial', zone: '', region: '' },
  { nom: 'YOUAN LOU MIREILLE', email: 'mireilleyuan@gmail.com', role: 'commercial', zone: '', region: '' },
  { nom: 'SONIA AKON', email: 'akonsoniasunshine@gmail.com', role: 'commercial', zone: 'MODERN TRADE', region: 'MODERN TRADE' },
  { nom: 'AKUNDAH ANNE MARIE', email: 'kouakouismael.pro+annemarie@gmail.com', role: 'commercial', zone: '', region: '' },  // Email dédupliqué
  { nom: 'KOUAKOUSSUI ALIDA', email: 'abidjannordfcyopougon3+alida@gmail.com', role: 'merchandiser', zone: 'YOPOUGON 3', region: 'ABIDJAN 2' },  // Email dédupliqué
]

// Compte merchandiser spécial pour Treichville
const merchandiserTreichville = {
  nom: 'Merchandiser Treichville',
  email: 'merchandiser@friesland.ci',
  role: 'merchandiser',
  zone: 'TREICHVILLE',
  region: 'ABIDJAN 1',
  secteurs: ['TREICHVILLE', 'MARCORY TREICHVILLE'],
}

const DEFAULT_PASSWORD = 'FrieslandCI2025!'

async function createAccount(user) {
  const { email, nom, role, zone, region } = user

  console.log(`\n📧 Traitement: ${nom} (${email})`)

  // 1. Vérifier si l'utilisateur existe déjà
  const { data: existingUsers } = await supabase.auth.admin.listUsers()
  const existing = existingUsers?.users?.find(u => u.email === email)

  let userId

  if (existing) {
    console.log(`  ✅ Compte auth existe déjà (id: ${existing.id})`)
    userId = existing.id
  } else {
    // 2. Créer le compte auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: DEFAULT_PASSWORD,
      email_confirm: true, // Confirmer l'email automatiquement
      user_metadata: { nom, role }
    })

    if (authError) {
      console.error(`  ❌ Erreur création auth: ${authError.message}`)
      return null
    }

    userId = authData.user.id
    console.log(`  ✅ Compte auth créé (id: ${userId})`)
  }

  // 3. Upsert le profil
  const profileData = {
    id: userId,
    email,
    nom,
    role,
    zone_assignee: zone || null,
    region: region || null,
    is_active: true,
    updated_at: new Date().toISOString(),
  }

  if (user.secteurs) {
    profileData.secteurs_assignes = JSON.stringify(user.secteurs)
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(profileData, { onConflict: 'id' })

  if (profileError) {
    console.error(`  ❌ Erreur profil: ${profileError.message}`)
    return null
  }

  console.log(`  ✅ Profil mis à jour: ${role} | zone: ${zone || 'N/A'} | region: ${region || 'N/A'}`)
  return userId
}

async function main() {
  console.log('🚀 Création des comptes commerciaux FrieslandCampina')
  console.log('=' .repeat(60))
  console.log(`📊 ${commerciaux.length} commerciaux + 1 merchandiser Treichville`)
  console.log(`🔑 Mot de passe par défaut: ${DEFAULT_PASSWORD}`)
  console.log('=' .repeat(60))

  let created = 0
  let updated = 0
  let errors = 0

  // Créer le compte merchandiser Treichville en premier
  const treichResult = await createAccount(merchandiserTreichville)
  if (treichResult) created++
  else errors++

  // Créer les comptes commerciaux
  // Dédupliquer par email (certains partagent le même email)
  const processedEmails = new Set()

  for (const commercial of commerciaux) {
    if (processedEmails.has(commercial.email)) {
      console.log(`\n⏭️  Skipping ${commercial.nom} (email déjà traité: ${commercial.email})`)
      continue
    }
    processedEmails.add(commercial.email)

    const result = await createAccount(commercial)
    if (result) created++
    else errors++
  }

  console.log('\n' + '=' .repeat(60))
  console.log(`✅ Terminé: ${created} comptes créés/mis à jour, ${errors} erreurs`)
  console.log('=' .repeat(60))
  console.log('\n📝 Prochaine étape: exécuter supabase/006_assign_treichville_and_commerciaux.sql')
}

main().catch(console.error)
