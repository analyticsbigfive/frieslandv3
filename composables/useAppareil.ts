// composables/useAppareil.ts
// Modèle de l'appareil envoyé avec chaque visite (visites.appareil_modele,
// 1.0.17) : savoir quelles tablettes n'ont pas de puce GPS (Galaxy Tab A11
// SM-X130 = Wi-Fi seul ; SM-X135 / SM-X133 = avec GPS). Lu une fois.
import { Device } from '@capacitor/device'

let modele: Promise<string | null> | null = null

export function useAppareil() {
  function modeleAppareil(): Promise<string | null> {
    if (!import.meta.client) return Promise.resolve(null)
    if (!modele) {
      modele = Device.getInfo()
        .then(info => (info.model || '').trim().slice(0, 80) || null)
        .catch(() => null)
    }
    return modele
  }

  return { modeleAppareil }
}
