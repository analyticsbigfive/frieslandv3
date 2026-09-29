#!/usr/bin/env node
/**
 * Importe l'export clients DMS dans `pdv` : relie les PDV déjà connus par leur
 * code client (`pdv.mdm`) et crée les clients manquants.
 *
 * - Client déjà relié (`pdv.mdm` = code) : rien à faire (relance idempotente).
 * - Client reconnu (nom commun à ≤ 50 m, scripts/lib/dms.mjs) : `mdm` posé sur
 *   le PDV existant, distributeur complété s'il manque.
 * - Tout le reste (probables compris) : nouveau PDV.
 *
 * Nouveau PDV :
 * - territoire : majorité des 7 PDV existants les plus proches à ≤ 1,5 km ;
 *   à défaut (pas de GPS, pas de voisin), district DMS → référentiel `territoire` ;
 * - quartier / code area : ceux du PDV existant le plus proche du même
 *   territoire à ≤ 500 m, sinon vides (un PDV sans quartier reste visible de
 *   tout le territoire) ;
 * - type : sous-canal DMS = `type_pdv.nom`, catégorie et canal du référentiel ;
 * - GPS : celui du DMS, sauf point partagé par ≥ --seuil-depot clients (dépôt
 *   du distributeur) → sans coordonnées, `gps_source = 'dms-depot'`.
 * - `ajoute_par = 'import-dms-2026-09-29'` : marqueur de retour arrière.
 *
 * Simulation par défaut (rapport + CSV dans ~/Downloads) ; --apply pour écrire.
 * --apply exige la migration 20260930091000 (colonnes gps_*).
 *
 * Usage :
 *   node scripts/importer-dms-pdv.mjs [--dms=chemin.xlsx] [--seuil-depot=10] [--apply]
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  aGps, apparier, confiance, distributeurCanonique, ecrireCsv, haversine, lireDms, norm, toutesLesLignes,
} from './lib/dms.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env'), quiet: true })

const arg = (nom, defaut) => process.argv.find(a => a.startsWith(`--${nom}=`))?.split('=').slice(1).join('=') || defaut
const APPLY = process.argv.includes('--apply')

const DOWNLOADS = join(process.env.HOME, 'Downloads')
const DMS_PATH = arg('dms', join(DOWNLOADS, '20260929_115747.xlsx'))
const SEUIL_DEPOT = Number(arg('seuil-depot', 10))
const MARQUEUR = 'import-dms-2026-09-29'

const RAYON_ZONE_M = 1500 // voisins qui votent pour le territoire
const NB_VOISINS = 7
const RAYON_QUARTIER_M = 500
const MT = 'MODERN TRADE'

const OUT_CSV = join(DOWNLOADS, 'import-dms-pdv.csv')
const OUT_SANS_GPS = join(DOWNLOADS, 'pdv-sans-gps-dms.csv')
const OUT_MD = join(DOWNLOADS, 'import-dms-pdv-rapport.md')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const aujourdhui = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})()

// ---------- 1. Données ----------

const { lignesDms, clients } = await lireDms(DMS_PATH, { seuilDepot: SEUIL_DEPOT })

const pdvs = await toutesLesLignes(() => supabase.from('pdv')
  .select('pdv_id,nom_pdv,distributor_name,region,zone,territory_code,quartier,area_code,geolocation_lat,geolocation_lng,sous_categorie_pdv,mdm,is_active,ajoute_par')
  .order('pdv_id'))
const [territoires, alias, sousRegions, distributeurs, types, categories, liensTerr] = await Promise.all([
  toutesLesLignes(() => supabase.from('territoire').select('id,code,nom,sous_region_code').order('id')),
  toutesLesLignes(() => supabase.from('territoire_alias').select('alias,territoire_code').order('alias')),
  toutesLesLignes(() => supabase.from('sous_region').select('code,nom_affichage').order('code')),
  toutesLesLignes(() => supabase.from('distributeur').select('id,nom').order('id')),
  toutesLesLignes(() => supabase.from('type_pdv').select('id,nom,categorie_pdv_id').order('id')),
  toutesLesLignes(() => supabase.from('categorie_pdv').select('id,nom,canal').order('id')),
  toutesLesLignes(() => supabase.from('territoire_distributeur').select('territoire_id,distributeur_id').order('territoire_id')),
])

// ---------- 2. Référentiel géographique ----------

const terrParCode = new Map(territoires.map(t => [t.code, t]))
const codeParNom = new Map(territoires.map(t => [norm(t.nom), t.code]))
const codeParAlias = new Map(alias.map(a => [norm(a.alias), a.territoire_code]))
// Les PDV de Gagnoa portent « GAGNOA » sans code : le référentiel coupe la
// ville en GAG 1 / GAG 2. On garde le libellé existant pour les deux.
const GAGNOA = 'GAGNOA'

function codeDeZone(zone, territoryCode) {
  if (territoryCode && terrParCode.has(territoryCode)) return territoryCode
  const n = norm(zone)
  if (!n) return null
  return codeParAlias.get(n) || codeParNom.get(n) || (n === GAGNOA ? GAGNOA : null)
}

// Libellé, région et code par territoire, d'après les PDV existants (hors Modern Trade).
const existants = pdvs.filter(p => p.is_active !== false)
for (const p of existants) p._code = codeDeZone(p.zone, p.territory_code)

const dominant = (valeurs) => {
  const m = new Map()
  valeurs.filter(Boolean).forEach(v => m.set(v, (m.get(v) || 0) + 1))
  return [...m].sort((a, b) => b[1] - a[1])[0]?.[0] || null
}
const REGION_PAR_SOUS_REGION = { SOUTH1: 'ABIDJAN 1', SOUTH2: 'ABIDJAN 2', CNE: 'CNE', WEST: 'CNO' }

const libelleParCode = new Map()
const regionParCode = new Map()
for (const code of [...terrParCode.keys(), GAGNOA]) {
  const siens = existants.filter(p => p._code === code && p.region !== MT)
  const t = terrParCode.get(code)
  libelleParCode.set(code, dominant(siens.map(p => p.zone)) || (t ? t.nom.toUpperCase() : code))
  regionParCode.set(code, dominant(siens.map(p => p.region)) || (t ? REGION_PAR_SOUS_REGION[t.sous_region_code] : 'CNO'))
}
for (const code of ['GAG 1', 'GAG 2']) {
  libelleParCode.set(code, libelleParCode.get(GAGNOA))
  regionParCode.set(code, regionParCode.get(GAGNOA))
}

// Grille ~1,1 km sur les PDV existants rattachés à un territoire.
const PAS = 0.01
const grille = new Map()
for (const p of existants) {
  if (!p._code || p.region === MT || !aGps(p.geolocation_lat, p.geolocation_lng)) continue
  const k = `${Math.floor(p.geolocation_lat / PAS)}:${Math.floor(p.geolocation_lng / PAS)}`
  if (!grille.has(k)) grille.set(k, [])
  grille.get(k).push(p)
}
function voisins(lat, lng, rayon) {
  const i = Math.floor(lat / PAS), j = Math.floor(lng / PAS)
  const out = []
  for (let di = -2; di <= 2; di++) {
    for (let dj = -2; dj <= 2; dj++) {
      for (const p of grille.get(`${i + di}:${j + dj}`) || []) {
        const d = haversine(lat, lng, p.geolocation_lat, p.geolocation_lng)
        if (d <= rayon) out.push({ p, d })
      }
    }
  }
  return out.sort((a, b) => a.d - b.d)
}

/** Territoire, région, quartier d'un nouveau PDV. */
function localiser(c) {
  const codeDistrict = codeParNom.get(norm(c.district)) || null
  let code = null
  let source = 'district'
  let proches = []
  if (aGps(c.lat, c.lng)) {
    proches = voisins(c.lat, c.lng, RAYON_ZONE_M)
    const vote = new Map()
    proches.slice(0, NB_VOISINS).forEach(({ p }) => vote.set(p._code, (vote.get(p._code) || 0) + 1))
    const max = Math.max(0, ...vote.values())
    // Égalité : le territoire du voisin le plus proche parmi les ex æquo.
    code = proches.slice(0, NB_VOISINS).find(({ p }) => vote.get(p._code) === max)?.p._code || null
    if (code) source = 'gps'
  }
  if (!code) code = codeDistrict
  if (!code) return { zone: null, source: 'inconnu', codeDistrict }

  const zone = libelleParCode.get(code)
  // GAGNOA n'a pas de code : on reprend GAG 1 / GAG 2 du district quand il y en a un.
  const territoryCode = code === GAGNOA ? (['GAG 1', 'GAG 2'].includes(codeDistrict) ? codeDistrict : null) : code
  const voisin = proches.find(({ p, d }) => d <= RAYON_QUARTIER_M && p.zone === zone && p.quartier)
  return {
    zone,
    source,
    territoryCode,
    region: regionParCode.get(code),
    quartier: voisin?.p.quartier || null,
    areaCode: voisin?.p.area_code || null,
    codeDistrict,
    desaccord: source === 'gps' && codeDistrict && code !== codeDistrict
      && !(code === GAGNOA && ['GAG 1', 'GAG 2'].includes(codeDistrict)),
  }
}

