import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'

// Comportement natif de base : bouton retour Android et status bar.
export default defineNuxtPlugin(() => {
  if (!Capacitor.isNativePlatform()) {
    return
  }

  const router = useRouter()
  const { processQueue } = useOfflineSync()

  void App.addListener('backButton', ({ canGoBack }) => {
    const path = router.currentRoute.value.path

    if (path === '/mobile' || path === '/login' || !canGoBack) {
      void App.minimizeApp()
    }
    else {
      router.back()
    }
  })

  // Reprendre automatiquement les envois suspendus quand l’application revient au premier plan.
  void App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) void processQueue()
  })

  // Android 15+/targetSdk 36 : la barre de statut est transparente et bord à bord,
  // setBackgroundColor / setOverlaysWebView sont sans effet. Capacitor décale la
  // WebView (adjustMarginsForEdgeToEdge: 'force') et la bande derrière la barre
  // prend windowBackground (gray-50 le jour, gray-900 la nuit, cf. styles.xml) :
  // on aligne la couleur des icônes sur ce fond.
  // Style.Light = icônes sombres sur fond clair ; Style.Dark = icônes claires.
  const sombre = window.matchMedia?.('(prefers-color-scheme: dark)')
  const appliquerStyleBarre = () => {
    void StatusBar.setStyle({ style: sombre?.matches ? Style.Dark : Style.Light })
  }
  appliquerStyleBarre()
  sombre?.addEventListener?.('change', appliquerStyleBarre)
})
