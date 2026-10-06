#!/usr/bin/env node
/**
 * Affecte à chaque merchandiser nommé dans l'export DMS (colonne
 * « Merchandiseur ») les PDV de ses clients :
 *
 * 1. Compte : nom du fichier → profil merchandiser actif (ordre prénom/nom
 *    indifférent), sauf COMPTE_FORCE. Contrôle croisé avec le fichier des
 *    mails (commune, email, nom — la colonne mot de passe n'est jamais lue).
 * 2. Périmètre REMPLACÉ : territoires = libellés `pdv.zone` exacts de ses PDV,
 *    quartiers = leurs quartiers non vides. Chaque PDV passe ainsi pdvInScope
 *    sans alias, comme l'import de tournées (stores/routing.ts).
 * 3. Tournée : une règle récurrente « Portefeuille DMS — <distributeur> »,
 *    lundi → samedi, sans date de fin, avec tous ses PDV dans l'ordre du plus
 *    proche voisin. L'app la matérialise J → J+7 (materialiser_routings_periode).
 *    Relance : la règle « Portefeuille DMS » du compte est remplacée.
 *
 * Les PDV d'un client sont retrouvés par `pdv.mdm` (scripts/importer-dms-pdv.mjs).
 * Avant l'import, la simulation s'appuie sur ~/Downloads/import-dms-pdv.csv.
 *
 * Simulation par défaut (rapport dans ~/Downloads) ; --apply pour écrire.
 *
 * Usage :
 *   node scripts/affecter-merch-dms.mjs [--dms=chemin.xlsx] [--mails=chemin.xlsx]
 *     [--debut=2026-10-05] [--auteur=email-admin] [--pregenerer=7] [--apply]
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import ExcelJS from 'exceljs'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { aGps, cleNom, distributeurCanonique, lireCsv, lireDms, norm, ordreGps, texteCellule, toutesLesLignes } from './lib/dms.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env'), quiet: true })

const arg = (nom, defaut) => process.argv.find(a => a.startsWith(`--${nom}=`))?.split('=').slice(1).join('=') || defaut
const APPLY = process.argv.includes('--apply')

const DOWNLOADS = join(process.env.HOME, 'Downloads')
const DMS_PATH = arg('dms', join(DOWNLOADS, '20260929_115747.xlsx'))
const MAILS_PATH = arg('mails', join(DOWNLOADS, 'MAILS MERCH (1).xlsx'))
const DATE_DEBUT = arg('debut', '2026-10-05')
const AUTEUR = arg('auteur', '')
// Jours de tournées matérialisés dès l'affectation (0 = laissés à l'app, J → J+7 à l'ouverture).
const PREGENERER = Number(arg('pregenerer', 0))
const IMPORT_CSV = join(DOWNLOADS, 'import-dms-pdv.csv')
const OUT_MD = join(DOWNLOADS, 'affectation-merch-dms-rapport.md')

const PREFIXE_REGLE = 'Portefeuille DMS'
const JOURS = [1, 2, 3, 4, 5, 6] // lundi → samedi (0 = dimanche, comme extract(dow))
const OBJECTIFS = { releve_stock: true, photos: true } // défaut de addTemplatePDV

// Nom du fichier → compte, quand le nom seul ne suffit pas.
const COMPTE_FORCE = {
  // Deux comptes « Deheo Wilfried » ; yopougontwo@ est l'ancien.
  'DEHEO WILFRIED': 'yopougonmerchtwo@gmail.com',
  // Décision du 29/09 : Guihi Bernadin reprend le compte de Cocody 2.
  'GUIHI BERNADIN': 'cocodymerchtwo@gmail.com',
}
// Profil renommé pour porter le nom du fichier DMS.
const RENOMMER = { 'cocodymerchtwo@gmail.com': 'GUIHI BERNADIN' }

if (!/^\d{4}-\d{2}-\d{2}$/.test(DATE_DEBUT)) throw new Error(`--debut=${DATE_DEBUT} : format attendu AAAA-MM-JJ`)

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ---------- 1. Clients DMS affectés ----------

const { clients } = await lireDms(DMS_PATH)
const affectes = clients.filter(c => c.merch)

// ---------- 2. Fichier des mails (commune, email, nom) ----------

async function lireMails(chemin) {
  if (!existsSync(chemin)) return []
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(chemin)
  const ws = wb.worksheets[0]
  let cols = null
  const lignes = []
  ws.eachRow((row) => {
    const cellule = (i) => String(texteCellule(row.getCell(i).value) ?? '').trim()
    if (!cols) {
      // Ligne d'en-tête : on ne retient que ces trois colonnes.
      const idx = {}
      row.eachCell((c, i) => {
        const h = norm(texteCellule(c.value))
        if (h === 'COMMUNES') idx.commune = i
        if (h === 'EMAIL') idx.email = i
        if (h === 'MERCHANDISERS') idx.nom = i
      })
      if (idx.email) cols = idx
      return
    }
    const email = cellule(cols.email).toLowerCase()
    if (email) lignes.push({ email, commune: cols.commune ? cellule(cols.commune) : '', nom: cols.nom ? cellule(cols.nom) : '' })
  })
  return lignes
}
const mails = await lireMails(MAILS_PATH)
const mailParEmail = new Map(mails.map(m => [m.email, m]))

// ---------- 3. Comptes ----------

const profils = await toutesLesLignes(() => supabase.from('profiles')
  .select('id,email,nom,role,is_active,zone_assignee,territoires_assignes,quartiers_assignes')
  .in('role', ['merchandiser', 'admin']).order('id'))
const merchsActifs = profils.filter(p => p.role === 'merchandiser' && p.is_active !== false && p.email)
const auteur = AUTEUR ? profils.find(p => p.email?.toLowerCase() === AUTEUR.toLowerCase() && p.role === 'admin') : null
if (AUTEUR && !auteur) throw new Error(`--auteur=${AUTEUR} : aucun admin avec cet email`)
const nomsDistributeur = (await toutesLesLignes(() => supabase.from('distributeur').select('nom').order('id'))).map(d => d.nom)

const nomsFichier = [...new Set(affectes.map(c => c.merch))].sort((a, b) => a.localeCompare(b, 'fr'))
const merchs = nomsFichier.map((nomFichier) => {
  const force = COMPTE_FORCE[norm(nomFichier)]
  const candidats = force
    ? merchsActifs.filter(p => p.email.toLowerCase() === force)
    : merchsActifs.filter(p => cleNom(p.nom) === cleNom(nomFichier))
  const siens = affectes.filter(c => c.merch === nomFichier)
  return {
    nomFichier,
    profil: candidats.length === 1 ? candidats[0] : null,
    candidats,
    clients: siens,
    zonesFichier: [...new Set(siens.map(c => c.zone).filter(Boolean))],
    // Distributeurs DMS de ses clients, du plus fréquent au moins fréquent.
    distributeurs: [...siens.reduce((m, c) => m.set(c.distributeurs[0], (m.get(c.distributeurs[0]) || 0) + 1), new Map())]
      .filter(([d]) => d).sort((a, b) => b[1] - a[1]).map(([d]) => d),
  }
})

// ---------- 4. PDV des clients ----------

const codes = affectes.map(c => c.code)
const pdvParMdm = new Map()
for (let i = 0; i < codes.length; i += 200) {
  const { data, error } = await supabase.from('pdv')
    .select('pdv_id,nom_pdv,zone,quartier,geolocation_lat,geolocation_lng,distributor_name,mdm,is_active')
    .in('mdm', codes.slice(i, i + 200))
  if (error) throw error
  data.forEach(p => pdvParMdm.set(p.mdm, p))
}

// Tous les PDV, pour mesurer ce que chaque périmètre rend visible.
const visibles = new Map((await toutesLesLignes(() => supabase.from('pdv')
  .select('pdv_id,zone,quartier').eq('is_active', true).order('pdv_id'))).map(p => [p.pdv_id, p]))

// Avant l'import, on simule à partir du CSV de simulation de l'import.
let source = 'base (pdv.mdm)'
if (pdvParMdm.size < codes.length && !APPLY && existsSync(IMPORT_CSV)) {
  source = `simulation (${IMPORT_CSV.split('/').pop()} — import pas encore appliqué)`
  for (const l of lireCsv(readFileSync(IMPORT_CSV, 'utf8'))) {
    const p = {
      pdv_id: l.pdv_id, nom_pdv: l['Nom client'], zone: l.Territoire || null, quartier: l.Quartier || null,
      geolocation_lat: l.Latitude ? Number(l.Latitude) : null, geolocation_lng: l.Longitude ? Number(l.Longitude) : null,
      distributor_name: l.Distributeur, mdm: l['Code client'], is_active: true,
    }
    visibles.set(p.pdv_id, { ...visibles.get(p.pdv_id), pdv_id: p.pdv_id, zone: p.zone, quartier: p.quartier })
    if (!pdvParMdm.has(p.mdm)) pdvParMdm.set(p.mdm, p)
  }
}

// composables/useUserScope.ts — pdvInScope sans alias
const dansPerimetre = (p, territoires, quartiers) =>
  territoires.includes(p.zone || '') && (!quartiers.length || !p.quartier || quartiers.includes(p.quartier))

for (const m of merchs) {
  m.pdvs = m.clients.map(c => pdvParMdm.get(c.code)).filter(Boolean)
  m.manquants = m.clients.filter(c => !pdvParMdm.has(c.code))
  const parZone = new Map()
  m.pdvs.forEach(p => { if (p.zone) parZone.set(p.zone, (parZone.get(p.zone) || 0) + 1) })
  m.territoires = [...parZone].sort((a, b) => b[1] - a[1]).map(([z]) => z)
  m.quartiers = [...new Set(m.pdvs.map(p => p.quartier).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'))
  m.sansZone = m.pdvs.filter(p => !p.zone)
  m.sansGps = m.pdvs.filter(p => !aGps(p.geolocation_lat, p.geolocation_lng))
  m.ordre = ordreGps(m.pdvs)
  m.distributeur = m.distributeurs.length ? distributeurCanonique(m.distributeurs[0], nomsDistributeur) : ''
  m.label = `${PREFIXE_REGLE} — ${m.distributeur || m.nomFichier}`
  m.nbVisibles = [...visibles.values()].filter(p => dansPerimetre(p, m.territoires, m.quartiers)).length
  m.nbVisiblesAvant = m.profil
    ? [...visibles.values()].filter(p => dansPerimetre(p,
      (m.profil.territoires_assignes?.length ? m.profil.territoires_assignes : [m.profil.zone_assignee]).filter(Boolean),
      (m.profil.quartiers_assignes || []).filter(Boolean))).length
    : 0
  m.mail = m.profil ? mailParEmail.get(m.profil.email.toLowerCase()) : null
}

// ---------- 5. Existant : règles et tournées des comptes ----------

const ids = merchs.filter(m => m.profil).map(m => m.profil.id)
const { data: regles, error: reglesErr } = await supabase.from('routing_templates')
  .select('id,user_id,label,is_active,days_of_week,date_debut,date_fin').in('user_id', ids)
if (reglesErr) throw reglesErr
const finFenetre = new Date(`${DATE_DEBUT}T00:00:00Z`)
finFenetre.setUTCDate(finFenetre.getUTCDate() + 30)
const { data: tournees, error: tourneesErr } = await supabase.from('routings')
  .select('user_id,date_routing,source').in('user_id', ids)
  .gte('date_routing', DATE_DEBUT).lte('date_routing', finFenetre.toISOString().slice(0, 10))
if (tourneesErr) throw tourneesErr
const { data: appareils, error: appareilsErr } = await supabase.from('version_installee').select('user_id,version_nom,version_code,vu_le').in('user_id', ids)

for (const m of merchs.filter(m => m.profil)) {
  m.reglesDms = (regles || []).filter(r => r.user_id === m.profil.id && String(r.label || '').startsWith(PREFIXE_REGLE))
  m.autresRegles = (regles || []).filter(r => r.user_id === m.profil.id && r.is_active && !String(r.label || '').startsWith(PREFIXE_REGLE))
  m.tourneesExistantes = (tournees || []).filter(t => t.user_id === m.profil.id).map(t => t.date_routing).sort()
  const siens = (appareils || []).filter(a => a.user_id === m.profil.id).sort((a, b) => String(b.vu_le).localeCompare(String(a.vu_le)))
  m.version = appareilsErr
    ? 'inconnue (migration 1.0.10 non appliquée)'
    : siens[0] ? `${siens[0].version_nom || siens[0].version_code} (vu le ${String(siens[0].vu_le).slice(0, 10)})` : '≤ 1.0.9 ou jamais ouverte'
}

// ---------- 6. Écriture ----------

if (APPLY) {
  const incomplets = merchs.filter(m => m.profil && m.manquants.length)
  if (incomplets.length) {
    console.error(`❌ PDV introuvables par pdv.mdm : ${incomplets.map(m => `${m.nomFichier} (${m.manquants.length})`).join(', ')}. Lancer d'abord scripts/importer-dms-pdv.mjs --apply.`)
    process.exit(1)
  }

  for (const m of merchs.filter(m => m.profil && m.pdvs.length)) {
    const email = m.profil.email.toLowerCase()
    const maj = {
      territoires_assignes: m.territoires,
      zone_assignee: m.territoires[0] || null,
      quartiers_assignes: m.quartiers,
    }
    if (RENOMMER[email] && m.profil.nom !== RENOMMER[email]) maj.nom = RENOMMER[email]
    const { error: profErr } = await supabase.from('profiles').update(maj).eq('id', m.profil.id)
    if (profErr) throw new Error(`profil ${email} : ${profErr.message}`)

    if (m.reglesDms.length) {
      const { error } = await supabase.from('routing_templates').delete().in('id', m.reglesDms.map(r => r.id))
      if (error) throw new Error(`suppression règle ${email} : ${error.message}`)
    }
    const { data: regle, error: regleErr } = await supabase.from('routing_templates').insert({
      user_id: m.profil.id,
      days_of_week: JOURS,
      day_of_week: JOURS[0],
      label: m.label,
      // Atom : N PDV par canal et par jour, chaque PDV une fois par mois (etapes_quota_du_jour).
      mode: m.profil.employeur === 'atom' ? 'quota' : 'perimetre',
      notes: `Clients DMS du fichier ${DMS_PATH.split('/').pop()} (${m.pdvs.length} PDV).`,
      territoire: null,
      distributeur: m.distributeur || null,
      date_debut: DATE_DEBUT,
      date_fin: null,
      is_active: true,
      created_by: auteur?.id || null,
    }).select('id').single()
    if (regleErr) throw new Error(`règle ${email} : ${regleErr.message}`)

    const lignes = m.ordre.map((p, k) => ({ template_id: regle.id, pdv_id: p.pdv_id, position_order: k + 1, objectifs: OBJECTIFS }))
    for (let i = 0; i < lignes.length; i += 500) {
      const { error } = await supabase.from('routing_template_pdv').insert(lignes.slice(i, i + 500))
      if (error) throw new Error(`PDV de la règle ${email} : ${error.message}`)
    }
    m.regleCreee = regle.id
    console.log(`✅ ${m.nomFichier} → ${email} : ${m.territoires.length} territoire(s), ${m.quartiers.length} quartier(s), règle de ${lignes.length} PDV`)
  }

  // Tournées des premiers jours matérialisées tout de suite (sinon à la
  // première ouverture de l'app). Idempotent : un jour déjà créé est gardé.
  if (PREGENERER > 0) {
    const fin = new Date(`${DATE_DEBUT}T00:00:00Z`)
    fin.setUTCDate(fin.getUTCDate() + PREGENERER - 1)
    for (const m of merchs.filter(m => m.regleCreee)) {
      const { data, error } = await supabase.rpc('materialiser_routings_periode', {
        p_user_id: m.profil.id, p_date_debut: DATE_DEBUT, p_date_fin: fin.toISOString().slice(0, 10),
      })
      if (error) throw new Error(`pré-génération ${m.profil.email} : ${error.message}`)
      m.tourneesCreees = data || 0
      console.log(`📅 ${m.nomFichier} : ${m.tourneesCreees} tournée(s) créée(s) du ${DATE_DEBUT} au ${fin.toISOString().slice(0, 10)}`)
    }
  }
}

// ---------- 7. Rapport ----------

const liste = (xs, max = 12) => (xs.length ? `${xs.slice(0, max).join(', ')}${xs.length > max ? `, … (+${xs.length - max})` : ''}` : '—')
const anomalies = []
for (const m of merchs) {
  if (!m.profil) {
    anomalies.push(m.candidats.length
      ? `**${m.nomFichier}** : ${m.candidats.length} comptes possibles (${m.candidats.map(p => p.email).join(', ')}) — non affecté, à trancher dans COMPTE_FORCE.`
      : `**${m.nomFichier}** : aucun compte merchandiser actif à ce nom — non affecté (${m.clients.length} clients).`)
    continue
  }
  if (m.manquants.length) anomalies.push(`**${m.nomFichier}** : ${m.manquants.length} clients sans PDV (import pas encore appliqué ?).`)
  if (m.sansZone.length) anomalies.push(`**${m.nomFichier}** : ${m.sansZone.length} PDV sans territoire, invisibles du terrain.`)
  if (!m.mail) anomalies.push(`**${m.nomFichier}** : compte ${m.profil.email} absent du fichier des mails.`)
  else if (m.mail.nom && cleNom(m.mail.nom) !== cleNom(RENOMMER[m.profil.email.toLowerCase()] || m.nomFichier)) {
    anomalies.push(`**${m.nomFichier}** : le fichier des mails donne « ${m.mail.nom} » pour ${m.profil.email} (${m.mail.commune}).`)
  }
  if (m.autresRegles.length) anomalies.push(`**${m.nomFichier}** : ${m.autresRegles.length} autre(s) règle(s) active(s) conservée(s) — leurs PDV s'ajoutent à la tournée.`)
  if (m.tourneesExistantes.length) {
    anomalies.push(`**${m.nomFichier}** : ${m.tourneesExistantes.length} tournée(s) déjà en base sur les 30 jours suivant le ${DATE_DEBUT} (${liste(m.tourneesExistantes, 6)}) — elles priment sur la règle ces jours-là.`)
  }
}
const nomsHorsFichier = mails.filter(m => !merchs.some(x => x.profil?.email.toLowerCase() === m.email))
nomsHorsFichier.forEach(m => anomalies.push(`Fichier des mails : ${m.email} (${m.commune || '?'}${m.nom ? `, ${m.nom}` : ', sans nom'}) n'a aucun client dans l'export DMS.`))

const md = `# Affectation des merchandisers DMS ${APPLY ? '(appliquée)' : '(simulation)'}

Source : \`${DMS_PATH.split('/').pop()}\` — ${affectes.length} clients avec un merchandiser.
PDV des clients lus depuis : ${source}.
Règle : « ${PREFIXE_REGLE} — <distributeur> », lundi → samedi, à partir du ${DATE_DEBUT}, sans date de fin, tous les PDV du merchandiser.

## Synthèse

| Merchandiser (fichier) | Compte | Clients | PDV en tournée | sans GPS | Territoires (remplacés) | Quartiers | PDV visibles avant → après | Version app |
|---|---|---|---|---|---|---|---|---|
${merchs.map(m => `| ${m.nomFichier} | ${m.profil?.email || '**aucun**'} | ${m.clients.length} | ${m.pdvs.length} | ${m.sansGps.length} | ${m.territoires.join(', ') || '—'} | ${m.quartiers.length} | ${m.nbVisiblesAvant} → ${m.nbVisibles} | ${m.version || '—'} |`).join('\n')}

« PDV visibles » : PDV de ses territoires dont le quartier est dans sa liste, ou vide (un PDV sans quartier est visible de tout le territoire). Hors alias de territoire.

## Avant / après

${merchs.filter(m => m.profil).map(m => `### ${m.nomFichier} — ${m.profil.email}${RENOMMER[m.profil.email.toLowerCase()] && m.profil.nom !== RENOMMER[m.profil.email.toLowerCase()] ? ` (renommé « ${m.profil.nom} » → « ${RENOMMER[m.profil.email.toLowerCase()]} »)` : ''}

- Zone(s) dans le fichier DMS : ${liste(m.zonesFichier)} · distributeur(s) : ${liste(m.distributeurs)}
- Territoires : ${liste(m.profil.territoires_assignes || [])} → **${liste(m.territoires)}**
- Quartiers : ${(m.profil.quartiers_assignes || []).length} → **${m.quartiers.length}**
- Ancienne liste de quartiers (retour arrière) : \`${JSON.stringify(m.profil.quartiers_assignes || [])}\`
- Ancienne liste de territoires (retour arrière) : \`${JSON.stringify(m.profil.territoires_assignes || [])}\`, zone_assignee \`${m.profil.zone_assignee || ''}\`
- Tournée « ${m.label} » : ${m.pdvs.length} PDV, dont ${m.sansGps.length} sans GPS placés en fin de liste${m.regleCreee ? ` — règle \`${m.regleCreee}\`` : ''}${m.tourneesCreees != null ? ` — ${m.tourneesCreees} tournée(s) pré-générée(s)` : ''}`).join('\n\n')}

## Anomalies

${anomalies.length ? anomalies.map(a => `- ${a}`).join('\n') : 'Aucune.'}

## Retour arrière

\`\`\`sql
delete from public.routing_templates where label like '${PREFIXE_REGLE}%';
-- puis restaurer territoires_assignes / quartiers_assignes / zone_assignee depuis « Avant / après ».
\`\`\`
`
writeFileSync(OUT_MD, md, 'utf8')
console.log(md)
