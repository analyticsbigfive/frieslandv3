// composables/useGeofencing.ts
import type { GeofenceResult } from '~/types'

export function useGeofencing() {
  const config = useRuntimeConfig()
  const maxRadius = config.public.geofenceRadius as number || 300
  const minAccuracy = config.public.gpsMinAccuracy as number || 10

  const isChecking = ref(false)
  const lastResult = ref<GeofenceResult | null>(null)
  const error = ref<string | null>(null)
  const watchId = ref<number | null>(null)

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
   * Get current position with promise wrapper
   */
  function getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('La géolocalisation n\'est pas supportée par votre navigateur'))
        return
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      })
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
    if (!navigator.geolocation) return

    watchId.value = navigator.geolocation.watchPosition(
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
    )
  }

  /**
   * Stop watching position
   */
  function stopWatching() {
    if (watchId.value !== null) {
      navigator.geolocation.clearWatch(watchId.value)
      watchId.value = null
    }
  }

  /**
   * Simple position grab for form submission
   */
  async function grabPosition() {
    try {
      const position = await getCurrentPosition()
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
