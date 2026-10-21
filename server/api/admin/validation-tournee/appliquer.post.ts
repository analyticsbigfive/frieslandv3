// POST /api/admin/validation-tournee/appliquer — admin ou superviseur.
// { campagneId, simuler } : applique (ou simule) les corrections choisies dans
// la page de validation, pour les fiches envoyées. Le vrai passage est refusé
// (409) tant qu'un merchandiser n'a pas envoyé sa fiche. Après un vrai passage,
// les tournées à venir des merchandisers touchés sont régénérées.
export default defineEventHandler(async (event) => {
  const service = getServiceClient(event)
  await requireAdminOuSuperviseur(event, service)
  const body = await readBody(event).catch(() => ({}))
  const campagneId = String(body?.campagneId || '')
  if (!/^[0-9a-f-]{36}$/i.test(campagneId)) throw apiError(400, 'Mois de validation inconnu')
  const simuler = body?.simuler !== false

  const { data, error } = await service.rpc('appliquer_validation_tournee', { p_campagne: campagneId, p_simuler: simuler })
  if (error) throw apiError(error.code === 'VT409' ? 409 : 500, error.message)

  // Tournées à venir : un appel par merchandiser (chacun reste court).
  const tournees: { nom: string, ok: boolean }[] = []
  if (!simuler) {
    for (const m of data?.merchandisers || []) {
      const r = await service.rpc('recalculer_tournees_a_venir', { p_user_id: m.merchandiser_id })
      tournees.push({ nom: m.nom, ok: !r.error })
    }
  }
  return { ...data, tournees }
})
