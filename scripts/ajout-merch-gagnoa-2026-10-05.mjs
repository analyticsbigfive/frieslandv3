#!/usr/bin/env node
/**
 * Ajoute DJESSOU JEMIMA, merchandiser de Gagnoa (fichier client du 05/10/2026,
 * secteurs 508 à 530 de « ZONE SECTEUR », ZAPATA compris) :
 *
 *   1. Référentiel : les PDV de Gagnoa portent pdv.zone = « GAGNOA », libellé
 *      absent du référentiel (qui ne connaît que Gagnoa 1 / Gagnoa 2). On crée
 *      le territoire « Gagnoa » (GAG, sous-région WEST), une area GAGNOA et les
 *      23 quartiers du fichier, pour que l'admin Utilisateurs reconnaisse le
 *      périmètre et propose ces quartiers. Ce qui existe déjà est réutilisé.
 *   2. Compte : créé s'il n'existe pas (mot de passe provisoire, changement
 *      imposé à la première connexion) ; un compte existant garde son mot de passe.
 *   3. Profil : merchandiser, territoire GAGNOA, région CNO, et STRICTEMENT les
 *      23 quartiers du fichier, avec l'orthographe exacte de pdv.quartier (le
 *      périmètre compare les chaînes à l'identique). Commercial responsable :
 *      KACOU LEONARD (cnofcgagnoa@gmail.com), superviseur de Gagnoa.
 *   4. KACOU LEONARD : son périmètre doit couvrir ces quartiers (territoire
 *      GAGNOA ajouté au besoin ; quartiers ajoutés s'il en a une liste).
 *   5. zones_secteurs : DJESSOU JEMIMA devient merchandiser des 23 secteurs.
 *
 * Tout est lu et vérifié avant la première écriture.
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
import { toutesLesLignes } from './lib/dms.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env'), quiet: true })

const APPLY = process.argv.includes('--apply')
const PASSWORD = process.argv.find(a => a.startsWith('--password='))?.split('=').slice(1).join('=')
  || process.env.SEED_DEFAULT_PASSWORD

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const MERCH = { email: 'djessoumima@gmail.com', nom: 'DJESSOU JEMIMA' }
const COMMERCIAL_EMAIL = 'cnofcgagnoa@gmail.com' // KACOU LEONARD
const LIBELLE = 'GAGNOA' // pdv.zone et zones_secteurs.zone
const REGION = 'CNO'
const TERRITOIRE = { code: 'GAG', nom: 'Gagnoa', sous_region_code: 'WEST' }
const AREA = { code: 'GAGNOA', nom: 'GAGNOA' }
const SECTEURS = [
  'GAGNOA/ZAPATA', 'GAGNOA/GARAHIO', 'GAGNOA/DELBO 1 & 2', 'GAGNOA/CISSE KAMOUROU',
  'GAGNOA/DIOULABOUGOU', 'GAGNOA/SOLEIL', 'GAGNOA/DJANCA', 'GAGNOA/CAMP FONCTIONNAIRE',
  'GAGNOA/AFRIDOUGOU', 'GAGNOA/SECTEUR CIB & GUESSIO', 'GAGNOA/ZAPATA RESIDENTIEL',
  'GAGNOA/SECTEUR COMMERCE', 'GAGNOA/CAFOP & GODIABRE', 'GAGNOA/MAHIDIO', 'GAGNOA/CHATEAU',
  'GAGNOA/BARHUO', 'GAGNOA/BABRE', 'DIVO', 'OUME', 'LAKOTA', 'HIRE', 'TIASSALE', 'NDOUCI',
]

const norm = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[’']/g, "'").replace(/\s+/g, ' ').trim().toUpperCase()
const compact = (s) => norm(s).replace(/[^A-Z0-9]/g, '')

/** Orthographe de pdv.quartier qui correspond au secteur du fichier, sinon null. */
function quartierEnBase(secteur, valeurs) {
  return valeurs.find(v => v === secteur)
    || valeurs.find(v => norm(v) === norm(secteur))
    || valeurs.find(v => compact(v) === compact(secteur))
    || null
}

async function findAuthUser(email) {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const u = data.users.find(x => x.email?.toLowerCase() === email)
    if (u) return u
    if (data.users.length < 1000) return null
  }
}

