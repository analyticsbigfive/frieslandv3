#!/usr/bin/env node
/**
 * Guehi Daniel remplace Moustapha N'Diaye (Port-Bouët, Bassam, Bonoua), parti
 * le 09/10/2026 (scripts/reponses-client-2026-10-09.mjs avait désactivé le
 * compte). Décisions de Jean Luc du 18/11/2026 :
 *
 *   1. Même compte (portbouetone@gmail.com), comme Gui Stéphane le 09/10 :
 *      nom → GUEHI DANIEL, téléphone → --telephone, compte réactivé.
 *      Les visites de Moustapha (jusqu'au 09/10) restent sur ce compte et
 *      s'affichent donc sous le nouveau nom.
 *   2. Mot de passe inchangé.
 *   3. Territoires : noms du référentiel (PORT-BOUËT 1, PORT-BOUËT 2, BASSAM,
 *      BONOUA) au lieu de PORT-BOUET, BASSAM 1, BASSAM 2.
 *
 * Non touché : les 3 anciennes règles de tournée (désactivées le 09/10,
 * ancienne logique), zone_assignee, quartiers_assignes, commercial
 * responsable. Guehi Daniel n'est ni Guihi Bernadin (Cocody) ni Gui Stéphane
 * (Marcory-Treichville).
 *
 * Simulation par défaut ; avec --apply, le retour arrière est écrit dans
 * ~/Downloads.
 *
 * Usage :
 *   node scripts/remplacement-portbouet-2026-11-18.mjs --telephone=+225XXXXXXXXXX
 *   node scripts/remplacement-portbouet-2026-11-18.mjs --telephone=+225XXXXXXXXXX --apply
 * (appliqué le 18/11/2026)
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env'), quiet: true })
const APPLY = process.argv.includes('--apply')

const COMPTE = 'portbouetone@gmail.com'
const ANCIEN_NOM = "MOUSTAPHA N'DIAYE"
const NOM = 'GUEHI DANIEL'
// Hors du dépôt, comme dans reponses-client-2026-10-09.mjs.
const TELEPHONE = process.argv.find(a => a.startsWith('--telephone='))?.split('=')[1]
if (!TELEPHONE || !/^\+225\d{10}$/.test(TELEPHONE)) {
  console.error('--telephone=+225XXXXXXXXXX requis (format des autres fiches).')
  process.exit(1)
}
const TERRITOIRES = ['PORT-BOUËT 1', 'PORT-BOUËT 2', 'BASSAM', 'BONOUA']

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const must = ({ data, error }, quoi) => { if (error) throw new Error(`${quoi} : ${error.message}`); return data }

// ---- Lecture -----------------------------------------------------------------
const lignes = must(await supabase.from('profiles')
  .select('id,nom,telephone,is_active,role,employeur,territoires_assignes').eq('email', COMPTE), 'compte de Port-Bouët')
if (lignes.length !== 1) throw new Error(`${COMPTE} : ${lignes.length} compte(s), un seul attendu`)
const compte = lignes[0]
if (![ANCIEN_NOM, NOM].includes(compte.nom)) throw new Error(`${COMPTE} porte le nom « ${compte.nom} », inattendu : rien n'est fait`)
if (compte.role !== 'merchandiser' || compte.employeur !== 'atom') throw new Error(`${COMPTE} n'est pas un merchandiser Atom`)

const referentiel = must(await supabase.from('territoire').select('nom').in('nom', TERRITOIRES).eq('actif', true), 'référentiel des territoires')
const absents = TERRITOIRES.filter(t => !referentiel.some(r => r.nom === t))
if (absents.length) throw new Error(`Territoires absents du référentiel : ${absents.join(', ')}`)

const homonymes = must(await supabase.from('profiles').select('nom,email,is_active').ilike('nom', '%GUEHI%').neq('id', compte.id), 'homonymes')
const memeTel = must(await supabase.from('profiles').select('nom,email').eq('telephone', TELEPHONE).neq('id', compte.id), 'téléphone')
if (homonymes.length) throw new Error(`Un compte porte déjà ce nom : ${homonymes.map(h => h.email).join(', ')}`)
if (memeTel.length) throw new Error(`Téléphone déjà sur un autre compte : ${memeTel.map(h => h.email).join(', ')}`)

const auth = must(await supabase.auth.admin.getUserById(compte.id), 'compte de connexion').user

const patch = { nom: NOM, telephone: TELEPHONE, is_active: true, territoires_assignes: TERRITOIRES }
console.log(`\n${COMPTE}`)
console.log(`  nom         : « ${compte.nom} » → « ${NOM} »`)
console.log(`  téléphone   : ${compte.telephone || '—'} → ${TELEPHONE}`)
console.log(`  compte      : ${compte.is_active ? 'actif' : 'désactivé'} → actif`)
console.log(`  territoires : ${JSON.stringify(compte.territoires_assignes)} → ${JSON.stringify(TERRITOIRES)}`)
console.log('  mot de passe inchangé')

if (!APPLY) {
  console.log('\nSimulation : rien n’a été écrit. Relancer avec --apply.')
  process.exit(0)
}

// ---- Retour arrière, puis écritures ------------------------------------------
const retour = {
  compte: COMPTE,
  profil: { nom: compte.nom, telephone: compte.telephone, is_active: compte.is_active, territoires_assignes: compte.territoires_assignes },
  user_metadata_nom: auth?.user_metadata?.nom ?? null,
}
const fichierRetour = join(homedir(), 'Downloads', `retour-remplacement-portbouet-2026-11-18-${Date.now()}.json`)
writeFileSync(fichierRetour, JSON.stringify(retour, null, 2))
console.log(`\nRetour arrière : ${fichierRetour}`)

must(await supabase.from('profiles').update(patch).eq('id', compte.id).select('id'), 'profil')
console.log('  ✓ profil')
const { error: eAuth } = await supabase.auth.admin.updateUserById(compte.id, {
  user_metadata: { ...(auth?.user_metadata || {}), nom: NOM },
})
if (eAuth) throw new Error(`nom du compte de connexion : ${eAuth.message}`)
console.log('  ✓ nom du compte de connexion')

const apres = must(await supabase.from('profiles').select('nom,telephone,is_active,territoires_assignes').eq('id', compte.id).single(), 'relecture')
console.log(`\nRelu en base : ${JSON.stringify(apres)}`)
