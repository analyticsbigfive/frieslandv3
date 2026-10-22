// utils/repereGps.ts
// Repère du PDV (22/10/2026, décision de Jean Luc) : la première visite d'un
// PDV passe sans contrôle de distance et fixe sa position (déclencheur
// pdv_gps_depuis_visite, gps_source = 'terrain') ; l'admin peut la corriger
// (gps_source = 'admin'). Ensuite la tablette doit être dans le rayon de ce
// repère, sans « soumettre quand même ». Voir
// supabase/nouveau/20261022100000_friesland_gps_premiere_visite.sql.

export type PdvPosition = {
  geolocation_lat?: number | null
  geolocation_lng?: number | null
  gps_source?: string | null
  gps_maj_le?: string | null
} | null | undefined

export type RepereGps = 'terrain' | 'admin'

export type GpsVisite = {
  motif?: 'precision'
  precision_m?: number | null
  precision_exigee_m?: number | null
  repere?: 'premiere_visite' | RepereGps
  distance_m?: number | null
  rayon_m?: number | null
}

/** Repère du PDV, ou null tant qu'aucune visite (ni l'admin) ne l'a fixé. */
export function repereDuPdv(pdv: PdvPosition): RepereGps | null {
  if (!pdv?.geolocation_lat || !pdv?.geolocation_lng) return null
  return pdv.gps_source === 'terrain' || pdv.gps_source === 'admin' ? pdv.gps_source : null
}

/** « repéré sur place le 21/10 » ou « placé par l'administrateur ». */
export function texteRepere(pdv: PdvPosition): string {
  if (repereDuPdv(pdv) === 'admin') return 'placé par l\'administrateur'
  const le = pdv?.gps_maj_le ? new Date(pdv.gps_maj_le).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : ''
  return le ? `repéré sur place le ${le}` : 'repéré sur place'
}

export type DecisionGps =
  | { action: 'trop_loin', distance_m: number, rayon_m: number }
  | { action: 'imprecis', precision_m: number, seuil_m: number }
  | { action: 'enregistrer', geofenceOk: boolean, gps: GpsVisite }

/**
 * Ce que fait le formulaire de visite avec la position relevée.
 * - PDV repéré : précision au-delà du seuil → réessayer ; au-delà du rayon →
 *   bloqué (réessayer une fois sur place) ; sinon enregistrée « dans le rayon ».
 * - Première visite : toujours enregistrée ; « dans le rayon » si la position
 *   est assez précise pour devenir le repère du PDV.
 */
export function decisionGpsVisite(p: {
  repere: RepereGps | null
  distance_m: number | null
  precision_m: number
  rayon_m: number
  seuil_m: number
  precision_pdv_max_m: number
}): DecisionGps {
  if (p.repere) {
    if (p.seuil_m > 0 && p.precision_m > p.seuil_m) {
      return { action: 'imprecis', precision_m: p.precision_m, seuil_m: p.seuil_m }
    }
    if (p.distance_m != null && p.distance_m > p.rayon_m) {
      return { action: 'trop_loin', distance_m: p.distance_m, rayon_m: p.rayon_m }
    }
    return {
      action: 'enregistrer',
      geofenceOk: true,
      gps: { repere: p.repere, distance_m: p.distance_m, rayon_m: p.rayon_m, precision_m: p.precision_m },
    }
  }
  const assezPrecis = p.precision_m <= p.precision_pdv_max_m
  return {
    action: 'enregistrer',
    geofenceOk: assezPrecis,
    gps: assezPrecis
      ? { repere: 'premiere_visite', distance_m: p.distance_m, precision_m: p.precision_m }
      : { repere: 'premiere_visite', motif: 'precision', distance_m: p.distance_m, precision_m: p.precision_m, precision_exigee_m: p.precision_pdv_max_m },
  }
}
