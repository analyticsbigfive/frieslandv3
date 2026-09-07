#!/usr/bin/env node
/**
 * Preuve du cloisonnement commercial (lot 2, 1.0.4) par appels PostgREST
 * DIRECTS, pas via l'interface. À lancer après application de
 * supabase/nouveau/20260907140100_friesland_lot2_roles_rls_commercial.sql.
 *
 * Vérifie, connecté avec un compte commercial :
 *  1. lecture des visites = exactement les visites des PDV de son périmètre
 *     (territoires + quartiers, même règle que pdvInScope) ;
 *  2. UPDATE pdv refusé (0 ligne touchée) ;
 *  3. INSERT pdv refusé ;
 *  4. INSERT visite refusé ;
 *  5. upload dans le bucket visite-images refusé.
 * Toute écriture qui passerait par erreur est supprimée avec la clé service.
 *
 * Usage :
 *   COMMERCIAL_EMAIL=... COMMERCIAL_PASSWORD=... node scripts/test-rls-commercial.mjs
 *   (COMMERCIAL_PASSWORD absent => SEED_DEFAULT_PASSWORD du .env)
 * Sort non-zéro si un contrôle échoue.
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config()

const URL = process.env.SUPABASE_URL
const ANON = process.env.SUPABASE_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const EMAIL = process.env.COMMERCIAL_EMAIL
const PASSWORD = process.env.COMMERCIAL_PASSWORD || process.env.SEED_DEFAULT_PASSWORD
if (!URL || !ANON || !SERVICE) { console.error('SUPABASE_URL, SUPABASE_KEY et SUPABASE_SERVICE_ROLE_KEY requis dans .env'); process.exit(1) }
if (!EMAIL || !PASSWORD) { console.error('COMMERCIAL_EMAIL (+ COMMERCIAL_PASSWORD ou SEED_DEFAULT_PASSWORD) requis'); process.exit(1) }

const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
const moi = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
const TAG = `TEST-RLS-${Date.now()}`
const failures = []
const ok = (label, cond, detail = '') => {
  console.log(`${cond ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!cond) failures.push(label)
}

async function allRows(build) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999)
    if (error) throw error
    out.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return out
}

// Périmètre attendu, calculé avec la clé service (même règle que pdvInScope).
async function visitesAttendues(profile) {
  const terrs = (Array.isArray(profile.territoires_assignes) ? profile.territoires_assignes : []).filter(Boolean)
  const territoires = terrs.length ? terrs : (profile.zone_assignee ? [profile.zone_assignee] : [])
  const quartiers = new Set((Array.isArray(profile.quartiers_assignes) ? profile.quartiers_assignes : []).filter(Boolean))
  const pdvs = await allRows(() => {
    let q = admin.from('pdv').select('pdv_id,quartier')
    if (territoires.length) q = q.in('zone', territoires)
    return q
  })
  const ids = pdvs.filter(p => !quartiers.size || !p.quartier || quartiers.has(p.quartier)).map(p => p.pdv_id)
  let total = 0
  for (let i = 0; i < ids.length; i += 300) {
    const { count, error } = await admin.from('visites').select('*', { count: 'exact', head: true }).in('pdv_id', ids.slice(i, i + 300))
    if (error) throw error
    total += count || 0
  }
  return { total, samplePdv: pdvs[0]?.pdv_id }
}

const { data: session, error: loginErr } = await moi.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
if (loginErr) { console.error('Connexion impossible :', loginErr.message); process.exit(1) }
const uid = session.user.id
const { data: profile } = await admin.from('profiles').select('role,zone_assignee,territoires_assignes,quartiers_assignes,is_active').eq('id', uid).single()
console.log(`Compte ${EMAIL} — rôle ${profile?.role}, actif ${profile?.is_active}`)
ok('le compte testé est bien un commercial actif', profile?.role === 'commercial' && profile?.is_active)

// 1. Lecture scopée
const attendu = await visitesAttendues(profile)
const { count: vus } = await moi.from('visites').select('*', { count: 'exact', head: true })
ok('lecture des visites limitée au périmètre', vus === attendu.total, `vues ${vus}, attendues ${attendu.total}`)

// 2. UPDATE pdv (valeur identique : aucune modification réelle si accepté)
const { data: cible } = await admin.from('pdv').select('id,pdv_id,nom_pdv').eq('pdv_id', attendu.samplePdv).single()
const { data: upd, error: updErr } = await moi.from('pdv').update({ nom_pdv: cible.nom_pdv }).eq('id', cible.id).select('id')
ok('UPDATE pdv refusé', !!updErr || !upd?.length, updErr ? updErr.message : `${upd?.length || 0} ligne(s) touchée(s)`)

// 3. INSERT pdv
const { data: insPdv, error: insPdvErr } = await moi.from('pdv')
  .insert({ pdv_id: TAG, nom_pdv: TAG, zone: 'TEST', canal: 'General trade', categorie_pdv: 'Point de vente détail' }).select('id')
ok('INSERT pdv refusé', !!insPdvErr, insPdvErr?.message)
if (insPdv?.length) await admin.from('pdv').delete().eq('id', insPdv[0].id)

// 4. INSERT visite sous son propre user_id
const { data: insVis, error: insVisErr } = await moi.from('visites')
  .insert({ visite_id: TAG, pdv_id: cible.pdv_id, user_id: uid, date_visite: new Date().toISOString(), commercial: TAG, email: EMAIL, data: {} }).select('id')
ok('INSERT visite refusé', !!insVisErr, insVisErr?.message)
if (insVis?.length) await admin.from('visites').delete().eq('id', insVis[0].id)

// 5. Upload bucket
const path = `test-rls/${TAG}.txt`
const { error: upErr } = await moi.storage.from('visite-images').upload(path, Buffer.from('x'), { contentType: 'text/plain' })
ok('upload visite-images refusé', !!upErr, upErr?.message)
if (!upErr) await admin.storage.from('visite-images').remove([path])

await moi.auth.signOut()
if (failures.length) { console.error(`\n${failures.length} contrôle(s) en échec.`); process.exit(1) }
console.log('\nCloisonnement commercial vérifié par PostgREST direct.')
