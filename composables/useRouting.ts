// composables/useRouting.ts
import type { RoutingPDV } from '~/types'

export function useRouting() {
  const routingStore = useRoutingStore()
  const { validateGeofence, grabPosition } = useGeofencing()
  const toast = useToast()
  const supabase = useSupabaseClient()
  const config = useRuntimeConfig()
  const precisionMaxPdv = Number(config.public.gpsPdvPrecisionMax) || 30

  const isValidating = ref(false)
  const validationError = ref<string | null>(null)

  /**
   * Enregistre `position` comme coordonnées d'un PDV qui n'en a pas (import DMS
   * sans GPS). La RPC geolocaliser_pdv refuse d'écraser une position existante,
   * un PDV hors périmètre ou une précision au-delà de 30 m. Jamais bloquant :
   * en cas d'échec, on réessaiera à la prochaine visite.
   */
  async function geolocaliserPdv(
    pdvId: string,
    position: { lat: number; lng: number; accuracy: number } | null,
  ): Promise<boolean> {
    if (!position) {
      toast.add({ title: 'Position du PDV non enregistrée', description: 'GPS indisponible. Elle le sera à la prochaine visite.', color: 'amber', icon: 'i-heroicons-map-pin' })
      return false
    }
    const precision = Math.round(position.accuracy)
    if (precision > precisionMaxPdv) {
      toast.add({
        title: 'Position du PDV non enregistrée',
        description: `Précision ${precision} m (${precisionMaxPdv} m maximum). Elle le sera à la prochaine visite.`,
        color: 'amber',
        icon: 'i-heroicons-map-pin',
      })
      return false
    }
    const { data, error } = await (supabase.rpc as any)('geolocaliser_pdv', {
      p_pdv_id: pdvId,
      p_lat: position.lat,
      p_lng: position.lng,
      p_precision: precision,
    })
    if (error || !data) {
      if (error) console.warn('[Routing] geolocaliser_pdv', error.message)
      return false
    }
    toast.add({ title: 'Position du PDV enregistrée', description: `Précision ${precision} m.`, color: 'green', icon: 'i-heroicons-map-pin' })
    return true
  }

  /**
   * Validate geofencing and start a routing PDV mission.
   * Returns true if started successfully, false if blocked.
   */
  async function startMission(routingPdv: RoutingPDV): Promise<boolean> {
    if (!routingPdv.pdv?.geolocation_lat || !routingPdv.pdv?.geolocation_lng) {
      // PDV sans GPS : pas de géofence possible. On relève la position du
      // merchandiser, qui devient celle du PDV si elle est assez précise.
      isValidating.value = true
      try {
        const position = await grabPosition()
        if (await geolocaliserPdv(routingPdv.pdv_id, position) && routingPdv.pdv && position) {
          routingPdv.pdv.geolocation_lat = position.lat
          routingPdv.pdv.geolocation_lng = position.lng
        }
        await routingStore.updateRoutingPDVStatus(routingPdv.id, 'in_progress', position
          ? { geolocation_lat: position.lat, geolocation_lng: position.lng, precision_gps: position.accuracy }
          : undefined)
      }
      finally {
        isValidating.value = false
      }
      return true
    }

    isValidating.value = true
    validationError.value = null

    try {
      const radius = routingPdv.pdv.rayon_geofence || 200
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
    geolocaliserPdv,
  }
}
