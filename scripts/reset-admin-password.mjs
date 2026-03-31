// Script pour réinitialiser le mot de passe de admin@friesland.ci
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config()

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis dans .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const ADMIN_EMAIL = 'admin@friesland.ci'
const NEW_PASSWORD = 'FrieslandAdmin2026!'

async function main() {
  const { data, error } = await supabase.auth.admin.listUsers()
  if (error) throw error
  const admin = data.users.find(u => u.email === ADMIN_EMAIL)
  if (!admin) {
    console.error('❌ admin@friesland.ci introuvable')
    process.exit(1)
  }
  const { error: pwError } = await supabase.auth.admin.updateUserById(admin.id, { password: NEW_PASSWORD })
  if (pwError) {
    console.error('❌ Erreur réinitialisation:', pwError.message)
    process.exit(1)
  }
  console.log(`✅ Mot de passe réinitialisé pour ${ADMIN_EMAIL}: ${NEW_PASSWORD}`)
}

main().catch(console.error)
