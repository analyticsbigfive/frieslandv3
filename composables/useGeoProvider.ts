// composables/useGeoProvider.ts
import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'

// Adapter de plateforme : @capacitor/geolocation en natif (Android),
// navigator.geolocation sur le web. Les formes de retour sont alignées
// sur l'API web (position.coords.latitude…) pour que les composables
// existants restent inchangés.

export interface GeoPositionLike {
  coords: {
    latitude: number
    longitude: number
    accuracy: number
    altitude?: number | null
    speed?: number | null
    heading?: number | null
  }
  timestamp: number
}

export interface GeoOptions {
  enableHighAccuracy?: boolean
  timeout?: number
  maximumAge?: number
}

export type GeoError = Error & { code?: number }

// Aligne les erreurs natives sur les codes GeolocationPositionError web
// (1 = refusé, 2 = indisponible, 3 = timeout) pour préserver les messages
// utilisateur existants.
function toCodedError(err: unknown): GeoError {
  const source = err as { message?: string, code?: number | string } | undefined
  const message = source?.message || String(err)
  const error = new Error(message) as GeoError

  if (typeof source?.code === 'number') {
    error.code = source.code
  }
  else if (/denied|refus/i.test(message)) {
    error.code = 1
  }
  else if (/unavailable|disabled|indisponible/i.test(message)) {
    error.code = 2
  }
  else if (/timed? ?out|expir/i.test(message)) {
    error.code = 3
  }

  return error
}

function normalizePermission(state: string): PermissionState {
  // Capacitor renvoie aussi 'prompt-with-rationale'.
  return (state === 'granted' || state === 'denied' ? state : 'prompt') as PermissionState
}

export function useGeoProvider() {
  const isNative = import.meta.client && Capacitor.isNativePlatform()

  async function getCurrentPosition(options: GeoOptions = {}): Promise<GeoPositionLike> {
    const opts = {
      enableHighAccuracy: options.enableHighAccuracy ?? true,
      timeout: options.timeout ?? 15000,
      maximumAge: options.maximumAge ?? 0,
    }

    if (isNative) {
      try {
        return await Geolocation.getCurrentPosition(opts)
      }
      catch (err) {
        throw toCodedError(err)
      }
    }

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(toCodedError(new Error('La géolocalisation n\'est pas supportée par votre navigateur')))
        return
      }

      navigator.geolocation.getCurrentPosition(resolve, err => reject(toCodedError(err)), opts)
    })
  }

  // Retourne une fonction de nettoyage (masque clearWatch web vs natif).
  async function watchPosition(
    onPosition: (position: GeoPositionLike) => void,
    onError?: (err: GeoError) => void,
    options: GeoOptions = {},
  ): Promise<() => void> {
    const opts = {
      enableHighAccuracy: options.enableHighAccuracy ?? true,
      timeout: options.timeout ?? 10000,
      maximumAge: options.maximumAge ?? 5000,
    }

    if (isNative) {
      const id = await Geolocation.watchPosition(opts, (position, err) => {
        if (err) {
          onError?.(toCodedError(err))
          return
        }
        if (position) {
          onPosition(position)
        }
      })
      return () => {
        void Geolocation.clearWatch({ id })
      }
    }

    if (!navigator.geolocation) {
      onError?.(toCodedError(new Error('La géolocalisation n\'est pas supportée par votre navigateur')))
      return () => {}
    }

    const id = navigator.geolocation.watchPosition(
      onPosition,
      err => onError?.(toCodedError(err)),
      opts,
    )
    return () => navigator.geolocation.clearWatch(id)
  }

  async function checkPermission(): Promise<PermissionState | null> {
    if (isNative) {
      try {
        const status = await Geolocation.checkPermissions()
        return normalizePermission(status.location)
      }
      catch {
        return null
      }
    }

    if (!import.meta.client || !navigator.permissions?.query) {
      return null
    }

    try {
      const result = await navigator.permissions.query({ name: 'geolocation' })
      return result.state
    }
    catch {
      return null
    }
  }

  async function requestPermission(): Promise<PermissionState | null> {
    if (isNative) {
      try {
        const status = await Geolocation.requestPermissions()
        return normalizePermission(status.location)
      }
      catch {
        return 'denied'
      }
    }

    // Web : le navigateur affiche son propre prompt au premier getCurrentPosition.
    return checkPermission()
  }

  return {
    isNative,
    getCurrentPosition,
    watchPosition,
    checkPermission,
    requestPermission,
  }
}
