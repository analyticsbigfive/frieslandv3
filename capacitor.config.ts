import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.fieldtrack.app',
  appName: 'FieldTrack',
  webDir: '.output/public',
  android: {
    allowMixedContent: false,
  },
}

export default config
