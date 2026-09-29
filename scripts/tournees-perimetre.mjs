#!/usr/bin/env node
/**
 * Tournée « portefeuille » pour chaque merchandiser actif qui n'en a pas via le
 * fichier DMS : une règle récurrente lundi → samedi, sans date de fin, avec
 * TOUS les PDV de son périmètre, dans l'ordre du plus proche voisin.
 *
 * Périmètre = celui de la base (pdv_ids_perimetre) : territoires du profil
 * étendus à leurs alias (territoires_etendus), puis quartiers du profil s'il en
 * a (un PDV sans quartier reste dans le périmètre).
 *
 * - Comptes affectés depuis le fichier DMS (règle « Portefeuille DMS ») : ignorés
 *   (scripts/affecter-merch-dms.mjs).
 * - Comptes de démonstration (qa.*@friesland-test.ci, merchandiser@friesland.ci) :
 *   exclus, sauf --inclure-test.
 * - Compte sans territoire (il verrait tout le parc) : ignoré.
 * - Relance : la règle « Portefeuille périmètre » du compte est remplacée.
 *
 * Simulation par défaut ; --apply pour écrire.
 * --pregenerer=N : matérialise tout de suite les N premiers jours, jour par jour
 * (materialiser_routing_jour, idempotente : un jour déjà créé est gardé).
 *
 * Usage :
 *   node scripts/tournees-perimetre.mjs [--debut=AAAA-MM-JJ] [--pregenerer=7] [--inclure-test] [--apply]
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { writeFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { aGps, ordreGps, toutesLesLignes } from './lib/dms.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env'), quiet: true })

const arg = (nom, defaut) => process.argv.find(a => a.startsWith(`--${nom}=`))?.split('=').slice(1).join('=') || defaut
const APPLY = process.argv.includes('--apply')
const INCLURE_TEST = process.argv.includes('--inclure-test')

const aujourdhui = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})()
const DATE_DEBUT = arg('debut', aujourdhui)
const PREGENERER = Number(arg('pregenerer', 0))
if (!/^\d{4}-\d{2}-\d{2}$/.test(DATE_DEBUT)) throw new Error(`--debut=${DATE_DEBUT} : format attendu AAAA-MM-JJ`)

const OUT_MD = join(process.env.HOME, 'Downloads', 'tournees-perimetre-rapport.md')

const PREFIXE_DMS = 'Portefeuille DMS'
const PREFIXE = 'Portefeuille périmètre'
const JOURS = [1, 2, 3, 4, 5, 6] // lundi → samedi (0 = dimanche, comme extract(dow))
const OBJECTIFS = { releve_stock: true, photos: true } // défaut de addTemplatePDV
// Périmètres de plusieurs villes (San Pedro + Soubré…) : seuls les points à
// plus de 100 km du centre du lot sont tenus pour faux et mis en fin de liste.
const GPS_DOUTEUX_M = 100_000

const estCompteTest = email => /@friesland-test\.ci$/i.test(email) || email.toLowerCase() === 'merchandiser@friesland.ci'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ---------- Données ----------

const [profils, territoires, alias, pdvs, regles] = await Promise.all([
  toutesLesLignes(() => supabase.from('profiles')
    .select('id,email,nom,role,is_active,zone_assignee,territoires_assignes,quartiers_assignes')
    .eq('role', 'merchandiser').order('id')),
  toutesLesLignes(() => supabase.from('territoire').select('code,nom').order('code')),
  toutesLesLignes(() => supabase.from('territoire_alias').select('alias,territoire_code').order('alias')),
  toutesLesLignes(() => supabase.from('pdv')
    .select('pdv_id,nom_pdv,zone,quartier,geolocation_lat,geolocation_lng')
    .eq('is_active', true).order('pdv_id')),
  toutesLesLignes(() => supabase.from('routing_templates').select('id,user_id,label,is_active').order('id')),
])

// Miroir de territoires_etendus() (migration 20260908100000) : noms du profil,
// nom de référence du territoire (et en capitales), alias du même territoire.
const cle = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim()
function territoiresEtendus(noms) {
  const codes = new Set()
  for (const n of noms) {
    const k = cle(n)
    territoires.filter(t => cle(t.nom) === k).forEach(t => codes.add(t.code))
    alias.filter(a => cle(a.alias) === k).forEach(a => codes.add(a.territoire_code))
  }
  const out = new Set(noms)
  territoires.filter(t => codes.has(t.code)).forEach((t) => { out.add(t.nom); out.add(t.nom.toUpperCase()) })
  alias.filter(a => codes.has(a.territoire_code)).forEach(a => out.add(a.alias))
  return out
}

// ---------- Comptes et périmètres ----------

const dms = new Set(regles.filter(r => String(r.label || '').startsWith(PREFIXE_DMS)).map(r => r.user_id))
const comptes = []
const ignores = []
for (const p of profils.filter(p => p.is_active !== false && p.email)) {
  if (dms.has(p.id)) { ignores.push({ p, motif: 'tournée « Portefeuille DMS » (fichier DMS)' }); continue }
  if (!INCLURE_TEST && estCompteTest(p.email)) { ignores.push({ p, motif: 'compte de démonstration (--inclure-test pour l\'inclure)' }); continue }
  const t = (p.territoires_assignes || []).filter(Boolean)
  const terrs = t.length ? t : (p.zone_assignee ? [p.zone_assignee] : [])
  if (!terrs.length) { ignores.push({ p, motif: 'aucun territoire : il verrait tout le parc' }); continue }
  const quartiers = (p.quartiers_assignes || []).filter(Boolean)
  const noms = territoiresEtendus(terrs)
  const siens = pdvs.filter(x => noms.has(x.zone || '') && (!quartiers.length || !x.quartier || quartiers.includes(x.quartier)))
  if (!siens.length) { ignores.push({ p, motif: `périmètre vide (${terrs.join(', ')})` }); continue }
  comptes.push({
    p,
    terrs,
    pdvs: siens,
    ordre: ordreGps(siens, { gpsDouteuxM: GPS_DOUTEUX_M }),
    sansGps: siens.filter(x => !aGps(x.geolocation_lat, x.geolocation_lng)).length,
    label: `${PREFIXE} — ${terrs.join(', ')}`.slice(0, 200),
    anciennes: regles.filter(r => r.user_id === p.id && String(r.label || '').startsWith(PREFIXE)),
    autres: regles.filter(r => r.user_id === p.id && r.is_active && !String(r.label || '').startsWith(PREFIXE)),
  })
}
comptes.sort((a, b) => b.pdvs.length - a.pdvs.length)

// ---------- Écriture ----------

const joursPregeneres = []
if (PREGENERER > 0) {
  const d = new Date(`${DATE_DEBUT}T00:00:00Z`)
  for (let i = 0; i < PREGENERER; i++) {
    joursPregeneres.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
}

if (APPLY) {
  for (const c of comptes) {
    if (c.anciennes.length) {
      const { error } = await supabase.from('routing_templates').delete().in('id', c.anciennes.map(r => r.id))
      if (error) throw new Error(`suppression règle ${c.p.email} : ${error.message}`)
    }
    const { data: regle, error: regleErr } = await supabase.from('routing_templates').insert({
      user_id: c.p.id,
      days_of_week: JOURS,
      day_of_week: JOURS[0],
      label: c.label,
      notes: `Tous les PDV du périmètre (${c.pdvs.length} PDV au ${aujourdhui}).`,
      territoire: null,
      distributeur: null,
      date_debut: DATE_DEBUT,
      date_fin: null,
      is_active: true,
      created_by: null,
    }).select('id').single()
    if (regleErr) throw new Error(`règle ${c.p.email} : ${regleErr.message}`)

    const lignes = c.ordre.map((x, k) => ({ template_id: regle.id, pdv_id: x.pdv_id, position_order: k + 1, objectifs: OBJECTIFS }))
    for (let i = 0; i < lignes.length; i += 500) {
      const { error } = await supabase.from('routing_template_pdv').insert(lignes.slice(i, i + 500))
      if (error) throw new Error(`PDV de la règle ${c.p.email} : ${error.message}`)
    }
    c.regle = regle.id
    console.log(`✅ ${c.p.email} : règle de ${lignes.length} PDV`)
  }

  // Jour par jour : une journée de 4 000 PDV tient dans le délai d'une requête,
  // une semaine entière en un seul appel pourrait le dépasser.
  for (const c of comptes) {
    c.tournees = 0
    for (const jour of joursPregeneres) {
      const { data, error } = await supabase.rpc('materialiser_routing_jour', { p_user_id: c.p.id, p_date: jour })
      if (error) throw new Error(`pré-génération ${c.p.email} ${jour} : ${error.message}`)
      if (data) c.tournees++
    }
    if (joursPregeneres.length) console.log(`📅 ${c.p.email} : ${c.tournees} tournée(s) du ${joursPregeneres[0]} au ${joursPregeneres.at(-1)}`)
  }
}

// ---------- Rapport ----------

const total = comptes.reduce((s, c) => s + c.pdvs.length, 0)
const joursOuvres = joursPregeneres.filter(j => JOURS.includes(new Date(`${j}T00:00:00Z`).getUTCDay())).length
const md = `# Tournées « portefeuille » par périmètre ${APPLY ? '(appliqué)' : '(simulation)'}

Règle : « ${PREFIXE} — <territoires> », lundi → samedi, à partir du ${DATE_DEBUT}, sans date de fin, tous les PDV du périmètre.
${joursPregeneres.length ? `Pré-génération : ${joursPregeneres[0]} → ${joursPregeneres.at(-1)} (${joursOuvres} jour(s) ouvré(s)).` : 'Pas de pré-génération : l\'app crée les tournées J → J+7 à l\'ouverture.'}

## Comptes

| Compte | Nom | Territoires | PDV par tournée | dont sans GPS | Tournées créées |
|---|---|---|---|---|---|
${comptes.map(c => `| ${c.p.email} | ${c.p.nom || ''} | ${c.terrs.join(', ')} | ${c.pdvs.length} | ${c.sansGps} | ${c.tournees ?? '—'} |`).join('\n')}

Total : ${comptes.length} comptes, ${total} PDV par jour ouvré${joursOuvres ? `, soit ${total * joursOuvres} étapes pré-générées` : ''}.

## Comptes ignorés

${ignores.map(({ p, motif }) => `- ${p.email} (${p.nom || ''}) : ${motif}`).join('\n') || 'Aucun.'}

## Autres règles actives conservées

${comptes.filter(c => c.autres.length).map(c => `- ${c.p.email} : ${c.autres.map(r => r.label || r.id).join(', ')} — leurs PDV s'ajoutent à la tournée.`).join('\n') || 'Aucune.'}

## Retour arrière

\`\`\`sql
delete from public.routing_templates where label like '${PREFIXE}%';
-- les tournées déjà matérialisées restent : les supprimer au besoin par date (routings.source = 'regle').
\`\`\`
`
writeFileSync(OUT_MD, md, 'utf8')
console.log(md)
