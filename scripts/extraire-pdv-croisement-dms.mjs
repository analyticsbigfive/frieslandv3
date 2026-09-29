#!/usr/bin/env node
/**
 * Extrait tous les PDV de Supabase avec les informations comparables à l'export
 * clients DMS (distributeur, GPS, type de point de vente, territoire) et
 * propose pour chacun le client DMS correspondant, sur tout le pays.
 *
 * Rapprochement : scripts/lib/dms.mjs (GPS + nom, un client ↔ un PDV).
 *
 * Sorties dans ~/Downloads (aucune écriture en base) :
 *   - pdv-croisement-dms.csv          une ligne par PDV, avec le client DMS proposé
 *   - dms-croisement-pdv.csv          une ligne par client DMS, avec le PDV proposé
 *   - croisement-pdv-dms-rapport.md   synthèse par distributeur
 *
 * Usage :
 *   node scripts/extraire-pdv-croisement-dms.mjs [--dms=chemin.xlsx]
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { writeFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  RAYON_NOM_M, RAYON_SEUL_M, aGps, apparier, confiance, ecrireCsv, lireDms, motifClient, norm, statutClient, toutesLesLignes,
} from './lib/dms.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env'), quiet: true })

const arg = (nom, defaut) => process.argv.find(a => a.startsWith(`--${nom}=`))?.split('=').slice(1).join('=') || defaut

const DOWNLOADS = join(process.env.HOME, 'Downloads')
const DMS_PATH = arg('dms', join(DOWNLOADS, '20260929_115747.xlsx'))

const OUT_PDV = join(DOWNLOADS, 'pdv-croisement-dms.csv')
const OUT_DMS = join(DOWNLOADS, 'dms-croisement-pdv.csv')
const OUT_MD = join(DOWNLOADS, 'croisement-pdv-dms-rapport.md')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// composables/useUserScope.ts — pdvInScope sans alias
function profileTerritories(p) {
  const multi = (p?.territoires_assignes || []).filter(Boolean)
  if (multi.length) return multi
  return p?.zone_assignee ? [p.zone_assignee] : []
}
function pdvInScope(pdv, p) {
  const terrs = profileTerritories(p)
  if (terrs.length && !terrs.includes(pdv.zone || '')) return false
  const quartiers = (p?.quartiers_assignes || []).filter(Boolean)
  if (quartiers.length && pdv.quartier && !quartiers.includes(pdv.quartier)) return false
  return true
}

// ---------- 1. Export DMS ----------

const { lignesDms, clients } = await lireDms(DMS_PATH)

// ---------- 2. Supabase : PDV, comptes, visites ----------

const pdvs = await toutesLesLignes(() => supabase.from('pdv')
  .select('pdv_id,nom_pdv,distributor_name,region,zone,territory_code,quartier,area_code,adressage,geolocation_lat,geolocation_lng,canal,categorie_pdv,sous_categorie_pdv,canal_routing,sales_rep_routing,jour_routing,date_creation,ajoute_par,is_active')
  .order('pdv_id'))

const merchs = (await toutesLesLignes(() => supabase.from('profiles')
  .select('id,email,nom,role,is_active,zone_assignee,territoires_assignes,quartiers_assignes')
  .eq('role', 'merchandiser').order('id')))
  .filter(p => p.is_active !== false && p.email && profileTerritories(p).length)

const visites = await toutesLesLignes(() => supabase.from('visites').select('pdv_id,date_visite').order('id'))
const statsVisites = new Map()
for (const v of visites) {
  if (!v.pdv_id) continue
  const s = statsVisites.get(v.pdv_id) || { nb: 0, derniere: '' }
  s.nb++
  if (v.date_visite && v.date_visite > s.derniere) s.derniere = v.date_visite
  statsVisites.set(v.pdv_id, s)
}

// ---------- 3. Rapprochement ----------

const { pairePdv, paireClient } = apparier(clients, pdvs)

// ---------- Sorties CSV ----------

const gps = (lat, lng) => (aGps(lat, lng) ? [lat, lng] : ['', ''])

ecrireCsv(OUT_PDV, [
  'pdv_id', 'Nom PDV', 'Distributeur PDV', 'Région', 'Territoire', 'Code territoire', 'Quartier', 'Code quartier', 'Adressage',
  'Latitude', 'Longitude', 'Canal', 'Catégorie', 'Sous-catégorie', 'Canal routing', 'Sales rep (routing)', 'Jour routing',
  'Date création', 'Ajouté par', 'Merchandiser(s) du périmètre', 'Nb visites', 'Dernière visite',
  'Statut DMS', 'Confiance', 'Code client DMS', 'Nom client DMS', 'Contact DMS', 'Distributeur DMS', 'Code distributeur DMS', 'Vendeur DMS',
  'Sous-canal DMS', 'Distance (m)', 'Même distributeur', 'Même type', 'Motif',
], pdvs.map((p) => {
  const x = pairePdv.get(p.pdv_id)
  const c = x?.c
  const v = statsVisites.get(p.pdv_id)
  return [
    p.pdv_id, p.nom_pdv, p.distributor_name, p.region, p.zone, p.territory_code, p.quartier, p.area_code, p.adressage,
    ...gps(p.geolocation_lat, p.geolocation_lng), p.canal, p.categorie_pdv, p.sous_categorie_pdv, p.canal_routing,
    p.sales_rep_routing, p.jour_routing, p.date_creation, p.ajoute_par,
    merchs.filter(m => pdvInScope(p, m)).map(m => m.email).join(', '),
    v?.nb || 0, v?.derniere?.slice(0, 10) || '',
    x?.statut || (aGps(p.geolocation_lat, p.geolocation_lng) ? 'Non trouvé' : 'Sans GPS'), confiance(x),
    c?.code, c?.nom, c?.contact, c?.distributeurs.join(' / '), c?.distCodes.join(' / '), c?.vendeurs.join(' / '),
    c?.sousCanal, x ? Math.round(x.d) : '', x?.memeDistributeur, x?.memeType, x?.motif,
  ]
}))

ecrireCsv(OUT_DMS, [
  'Code client', 'Nom client', 'Contact', 'Région DMS', 'Distributeur', 'Code distributeur', 'Vendeur', 'Adresse',
  'Quartier DMS', 'District DMS', 'Latitude', 'Longitude', 'Sous-canal', 'Zone (fichier)', 'Merchandiser (fichier)',
  'Statut', 'Confiance', 'pdv_id', 'Nom PDV', 'Distance (m)', 'Distributeur PDV', 'Territoire PDV', 'Quartier PDV', 'Sous-catégorie PDV',
  'Même distributeur', 'Même type', 'Motif',
], clients.map((c) => {
  const x = paireClient.get(c.code)
  const p = x?.p
  return [
    c.code, c.nom, c.contact, c.region, c.distributeurs.join(' / '), c.distCodes.join(' / '), c.vendeurs.join(' / '), c.rue,
    c.quartier, c.district, ...gps(c.lat, c.lng), c.sousCanal, c.zone, c.merch,
    statutClient(c, paireClient), confiance(x), p?.pdv_id, p?.nom_pdv, x ? Math.round(x.d) : '', p?.distributor_name, p?.zone, p?.quartier, p?.sous_categorie_pdv,
    x?.memeDistributeur, x?.memeType, motifClient(c, paireClient),
  ]
}))

// ---------- Rapport ----------

const STATUTS = ['Reconnu', 'Probable', 'Non trouvé', 'Sans GPS']
const distribs = new Map()
const ligneDist = (nom) => {
  const k = norm(nom) || '(sans distributeur)'
  if (!distribs.has(k)) distribs.set(k, { nom: nom || '(sans distributeur)', clients: [], pdv: 0 })
  return distribs.get(k)
}
clients.forEach(c => ligneDist(c.distributeurs[0]).clients.push(c))
pdvs.forEach(p => { ligneDist(p.distributor_name).pdv++ })
const lignesDist = [...distribs.values()].sort((a, b) => b.clients.length - a.clients.length || b.pdv - a.pdv)
const paireListe = [...paireClient.values()]
const nb = (f) => paireListe.filter(f).length

const md = `# Croisement PDV Supabase ↔ export clients DMS

Source DMS : \`${DMS_PATH.split('/').pop()}\` — ${lignesDms} lignes, ${clients.length} clients distincts (${clients.filter(c => !aGps(c.lat, c.lng)).length} sans GPS).
Supabase : ${pdvs.length} PDV (${pdvs.filter(p => !aGps(p.geolocation_lat, p.geolocation_lng)).length} sans GPS, ${pdvs.filter(p => !p.distributor_name).length} sans distributeur), ${visites.length} visites, ${merchs.length} merchandisers actifs avec un territoire.

Rapprochement par GPS + nom, un client DMS ↔ un PDV au plus.
- **Reconnu** : mot du nom en commun à ${RAYON_NOM_M} m ou moins.
- **Probable** : seul PDV à ${RAYON_SEUL_M} m ou moins, nom différent.
- **Confiance** : Haute = reconnu avec le même distributeur ou deux mots du nom en commun · Moyenne = autre reconnu · Faible = probable.
- Colonnes **Même distributeur** / **Même type** : à vérifier en priorité quand elles valent « non ».

## Résultat

- ${paireListe.length} paires retenues : ${nb(x => x.statut === 'Reconnu')} reconnues, ${nb(x => x.statut === 'Probable')} probables.
- Confiance haute : ${nb(x => confiance(x) === 'Haute')} · moyenne : ${nb(x => confiance(x) === 'Moyenne')} · faible : ${nb(x => confiance(x) === 'Faible')}.
- Dont même distributeur : ${nb(x => x.memeDistributeur === 'oui')} · distributeur différent : ${nb(x => x.memeDistributeur === 'non')} · inconnu : ${nb(x => x.memeDistributeur === 'inconnu')}.
- Dont même type de PDV : ${nb(x => x.memeType === 'oui')} · type différent : ${nb(x => x.memeType === 'non')}.
- PDV sans client DMS : ${pdvs.length - pairePdv.size} · clients DMS sans PDV : ${clients.length - paireClient.size}.

## Par distributeur

| Distributeur | Clients DMS | PDV Supabase | ${STATUTS.join(' | ')} |
|---|---|---|${STATUTS.map(() => '---').join('|')}|
${lignesDist.map(l => `| ${l.nom} | ${l.clients.length} | ${l.pdv} | ${STATUTS.map(s => l.clients.filter(c => statutClient(c, paireClient) === s).length).join(' | ')} |`).join('\n')}

## Fichiers

- \`${OUT_PDV.split('/').pop()}\` — ${pdvs.length} PDV avec leurs informations et le client DMS proposé.
- \`${OUT_DMS.split('/').pop()}\` — ${clients.length} clients DMS avec le PDV proposé.
`
writeFileSync(OUT_MD, md, 'utf8')

console.log(md)
