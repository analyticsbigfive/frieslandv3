import { describe, it, expect } from 'vitest'
import { calculerDisponibiliteRayon, estDisponible } from '../utils/perfectStore'

// Poids EVAP · commerce traditionnel (GT) — référentiel client.
// Identiques au seed supabase/nouveau/20260630120300_friesland_produits_disponibilite.sql (l.65-70).
// Ordre : 150g rouge, 150g bleu, 380g rouge, 380g bleu, GOLD, PEARL.
const POIDS_EVAP_GT = [
  0.749443117, // BR 150g (produit phare)
  0.08421527549, // BRB 150g
  0.04827634345, // BR 380g
  0.005407986339, // BRB 380g
  0.009468528271, // BR Gold 160g
  0.1031887494, // Pearl 380g
]

describe('calculerDisponibiliteRayon — EVAP, commerce traditionnel (test d’acceptation)', () => {
  it('PDV 1 [1,0,1,1,1,1] → 92 %', () => {
    expect(calculerDisponibiliteRayon(POIDS_EVAP_GT, [1, 0, 1, 1, 1, 1])).toBe(92)
  })

  it('PDV 2 [0,1,1,0,1,0] → 14 % (le produit phare 150g rouge manque)', () => {
    expect(calculerDisponibiliteRayon(POIDS_EVAP_GT, [0, 1, 1, 0, 1, 0])).toBe(14)
  })

  it('PDV 3 [1,0,1,0,1,1] → 91 %', () => {
    expect(calculerDisponibiliteRayon(POIDS_EVAP_GT, [1, 0, 1, 0, 1, 1])).toBe(91)
  })
})

describe('calculerDisponibiliteRayon — cas limites', () => {
  it('tout disponible → 100 % (Σ poids = 1)', () => {
    expect(calculerDisponibiliteRayon(POIDS_EVAP_GT, [1, 1, 1, 1, 1, 1])).toBe(100)
  })

  it('rien disponible → 0 %', () => {
    expect(calculerDisponibiliteRayon(POIDS_EVAP_GT, [0, 0, 0, 0, 0, 0])).toBe(0)
  })

  it('longueurs incohérentes → erreur', () => {
    expect(() => calculerDisponibiliteRayon([1], [1, 0])).toThrow()
  })
})

describe('estDisponible — quantité ≥ seuil', () => {
  it('quantité au seuil → disponible (1)', () => {
    expect(estDisponible(24, 24)).toBe(1)
  })
  it('quantité sous le seuil → indisponible (0)', () => {
    expect(estDisponible(23, 24)).toBe(0)
  })
  it('quantité nulle → indisponible (0)', () => {
    expect(estDisponible(0, 1)).toBe(0)
  })
})
