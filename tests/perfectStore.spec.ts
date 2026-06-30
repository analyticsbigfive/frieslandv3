import { describe, it, expect } from 'vitest'
import { calculerDisponibiliteRayon, estDisponible, scoreVisiteB, type PerfectStoreRefsB } from '../utils/perfectStore'

// Poids EVAP · commerce traditionnel (GT) — référentiel client.
// Identiques au seed supabase/nouveau/20260630120300_friesland_produits_disponibilite.sql (l.65-70).
// Ordre : 150g rouge, 150g bleu, 380g rouge, 380g bleu, GOLD, PEARL.
const POIDS_EVAP_GT = [
  0.749443117, // BR 150g (produit phare)
  0.08421527549, // BRB 150g
  0.04827634345, // BR 380g
  0.005407986339, // BRB 380g
  0.009468528271, // BR Gold 160g
  0.1031887494, // Pearl 380g
]

describe('calculerDisponibiliteRayon — EVAP, commerce traditionnel (test d’acceptation)', () => {
  it('PDV 1 [1,0,1,1,1,1] → 92 %', () => {
    expect(calculerDisponibiliteRayon(POIDS_EVAP_GT, [1, 0, 1, 1, 1, 1])).toBe(92)
  })

  it('PDV 2 [0,1,1,0,1,0] → 14 % (le produit phare 150g rouge manque)', () => {
    expect(calculerDisponibiliteRayon(POIDS_EVAP_GT, [0, 1, 1, 0, 1, 0])).toBe(14)
  })

  it('PDV 3 [1,0,1,0,1,1] → 91 %', () => {
    expect(calculerDisponibiliteRayon(POIDS_EVAP_GT, [1, 0, 1, 0, 1, 1])).toBe(91)
  })
})

describe('calculerDisponibiliteRayon — cas limites', () => {
  it('tout disponible → 100 % (Σ poids = 1)', () => {
    expect(calculerDisponibiliteRayon(POIDS_EVAP_GT, [1, 1, 1, 1, 1, 1])).toBe(100)
  })

  it('rien disponible → 0 %', () => {
    expect(calculerDisponibiliteRayon(POIDS_EVAP_GT, [0, 0, 0, 0, 0, 0])).toBe(0)
  })

  it('longueurs incohérentes → erreur', () => {
    expect(() => calculerDisponibiliteRayon([1], [1, 0])).toThrow()
  })
})

describe('estDisponible — quantité ≥ seuil', () => {
  it('quantité au seuil → disponible (1)', () => {
    expect(estDisponible(24, 24)).toBe(1)
  })
  it('quantité sous le seuil → indisponible (0)', () => {
    expect(estDisponible(23, 24)).toBe(0)
  })
  it('quantité nulle → indisponible (0)', () => {
    expect(estDisponible(0, 1)).toBe(0)
  })
})

