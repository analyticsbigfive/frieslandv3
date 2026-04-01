// composables/useRouting.ts
import type { RoutingPDV } from '~/types'

export function useRouting() {
  const routingStore = useRoutingStore()
  const { validateGeofence, grabPosition } = useGeofencing()
  const toast = useToast()

  const isValidating = ref(false)
  const validationError = ref<string | null>(null)

  /**
   * Validate geofencing and start a routing PDV mission.
   * Returns true if started successfully, false if blocked.
   */
  async function startMission(routingPdv: RoutingPDV): Promise<boolean> {
    if (!routingPdv.pdv?.geolocation_lat || !routingPdv.pdv?.geolocation_lng) {
      // No GPS on PDV - allow without geofence
      await routingStore.updateRoutingPDVStatus(routingPdv.id, 'in_progress')
      return true
    }

    isValidating.value = true
    validationError.value = null

    try {
      const radius = routingPdv.pdv.rayon_geofence || 300
      const result = await validateGeofence(
        routingPdv.pdv.geolocation_lat,
        routingPdv.pdv.geolocation_lng,
        radius
      )

      if (result.isWithinRange) {
        await routingStore.updateRoutingPDVStatus(routingPdv.id, 'in_progress', {
          geofence_validated: true,
          geolocation_lat: result.userPosition.lat,
          geolocation_lng: result.userPosition.lng,
          precision_gps: result.accuracy,
        })
        return true
      } else {
        validationError.value =
          `Vous êtes à ${result.distance}m du PDV (max: ${radius}m). Rapprochez-vous pour démarrer la mission.`
        toast.add({
          title: 'Hors zone',
          description: validationError.value,
          color: 'red',
          icon: 'i-heroicons-map-pin',
        })
        return false
      }
    } catch (err: any) {
      validationError.value = err.message || 'Erreur de géolocalisation'
      toast.add({
        title: 'Erreur GPS',
        description: validationError.value!,
        color: 'red',
      })
      return false
    } finally {
      isValidating.value = false
    }
  }

  /**
   * Complete a routing PDV mission (after visite is saved).
   */
  async function completeMission(
    routingPdv: RoutingPDV,
    visiteId?: string,
    notes?: string
  ) {
    const position = await grabPosition()

    await routingStore.updateRoutingPDVStatus(routingPdv.id, 'completed', {
      visite_id: visiteId,
      result_notes: notes,
      geolocation_lat: position?.lat,
      geolocation_lng: position?.lng,
      precision_gps: position?.accuracy,
    })
  }

  /**
   * Skip a routing PDV (with reason).
   */
  async function skipMission(routingPdv: RoutingPDV, reason?: string) {
    await routingStore.updateRoutingPDVStatus(routingPdv.id, 'skipped', {
      result_notes: reason || 'Passé',
    })
  }

  /**
   * Check if user is near a PDV (non-blocking, just returns distance).
   */
  async function checkProximity(lat: number, lng: number, radius?: number) {
    try {
      return await validateGeofence(lat, lng, radius)
    } catch {
      return null
    }
  }

  return {
    isValidating,
    validationError,
    startMission,
    completeMission,
    skipMission,
    checkProximity,
  }
}
