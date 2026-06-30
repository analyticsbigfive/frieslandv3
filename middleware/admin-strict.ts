// middleware/admin-strict.ts
export default defineNuxtRouteMiddleware(async () => {
  const authStore = useAuthStore()
  const user = useSupabaseUser()

  if (!user.value) {
    return navigateTo('/login')
  }

  if (!authStore.profile) {
    await authStore.fetchProfile()
  }

  const role = authStore.profile?.role

  // Réservé exclusivement aux administrateurs
  if (role !== 'admin') {
    return navigateTo('/admin')
  }
})
