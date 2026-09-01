// server/utils/adminUsers.ts
// Création auth + profil partagée entre la création unitaire (users.post.ts)
// et l'import en masse (users/import.post.ts).
import type { UserRole } from '~/types'

export const USER_ROLES: UserRole[] = ['admin', 'superviseur', 'merchandiser', 'commercial']
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface CreateUserInput {
  email: string
  password: string
  nom: string
  role: UserRole
  telephone: string | null
  zone_assignee: string | null
  territoires_assignes: string[]
  quartiers_assignes: string[]
  region: string | null
}

// email_confirm: true -> compte utilisable immédiatement, aucun mail envoyé
// (le SMTP intégré Supabase est plafonné à 2 mails/heure).
export async function createUserWithProfile(service: any, input: CreateUserInput) {
  const { data, error } = await service.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { nom: input.nom, role: input.role },
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
      email: input.email,
      nom: input.nom,
      role: input.role,
      telephone: input.telephone,
      zone_assignee: input.zone_assignee,
      territoires_assignes: input.territoires_assignes,
      quartiers_assignes: input.quartiers_assignes,
      region: input.region,
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
}
