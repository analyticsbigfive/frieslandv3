// GET /api/validation-tournee — route PUBLIQUE.
// Seulement le mois ouvert : on n'entre que par son lien personnel, la liste
// des noms n'est plus exposée.
export default defineEventHandler(async (event) => {
  freinerIp(event)
  const campagne = await campagneOuverte(getServiceClient(event))
  return { campagne: campagne ? { libelle: campagne.libelle, mois: campagne.mois } : null }
})
