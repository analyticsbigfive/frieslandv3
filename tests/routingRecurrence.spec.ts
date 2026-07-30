import { describe, it, expect } from 'vitest'
import { joursDeRegle, libelleJours, datesDeRegle, pdvExclus, dansException } from '../utils/routingRecurrence'

// Ces fonctions décident quelles dates l'admin voit comme « couvertes » par une
// règle. Une erreur ne lève rien : elle affiche simplement les mauvaises dates,
// et l'admin décoche la mauvaise semaine.
describe('joursDeRegle', () => {
  it('lit le nouveau format multi-jours', () => {
    expect(joursDeRegle({ days_of_week: [1, 4] })).toEqual([1, 4])
  })

  it('lit encore les règles à jour unique (day_of_week)', () => {
    expect(joursDeRegle({ day_of_week: 2 })).toEqual([2])
  })

  it('gère dimanche (valeur 0), qui ne doit pas être confondu avec « absent »', () => {
    expect(joursDeRegle({ day_of_week: 0 })).toEqual([0])
  })

  it('renvoie un tableau vide si aucun jour', () => {
    expect(joursDeRegle({})).toEqual([])
    expect(joursDeRegle({ days_of_week: [] })).toEqual([])
  })
})

describe('libelleJours', () => {
  it('affiche les jours dans l’ordre de la semaine, pas dans celui de saisie', () => {
    expect(libelleJours({ days_of_week: [4, 1] })).toBe('Lun · Jeu')
  })

  it('place dimanche en fin de semaine', () => {
    expect(libelleJours({ days_of_week: [0, 1] })).toBe('Lun · Dim')
  })
})

describe('datesDeRegle', () => {
  // Août 2026 : le 3 est un lundi, le 6 un jeudi.
  const regleLundiJeudi = { days_of_week: [1, 4] }

  it('développe une règle multi-jours sur deux semaines', () => {
    expect(datesDeRegle(regleLundiJeudi, '2026-08-03', '2026-08-16')).toEqual([
      '2026-08-03', '2026-08-06', '2026-08-10', '2026-08-13',
    ])
  })

  it('continue le mois suivant sans re-paramétrage — l’exigence centrale du client', () => {
    const dates = datesDeRegle(regleLundiJeudi, '2026-08-25', '2026-09-07')
    expect(dates).toContain('2026-09-03')
    expect(dates).toContain('2026-09-07')
  })

  it('respecte la fenêtre de validité de la règle', () => {
    const regle = { days_of_week: [1], date_debut: '2026-08-10', date_fin: '2026-08-17' }
    expect(datesDeRegle(regle, '2026-08-01', '2026-08-31')).toEqual(['2026-08-10', '2026-08-17'])
  })

  it('retire une occurrence entièrement suspendue (exception sans pdv_id)', () => {
    const exceptions = [{ date_debut: '2026-08-10', date_fin: '2026-08-16' }]
    expect(datesDeRegle(regleLundiJeudi, '2026-08-03', '2026-08-16', exceptions))
      .toEqual(['2026-08-03', '2026-08-06'])
  })

  it('garde l’occurrence quand l’exception ne vise qu’un PDV', () => {
    // Décocher un PDV pour une semaine ne doit pas annuler la tournée entière.
    const exceptions = [{ pdv_id: 'PS-011', date_debut: '2026-08-10', date_fin: '2026-08-16' }]
    expect(datesDeRegle(regleLundiJeudi, '2026-08-10', '2026-08-16', exceptions))
      .toEqual(['2026-08-10', '2026-08-13'])
  })

  it('ne renvoie rien pour une règle désactivée', () => {
    expect(datesDeRegle({ days_of_week: [1], is_active: false }, '2026-08-01', '2026-08-31')).toEqual([])
  })

  it('ne renvoie rien pour une règle sans jour', () => {
    expect(datesDeRegle({}, '2026-08-01', '2026-08-31')).toEqual([])
  })
})

describe('pdvExclus / dansException', () => {
  const exceptions = [
    { pdv_id: 'PS-011', date_debut: '2026-08-10', date_fin: '2026-08-16' },
    { pdv_id: 'PS-004', date_debut: '2026-08-17', date_fin: '2026-08-23' },
    { date_debut: '2026-08-10', date_fin: '2026-08-16' },
  ]

  it('ne retient que les exceptions ciblant un PDV et couvrant la date', () => {
    expect(pdvExclus(exceptions, '2026-08-10')).toEqual(['PS-011'])
    expect(pdvExclus(exceptions, '2026-08-17')).toEqual(['PS-004'])
    expect(pdvExclus(exceptions, '2026-08-24')).toEqual([])
  })

  it('inclut les deux bornes de la fenêtre', () => {
    const e = { date_debut: '2026-08-10', date_fin: '2026-08-16' }
    expect(dansException(e, '2026-08-10')).toBe(true)
    expect(dansException(e, '2026-08-16')).toBe(true)
    expect(dansException(e, '2026-08-17')).toBe(false)
  })
})
