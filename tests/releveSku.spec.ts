import { describe, expect, it } from 'vitest'
import { releveSku, skuIsAvailable } from '../utils/products'
import { skuDisponibleReleve, skuPresentReleve } from '../utils/perfectStore'

describe('releveSku', () => {
  it('lit les quantités du nouveau format', () => {
    expect(releveSku({ quantites: { br_20g: 3 } }, 'br_20g')).toEqual({ quantite: 3, disponibilite: 'disponible', prix: null })
    expect(releveSku({ quantites: { br_20g: 0 } }, 'br_20g').disponibilite).toBe('rupture')
  })

  it('lit les statuts texte de l\'ancien format', () => {
    expect(releveSku({ br_gold: 'Disponible' }, 'br_gold').disponibilite).toBe('disponible')
    expect(releveSku({ br_gold: 'Présent , Disponible , Prix respecté' }, 'br_gold')).toEqual({ quantite: null, disponibilite: 'disponible', prix: 'respecte' })
    expect(releveSku({ br_gold: 'En rupture' }, 'br_gold').disponibilite).toBe('rupture')
    expect(releveSku({ br_gold: 'Présent , En rupture' }, 'br_gold').disponibilite).toBe('contradictoire')
    expect(releveSku({ br_gold: 'Présent' }, 'br_gold').disponibilite).toBe('present')
    expect(releveSku({ br_gold: 'Présent , Prix respecté' }, 'br_gold').disponibilite).toBe('present')
    expect(releveSku({ br_gold: 'Prix respecté' }, 'br_gold').disponibilite).toBe('indetermine')
    expect(releveSku({ br_gold: 'Disponible , Prix non respecté' }, 'br_gold').prix).toBe('non_respecte')
    expect(releveSku({}, 'br_gold')).toEqual({ quantite: null, disponibilite: 'non_renseigne', prix: null })
  })

  it('compte « Disponible » seul comme disponible', () => {
    expect(skuIsAvailable({ br_gold: 'Disponible' }, 'br_gold')).toBe(true)
    expect(skuIsAvailable({ br_gold: 'En rupture' }, 'br_gold')).toBe(false)
    expect(skuIsAvailable({ br_gold: 'Présent' }, 'br_gold')).toBe(false)
  })
})

describe('Perfect Store : relevé par statut (miroir de 20261010160000)', () => {
  it('disponible : quantité si saisie, sinon « Disponible » sans « En rupture »', () => {
    expect(skuDisponibleReleve({ br: 'Présent , Disponible , Prix respecté' }, 'br', 4)).toBe(true)
    expect(skuDisponibleReleve({ br: 'Présent' }, 'br', 4)).toBe(false)
    expect(skuDisponibleReleve({ br: 'Disponible , En rupture' }, 'br', 4)).toBe(false)
    expect(skuDisponibleReleve({ br: 'Disponible', quantites: { br: 2 } }, 'br', 4)).toBe(false)
    expect(skuDisponibleReleve({ quantites: { br: 6 }, facings: { br: 1 } }, 'br', 4, 2)).toBe(false)
    expect(skuDisponibleReleve({ quantites: { br: 6 }, facings: { br: 3 } }, 'br', 4, 2)).toBe(true)
  })

  it('présent : « Présent » ou « Disponible », sans « En rupture »', () => {
    expect(skuPresentReleve({ br: 'Présent' }, 'br')).toBe(true)
    expect(skuPresentReleve({ br: 'Disponible' }, 'br')).toBe(true)
    expect(skuPresentReleve({ br: 'Présent , En rupture' }, 'br')).toBe(false)
    expect(skuPresentReleve({ br: 'Prix respecté' }, 'br')).toBe(false)
    expect(skuPresentReleve({ quantites: { br: 0 } }, 'br')).toBe(false)
  })
})
