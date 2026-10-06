/**
 * Import de l'export clients DMS dans `pdv` (cœur partagé par
 * scripts/importer-dms-pdv.mjs et Admin › Imports terrain).
 *
 * - Client déjà relié (`pdv.mdm` = code) : rien à faire (relance idempotente).
 * - Client reconnu (nom commun à ≤ 50 m) : `mdm` posé sur le PDV existant,
 *   distributeur complété s'il manque ; PDV sans territoire localisé.
 * - Tout le reste (probables compris) : nouveau PDV, localisé par ses voisins
 *   (territoire : majorité des 7 PDV les plus proches à ≤ 1,5 km, sinon district
 *   DMS ; quartier du voisin le plus proche du même territoire à ≤ 500 m),
 *   typé par son sous-canal, marqué `ajoute_par = <marqueur>` (retour arrière).
 *
 * Module pur : simulation → { resume, rapport, csv, operations, retour }.
 */
import {
  aGps, apparier, chargerAlias, confiance, csvTexte, distributeurCanonique, haversine, jourIsoLocal, lireDmsClasseur,
  norm, nouvelIdPdv, paquets, resoudreAlias, toutesLesLignes,
} from '../commun.mjs'

const RAYON_ZONE_M = 1500 // voisins qui votent pour le territoire
const NB_VOISINS = 7
const RAYON_QUARTIER_M = 500
const MT = 'MODERN TRADE'
const TYPE_DEFAUT = 'Boutique C'
const GAGNOA = 'GAGNOA'
const REGION_PAR_SOUS_REGION = { SOUTH1: 'ABIDJAN 1', SOUTH2: 'ABIDJAN 2', CNE: 'CNE', WEST: 'CNO' }

export async function chargerDonneesDmsPdv(sb, { onEtape, toutes = toutesLesLignes } = {}) {
  onEtape?.('PDV existants')
  const pdvs = await toutes(() => sb.from('pdv')
    .select('pdv_id,nom_pdv,distributor_name,region,zone,territory_code,quartier,area_code,geolocation_lat,geolocation_lng,sous_categorie_pdv,mdm,is_active,ajoute_par')
    .order('pdv_id'))
  onEtape?.('Référentiels')
  const [territoires, alias, distributeurs, types, categories, liensTerr, aliasImport] = await Promise.all([
    toutes(() => sb.from('territoire').select('id,code,nom,sous_region_code').order('id')),
    toutes(() => sb.from('territoire_alias').select('alias,territoire_code').order('alias')),
    toutes(() => sb.from('distributeur').select('id,nom').order('id')),
    toutes(() => sb.from('type_pdv').select('id,nom,categorie_pdv_id').order('id')),
    toutes(() => sb.from('categorie_pdv').select('id,nom,canal').order('id')),
    toutes(() => sb.from('territoire_distributeur').select('territoire_id,distributeur_id').order('territoire_id')),
    chargerAlias(sb, toutes),
  ])
  return { pdvs, territoires, alias, distributeurs, types, categories, liensTerr, aliasImport }
}

