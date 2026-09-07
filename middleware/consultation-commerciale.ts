// middleware/consultation-commerciale.ts
// Écrans de pilotage réservés à l'encadrement : suivi des visites de l'équipe
// et field coaching. Le merchandiseur ne voit que ce qui lui est assigné, il
// n'a donc rien à faire ici. Miroir des politiques field_coaching_select et
// action_commerciale_select (migration 20260910120000), qui refusent déjà les
// lignes : on lui évite d'atterrir sur un écran vide.
import { ROLES_CONSULTATION_COMMERCIALE } from '~/utils/roles'

export default defineNuxtRouteMiddleware(async () => {
  const user = useSupabaseUser()
  if (!user.value) return navigateTo('/login')

  const authStore = useAuthStore()
  if (!authStore.profile) await authStore.fetchProfile()

  const role = authStore.profile?.role
  if (!role || !ROLES_CONSULTATION_COMMERCIALE.includes(role)) {
    return navigateTo('/mobile', { replace: true })
  }
})
