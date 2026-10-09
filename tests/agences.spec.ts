import { describe, it, expect } from 'vitest'
import { AGENCES_DEFAUT, estMerchandiserProgramme, libelleDirection } from '../utils/agences'
import { estCompteTest, inventaireComptes } from '../utils/adoptionApp'

describe('agences', () => {
  it('Atom et toute agence « programme » suivent le programme ; FrieslandCampina non', () => {
    expect(estMerchandiserProgramme('atom')).toBe(true)
    expect(estMerchandiserProgramme('friesland')).toBe(false)
    expect(estMerchandiserProgramme(null)).toBe(false)
    // Hors ligne (liste inconnue) : une agence est un programme.
    expect(estMerchandiserProgramme('agence-north')).toBe(true)
    // Liste connue : son réglage fait foi.
    expect(estMerchandiserProgramme('agence-north', [...AGENCES_DEFAUT, { code: 'agence-north', nom: 'N', direction: 'north', programme: false, actif: true, ordre: 30 }])).toBe(false)
  })
  it('libellés de direction', () => {
    expect(libelleDirection('south', true)).toBe('South')
    expect(libelleDirection('mt')).toBe('Modern Trade')
    expect(libelleDirection(null)).toBe('—')
  })
})

describe('inventaire des licences', () => {
  const comptes = [
    { nom: 'KONAN Sonia', email: 'sonia.commercial@x.ci', role: 'commercial', direction: 'mt' },
    { nom: 'Sonia Konan', email: 'sonia.merch@x.ci', role: 'merchandiser', direction: 'mt' },
    { nom: 'Abbé Frédéric', email: 'attecoubeone@gmail.com', role: 'merchandiser', direction: 'south' },
    { nom: 'QA Atom', email: 'qa.atom@friesland-test.ci', role: 'merchandiser', direction: 'south' },
    { nom: 'Admin', email: 'admin@friesland.ci', role: 'admin', direction: null },
  ]
  const inv = inventaireComptes(comptes, ['merchandiser', 'commercial', 'admin'])
  it('exclut les comptes de test', () => {
    expect(estCompteTest('qa.atom@friesland-test.ci')).toBe(true)
    expect(estCompteTest('admin@friesland.ci')).toBe(false)
    expect(inv.total).toBe(4)
    expect(inv.tests).toBe(1)
  })
  it('compte par direction et par rôle', () => {
    const mt = inv.lignes.find(l => l.direction === 'mt')!
    expect(mt.parRole).toEqual({ merchandiser: 1, commercial: 1, admin: 0 })
    expect(inv.lignes.find(l => l.direction === 'south')!.total).toBe(1)
    expect(inv.lignes.find(l => l.direction === null)!.parRole.admin).toBe(1)
  })
  it('signale les personnes à deux comptes (ordre des mots indifférent)', () => {
    expect(inv.doubles).toHaveLength(1)
    expect(inv.doubles[0].map(c => c.role)).toEqual(['commercial', 'merchandiser'])
  })
})
