import type { GeoError, GeoPositionLike } from '~/composables/useGeoProvider'

export interface UserPosition {
  lat: number
  lng: number
  accuracy: number
  timestamp: number
}

const STORAGE_KEY = 'fc-user-position'
const POSITION_CACHE_MS = 60 * 1000
const STORAGE_TTL_MS = 24 * 60 * 60 * 1000

const currentPosition = ref<UserPosition | null>(null)
const positionError = ref<string | null>(null)
const isLocating = ref(false)
const permissionStatus = ref<PermissionState | null>(null)

let permissionQuery: Promise<PermissionStatus | null> | null = null
let permissionListenerAttached = false
let locateRequest: Promise<UserPosition | null> | null = null
let geolocationInitialized = false

function persistPosition(position: UserPosition) {
  if (!import.meta.client) {
    return
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(position))
  }
  catch {
    // Ignore storage quota errors.
  }
}

function buildPosition(coords: GeoPositionLike['coords']): UserPosition {
  return {
    lat: coords.latitude,
    lng: coords.longitude,
    accuracy: Math.round(coords.accuracy),
    timestamp: Date.now(),
  }
}

export function useUserGeolocation() {
  const geo = useGeoProvider()

  async function bindPermissionQuery(): Promise<PermissionStatus | null> {
    if (!import.meta.client) {
      return null
    }

    // Natif : pas d'API Permissions observable — lecture ponctuelle
    // via le plugin, l'état est posé directement dans permissionStatus.
    if (geo.isNative) {
      permissionStatus.value = await geo.checkPermission()
      return null
    }

    if (!navigator.permissions?.query) {
      return null
    }

    if (permissionQuery) {
      return permissionQuery
    }

    permissionQuery = navigator.permissions.query({ name: 'geolocation' })
      .then((result) => {
        permissionStatus.value = result.state

        if (!permissionListenerAttached) {
          permissionListenerAttached = true
          result.addEventListener('change', () => {
            permissionStatus.value = result.state

            if (result.state === 'granted' && !currentPosition.value) {
              void requestPosition()
            }
          })
        }

        return result
      })
      .catch(() => null)

    return permissionQuery
  }

  async function requestPosition(force = false): Promise<UserPosition | null> {
    if (!import.meta.client) {
      return null
    }

    if (!force && currentPosition.value && Date.now() - currentPosition.value.timestamp < POSITION_CACHE_MS) {
      return currentPosition.value
    }

    if (!force && locateRequest) {
      return locateRequest
    }

    isLocating.value = true
    positionError.value = null

    locateRequest = geo.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: POSITION_CACHE_MS,
    })
      .then((position) => {
        const nextPosition = buildPosition(position.coords)
        currentPosition.value = nextPosition
        positionError.value = null
        persistPosition(nextPosition)
        return nextPosition as UserPosition | null
      })
      .catch((err: GeoError) => {
        let message = 'Erreur de geolocalisation'
        if (err.code === 1) message = 'Acces a la geolocalisation refuse. Veuillez activer le GPS dans les parametres.'
        else if (err.code === 2) message = 'Position indisponible. Verifiez que le GPS est active.'
        else if (err.code === 3) message = 'Delai d\'attente GPS depasse. Reessayez.'

        positionError.value = message
        console.warn('[Geolocation]', message)
        return null
      })
      .finally(() => {
        isLocating.value = false
        locateRequest = null
      })

    return locateRequest
  }

  async function checkPermission(): Promise<PermissionState | null> {
    const result = await bindPermissionQuery()
    // Web : état porté par le PermissionStatus ; natif : posé par bindPermissionQuery.
    return result?.state ?? permissionStatus.value ?? null
  }

  function restoreLastKnownPosition(): UserPosition | null {
    if (!import.meta.client) {
      return null
    }

    try {
      const storedPosition = localStorage.getItem(STORAGE_KEY)
      if (!storedPosition) {
        return null
      }

      const parsedPosition = JSON.parse(storedPosition) as UserPosition
      if (Date.now() - parsedPosition.timestamp < STORAGE_TTL_MS) {
        currentPosition.value = parsedPosition
        return parsedPosition
      }
    }
    catch {
      // Ignore invalid cached data.
    }

    return null
  }

  async function initialize() {
    if (!import.meta.client) {
      return
    }

    if (!geolocationInitialized) {
      geolocationInitialized = true
      restoreLastKnownPosition()
      await checkPermission()
    }

    if (permissionStatus.value !== 'denied') {
      await requestPosition()
    }
  }

  function clearPosition() {
    currentPosition.value = null
    positionError.value = null

    if (import.meta.client) {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  return {
    currentPosition: readonly(currentPosition),
    positionError: readonly(positionError),
    isLocating: readonly(isLocating),
    permissionStatus: readonly(permissionStatus),
    requestPosition,
    checkPermission,
    initialize,
    clearPosition,
    restoreLastKnownPosition,
  }
}
