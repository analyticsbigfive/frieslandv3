import { describe, it, expect } from 'vitest'
import { grilleMois, decalerMois, moisDe, couvertureJour } from '../utils/calendrierTournees'

describe('grilleMois', () => {
  it('commence un lundi et finit un dimanche, mois voisins compris', () => {
    const g = grilleMois('2026-10')
    expect(g[0]![0]).toBe('2026-09-28') // lundi
    expect(g.at(-1)!.at(-1)).toBe('2026-11-01') // dimanche
    expect(g.every(s => s.length === 7)).toBe(true)
    expect(g.flat()).toContain('2026-10-31')
  })

  it('gère un mois qui commence un lundi (pas de semaine vide en tête)', () => {
    expect(grilleMois('2026-06')[0]![0]).toBe('2026-06-01')
  })

  it('compte 6 semaines quand le mois déborde', () => {
    expect(grilleMois('2026-08')).toHaveLength(6) // 1er août = samedi, 31 = lundi
  })
})

describe('decalerMois / moisDe', () => {
  it('passe d\'une année à l\'autre', () => {
    expect(decalerMois('2026-12', 1)).toBe('2027-01')
    expect(decalerMois('2026-01', -1)).toBe('2025-12')
    expect(moisDe('2026-10-06')).toBe('2026-10')
  })
})

describe('couvertureJour', () => {
  const regle = {
    label: 'Portefeuille DMS',
    days_of_week: [1, 2, 3, 4, 5, 6],
    date_debut: '2026-09-29',
    date_fin: null,
    is_active: true,
    routing_template_exception: [
      { pdv_id: null, date_debut: '2026-10-12', date_fin: '2026-10-17', motif: 'Congés' },
      { pdv_id: 'P1', date_debut: '2026-10-06', date_fin: '2026-10-06', motif: 'PDV fermé' },
    ],
  }

  it('couvre un jour de la règle', () => {
    const c = couvertureJour([regle], '2026-10-06')
    expect(c.regles).toHaveLength(1)
    expect(c.suspendues).toHaveLength(0) // l'exception d'un seul PDV ne suspend pas la tournée
  })

  it('ne couvre pas le dimanche ni avant le début', () => {
    expect(couvertureJour([regle], '2026-10-11').regles).toHaveLength(0)
    expect(couvertureJour([regle], '2026-09-28').regles).toHaveLength(0)
  })

  it('signale une semaine décochée avec son motif', () => {
    const c = couvertureJour([regle], '2026-10-13')
    expect(c.regles).toHaveLength(0)
    expect(c.suspendues[0]!.motif).toBe('Congés')
  })

  it('ignore une règle inactive', () => {
    expect(couvertureJour([{ ...regle, is_active: false }], '2026-10-06').regles).toHaveLength(0)
  })
})
