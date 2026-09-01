// server/api/admin/users.post.ts
// Création d'un utilisateur par un admin.
//
// Passe par l'API admin (service_role) et non par auth.signUp() côté client :
//   - signUp() déclenche un mail de confirmation -> SMTP intégré Supabase plafonné
//     à 2 mails/heure -> HTTP 429 "over_email_send_rate_limit" au 3e compte créé ;
//   - signUp() renvoie une session quand la confirmation est désactivée, ce qui
//     écraserait la session de l'admin dans le navigateur ;
//   - le trigger handle_new_user pose le profil : on complète rôle + périmètre
//     ici, sur l'id retourné (et non par un .eq('email') à l'aveugle).
import { serverSupabaseServiceRole } from '#supabase/server'
import type { UserRole } from '~/types'
import { createUserWithProfile, USER_ROLES, EMAIL_RE } from '../../utils/adminUsers'

export default defineEventHandler(async (event) => {
  const service = serverSupabaseServiceRole(event) as any
  await requireAdmin(event, service)

  const body = await readBody(event)
  const email = String(body?.email || '').trim().toLowerCase()
  const password = String(body?.password || '')
  const nom = String(body?.nom || '').trim().substring(0, 100)
  const role = (body?.role || 'merchandiser') as UserRole

  if (!email || !password || !nom) {
    throw apiError(400, 'Email, mot de passe et nom sont requis')
  }
  if (!EMAIL_RE.test(email)) {
    throw apiError(400, 'Format d\'email invalide')
  }
  if (password.length < 8) {
    throw apiError(400, 'Le mot de passe doit contenir au moins 8 caractères')
  }
  if (!USER_ROLES.includes(role)) {
    throw apiError(400, 'Rôle invalide')
  }

  const toStringArray = (v: any) => (Array.isArray(v) ? v.filter(Boolean).map(String) : [])
  const territoires = toStringArray(body?.territoires_assignes)
  const quartiers = toStringArray(body?.quartiers_assignes)
  const telephone = body?.telephone ? String(body.telephone).trim().substring(0, 50) : null
  const zoneAssignee = body?.zone_assignee ? String(body.zone_assignee) : (territoires[0] || null)
  const region = body?.region ? String(body.region) : null

  return await createUserWithProfile(service, {
    email,
    password,
    nom,
    role,
    telephone,
    zone_assignee: zoneAssignee,
    territoires_assignes: territoires,
    quartiers_assignes: quartiers,
    region,
  })
})
