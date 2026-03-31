// middleware/admin.ts
export default defineNuxtRouteMiddleware(async () => {
  const authStore = useAuthStore()
  const user = useSupabaseUser()

  if (!user.value) {
    return navigateTo('/login')
  }

  if (!authStore.profile) {
    await authStore.fetchProfile()
  }

  if (!authStore.isAdmin && !authStore.isSuperviseur) {
    return navigateTo('/mobile')
  }
})
