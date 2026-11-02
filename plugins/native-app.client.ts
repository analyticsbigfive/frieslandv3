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
  // On en profite pour rafraîchir le compteur d'actions assignées : le
  // WebSocket Realtime est coupé pendant la mise en veille, le badge resterait
  // sinon figé sur la valeur d'avant la pause.
  const { compterActionsOuvertes } = useActionsCommerciales()
  void App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) {
      void processQueue()
      void compterActionsOuvertes()
    }
  })

  // Notifications push : l'app fermée, le Realtime ne tourne plus. FCM prend le
  // relais pour les actions assignées. L'enregistrement demande une session :
  // au premier lancement l'utilisateur n'est pas encore connecté, d'où le watch.
  const { initialiser } = usePushNotifications()
  const utilisateur = useSupabaseUser()
  if (utilisateur.value?.id) void initialiser()
  watch(utilisateur, (u) => { if (u?.id) void initialiser() })

  // Android 15+/targetSdk 36 : la barre de statut est transparente et bord à bord,
  // setBackgroundColor / setOverlaysWebView sont sans effet. Capacitor décale la
  // WebView (adjustMarginsForEdgeToEdge: 'force') et la bande derrière la barre
  // prend windowBackground : le rouge de l'en-tête, jour et nuit
  // (drawable/edge_to_edge_background.xml). Icônes claires sur ce rouge.
  // Style.Dark = icônes claires.
  void StatusBar.setStyle({ style: Style.Dark })
})
