// GET /api/validation-tournee/donnees — route PUBLIQUE, jeton requis.
// Routing du merchandiser (24 jours), PDV de chaque jour selon la règle du
// 20/10 (quartier du point de visite, puis quartier voisin du même
// distributeur), zones et secteurs (Atom et Friesland), référentiel pour
// proposer ses vraies zones (mêmes territoires et quartiers que l'admin),
// réponses déjà saisies. Jamais de téléphone de boutique ; pas de zone sur les PDV.
// Sans casse, accents ni ponctuation : « PORT-BOUET » = « Port bouet ».
const cle = (s: string) => String(s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036F]/g, '').replace(/[^A-Z0-9]+/g, ' ').trim()
const uniques = (liste: (string | null | undefined)[]) => {
  const vus = new Set<string>()
  const out: string[] = []
  for (const x of liste) {
    const t = String(x || '').trim()
    if (t && !vus.has(cle(t))) { vus.add(cle(t)); out.push(t) }
  }
  return out
}
// Territoires d'Abidjan et environs (division Sud), comme dans l'admin.
const SOUS_REGIONS = ['SOUTH1', 'SOUTH2']

// Lecture par paquets de 1 000 (limite de l'API) : jusqu'à 1 600 boutiques par merchandiser.
async function toutes(requete: () => any) {
  const data: any[] = []
  for (let de = 0; ; de += 1000) {
    const r = await requete().range(de, de + 999)
    if (r.error) return { data: null, error: r.error }
    data.push(...(r.data || []))
    if ((r.data || []).length < 1000) return { data, error: null }
  }
}

