// server/api/admin/equipes.post.ts
// Assignation en masse des merchandiseurs à un commercial (écran Équipes).
// Les merchandiseurs cochés lui sont rattachés, ceux qui lui étaient rattachés
// et ne le sont plus sont libérés. Clé service_role : la RLS de profiles ne
// laisse pas réécrire les autres profils depuis le navigateur.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  const service = getServiceClient(event)
  await requireAdmin(event, service)

  const body = await readBody(event)
  const commercialId = String(body?.commercial_id || '').trim()
  const ids: string[] = Array.isArray(body?.merchandiser_ids) ? body.merchandiser_ids.map(String) : []
  if (!commercialId) throw apiError(400, 'Commercial non précisé')
  // Les ids finissent dans un filtre PostgREST `not.in.(...)` : un id mal formé
  // casserait le filtre (et libérerait toute l'équipe).
  if (![commercialId, ...ids].every(id => UUID_RE.test(id))) {
    throw apiError(400, 'Identifiant invalide')
  }

  const { data: commercial, error: cErr } = await service
    .from('profiles').select('id, role, nom').eq('id', commercialId).maybeSingle()
  if (cErr) throw apiError(500, cErr.message)
  if (!commercial) throw apiError(404, 'Commercial introuvable')
  if (!['commercial', 'admin'].includes(commercial.role)) {
    throw apiError(400, 'Le responsable doit être un commercial')
  }

  // Rattache d'abord les cochés (uniquement des merchandiseurs), puis libère
  // les autres : si la 2e requête échoue, personne ne se retrouve sans commercial.
  let assignes = 0
  if (ids.length) {
    const { data, error } = await service
      .from('profiles')
      .update({ commercial_id: commercialId })
      .in('id', ids)
      .eq('role', 'merchandiser')
      .select('id')
    if (error) throw apiError(500, error.message)
    assignes = data?.length || 0
  }

  // Libère ceux qui ne sont plus cochés.
  let libere = service.from('profiles').update({ commercial_id: null }).eq('commercial_id', commercialId)
  if (ids.length) libere = libere.not('id', 'in', `(${ids.join(',')})`)
  const { error: libErr } = await libere
  if (libErr) throw apiError(500, libErr.message)

  return { commercial: commercial.nom, assignes }
})
