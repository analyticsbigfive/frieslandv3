import { describe, it, expect } from 'vitest'
import { agregerParPeriode, clePeriode, semaineIso } from '../utils/agregation'

// Lot 5 (1.0.4) : une seule agrégation par période pour tous les dashboards.
// Avant, trois implémentations avec trois conventions de semaine : les courbes
// de deux écrans ne coïncidaient pas pour les mêmes visites.

describe('semaineIso', () => {
  it('suit ISO 8601 : le 1er janvier 2027 (vendredi) est en S53 de 2026', () => {
    expect(semaineIso(new Date(2027, 0, 1))).toEqual({ annee: 2026, semaine: 53 })
  })

  it('le lundi 7 septembre 2026 est en S37', () => {
    expect(semaineIso(new Date(2026, 8, 7))).toEqual({ annee: 2026, semaine: 37 })
  })
})

describe('clePeriode', () => {
  const d = new Date(2026, 8, 13) // dimanche 13 septembre 2026

  it('jour : clé ISO et libellé court', () => {
    expect(clePeriode(d, 'jour')).toEqual({ cle: '2026-09-13', label: '13 sept.' })
  })

  it('semaine : le dimanche appartient à la semaine du lundi précédent', () => {
    expect(clePeriode(d, 'semaine')).toEqual({ cle: '2026-W37', label: 'S37 2026' })
    expect(clePeriode(new Date(2026, 8, 7), 'semaine').cle).toBe('2026-W37')
  })

  it('mois : clé AAAA-MM et libellé français', () => {
    expect(clePeriode(d, 'mois')).toEqual({ cle: '2026-09', label: 'septembre 2026' })
  })
})

describe('agregerParPeriode', () => {
  const visites = [
    { date: '2026-09-07T08:00:00Z', ok: true },
    { date: '2026-09-09T08:00:00Z', ok: false },
    { date: '2026-09-15T08:00:00Z', ok: true },
    { date: null, ok: true },
    { date: 'pas une date', ok: true },
  ]

  it('groupe par semaine en ordre chronologique avec total et match', () => {
    const points = agregerParPeriode(visites, v => v.date, 'semaine', v => v.ok)
    expect(points).toEqual([
      { cle: '2026-W37', label: 'S37 2026', total: 2, match: 1 },
      { cle: '2026-W38', label: 'S38 2026', total: 1, match: 1 },
    ])
  })

  it('sans prédicat, match = total', () => {
    const points = agregerParPeriode(visites, v => v.date, 'mois')
    expect(points).toEqual([{ cle: '2026-09', label: 'septembre 2026', total: 3, match: 3 }])
  })

  it('ignore les dates absentes ou invalides', () => {
    expect(agregerParPeriode(visites, v => v.date, 'jour')).toHaveLength(3)
  })

  it('trie même si les éléments arrivent en désordre', () => {
    const points = agregerParPeriode([...visites].reverse(), v => v.date, 'jour')
    expect(points.map(p => p.cle)).toEqual(['2026-09-07', '2026-09-09', '2026-09-15'])
  })
})
