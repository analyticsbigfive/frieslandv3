// middleware/terrain-write.ts
// Pages de saisie terrain (nouvelle visite, édition PDV). Le commercial
// consulte en lecture seule : la base refuse déjà l'écriture (RLS, lot 2),
// on lui évite d'atterrir sur un formulaire qui échouerait à l'envoi.
import { canWriteTerrain } from '~/utils/roles'

export default defineNuxtRouteMiddleware(async () => {
  const user = useSupabaseUser()
  if (!user.value) {
    return navigateTo('/login')
  }

  const authStore = useAuthStore()
  if (!authStore.profile) {
    await authStore.fetchProfile()
  }

  if (!canWriteTerrain(authStore.profile?.role)) {
    return navigateTo('/mobile', { replace: true })
  }
})
