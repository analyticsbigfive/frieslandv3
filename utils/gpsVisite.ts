// utils/gpsVisite.ts
// GPS obligatoire pour faire une visite (1.0.17, plan du 29/10/2026).
// En juillet, 407 PDV et des centaines de visites ont été enregistrés sans
// position (localisation coupée sur les Galaxy Tab A11). Désormais : pas de
// position, pas de visite. La tablette attend une position assez précise
// (« Précision GPS exigée »), sinon l'app dit pourquoi (cas A, B ou C de
// l'écran d'aide, utils/aideGpsTablette.ts). La distance au PDV ne bloque
// plus jamais : au-delà de « Distance d'alerte », l'agent confirme qu'il est
// devant le PDV, et sa position devient celle du PDV.
// Fonctions pures, testées dans tests/gpsVisite.spec.ts.
import type { GpsVisite, RepereGps } from './repereGps'

/** Pourquoi la visite ne peut pas démarrer. */
export type CauseBlocageGps =
  /** Autorisation de localisation refusée (app ou navigateur) : cas B. */
  | 'permission'
  /** Autorisation « position approximative » seulement (Android 12+) : cas B. */
  | 'approximative'
  /** Localisation de la tablette coupée : cas A. */
  | 'desactive'
  /** Pas de position assez précise au bout de 20 s : cas C. */
  | 'lent'

/** Erreur brute du navigateur (code 1/2/3) ou du plugin Capacitor (« OS-PLUG-GLOC-0007 »). */
export type ErreurGpsBrute = { code?: number | string | null, message?: string | null } | null | undefined

/** État des autorisations : `location` = position exacte, `coarseLocation` = approximative. */
export type PermissionGps = { location?: string | null, coarseLocation?: string | null } | null | undefined

// Codes du plugin @capacitor/geolocation 7 (GeolocationErrors.kt).
const CODES_PLUGIN: Record<string, 1 | 2 | 3> = {
  'OS-PLUG-GLOC-0002': 2, // position introuvable
  'OS-PLUG-GLOC-0003': 1, // autorisation refusée
  'OS-PLUG-GLOC-0007': 2, // localisation coupée
  'OS-PLUG-GLOC-0009': 2, // demande d'activer la localisation refusée
  'OS-PLUG-GLOC-0010': 3, // délai dépassé
  'OS-PLUG-GLOC-0014': 2, // services Google Play
  'OS-PLUG-GLOC-0015': 2,
  'OS-PLUG-GLOC-0016': 2, // réglages de localisation
}

/**
 * Code web (1 = refusé, 2 = indisponible ou coupé, 3 = délai) d'une erreur du
 * navigateur ou du plugin. Le plugin envoie un code texte : lu avant le
 * message (« Request to enable location was denied » veut dire localisation
 * coupée, pas autorisation refusée).
 */
export function codeErreurGps(erreur: ErreurGpsBrute): 1 | 2 | 3 | null {
  if (!erreur) return null
  const code = erreur.code
  if (code === 1 || code === 2 || code === 3) return code
  if (typeof code === 'string' && CODES_PLUGIN[code]) return CODES_PLUGIN[code]
  const message = erreur.message || ''
  if (/enable location|not enabled|disabled|désactiv|unavailable|indisponible/i.test(message)) return 2
  if (/denied|refus|permission/i.test(message)) return 1
  if (/timed? ?out|in time|expir|délai/i.test(message)) return 3
  return null
}

/**
 * Cause du blocage, une fois la recherche terminée sans position acceptée.
 * L'autorisation passe d'abord : une tablette en « position approximative »
 * renvoie des positions à 2 km, attendre ne servirait à rien.
 */
export function causeBlocageGps(erreur: ErreurGpsBrute, permission?: PermissionGps): CauseBlocageGps {
  const code = codeErreurGps(erreur)
  if (code === 2) return 'desactive'
  if (permission?.location && permission.location !== 'granted') {
    if (permission.coarseLocation === 'granted') return 'approximative'
    if (permission.location === 'denied') return 'permission'
  }
  if (code === 1) return 'permission'
  return 'lent'
}

/** Position assez précise pour démarrer (`max` ≤ 0 : pas d'exigence). */
export function etatRecherche(precision_m: number | null | undefined, max_m: number): 'attendre' | 'ok' {
  if (precision_m == null || !Number.isFinite(precision_m)) return 'attendre'
  return max_m <= 0 || precision_m <= max_m ? 'ok' : 'attendre'
}

/** Au-delà du seuil, l'agent confirme qu'il est devant le PDV. Ne bloque jamais. */
export function decisionDistance(distance_m: number | null | undefined, seuil_m: number): 'ok' | 'confirmer' {
  if (distance_m == null || !Number.isFinite(distance_m) || seuil_m <= 0) return 'ok'
  return distance_m > seuil_m ? 'confirmer' : 'ok'
}

export type DecisionGpsVisite =
  | { action: 'confirmer', distance_m: number }
  | { action: 'enregistrer', geofenceOk: boolean, gps: GpsVisite }

/**
 * Ce que fait le formulaire de visite avec la position relevée (toujours
 * assez précise : la recherche a attendu « Précision GPS exigée »).
 * - PDV repéré (terrain, admin, création, visite confirmée) : au-delà de la
 *   distance d'alerte, question « Êtes-vous bien devant… ? ». « Oui » →
 *   `confirmation = 'devant'`, et le déclencheur déplace le PDV ici.
 *   `geofenceOk` reste la vérité du rayon : une visite confirmée à 800 m est
 *   « hors rayon » dans les contrôles, avec la confirmation à côté.
 * - PDV sans repère (position d'un fichier, ou aucune) : pas de question, sa
 *   première visite assez précise fixe sa position (comme en 1.0.15).
 */
export function decisionGpsVisite(p: {
  repere: RepereGps | null
  distance_m: number | null
  precision_m: number
  rayon_m: number
  distance_alerte_m: number
  precision_pdv_max_m: number
  confirmation?: 'devant' | null
}): DecisionGpsVisite {
  if (p.repere) {
    if (decisionDistance(p.distance_m, p.distance_alerte_m) === 'confirmer' && p.confirmation !== 'devant') {
      return { action: 'confirmer', distance_m: p.distance_m as number }
    }
    const dansLeRayon = p.distance_m == null || p.distance_m <= p.rayon_m
    const gps: GpsVisite = { repere: p.repere, distance_m: p.distance_m, rayon_m: p.rayon_m, precision_m: p.precision_m }
    if (p.confirmation === 'devant') gps.confirmation = 'devant'
    return { action: 'enregistrer', geofenceOk: dansLeRayon, gps }
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
