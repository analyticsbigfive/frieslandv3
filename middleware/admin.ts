// middleware/admin.ts
import { libelleEcran, premiereOuvrable } from '~/utils/adminNavigation'
import { homePathForRole } from '~/utils/roles'
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
  const { fetchAccess, canAccessPath, canAccessSection } = useAccessControl()
  await fetchAccess()

  if (!canAccessPath(to.path, role, to.query)) {
    // Repli vers la première page que ce compte peut ouvrir, avec le nom de
    // l'écran refusé : le layout l'annonce (« Vous n'avez pas accès à… »).
    // Aucun écran du back-office ouvert (merchandiser) : l'application mobile.
    // La page d'accueil du rôle d'abord (agence : Planning), sinon le premier onglet ouvert.
    const accueil = homePathForRole(role)
    const repli = accueil.startsWith('/admin') && accueil !== to.path && canAccessPath(accueil, role)
      ? { path: accueil, query: {} as Record<string, string> }
      : premiereOuvrable(role, s => canAccessSection(s, role))
    if (repli && repli.path !== to.path) {
      const ecran = libelleEcran(to.path, to.query) || 'cet écran'
      return navigateTo({ path: repli.path, query: { ...repli.query, acces_refuse: ecran } })
    }
    return navigateTo('/mobile')
  }
})
