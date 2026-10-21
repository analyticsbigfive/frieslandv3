// POST /api/admin/validation-tournee/annuler — admin ou superviseur.
// { lot } : remet le routing, les boutiques et les profils comme avant ce
// passage, puis régénère les tournées à venir des merchandisers touchés.
export default defineEventHandler(async (event) => {
  const service = getServiceClient(event)
  await requireAdminOuSuperviseur(event, service)
  const body = await readBody(event).catch(() => ({}))
  const lot = String(body?.lot || '')
  if (!/^[0-9a-f-]{36}$/i.test(lot)) throw apiError(400, 'Passage inconnu')

  const { data: lignes, error: e1 } = await service.from('validation_tournee_application')
    .select('table_cible, cible_id, avant').eq('lot', lot)
  if (e1) throw apiError(500, e1.message)
  const { data: n, error } = await service.rpc('annuler_application_validation', { p_lot: lot })
  if (error) throw apiError(500, error.message)

  const merchs = new Set<string>()
  for (const l of lignes || []) {
    if (l.table_cible === 'routing_mensuel' && l.avant?.merchandiser_id) merchs.add(l.avant.merchandiser_id)
    if (l.table_cible === 'profiles') merchs.add(l.cible_id)
  }
  for (const m of merchs) await service.rpc('recalculer_tournees_a_venir', { p_user_id: m })
  return { annulees: n ?? 0 }
})
