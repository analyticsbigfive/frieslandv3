// composables/useParametresApp.ts
// Paramètres terrain réglables dans l'admin (Référentiels › Application mobile
// › Paramètres terrain, table parametre_app) : geofence, précisions GPS, suivi
// de tournée, objectifs. Lus au démarrage et au retour au premier plan
// (plugins/parametres-app.client.ts), gardés hors ligne (IndexedDB).
// Sans réseau ni cache : valeurs du build (runtimeConfig.public).
import { get, set } from 'idb-keyval'

export interface ParametresApp {
  geofence_rayon_m: number
  gps_precision_min_m: number
  gps_precision_pdv_max_m: number
  gps_precision_tournee_max_m: number
  tracking_intervalle_s: number
  tracking_distance_m: number
  tracking_envoi_s: number
  tracking_lot_max: number
  /** null : objectif = nombre de PDV de la tournée du jour (merchandisers Atom). */
  objectif_visites_jour: number | null
}

const CLE_CACHE = 'offline:parametres'
const nombre = (v: unknown, defaut: number) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : defaut)

/** Valeurs du build, utilisées tant que la base n'a pas répondu. */
export function parametresParDefaut(pub: Record<string, any> = {}): ParametresApp {
  return {
    geofence_rayon_m: nombre(pub.geofenceRadius, 200),
    gps_precision_min_m: nombre(pub.gpsMinAccuracy, 10),
    gps_precision_pdv_max_m: nombre(pub.gpsPdvPrecisionMax, 30),
    gps_precision_tournee_max_m: 50,
    tracking_intervalle_s: nombre(pub.trackingIntervalMs, 120_000) / 1000,
    tracking_distance_m: nombre(pub.trackingDistanceM, 15),
    tracking_envoi_s: nombre(pub.trackingFlushMs, 300_000) / 1000,
    tracking_lot_max: nombre(pub.trackingBatchMax, 200),
    objectif_visites_jour: 10,
  }
}

/** Valeurs lues en base par-dessus les valeurs par défaut (null gardé pour l'objectif). */
export function fusionnerParametres(defauts: ParametresApp, valeurs: Record<string, number | null> | null): ParametresApp {
  const out: ParametresApp = { ...defauts }
  for (const [cle, v] of Object.entries(valeurs || {})) {
    if (!(cle in out)) continue
    if (v == null) { if (cle === 'objectif_visites_jour') out.objectif_visites_jour = null; continue }
    if (Number.isFinite(Number(v))) (out as any)[cle] = Number(v)
  }
  return out
}

export function useParametresApp() {
  const config = useRuntimeConfig()
  const valeurs = useState<Record<string, number | null> | null>('parametres-app', () => null)
  const parametres = computed(() => fusionnerParametres(parametresParDefaut(config.public as any), valeurs.value))

  /** Cache hors ligne d'abord (démarrage sans réseau), puis la base. */
  async function chargerCache() {
    if (!import.meta.client || valeurs.value) return
    try {
      const cache = await get<Record<string, number | null>>(CLE_CACHE)
      if (cache && !valeurs.value) valeurs.value = cache
    }
    catch { /* IndexedDB indisponible : valeurs du build */ }
  }

  async function charger() {
    if (!import.meta.client) return
    await chargerCache()
    try {
      const supabase = useSupabaseClient()
      const { data, error } = await (supabase.rpc as any)('parametres_app')
      if (error) return
      const lus: Record<string, number | null> = {}
      for (const r of (data || []) as { cle: string, valeur: number | string | null }[]) lus[r.cle] = r.valeur == null ? null : Number(r.valeur)
      valeurs.value = lus
      await set(CLE_CACHE, lus).catch(() => {})
    }
    catch { /* hors ligne : le cache reste en place */ }
  }

  return { parametres, charger, chargerCache }
}