export default defineEventHandler(async (event) => {
  freinerIp(event)
  const service = getServiceClient(event)
  const v = await validationDuJeton(event, service)

  const [lignes, quartiersPdv, profil, reponses, retours, zones, merch, territoires, secteurs, alias] = await Promise.all([
    service.from('routing_mensuel')
      .select('id, jour_semaine, semaine_du_mois, point_visite, secteur, commune, latitude, longitude, distributeur, ssf_texte, type_engin, ssf:ssf(nom)')
      .eq('merchandiser_id', v.merchandiser_id).eq('actif', true)
      .order('semaine_du_mois').order('jour_semaine'),
    // Boutiques de chaque quartier de ce merchandiser (règle du 20/10 : point de
    // visite le plus proche), sans position ni distance : seul le quartier compte.
    toutes(() => service.from('pdv_quartier_tournee')
      .select('pdv_id, point_lat, point_lng, pdv:pdv(pdv_id, nom_pdv, sous_categorie_pdv, distributor_name, is_active)')
      .eq('merchandiser_id', v.merchandiser_id).order('pdv_id')),
    // Compte de test (QA Atom, copie du routing de Yao) : il ne prend aucune
    // boutique dans le calcul des quartiers ; on montre celles des quartiers
    // de ses points, rangées chez le merchandiser qui a les mêmes points.
    service.from('profiles').select('nom, email, zone_assignee, territoires_assignes, quartiers_assignes').eq('id', v.merchandiser_id).maybeSingle(),
    service.from('validation_tournee_reponse').select('routing_mensuel_id, decision, commentaire').eq('validation_merch_id', v.id),
    service.from('validation_tournee_pdv_retour').select('pdv_id, motif, commentaire').eq('validation_merch_id', v.id),
    service.from('validation_tournee_zone').select('type, libelle, decision, commentaire').eq('validation_merch_id', v.id),
    service.from('validation_tournee_merch').select('zones_remarque, zones_proposees').eq('id', v.id).maybeSingle(),
    // Territoires actifs seulement ; toutes leurs zones, archivées comprises :
    // les quartiers des profils gardent les noms de l'ancien découpage.
    service.from('territoire').select('code, nom, sous_region_code, zone(id, quartier(nom, ordre))').in('sous_region_code', SOUS_REGIONS).eq('actif', true).order('nom'),
    service.from('profiles').select('id').eq('employeur', 'atom').eq('role', 'merchandiser'),
    // Anciens libellés (« COCODY 1 », « ADJAME »…) → territoire du découpage du 28/10.
    service.from('territoire_alias').select('alias, territoire_code'),
  ])
  for (const r of [lignes, quartiersPdv, profil, reponses, retours, zones, merch, territoires, secteurs, alias]) if (r.error) throw apiError(500, r.error.message)
  if (String(profil.data?.email || '').endsWith('@friesland-test.ci') && !(quartiersPdv.data || []).length) {
    const points = new Set((lignes.data || []).filter((l: any) => l.latitude != null).map((l: any) => `${(+l.latitude).toFixed(5)},${(+l.longitude).toFixed(5)}`))
    const autres = await service.from('routing_mensuel').select('merchandiser_id, latitude, longitude').eq('actif', true).neq('merchandiser_id', v.merchandiser_id).not('latitude', 'is', null)
    const sources = [...new Set((autres.data || []).filter((l: any) => points.has(`${(+l.latitude).toFixed(5)},${(+l.longitude).toFixed(5)}`)).map((l: any) => l.merchandiser_id))]
    if (sources.length) {
      const copie = await toutes(() => service.from('pdv_quartier_tournee')
        .select('pdv_id, point_lat, point_lng, pdv:pdv(pdv_id, nom_pdv, sous_categorie_pdv, distributor_name, is_active)')
        .in('merchandiser_id', sources).order('pdv_id'))
      if (copie.error) throw apiError(500, copie.error.message)
      quartiersPdv.data = copie.data
    }
  }
  const idsAtom = (secteurs.data || []).map((x: any) => x.id)
  const secteursAtom = await service.from('routing_mensuel').select('secteur').eq('actif', true)
    .in('merchandiser_id', idsAtom.length ? idsAtom : ['00000000-0000-0000-0000-000000000000'])
  if (secteursAtom.error) throw apiError(500, secteursAtom.error.message)

  // Quartiers du mois : un par point de visite (Maroc 1 à 4, au même point,
  // forment un seul quartier), avec ses jours de passage et ses boutiques du
  // distributeur des lignes.
  const typeDe = (sousCat: string) => {
    const t = cle(sousCat)
    if (/SUPERETTE/.test(t)) return 'Superette'
    if (/PUSHCAR/.test(t)) return 'Pushcart'
    if (/PORRIDGE/.test(t)) return 'Porridge'
    if (/ABOKI|KIOSK|TABLE TOP/.test(t)) return 'Aboki & Kiosque'
    return 'Boutique'
  }
  const clePoint = (l: any) => l.latitude != null ? `${(+l.latitude).toFixed(5)},${(+l.longitude).toFixed(5)}` : `nom:${cle(l.point_visite)}`
  const quartiers = new Map<string, any>()
  for (const l of lignes.data || []) {
    const k = clePoint(l)
    if (!quartiers.has(k)) quartiers.set(k, { cle: k, noms: [], distributeurs: new Set<string>(), lignes: [], jours: [], pdv: [] })
    const q = quartiers.get(k)
    if (l.point_visite && !q.noms.includes(l.point_visite)) q.noms.push(l.point_visite)
    if (l.distributeur) q.distributeurs.add(l.distributeur)
    q.lignes.push(l.id)
    q.jours.push({ nomJour: JOURS[l.jour_semaine], jour: l.jour_semaine, semaine: l.semaine_du_mois, ssf: l.ssf?.nom || l.ssf_texte || '' })
  }
  for (const x of quartiersPdv.data || []) {
    const q = quartiers.get(`${(+x.point_lat).toFixed(5)},${(+x.point_lng).toFixed(5)}`)
    const b = x.pdv
    if (!q || !b || b.is_active === false || !q.distributeurs.has(b.distributor_name)) continue
    q.pdv.push({ id: b.pdv_id, nom: b.nom_pdv, type: typeDe(b.sous_categorie_pdv) })
  }
  const listeQuartiers = [...quartiers.values()]
    .map(q => ({
      cle: q.cle,
      nom: q.noms.join(' / ') || '—',
      lignes: q.lignes,
      jours: q.jours.sort((a: any, b: any) => a.jour - b.jour || a.semaine - b.semaine),
      distributeur: [...q.distributeurs].join(', '),
      pdv: q.pdv.sort((a: any, b: any) => a.nom.localeCompare(b.nom, 'fr')),
    }))
    .sort((a, b) => a.jours[0].jour - b.jours[0].jour || a.jours[0].semaine - b.jours[0].semaine)
  const jours = (lignes.data || []).map((l: any) => ({ id: l.id, semaine: l.semaine_du_mois, jour: l.jour_semaine, pointVisite: l.point_visite || '—' }))
  // Jours sans point de visite (lundi → samedi, semaines 1 à 4, puis les jours
  // de la 5e semaine du mois) : visite libre, le merchandiser choisit ses PDV
  // (migration 20261022100000). Seulement pour un merchandiser qui a un routing.
  const prevus = new Set((lignes.data || []).map((l: any) => `${l.semaine_du_mois}-${l.jour_semaine}`))
  const joursLibres: { semaine: number, jour: number, nomJour: string, date?: string, objectif: string }[] = []
  if (prevus.size) {
    // Objectif du jour : quotas par type de boutique (« 10 PDV : 6 boutiques, 1 superette… »).
    const quotas = await service.from('routing_quota_canal').select('canal, jour_semaine, quota').gt('quota', 0)
    if (quotas.error) throw apiError(500, quotas.error.message)
    const objectif = (jour: number) => {
      const q = (quotas.data || []).filter((x: any) => x.jour_semaine === jour)
        .sort((a: any, b: any) => (b.canal === 'Boutique' ? 1 : 0) - (a.canal === 'Boutique' ? 1 : 0) || b.quota - a.quota)
      const total = q.reduce((t: number, x: any) => t + x.quota, 0)
      const nom = (canal: string, n: number) => canal === 'Aboki & Kiosque' ? 'aboki ou kiosque'
        : canal === 'Porridge' ? 'porridge' : `${canal.toLowerCase()}${n > 1 ? 's' : ''}`
      return total ? `${total} PDV : ${q.map((x: any) => `${x.quota} ${nom(x.canal, x.quota)}`).join(', ')}` : ''
    }
    for (let semaine = 1; semaine <= 4; semaine++) {
      for (let jour = 1; jour <= 6; jour++) {
        if (!prevus.has(`${semaine}-${jour}`)) joursLibres.push({ semaine, jour, nomJour: JOURS[jour]!, objectif: objectif(jour) })
      }
    }
    const [a, m] = String(v.campagne.mois || '').split('-').map(Number)
    if (a && m) {
      for (let j = 29; j <= new Date(Date.UTC(a, m, 0)).getUTCDate(); j++) {
        const d = new Date(Date.UTC(a, m - 1, j))
        const jour = d.getUTCDay()
        if (jour >= 1 && jour <= 6 && !prevus.has(`5-${jour}`)) {
          joursLibres.push({ semaine: 5, jour, nomJour: JOURS[jour]!, date: d.toISOString().slice(0, 10), objectif: objectif(jour) })
        }
      }
    }
  }

  const p = profil.data || {} as any
  const territoiresActuels = uniques([p.zone_assignee, ...(p.territoires_assignes || [])])

  // Référentiel : territoires (hors « MODERN TRADE ») et leurs quartiers.
  const referentiel = (territoires.data || [])
    .filter((t: any) => cle(t.nom) !== 'MODERN TRADE')
    .map((t: any) => ({
      code: t.code,
      nom: t.nom,
      sousRegion: t.sous_region_code,
      quartiers: uniques((t.zone || []).flatMap((z: any) => (z.quartier || []).map((q: any) => q.nom))).sort((a, b) => a.localeCompare(b, 'fr')),
    }))
  const codeDuNom = (nom: string) => referentiel.find((t: any) => cle(t.nom) === cle(nom))?.code
    || referentiel.find((t: any) => t.code === (alias.data || []).find((a: any) => cle(a.alias) === cle(nom))?.territoire_code)?.code
    || null

  return {
    campagne: { libelle: v.campagne.libelle, mois: v.campagne.mois },
    merchandiser: p.nom || '',
    statut: v.statut,
    valideLe: v.valide_le,
    remarque: v.remarque || '',
    zonesRemarque: merch.data?.zones_remarque || '',
    jours,
    joursLibres,
    quartiers: listeQuartiers,
    zones: {
      secteursAtom: uniques((lignes.data || []).map((l: any) => l.secteur)),
      communesAtom: uniques((lignes.data || []).map((l: any) => l.commune)),
      territoiresFriesland: territoiresActuels,
    },
    // Ce qui est enregistré aujourd'hui, en codes / noms du référentiel.
    zonesActuelles: {
      secteursAtom: uniques((lignes.data || []).map((l: any) => l.secteur)),
      territoires: uniques(territoiresActuels.map(codeDuNom)),
      quartiers: uniques(p.quartiers_assignes || []),
    },
    zonesProposees: merch.data?.zones_proposees || null,
    referentiel: {
      secteursAtom: uniques((secteursAtom.data || []).map((x: any) => x.secteur)).sort((a, b) => a.localeCompare(b, 'fr')),
      territoires: referentiel,
    },
    reponses: Object.fromEntries((reponses.data || []).map((r: any) => [r.routing_mensuel_id, { decision: r.decision, commentaire: r.commentaire || '' }])),
    retoursPdv: Object.fromEntries((retours.data || []).map((r: any) => [r.pdv_id, { motif: r.motif, commentaire: r.commentaire || '' }])),
    reponsesZones: Object.fromEntries((zones.data || []).map((z: any) => [`${z.type}|${z.libelle}`, { decision: z.decision, commentaire: z.commentaire || '' }])),
  }
})