// ---------- 3. Types de PDV ----------

const categorieParId = new Map(categories.map(c => [c.id, c]))
const typeParNom = new Map(types.map(t => [norm(t.nom), t]))
const TYPE_DEFAUT = 'Boutique C'

function typer(sousCanal) {
  const t = typeParNom.get(norm(sousCanal)) || typeParNom.get(norm(TYPE_DEFAUT))
  const cat = categorieParId.get(t.categorie_pdv_id)
  return {
    sous_categorie_pdv: t.nom,
    categorie_pdv: cat?.nom || 'Small/Medium Grocery GT',
    // utils/canal.ts canalLabelFromCode
    canal: (cat?.canal || '').toUpperCase() === 'MT' ? 'Modern trade' : 'General trade',
    reconnu: typeParNom.has(norm(sousCanal)),
  }
}

// ---------- 4. Répartition des clients ----------

const nomsDistributeur = distributeurs.map(d => d.nom)
const pdvParMdm = new Map(pdvs.filter(p => p.mdm).map(p => [p.mdm, p]))

const dejaRelies = clients.filter(c => pdvParMdm.has(c.code))
const aTraiter = clients.filter(c => !pdvParMdm.has(c.code))
const candidats = existants.filter(p => !p.mdm)
const { paireClient } = apparier(aTraiter, candidats)