export function simulerDmsPdv(classeur, donnees, options = {}) {
  const aujourdhui = options.aujourdhui || jourIsoLocal()
  const seuilDepot = options.seuilDepot ?? 10
  const marqueur = options.marqueur || `import-dms-${aujourdhui}`
  const nomFichier = options.nomFichier || 'export DMS'
  const { pdvs, territoires, alias, distributeurs, types, categories, liensTerr, aliasImport } = donnees

  const { lignesDms, clients } = lireDmsClasseur(classeur, { seuilDepot, nomFichier })

  // ---------- Référentiel géographique ----------
  const terrParCode = new Map(territoires.map(t => [t.code, t]))
  const codeParNom = new Map(territoires.map(t => [norm(t.nom), t.code]))
  const codeParAlias = new Map(alias.map(a => [norm(a.alias), a.territoire_code]))
  const codeDeZone = (zone, territoryCode) => {
    if (territoryCode && terrParCode.has(territoryCode)) return territoryCode
    const n = norm(zone)
    if (!n) return null
    return codeParAlias.get(n) || codeParNom.get(n) || (n === GAGNOA ? GAGNOA : null)
  }
  const existants = pdvs.filter(p => p.is_active !== false)
  for (const p of existants) p._code = codeDeZone(p.zone, p.territory_code)

  const dominant = (valeurs) => {
    const m = new Map()
    valeurs.filter(Boolean).forEach(v => m.set(v, (m.get(v) || 0) + 1))
    return [...m].sort((a, b) => b[1] - a[1])[0]?.[0] || null
  }
  const libelleParCode = new Map()
  const regionParCode = new Map()
  const parCode = new Map()
  for (const p of existants) {
    if (!p._code || p.region === MT) continue
    if (!parCode.has(p._code)) parCode.set(p._code, [])
    parCode.get(p._code).push(p)
  }
  for (const code of [...terrParCode.keys(), GAGNOA]) {
    const siens = parCode.get(code) || []
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
  const voisins = (lat, lng, rayon) => {
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
      code = proches.slice(0, NB_VOISINS).find(({ p }) => vote.get(p._code) === max)?.p._code || null
      if (code) source = 'gps'
    }
    if (!code) code = codeDistrict
    if (!code) return { zone: null, source: 'inconnu', codeDistrict }
    const zone = libelleParCode.get(code)
    const territoryCode = code === GAGNOA ? (['GAG 1', 'GAG 2'].includes(codeDistrict) ? codeDistrict : null) : code
    const voisin = proches.find(({ p, d }) => d <= RAYON_QUARTIER_M && p.zone === zone && p.quartier)
    return {
      zone, source, territoryCode,
      region: regionParCode.get(code),
      quartier: voisin?.p.quartier || null,
      areaCode: voisin?.p.area_code || null,
      codeDistrict,
      desaccord: source === 'gps' && codeDistrict && code !== codeDistrict
        && !(code === GAGNOA && ['GAG 1', 'GAG 2'].includes(codeDistrict)),
    }
  }

  // ---------- Types de PDV ----------
  const categorieParId = new Map(categories.map(c => [c.id, c]))
  const typeParNom = new Map(types.map(t => [norm(t.nom), t]))
  function typer(sousCanal) {
    const t = typeParNom.get(norm(sousCanal)) || typeParNom.get(norm(TYPE_DEFAUT))
    const cat = categorieParId.get(t?.categorie_pdv_id)
    return {
      sous_categorie_pdv: t?.nom || TYPE_DEFAUT,
      categorie_pdv: cat?.nom || 'Small/Medium Grocery GT',
      canal: (cat?.canal || '').toUpperCase() === 'MT' ? 'Modern trade' : 'General trade',
      reconnu: typeParNom.has(norm(sousCanal)),
    }
  }

  // ---------- Répartition des clients ----------
  const nomsDistributeur = distributeurs.map(d => d.nom)
  const distributeurDe = (brut) => resoudreAlias(brut, aliasImport, 'distributeur') || distributeurCanonique(brut, nomsDistributeur)
  const pdvParMdm = new Map(pdvs.filter(p => p.mdm).map(p => [p.mdm, p]))
  const dejaRelies = clients.filter(c => pdvParMdm.has(c.code))
  const aTraiter = clients.filter(c => !pdvParMdm.has(c.code))
  const candidats = existants.filter(p => !p.mdm)
  const { paireClient } = apparier(aTraiter, candidats)

  const liaisons = []
  const creations = []
  const idsPris = new Set(pdvs.map(p => p.pdv_id))
  for (const c of aTraiter) {
    c.distributeur = distributeurDe(c.distributeurs[0])
    const x = paireClient.get(c.code)
    if (x?.statut === 'Reconnu') {
      liaisons.push({ c, p: x.p, x, loc: x.p.zone ? null : localiser(c) })
      continue
    }
    const loc = localiser(c)
    const type = typer(c.sousCanal)
    const ligne = {
      pdv_id: nouvelIdPdv(idsPris),
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
      ajoute_par: marqueur,
      is_active: true,
      gps_source: aGps(c.lat, c.lng) ? 'dms' : c.gpsEcarte === 'depot' ? 'dms-depot' : 'dms-absent',
    }
    creations.push({ c, ligne, loc, type, x })
  }

  // ---------- Opérations et retour arrière ----------
  const majLiaisons = liaisons.map(({ c, p, loc }) => {
    const valeurs = { mdm: c.code }
    const avant = { mdm: null }
    if (!p.distributor_name && c.distributeur) { valeurs.distributor_name = c.distributeur; avant.distributor_name = null }
    if (loc?.zone) {
      Object.assign(valeurs, { zone: loc.zone, territory_code: loc.territoryCode || null, region: loc.region || null })
      Object.assign(avant, { zone: p.zone ?? null, territory_code: p.territory_code ?? null, region: p.region ?? null })
      if (!p.quartier && loc.quartier) {
        Object.assign(valeurs, { quartier: loc.quartier, area_code: loc.areaCode || null })
        Object.assign(avant, { quartier: null, area_code: p.area_code ?? null })
      }
    }
    return { maj: { pdv_id: p.pdv_id, valeurs, si_mdm_vide: true }, retour: { pdv_id: p.pdv_id, valeurs: avant } }
  })
  const operations = [
    ...paquets(majLiaisons.map(x => x.maj), 200).map(lignes => ({ type: 'pdv.maj', lignes })),
    ...paquets(creations.map(x => x.ligne), 500).map(lignes => ({ type: 'pdv.creer', lignes })),
  ]
  const retour = [
    ...paquets(creations.map(x => x.ligne.pdv_id), 500).map(pdv_ids => ({ type: 'pdv.supprimer', marqueur, pdv_ids })),
    ...paquets(majLiaisons.map(x => x.retour), 200).map(lignes => ({ type: 'pdv.maj', lignes })),
  ]

  // ---------- CSV ----------
  const GPS_LIBELLE = { '': 'ok', absent: 'absent du DMS', depot: 'dépôt (écarté)' }
  const lignesCsv = [
    ...dejaRelies.map(c => [c.code, c.nom, c.distributeurs.join(' / '), c.merch, 'déjà relié', pdvParMdm.get(c.code).pdv_id,
      pdvParMdm.get(c.code).zone, '', pdvParMdm.get(c.code).territory_code, pdvParMdm.get(c.code).quartier, GPS_LIBELLE[c.gpsEcarte] || '',
      '', '', c.district, '', '', '', '', '']),
    ...liaisons.map(({ c, p, x, loc }) => [c.code, c.nom, c.distributeur, c.merch, 'relié', p.pdv_id, loc?.zone || p.zone,
      loc ? `PDV existant sans territoire → ${loc.source}` : 'PDV existant', loc ? loc.territoryCode : p.territory_code,
      p.quartier || loc?.quartier || '', GPS_LIBELLE[c.gpsEcarte] || '', c.lat, c.lng, c.district, '', p.sous_categorie_pdv, '', '', `${confiance(x)} — ${x.motif}`]),
    ...creations.map(({ c, ligne, loc, x }) => [c.code, c.nom, c.distributeur, c.merch, 'créé', ligne.pdv_id, ligne.zone, loc.source,
      ligne.territory_code, ligne.quartier, GPS_LIBELLE[c.gpsEcarte] || '', ligne.geolocation_lat ?? '', ligne.geolocation_lng ?? '', c.district,
      loc.desaccord ? 'oui' : '', ligne.sous_categorie_pdv, ligne.categorie_pdv, ligne.canal, x ? `${x.statut} — ${x.motif}` : '']),
  ]
  const sansGps = creations.filter(({ ligne }) => ligne.geolocation_lat == null)
  const csv = {
    'import-dms-pdv.csv': csvTexte([
      'Code client', 'Nom client', 'Distributeur', 'Merchandiser (fichier)', 'Action', 'pdv_id', 'Territoire', 'Territoire déduit de',
      'Code territoire', 'Quartier', 'GPS DMS', 'Latitude', 'Longitude', 'District DMS', 'District ≠ GPS', 'Sous-catégorie', 'Catégorie', 'Canal',
      'Rapprochement',
    ], lignesCsv),
    'pdv-sans-gps-dms.csv': csvTexte([
      'Code client', 'Nom client', 'Distributeur', 'Vendeur', 'Adresse', 'Quartier DMS', 'District DMS', 'Merchandiser (fichier)',
      'Territoire attribué', 'pdv_id', 'Motif',
    ], sansGps.map(({ c, ligne }) => [
      c.code, c.nom, c.distributeur, c.vendeurs.join(' / '), c.rue, c.quartier, c.district, c.merch, ligne.zone, ligne.pdv_id,
      c.gpsEcarte === 'depot' ? `point partagé par ${c.gpsPartage} clients (dépôt du distributeur)` : 'coordonnées absentes ou à 0 dans le DMS',
    ])),
  }

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

  const rapport = `# Import DMS → PDV

Source : \`${nomFichier}\` — ${lignesDms} lignes, ${clients.length} clients distincts.
Base : ${pdvs.length} PDV avant import. Marqueur des PDV créés : \`ajoute_par = '${marqueur}'\`.

## Résultat

| Action | Clients |
|---|---|
| Déjà reliés (\`pdv.mdm\`) | ${dejaRelies.length} |
| Reliés à un PDV existant (reconnus) | ${liaisons.length} |
| dont PDV existant sans territoire, localisé | ${liaisons.filter(l => l.loc?.zone).length} |
| Nouveaux PDV | ${creations.length} |
| dont sans GPS — absent du DMS | ${creations.filter(({ c }) => c.gpsEcarte === 'absent').length} |
| dont sans GPS — dépôt écarté (point partagé par ≥ ${seuilDepot} clients) | ${creations.filter(({ c }) => c.gpsEcarte === 'depot').length} |

Territoire des nouveaux PDV : ${compter(creations, ({ loc }) => loc.source).map(([k, n]) => `${k} ${n}`).join(' · ') || '—'} (gps = voisins à ≤ ${RAYON_ZONE_M / 1000} km ; district = district DMS).
Quartier repris d'un voisin à ≤ ${RAYON_QUARTIER_M} m : ${creations.filter(({ ligne }) => ligne.quartier).length} ; sans quartier : ${creations.filter(({ ligne }) => !ligne.quartier).length}.

## Contrôles

- Territoire introuvable : **${zonesInconnues.length}**${zonesInconnues.length ? ` (${compter(zonesInconnues, ({ c }) => c.district).map(([k, n]) => `${k} ${n}`).join(', ')})` : ''}.
- Sous-canal absent des types de PDV (→ ${TYPE_DEFAUT}) : ${typesInconnus.length ? typesInconnus.map(([k, n]) => `${k} (${n})`).join(', ') : 'aucun'}.
- District DMS ≠ territoire GPS : **${creations.filter(({ loc }) => loc.desaccord).length}** — détail dans la colonne « District ≠ GPS » du CSV.

## Nouveaux PDV par territoire

${creations.length ? tableau(['Territoire', 'PDV créés', 'dont sans GPS'], compter(creations, ({ ligne }) => ligne.zone).map(([z, n]) => [z, n, creations.filter(({ ligne }) => ligne.zone === z && ligne.geolocation_lat == null).length])) : 'Aucun.'}

## Nouveaux PDV par distributeur

${creations.length + liaisons.length ? tableau(['Distributeur', 'PDV créés', 'dont sans GPS', 'PDV reliés'], compter([...creations, ...liaisons], ({ c }) => c.distributeur).map(([d, n]) => [
  d,
  creations.filter(({ c }) => c.distributeur === d).length,
  creations.filter(({ c, ligne }) => c.distributeur === d && ligne.geolocation_lat == null).length,
  liaisons.filter(({ c }) => c.distributeur === d).length,
])) : 'Aucun.'}

## Distributeur × territoire absents du référentiel

${horsReferentiel.length ? tableau(['Distributeur → territoire', 'PDV créés'], horsReferentiel.map(([k, n]) => [k, n])) : 'Aucun.'}

## Principaux écarts district DMS → territoire GPS

${desaccords.length ? tableau(['District DMS → territoire retenu', 'PDV'], desaccords.slice(0, 20).map(([k, n]) => [k, n])) : 'Aucun.'}

## Retour arrière

Bouton « Annuler le lot » (Admin › Imports terrain) ou \`--retour=<fichier>\` : les PDV créés par ce lot et jamais visités sont supprimés, les PDV reliés retrouvent leurs valeurs d'avant.
`

  const resume = {
    lignesDms, clients: clients.length, dejaRelies: dejaRelies.length, relies: liaisons.length,
    crees: creations.length, sansGps: sansGps.length, territoireInconnu: zonesInconnues.length, operations: operations.length,
  }
  return { resume, rapport, csv, operations, retour, marqueur }
}
