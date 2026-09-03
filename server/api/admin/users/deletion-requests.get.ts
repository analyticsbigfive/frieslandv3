// server/api/admin/users/deletion-requests.get.ts
// Liste des demandes de suppression de compte en attente (posées par
// /api/account/deletion-request dans user_metadata). Admin uniquement.
import { serverSupabaseServiceRole } from '#supabase/server'

export interface DeletionRequest {
  id: string
  email: string
  requested_at: string
  reason: string | null
}

export default defineEventHandler(async (event): Promise<DeletionRequest[]> => {
  const service = serverSupabaseServiceRole(event) as any
  await requireAdmin(event, service)

  const out: DeletionRequest[] = []
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw apiError(500, error.message)
    for (const u of data?.users || []) {
      const at = u.user_metadata?.deletion_requested_at
      if (at) {
        out.push({
          id: u.id,
          email: u.email || u.user_metadata?.deletion_contact_email || '',
          requested_at: String(at),
          reason: u.user_metadata?.deletion_reason || null,
        })
      }
    }
    if (!data?.users?.length || data.users.length < 200) break
  }
  return out.sort((a, b) => a.requested_at.localeCompare(b.requested_at))
})
