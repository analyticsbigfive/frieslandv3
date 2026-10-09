import { describe, it, expect } from 'vitest'
import { calculerEcart, tauxEcart } from '../utils/ecartsBinome'

const routing = new Map<number, Set<string>>([
  [1, new Set(['P1', 'P2'])],
  [2, new Set(['P3'])],
  [3, new Set()],
])

describe('contrôle d’écart SSF ↔ merchandiser', () => {
  it('sans binôme le jour : pas de comparaison', () => {
    expect(calculerEcart(['P1'], [], routing)).toEqual({ statut: 'sans_binome', hors: [] })
  })

  it('SSF sans routing importé : signalé, sans écart compté', () => {
    expect(calculerEcart(['P1'], [3, 9], routing)).toEqual({ statut: 'routing_ssf_absent', hors: [] })
  })

  it('PDV hors du routing du SSF du binôme', () => {
    expect(calculerEcart(['P1', 'P2', 'P4'], [1], routing)).toEqual({ statut: 'hors_routing_ssf', hors: ['P4'] })
  })

  it('deux SSF le même jour : un PDV couvert par l’un des deux est aligné', () => {
    expect(calculerEcart(['P1', 'P3'], [1, 2], routing)).toEqual({ statut: 'ok', hors: [] })
  })

  it('un SSF sans routing à côté d’un SSF connu : seul le connu compte', () => {
    expect(calculerEcart(['P1', 'P5'], [1, 3], routing)).toEqual({ statut: 'hors_routing_ssf', hors: ['P5'] })
  })

  it('taux d’écart', () => {
    expect(tauxEcart(1, 4)).toBe(25)
    expect(tauxEcart(null, 4)).toBeNull()
    expect(tauxEcart(0, 0)).toBeNull()
  })
})
