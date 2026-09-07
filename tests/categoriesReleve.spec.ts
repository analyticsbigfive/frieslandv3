import { describe, it, expect } from 'vitest'
import {
  CATEGORIES_RELEVE_DEFAUT,
  categoriesActives,
  codesActifs,
  filtrerParCategoriesActives,
} from '../utils/categoriesReleve'

// Le client a retiré yaourt et céréales du relevé le 7 septembre 2026, et veut
// pouvoir les réactiver depuis l'admin. Le repli hors ligne doit refléter le
// retrait : un merchandiser sans réseau ne doit pas revoir ces étapes.
describe('CATEGORIES_RELEVE_DEFAUT', () => {
  it('ferme yaourt et céréales, garde les quatre familles laitières', () => {
    const actifs = codesActifs(CATEGORIES_RELEVE_DEFAUT)
    expect([...actifs].sort()).toEqual(['evap', 'imp', 'scm', 'uht'])
  })
})

describe('categoriesActives', () => {
  it('trie par ordre puis libellé et ignore les inactives', () => {
    const rows = [
      { code: 'scm', libelle: 'SCM', actif: true, ordre: 3 },
      { code: 'yaourt', libelle: 'Yaourt', actif: false, ordre: 1 },
      { code: 'evap', libelle: 'EVAP', actif: true, ordre: 1 },
      { code: 'imp', libelle: 'IMP', actif: true, ordre: 2 },
    ]
    expect(categoriesActives(rows).map(r => r.code)).toEqual(['evap', 'imp', 'scm'])
  })
})

describe('filtrerParCategoriesActives', () => {
  const rows = [
    { code: 'evap', libelle: 'EVAP', actif: true, ordre: 1 },
    { code: 'yaourt', libelle: 'Yaourt', actif: false, ordre: 2 },
  ]

  it('retire les étapes des catégories fermées', () => {
    const steps = [{ key: 'general' }, { key: 'evap' }, { key: 'yaourt' }, { key: 'concurrence' }]
    expect(filtrerParCategoriesActives(steps, rows, s => s.key).map(s => s.key))
      .toEqual(['general', 'evap', 'concurrence'])
  })

  it('conserve les étapes qui ne sont pas des catégories de relevé', () => {
    const steps = [{ key: 'photos' }, { key: 'actions' }]
    expect(filtrerParCategoriesActives(steps, rows, s => s.key)).toHaveLength(2)
  })

  it('conserve une catégorie inconnue du paramètre (table incomplète)', () => {
    const steps = [{ key: 'uht' }]
    expect(filtrerParCategoriesActives(steps, rows, s => s.key)).toHaveLength(1)
  })
})