const tableau = (v) => (Array.isArray(v) ? v.filter(Boolean) : [])

async function main() {
  console.log(APPLY ? '=== APPLY ===' : '=== DRY-RUN (ajouter --apply pour écrire) ===')

  // ── Lecture ────────────────────────────────────────────────────────────────
  const [{ data: territoires, error: e1 }, { data: areas, error: e2 }] = await Promise.all([
    supabase.from('territoire').select('code, nom, sous_region_code'),
    supabase.from('zone').select('id, code, nom, territoire_code'),
  ])
  if (e1) throw e1
  if (e2) throw e2

  // Territoire : par nom (« Gagnoa ») d'abord, le code GAG ne doit pas être pris par un autre.
  let territoire = territoires.find(t => norm(t.nom) === LIBELLE)
  if (!territoire) {
    const pris = territoires.find(t => t.code === TERRITOIRE.code)
    if (pris) throw new Error(`Code ${TERRITOIRE.code} déjà pris par « ${pris.nom} »`)
  }
  const terrCode = territoire?.code || TERRITOIRE.code
  console.log(territoire
    ? `Territoire : « ${territoire.nom} » (${territoire.code}) existe déjà`
    : `Territoire : création de « ${TERRITOIRE.nom} » (${TERRITOIRE.code}, ${TERRITOIRE.sous_region_code})`)

  let area = areas.find(a => a.territoire_code === terrCode && (a.code === AREA.code || norm(a.nom) === AREA.nom))
  console.log(area ? `Area : ${area.code} (id ${area.id}) existe déjà` : `Area : création de ${AREA.code} sous ${terrCode}`)

  // Quartiers déjà référencés sous les areas de ce territoire.
  const areaIds = areas.filter(a => a.territoire_code === terrCode).map(a => a.id)
  const refs = areaIds.length
    ? await toutesLesLignes(() => supabase.from('quartier').select('id, zone_id, nom, ordre').in('zone_id', areaIds).order('id'))
    : []

  // PDV de Gagnoa : orthographe réelle de pdv.quartier.
  const pdvs = await toutesLesLignes(() => supabase.from('pdv').select('pdv_id, quartier').ilike('zone', LIBELLE).order('pdv_id'))
  const parQuartier = new Map()
  for (const p of pdvs) parQuartier.set(p.quartier ?? null, (parQuartier.get(p.quartier ?? null) || 0) + 1)
  const valeurs = [...parQuartier.keys()].filter(Boolean)

  console.log(`\nPDV zone ${LIBELLE} : ${pdvs.length}`)
  const quartiers = []
  for (const s of SECTEURS) {
    const enBase = quartierEnBase(s, valeurs)
    const nom = enBase || s
    quartiers.push(nom)
    const n = enBase ? parQuartier.get(enBase) : 0
    console.log(`  ${nom.padEnd(32)} ${String(n).padStart(4)} PDV${enBase && enBase !== s ? `  (fichier : ${s})` : ''}`)
  }
  const horsTableau = valeurs.filter(v => !quartiers.includes(v))
  const total = quartiers.reduce((acc, q) => acc + (parQuartier.get(q) || 0), 0)
  console.log(`  → ${total} PDV dans ses quartiers`)
  if (parQuartier.get(null)) console.log(`  + ${parQuartier.get(null)} PDV sans quartier (restent visibles, règle du périmètre)`)
  if (horsTableau.length) {
    console.log(`  Quartiers de Gagnoa HORS tableau, non attribués :`)
    for (const v of horsTableau) console.log(`    - ${v} (${parQuartier.get(v)} PDV)`)
  }

  const aCreer = quartiers.filter(q => !refs.some(r => norm(r.nom) === norm(q)))
  console.log(`\nQuartiers à créer dans le référentiel : ${aCreer.length}/${quartiers.length}`)

  // Commercial responsable
  const { data: commercial, error: e3 } = await supabase
    .from('profiles')
    .select('id, nom, role, is_active, zone_assignee, territoires_assignes, quartiers_assignes')
    .eq('email', COMMERCIAL_EMAIL).maybeSingle()
  if (e3) throw e3
  if (!commercial) throw new Error(`Compte de KACOU LEONARD introuvable : ${COMMERCIAL_EMAIL}`)
  // Le trigger profiles_commercial_id_valide n'accepte qu'un commercial ou un admin.
  if (!['commercial', 'admin'].includes(commercial.role)) {
    throw new Error(`${commercial.nom} a le rôle « ${commercial.role} » : il doit être commercial pour être responsable d'un merchandiser`)
  }
  const comTerr = tableau(commercial.territoires_assignes)
  const comQuart = tableau(commercial.quartiers_assignes)
  const patchCom = {}
  if (!comTerr.some(t => norm(t) === LIBELLE)) {
    patchCom.territoires_assignes = [...comTerr, LIBELLE]
    if (!commercial.zone_assignee) patchCom.zone_assignee = LIBELLE
  }
  if (comQuart.length) {
    const manquants = quartiers.filter(q => !comQuart.includes(q))
    if (manquants.length) patchCom.quartiers_assignes = [...comQuart, ...manquants]
  }
  if (commercial.is_active === false) patchCom.is_active = true
  console.log(`\nCommercial : ${commercial.nom} (${commercial.role})${Object.keys(patchCom).length ? ` → ${JSON.stringify(patchCom)}` : ', périmètre déjà bon'}`)

  // Compte
  let user = await findAuthUser(MERCH.email)
  console.log(user ? `\nCompte existant ${MERCH.email} : mot de passe inchangé` : `\nCompte absent → création de ${MERCH.email}`)
  if (APPLY && !user && !PASSWORD) throw new Error('Mot de passe requis : --password=... ou SEED_DEFAULT_PASSWORD')

  const patch = {
    nom: MERCH.nom,
    email: MERCH.email,
    role: 'merchandiser',
    is_active: true,
    commercial_id: commercial.id,
    territoires_assignes: [LIBELLE],
    zone_assignee: LIBELLE,
    quartiers_assignes: quartiers,
    region: REGION,
  }
  console.log(`Profil : ${JSON.stringify({ ...patch, quartiers_assignes: `${quartiers.length} quartiers` })}`)

  if (!APPLY) {
    console.log('\nDRY-RUN : aucune écriture.')
    return
  }

  // ── Écritures ──────────────────────────────────────────────────────────────
  if (!territoire) {
    const { error } = await supabase.from('territoire').insert(TERRITOIRE)
    if (error) throw error
    console.log(`  ✓ territoire ${TERRITOIRE.code}`)
  }
  if (!area) {
    const { data, error } = await supabase.from('zone')
      .insert({ code: AREA.code, nom: AREA.nom, territoire_code: terrCode }).select('id').single()
    if (error) throw error
    area = { id: data.id }
    console.log(`  ✓ area ${AREA.code} (id ${area.id})`)
  }
  let ordre = Math.max(0, ...refs.filter(r => r.zone_id === area.id).map(r => r.ordre || 0))
  if (aCreer.length) {
    const { error } = await supabase.from('quartier').insert(aCreer.map(nom => ({ zone_id: area.id, nom, ordre: ++ordre })))
    if (error) throw error
    console.log(`  ✓ ${aCreer.length} quartiers`)
  }

  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: MERCH.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { nom: MERCH.nom, role: 'merchandiser', must_change_password: true },
    })
    if (error) throw error
    user = data.user
    console.log(`  ✓ compte ${MERCH.email}`)
  }
  // La ligne profiles est créée par le trigger handle_new_user.
  const { error: eProfil } = await supabase.from('profiles').update(patch).eq('id', user.id)
  if (eProfil) throw eProfil
  console.log(`  ✓ profil ${MERCH.nom}`)

  if (Object.keys(patchCom).length) {
    const { error } = await supabase.from('profiles').update(patchCom).eq('id', commercial.id)
    if (error) throw error
    console.log(`  ✓ périmètre de ${commercial.nom}`)
  }

  const { data: zs, error: eZs } = await supabase.from('zones_secteurs')
    .update({ merchandiser: MERCH.nom, email_merchandiser: MERCH.email })
    .eq('zone', LIBELLE).in('secteur', SECTEURS).select('secteur')
  if (eZs) throw eZs
  console.log(`  ✓ zones_secteurs : ${zs.length}/${SECTEURS.length} secteurs`)

  console.log('\nTerminé. Tournée : node scripts/tournees-perimetre.mjs --apply')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
