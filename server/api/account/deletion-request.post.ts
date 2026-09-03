// server/api/account/deletion-request.post.ts
// Demande de suppression de compte et des données associées (exigence Google
// Play : un lien accessible sans être connecté). Route PUBLIQUE.
//
// La demande est enregistrée sur le compte de connexion lui-même
// (user_metadata.deletion_requested_at / deletion_reason) : aucune table à
// créer, et l'admin la retrouve dans Utilisateurs via
// /api/admin/users/deletion-requests. La suppression effective reste un acte
// de l'administrateur (compte + profil, cascade sur les visites).
//
// Réponse identique que l'e-mail existe ou non : on ne révèle pas la liste
// des comptes. Si l'appelant est connecté, son propre compte est ciblé quel
// que soit l'e-mail saisi.
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { EMAIL_RE } from '../../utils/adminUsers'

async function findUserIdByEmail(service: any, email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw apiError(500, error.message)
    const hit = (data?.users || []).find((u: any) => String(u.email || '').toLowerCase() === email)
    if (hit) return hit.id
    if (!data?.users?.length || data.users.length < 200) break
  }
  return null
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
  const email = String(body?.email || '').trim().toLowerCase()
  const reason = String(body?.reason || '').trim().substring(0, 500)
  if (!EMAIL_RE.test(email)) {
    throw apiError(400, 'Adresse e-mail invalide')
  }
  if (body?.confirm !== true) {
    throw apiError(400, 'Veuillez confirmer la demande')
  }

  const service = serverSupabaseServiceRole(event) as any

  let userId: string | null = null
  try {
    const me = (await serverSupabaseUser(event)) as any
    if (me?.id) userId = me.id
  }
  catch {
    userId = null
  }
  if (!userId) userId = await findUserIdByEmail(service, email)

  if (userId) {
    const { data: existing } = await service.auth.admin.getUserById(userId)
    const meta = existing?.user?.user_metadata || {}
    const { error } = await service.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...meta,
        deletion_requested_at: new Date().toISOString(),
        deletion_reason: reason || null,
        deletion_contact_email: email,
      },
    })
    if (error) throw apiError(500, error.message)
  }

  // Même réponse dans tous les cas (pas d'énumération des comptes).
  return { success: true }
})
