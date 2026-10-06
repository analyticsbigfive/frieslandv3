import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'

// Catalogue des produits du formulaire (composables/useCatalogueReleve.ts) :
// relu à la connexion et à chaque retour de l'app au premier plan. Le web
// admin et le téléphone affichent ainsi les produits gérés dans
// Paramètres › Produits du formulaire, et le téléphone les garde hors ligne.
export default defineNuxtPlugin(() => {
  const { charger } = useCatalogueReleve()
  const utilisateur = useSupabaseUser()
  watch(utilisateur, (u) => { if (u?.id) void charger(true) }, { immediate: true })
  if (Capacitor.isNativePlatform()) {
    void App.addListener('appStateChange', ({ isActive }) => {
      if (isActive && utilisateur.value?.id) void charger(true)
    })
  }
})
