import { describe, it, expect } from 'vitest'
import { decisionGpsVisite, repereDuPdv, texteRepere } from '../utils/repereGps'

// Règle du 22/10/2026 : la première visite d'un PDV passe sans contrôle et
// fixe sa position ; ensuite la tablette doit être dans le rayon du repère.
describe('repereDuPdv', () => {
  it('pas de repère tant que la position vient d\'un fichier (DMS, Atom…)', () => {
    expect(repereDuPdv({ geolocation_lat: 5.3, geolocation_lng: -4, gps_source: 'atom-fichier' })).toBeNull()
    expect(repereDuPdv({ geolocation_lat: 5.3, geolocation_lng: -4, gps_source: 'dms' })).toBeNull()
    expect(repereDuPdv({ geolocation_lat: 5.3, geolocation_lng: -4, gps_source: null })).toBeNull()
  })
  it('repère posé par une visite terrain ou par l\'admin', () => {
    expect(repereDuPdv({ geolocation_lat: 5.3, geolocation_lng: -4, gps_source: 'terrain' })).toBe('terrain')
    expect(repereDuPdv({ geolocation_lat: 5.3, geolocation_lng: -4, gps_source: 'admin' })).toBe('admin')
  })
  it('sans coordonnées, jamais de repère', () => {
    expect(repereDuPdv({ geolocation_lat: null, geolocation_lng: null, gps_source: 'terrain' })).toBeNull()
    expect(repereDuPdv(null)).toBeNull()
  })
})

describe('texteRepere', () => {
  it('donne la date de la première visite ou l\'admin', () => {
    expect(texteRepere({ geolocation_lat: 5.3, geolocation_lng: -4, gps_source: 'terrain', gps_maj_le: '2026-10-21T10:00:00Z' })).toBe('repéré sur place le 21/10')
    expect(texteRepere({ geolocation_lat: 5.3, geolocation_lng: -4, gps_source: 'admin' })).toBe('placé par l\'administrateur')
  })
})

describe('decisionGpsVisite', () => {
  const base = { rayon_m: 300, seuil_m: 30, precision_pdv_max_m: 30 }

  it('première visite : enregistrée même à 2 km, et devient le repère', () => {
    const d = decisionGpsVisite({ ...base, repere: null, distance_m: 2000, precision_m: 8 })
    expect(d).toEqual({ action: 'enregistrer', geofenceOk: true, gps: { repere: 'premiere_visite', distance_m: 2000, precision_m: 8 } })
  })

  it('première visite imprécise : enregistrée, PDV non repéré', () => {
    const d = decisionGpsVisite({ ...base, repere: null, distance_m: null, precision_m: 45 })
    expect(d.action).toBe('enregistrer')
    if (d.action === 'enregistrer') {
      expect(d.geofenceOk).toBe(false)
      expect(d.gps).toMatchObject({ repere: 'premiere_visite', motif: 'precision', precision_exigee_m: 30 })
    }
  })

  it('PDV repéré, à 800 m : bloqué, pas de « quand même »', () => {
    expect(decisionGpsVisite({ ...base, repere: 'terrain', distance_m: 800, precision_m: 5 }))
      .toEqual({ action: 'trop_loin', distance_m: 800, rayon_m: 300 })
  })

  it('PDV repéré, GPS imprécis : réessayer', () => {
    expect(decisionGpsVisite({ ...base, repere: 'admin', distance_m: 20, precision_m: 60 }))
      .toEqual({ action: 'imprecis', precision_m: 60, seuil_m: 30 })
  })

  it('PDV repéré, sur place : enregistrée dans le rayon avec la distance', () => {
    expect(decisionGpsVisite({ ...base, repere: 'terrain', distance_m: 45, precision_m: 6 }))
      .toEqual({ action: 'enregistrer', geofenceOk: true, gps: { repere: 'terrain', distance_m: 45, rayon_m: 300, precision_m: 6 } })
  })

  it('le rayon du PDV remplace le rayon par défaut', () => {
    expect(decisionGpsVisite({ ...base, rayon_m: 100, repere: 'terrain', distance_m: 150, precision_m: 5 }).action).toBe('trop_loin')
  })
})
