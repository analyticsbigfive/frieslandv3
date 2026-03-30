// middleware/admin.ts
export default defineNuxtRouteMiddleware(async () => {
  const authStore = useAuthStore()

  if (!authStore.isAdmin && !authStore.isSuperviseur) {
    return navigateTo('/mobile')
  }
})
