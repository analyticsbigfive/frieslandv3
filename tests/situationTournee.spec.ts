import { describe, it, expect } from 'vitest'
import {
  OPTIONS_FILTRE_SITUATION,
  badgeSituation,
  conditionFiltreSituation,
  estSituationIndisponible,
} from '../utils/situationTournee'

describe('badgeSituation — indication seulement', () => {
  it('aucun badge pour une visite prévue ou un jour sans tournée', () => {
    expect(badgeSituation('prevue')).toBeNull()
    expect(badgeSituation(null)).toBeNull()
    expect(badgeSituation(undefined)).toBeNull()
    expect(badgeSituation('inconnue')).toBeNull()
  })
  it('hors tournée et PDV créé sur place : la visite compte quand même', () => {
    expect(badgeSituation('hors_tournee')?.libelle).toBe('Hors tournée')
    expect(badgeSituation('pdv_cree_sur_place')?.libelle).toBe('PDV créé sur place')
    expect(badgeSituation('hors_tournee')?.aide).toMatch(/compte quand même/)
    expect(badgeSituation('pdv_cree_sur_place')?.aide).toMatch(/compte quand même/)
  })
  it('ajoutée le jour même : ne dit pas « visite libre » pour un pushcart à trouver', () => {
    const b = badgeSituation('ajoutee_jour')
    expect(b?.libelle).toBe('Ajoutée à la tournée du jour')
    expect(b?.aide).toMatch(/visite libre ou pushcart à trouver/)
  })
})

describe('conditionFiltreSituation', () => {
  it('hors tournée comprend les PDV créés sur place (« dont »)', () => {
    expect(conditionFiltreSituation('hors')).toEqual(['hors_tournee', 'pdv_cree_sur_place'])
    expect(conditionFiltreSituation('cree')).toEqual(['pdv_cree_sur_place'])
  })
  it('jour sans tournée = situation nulle ; « Toutes » = pas de filtre', () => {
    expect(conditionFiltreSituation('sans')).toBe('null')
    expect(conditionFiltreSituation('')).toBeNull()
    expect(conditionFiltreSituation('nimporte')).toBeNull()
  })
  it('chaque option du filtre a une condition, sauf « Toutes »', () => {
    for (const o of OPTIONS_FILTRE_SITUATION) {
      if (o.value) expect(conditionFiltreSituation(o.value)).not.toBeNull()
      else expect(conditionFiltreSituation(o.value)).toBeNull()
    }
  })
})

describe('estSituationIndisponible — migration 20261105120000 pas encore appliquée', () => {
  it('colonne calculée inconnue (42703) ou fonction absente (PGRST202)', () => {
    expect(estSituationIndisponible({ code: '42703', message: 'column visites.situation_tournee does not exist' })).toBe(true)
    expect(estSituationIndisponible({ code: 'PGRST202', message: 'Could not find the function public.recap_situation_tournee(p_debut, p_fin) in the schema cache' })).toBe(true)
  })
  it('une autre erreur n’est pas prise pour une migration manquante', () => {
    expect(estSituationIndisponible({ code: '42703', message: 'column visites.autre does not exist' })).toBe(false)
    expect(estSituationIndisponible({ code: '57014', message: 'canceling statement due to statement timeout' })).toBe(false)
    expect(estSituationIndisponible(null)).toBe(false)
    expect(estSituationIndisponible('erreur')).toBe(false)
  })
})
