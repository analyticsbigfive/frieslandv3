// middleware/coaching-write.ts
// Le field coaching est rempli par les superviseurs et les commerciaux
// (et l'admin). Miroir de la politique field_coaching_insert.
export default defineNuxtRouteMiddleware(async () => {
  const user = useSupabaseUser()
  if (!user.value) return navigateTo('/login')
  const authStore = useAuthStore()
  if (!authStore.profile) await authStore.fetchProfile()
  const role = authStore.profile?.role
  if (!['superviseur', 'commercial', 'admin'].includes(role || '')) {
    return navigateTo('/mobile', { replace: true })
  }
})
