// server/utils/encadrantGuard.ts
// Garde des routes ouvertes à l'encadrement (admin, superviseur, commercial).
// Comme pour requireAdmin, la clé service_role bypasse la RLS : l'appelant
// DOIT être vérifié explicitement ici.
import type { H3Event } from 'h3'
import { serverSupabaseUser } from '#supabase/server'

export interface Encadrant {
  id: string
  role: 'admin' | 'superviseur' | 'commercial'
  territoires: string[]
}

const ROLES_ENCADRANTS = ['admin', 'superviseur', 'commercial']

export async function requireEncadrant(event: H3Event, service: any): Promise<Encadrant> {
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
    .select('role, is_active, territoires_assignes, zone_assignee')
    .eq('id', user.id)
    .single()

  if (error || !data || data.is_active === false || !ROLES_ENCADRANTS.includes(data.role)) {
    throw apiError(403, 'Action réservée aux commerciaux, superviseurs et administrateurs')
  }

  const multi = Array.isArray(data.territoires_assignes) ? data.territoires_assignes.filter(Boolean) : []
  const territoires = multi.length ? multi : (data.zone_assignee ? [data.zone_assignee] : [])

  return { id: user.id, role: data.role, territoires }
}
