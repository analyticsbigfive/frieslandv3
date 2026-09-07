import { describe, it, expect } from 'vitest'
import { distanceTrajet, haversine, lisserTrajet } from '../utils/trajets'

// Retour démo du 7 sept. 2026 : un merchandiser resté au même endroit
// apparaissait en mouvement, le bruit GPS étant tracé brut.
const base = { lat: 5.2939, lng: -3.9967 }
const t0 = new Date('2026-09-04T13:00:00Z').getTime()
const iso = (offsetMin: number) => new Date(t0 + offsetMin * 60_000).toISOString()
// ~1e-4° ≈ 11 m en latitude.
const pt = (dLatM: number, dLngM: number, min: number, accuracy = 12) => ({
  lat: base.lat + dLatM / 110_574,
  lng: base.lng + dLngM / (111_320 * Math.cos(base.lat * Math.PI / 180)),
  accuracy,
  captured_at: iso(min),
})

describe('haversine', () => {
  it('mesure environ 111 m pour 0,001° de latitude', () => {
    expect(haversine(5, -4, 5.001, -4)).toBeCloseTo(111.2, 0)
  })
})

describe('lisserTrajet', () => {
  it('réduit un nuage stationnaire de 20 points à un seul arrêt sans distance', () => {
    const bruts = Array.from({ length: 20 }, (_, i) => pt((i % 4) * 5 - 7, ((i * 7) % 5) * 3 - 6, i * 6))
    const r = lisserTrajet(bruts)
    expect(r.points).toHaveLength(1)
    expect(r.distanceM).toBe(0)
    expect(r.arrets).toHaveLength(1)
    expect(r.arrets[0].dureeMs).toBe(19 * 6 * 60_000)
    expect(r.bruts).toBe(20)
  })

  it('rejette un point trop imprécis et un saut impossible', () => {
    const bruts = [
      pt(0, 0, 0),
      pt(0, 0, 1, 250),          // précision 250 m
      pt(5000, 0, 2),            // 5 km en 1 min = 300 km/h
      pt(60, 0, 10),             // 60 m plus loin, 10 min après : retenu
    ]
    const r = lisserTrajet(bruts)
    expect(r.rejetes).toEqual({ precision: 1, vitesse: 1 })
    expect(r.points).toHaveLength(2)
    expect(r.distanceM).toBeCloseTo(60, -1)
  })

  it('conserve un vrai déplacement et ne compte pas d\'arrêt en dessous de 5 min', () => {
    const bruts = [pt(0, 0, 0), pt(300, 0, 5), pt(600, 0, 10), pt(600, 400, 15)]
    const r = lisserTrajet(bruts)
    expect(r.points.length).toBeGreaterThanOrEqual(3)
    expect(r.distanceM).toBeCloseTo(1000, -2)
    expect(r.arrets).toHaveLength(0)
    expect(distanceTrajet(bruts)).toBeCloseTo(1000, -2)
  })

  it('absorbe un aller-retour de dérive vers l\'avant-dernier point', () => {
    // Téléphone posé : 0 → 45 m → retour à 5 m → 45 m… pendant 30 min.
    const bruts = [pt(0, 0, 0), pt(45, 0, 5), pt(5, 0, 10), pt(45, 3, 15), pt(2, 0, 20), pt(44, 0, 25), pt(0, 0, 30)]
    const r = lisserTrajet(bruts)
    expect(r.points).toHaveLength(1)
    expect(r.distanceM).toBe(0)
    expect(r.arrets).toHaveLength(1)
  })

  it('la simplification retire les points alignés mais garde les arrêts', () => {
    const bruts = [pt(0, 0, 0), pt(100, 1, 2), pt(200, -1, 4), pt(300, 0, 6), pt(300, 2, 7), pt(302, 0, 20), pt(600, 0, 30)]
    const r = lisserTrajet(bruts)
    // Le point 300 m absorbe ses voisins pendant 14 min : arrêt conservé.
    expect(r.arrets).toHaveLength(1)
    expect(r.points.some(p => p.absorbes > 0)).toBe(true)
    expect(r.points.length).toBeLessThan(bruts.length)
  })
})
