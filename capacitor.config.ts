import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.bdco.bonnetrouge',
  appName: 'Friesland Bonnet Rouge',
  webDir: '.output/public',
  android: {
    allowMixedContent: false,
  },
}

export default config
