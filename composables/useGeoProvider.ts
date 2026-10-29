// composables/useGeoProvider.ts
import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import { codeErreurGps, type PermissionGps } from '~/utils/gpsVisite'

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

export type GeoError = Error & { code?: number, nativeCode?: string }

// Aligne les erreurs natives sur les codes GeolocationPositionError web
// (1 = refusé, 2 = indisponible, 3 = timeout) pour préserver les messages
// utilisateur existants. Le plugin envoie un code texte (« OS-PLUG-GLOC-0007 »,
// localisation coupée), gardé dans nativeCode (utils/gpsVisite.ts).
function toCodedError(err: unknown): GeoError {
  const source = err as { message?: string, code?: number | string } | undefined
  const message = source?.message || String(err)
  const error = new Error(message) as GeoError

  const code = codeErreurGps(source)
  if (code) {
    error.code = code
  }
  if (typeof source?.code === 'string') {
    error.nativeCode = source.code
  }

  return error
}

function normalizePermission(state: string): PermissionState {
  // Capacitor renvoie aussi 'prompt-with-rationale'.
  return (state === 'granted' || state === 'denied' ? state : 'prompt') as PermissionState
}

export function useGeoProvider() {
  const isNative = import.meta.client && Capacitor.isNativePlatform()
  const { ensureDisclosure } = useLocationDisclosure()

  // Google Play (divulgation bien visible) : en natif, aucun prompt système
  // de localisation ne doit apparaître avant l'écran d'explication interne.
  // Renvoie false si l'utilisateur refuse l'explication (pas de prompt).
  async function disclosureBeforePrompt(): Promise<boolean> {
    if (!isNative) {
      return true
    }
    if ((await checkPermission()) === 'granted') {
      return true
    }
    return ensureDisclosure()
  }

  async function getCurrentPosition(options: GeoOptions = {}): Promise<GeoPositionLike> {
    const opts = {
      enableHighAccuracy: options.enableHighAccuracy ?? true,
      timeout: options.timeout ?? 15000,
      maximumAge: options.maximumAge ?? 0,
    }

    if (isNative) {
      if (!(await disclosureBeforePrompt())) {
        throw toCodedError(new Error('Localisation refusée'))
      }
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
      if (!(await disclosureBeforePrompt())) {
        onError?.(toCodedError(new Error('Localisation refusée')))
        return () => {}
      }
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

  /**
   * Autorisations détaillées (natif) : position exacte (`location`) et
   * approximative (`coarseLocation`). Localisation coupée : le plugin refuse
   * de répondre, l'erreur est rendue (cas A de l'aide GPS). Web : l'état du
   * navigateur, sans notion d'approximative.
   */
  async function etatPermission(demander = false): Promise<{ permission: PermissionGps, erreur?: GeoError }> {
    if (isNative) {
      if (demander && !(await disclosureBeforePrompt())) {
        return { permission: { location: 'denied' }, erreur: toCodedError(new Error('Localisation refusée')) }
      }
      try {
        const status = demander ? await Geolocation.requestPermissions() : await Geolocation.checkPermissions()
        return { permission: { location: status.location, coarseLocation: status.coarseLocation } }
      }
      catch (err) {
        return { permission: null, erreur: toCodedError(err) }
      }
    }
    return { permission: { location: await checkPermission() } }
  }

  async function requestPermission(): Promise<PermissionState | null> {
    if (isNative) {
      if (!(await disclosureBeforePrompt())) {
        return 'denied'
      }
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
    etatPermission,
  }
}
