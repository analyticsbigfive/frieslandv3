// GET /api/validation-tournee — route PUBLIQUE.
// Campagne ouverte et liste des merchandisers (nom + avancement), jamais les codes.
export default defineEventHandler(async (event) => {
  freinerIp(event)
  const service = getServiceClient(event)
  const campagne = await campagneOuverte(service)
  if (!campagne) return { campagne: null, merchandisers: [] }
  const { data, error } = await service
    .from('validation_tournee_merch')
    .select('id, statut, merchandiser:profiles!validation_tournee_merch_merchandiser_id_fkey(nom)')
    .eq('campagne_id', campagne.id)
  if (error) throw apiError(500, error.message)
  const merchandisers = (data || [])
    .map((v: any) => ({ id: v.id, nom: v.merchandiser?.nom || '—', statut: v.statut }))
    .sort((a: any, b: any) => a.nom.localeCompare(b.nom, 'fr'))
  return { campagne: { libelle: campagne.libelle, mois: campagne.mois }, merchandisers }
})
