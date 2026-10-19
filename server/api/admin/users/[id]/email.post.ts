// server/api/admin/users/[id]/email.post.ts
// Changement de l'email de connexion d'un utilisateur par un admin.
//
// L'email vit à deux endroits : auth.users (identifiant de connexion) et
// profiles.email (affichage, recherche, import par email). Écrire seulement
// profiles.email depuis le navigateur désynchroniserait les deux : la personne
// continuerait de se connecter avec l'ancien. On passe donc par l'API admin
// (service_role), puis on recopie dans le profil.
//
// email_confirm: true -> changement immédiat, sans mail de confirmation (SMTP
// Supabase plafonné à 2 mails/heure, et le nouvel email n'est pas toujours
// consulté par l'utilisateur terrain).
//
// Body : { email: string }  — normalisé en minuscules, comme à la création.
// Retour : { success: true, email }
import { EMAIL_RE } from '../../../../utils/adminUsers'

export default defineEventHandler(async (event) => {
  const service = getServiceClient(event)
  await requireAdmin(event, service)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw apiError(400, 'Identifiant utilisateur manquant')
  }

  const body = await readBody(event).catch(() => ({}))
  const email = String(body?.email || '').trim().toLowerCase()
  if (!email || !EMAIL_RE.test(email)) {
    throw apiError(400, 'Format d\'email invalide')
  }

  const { data: existing, error: getErr } = await service.auth.admin.getUserById(id)
  if (getErr || !existing?.user) {
    throw apiError(404, 'Compte de connexion introuvable pour cet utilisateur')
  }
  const ancien = existing.user.email || null

  // Déjà à jour côté auth : on resynchronise seulement le profil.
  if (ancien?.toLowerCase() !== email) {
    const { data: pris } = await service.from('profiles').select('id').ilike('email', email).neq('id', id).limit(1)
    if (pris?.length) {
      throw apiError(409, 'Un autre compte utilise déjà cet email')
    }

    const { error } = await service.auth.admin.updateUserById(id, { email, email_confirm: true })
    if (error) {
      const dejaPris = /already|exist|registered/i.test(error.message || '')
      throw apiError(dejaPris ? 409 : (error.status || 500), dejaPris ? 'Un autre compte utilise déjà cet email' : error.message)
    }
  }

  const { error: profileError } = await service.from('profiles').update({ email }).eq('id', id)
  if (profileError) {
    // Pas de connexion sur un email que le profil ignore : on rétablit l'ancien.
    if (ancien && ancien.toLowerCase() !== email) {
      await service.auth.admin.updateUserById(id, { email: ancien, email_confirm: true })
    }
    throw apiError(500, `Email non enregistré sur le profil : ${profileError.message}`)
  }

  return { success: true, email }
})
