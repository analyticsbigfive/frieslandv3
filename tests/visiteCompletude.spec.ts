import { describe, it, expect } from 'vitest'
import {
  categorieRenseignee,
  completudeReleve,
  visibiliteRenseignee,
} from '../utils/visiteCompletude'

// Règle centrale : une clé PRÉSENTE dans `quantites` vaut « répondu », y
// compris à 0 (« rupture »). Une clé absente vaut « non renseigné ».
// Miroir de setQty (pages/mobile/visites/new.vue:971), qui écrit toujours un
// nombre >= 0.
describe('catégorie renseignée', () => {
  it('une quantité à 0 compte comme renseignée — 0 est une réponse', () => {
    expect(categorieRenseignee({ quantites: { br_160g: 0 } })).toBe(true)
  })

  it('un bloc sans quantité ne compte pas', () => {
    expect(categorieRenseignee({ present: false, quantites: {} })).toBe(false)
    expect(categorieRenseignee({ present: true })).toBe(false)
  })

  it('tolère les visites importées, sans payload structuré', () => {
    expect(categorieRenseignee(undefined)).toBe(false)
    expect(categorieRenseignee(null)).toBe(false)
    expect(categorieRenseignee({ quantites: null })).toBe(false)
    expect(categorieRenseignee('nimporte quoi')).toBe(false)
  })
})

describe('visibilité renseignée', () => {
  it('un seul standard suffit, même à false', () => {
    expect(visibiliteRenseignee({ visibilite: { standards: { tg: false } } })).toBe(true)
  })

  it('standards vide ou absent', () => {
    expect(visibiliteRenseignee({ visibilite: { standards: {} } })).toBe(false)
    expect(visibiliteRenseignee({ visibilite: {} })).toBe(false)
    expect(visibiliteRenseignee(null)).toBe(false)
  })
})

describe('complétude du relevé', () => {
  // Le cas majoritaire en base : visite importée d'AppSheet, sans questionnaire.
  it('une visite vide vaut 0 % et se signale comme vide', () => {
    const c = completudeReleve({ produits: {}, visibilite: { standards: {} } })
    expect(c.pct).toBe(0)
    expect(c.vide).toBe(true)
    expect(c.manquantes).toContain('EVAP')
    expect(c.manquantes).toContain('Visibilité')
  })

  it('un payload absent ne fait pas échouer le calcul', () => {
    expect(completudeReleve(null).pct).toBe(0)
    expect(completudeReleve(undefined).vide).toBe(true)
  })

  it('une visite complète vaut 100 %', () => {
    const data = {
      produits: {
        evap: { quantites: { br_160g: 19 } },
        imp: { quantites: { br_20g: 0 } },
        scm: { quantites: { br_1kg: 2 } },
        uht: { quantites: { brique_1l: 1 } },
        yaourt: { quantites: { brcv: 3 } },
        cereales: { quantites: { brcc: 4 } },
      },
      visibilite: { standards: { tg: true } },
    }
    const c = completudeReleve(data)
    expect(c.pct).toBe(100)
    expect(c.vide).toBe(false)
    expect(c.manquantes).toEqual([])
  })

  it('une visite partielle situe précisément ce qui manque', () => {
    const data = { produits: { evap: { quantites: { br_160g: 5 } } }, visibilite: { standards: { tg: true } } }
    // 2 sections remplies sur 7 attendues (6 familles + visibilité)
    const c = completudeReleve(data)
    expect(c.pct).toBe(29)
    expect(c.manquantes).toEqual(['IMP', 'SCM', 'UHT', 'Yaourt', 'Céréales'])
  })

  // Yaourt et céréales ont été désactivés dans l'admin au lot 6 : ne pas les
  // réclamer, sinon aucune visite ne peut plus atteindre 100 %.
  it('ne réclame que les catégories actives', () => {
    const data = {
      produits: { evap: { quantites: { br_160g: 5 } }, imp: { quantites: { br_20g: 1 } } },
      visibilite: { standards: { tg: true } },
    }
    const c = completudeReleve(data, ['evap', 'imp'])
    expect(c.pct).toBe(100)
    expect(c.sections).toHaveLength(3)
  })
})
