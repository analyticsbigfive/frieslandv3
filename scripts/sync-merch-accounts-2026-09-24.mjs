#!/usr/bin/env node
/**
 * Aligne les comptes merchandisers sur « MAILS MERCH.xlsx » (liste client du 24/09/2026) :
 *   - comptes existants : mot de passe du fichier, must_change_password retiré, nom du fichier ;
 *   - comptes absents : créés, périmètre (territoires, quartiers, commercial, région)
 *     recopié depuis l'ancien compte du même merchandiser ;
 *   - le fichier fait foi sur les conflits : noms Abobo inversés, DEHEO sur YOPOUGON 2
 *     (retiré de yopougonone@ qui ne garde que YOPOUGON 1).
 * Les anciens comptes (cocodytwo@, yopougontwo@, koumassione@, portbouetmerchone@)
 * ne sont pas touchés.
 *
 * Usage :
 *   node scripts/sync-merch-accounts-2026-09-24.mjs           # dry-run (défaut)
 *   node scripts/sync-merch-accounts-2026-09-24.mjs --apply   # exécute les écritures
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env') })

const APPLY = process.argv.includes('--apply')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// nom: null = nom absent du fichier, on garde l'existant (ou celui de l'ancien compte).
// source: ancien compte dont on recopie le périmètre si le compte doit être créé.
// perimetre: surcharge explicite du périmètre (le fichier fait foi).
const ROWS = [
  { email: 'attecoubeone@gmail.com', password: 'attecoube1@atom-btl.com', nom: 'ABBE FREDERIC' },
  { email: 'cocodyone@gmail.com', password: 'cocody1@atom-btl.com', nom: 'KOUAME HELLARION' },
  { email: 'cocodymerchtwo@gmail.com', password: 'cocody2@atom-btl.com', nom: 'DIABATE IDRISSA', source: 'cocodytwo@gmail.com' },
  {
    email: 'yopougonone@gmail.com', password: 'yopougon1@atom-btl.com', nom: 'ZOGBOLOU KEVIN',
    perimetre: { territoires_assignes: ['YOPOUGON 1'], zone_assignee: 'YOPOUGON 1' },
  },
  {
    email: 'yopougonmerchtwo@gmail.com', password: 'yopougon2@atom-btl.com', nom: 'DEHEO WILFRIED',
    source: 'yopougonone@gmail.com',
    perimetre: { territoires_assignes: ['YOPOUGON 2'], zone_assignee: 'YOPOUGON 2', quartiers_assignes: [] },
  },
  { email: 'abobomerchone@gmail.com', password: 'abobo1@atom-btl.com', nom: 'SEREGONE SCHADRACK' },
  { email: 'abobomerchtwo@gmail.com', password: 'abobo2@atom-btl.com', nom: 'YAO VENANCE' },
  { email: 'marcorytreichone@gmail.com', password: 'marcorytreich1@atom-btl.com', nom: null },
  { email: 'koumassimerchone@gmail.com', password: 'koumassi1@atom-btl.com', nom: 'KOUADIO ATOFFE GUY ANICET', source: 'koumassione@gmail.com' },
  { email: 'portbouetone@gmail.com', password: 'portbouet1@atom-btl.com', nom: null, source: 'portbouetmerchone@gmail.com' },
]

const PERIMETRE_COLS = 'zone_assignee, territoires_assignes, quartiers_assignes, commercial_id, region'

async function listAuthUsers() {
  const byEmail = new Map()
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    for (const u of data.users) byEmail.set(u.email.toLowerCase(), u)
    if (data.users.length < 1000) break
  }
  return byEmail
}

async function getProfile(id) {
  const { data, error } = await supabase
    .from('profiles')
    .select(`id, email, nom, role, is_active, ${PERIMETRE_COLS}`)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

const fmt = (p) =>
  p ? `${p.nom ?? '—'} | ${JSON.stringify(p.territoires_assignes)} | ${(p.quartiers_assignes || []).length} quartiers | commercial ${p.commercial_id ? 'oui' : 'non'}` : '(absent)'

async function main() {
  console.log(APPLY ? '=== APPLY ===' : '=== DRY-RUN (ajouter --apply pour écrire) ===')
  const users = await listAuthUsers()

  for (const row of ROWS) {
    console.log(`\n# ${row.email}`)
    let user = users.get(row.email)
    let patch = {}

    if (user) {
      const before = await getProfile(user.id)
      console.log(`  avant : ${fmt(before)}`)
      console.log(`  → mot de passe mis à jour, must_change_password=false`)
      if (APPLY) {
        const { error } = await supabase.auth.admin.updateUserById(user.id, {
          password: row.password,
          user_metadata: { ...user.user_metadata, must_change_password: false },
        })
        if (error) throw error
      }
    } else {
      const src = users.get(row.source)
      if (!src) throw new Error(`Ancien compte source introuvable : ${row.source}`)
      const srcProfile = await getProfile(src.id)
      console.log(`  absent → création, périmètre recopié de ${row.source} : ${fmt(srcProfile)}`)
      for (const col of PERIMETRE_COLS.split(', ')) patch[col] = srcProfile[col]
      if (!row.nom) patch.nom = srcProfile.nom
      if (APPLY) {
        const { data, error } = await supabase.auth.admin.createUser({
          email: row.email,
          password: row.password,
          email_confirm: true,
          user_metadata: { nom: row.nom ?? srcProfile.nom, role: 'merchandiser' },
        })
        if (error) throw error
        user = data.user
      }
    }

    if (row.nom) patch.nom = row.nom
    Object.assign(patch, row.perimetre || {})
    patch.role = 'merchandiser'
    patch.is_active = true
    patch.email = row.email
    console.log(`  profil : ${JSON.stringify({ ...patch, quartiers_assignes: patch.quartiers_assignes && `${patch.quartiers_assignes.length} quartiers` })}`)

    if (APPLY) {
      const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)
      if (error) throw error
      console.log(`  après : ${fmt(await getProfile(user.id))}`)
    }
  }
  console.log('\nTerminé.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
