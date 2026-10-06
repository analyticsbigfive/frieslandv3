import { describe, expect, it } from 'vitest'
import { joursDepuis, statutVersion, syntheseAdoption } from '../utils/adoptionApp'

describe('statutVersion', () => {
  it('à jour au niveau de la version minimale ou au-dessus', () => {
    expect(statutVersion(14, 14)).toBe('a_jour')
    expect(statutVersion(15, 14)).toBe('a_jour')
  })

  it('bloquée sous la version minimale', () => {
    expect(statutVersion(13, 14)).toBe('bloquee')
  })

  it('non déclarée sans ligne version_installee (app avant 1.0.10)', () => {
    expect(statutVersion(null, 14)).toBe('non_declaree')
    expect(statutVersion(undefined, 14)).toBe('non_declaree')
  })

  it('sans version minimale configurée, toute version déclarée est à jour', () => {
    expect(statutVersion(9, null)).toBe('a_jour')
  })
})

describe('syntheseAdoption', () => {
  it('compte les statuts et calcule le taux arrondi', () => {
    const s = syntheseAdoption([
      { user_id: 'a', statut: 'a_jour' },
      { user_id: 'b', statut: 'bloquee' },
      { user_id: 'c', statut: 'non_declaree' },
    ])
    expect(s).toEqual({ a_jour: 1, bloquee: 1, non_declaree: 1, total: 3, taux: 33 })
  })

  it('liste vide : taux 0, pas de division par zéro', () => {
    expect(syntheseAdoption([]).taux).toBe(0)
  })
})

describe('joursDepuis', () => {
  const maintenant = new Date('2026-10-06T12:00:00Z')

  it('jours entiers écoulés', () => {
    expect(joursDepuis('2026-10-04T13:00:00Z', maintenant)).toBe(1)
    expect(joursDepuis('2026-10-06T08:00:00Z', maintenant)).toBe(0)
  })

  it('null si absente ou invalide', () => {
    expect(joursDepuis(null, maintenant)).toBeNull()
    expect(joursDepuis('pas une date', maintenant)).toBeNull()
  })
})
