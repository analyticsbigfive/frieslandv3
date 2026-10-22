import { describe, it, expect } from 'vitest'
import {
  visiteLibre, bilanVisiteLibre, totalVisiteLibre, texteBilanVisiteLibre, texteObjectifVisiteLibre,
  objectifAtteint, remarquesVisiteLibre, type ObjectifsVisiteLibre,
} from '../utils/visiteLibre'

// Samedi (grille client) : Boutique 6, Porridge 1, Pushcart 1, Superette 1, Aboki & Kiosque 1.
const SAMEDI: ObjectifsVisiteLibre = {
  type: 'visite_libre',
  quotas: { 'Aboki & Kiosque': 1, Boutique: 6, Porridge: 1, Pushcart: 1, Superette: 1 },
  total: 10,
  realise: { Boutique: 4, Pushcart: 1 },
  nb_realise: 5,
  nb_visites: 7,
}

describe('visiteLibre', () => {
  it('reconnaît l\'objectif d\'un jour de visite libre', () => {
    expect(visiteLibre(SAMEDI)).toBe(SAMEDI)
    expect(visiteLibre(null)).toBeNull()
    expect(visiteLibre({})).toBeNull()
    expect(visiteLibre({ releve_stock: true })).toBeNull()
  })
})

describe('bilanVisiteLibre', () => {
  it('boutiques d\'abord, puis l\'ordre de la grille', () => {
    expect(bilanVisiteLibre(SAMEDI).map(l => l.canal)).toEqual(['Boutique', 'Superette', 'Aboki & Kiosque', 'Pushcart', 'Porridge'])
  })

  it('PDV comptés par type, jamais au-delà du quota', () => {
    const o = { ...SAMEDI, realise: { Boutique: 9 } }
    expect(bilanVisiteLibre(o)[0]).toEqual({ canal: 'Boutique', libelle: 'Boutiques', fait: 6, quota: 6 })
  })

  it('total et texte du jour', () => {
    expect(totalVisiteLibre(SAMEDI)).toEqual({ fait: 5, total: 10 })
    expect(texteBilanVisiteLibre(SAMEDI)).toBe('Boutiques 4/6 · Superettes 0/1 · Aboki & Kiosque 0/1 · Pushcarts 1/1 · Porridge 0/1')
    expect(texteObjectifVisiteLibre(SAMEDI)).toBe('Boutiques 6 · Superettes 1 · Aboki & Kiosque 1 · Pushcarts 1 · Porridge 1')
  })

  it('jour sans visite', () => {
    const o: ObjectifsVisiteLibre = { type: 'visite_libre', quotas: { Boutique: 6 }, total: 6 }
    expect(totalVisiteLibre(o)).toEqual({ fait: 0, total: 6 })
    expect(objectifAtteint(o)).toBe(false)
  })

  it('objectif atteint quand chaque type a son quota', () => {
    expect(objectifAtteint(SAMEDI)).toBe(false)
    expect(objectifAtteint({ ...SAMEDI, realise: { ...SAMEDI.quotas } })).toBe(true)
  })
})

describe('remarquesVisiteLibre', () => {
  it('rien pour une étape ordinaire ou une visite qui compte', () => {
    expect(remarquesVisiteLibre({ releve_stock: true })).toEqual([])
    expect(remarquesVisiteLibre({ visite_libre: true, canal: 'Boutique', compte: true })).toEqual([])
  })

  it('hors quota, hors grille, déjà vu, hors liste', () => {
    expect(remarquesVisiteLibre({ visite_libre: true, canal: 'Boutique', hors_quota: true })).toEqual(['Quota du type déjà atteint, ne compte pas'])
    expect(remarquesVisiteLibre({ visite_libre: true, canal: null, hors_quota: true })).toEqual(['Type hors grille, ne compte pas'])
    expect(remarquesVisiteLibre({ visite_libre: true, canal: 'Boutique', deja_ce_mois: true, hors_quota: true, hors_liste: true }))
      .toEqual(['Déjà vu ce mois-ci, ne compte pas', 'Hors de sa liste'])
  })
})
