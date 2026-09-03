// Force le changement de mot de passe au premier login : les comptes seedés
// portent user_metadata.must_change_password = true (posé via
// scripts/set-must-change-password.mjs). Tant que le flag est vrai, toute
// navigation est redirigée vers la page de changement de mot de passe.
export default defineNuxtRouteMiddleware((to) => {
  const user = useSupabaseUser()
  if (!user.value) return

  const mustChange = user.value.user_metadata?.must_change_password === true
  const allowed = ['/changer-mot-de-passe', '/login', '/privacy-policy']

  if (mustChange && !allowed.includes(to.path)) {
    return navigateTo('/changer-mot-de-passe', { replace: true })
  }
  if (!mustChange && to.path === '/changer-mot-de-passe') {
    return navigateTo('/', { replace: true })
  }
})
