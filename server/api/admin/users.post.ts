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

const ROLES: UserRole[] = ['admin', 'superviseur', 'merchandiser', 'commercial']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
  if (!ROLES.includes(role)) {
    throw apiError(400, 'Rôle invalide')
  }

  const toStringArray = (v: any) => (Array.isArray(v) ? v.filter(Boolean).map(String) : [])
  const territoires = toStringArray(body?.territoires_assignes)
  const quartiers = toStringArray(body?.quartiers_assignes)
  const telephone = body?.telephone ? String(body.telephone).trim().substring(0, 50) : null
  const zoneAssignee = body?.zone_assignee ? String(body.zone_assignee) : (territoires[0] || null)
  const region = body?.region ? String(body.region) : null

  // email_confirm: true -> compte utilisable immédiatement, aucun mail envoyé.
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nom, role },
  })

  if (error) {
    const alreadyExists = /already|exist/i.test(error.message || '')
    throw apiError(
      alreadyExists ? 409 : (error.status || 400),
      alreadyExists ? 'Un compte existe déjà avec cet email' : error.message,
    )
  }

  const userId = data?.user?.id
  if (!userId) {
    throw apiError(500, 'Compte créé sans identifiant, contactez le support')
  }

  // upsert : le trigger handle_new_user a normalement déjà inséré la ligne,
  // on la complète — et on la crée si le trigger venait à manquer.
  const { data: profile, error: profileError } = await service
    .from('profiles')
    .upsert({
      id: userId,
      email,
      nom,
      role,
      telephone,
      zone_assignee: zoneAssignee,
      territoires_assignes: territoires,
      quartiers_assignes: quartiers,
      region,
      is_active: true,
    }, { onConflict: 'id' })
    .select()
    .single()

  if (profileError) {
    // Pas de compte auth orphelin sans profil : on annule la création.
    await service.auth.admin.deleteUser(userId)
    throw apiError(500, `Profil non enregistré : ${profileError.message}`)
  }

  return profile
})
