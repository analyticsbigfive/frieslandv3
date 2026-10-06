// composables/useGeofencing.ts
import type { GeofenceResult } from '~/types'
import type { GeoPositionLike } from '~/composables/useGeoProvider'
import { haversine } from '~/utils/trajets'

export function useGeofencing() {
  // Paramètres terrain (admin) : lus à chaque appel, une modification
  // s'applique sans relancer l'app.
  const { parametres } = useParametresApp()
  const rayonDefaut = () => parametres.value.geofence_rayon_m
  const precisionMin = () => parametres.value.gps_precision_min_m

  const geo = useGeoProvider()

  const isChecking = ref(false)
  const lastResult = ref<GeofenceResult | null>(null)
  const error = ref<string | null>(null)
  const stopWatcher = ref<(() => void) | null>(null)
  // Le watch natif s'installe de façon asynchrone : la génération évite
  // qu'un stopWatching() appelé entre-temps laisse fuiter le watcher.
  let watchGeneration = 0

  // Haversine partagé (utils/trajets.ts) ; nom conservé pour les appelants.
  const haversineDistance = haversine

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

      if (precisionMin() > 0 && accuracy > precisionMin()) {
        const e: any = new Error(`Précision GPS insuffisante (${Math.round(accuracy)} m, ${precisionMin()} m demandés). Sortez à découvert ou attendez quelques secondes, puis réessayez.`)
        e.precisionInsuffisante = true
        e.precision = Math.round(accuracy)
        throw e
      }

      const distance = haversineDistance(userLat, userLng, pdvLat, pdvLng)
      const effectiveRadius = radius || rayonDefaut()

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
      // Précision insuffisante : message gardé tel quel (l'agent voit la
      // précision obtenue au lieu d'un « Erreur de géolocalisation » muet).
      if (err?.precisionInsuffisante) {
        error.value = err.message
        throw err
      }
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
          isWithinRange: distance <= rayonDefaut(),
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
      if (precisionMin() > 0 && position.coords.accuracy > precisionMin()) {
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
    get maxRadius() { return rayonDefaut() },
    validateGeofence,
    startWatching,
    stopWatching,
    grabPosition,
    haversineDistance,
  }
}
