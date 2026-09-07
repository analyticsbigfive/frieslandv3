import { describe, it, expect } from 'vitest'
import {
  QUESTIONS_COACHING,
  erreursIdentification,
  evaluationComplete,
  motifRequis,
  questionsDuBloc,
  reponsesVides,
  scoreCoaching,
} from '../utils/fieldCoaching'

// Lot 4 (1.0.4) : les 13 questions Kobo (8 visibilité + 5 promotion) gardent
// leur code, le score exclut les N/A.
describe('questionnaire field coaching', () => {
  it('compte 13 questions, 8 visibilité et 5 promotion, codes uniques', () => {
    expect(QUESTIONS_COACHING).toHaveLength(13)
    expect(questionsDuBloc('visibilite')).toHaveLength(8)
    expect(questionsDuBloc('promotion')).toHaveLength(5)
    expect(new Set(QUESTIONS_COACHING.map(q => q.code)).size).toBe(13)
  })

  it('réponses vides = incomplet ; N/A compte comme répondu', () => {
    const r = reponsesVides()
    expect(evaluationComplete(r)).toBe(false)
    for (const q of QUESTIONS_COACHING) r[q.code] = 'na'
    expect(evaluationComplete(r)).toBe(true)
  })

  it('score = oui / (oui + non), N/A exclus, null si rien d\'applicable', () => {
    const r = reponsesVides()
    const vis = questionsDuBloc('visibilite')
    r[vis[0].code] = 'oui'; r[vis[1].code] = 'oui'; r[vis[2].code] = 'non'
    for (const q of vis.slice(3)) r[q.code] = 'na'
    expect(scoreCoaching(r, 'visibilite')).toEqual({ oui: 2, non: 1, na: 5, taux: 67 })
    expect(scoreCoaching(r, 'promotion').taux).toBeNull()
    expect(scoreCoaching(r).taux).toBe(67)
  })
})

describe('libellés Kobo', () => {
  it('reprend les intitulés du formulaire et exige un motif si non-participation', () => {
    expect(QUESTIONS_COACHING.find(q => q.code === 'hot_spot')?.libelle).toBe('Présence dans le Hot Spot')
    expect(QUESTIONS_COACHING.find(q => q.code === 'respect_prix')?.libelle).toBe('Respect des prix')
    expect(motifRequis({ participation: 'non' })).toBe(true)
    expect(motifRequis({ participation: 'oui' })).toBe(false)
    expect(motifRequis({})).toBe(false)
  })
})

describe('identification', () => {
  it('exige PDV, distributeur, engin et une cohérence des SKU', () => {
    expect(erreursIdentification({})).toHaveLength(4)
    expect(erreursIdentification({ pdv_id: 'x', distributeur_nom: 'ABDI', vendeur_nom: 'KONE MOUSSA', engin_code: 'moto', nb_sku_pdv: 5, nb_sku_dispo: 7 }))
      .toEqual(['Le nombre de SKU disponibles ne peut pas dépasser le nombre de SKU en PDV.'])
    expect(erreursIdentification({ pdv_id: 'x', distributeur_nom: 'ABDI', vendeur_nom: 'KONE MOUSSA', engin_code: 'moto', nb_sku_pdv: 7, nb_sku_dispo: 5 })).toEqual([])
  })
})
