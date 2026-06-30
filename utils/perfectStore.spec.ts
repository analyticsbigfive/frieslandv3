import { describe, it, expect } from 'vitest'
import {
  computeOsa,
  scorePerfectStore,
  tradeTypeForCanal,
  type PerfectStoreRefs,
} from './perfectStore'

// ============================================================
// 1) Parité du sous-moteur OSA — fichier source EVAP GT (taux_vente)
//    linéaire 83/50/67 ; pondérée 92/14/91 (héros br_160g = 75%)
// ============================================================
const SKUS = ['br_160g', 'brb_160g', 'br_400g', 'brb_400g', 'br_gold', 'pearl_400g']
const W: Record<string, number> = {
  br_160g: 0.75, brb_160g: 0.08, br_400g: 0.05, brb_400g: 0.01, br_gold: 0.01, pearl_400g: 0.10,
}
const dispo = (p: number[]) => Object.fromEntries(SKUS.map((s, i) => [s, p[i] === 1]))

describe('EVAP GT — parité fichier source (taux_vente)', () => {
  const cases = [
    { name: 'PDV1', p: [1, 0, 1, 1, 1, 1], lin: 0.8333, pond: 0.92, note: 9.2 },
    { name: 'PDV2', p: [0, 1, 1, 0, 1, 0], lin: 0.5, pond: 0.14, note: 1.4 },
    { name: 'PDV3', p: [1, 0, 1, 0, 1, 1], lin: 0.6667, pond: 0.91, note: 9.1 },
  ]
  for (const c of cases) {
    it(c.name, () => {
      const r = computeOsa(dispo(c.p), W)
      expect(r.osaLineaire!).toBeCloseTo(c.lin, 4)
      expect(r.osaPondere!).toBeCloseTo(c.pond, 4)
      expect(r.osaPondere! * 10).toBeCloseTo(c.note, 2)
    })
  }
})

// ============================================================
// 2) Scorer complet — fixture de référentiels figée (EVAP BOUTIQUE A, GT)
//    Vérifie OSA + gating tier avec une config de seuils figée.
// ============================================================
function makeRefs(): PerfectStoreRefs {
  return {
    posStandardMap: { 'Boutique A': { standard_group: 'BOUTIQUE', tier: 'A' } },
    availabilityStandards: [
      { category: 'evap', sku: 'br_160g', standard_group: 'BOUTIQUE', tier: 'A', min_quantity: 48 },
      { category: 'evap', sku: 'brb_160g', standard_group: 'BOUTIQUE', tier: 'A', min_quantity: 24 },
      { category: 'evap', sku: 'br_400g', standard_group: 'BOUTIQUE', tier: 'A', min_quantity: 24 },
      { category: 'evap', sku: 'brb_400g', standard_group: 'BOUTIQUE', tier: 'A', min_quantity: 12 },
      { category: 'evap', sku: 'br_gold', standard_group: 'BOUTIQUE', tier: 'A', min_quantity: 24 },
      { category: 'evap', sku: 'pearl_400g', standard_group: 'BOUTIQUE', tier: 'A', min_quantity: 24 },
    ],
    availabilityWeights: SKUS.map(sku => ({ category: 'evap', trade_type: 'GT', basis: 'taux_vente', sku, weight: W[sku] })),
    // min_sku_present=5 -> PDV1 (5 dispo) atteint assort=1.0
    assortmentStandards: [{ standard_group: 'BOUTIQUE', tier: 'A', min_sku_present: 5 }],
    // 1 élément visibilité requis (objectif BASIC) -> testable à 100%
    visibilityStandards: [
      { standard_group: 'BOUTIQUE', ps_tier: 'BASIC', zone: 'exterieure', element_key: 'poster', is_required: true },
    ],
    tierConfig: [
      { ps_tier: 'FLAGSHIP', osa_min: 0.95, assort_min: 1.0, visi_min: 1.0, promo_min: null, rang: 4 },
      { ps_tier: 'VIP', osa_min: 0.85, assort_min: 0.9, visi_min: 1.0, promo_min: null, rang: 3 },
      { ps_tier: 'CORE', osa_min: 0.75, assort_min: 0.8, visi_min: 1.0, promo_min: null, rang: 2 },
      { ps_tier: 'BASIC', osa_min: 0.60, assort_min: 0.6, visi_min: 1.0, promo_min: null, rang: 1 },
    ],
    scoreConfig: { w_osa_lineaire: 0.10, w_osa_pondere: 0.45, w_assortiment: 0.15, w_visibilite: 0.30 },
  }
}

// quantités telles que dispo = [br_160g✓, brb_160g✗, br_400g✓, brb_400g✓, br_gold✓, pearl_400g✓]  (PDV1)
const pdv1Data: any = {
  produits: {
    evap: { quantites: { br_160g: 48, brb_160g: 0, br_400g: 24, brb_400g: 12, br_gold: 24, pearl_400g: 24 } },
  },
  visibilite: { exterieure: { poster: true } }, // élément requis présent -> visi 100%
}
// PDV2 : dispo = [✗,✓,✓,✗,✓,✗]
const pdv2Data: any = {
  produits: {
    evap: { quantites: { br_160g: 0, brb_160g: 24, br_400g: 24, brb_400g: 0, br_gold: 24, pearl_400g: 0 } },
  },
  visibilite: {},
}
const pdv = { sous_categorie_pdv: 'Boutique A', canal: 'General trade', objectif_perfect_store: 'BASIC' }

describe('scorePerfectStore — gating tier (config figée)', () => {
  it('PDV1 : OSA pondérée 0.92 + assort 1.0 + visi 1.0 -> VIP', () => {
    const r = scorePerfectStore(pdv1Data, pdv, makeRefs(), 'taux_vente')
    expect(r.osaLineaire!).toBeCloseTo(0.8333, 4)
    expect(r.osaPondere!).toBeCloseTo(0.92, 4)
    expect(r.tierAtteint).toBe('VIP')
    expect(r.isPerfectStore).toBe(true)
  })

  it('PDV2 : OSA pondérée 0.14 -> aucun tier', () => {
    const r = scorePerfectStore(pdv2Data, pdv, makeRefs(), 'taux_vente')
    expect(r.osaPondere!).toBeCloseTo(0.14, 4)
    expect(r.tierAtteint).toBeNull()
    expect(r.isPerfectStore).toBe(false)
  })

  it('PDV sans mapping standard -> piliers nuls, pas de PS', () => {
    const r = scorePerfectStore(pdv1Data, { sous_categorie_pdv: 'Inconnu', canal: 'GT' }, makeRefs())
    expect(r.osaLineaire).toBeNull()
    expect(r.osaPondere).toBeNull()
    // assort null -> COALESCE 1 ; osa 0 < 0.60 -> aucun tier
    expect(r.isPerfectStore).toBe(false)
  })
})

describe('tradeTypeForCanal', () => {
  it('détecte MT', () => {
    expect(tradeTypeForCanal('Modern trade')).toBe('MT')
    expect(tradeTypeForCanal('MT')).toBe('MT')
  })
  it('défaut GT', () => {
    expect(tradeTypeForCanal('General trade')).toBe('GT')
    expect(tradeTypeForCanal('GT et MT')).toBe('GT')
    expect(tradeTypeForCanal(null)).toBe('GT')
  })
})
