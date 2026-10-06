import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'

// Paramètres terrain (composables/useParametresApp.ts) : relus à la connexion
// et à chaque retour de l'app au premier plan, comme la version minimale.
export default defineNuxtPlugin(() => {
  const { charger, chargerCache } = useParametresApp()
  const utilisateur = useSupabaseUser()
  void chargerCache()
  watch(utilisateur, (u) => { if (u?.id) void charger() }, { immediate: true })
  if (Capacitor.isNativePlatform()) {
    void App.addListener('appStateChange', ({ isActive }) => {
      if (isActive && utilisateur.value?.id) void charger()
    })
  }
})