const liaisons = []
const creations = []
const idsPris = new Set(pdvs.map(p => p.pdv_id))
const nouvelId = () => {
  for (;;) {
    const id = randomUUID().slice(0, 8)
    if (!idsPris.has(id)) { idsPris.add(id); return id }
  }
}

for (const c of aTraiter) {
  c.distributeur = distributeurCanonique(c.distributeurs[0], nomsDistributeur)
  const x = paireClient.get(c.code)
  if (x?.statut === 'Reconnu') {
    // PDV existant sans territoire : invisible du terrain, on le localise
    // comme un nouveau PDV.
    liaisons.push({ c, p: x.p, x, loc: x.p.zone ? null : localiser(c) })
    continue
  }
  const loc = localiser(c)
  const type = typer(c.sousCanal)
  const ligne = {
    pdv_id: nouvelId(),
    nom_pdv: String(c.nom || '').replace(/\s+/g, ' ').trim() || `Client ${c.code}`,
    canal: type.canal,
    categorie_pdv: type.categorie_pdv,
    sous_categorie_pdv: type.sous_categorie_pdv,
    region: loc.region || null,
    zone: loc.zone,
    quartier: loc.quartier || null,
    territory_code: loc.territoryCode || null,
    area_code: loc.areaCode || null,
    geolocation_lat: aGps(c.lat, c.lng) ? c.lat : null,
    geolocation_lng: aGps(c.lat, c.lng) ? c.lng : null,
    rayon_geofence: 200,
    adressage: String(c.rue || '').trim() || null,
    distributor_name: c.distributeur || null,
    mdm: c.code,
    date_creation: aujourdhui,
    ajoute_par: MARQUEUR,
    is_active: true,
    gps_source: aGps(c.lat, c.lng) ? 'dms' : c.gpsEcarte === 'depot' ? 'dms-depot' : 'dms-absent',
  }
  creations.push({ c, ligne, loc, type, x })
}

