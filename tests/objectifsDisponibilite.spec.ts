import { describe, it, expect } from 'vitest'
import {
  canalObjectif, cibleNationale, etatObjectif, ecartPoints, trimestreDe, trimestrePrecedent, trimestresProposes,
  cleTrimestre, lireCleTrimestre, indexer, cleLigne, PRODUITS, libelleIndicateur,
  type LigneObjectif,
} from '../utils/objectifsDisponibilite'

describe('canalObjectif (miroir de canal_objectif, migration 20261014130000)', () => {
  it('Modern trade l’emporte sur la région', () => {
    expect(canalObjectif('Modern trade', 'ABIDJAN 1', 'ABIDJAN')).toBe('MT')
    expect(canalObjectif('modern trade', 'CNO', null)).toBe('MT')
  })

  it('région du PDV : Abidjan 1/2, puis CNO / CNE / C', () => {
    expect(canalObjectif('General trade', 'ABIDJAN 2', null)).toBe('GT_ABIDJAN')
    expect(canalObjectif('General trade', 'Abidjan', null)).toBe('GT_ABIDJAN')
    expect(canalObjectif('General trade', 'CNE', 'ABIDJAN')).toBe('GT_UPC')
    expect(canalObjectif('General trade', 'C', null)).toBe('GT_UPC')
  })

  it('sans région utile : division du territoire, sinon rien', () => {
    expect(canalObjectif('General trade', 'MODERN TRADE', 'ABIDJAN')).toBe('GT_ABIDJAN')
    expect(canalObjectif('General trade', null, 'UP COUNTRY')).toBe('GT_UPC')
    expect(canalObjectif('General trade', null, null)).toBeNull()
  })
})

describe('etatObjectif', () => {
  it('atteint, proche (5 points), en retard, sur les valeurs arrondies affichées', () => {
    expect(etatObjectif(88, 88)).toBe('atteint')
    expect(etatObjectif(90.7, 91)).toBe('atteint') // « 91 % / objectif 91 % »
    expect(etatObjectif(83, 88)).toBe('proche')
    expect(etatObjectif(82.4, 88)).toBe('retard')
  })

  it('moins de 30 points de vente : pas de verdict', () => {
    expect(etatObjectif(0, 60, 3)).toBe('base_faible')
    expect(etatObjectif(95, 60, 29)).toBe('base_faible')
    expect(etatObjectif(95, 60, 30)).toBe('atteint')
  })

  it('objectif absent ou nul (PLV extérieure en MT) : pas d’objectif', () => {
    expect(etatObjectif(40, null)).toBe('sans_objectif')
    expect(etatObjectif(0, 0)).toBe('sans_objectif')
  })

  it('aucun PDV mesuré : pas de relevé', () => {
    expect(etatObjectif(null, 60)).toBe('sans_mesure')
    expect(etatObjectif(0, 60, 0)).toBe('sans_mesure')
  })

  it('écart en points arrondis', () => {
    expect(ecartPoints(40.4, 55)).toBe(-15)
    expect(ecartPoints(null, 55)).toBeNull()
  })
})

describe('cibleNationale', () => {
  it('moyenne des canaux qui ont un objectif (Délice : seul le MT en a un au T2)', () => {
    expect(cibleNationale([55, 45, 95])).toBe(65)
    expect(cibleNationale([null, undefined, 35])).toBe(35)
    expect(cibleNationale([])).toBeNull()
  })
})

describe('trimestres', () => {
  it('trimestre civil', () => {
    expect(trimestreDe(new Date(2026, 9, 14))).toEqual({ annee: 2026, trimestre: 4 })
    expect(trimestreDe(new Date(2026, 0, 1))).toEqual({ annee: 2026, trimestre: 1 })
    expect(trimestreDe(new Date(2026, 5, 30))).toEqual({ annee: 2026, trimestre: 2 })
  })

  it('précédent, clé d’URL', () => {
    expect(trimestrePrecedent({ annee: 2027, trimestre: 1 })).toEqual({ annee: 2026, trimestre: 4 })
    expect(cleTrimestre({ annee: 2026, trimestre: 3 })).toBe('2026-T3')
    expect(lireCleTrimestre('2026-T3')).toEqual({ annee: 2026, trimestre: 3 })
    expect(lireCleTrimestre('2026-T5')).toBeNull()
  })

  it('liste du plus récent à T1 2026, trimestre courant « en cours »', () => {
    const l = trimestresProposes({ annee: 2026, trimestre: 4 }, { annee: 2026, trimestre: 4 })
    expect(l.map(x => x.value)).toEqual(['2026-T4', '2026-T3', '2026-T2', '2026-T1'])
    expect(l[0].label).toBe('T4 2026 (en cours)')
    expect(l[1].label).toBe('T3 2026 (juillet à septembre)')
    expect(trimestresProposes({ annee: 2027, trimestre: 1 }, { annee: 2026, trimestre: 4 })[0].label).toBe('T1 2027 (janvier à mars)')
  })
})

describe('indexer / cleLigne', () => {
  const ligne = (p: Partial<LigneObjectif>): LigneObjectif => ({
    canal: 'GT_ABIDJAN', indicateur: 'dispo', reference_produit_id: 2, reference_nom: 'BR 150g', categorie: 'evap',
    mesures: 10, atteints: 8, hors_calcul: 0, taux: 80, cible: 88, ...p,
  })

  it('une ligne par produit, par PLV, par famille de prix ; une case par canal', () => {
    const m = indexer([
      ligne({}),
      ligne({ canal: 'MT', taux: 95 }),
      ligne({ indicateur: 'prix', reference_produit_id: null, categorie: 'imp' }),
      ligne({ indicateur: 'plv_interieure', reference_produit_id: null, categorie: null }),
    ])
    expect([...m.keys()]).toEqual(['dispo:2', 'prix:imp', 'plv_interieure'])
    expect(m.get('dispo:2')?.MT?.taux).toBe(95)
    expect(cleLigne({ indicateur: 'prix', reference_produit_id: null, categorie: 'evap' })).toBe('prix:evap')
  })

  it('15 produits, ordre du fichier, libellés en clair', () => {
    expect(PRODUITS).toHaveLength(15)
    expect(new Set(PRODUITS.map(p => p.id)).size).toBe(15)
    expect(PRODUITS[0].label).toBe('Bonnet Rouge 380 g')
    expect(libelleIndicateur('prix', 'scm')).toBe('Prix respectés : Lait concentré sucré (SCM)')
  })
})
