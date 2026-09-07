// Export read-only des comptes utilisateurs, pour constituer la liste de testeurs
// (Google Play — test interne/fermé) et les invitations.
//
// Usage: node scripts/export-emails-testeurs.mjs
// Sorties (scripts/out/, gitignoré — ces fichiers contiennent des données personnelles) :
//   utilisateurs.csv        toutes les colonnes utiles, un compte par ligne
//   testeurs-google.csv     emails Google uniquement, un par ligne, SANS en-tête :
//                           Play Console lit chaque ligne comme une adresse, un
//                           en-tête « email » serait importé comme un testeur invalide.
//
// ⚠️ Croise auth.users (source de vérité des identifiants) et profiles (métier).
// Un profil sans compte auth ne peut pas se connecter : il est marqué "sans_compte_auth".
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

config()
const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('❌ SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY requis dans .env'); process.exit(1) }

const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'out')

// auth.users : pagination explicite, listUsers plafonne à 50 par défaut.
const authUsers = []
for (let page = 1; ; page++) {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
  if (error) { console.error('❌ listUsers:', error.message); process.exit(1) }
  authUsers.push(...data.users)
  if (data.users.length < 200) break
}

const { data: profiles, error } = await sb.from('profiles')
  .select('id, email, nom, role, zone_assignee, region, is_active')
  .order('role').order('nom')
if (error) { console.error('❌ profiles:', error.message); process.exit(1) }

const parId = new Map(authUsers.map(u => [u.id, u]))
const iso = d => (d ? new Date(d).toISOString().slice(0, 10) : '')
// Un compte Google est requis pour rejoindre un test Play : gmail/googlemail, ou
// un domaine Workspace. On ne devine pas Workspace — les autres sont à vérifier.
const estGoogle = e => /@(gmail|googlemail)\.com$/i.test(e || '')

const lignes = profiles.map(p => {
  const u = parId.get(p.id)
  const email = (u?.email || p.email || '').trim().toLowerCase()
  return {
    email,
    nom: p.nom || '',
    role: p.role || '',
    zone: p.zone_assignee || '',
    region: p.region || '',
    actif: p.is_active === false ? 'non' : 'oui',
    compte: u ? (u.email_confirmed_at ? 'confirmé' : 'non confirmé') : 'sans_compte_auth',
    derniere_connexion: iso(u?.last_sign_in_at),
    compte_google: estGoogle(email) ? 'oui' : 'à vérifier',
  }
})

const champs = ['email', 'nom', 'role', 'zone', 'region', 'actif', 'compte', 'derniere_connexion', 'compte_google']
const echappe = v => (/[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
const csv = [champs.join(','), ...lignes.map(l => champs.map(c => echappe(l[c])).join(','))].join('\n')

// Play Console n'accepte qu'un email par compte testeur : on déduplique.
const testeurs = [...new Set(lignes.filter(l => l.actif === 'oui' && estGoogle(l.email)).map(l => l.email))].sort()

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'utilisateurs.csv'), csv + '\n')
writeFileSync(join(OUT, 'testeurs-google.csv'), testeurs.join('\n') + '\n')

const parRole = lignes.reduce((acc, l) => {
  const r = l.role || '(sans rôle)'
  return { ...acc, [r]: (acc[r] || 0) + 1 }
}, {})
console.log(`${lignes.length} comptes — ` + Object.entries(parRole).map(([r, n]) => `${r}: ${n}`).join(', '))
console.log(`${testeurs.length} emails Google actifs → scripts/out/testeurs-google.csv`)
console.log('détail complet → scripts/out/utilisateurs.csv')

const sansAuth = lignes.filter(l => l.compte === 'sans_compte_auth')
if (sansAuth.length) console.log(`⚠️  ${sansAuth.length} profil(s) sans compte auth : ${sansAuth.map(l => l.email || l.nom).join(', ')}`)
const nonGoogle = lignes.filter(l => l.actif === 'oui' && !estGoogle(l.email))
if (nonGoogle.length) console.log(`⚠️  ${nonGoogle.length} compte(s) actif(s) sans email Google (inutilisables tels quels dans Play Console) : ${nonGoogle.map(l => l.email).join(', ')}`)