// ---------- 5. Écriture ----------

async function parLots(items, taille, f) {
  for (let i = 0; i < items.length; i += taille) await f(items.slice(i, i + taille), i)
}

if (APPLY) {
  const { error: colErr } = await supabase.from('pdv').select('gps_source').limit(1)
  if (colErr) {
    console.error(`❌ Colonne pdv.gps_source absente (${colErr.message}). Appliquer d'abord supabase/nouveau/20260930091000_friesland_app_mobile_1_0_10.sql.`)
    process.exit(1)
  }

  console.log(`🔗 Liaison de ${liaisons.length} PDV existants…`)
  let lies = 0
  await parLots(liaisons, 10, async (lot) => {
    await Promise.all(lot.map(async ({ c, p, loc }) => {
      const maj = { mdm: c.code }
      if (!p.distributor_name && c.distributeur) maj.distributor_name = c.distributeur
      if (loc?.zone) {
        Object.assign(maj, { zone: loc.zone, territory_code: loc.territoryCode || null, region: loc.region || null })
        if (!p.quartier && loc.quartier) Object.assign(maj, { quartier: loc.quartier, area_code: loc.areaCode || null })
      }
      const { error } = await supabase.from('pdv').update(maj).eq('pdv_id', p.pdv_id).is('mdm', null)
      if (error) throw new Error(`liaison ${p.pdv_id} ← ${c.code} : ${error.message}`)
      lies++
    }))
  })
  console.log(`   ✅ ${lies} PDV reliés`)

  console.log(`🏪 Création de ${creations.length} PDV par lots de 500…`)
  let crees = 0
  await parLots(creations.map(x => x.ligne), 500, async (lot, i) => {
    const { error } = await supabase.from('pdv').insert(lot)
    if (error) throw new Error(`insertion lot ${i} (${crees} déjà créés, relance possible) : ${error.message}`)
    crees += lot.length
    if (crees % 2500 === 0 || crees === creations.length) console.log(`   ${crees}/${creations.length}`)
  })
  console.log(`   ✅ ${crees} PDV créés`)

  const { error: refreshErr } = await supabase.rpc('refresh_stats_dashboard')
  console.log(refreshErr
    ? `⚠️  refresh_stats_dashboard : ${refreshErr.message} — à lancer dans l'éditeur SQL.`
    : '📊 Statistiques rafraîchies.')
  console.log('ℹ️  Lancer ensuite dans l\'éditeur SQL : analyze public.pdv;')
}

// ---------- 6. Sorties ----------

