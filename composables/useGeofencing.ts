// composables/useGeofencing.ts
import type { GeofenceResult } from '~/types'
import type { GeoPositionLike } from '~/composables/useGeoProvider'

export function useGeofencing() {
  const config = useRuntimeConfig()
  const maxRadius = config.public.geofenceRadius as number || 200 // TODO confirmer client (valeur réunion : 200 m)
  const minAccuracy = config.public.gpsMinAccuracy as number || 10

  const geo = useGeoProvider()

  const isChecking = ref(false)
  const lastResult = ref<GeofenceResult | null>(null)
  const error = ref<string | null>(null)
  const stopWatcher = ref<(() => void) | null>(null)
  // Le watch natif s'installe de façon asynchrone : la génération évite
  // qu'un stopWatching() appelé entre-temps laisse fuiter le watcher.
  let watchGeneration = 0

  /**
   * Calculate distance between two GPS points using Haversine formula
   */
  function haversineDistance(
    lat1: number, lng1: number,
    lat2: number, lng2: number
  ): number {
    const R = 6371000 // Earth radius in meters
    const dLat = (lat2 - lat1) * (Math.PI / 180)
    const dLng = (lng2 - lng1) * (Math.PI / 180)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  /**
   * Get current position with promise wrapper (natif ou web via useGeoProvider)
   */
  function getCurrentPosition(): Promise<GeoPositionLike> {
    return geo.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    })
  }

  /**
   * Validate if user is within geofence radius of a PDV
   */
  async function validateGeofence(
    pdvLat: number,
    pdvLng: number,
    radius?: number
  ): Promise<GeofenceResult> {
    isChecking.value = true
    error.value = null

    try {
      const position = await getCurrentPosition()
      const userLat = position.coords.latitude
      const userLng = position.coords.longitude
      const accuracy = position.coords.accuracy

      if (minAccuracy > 0 && accuracy > minAccuracy) {
        throw new Error(`Précision GPS insuffisante (${Math.round(accuracy)} m). Attendez une meilleure précision.`)
      }

      const distance = haversineDistance(userLat, userLng, pdvLat, pdvLng)
      const effectiveRadius = radius || maxRadius

      const result: GeofenceResult = {
        isWithinRange: distance <= effectiveRadius,
        distance: Math.round(distance),
        accuracy: Math.round(accuracy),
        userPosition: { lat: userLat, lng: userLng },
        pdvPosition: { lat: pdvLat, lng: pdvLng },
      }

      lastResult.value = result
      return result
    }
    catch (err: any) {
      let message = 'Erreur de géolocalisation'
      if (err.code === 1) message = 'Accès à la géolocalisation refusé. Veuillez activer le GPS.'
      else if (err.code === 2) message = 'Position indisponible. Vérifiez votre GPS.'
      else if (err.code === 3) message = 'Délai d\'attente GPS dépassé. Réessayez.'

      error.value = message
      throw new Error(message)
    }
    finally {
      isChecking.value = false
    }
  }

  /**
   * Start watching position continuously
   */
  function startWatching(
    pdvLat: number,
    pdvLng: number,
    callback?: (result: GeofenceResult) => void
  ) {
    stopWatching()
    const generation = watchGeneration

    void geo.watchPosition(
      (position) => {
        const distance = haversineDistance(
          position.coords.latitude,
          position.coords.longitude,
          pdvLat,
          pdvLng
        )

        const result: GeofenceResult = {
          isWithinRange: distance <= maxRadius,
          distance: Math.round(distance),
          accuracy: Math.round(position.coords.accuracy),
          userPosition: { lat: position.coords.latitude, lng: position.coords.longitude },
          pdvPosition: { lat: pdvLat, lng: pdvLng },
        }

        lastResult.value = result
        callback?.(result)
      },
      (err) => {
        error.value = `Erreur GPS: ${err.message}`
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    ).then((cleanup) => {
      if (generation !== watchGeneration) {
        cleanup()
        return
      }
      stopWatcher.value = cleanup
    })
  }

  /**
   * Stop watching position
   */
  function stopWatching() {
    watchGeneration++
    if (stopWatcher.value) {
      stopWatcher.value()
      stopWatcher.value = null
    }
  }

  /**
   * Simple position grab for form submission
   */
  async function grabPosition() {
    try {
      const position = await getCurrentPosition()
      if (minAccuracy > 0 && position.coords.accuracy > minAccuracy) {
        error.value = `Précision GPS insuffisante (${Math.round(position.coords.accuracy)} m).`
      }
      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }
    }
    catch {
      return null
    }
  }

  onUnmounted(() => {
    stopWatching()
  })

  return {
    isChecking,
    lastResult,
    error,
    maxRadius,
    validateGeofence,
    startWatching,
    stopWatching,
    grabPosition,
    haversineDistance,
  }
}
