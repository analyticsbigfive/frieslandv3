// composables/useRouting.ts
import type { RoutingPDV } from '~/types'

export function useRouting() {
  const routingStore = useRoutingStore()
  const { validateGeofence, grabPosition } = useGeofencing()
  const toast = useToast()
  const supabase = useSupabaseClient()
  const { parametres } = useParametresApp()

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
    const precisionMaxPdv = parametres.value.gps_precision_pdv_max_m
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
   * Démarre l'étape d'un PDV de la tournée. Retourne false si bloqué.
   * Règle du 22/10/2026 : tant que le PDV n'a pas de repère (première visite),
   * pas de contrôle de distance ; la visite fixera sa position. Ensuite la
   * tablette doit être dans le rayon du repère, sans « démarrer quand même ».
   */
  async function startMission(routingPdv: RoutingPDV): Promise<boolean> {
    const repere = repereDuPdv(routingPdv.pdv)
    if (!repere) {
      // Première visite : on relève la position du merchandiser. Un PDV sans
      // GPS la prend tout de suite ; sinon la visite enregistrée la fixera.
      isValidating.value = true
      validationError.value = null
      try {
        const position = await grabPosition()
        if (routingPdv.pdv && !routingPdv.pdv.geolocation_lat
          && await geolocaliserPdv(routingPdv.pdv_id, position) && position) {
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
      const pdv = routingPdv.pdv!
      const radius = pdv.rayon_geofence || parametres.value.geofence_rayon_m
      const result = await validateGeofence(pdv.geolocation_lat, pdv.geolocation_lng, radius)

      if (result.isWithinRange) {
        await routingStore.updateRoutingPDVStatus(routingPdv.id, 'in_progress', {
          geofence_validated: true,
          geolocation_lat: result.userPosition.lat,
          geolocation_lng: result.userPosition.lng,
          precision_gps: result.accuracy,
        })
        return true
      }
      validationError.value
        = `Vous êtes à ${result.distance} m de ce PDV, ${texteRepere(pdv)} (maximum ${radius} m). Rapprochez-vous puis réessayez.`
      return false
    }
    catch (err: any) {
      validationError.value = err.message || 'Erreur de géolocalisation'
      return false
    }
    finally {
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
