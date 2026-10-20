// GET /api/validation-tournee/donnees — route PUBLIQUE, jeton requis.
// Routing du merchandiser (24 jours), PDV de chaque jour selon la règle du
// 20/10 (quartier du point de visite, puis quartier voisin du même
// distributeur), zones et secteurs (Atom et Friesland), réponses déjà
// saisies. Jamais de téléphone de boutique ; pas de zone sur les PDV.
const uniques = (liste: (string | null | undefined)[]) => {
  const vus = new Set<string>()
  const out: string[] = []
  for (const x of liste) {
    const t = String(x || '').trim()
    const k = t.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    if (t && !vus.has(k)) { vus.add(k); out.push(t) }
  }
  return out
}

export default defineEventHandler(async (event) => {
  freinerIp(event)
  const service = getServiceClient(event)
  const v = await validationDuJeton(event, service)

  const [lignes, plan, profil, reponses, retours, zones, merch] = await Promise.all([
    service.from('routing_mensuel')
      .select('id, jour_semaine, semaine_du_mois, point_visite, secteur, commune, latitude, longitude, distributeur, ssf_texte, type_engin, ssf:ssf(nom)')
      .eq('merchandiser_id', v.merchandiser_id).eq('actif', true)
      .order('semaine_du_mois').order('jour_semaine'),
    service.rpc('plan_mensuel_atom', { p_user: v.merchandiser_id }),
    service.from('profiles').select('nom, zone_assignee, territoires_assignes, quartiers_assignes').eq('id', v.merchandiser_id).maybeSingle(),
    service.from('validation_tournee_reponse').select('routing_mensuel_id, decision, commentaire').eq('validation_merch_id', v.id),
    service.from('validation_tournee_pdv_retour').select('pdv_id, motif, commentaire').eq('validation_merch_id', v.id),
    service.from('validation_tournee_zone').select('type, libelle, decision, commentaire').eq('validation_merch_id', v.id),
    service.from('validation_tournee_merch').select('zones_remarque').eq('id', v.id).maybeSingle(),
  ])
  for (const r of [lignes, plan, profil, reponses, retours, zones, merch]) if (r.error) throw apiError(500, r.error.message)

  const parLigne = new Map<string, any[]>()
  for (const p of plan.data || []) {
    if (!parLigne.has(p.ligne_id)) parLigne.set(p.ligne_id, [])
    parLigne.get(p.ligne_id)!.push({
      id: p.pdv_id, nom: p.nom_pdv, type: p.canal, quartierVoisin: !!p.quartier_voisin,
      distancePoint: p.distance_point_m, lat: p.latitude, lng: p.longitude,
    })
  }
  const jours = (lignes.data || []).map((l: any) => ({
    id: l.id,
    semaine: l.semaine_du_mois,
    jour: l.jour_semaine,
    nomJour: JOURS[l.jour_semaine],
    pointVisite: l.point_visite || '—',
    point: l.latitude != null ? { lat: l.latitude, lng: l.longitude } : null,
    distributeur: l.distributeur || '',
    ssf: l.ssf?.nom || l.ssf_texte || '',
    engin: l.type_engin || '',
    pdv: parLigne.get(l.id) || [],
  }))

  const p = profil.data || {} as any
  const zonesAValider = {
    secteursAtom: uniques((lignes.data || []).map((l: any) => l.secteur)),
    communesAtom: uniques((lignes.data || []).map((l: any) => l.commune)),
    territoiresFriesland: uniques([p.zone_assignee, ...(p.territoires_assignes || [])]),
    quartiersFriesland: uniques(p.quartiers_assignes || []).sort((a, b) => a.localeCompare(b, 'fr')),
  }

  return {
    campagne: { libelle: v.campagne.libelle, mois: v.campagne.mois },
    merchandiser: p.nom || '',
    statut: v.statut,
    valideLe: v.valide_le,
    remarque: v.remarque || '',
    zonesRemarque: merch.data?.zones_remarque || '',
    jours,
    zones: zonesAValider,
    reponses: Object.fromEntries((reponses.data || []).map((r: any) => [r.routing_mensuel_id, { decision: r.decision, commentaire: r.commentaire || '' }])),
    retoursPdv: Object.fromEntries((retours.data || []).map((r: any) => [r.pdv_id, { motif: r.motif, commentaire: r.commentaire || '' }])),
    reponsesZones: Object.fromEntries((zones.data || []).map((z: any) => [`${z.type}|${z.libelle}`, { decision: z.decision, commentaire: z.commentaire || '' }])),
  }
})
