#!/usr/bin/env node
/**
 * Compte de test « merchandiser Atom » (qa.atom@friesland-test.ci), pour tester
 * la tournée par quotas sur téléphone sans toucher aux vrais agents.
 *
 * Création (défaut) :
 *   - compte créé s'il manque, mot de passe = --password=… ou, à défaut,
 *     SEED_DEFAULT_PASSWORD du .env (jamais imprimé), sans changement imposé à
 *     la connexion ; un compte existant garde son mot de passe ;
 *   - profil : merchandiser, employeur atom, périmètre recopié d'un agent Atom
 *     réel (--source, défaut attecoubeone@), SANS commercial responsable (le
 *     compte n'apparaît dans l'équipe de personne) ;
 *   - une copie de CHAQUE règle quota active de l'agent source (« Test Atom —
 *     <libellé> » : mêmes jours, même SSF, même territoire, mêmes PDV), pour
 *     tester le planning par SSF (une sous-zone par jour) comme l'agent ;
 *   - tournées du compte à partir d'aujourd'hui supprimées puis recréées
 *     (--pregenerer=N jours, défaut 1) : une relance repart de zéro.
 *   Les quotas sont calculés compte par compte (etapes_quota_du_jour) : le
 *   programme du mois de l'agent source n'est pas modifié.
 *
 * Nettoyage (--nettoyer) : visites du compte (et ce qui en dépend), tournées,
 * positions GPS et règles supprimées, compte désactivé. Les vrais agents ne
 * sont pas touchés.
 *
 * Simulation par défaut ; --apply pour écrire.
 *
 * Usage :
 *   node scripts/compte-test-atom.mjs [--source=attecoubeone@gmail.com] [--pregenerer=1] [--password=…] [--apply]
 *   node scripts/compte-test-atom.mjs --nettoyer [--apply]
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { toutesLesLignes } from './lib/dms.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env'), quiet: true })

const arg = (nom, defaut) => process.argv.find(a => a.startsWith(`--${nom}=`))?.split('=').slice(1).join('=') || defaut
const APPLY = process.argv.includes('--apply')
const NETTOYER = process.argv.includes('--nettoyer')
const SOURCE = arg('source', 'attecoubeone@gmail.com').toLowerCase()
const PREGENERER = Number(arg('pregenerer', 1))
const PASSWORD = arg('password', process.env.SEED_DEFAULT_PASSWORD)

const QA = { email: 'qa.atom@friesland-test.ci', nom: 'QA Atom' }
const LABEL = 'Test Atom'
const OBJECTIFS = { releve_stock: true, photos: true }

const jourIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const AUJOURDHUI = jourIso(new Date())

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env')
  process.exit(1)
}
if (!Number.isInteger(PREGENERER) || PREGENERER < 0) throw new Error(`--pregenerer=${PREGENERER} : entier ≥ 0 attendu`)

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function findAuthUser(email) {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const u = data.users.find(x => x.email?.toLowerCase() === email)
    if (u) return u
    if (data.users.length < 1000) return null
  }
}

const ok = ({ error }, quoi) => {
  if (error) throw new Error(`${quoi} : ${error.message}`)
}

async function compter(table, colonne, valeur) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq(colonne, valeur)
  if (error) throw new Error(`${table} : ${error.message}`)
  return count || 0
}

async function nettoyer() {
  const user = await findAuthUser(QA.email)
  if (!user) {
    console.log(`${QA.email} n'existe pas : rien à nettoyer.`)
    return
  }
  const [visites, tournees, positions] = await Promise.all([
    compter('visites', 'user_id', user.id),
    compter('routings', 'user_id', user.id),
    compter('position_tournee', 'user_id', user.id),
  ])
  const { data: regles, error } = await supabase.from('routing_templates').select('id,label').eq('user_id', user.id)
  if (error) throw error
  console.log(`${QA.email} : ${visites} visite(s), ${tournees} tournée(s), ${positions} position(s) GPS, ${regles.length} règle(s)`)
  if (!APPLY) {
    console.log('\nDRY-RUN : aucune écriture. Relancer avec --apply.')
    return
  }
  // Tournées d'abord : routing_pdv.visite_id référence la visite sans cascade.
  ok(await supabase.from('routings').delete().eq('user_id', user.id), 'tournées') // routing_pdv en cascade
  // Le reste de ce qui dépend d'une visite suit (cascade) ou se détache (set null).
  ok(await supabase.from('visites').delete().eq('user_id', user.id), 'visites')
  ok(await supabase.from('position_tournee').delete().eq('user_id', user.id), 'positions GPS')
  ok(await supabase.from('routing_templates').delete().eq('user_id', user.id), 'règles') // PDV de règle en cascade
  ok(await supabase.from('profiles').update({ is_active: false }).eq('id', user.id), 'profil')
  console.log('✅ Nettoyé, compte désactivé. Une nouvelle création le réactive.')
}

async function creer() {
  // ── Lecture ────────────────────────────────────────────────────────────────
  const { data: source, error: e1 } = await supabase
    .from('profiles')
    .select('id, nom, role, employeur, is_active, zone_assignee, territoires_assignes, quartiers_assignes, region')
    .ilike('email', SOURCE).maybeSingle()
  if (e1) throw e1
  if (!source) throw new Error(`Agent source introuvable : ${SOURCE}`)
  if (source.role !== 'merchandiser' || source.employeur !== 'atom') {
    throw new Error(`${SOURCE} n'est pas un merchandiser Atom (rôle ${source.role}, employeur ${source.employeur})`)
  }

  // ssf_id n'existe qu'après la migration 20261007100000 (sous-zones SSF).
  const colonnes = 'id, label, distributeur, territoire, days_of_week, day_of_week, created_at'
  let { data: reglesSource, error: e2 } = await supabase
    .from('routing_templates').select(`${colonnes}, ssf_id`)
    .eq('user_id', source.id).eq('mode', 'quota').eq('is_active', true).order('created_at')
  if (e2) {
    ({ data: reglesSource, error: e2 } = await supabase
      .from('routing_templates').select(colonnes)
      .eq('user_id', source.id).eq('mode', 'quota').eq('is_active', true).order('created_at'))
  }
  if (e2) throw e2
  if (!reglesSource.length) throw new Error(`${SOURCE} n'a aucune règle quota active : choisir un autre --source`)

  const lignesSource = await toutesLesLignes(() => supabase
    .from('routing_template_pdv').select('template_id, pdv_id, position_order')
    .in('template_id', reglesSource.map(r => r.id)).order('template_id').order('position_order'))
  const pdvIds = [...new Set(lignesSource.map(l => l.pdv_id))]

  console.log(`Source : ${source.nom} <${SOURCE}> — ${reglesSource.length} règle(s) quota, ${pdvIds.length} PDV`)
  for (const r of reglesSource) {
    const jours = r.days_of_week || [r.day_of_week]
    console.log(`  · ${r.label} : ${jours.join(',')}${r.ssf_id ? ` (SSF ${r.ssf_id})` : ''}, ${lignesSource.filter(l => l.template_id === r.id).length} PDV`)
  }
  console.log(`  périmètre : ${JSON.stringify(source.territoires_assignes)}, ${(source.quartiers_assignes || []).length} quartier(s), région ${source.region}`)

  let user = await findAuthUser(QA.email)
  console.log(user ? `Compte ${QA.email} : existe, mot de passe inchangé` : `Compte ${QA.email} : création`)
  if (!user && !PASSWORD) {
    const msg = 'Mot de passe requis pour créer le compte : --password=… ou SEED_DEFAULT_PASSWORD dans .env'
    if (APPLY) throw new Error(msg)
    console.log(`  ⚠ ${msg}`)
  }

  const anciennes = user
    ? (await supabase.from('routing_templates').select('id').eq('user_id', user.id)).data || []
    : []
  const tourneesAVenir = user
    ? (await supabase.from('routings').select('id').eq('user_id', user.id).gte('date_routing', AUJOURDHUI)).data || []
    : []
  console.log(`Règles « ${LABEL} — … » : ${reglesSource.length} copie(s)${anciennes.length ? `, remplacent ${anciennes.length} règle(s)` : ''}`)
  if (tourneesAVenir.length) console.log(`Tournées du compte à partir du ${AUJOURDHUI} : ${tourneesAVenir.length}, recréées`)
  console.log(`Tournées créées : ${PREGENERER} jour(s) à partir du ${AUJOURDHUI}`)

  if (!APPLY) {
    console.log('\nDRY-RUN : aucune écriture. Relancer avec --apply.')
    return
  }

  // ── Écritures ──────────────────────────────────────────────────────────────
  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: QA.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { nom: QA.nom, role: 'merchandiser', must_change_password: false },
    })
    if (error) throw error
    user = data.user
    console.log(`  ✓ compte ${QA.email}`)
  }

  ok(await supabase.from('profiles').update({
    nom: QA.nom,
    email: QA.email,
    role: 'merchandiser',
    employeur: 'atom',
    is_active: true,
    commercial_id: null,
    zone_assignee: source.zone_assignee,
    territoires_assignes: source.territoires_assignes,
    quartiers_assignes: source.quartiers_assignes,
    region: source.region,
  }).eq('id', user.id), 'profil')
  console.log(`  ✓ profil ${QA.nom} (Atom)`)

  if (tourneesAVenir.length) ok(await supabase.from('routings').delete().in('id', tourneesAVenir.map(t => t.id)), 'tournées à venir')
  if (anciennes.length) ok(await supabase.from('routing_templates').delete().in('id', anciennes.map(r => r.id)), 'anciennes règles')

  for (const r of reglesSource) {
    const jours = r.days_of_week || [r.day_of_week]
    const regleTest = {
      user_id: user.id,
      days_of_week: jours,
      day_of_week: jours[0],
      label: `${LABEL} — ${r.label}`,
      mode: 'quota',
      notes: `Compte de test : copie de la règle « ${r.label} » de ${SOURCE}.`,
      territoire: r.territoire || null,
      distributeur: r.distributeur || null,
      date_debut: AUJOURDHUI,
      date_fin: null,
      is_active: true,
    }
    if (r.ssf_id) regleTest.ssf_id = r.ssf_id
    const { data: regle, error: e3 } = await supabase.from('routing_templates').insert(regleTest).select('id').single()
    if (e3) throw e3
    const lignes = lignesSource.filter(l => l.template_id === r.id)
      .map((l, k) => ({ template_id: regle.id, pdv_id: l.pdv_id, position_order: k + 1, objectifs: OBJECTIFS }))
    for (let i = 0; i < lignes.length; i += 500) {
      ok(await supabase.from('routing_template_pdv').insert(lignes.slice(i, i + 500)), 'PDV de la règle')
    }
    console.log(`  ✓ règle « ${regleTest.label} » : ${jours.join(',')}, ${lignes.length} PDV`)
  }

  if (PREGENERER > 0) {
    const fin = new Date()
    fin.setDate(fin.getDate() + PREGENERER - 1)
    const { data, error } = await supabase.rpc('materialiser_routings_periode', {
      p_user_id: user.id, p_date_debut: AUJOURDHUI, p_date_fin: jourIso(fin),
    })
    if (error) throw error
    console.log(`  ✓ ${data || 0} tournée(s) créée(s)`)
    const { data: jour } = await supabase.from('routings').select('id').eq('user_id', user.id).eq('date_routing', AUJOURDHUI).maybeSingle()
    if (jour) console.log(`  → tournée du ${AUJOURDHUI} : ${await compter('routing_pdv', 'routing_id', jour.id)} PDV`)
    else console.log(`  → pas de tournée le ${AUJOURDHUI} (dimanche ?)`)
  }
  console.log(`\nTerminé. Connexion : ${QA.email}, avec le mot de passe choisi à la création`)
}

;(NETTOYER ? nettoyer() : creer()).catch((e) => {
  console.error(e)
  process.exit(1)
})
