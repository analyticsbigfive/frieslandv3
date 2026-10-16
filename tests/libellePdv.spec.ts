import { describe, it, expect } from 'vitest'
import { libellePdv } from '../utils/libellePdv'

describe('libellePdv', () => {
  it('affiche le nom du PDV quand il est lisible', () => {
    expect(libellePdv({ pdv: { nom_pdv: 'Boutique Awa' }, pdv_id: 'AB12' })).toBe('Boutique Awa')
  })
  it('signale un PDV hors secteur au lieu du code seul', () => {
    expect(libellePdv({ pdv: null, pdv_id: 'AB12' })).toBe('PDV hors secteur · AB12')
  })
  it('tolère une ligne vide', () => {
    expect(libellePdv(undefined)).toBe('PDV hors secteur')
  })
})