const GPS_LIBELLE = { '': 'ok', absent: 'absent du DMS', depot: 'dépôt (écarté)' }
const lignesCsv = [
  ...dejaRelies.map(c => [c.code, c.nom, c.distributeurs.join(' / '), c.merch, 'déjà relié', pdvParMdm.get(c.code).pdv_id,
    pdvParMdm.get(c.code).zone, '', pdvParMdm.get(c.code).territory_code, pdvParMdm.get(c.code).quartier, GPS_LIBELLE[c.gpsEcarte] || '',
    '', '', c.district, '', '', '', '', '']),
  ...liaisons.map(({ c, p, x, loc }) => [c.code, c.nom, c.distributeur, c.merch, 'relié', p.pdv_id, loc?.zone || p.zone,
    loc ? `PDV existant sans territoire → ${loc.source}` : 'PDV existant', loc ? loc.territoryCode : p.territory_code,
    p.quartier || loc?.quartier || '', GPS_LIBELLE[c.gpsEcarte] || '', c.lat, c.lng, c.district, '', p.sous_categorie_pdv, '', '', `${confiance(x)} — ${x.motif}`]),
  ...creations.map(({ c, ligne, loc, type, x }) => [c.code, c.nom, c.distributeur, c.merch, 'créé', ligne.pdv_id, ligne.zone, loc.source,
    ligne.territory_code, ligne.quartier, GPS_LIBELLE[c.gpsEcarte] || '', ligne.geolocation_lat ?? '', ligne.geolocation_lng ?? '', c.district,
    loc.desaccord ? 'oui' : '', ligne.sous_categorie_pdv, ligne.categorie_pdv, ligne.canal, x ? `${x.statut} — ${x.motif}` : '']),
]
ecrireCsv(OUT_CSV, [
  'Code client', 'Nom client', 'Distributeur', 'Merchandiser (fichier)', 'Action', 'pdv_id', 'Territoire', 'Territoire déduit de',
  'Code territoire', 'Quartier', 'GPS DMS', 'Latitude', 'Longitude', 'District DMS', 'District ≠ GPS', 'Sous-catégorie', 'Catégorie', 'Canal',
  'Rapprochement',
], lignesCsv)

const sansGps = creations.filter(({ ligne }) => ligne.geolocation_lat == null)
ecrireCsv(OUT_SANS_GPS, [
  'Code client', 'Nom client', 'Distributeur', 'Vendeur', 'Adresse', 'Quartier DMS', 'District DMS', 'Merchandiser (fichier)',
  'Territoire attribué', 'pdv_id', 'Motif',
], sansGps.map(({ c, ligne }) => [
  c.code, c.nom, c.distributeur, c.vendeurs.join(' / '), c.rue, c.quartier, c.district, c.merch, ligne.zone, ligne.pdv_id,
  c.gpsEcarte === 'depot' ? `point partagé par ${c.gpsPartage} clients (dépôt du distributeur)` : 'coordonnées absentes ou à 0 dans le DMS',
]))

// ---------- Rapport ----------

const compter = (items, cle) => {
  const m = new Map()
  items.forEach(i => { const k = cle(i) ?? '(vide)'; m.set(k, (m.get(k) || 0) + 1) })
  return [...m].sort((a, b) => b[1] - a[1])
}
const tableau = (entetes, lignes) => `| ${entetes.join(' | ')} |\n|${entetes.map(() => '---').join('|')}|\n${lignes.map(l => `| ${l.join(' | ')} |`).join('\n')}`

const idTerrParCode = new Map(territoires.map(t => [t.code, t.id]))
const idDistParNom = new Map(distributeurs.map(d => [norm(d.nom), d.id]))
const liens = new Set(liensTerr.map(l => `${l.territoire_id}:${l.distributeur_id}`))
const horsReferentiel = compter(creations.filter(({ ligne }) => {
  const t = idTerrParCode.get(ligne.territory_code)
  const d = idDistParNom.get(norm(ligne.distributor_name))
  return t && ligne.distributor_name && (!d || !liens.has(`${t}:${d}`))
}), ({ ligne }) => `${ligne.distributor_name} → ${ligne.territory_code}`)

const zonesInconnues = creations.filter(({ ligne }) => !ligne.zone)
const typesInconnus = compter(creations.filter(({ type }) => !type.reconnu), ({ c }) => c.sousCanal || '(vide)')
const desaccords = compter(creations.filter(({ loc }) => loc.desaccord), ({ c, ligne }) => `${c.district} → ${ligne.zone}`)

