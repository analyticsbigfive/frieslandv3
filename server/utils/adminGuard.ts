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

/**
 * Admin, ou compte « agence » (responsable du routing d'une agence) : renvoie
 * le code de l'agence, null pour un admin. La route appelante limite elle-même
 * ce qu'un compte agence peut écrire (scripts/lib/imports/portee-agence.mjs).
 */
export async function requireAdminOuAgence(event: H3Event, service: any): Promise<{ id: string, agence: string | null }> {
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
    .select('role, is_active, employeur')
    .eq('id', user.id)
    .single()

  if (error || data?.is_active === false) {
    throw apiError(403, 'Action réservée aux administrateurs')
  }
  if (data?.role === 'admin') return { id: user.id, agence: null }
  // Un compte agence sans agence (ou rattaché à FrieslandCampina) n'a aucune portée.
  if (data?.role === 'agence' && data.employeur && data.employeur !== 'friesland') {
    return { id: user.id, agence: data.employeur }
  }
  throw apiError(403, 'Action réservée aux administrateurs')
}
