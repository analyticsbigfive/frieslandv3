import { describe, it, expect } from 'vitest'
import {
  objectifsParCanal, regleSAppliqueLe, joursDeLaPlage, jourSemaine, pdvDistinctsParCanal, totalGrille,
  type QuotaCanal, type RegleQuota,
} from '../utils/objectifsAtom'

// Grille client (docs/TOURNEES-ATOM-QUOTAS.md), jour_semaine 1 = lundi … 6 = samedi.
const GRILLE: QuotaCanal[] = ([
  ['Superette', [2, 2, 2, 2, 1, 1]],
  ['Boutique', [13, 13, 13, 13, 11, 6]],
  ['Aboki & Kiosque', [2, 2, 2, 2, 1, 1]],
  ['Pushcart', [2, 2, 2, 2, 1, 1]],
  ['Porridge', [1, 1, 1, 1, 1, 1]],
] as [string, number[]][]).flatMap(([canal, q]) => q.map((quota, i) => ({ canal, jour_semaine: i + 1, quota })))

// Règle « Portefeuille DMS » telle qu'en base : lundi → samedi, depuis le 29/09.
const REGLE: RegleQuota = { id: 'r1', days_of_week: [1, 2, 3, 4, 5, 6], date_debut: '2026-09-29', date_fin: null, is_active: true }

describe('joursDeLaPlage / jourSemaine', () => {
  it('bornes incluses, passage de mois', () => {
    expect(joursDeLaPlage('2026-09-29', '2026-10-02')).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'])
  })

  it('plage inversée : aucun jour', () => {
    expect(joursDeLaPlage('2026-10-05', '2026-10-01')).toEqual([])
  })

  it('jour de semaine local (0 = dimanche)', () => {
    expect(jourSemaine('2026-10-05')).toBe(1) // lundi
    expect(jourSemaine('2026-10-04')).toBe(0) // dimanche
  })
})

describe('regleSAppliqueLe (filtre de routing_regles_du_jour)', () => {
  it('jours de la règle, pas le dimanche', () => {
    expect(regleSAppliqueLe(REGLE, '2026-10-05')).toBe(true)
    expect(regleSAppliqueLe(REGLE, '2026-10-04')).toBe(false)
  })

  it('avant date_debut ou après date_fin : non', () => {
    expect(regleSAppliqueLe(REGLE, '2026-09-28')).toBe(false)
    expect(regleSAppliqueLe({ ...REGLE, date_fin: '2026-10-10' }, '2026-10-12')).toBe(false)
  })

  it('règle inactive : non', () => {
    expect(regleSAppliqueLe({ ...REGLE, is_active: false }, '2026-10-05')).toBe(false)
  })

  it('champ historique day_of_week si days_of_week est nul', () => {
    expect(regleSAppliqueLe({ id: 'r2', days_of_week: null, day_of_week: 1 }, '2026-10-05')).toBe(true)
    expect(regleSAppliqueLe({ id: 'r2', days_of_week: null, day_of_week: 1 }, '2026-10-06')).toBe(false)
  })

  it('suspension de toute la règle, mais pas une exception sur un seul PDV', () => {
    const suspension = { template_id: 'r1', pdv_id: null, date_debut: '2026-10-05', date_fin: '2026-10-06' }
    expect(regleSAppliqueLe(REGLE, '2026-10-05', [suspension])).toBe(false)
    expect(regleSAppliqueLe(REGLE, '2026-10-07', [suspension])).toBe(true)
    expect(regleSAppliqueLe(REGLE, '2026-10-05', [{ ...suspension, pdv_id: 'abc' }])).toBe(true)
  })
})

describe('objectifsParCanal', () => {
  it('semaine pleine (lundi → dimanche) : la colonne /sem de la grille', () => {
    const { parCanal, joursActifs } = objectifsParCanal(GRILLE, [REGLE], '2026-10-05', '2026-10-11')
    expect(joursActifs).toBe(6)
    expect(parCanal).toMatchObject({ 'Superette': 10, 'Boutique': 69, 'Aboki & Kiosque': 10, 'Pushcart': 10, 'Porridge': 6 })
    expect(totalGrille(parCanal)).toBe(105)
  })

  it('mois d’octobre 2026 : 4 lun/mar/mer, 5 jeu/ven/sam', () => {
    const { parCanal, joursActifs } = objectifsParCanal(GRILLE, [REGLE], '2026-10-01', '2026-10-31')
    expect(joursActifs).toBe(27)
    // 3 × 4 × 20 + 5 × 20 + 5 × 15 + 5 × 10
    expect(totalGrille(parCanal)).toBe(465)
    expect(parCanal.Pushcart).toBe(4 * 2 * 3 + 5 * 2 + 5 * 1 + 5 * 1)
  })

  it('la règle démarre en cours de semaine : seuls les jours couverts comptent', () => {
    // Semaine du 28/09 : la règle ne court qu'à partir du mardi 29.
    const { joursActifs, parCanal } = objectifsParCanal(GRILLE, [REGLE], '2026-09-28', '2026-10-04')
    expect(joursActifs).toBe(5)
    expect(totalGrille(parCanal)).toBe(105 - 20)
  })

  it('deux règles le même jour ne doublent pas la grille', () => {
    const { parCanal } = objectifsParCanal(GRILLE, [REGLE, { ...REGLE, id: 'r2' }], '2026-10-05', '2026-10-05')
    expect(totalGrille(parCanal)).toBe(20)
  })

  it('aucune règle : objectif nul', () => {
    const { parCanal, joursActifs } = objectifsParCanal(GRILLE, [], '2026-10-01', '2026-10-31')
    expect(joursActifs).toBe(0)
    expect(totalGrille(parCanal)).toBe(0)
  })

  it('canal inconnu dans la grille : ignoré', () => {
    const { parCanal } = objectifsParCanal([{ canal: 'Grossiste', jour_semaine: 1, quota: 5 }], [REGLE], '2026-10-05', '2026-10-05')
    expect(totalGrille(parCanal)).toBe(0)
  })
})

describe('pdvDistinctsParCanal', () => {
  it('un PDV compte une fois, hors grille à part', () => {
    const r = pdvDistinctsParCanal([
      { pdv_id: 'a', sous_categorie_pdv: 'Pushcard A' },
      { pdv_id: 'a', sous_categorie_pdv: 'Pushcard A' },
      { pdv_id: 'b', sous_categorie_pdv: 'Boutique C' },
      { pdv_id: 'c', sous_categorie_pdv: 'Wholesalers' },
      { pdv_id: 'd', sous_categorie_pdv: null },
    ])
    expect(r).toMatchObject({ 'Pushcart': 1, 'Boutique': 1, 'Hors grille': 2 })
    expect(totalGrille(r)).toBe(2)
  })
})
