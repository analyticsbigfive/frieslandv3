#!/usr/bin/env node
/**
 * Brouillon de l'email de bilan de l'intégration du fichier clients DMS, et ses
 * pièces jointes. Repart des sorties de scripts/importer-dms-pdv.mjs (à lancer
 * d'abord : après --apply pour les chiffres définitifs).
 *
 * Sorties dans ~/Downloads (aucune écriture en base, aucun envoi) :
 *   - email-bilan-import-dms.md     objet + corps, à copier dans la messagerie
 *   - pdv-sans-gps-dms.xlsx         PDV créés sans coordonnées, avec le motif
 *   - incoherences-dms.xlsx         district ≠ GPS, distributeurs hors
 *                                   référentiel, contacts manquants, comptes
 *
 * Usage :
 *   node scripts/bilan-email-dms.mjs [--dms=chemin.xlsx] [--mails=chemin.xlsx]
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import ExcelJS from 'exceljs'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleNom, lireCsv, lireDms, norm, texteCellule, toutesLesLignes } from './lib/dms.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env'), quiet: true })

const arg = (nom, defaut) => process.argv.find(a => a.startsWith(`--${nom}=`))?.split('=').slice(1).join('=') || defaut
const DOWNLOADS = join(process.env.HOME, 'Downloads')
const DMS_PATH = arg('dms', join(DOWNLOADS, '20260929_115747.xlsx'))
const MAILS_PATH = arg('mails', join(DOWNLOADS, 'MAILS MERCH (1).xlsx'))
const IMPORT_CSV = join(DOWNLOADS, 'import-dms-pdv.csv')
const SANS_GPS_CSV = join(DOWNLOADS, 'pdv-sans-gps-dms.csv')
const IMPORT_MD = join(DOWNLOADS, 'import-dms-pdv-rapport.md')

const OUT_EMAIL = join(DOWNLOADS, 'email-bilan-import-dms.md')
const OUT_SANS_GPS = join(DOWNLOADS, 'pdv-sans-gps-dms.xlsx')
const OUT_INCOHERENCES = join(DOWNLOADS, 'incoherences-dms.xlsx')

for (const f of [IMPORT_CSV, SANS_GPS_CSV]) {
  if (!existsSync(f)) throw new Error(`${f} introuvable : lancer d'abord node scripts/importer-dms-pdv.mjs`)
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ---------- Données ----------

const imports = lireCsv(readFileSync(IMPORT_CSV, 'utf8'))
const sansGps = lireCsv(readFileSync(SANS_GPS_CSV, 'utf8'))
const applique = existsSync(IMPORT_MD) && readFileSync(IMPORT_MD, 'utf8').includes('(appliqué)')
const { clients } = await lireDms(DMS_PATH)

const [territoires, distributeurs, liensTerr] = await Promise.all([
  toutesLesLignes(() => supabase.from('territoire').select('id,code,nom').order('id')),
  toutesLesLignes(() => supabase.from('distributeur').select('id,nom').order('id')),
  toutesLesLignes(() => supabase.from('territoire_distributeur').select('territoire_id,distributeur_id').order('territoire_id')),
])

const compter = (items, cle) => {
  const m = new Map()
  items.forEach(i => { const k = cle(i) || '(vide)'; m.set(k, (m.get(k) || 0) + 1) })
  return [...m].sort((a, b) => b[1] - a[1])
}
const fr = (n) => Number(n).toLocaleString('fr-FR')

const crees = imports.filter(l => l.Action === 'créé')
const relies = imports.filter(l => l.Action === 'relié' || l.Action === 'déjà relié')
const depot = sansGps.filter(l => /dépôt/.test(l.Motif))
const absents = sansGps.filter(l => !/dépôt/.test(l.Motif))
const desaccords = imports.filter(l => l['District ≠ GPS'] === 'oui')

// Merchandisers du fichier et leurs PDV
const parMerch = compter(imports.filter(l => l['Merchandiser (fichier)']), l => l['Merchandiser (fichier)'])
  .map(([nom, n]) => ({
    nom,
    clients: n,
    sansGps: sansGps.filter(l => l['Merchandiser (fichier)'] === nom).length,
    distributeur: compter(imports.filter(l => l['Merchandiser (fichier)'] === nom), l => l.Distributeur)[0]?.[0] || '',
  }))

// Distributeur × territoire absents du référentiel
const idTerr = new Map(territoires.map(t => [t.code, t.id]))
const nomTerr = new Map(territoires.map(t => [t.code, t.nom]))
const idDist = new Map(distributeurs.map(d => [norm(d.nom), d.id]))
const liens = new Set(liensTerr.map(l => `${l.territoire_id}:${l.distributeur_id}`))
const horsRef = compter(crees.filter((l) => {
  const t = idTerr.get(l['Code territoire'])
  const d = idDist.get(norm(l.Distributeur))
  return t && l.Distributeur && (!d || !liens.has(`${t}:${d}`))
}), l => `${l.Distributeur}|${l['Code territoire']}`).map(([k, n]) => {
  const [dist, code] = k.split('|')
  return { dist, territoire: nomTerr.get(code) || code, n }
})

// Contacts
const sansContact = clients.filter(c => !c.contact || c.contact === '0')

// Fichier des mails : commune, email, nom (la colonne mot de passe n'est jamais lue)
async function lireMails(chemin) {
  if (!existsSync(chemin)) return []
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(chemin)
  let cols = null
  const lignes = []
  wb.worksheets[0].eachRow((row) => {
    const cellule = i => String(texteCellule(row.getCell(i).value) ?? '').trim()
    if (!cols) {
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
const nomsDms = new Set(clients.filter(c => c.merch).map(c => cleNom(c.merch)))
const zonesDms = new Map()
clients.filter(c => c.merch).forEach(c => zonesDms.set(cleNom(c.merch), c.zone))
const comptes = mails.map((m) => {
  let constat = ''
  if (!m.nom) constat = 'Aucun merchandiser nommé dans la liste des comptes, aucun client dans le fichier DMS.'
  else if (!nomsDms.has(cleNom(m.nom))) constat = 'Aucun client affecté à ce nom dans le fichier DMS.'
  else if (zonesDms.get(cleNom(m.nom)) && cleNom(zonesDms.get(cleNom(m.nom))) !== cleNom(m.commune)) {
    constat = `Zone « ${zonesDms.get(cleNom(m.nom))} » dans le fichier DMS, commune « ${m.commune} » dans la liste des comptes.`
  }
  return { ...m, constat }
}).filter(m => m.constat)

// ---------- Pièces jointes ----------

function feuille(wb, nom, colonnes, lignes) {
  const ws = wb.addWorksheet(nom)
  ws.columns = colonnes.map(([header, key, width]) => ({ header, key, width }))
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003DA5' } }
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colonnes.length } }
  lignes.forEach(l => ws.addRow(l))
}

const wbSansGps = new ExcelJS.Workbook()
feuille(wbSansGps, 'PDV sans GPS', [
  ['Code client', 'code', 14], ['Nom client', 'nom', 28], ['Distributeur', 'dist', 30], ['Vendeur', 'vendeur', 24],
  ['Adresse', 'adresse', 24], ['Quartier DMS', 'quartier', 30], ['District DMS', 'district', 16],
  ['Merchandiser', 'merch', 18], ['Territoire attribué', 'territoire', 18], ['Code PDV (app)', 'pdv', 12], ['Motif', 'motif', 50],
  ['Latitude à renseigner', 'lat', 18], ['Longitude à renseigner', 'lng', 18],
], sansGps.map(l => ({
  code: l['Code client'], nom: l['Nom client'], dist: l.Distributeur, vendeur: l.Vendeur, adresse: l.Adresse,
  quartier: l['Quartier DMS'], district: l['District DMS'], merch: l['Merchandiser (fichier)'], territoire: l['Territoire attribué'],
  pdv: l.pdv_id, motif: l.Motif, lat: '', lng: '',
})))
await wbSansGps.xlsx.writeFile(OUT_SANS_GPS)

const wbInc = new ExcelJS.Workbook()
feuille(wbInc, 'District ≠ GPS', [
  ['Code client', 'code', 14], ['Nom client', 'nom', 28], ['Distributeur', 'dist', 30], ['District DMS', 'district', 16],
  ['Territoire selon le GPS', 'territoire', 22], ['Latitude', 'lat', 12], ['Longitude', 'lng', 12],
], desaccords.map(l => ({ code: l['Code client'], nom: l['Nom client'], dist: l.Distributeur, district: l['District DMS'], territoire: l.Territoire, lat: l.Latitude, lng: l.Longitude })))
feuille(wbInc, 'Distributeur hors territoire', [
  ['Distributeur', 'dist', 34], ['Territoire des clients', 'territoire', 22], ['Clients', 'n', 10],
], horsRef)
feuille(wbInc, 'Contacts manquants', [
  ['Code client', 'code', 14], ['Nom client', 'nom', 28], ['Distributeur', 'dist', 30], ['Vendeur', 'vendeur', 24], ['District DMS', 'district', 16],
], sansContact.map(c => ({ code: c.code, nom: c.nom, dist: c.distributeurs.join(' / '), vendeur: c.vendeurs.join(' / '), district: c.district })))
feuille(wbInc, 'Comptes merchandisers', [
  ['Commune', 'commune', 20], ['Email du compte', 'email', 30], ['Merchandiser (liste des comptes)', 'nom', 30], ['Constat', 'constat', 80],
], comptes)
await wbInc.xlsx.writeFile(OUT_INCOHERENCES)

// ---------- Email ----------

const tableau = (entetes, lignes) => [
  `| ${entetes.join(' | ')} |`,
  `|${entetes.map(() => '---').join('|')}|`,
  ...lignes.map(l => `| ${l.join(' | ')} |`),
].join('\n')

const sansGpsParDist = compter(sansGps, l => l.Distributeur)
const exemplesDesaccord = compter(desaccords, l => `${l['District DMS']} → ${l.Territoire}`).slice(0, 3)
const horsAbidjan = imports.filter(l => !l['Merchandiser (fichier)']).length

const email = `${applique ? '' : '> ⚠️ Chiffres de SIMULATION : relancer après `node scripts/importer-dms-pdv.mjs --apply`.\n\n'}**Objet :** Intégration du fichier clients DMS du 29/09 — bilan et informations à compléter

Bonjour,

Nous avons intégré dans l'application le fichier clients DMS transmis le 29/09 (${fr(imports.length)} clients). Voici le bilan, et les points pour lesquels nous avons besoin de votre retour.

**1. Ce qui a été fait**

- ${fr(crees.length)} nouveaux points de vente créés, et ${fr(relies.length)} clients rattachés à des points de vente déjà présents dans l'application. Chaque point de vente porte désormais son code client DMS : les prochains fichiers pourront être rapprochés directement.
- Le distributeur ETS HIDJABE a été ajouté au référentiel.
- Les ${parMerch.length} merchandisers de la colonne « Merchandiseur » ont reçu leur portefeuille : une tournée du lundi au samedi, sans date de fin, avec l'ensemble de leurs clients.

${tableau(['Merchandiser', 'Distributeur', 'Clients en tournée', 'dont sans GPS'], parMerch.map(m => [m.nom, m.distributeur, fr(m.clients), fr(m.sansGps)]))}

**2. Points de vente sans coordonnées GPS : ${fr(sansGps.length)}**

- ${fr(absents.length)} clients n'ont pas de coordonnées dans le fichier (latitude et longitude vides ou à 0).
- ${fr(depot.length)} clients partagent un même point GPS avec au moins 10 autres clients, vraisemblablement l'adresse du dépôt du distributeur. Ces coordonnées ont été écartées.

${tableau(['Distributeur', 'Points de vente sans GPS'], sansGpsParDist.map(([d, n]) => [d, fr(n)]))}

Ces points de vente sont créés et visibles, mais sans géolocalisation, ce qui empêche le contrôle de présence et l'optimisation de l'ordre de passage. À Abidjan, les merchandisers enregistreront leur position lors de leur première visite. Pour les autres, **merci de nous transmettre les coordonnées** en complétant les deux dernières colonnes du fichier joint (pdv-sans-gps-dms.xlsx).

**3. Points à clarifier**

1. **District DMS et localisation GPS** : pour ${fr(desaccords.length)} clients, le district indiqué ne correspond pas à l'emplacement GPS (par exemple ${exemplesDesaccord.map(([k, n]) => `${k} : ${fr(n)}`).join(' ; ')}). Nous avons retenu l'emplacement GPS. Liste dans incoherences-dms.xlsx, onglet « District ≠ GPS ».
2. **Distributeurs hors de leurs territoires** : ${horsRef.length} couples distributeur / territoire ne figurent pas dans notre référentiel (par exemple ${horsRef.slice(0, 3).map(h => `${h.dist} à ${h.territoire}`).join(', ')}). Merci de confirmer la couverture de chaque distributeur (onglet « Distributeur hors territoire »).
3. **Merchandisers** :
   - Cocody 2 : le fichier DMS nomme Guihi Bernadin, la liste des comptes Diabate Idrissa. Nous avons attribué le compte cocodymerchtwo@gmail.com à Guihi Bernadin. Merci de confirmer.
${comptes.filter(m => !/Cocody 2/i.test(m.commune)).map(m => `   - ${m.commune} (${m.email}) : ${m.constat}`).join('\n')}
4. **Clients sans merchandiser** : ${fr(horsAbidjan)} clients (principalement hors d'Abidjan) n'ont pas de merchandiser dans le fichier. Ils sont créés dans l'application mais ne figurent dans aucune tournée.
5. **Contacts** : aucun numéro de téléphone n'est renseigné, et le nom du contact est vide ou à « 0 » pour ${fr(sansContact.length)} clients (onglet « Contacts manquants »).

Nous restons disponibles pour en discuter.

Cordialement,

---
Pièces jointes : pdv-sans-gps-dms.xlsx, incoherences-dms.xlsx
`
writeFileSync(OUT_EMAIL, email, 'utf8')
console.log(email)
console.log(`\nPièces jointes : ${OUT_SANS_GPS} (${sansGps.length} lignes), ${OUT_INCOHERENCES}`)
