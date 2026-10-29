// utils/repereGps.ts
// Repère du PDV (22/10/2026, décision de Jean Luc) : la première visite d'un
// PDV passe sans contrôle de distance et fixe sa position (déclencheur
// pdv_gps_depuis_visite, gps_source = 'terrain') ; l'admin peut la corriger
// (gps_source = 'admin'). Voir
// supabase/nouveau/20261022100000_friesland_gps_premiere_visite.sql.
// 1.0.17 (29/10/2026) : la position prise à la création du PDV ('creation') et
// celle d'une visite où l'agent a confirmé être devant ('visite_validee')
// sont aussi des repères. La règle de la visite est dans utils/gpsVisite.ts.

export type PdvPosition = {
  geolocation_lat?: number | null
  geolocation_lng?: number | null
  gps_source?: string | null
  gps_maj_le?: string | null
} | null | undefined

export type RepereGps = 'terrain' | 'admin' | 'creation' | 'visite_validee'

/** Sources qui valent repère : une visite (ou la création) ne les remplace plus sans confirmation. */
export const SOURCES_REPERE: readonly RepereGps[] = ['terrain', 'admin', 'creation', 'visite_validee']

export type GpsVisite = {
  motif?: 'precision'
  precision_m?: number | null
  precision_exigee_m?: number | null
  repere?: 'premiere_visite' | RepereGps
  distance_m?: number | null
  rayon_m?: number | null
  /** 1.0.17 : l'agent, loin du repère, a répondu « Oui, je suis devant ». */
  confirmation?: 'devant'
}

/** Repère du PDV, ou null tant qu'aucune visite (ni l'admin, ni la création) ne l'a fixé. */
export function repereDuPdv(pdv: PdvPosition): RepereGps | null {
  if (!pdv?.geolocation_lat || !pdv?.geolocation_lng) return null
  return (SOURCES_REPERE as readonly string[]).includes(pdv.gps_source || '') ? pdv.gps_source as RepereGps : null
}

/** « repéré sur place le 21/10 », « placé par l'administrateur »… */
export function texteRepere(pdv: PdvPosition): string {
  const repere = repereDuPdv(pdv)
  if (repere === 'admin') return 'placé par l\'administrateur'
  const le = pdv?.gps_maj_le ? new Date(pdv.gps_maj_le).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : ''
  if (repere === 'creation') return le ? `repéré à sa création le ${le}` : 'repéré à sa création'
  if (repere === 'visite_validee') return le ? `confirmé sur place le ${le}` : 'confirmé sur place'
  return le ? `repéré sur place le ${le}` : 'repéré sur place'
}
