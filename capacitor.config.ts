import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.bdco.bonnetrouge',
  appName: 'Friesland Bonnet Rouge',
  webDir: '.output/public',
  android: {
    allowMixedContent: false,
    // Android 16 (targetSdk 36) impose l'affichage bord à bord : Capacitor
    // décale la WebView sous la barre de statut et au-dessus de la barre de
    // navigation ('auto' ne suffisait pas : l'en-tête passait sous l'heure).
    // La bande derrière ces barres prend la couleur windowBackground du thème
    // (styles.xml), claire ou sombre selon le mode.
    adjustMarginsForEdgeToEdge: 'force',
  },
}

export default config
