#!/usr/bin/env node
/**
 * Nettoyage des comptes merchandisers Atom BTL après la liste client du
 * 24/09/2026 (sync-merch-accounts-2026-09-24.mjs) et l'ajout de Gagnoa (05/10) :
 *
 *   1. Anciens comptes remplacés (cocodytwo@, yopougontwo@, koumassione@,
 *      portbouetmerchone@) : désactivés, leurs règles de tournée désactivées,
 *      leurs tournées à venir supprimées. Visites et historique conservés.
 *   2. KACOU LEONARD (cnofcgagnoa@), devenu commercial : sa règle « Portefeuille
 *      périmètre — GAGNOA » et ses tournées à venir sont retirées (DJESSOU
 *      JEMIMA tient maintenant Gagnoa).
 *   3. zones_secteurs et csv/VISITE - ZONE SECTEUR.csv : anciens emails → nouveaux.
 *   4. Noms : portbouetone@ = MOUSTAPHA N'DIAYE (fichier client).
 *      cocodymerchtwo@ : GUIHI BERNADIN en base, DIABATE IDRISSA dans les fichiers
 *      → signalé, pas modifié (à trancher par le client).
 *   5. Périmètres Atom réalignés sur ZONE SECTEUR (territoires hors zone retirés) :
 *      le périmètre ne sert qu'au contrôle admin, la tournée vient du portefeuille DMS.
 *
 * Tout est lu et comparé avant la première écriture. Simulation par défaut.
 *
 * Usage :
 *   node scripts/nettoyage-comptes-atom-2026-10-06.mjs            # dry-run
 *   node scripts/nettoyage-comptes-atom-2026-10-06.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { toutesLesLignes } from './lib/dms.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env'), quiet: true })
const APPLY = process.argv.includes('--apply')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const aujourdhui = new Date().toISOString().slice(0, 10)

// ancien email → nouveau
const REMPLACES = {
  'cocodytwo@gmail.com': 'cocodymerchtwo@gmail.com',
  'yopougontwo@gmail.com': 'yopougonmerchtwo@gmail.com',
  'koumassione@gmail.com': 'koumassimerchone@gmail.com',
  'portbouetmerchone@gmail.com': 'portbouetone@gmail.com',
}
const COMMERCIAL_GAGNOA = 'cnofcgagnoa@gmail.com'
const NOMS = { 'portbouetone@gmail.com': "MOUSTAPHA N'DIAYE" }
// cocodymerchtwo@ : GUIHI BERNADIN a remplacé DIABATE IDRISSA fin septembre
// (export Bonnet Rouge : Diabaté 955 visites juin → sept., Bernadin 134 visites
// sur 5 jours fin sept.). Décision du 06/10 : la base (BERNADIN) fait foi, le
// CSV ZONE SECTEUR est corrigé.
const RENOMMAGES_CSV = { 'DIABATE IDRISSA': 'GUIHI BERNADIN' }
// Périmètre (territoires) d'après csv/VISITE - ZONE SECTEUR.csv — SEULEMENT les
// 4 comptes sans fichier DMS. Les 6 comptes DMS gardent le périmètre élargi aux
// zones réelles de leurs clients (affecter-merch-dms.mjs), sinon le sélecteur
// « nouvelle visite » et les règles admin perdraient leurs PDV.
const PERIMETRES = {
  'abobomerchone@gmail.com': ['ABOBO 1'],
  'koumassimerchone@gmail.com': ['KOUMASSI'],
  'marcorytreichone@gmail.com': ['TREICHVILLE', 'MARCORY'],
  'portbouetone@gmail.com': ['PORT-BOUET', 'BASSAM 1', 'BASSAM 2'],
}
const CSV = resolve(__dirname, '..', 'csv', 'VISITE - ZONE SECTEUR.csv')

// ---------- Lecture ----------

const COLS_PROFIL = 'id,email,nom,role,is_active,zone_assignee,territoires_assignes,quartiers_assignes,commercial_id'
// `employeur` n'existe qu'après la migration 20261006100000 : sans elle, on lit
// le reste et on le signale dans le rapport.
const profils = await toutesLesLignes(() => supabase.from('profiles').select(`${COLS_PROFIL},employeur`).order('id'))
  .catch(async (e) => {
    if (!/employeur/.test(e.message)) throw e
    return toutesLesLignes(() => supabase.from('profiles').select(COLS_PROFIL).order('id'))
  })
const parEmail = new Map(profils.map(p => [p.email.toLowerCase(), p]))
const idsConcernes = [...Object.keys(REMPLACES), ...Object.values(REMPLACES), COMMERCIAL_GAGNOA, ...Object.keys(PERIMETRES)]
  .map(e => parEmail.get(e)?.id).filter(Boolean)

const [regles, tourneesAVenir, zones] = await Promise.all([
  toutesLesLignes(() => supabase.from('routing_templates').select('id,user_id,label,is_active').in('user_id', idsConcernes).order('id')),
  toutesLesLignes(() => supabase.from('routings').select('id,user_id,date_routing,status').in('user_id', idsConcernes).gte('date_routing', aujourdhui).order('id')),
  toutesLesLignes(() => supabase.from('zones_secteurs').select('id,zone,secteur,merchandiser,email_merchandiser').order('id')),
])

const actions = []
const anomalies = []
const log = (m) => actions.push(m)

// 1. Anciens comptes
const aDesactiver = []
for (const [ancien, nouveau] of Object.entries(REMPLACES)) {
  const pa = parEmail.get(ancien), pn = parEmail.get(nouveau)
  if (!pn) { anomalies.push(`nouveau compte absent : ${nouveau}`); continue }
  if (!pa) { log(`${ancien} : déjà absent`); continue }
  const r = regles.filter(x => x.user_id === pa.id && x.is_active)
  const t = tourneesAVenir.filter(x => x.user_id === pa.id)
  aDesactiver.push({ p: pa, regles: r, tournees: t })
  log(`${ancien} → désactivé (${pa.is_active ? 'actif' : 'déjà inactif'}), ${r.length} règle(s) désactivée(s), ${t.length} tournée(s) à venir supprimée(s) ; remplacé par ${nouveau}`)
}

// 2. KACOU LEONARD
const kacou = parEmail.get(COMMERCIAL_GAGNOA)
const reglesKacou = kacou ? regles.filter(x => x.user_id === kacou.id && x.is_active) : []
const tourneesKacou = kacou ? tourneesAVenir.filter(x => x.user_id === kacou.id) : []
if (kacou) log(`${COMMERCIAL_GAGNOA} (${kacou.role}) : ${reglesKacou.length} règle(s) désactivée(s), ${tourneesKacou.length} tournée(s) à venir supprimée(s)`)

// 3. zones_secteurs + CSV
const zonesAMaj = zones.filter(z => REMPLACES[String(z.email_merchandiser || '').toLowerCase()])
log(`zones_secteurs : ${zonesAMaj.length} secteur(s) à réaffecter aux nouveaux emails`)
const csvTexte = readFileSync(CSV, 'utf8')
let csvNouveau = csvTexte
for (const [ancien, nouveau] of Object.entries(REMPLACES)) csvNouveau = csvNouveau.split(ancien).join(nouveau)
for (const [ancien, nouveau] of Object.entries(RENOMMAGES_CSV)) csvNouveau = csvNouveau.split(ancien).join(nouveau)
const csvLignesModifiees = csvTexte.split('\n').filter((l, i) => l !== csvNouveau.split('\n')[i]).length
log(`CSV ZONE SECTEUR : ${csvLignesModifiees} ligne(s) à réécrire`)

// 4. Noms
const nomsAMaj = []
for (const [email, nom] of Object.entries(NOMS)) {
  const p = parEmail.get(email)
  if (p && p.nom !== nom) { nomsAMaj.push({ p, nom }); log(`${email} : nom « ${p.nom} » → « ${nom} »`) }
}

// 5. Périmètres
const perimetresAMaj = []
for (const [email, terrs] of Object.entries(PERIMETRES)) {
  const p = parEmail.get(email)
  if (!p) { anomalies.push(`compte absent : ${email}`); continue }
  const actuels = (p.territoires_assignes || []).filter(Boolean)
  const memes = actuels.length === terrs.length && terrs.every(t => actuels.includes(t))
  if (memes && p.zone_assignee === terrs[0]) continue
  perimetresAMaj.push({ p, terrs })
  log(`${email} : périmètre [${actuels.join(', ')}] → [${terrs.join(', ')}], zone ${p.zone_assignee || '—'} → ${terrs[0]}`)
  if (p.employeur !== 'atom') anomalies.push(`${email} : employeur = ${p.employeur || '?'} (attendu atom — migration 20261006100000 appliquée ?)`)
}

// ---------- Rapport ----------

console.log(`# Nettoyage comptes Atom — ${APPLY ? 'APPLIQUÉ' : 'simulation'} du ${aujourdhui}\n`)
actions.forEach(a => console.log(`- ${a}`))
if (anomalies.length) { console.log('\n## À vérifier'); anomalies.forEach(a => console.log(`- ⚠️  ${a}`)) }

if (!APPLY) { console.log('\nSimulation : rien n\'a été écrit. Relancer avec --apply.'); process.exit(0) }

// ---------- Écriture ----------

const ok = (r, m) => { if (r.error) throw new Error(`${m} : ${r.error.message}`) }

for (const { p, regles: r, tournees: t } of aDesactiver) {
  if (r.length) ok(await supabase.from('routing_templates').update({ is_active: false }).in('id', r.map(x => x.id)), `règles ${p.email}`)
  if (t.length) ok(await supabase.from('routings').delete().in('id', t.map(x => x.id)), `tournées ${p.email}`)
  ok(await supabase.from('profiles').update({ is_active: false }).eq('id', p.id), `profil ${p.email}`)
  const { data: u } = await supabase.auth.admin.getUserById(p.id)
  if (u?.user) ok(await supabase.auth.admin.updateUserById(p.id, { ban_duration: '876000h' }), `auth ${p.email}`)
  console.log(`✅ ${p.email} désactivé`)
}
if (reglesKacou.length) ok(await supabase.from('routing_templates').update({ is_active: false }).in('id', reglesKacou.map(x => x.id)), 'règles KACOU')
if (tourneesKacou.length) ok(await supabase.from('routings').delete().in('id', tourneesKacou.map(x => x.id)), 'tournées KACOU')
if (kacou) console.log(`✅ ${COMMERCIAL_GAGNOA} : règles et tournées à venir retirées`)

for (const [ancien, nouveau] of Object.entries(REMPLACES)) {
  const pn = parEmail.get(nouveau)
  ok(await supabase.from('zones_secteurs').update({ email_merchandiser: nouveau, merchandiser: pn?.nom || undefined }).ilike('email_merchandiser', ancien), `zones_secteurs ${ancien}`)
}
writeFileSync(CSV, csvNouveau)
console.log(`✅ zones_secteurs et CSV réalignés`)

for (const { p, nom } of nomsAMaj) ok(await supabase.from('profiles').update({ nom }).eq('id', p.id), `nom ${p.email}`)
for (const { p, terrs } of perimetresAMaj) {
  ok(await supabase.from('profiles').update({ territoires_assignes: terrs, zone_assignee: terrs[0] }).eq('id', p.id), `périmètre ${p.email}`)
}
console.log(`✅ ${nomsAMaj.length} nom(s), ${perimetresAMaj.length} périmètre(s) mis à jour`)
