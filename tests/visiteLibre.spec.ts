import { describe, it, expect } from 'vitest'
import {
  visiteLibre, aTrouver, etapeAjoutee, bilanVisiteLibre, totalVisiteLibre, texteBilanVisiteLibre, texteObjectifVisiteLibre,
  objectifAtteint, remarquesVisiteLibre, progressionDuJour, type ObjectifsVisiteLibre,
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

describe('pushcarts à trouver', () => {
  const LUNDI = { type: 'a_trouver', quotas: { Pushcart: 2 }, total: 2, realise: { Pushcart: 1 } }

  it('objectif d\'un jour avec point de visite, distinct de la visite libre', () => {
    expect(aTrouver(LUNDI)).toBe(LUNDI)
    expect(visiteLibre(LUNDI)).toBeNull()
    expect(aTrouver(SAMEDI)).toBeNull()
    expect(texteBilanVisiteLibre(aTrouver(LUNDI)!)).toBe('Pushcarts 1/2')
    expect(objectifAtteint(aTrouver(LUNDI)!)).toBe(false)
  })

  it('étape ajoutée par une visite : remarques comme la visite libre', () => {
    expect(etapeAjoutee({ a_trouver: true, canal: 'Pushcart', compte: true })).toBe(true)
    expect(etapeAjoutee({ releve_stock: true })).toBe(false)
    expect(remarquesVisiteLibre({ a_trouver: true, canal: 'Pushcart', hors_quota: true, hors_liste: true }))
      .toEqual(['Quota du type déjà atteint, ne compte pas', 'Hors de sa liste'])
  })
})

// Compteur « Progression x/y » de l'app (1.0.17) : l'objectif du jour, pas
// les seules étapes (avant : 0/0 puis 1/1, 2/2… un jour de visite libre).
describe('progressionDuJour', () => {
  const GRILLE = { 'Aboki & Kiosque': 2, Boutique: 13, Porridge: 1, Pushcart: 2, Superette: 2 }

  it('jour libre vide : 0/20, pas 0/0', () => {
    const o = { type: 'visite_libre', quotas: GRILLE, total: 20, realise: {}, nb_realise: 0, nb_visites: 0 }
    expect(progressionDuJour(o, { total: 0, faits: 0 })).toMatchObject({ fait: 0, total: 20, libre: true })
  })

  it('après une visite qui compte : 1/20, pas 1/1', () => {
    const o = { type: 'visite_libre', quotas: GRILLE, total: 20, realise: { Boutique: 1 }, nb_realise: 1, nb_visites: 1 }
    expect(progressionDuJour(o, { total: 1, faits: 1 })).toMatchObject({ fait: 1, total: 20 })
  })

  it('PDV déjà vu ce mois-ci ou type au-delà du quota : la visite ne compte pas (cas du 29/10 : 14 visites, 5 comptent)', () => {
    const o = { type: 'visite_libre', quotas: GRILLE, total: 20, realise: { Boutique: 5 }, nb_realise: 5, nb_visites: 14 }
    expect(progressionDuJour(o, { total: 14, faits: 14 })).toMatchObject({ fait: 5, total: 20 })
  })

  it('quota d\'un type dépassé : plafonné au quota', () => {
    const o = { type: 'visite_libre', quotas: GRILLE, total: 20, realise: { Superette: 4 }, nb_realise: 4, nb_visites: 4 }
    expect(progressionDuJour(o, { total: 4, faits: 4 })).toMatchObject({ fait: 2, total: 20 })
  })

  it('jour normal avec 2 pushcarts à trouver : 0/20 au lieu de 0/18', () => {
    const debut = { type: 'a_trouver', quotas: { Pushcart: 2 }, total: 2, realise: {}, nb_realise: 0, nb_visites: 0 }
    expect(progressionDuJour(debut, { total: 18, faits: 0 })).toMatchObject({ fait: 0, total: 20, libre: false })
    // 10 PDV imposés faits, un pushcart trouvé (ajouté à la tournée).
    const milieu = { type: 'a_trouver', quotas: { Pushcart: 2 }, total: 2, realise: { Pushcart: 1 }, nb_realise: 1, nb_visites: 1 }
    expect(progressionDuJour(milieu, { total: 19, faits: 11 })).toMatchObject({ fait: 11, total: 20 })
    // Pas d'« objectif atteint » à 18 sans pushcart.
    expect(progressionDuJour(debut, { total: 18, faits: 18 })).toMatchObject({ fait: 18, total: 20 })
  })

  it('tournée Friesland ou agent sans objectif : les compteurs tels quels', () => {
    expect(progressionDuJour(null, { total: 42, faits: 7 })).toEqual({ fait: 7, total: 42, libre: false, objectifs: null })
    expect(progressionDuJour({ releve_stock: true }, { total: 3, faits: 1 })).toMatchObject({ fait: 1, total: 3 })
  })
})
