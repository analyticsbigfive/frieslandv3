import { describe, it, expect } from 'vitest'
import { plageDePeriode, debutDeSemaine, toIsoJour } from '../utils/periode'

// Les bornes de période pilotent toutes les RPC du dashboard : une erreur ici
// décale silencieusement tous les KPI d'un jour, sans lever d'exception.
describe('plageDePeriode', () => {
  it('jour : borne basse = borne haute = le jour de référence', () => {
    const plage = plageDePeriode('jour', new Date(2026, 6, 30))
    expect(plage).toEqual({ debut: '2026-07-30', fin: '2026-07-30' })
  })

  it('semaine : lundi → dimanche', () => {
    // 30 juillet 2026 = un jeudi.
    const plage = plageDePeriode('semaine', new Date(2026, 6, 30))
    expect(plage).toEqual({ debut: '2026-07-27', fin: '2026-08-02' })
  })

  it('semaine : un dimanche appartient à la semaine qui commence le lundi précédent', () => {
    // Le piège de getDay() : dimanche vaut 0, pas 7.
    const plage = plageDePeriode('semaine', new Date(2026, 7, 2))
    expect(plage).toEqual({ debut: '2026-07-27', fin: '2026-08-02' })
  })

  it('mois : 1er → dernier jour, y compris sur un mois de 31 jours', () => {
    const plage = plageDePeriode('mois', new Date(2026, 6, 15))
    expect(plage).toEqual({ debut: '2026-07-01', fin: '2026-07-31' })
  })

  it('mois : février d’une année bissextile', () => {
    const plage = plageDePeriode('mois', new Date(2028, 1, 10))
    expect(plage).toEqual({ debut: '2028-02-01', fin: '2028-02-29' })
  })

  it('30j : 30 jours glissants, référence incluse', () => {
    const plage = plageDePeriode('30j', new Date(2026, 8, 1))
    expect(plage).toEqual({ debut: '2026-08-03', fin: '2026-09-01' })
  })

  it('30j : traverse un 29 février', () => {
    const plage = plageDePeriode('30j', new Date(2028, 2, 10))
    expect(plage).toEqual({ debut: '2028-02-10', fin: '2028-03-10' })
  })

  it('30j : traverse un changement d’année', () => {
    const plage = plageDePeriode('30j', new Date(2027, 0, 5))
    expect(plage).toEqual({ debut: '2026-12-07', fin: '2027-01-05' })
  })

  it('tout : aucune borne', () => {
    expect(plageDePeriode('tout', new Date(2026, 6, 30))).toEqual({ debut: '', fin: '' })
  })
})

describe('toIsoJour', () => {
  it('sérialise sur les composantes locales, pas en UTC', () => {
    // 1er janvier à 00h30 locale : toISOString() renverrait 2025-12-31 pour
    // tout fuseau à l’est de Greenwich. La date locale reste le 1er janvier.
    expect(toIsoJour(new Date(2026, 0, 1, 0, 30))).toBe('2026-01-01')
  })

  it('complète mois et jour sur deux chiffres', () => {
    expect(toIsoJour(new Date(2026, 8, 5))).toBe('2026-09-05')
  })
})

describe('debutDeSemaine', () => {
  it('renvoie le lundi même quand la référence est déjà un lundi', () => {
    expect(toIsoJour(debutDeSemaine(new Date(2026, 6, 27)))).toBe('2026-07-27')
  })
})
