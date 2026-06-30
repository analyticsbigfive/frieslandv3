// Crée le compte admin@friesland.ci via l'API admin (service_role).
// Fallback quand reset-admin-password.mjs renvoie "admin introuvable" (projet vide).
// Usage: node scripts/create-admin.mjs
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config()

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis dans .env')
  process.exit(1)
}

const ADMIN_EMAIL = 'admin@friesland.ci'
const ADMIN_PASSWORD = 'Test1234!'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data, error } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { nom: 'Admin', role: 'admin' },
  })
  if (error) {
    console.error('❌', error.message)
    process.exit(1)
  }

  // Le trigger handle_new_user crée le profil avec role 'merchandiser' par défaut :
  // forcer le role admin.
  const { error: roleError } = await supabase
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', data.user.id)
  if (roleError) {
    console.warn('⚠️  user créé mais role non mis à jour:', roleError.message)
    console.warn('   → mettre role=admin manuellement dans la table profiles.')
  }

  console.log(`✅ admin créé: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD} (role admin)`)
}

main().catch((e) => { console.error('❌', e); process.exit(1) })
