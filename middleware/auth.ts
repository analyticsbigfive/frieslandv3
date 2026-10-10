// middleware/auth.ts
export default defineNuxtRouteMiddleware(async (to) => {
  const user = useSupabaseUser()

  if (!user.value && to.path !== '/login') {
    // Back-office : après connexion, /login ramène sur la page demandée.
    return navigateTo(to.path.startsWith('/admin')
      ? { path: '/login', query: { redirect: to.fullPath } }
      : '/login')
  }

  // Check if user profile is active
  if (user.value) {
    const authStore = useAuthStore()
    if (!authStore.profile) {
      await authStore.fetchProfile()
    }
    if (authStore.profile && !authStore.profile.is_active) {
      await authStore.logout()
      return navigateTo('/login')
    }
  }
})
