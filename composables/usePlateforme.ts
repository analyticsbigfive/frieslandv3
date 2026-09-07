// composables/usePlateforme.ts
// Distingue l'APK Capacitor du web. Une seule question, posée au même endroit
// que middleware/native-scope.global.ts:6 et composables/useLocationDisclosure.ts:21.
//
// Pourquoi un composable et non un `utils/` : vitest tourne en
// `environment: 'node'` sans Capacitor (vitest.config.ts). Un
// `import { Capacitor }` au niveau module dans `utils/` casserait toutes les
// specs qui importent le fichier, même celles qui ne touchent pas la plateforme.
import { Capacitor } from '@capacitor/core'

export function usePlateforme() {
  // `buildNatif` est figé à la compilation (nuxt.config.ts) : il vaut déjà vrai
  // au PRÉRENDU de l'APK, donc une entrée réservée au web n'apparaît jamais,
  // même le temps d'une hydratation. Le contrôle Capacitor reste en second
  // rideau, si le bundle web venait à être chargé dans une WebView.
  const { public: config } = useRuntimeConfig()
  const estNatif = computed(
    () => !!config.buildNatif || (import.meta.client && Capacitor.isNativePlatform()),
  )
  return { estNatif }
}
