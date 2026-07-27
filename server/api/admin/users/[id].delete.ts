// server/api/admin/users/[id].delete.ts
// Suppression complète d'un utilisateur : compte auth + profil.
// profiles.id est FK auth.users(id) ON DELETE CASCADE -> supprimer le compte auth
// suffit. Supprimer uniquement le profil (ancien comportement) laissait un compte
// auth orphelin encore capable de se connecter.
import { serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const service = serverSupabaseServiceRole(event) as any
  const caller = await requireAdmin(event, service)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw apiError(400, 'Identifiant utilisateur manquant')
  }
  if (id === caller.id) {
    throw apiError(400, 'Impossible de supprimer votre propre compte')
  }

  const { error } = await service.auth.admin.deleteUser(id)
  if (error) {
    throw apiError(error.status || 500, error.message)
  }

  // Filet de sécurité si la cascade n'a pas joué (profil sans compte auth).
  await service.from('profiles').delete().eq('id', id)

  return { success: true }
})
