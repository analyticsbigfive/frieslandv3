import { describe, it, expect } from 'vitest'
import { normaliserNomPdv, similariteNomsPdv, voisinNomProche, voisinsDansRayon, SEUIL_NOM_PROCHE } from '../utils/doublonPdv'

// Création de PDV sans doublon (29/10) : GPS + photo de la devanture.

describe('normaliserNomPdv', () => {
  it('retire accents, casse, ponctuation et mots génériques', () => {
    expect(normaliserNomPdv('Boutique Chez Awa')).toBe('awa')
    expect(normaliserNomPdv('ETS. KONÉ & Fils')).toBe('kone fils')
    expect(normaliserNomPdv('Superette')).toBe('superette') // que des mots génériques : on les garde
    expect(normaliserNomPdv(null)).toBe('')
  })
})

describe('similariteNomsPdv', () => {
  it('même boutique écrite autrement : presque identique', () => {
    expect(similariteNomsPdv('Boutique Chez Awa', 'CHEZ AWA')).toBe(1)
    expect(similariteNomsPdv('Kone Fils', 'Ets Koné et fils')).toBe(1)
    expect(similariteNomsPdv('Awa', 'Awa Cosmétique')).toBeGreaterThanOrEqual(SEUIL_NOM_PROCHE)
    expect(similariteNomsPdv('Boutique Moussa', 'Boutique Mousa')).toBeGreaterThanOrEqual(SEUIL_NOM_PROCHE)
  })
  it('deux boutiques différentes : loin du seuil', () => {
    expect(similariteNomsPdv('Chez Awa', 'Chez Moussa')).toBeLessThan(SEUIL_NOM_PROCHE)
    expect(similariteNomsPdv('Kiosque Bamba', 'Superette Le Bon Prix')).toBeLessThan(SEUIL_NOM_PROCHE)
    expect(similariteNomsPdv('', 'Chez Awa')).toBe(0)
  })
})

describe('voisinsDansRayon', () => {
  const pdvs = [
    { pdv_id: 'loin', nom_pdv: 'Loin', geolocation_lat: 5.3010, geolocation_lng: -4.0 }, // ~111 m
    { pdv_id: 'proche', nom_pdv: 'Proche', geolocation_lat: 5.3001, geolocation_lng: -4.0 }, // ~11 m
    { pdv_id: 'moyen', nom_pdv: 'Moyen', geolocation_lat: 5.3002, geolocation_lng: -4.0 }, // ~22 m
    { pdv_id: 'sans-gps', nom_pdv: 'Sans GPS', geolocation_lat: null, geolocation_lng: null },
  ]
  it('garde ceux du rayon, du plus proche au plus loin', () => {
    const v = voisinsDansRayon({ lat: 5.3, lng: -4.0 }, pdvs, 30)
    expect(v.map(x => x.pdv_id)).toEqual(['proche', 'moyen'])
    expect(v[0].distance_m).toBe(11)
  })
})

describe('voisinNomProche', () => {
  const voisins = [
    { pdv_id: 'a', nom_pdv: 'Chez Awa', distance_m: 8 },
    { pdv_id: 'b', nom_pdv: 'Boutique Awa', distance_m: 25 },
    { pdv_id: 'c', nom_pdv: 'Chez Moussa', distance_m: 5 },
  ]
  it('nom presque identique à moins de 15 m : confirmation explicite', () => {
    expect(voisinNomProche('Boutique chez Awa', voisins, 15)?.pdv_id).toBe('a')
  })
  it('même nom mais à 25 m, ou nom différent tout près : pas de confirmation forte', () => {
    expect(voisinNomProche('Awa', [voisins[1]], 15)).toBeNull()
    expect(voisinNomProche('Chez Bamba', voisins, 15)).toBeNull()
  })
})
