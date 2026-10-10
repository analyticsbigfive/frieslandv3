import { describe, expect, it } from 'vitest'
import { releveSku, skuIsAvailable } from '../utils/products'

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
    expect(releveSku({ br_gold: 'Prix respecté' }, 'br_gold').disponibilite).toBe('indetermine')
    expect(releveSku({ br_gold: 'Disponible , Prix non respecté' }, 'br_gold').prix).toBe('non_respecte')
    expect(releveSku({}, 'br_gold')).toEqual({ quantite: null, disponibilite: 'non_renseigne', prix: null })
  })

  it('compte « Disponible » seul comme disponible', () => {
    expect(skuIsAvailable({ br_gold: 'Disponible' }, 'br_gold')).toBe(true)
    expect(skuIsAvailable({ br_gold: 'En rupture' }, 'br_gold')).toBe(false)
  })
})