const md = `# Import DMS → PDV ${APPLY ? '(appliqué)' : '(simulation)'}

Source : \`${DMS_PATH.split('/').pop()}\` — ${lignesDms} lignes, ${clients.length} clients distincts.
Base : ${pdvs.length} PDV avant import. Marqueur des PDV créés : \`ajoute_par = '${MARQUEUR}'\`.

## Résultat

| Action | Clients |
|---|---|
| Déjà reliés (\`pdv.mdm\`) | ${dejaRelies.length} |
| Reliés à un PDV existant (reconnus) | ${liaisons.length} |
| dont PDV existant sans territoire, localisé | ${liaisons.filter(l => l.loc?.zone).length} |
| Nouveaux PDV | ${creations.length} |
| dont sans GPS — absent du DMS | ${creations.filter(({ c }) => c.gpsEcarte === 'absent').length} |
| dont sans GPS — dépôt écarté (point partagé par ≥ ${SEUIL_DEPOT} clients) | ${creations.filter(({ c }) => c.gpsEcarte === 'depot').length} |

Territoire des nouveaux PDV : ${compter(creations, ({ loc }) => loc.source).map(([k, n]) => `${k} ${n}`).join(' · ')} (gps = voisins à ≤ ${RAYON_ZONE_M / 1000} km ; district = district DMS).
Quartier repris d'un voisin à ≤ ${RAYON_QUARTIER_M} m : ${creations.filter(({ ligne }) => ligne.quartier).length} ; sans quartier : ${creations.filter(({ ligne }) => !ligne.quartier).length}.

## Contrôles

- Territoire introuvable : **${zonesInconnues.length}**${zonesInconnues.length ? ` (${compter(zonesInconnues, ({ c }) => c.district).map(([k, n]) => `${k} ${n}`).join(', ')})` : ''}.
- \`pdv_id\` en double : **${creations.length - new Set(creations.map(x => x.ligne.pdv_id)).size}**.
- Sous-canal absent de \`type_pdv\` (→ ${TYPE_DEFAUT}) : ${typesInconnus.length ? typesInconnus.map(([k, n]) => `${k} (${n})`).join(', ') : 'aucun'}.
- District DMS ≠ territoire GPS : **${creations.filter(({ loc }) => loc.desaccord).length}** — détail dans la colonne « District ≠ GPS » de \`${OUT_CSV.split('/').pop()}\`.

## Nouveaux PDV par territoire

${tableau(['Territoire', 'PDV créés', 'dont sans GPS'], compter(creations, ({ ligne }) => ligne.zone).map(([z, n]) => [z, n, creations.filter(({ ligne }) => ligne.zone === z && ligne.geolocation_lat == null).length]))}

## Nouveaux PDV par distributeur

${tableau(['Distributeur', 'PDV créés', 'dont sans GPS', 'PDV reliés'], compter([...creations, ...liaisons], ({ c }) => c.distributeur).map(([d, n]) => [
  d,
  creations.filter(({ c }) => c.distributeur === d).length,
  creations.filter(({ c, ligne }) => c.distributeur === d && ligne.geolocation_lat == null).length,
  liaisons.filter(({ c }) => c.distributeur === d).length,
]))}

## Distributeur × territoire absents du référentiel

${horsReferentiel.length ? tableau(['Distributeur → territoire', 'PDV créés'], horsReferentiel.map(([k, n]) => [k, n])) : 'Aucun.'}

## Principaux écarts district DMS → territoire GPS

${desaccords.length ? tableau(['District DMS → territoire retenu', 'PDV'], desaccords.slice(0, 20).map(([k, n]) => [k, n])) : 'Aucun.'}

## Après import

\`\`\`sql
select public.refresh_stats_dashboard();
analyze public.pdv;
\`\`\`

## Retour arrière

\`\`\`sql
delete from public.pdv p where p.ajoute_par = '${MARQUEUR}'
  and not exists (select 1 from public.visites v where v.pdv_id = p.pdv_id);
update public.pdv set mdm = null where mdm is not null and ajoute_par is distinct from '${MARQUEUR}';
\`\`\`

## Fichiers

- \`${OUT_CSV.split('/').pop()}\` — une ligne par client DMS : action, pdv_id, territoire et sa source.
- \`${OUT_SANS_GPS.split('/').pop()}\` — ${sansGps.length} nouveaux PDV sans coordonnées, avec le motif.
`
writeFileSync(OUT_MD, md, 'utf8')
console.log(md)
