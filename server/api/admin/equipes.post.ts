// server/api/admin/equipes.post.ts
// Assignation en masse des merchandiseurs à un commercial (écran Équipes).
// Les merchandiseurs cochés lui sont rattachés, ceux qui lui étaient rattachés
// et ne le sont plus sont libérés. Clé service_role : la RLS de profiles ne
// laisse pas réécrire les autres profils depuis le navigateur.
import { serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const service = serverSupabaseServiceRole(event) as any
  await requireAdmin(event, service)

  const body = await readBody(event)
  const commercialId = String(body?.commercial_id || '').trim()
  const ids: string[] = Array.isArray(body?.merchandiser_ids) ? body.merchandiser_ids.map(String) : []
  if (!commercialId) throw apiError(400, 'Commercial non précisé')

  const { data: commercial, error: cErr } = await service
    .from('profiles').select('id, role, nom').eq('id', commercialId).maybeSingle()
  if (cErr) throw apiError(500, cErr.message)
  if (!commercial) throw apiError(404, 'Commercial introuvable')
  if (!['commercial', 'admin'].includes(commercial.role)) {
    throw apiError(400, 'Le responsable doit être un commercial')
  }

  // Libère ceux qui ne sont plus cochés.
  let libere = service.from('profiles').update({ commercial_id: null }).eq('commercial_id', commercialId)
  if (ids.length) libere = libere.not('id', 'in', `(${ids.join(',')})`)
  const { error: libErr } = await libere
  if (libErr) throw apiError(500, libErr.message)

  // Rattache les cochés (uniquement des merchandiseurs).
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

  return { commercial: commercial.nom, assignes }
})
