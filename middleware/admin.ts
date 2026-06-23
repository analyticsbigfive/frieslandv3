// middleware/admin.ts
export default defineNuxtRouteMiddleware(async (to) => {
  const authStore = useAuthStore()
  const user = useSupabaseUser()

  if (!user.value) {
    return navigateTo('/login')
  }

  if (!authStore.profile) {
    await authStore.fetchProfile()
  }

  const role = authStore.profile?.role

  // Seuls admin + superviseur accèdent au dashboard
  if (role !== 'admin' && role !== 'superviseur') {
    return navigateTo('/mobile')
  }

  // Admin: accès total
  if (role === 'admin') return

  // Autres rôles dashboard: vérif accès section (RBAC)
  const { fetchAccess, canAccessPath } = useAccessControl()
  await fetchAccess()

  if (!canAccessPath(to.path)) {
    // Repli vers le dashboard si autorisé, sinon mobile
    if (to.path !== '/admin' && canAccessPath('/admin')) {
      return navigateTo('/admin')
    }
    return navigateTo('/mobile')
  }
})
