// Publie un APK dans le bucket public `apk` et affiche le lien de téléchargement
// direct à diffuser aux testeurs (installation hors Play Store).
//
// Usage: node scripts/upload-apk.mjs dist-apk/friesland-bonnet-rouge-1.0.5-release.apk [--latest]
//
//   friesland-bonnet-rouge-<version>.apk   lien figé, une URL par version
//   friesland-bonnet-rouge-latest.apk      avec --latest : lien stable écrasé à
//                                          chaque publication, à ne diffuser qu'une fois
// Le contentType doit être application/vnd.android.package-archive : sans lui,
// Chrome télécharge le fichier sans proposer l'installation.
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { readFileSync } from 'fs'
import { basename } from 'path'

config()
const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('❌ SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY requis dans .env'); process.exit(1) }

const args = process.argv.slice(2)
const avecLatest = args.includes('--latest')
const source = args.find(a => !a.startsWith('--'))
if (!source) { console.error('❌ usage: node scripts/upload-apk.mjs <chemin/vers/app.apk> [--latest]'); process.exit(1) }

// « friesland-bonnet-rouge-1.0.5-release.apk » → « 1.0.5 »
const version = (basename(source).match(/(\d+\.\d+\.\d+)/) || [])[1]
if (!version) { console.error(`❌ version introuvable dans le nom « ${basename(source)} »`); process.exit(1) }

const CONTENT_TYPE = 'application/vnd.android.package-archive'
const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const contenu = readFileSync(source)

const cibles = [`friesland-bonnet-rouge-${version}.apk`]
if (avecLatest) cibles.push('friesland-bonnet-rouge-latest.apk')

for (const cible of cibles) {
  const { error } = await sb.storage.from('apk').upload(cible, contenu, { contentType: CONTENT_TYPE, upsert: true })
  if (error) { console.error(`❌ ${cible}: ${error.message}`); process.exit(1) }
  console.log(`✅ ${cible}  (${Math.round(contenu.length / 1024)} Ko)`)
  console.log(`   ${URL}/storage/v1/object/public/apk/${cible}`)
}
