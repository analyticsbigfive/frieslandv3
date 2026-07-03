import { Capacitor } from '@capacitor/core'

// L'APK n'embarque que l'app terrain : l'accueil et l'admin sont
// redirigés vers /mobile (l'admin reste accessible sur le web).
export default defineNuxtRouteMiddleware((to) => {
  if (!import.meta.client || !Capacitor.isNativePlatform()) {
    return
  }

  if (to.path === '/' || to.path.startsWith('/admin')) {
    return navigateTo('/mobile', { replace: true })
  }
})
