import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.bdco.bonnetrouge',
  appName: 'Friesland Bonnet Rouge',
  webDir: '.output/public',
  android: {
    allowMixedContent: false,
    // Android 16 (targetSdk 36) impose l'affichage bord à bord : Capacitor
    // ajoute les marges de la barre de statut / navigation à la WebView.
    adjustMarginsForEdgeToEdge: 'auto',
  },
}

export default config