// ---- Système B : scoreVisiteB de bout en bout (pont -> poids -> seuils) ----
// Référentiel EVAP · GT · Boutique A, identique au seed + verif SQL Path 1.
const REFS_B: PerfectStoreRefsB = {
  correspondance: [
    { categorie_jsonb: 'evap', sku_key: 'br_gold', reference_nom: 'BR Gold 160g' },
    { categorie_jsonb: 'evap', sku_key: 'br_160g', reference_nom: 'BR 150g' },
    { categorie_jsonb: 'evap', sku_key: 'brb_160g', reference_nom: 'BRB 150g' },
    { categorie_jsonb: 'evap', sku_key: 'br_400g', reference_nom: 'BR 380g' },
    { categorie_jsonb: 'evap', sku_key: 'brb_400g', reference_nom: 'BRB 380g' },
    { categorie_jsonb: 'evap', sku_key: 'pearl_400g', reference_nom: 'Pearl 380g' },
  ],
  poids: [
    { reference_nom: 'BR 150g', canal: 'GT', base_calcul: 'taux_vente', poids: 0.749443117 },
    { reference_nom: 'BRB 150g', canal: 'GT', base_calcul: 'taux_vente', poids: 0.08421527549 },
    { reference_nom: 'BR 380g', canal: 'GT', base_calcul: 'taux_vente', poids: 0.04827634345 },
    { reference_nom: 'BRB 380g', canal: 'GT', base_calcul: 'taux_vente', poids: 0.005407986339 },
    { reference_nom: 'BR Gold 160g', canal: 'GT', base_calcul: 'taux_vente', poids: 0.009468528271 },
    { reference_nom: 'Pearl 380g', canal: 'GT', base_calcul: 'taux_vente', poids: 0.1031887494 },
  ],
  seuils: [
    { reference_nom: 'BR 150g', segment: 'Boutique', grade: 'A', quantite_min: 48 },
    { reference_nom: 'BRB 150g', segment: 'Boutique', grade: 'A', quantite_min: 24 },
    { reference_nom: 'BR 380g', segment: 'Boutique', grade: 'A', quantite_min: 24 },
    { reference_nom: 'BRB 380g', segment: 'Boutique', grade: 'A', quantite_min: 12 },
    { reference_nom: 'BR Gold 160g', segment: 'Boutique', grade: 'A', quantite_min: 24 },
    { reference_nom: 'Pearl 380g', segment: 'Boutique', grade: 'A', quantite_min: 24 },
  ],
  segmentGrade: [{ type_pdv_nom: 'Boutique A', canal: 'GT', segment: 'Boutique', grade: 'A' }],
  visibilityElements: [
    { segment: 'boutique', code: 'affiche', nom: 'Affiche', pilier: 'visibilite', emplacement: 'exterieure', optionnel: false },
    { segment: 'boutique', code: 'standard', nom: 'Standard', pilier: 'promotion', emplacement: 'promotion', optionnel: false },
  ],
  visibilityStandards: [
    ...['flagship', 'vip', 'core', 'basic'].flatMap(niveau => [
      { segment: 'boutique' as const, niveau_perfect_store: niveau as 'flagship' | 'vip' | 'core' | 'basic', element_code: 'affiche', requis: true },
      { segment: 'boutique' as const, niveau_perfect_store: niveau as 'flagship' | 'vip' | 'core' | 'basic', element_code: 'standard', requis: true },
    ]),
  ],
  visibilitySegmentMap: [{ type_pdv_nom: 'Boutique A', segment: 'boutique' }],
  niveaux: [
    { code: 'FLAGSHIP STORE', rang: 4, dispo_rayon_min: 95, visibilite_min: 100, promotion_min: 100 },
    { code: 'VIP PERFECT STORE', rang: 3, dispo_rayon_min: 85, visibilite_min: 100, promotion_min: 100 },
    { code: 'CORE PERFECT STORE', rang: 2, dispo_rayon_min: 75, visibilite_min: 100, promotion_min: 100 },
    { code: 'BASIC PERFECT STORE', rang: 1, dispo_rayon_min: 60, visibilite_min: 100, promotion_min: 100 },
  ],
}
const pdvBoutiqueA = { sous_categorie_pdv: 'Boutique A' }
const mkData = (q: Record<string, number>, standards: Record<string, boolean> = { affiche: true }, promotionApplicable = false): any => ({
  produits: { evap: { quantites: q } },
  visibilite: { standards, promotion_applicable: promotionApplicable },
})

describe('scoreVisiteB — EVAP GT Boutique A (Système B, bout en bout)', () => {
  it('V1 → dispo EVAP 92, niveau VIP', () => {
    const r = scoreVisiteB(mkData({ br_160g: 48, brb_160g: 0, br_400g: 24, brb_400g: 12, br_gold: 24, pearl_400g: 24 }), pdvBoutiqueA, REFS_B)
    expect(r.dispoCategorie.evap).toBe(92)
    expect(r.osaPondere).toBeCloseTo(0.92)
    expect(r.isPerfectStore).toBe(true)
    expect(r.tierAtteint).toBe('VIP PERFECT STORE')
  })
  it('V2 → dispo EVAP 14, aucun niveau', () => {
    const r = scoreVisiteB(mkData({ br_160g: 0, brb_160g: 24, br_400g: 24, brb_400g: 0, br_gold: 24, pearl_400g: 0 }), pdvBoutiqueA, REFS_B)
    expect(r.dispoCategorie.evap).toBe(14)
    expect(r.tierAtteint).toBe(null)
    expect(r.isPerfectStore).toBe(false)
  })
  it('V3 → dispo EVAP 91, niveau VIP', () => {
    const r = scoreVisiteB(mkData({ br_160g: 48, brb_160g: 0, br_400g: 24, brb_400g: 0, br_gold: 24, pearl_400g: 24 }), pdvBoutiqueA, REFS_B)
    expect(r.dispoCategorie.evap).toBe(91)
    expect(r.tierAtteint).toBe('VIP PERFECT STORE')
  })
  it('une visibilité incomplète bloque tous les niveaux', () => {
    const r = scoreVisiteB(mkData({ br_160g: 48, brb_160g: 24, br_400g: 24, brb_400g: 12, br_gold: 24, pearl_400g: 24 }, { affiche: false }), pdvBoutiqueA, REFS_B)
    expect(r.visibiliteTaux).toBe(0)
    expect(r.tierAtteint).toBe(null)
  })
  it('la promotion est ignorée si non applicable et bloque si applicable mais non exécutée', () => {
    const q = { br_160g: 48, brb_160g: 24, br_400g: 24, brb_400g: 12, br_gold: 24, pearl_400g: 24 }
    expect(scoreVisiteB(mkData(q, { affiche: true }, false), pdvBoutiqueA, REFS_B).tierAtteint).toBe('FLAGSHIP STORE')
    const withPromo = scoreVisiteB(mkData(q, { affiche: true, standard: false }, true), pdvBoutiqueA, REFS_B)
    expect(withPromo.promotionTaux).toBe(0)
    expect(withPromo.tierAtteint).toBe(null)
  })
})
