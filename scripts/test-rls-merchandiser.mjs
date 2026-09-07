#!/usr/bin/env node
/**
 * Preuve du cloisonnement descendant (demande du 7 sept. 2026) par appels
 * PostgREST DIRECTS, pas via l'interface. À lancer AVANT puis APRÈS
 * l'application de :
 *   supabase/nouveau/20260910120000_friesland_cloisonnement_roles.sql
 *   supabase/nouveau/20260910120100_friesland_pdv_lecture_perimetre.sql
 *
 * Avant migration, les contrôles 1, 2 et 4 doivent ÉCHOUER (c'est le trou).
 * Après, tout doit passer.
 *
 * Connecté avec un compte merchandiser, vérifie que :
 *  1. action_commerciale ne renvoie que les actions dont il est l'assigné ou
 *     l'auteur — jamais celles de toute sa zone ;
 *  2. field_coaching ne renvoie aucune ligne ;
 *  3. il peut lire ses propres visites ;
 *  4. pdv est borné à son périmètre (territoires + quartiers) ;
 *  5. modifier son propre zone_assignee est REFUSÉ (escalade de périmètre) ;
 *  6. modifier son propre role est REFUSÉ.
 *
 * Les contrôles 5 et 6 tentent réellement l'escalade. Tant que la migration
 * n'est pas appliquée, ces écritures PASSENT : le script relit la ligne et
 * restaure la valeur d'origine avec la clé de service, réussite ou échec.
 *
 * Usage :
 *   MERCH_EMAIL=... MERCH_PASSWORD=... node scripts/test-rls-merchandiser.mjs
 *   (MERCH_PASSWORD absent => SEED_DEFAULT_PASSWORD du .env)
 * Sort non-zéro si un contrôle échoue.
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config()

const URL = process.env.SUPABASE_URL
const ANON = process.env.SUPABASE_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const EMAIL = process.env.MERCH_EMAIL
const PASSWORD = process.env.MERCH_PASSWORD || process.env.SEED_DEFAULT_PASSWORD
if (!URL || !ANON || !SERVICE) {
  console.error('SUPABASE_URL, SUPABASE_KEY et SUPABASE_SERVICE_ROLE_KEY requis dans .env')
  process.exit(1)
}
if (!EMAIL || !PASSWORD) {
  console.error('MERCH_EMAIL (+ MERCH_PASSWORD ou SEED_DEFAULT_PASSWORD) requis')
  process.exit(1)
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
const moi = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
const failures = []
const ok = (label, cond, detail = '') => {
  console.log(`${cond ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!cond) failures.push(label)
}

// PostgREST plafonne à 1 000 lignes : pagination explicite pour compter juste.
async function countAll(build) {
  let n = 0
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999)
    if (error) throw error
    n += data.length
    if (data.length < 1000) return n
  }
}

const main = async () => {
  const { data: auth, error: authErr } = await moi.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  if (authErr) { console.error('Connexion impossible :', authErr.message); process.exit(1) }
  const uid = auth.user.id

  const { data: profil } = await admin
    .from('profiles')
    .select('role, zone_assignee, territoires_assignes, quartiers_assignes')
    .eq('id', uid).single()
  if (profil?.role !== 'merchandiser') {
    console.error(`Ce compte a le rôle « ${profil?.role} » : utilisez un merchandiser.`)
    process.exit(1)
  }
  console.log(`Compte de test : rôle ${profil.role}, territoires ${JSON.stringify(profil.territoires_assignes)}\n`)

  // --- 1. Actions commerciales : seulement les siennes -----------------------
  const vues = await countAll(() => moi.from('action_commerciale').select('id, assigne_a, auteur_id'))
  const { data: mesActions } = await moi
    .from('action_commerciale').select('id').or(`assigne_a.eq.${uid},auteur_id.eq.${uid}`)
  const { count: total } = await admin.from('action_commerciale').select('*', { count: 'exact', head: true })
  ok('1. actions : seulement celles qui le concernent',
    vues === (mesActions?.length ?? 0),
    `${vues} vue(s), ${mesActions?.length ?? 0} le concernant, ${total} en base`)

  // --- 2. Field coaching : aucune ligne --------------------------------------
  const coachings = await countAll(() => moi.from('field_coaching').select('id'))
  const { count: totalCoachings } = await admin.from('field_coaching').select('*', { count: 'exact', head: true })
  if (!totalCoachings) {
    // Ne pas afficher un ✅ qui ne prouve rien : la table est vide.
    console.log(`⚠️  2. field coaching : NON CONCLUANT — table vide, le contrôle ne prouve rien`)
  }
  else {
    ok('2. field coaching : aucun accès', coachings === 0, `${coachings} vue(s) sur ${totalCoachings} en base`)
  }

  // --- 3. Ses propres visites restent lisibles -------------------------------
  const { count: aMoi } = await admin.from('visites').select('*', { count: 'exact', head: true }).eq('user_id', uid)
  const { count: luesParMoi } = await moi.from('visites').select('*', { count: 'exact', head: true }).eq('user_id', uid)
  ok('3. ses propres visites restent lisibles', luesParMoi === aMoi, `${luesParMoi}/${aMoi}`)

  // --- 4. PDV bornés au périmètre --------------------------------------------
  const { count: pdvTotal } = await admin.from('pdv').select('*', { count: 'exact', head: true })
  const pdvVus = await countAll(() => moi.from('pdv').select('pdv_id'))
  ok('4. pdv bornés au périmètre', pdvVus < pdvTotal, `${pdvVus} vus sur ${pdvTotal} en base`)

  // --- 5 & 6. Aucune escalade depuis son propre profil ------------------------
  // TANT QUE la migration n'est pas appliquée, ces tentatives RÉUSSISSENT :
  // c'est précisément le trou qu'on mesure. On restaure donc systématiquement
  // avec la clé de service, réussite ou échec, avant de conclure.
  async function tenteEscalade(label, patch, colonne, valeurInitiale) {
    const { error } = await moi.from('profiles').update(patch).eq('id', uid)
    const { data: apres } = await admin.from('profiles').select(colonne).eq('id', uid).single()
    const intact = JSON.stringify(apres?.[colonne]) === JSON.stringify(valeurInitiale)
    if (!intact) {
      const { error: errRestore } = await admin.from('profiles')
        .update({ [colonne]: valeurInitiale }).eq('id', uid)
      console.log(errRestore
        ? `   ⚠️  RESTAURATION ÉCHOUÉE sur ${colonne} : remettre ${JSON.stringify(valeurInitiale)} à la main`
        : `   ↩︎  ${colonne} restauré à ${JSON.stringify(valeurInitiale)}`)
    }
    ok(label, intact, error ? `refusé : ${error.message.slice(0, 60)}` : 'ÉCRITURE PASSÉE — le trou est ouvert')
  }

  await tenteEscalade('5. zone_assignee non modifiable par l’intéressé',
    { zone_assignee: 'ZONE-TEST-ESCALADE' }, 'zone_assignee', profil.zone_assignee)
  await tenteEscalade('6. role non modifiable par l’intéressé',
    { role: 'admin' }, 'role', 'merchandiser')

  await moi.auth.signOut()
  console.log(failures.length ? `\n${failures.length} contrôle(s) en échec.` : '\nTous les contrôles passent.')
  process.exit(failures.length ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
