// server/utils/adminGuard.ts
// Garde commune aux routes /api/admin/* : la clé service_role bypasse la RLS,
// donc l'appelant DOIT être vérifié explicitement côté serveur.
import type { H3Event } from 'h3'
import { serverSupabaseUser } from '#supabase/server'

export async function requireAdmin(event: H3Event, service: any) {
  let user: { id: string } | null = null
  try {
    user = (await serverSupabaseUser(event)) as any
  }
  catch {
    user = null
  }
  if (!user) {
    throw apiError(401, 'Session expirée, reconnectez-vous')
  }

  const { data, error } = await service
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  if (error || data?.role !== 'admin' || data?.is_active === false) {
    throw apiError(403, 'Action réservée aux administrateurs')
  }

  return user
}
