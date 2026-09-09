// composables/useLocationHardware.ts
import { Capacitor, registerPlugin } from '@capacitor/core'

// Pont vers DeviceLocationPlugin.java (plugin local du projet Android).
//
// Une tablette sans puce GPS — typiquement une Samsung Galaxy Tab A en version
// Wi-Fi — ne produira jamais de position satellitaire, quelles que soient les
// permissions accordées. Distinguer ce cas d'un GPS simplement désactivé ou
// refusé évite deux erreurs : bloquer l'enregistrement d'une visite sur un
// appareil qui ne pourra jamais fournir de position, et afficher « Activez la
// localisation », conseil inapplicable qui envoie le commercial dans les
// réglages pour rien.

interface DeviceLocationPlugin {
  hasLocationHardware(): Promise<{ gps: boolean, network: boolean, any: boolean }>
}

const DeviceLocation = registerPlugin<DeviceLocationPlugin>('DeviceLocation')

// Le matériel ne change pas en cours de session : sonde une seule fois, à
// l'échelle du module, et partage le résultat entre tous les appelants.
const hasGps = ref(true)
const hasNetworkLocation = ref(true)
const probed = ref(false)
let probe: Promise<void> | null = null

export function useLocationHardware() {
  const isNative = import.meta.client && Capacitor.isNativePlatform()

  // Par défaut `true` partout : sur le web, et si la sonde échoue (APK plus
  // ancien que le plugin), on conserve exactement le comportement historique.
  async function ensureProbed(): Promise<void> {
    if (probed.value || !isNative) {
      return
    }
    if (!probe) {
      probe = DeviceLocation.hasLocationHardware()
        .then((result) => {
          hasGps.value = result.gps
          hasNetworkLocation.value = result.network
        })
        .catch(() => {})
        .finally(() => {
          probed.value = true
        })
    }
    await probe
  }

  return { isNative, hasGps, hasNetworkLocation, probed, ensureProbed }
}
