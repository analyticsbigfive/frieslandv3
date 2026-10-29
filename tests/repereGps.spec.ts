import { describe, it, expect } from 'vitest'
import { repereDuPdv, texteRepere } from '../utils/repereGps'

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
  it('1.0.17 : position de la création ou confirmée devant le PDV', () => {
    expect(repereDuPdv({ geolocation_lat: 5.3, geolocation_lng: -4, gps_source: 'creation' })).toBe('creation')
    expect(repereDuPdv({ geolocation_lat: 5.3, geolocation_lng: -4, gps_source: 'visite_validee' })).toBe('visite_validee')
  })
  it('un pushcart (itinérant) n\'a jamais de repère', () => {
    expect(repereDuPdv({ geolocation_lat: 5.3, geolocation_lng: -4, gps_source: 'itinerant' })).toBeNull()
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
    expect(texteRepere({ geolocation_lat: 5.3, geolocation_lng: -4, gps_source: 'creation', gps_maj_le: '2026-10-29T10:00:00Z' })).toBe('repéré à sa création le 29/10')
    expect(texteRepere({ geolocation_lat: 5.3, geolocation_lng: -4, gps_source: 'visite_validee', gps_maj_le: '2026-10-29T10:00:00Z' })).toBe('confirmé sur place le 29/10')
  })
})
