import { describe, it, expect } from 'vitest'
import { casesEmprise, clesEmprise, dansEmprise } from '../utils/decoupage'

// Trois boutiques d'Abobo (deux dans la même case de 0,004°) et une à Yopougon.
const lat = [5.4201, 5.4205, 5.4252, 5.3401]
const lng = [-4.0201, -4.0205, -4.0201, -4.0801]

describe('emprise d’une personne', () => {
  it('une case par groupe de boutiques proches, coin sud-ouest', () => {
    const cases = casesEmprise(lat, lng)
    expect(cases).toHaveLength(3)
    const [la, lo] = cases[0]!
    expect(la).toBeLessThanOrEqual(5.4201)
    expect(la).toBeGreaterThan(5.4201 - 0.004)
    expect(lo).toBeLessThanOrEqual(-4.0201)
  })

  it('aucune boutique : emprise vide', () => {
    expect(casesEmprise([], [])).toEqual([])
    expect(dansEmprise(clesEmprise([]), 5.42, -4.02)).toBe(false)
  })

  it('une visite dans la case d’une boutique ou dans une case voisine est dans l’emprise', () => {
    const cles = clesEmprise(casesEmprise(lat, lng))
    expect(dansEmprise(cles, 5.4203, -4.0203)).toBe(true)
    // 300 m au nord de la boutique de 5,4252 : case voisine.
    expect(dansEmprise(cles, 5.4279, -4.0201)).toBe(true)
  })

  it('une visite à Cocody, loin de toutes ses boutiques, est hors de l’emprise', () => {
    const cles = clesEmprise(casesEmprise(lat, lng))
    expect(dansEmprise(cles, 5.3600, -3.9800)).toBe(false)
  })

  it('les clés tiennent malgré l’arrondi des flottants', () => {
    // 1355 × 0,004 = 5,42 n'est pas exact en flottant.
    const cles = clesEmprise([[1355 * 0.004, -1005 * 0.004]])
    expect(cles.has('1355,-1005')).toBe(true)
  })
})
