import { Capacitor } from '@capacitor/core'
import { Network } from '@capacitor/network'

// Les événements window.online/offline sont peu fiables dans la WebView
// Android : on aligne l'état de la queue offline sur @capacitor/network,
// qui écoute la connectivité au niveau du système.
export default defineNuxtPlugin(async () => {
  if (!Capacitor.isNativePlatform()) {
    return
  }

  const { isOnline, processQueue } = useOfflineSync()

  const status = await Network.getStatus()
  isOnline.value = status.connected

  void Network.addListener('networkStatusChange', (change) => {
    isOnline.value = change.connected

    if (change.connected) {
      void processQueue()
    }
  })
})
