import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'

// Comportement natif de base : bouton retour Android et status bar.
export default defineNuxtPlugin(() => {
  if (!Capacitor.isNativePlatform()) {
    return
  }

  const router = useRouter()

  void App.addListener('backButton', ({ canGoBack }) => {
    const path = router.currentRoute.value.path

    if (path === '/mobile' || path === '/login' || !canGoBack) {
      void App.minimizeApp()
    }
    else {
      router.back()
    }
  })

  void StatusBar.setOverlaysWebView({ overlay: false })
  void StatusBar.setBackgroundColor({ color: '#0F172A' })
  // Style.Dark = fond sombre, icônes claires (lisible sur le rouge Friesland).
  void StatusBar.setStyle({ style: Style.Dark })
})
