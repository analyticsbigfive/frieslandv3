// composables/useRouting.ts
import type { RoutingPDV } from '~/types'
import { haversine } from '~/utils/trajets'

export function useRouting() {
  const routingStore = useRoutingStore()
  const { validateGeofence, grabPosition } = useGeofencing()
  const { exigerPosition } = useGpsVisite()
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
   * 1.0.17 (29/10/2026) : pas de position, pas de visite. Sans position assez
   * précise, l'écran d'aide GPS (useGpsVisite) dit pourquoi et propose
   * « Réessayer » ; validationError reste vide, il n'y a rien à ajouter. La
   * distance au repère ne bloque plus : « Êtes-vous bien devant… ? » est
   * demandé à l'enregistrement de la visite.
   */
  async function startMission(routingPdv: RoutingPDV): Promise<boolean> {
    isValidating.value = true
    validationError.value = null
    try {
      const position = await exigerPosition()
      if (!position) return false

      // PDV sans GPS : la position prise devient la sienne.
      if (routingPdv.pdv && !routingPdv.pdv.geolocation_lat
        && await geolocaliserPdv(routingPdv.pdv_id, position)) {
        routingPdv.pdv.geolocation_lat = position.lat
        routingPdv.pdv.geolocation_lng = position.lng
      }

      const pdv = routingPdv.pdv
      const repere = repereDuPdv(pdv)
      const rayon = pdv?.rayon_geofence || parametres.value.geofence_rayon_m
      await routingStore.updateRoutingPDVStatus(routingPdv.id, 'in_progress', {
        geolocation_lat: position.lat,
        geolocation_lng: position.lng,
        precision_gps: Math.round(position.accuracy),
        ...(repere && pdv
          ? { geofence_validated: haversine(position.lat, position.lng, pdv.geolocation_lat, pdv.geolocation_lng) <= rayon }
          : {}),
      })
      return true
    }
    catch (err: any) {
      validationError.value = err.message || 'Impossible de démarrer ce PDV.'
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
