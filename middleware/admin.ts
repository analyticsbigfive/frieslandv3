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

  // Admin: accès total
  if (role === 'admin') return

  // Tous les autres rôles passent par la matrice RBAC. Les rôles terrain sont
  // refusés par défaut, mais un admin peut leur ouvrir une section précise.
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
