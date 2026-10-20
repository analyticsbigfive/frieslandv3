// POST /api/admin/validation-tournee/recalculer — admin ou agence.
// Refait le quartier de chaque PDV Atom (point de visite le plus proche,
// règle du 20/10/2026). Les triggers le font déjà à chaque changement ; ce
// bouton sert après un import ou une correction faite hors de l'app.
export default defineEventHandler(async (event) => {
  const service = getServiceClient(event)
  await requireAdminOuAgence(event, service)
  const { data, error } = await service.rpc('recalculer_quartiers_atom', { p_pdv_ids: null })
  if (error) throw apiError(500, error.message)
  return { pdv: data ?? 0 }
})
