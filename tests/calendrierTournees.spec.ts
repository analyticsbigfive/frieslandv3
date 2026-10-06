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

describe('semaine du planning d\'équipe', () => {
  it('lundi de la semaine, y compris un dimanche', async () => {
    const { lundiDe } = await import('../utils/calendrierTournees')
    expect(lundiDe('2026-10-06')).toBe('2026-10-05') // mardi
    expect(lundiDe('2026-10-05')).toBe('2026-10-05') // lundi
    expect(lundiDe('2026-10-11')).toBe('2026-10-05') // dimanche
  })

  it('décale de semaine en semaine, à travers les mois', async () => {
    const { decalerSemaine } = await import('../utils/calendrierTournees')
    expect(decalerSemaine('2026-10-26', 1)).toBe('2026-11-02')
    expect(decalerSemaine('2026-10-05', -1)).toBe('2026-09-28')
  })

  it('lundi → samedi, dimanche seulement sur demande', async () => {
    const { joursSemaine } = await import('../utils/calendrierTournees')
    expect(joursSemaine('2026-10-05')).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'])
    expect(joursSemaine('2026-10-05', true).at(-1)).toBe('2026-10-11')
  })
})

describe('etatJourTournee', () => {
  const regle = { id: 'r1', user_id: 'u', days_of_week: [1, 2, 3, 4, 5, 6], is_active: true } as any
  const couvert = { regles: [regle], suspendues: [] }
  const libre = { regles: [], suspendues: [] }
  const auj = '2026-10-06'

  it('tournée passée ou du jour : faits / prévus, faite ou incomplète', async () => {
    const { etatJourTournee } = await import('../utils/calendrierTournees')
    expect(etatJourTournee({ nb_pdv: 20, nb_faits: 20 }, couvert, '2026-10-05', auj)).toMatchObject({ etat: 'faite', texte: '20/20 faits', progression: 100 })
    expect(etatJourTournee({ nb_pdv: 20, nb_faits: 5 }, couvert, auj, auj)).toMatchObject({ etat: 'incomplete', progression: 25 })
  })

  it('tournée à venir, annulée, règle sans tournée, suspension, jour libre', async () => {
    const { etatJourTournee } = await import('../utils/calendrierTournees')
    expect(etatJourTournee({ nb_pdv: 15, nb_faits: 0 }, couvert, '2026-10-09', auj)).toMatchObject({ etat: 'planifiee', texte: '15 PDV' })
    expect(etatJourTournee({ nb_pdv: 15, status: 'cancelled' }, couvert, '2026-10-09', auj).etat).toBe('annulee')
    expect(etatJourTournee(null, couvert, '2026-10-14', auj)).toMatchObject({ etat: 'a_generer', cliquable: true, regle })
    expect(etatJourTournee(null, couvert, '2026-10-01', auj).etat).toBe('non_generee')
    expect(etatJourTournee(null, { regles: [], suspendues: [{ regle, motif: 'Congé' }] }, '2026-10-14', auj)).toMatchObject({ etat: 'suspendue', texte: 'Congé', cliquable: false })
    expect(etatJourTournee(null, libre, '2026-10-14', auj)).toMatchObject({ etat: 'vide', cliquable: false, regle: null })
  })
})
