// utils/perfectStore.ts
// Scorer Perfect Store TS PUR — parité avec les fonctions SQL Big Five.
// Sert à l'aperçu offline dans l'app mobile (cohérent avec useOfflineSync).
// La logique de référence reste le SQL ; voir FORMULE_ET_TESTS_perfect_store.md.
import type { VisiteData } from '~/types'
import {
  visibilityElementObserved,
  visibilitySegmentForPdv,
  type VisibilityElementRef,
  type VisibilitySegment,
} from './visibilityStandards'

export type PerfectBasis = 'taux_vente' | 'taux_revu'
export type TradeType = 'GT' | 'MT'
export type PerfectTier = 'FLAGSHIP' | 'VIP' | 'CORE' | 'BASIC'

export interface AvailabilityStandard { category: string; sku: string; standard_group: string; tier: string; min_quantity: number }
export interface AvailabilityWeight { category: string; trade_type: string; basis: string; sku: string; weight: number }
export interface AssortmentStandard { standard_group: string; tier: string; min_sku_present: number }
export interface VisibilityStandard { standard_group: string; ps_tier: string; zone: string; element_key: string; is_required: boolean }
export interface TierConfig { ps_tier: PerfectTier; osa_min: number; assort_min: number; visi_min: number; promo_min: number | null; rang: number }
export interface ScoreConfig { w_osa_lineaire: number; w_osa_pondere: number; w_assortiment: number; w_visibilite: number }

export interface PerfectStoreRefs {
  posStandardMap: Record<string, { standard_group: string; tier: string }>
  availabilityStandards: AvailabilityStandard[]
  availabilityWeights: AvailabilityWeight[]
  assortmentStandards: AssortmentStandard[]
  visibilityStandards: VisibilityStandard[]
  tierConfig: TierConfig[]
  scoreConfig: ScoreConfig
}

export interface PerfectStoreResult {
  basis: PerfectBasis
  osaLineaire: number | null
  osaPondere: number | null
  osaNote10: number
  assortimentTaux: number | null
  visibiliteTaux: number | null
  promoTaux: number | null
  scoreGlobal: number | null
  dispoCategorie: Record<string, { eval: number; avail: number }>
  isPerfectStore: boolean
  tierAtteint: PerfectTier | null
}

export const DEFAULT_SCORE_CONFIG: ScoreConfig = {
  w_osa_lineaire: 0.10, w_osa_pondere: 0.45, w_assortiment: 0.15, w_visibilite: 0.30,
}

/**
 * Sous-moteur OSA (déterministe, testé contre le fichier source EVAP GT).
 * @param dispo  map SKU -> disponible (qté >= seuil)
 * @param weights map SKU -> poids (0 si absent)
 */
export function computeOsa(dispo: Record<string, boolean>, weights: Record<string, number>) {
  const keys = Object.keys(dispo)
  let nAvail = 0, wsum = 0, wtot = 0
  for (const k of keys) {
    const w = weights[k] ?? 0
    wtot += w
    if (dispo[k]) { nAvail++; wsum += w }
  }
  return {
    osaLineaire: keys.length > 0 ? nAvail / keys.length : null,
    osaPondere: wtot > 0 ? wsum / wtot : null,
  }
}

/**
 * Disponibilité en rayon pondérée d'une catégorie, en % (0–100).
 * Miroir TS de la fonction SQL `calculer_dispo_categorie`
 * (supabase/nouveau/20260630130100_friesland_perfect_store_calcul.sql) :
 *   round( Σ(poids × dispo) / Σ(poids) × 100 ).
 * @param poids poids de chaque référence évaluée (somme libre, renormalisée).
 * @param dispo 1 si la référence est disponible (qté ≥ seuil), 0 sinon — même longueur que `poids`.
 */
export function calculerDisponibiliteRayon(poids: number[], dispo: number[]): number {
  if (poids.length !== dispo.length) {
    throw new Error('calculerDisponibiliteRayon: poids et dispo de longueurs différentes')
  }
  const wtot = poids.reduce((a, w) => a + w, 0)
  if (wtot === 0) return 0
  const wsum = poids.reduce((a, w, i) => a + w * (dispo[i] ? 1 : 0), 0)
  return Math.round((wsum / wtot) * 100)
}

/** 1 si la quantité relevée atteint le seuil de disponibilité, 0 sinon (miroir SQL). */
export function estDisponible(quantite: number, seuil: number): number {
  return quantite >= seuil ? 1 : 0
}

/** Détermine le trade type comme la fonction SQL (canal ILIKE '%modern%' OR canal='MT'). */
export function tradeTypeForCanal(canal?: string | null): TradeType {
  const c = (canal || '').toLowerCase()
  return c.includes('modern') || c === 'mt' ? 'MT' : 'GT'
}

interface ScorePdv {
  sous_categorie_pdv?: string | null
  canal?: string | null
  objectif_perfect_store?: string | null
}

/**
 * Score Perfect Store complet — réplique exacte de compute_perfect_store (SQL).
 */
export function scorePerfectStore(
  data: VisiteData,
  pdv: ScorePdv,
  refs: PerfectStoreRefs,
  basis: PerfectBasis = 'taux_vente',
): PerfectStoreResult {
  const map = refs.posStandardMap[pdv.sous_categorie_pdv || ''] || null
  const group = map?.standard_group
  const tier = map?.tier
  const trade = tradeTypeForCanal(pdv.canal)
  const objectif = (pdv.objectif_perfect_store || 'BASIC') as PerfectTier

  const produits: any = (data as any)?.produits || {}
  const visibilite: any = (data as any)?.visibilite || {}

  // Index des poids pour lookup rapide
  const weightOf = (category: string, sku: string): number => {
    const w = refs.availabilityWeights.find(
      x => x.category === category && x.trade_type === trade && x.basis === basis && x.sku === sku,
    )
    return w ? Number(w.weight) : 0
  }

  // (1)(2)(3) OSA + assortiment
  let gEval = 0, gAvail = 0, gWsum = 0, gWtot = 0
  const catDetail: Record<string, { eval: number; avail: number }> = {}

  const standards = group && tier
    ? refs.availabilityStandards.filter(
        s => s.standard_group === group && s.tier === tier && ['evap', 'imp', 'scm'].includes(s.category),
      )
    : []

  for (const s of standards) {
    const qteRaw = produits?.[s.category]?.quantites?.[s.sku]
    const qte = Number.isFinite(Number(qteRaw)) ? Number(qteRaw) : 0
    const avail = qte >= s.min_quantity
    const w = weightOf(s.category, s.sku)

    gEval++; gWtot += w
    if (avail) { gAvail++; gWsum += w }

    if (!catDetail[s.category]) catDetail[s.category] = { eval: 0, avail: 0 }
    catDetail[s.category].eval++
    if (avail) catDetail[s.category].avail++
  }

  const osaLineaire = gEval > 0 ? gAvail / gEval : null
  const osaPondere = gWtot > 0 ? gWsum / gWtot : null

  const assortRow = group && tier
    ? refs.assortmentStandards.find(a => a.standard_group === group && a.tier === tier)
    : null
  const minSkuPresent = assortRow?.min_sku_present
  const assortimentTaux = minSkuPresent && minSkuPresent > 0
    ? Math.min(gAvail / minSkuPresent, 1)
    : null

  // (4) Visibilité
  let visReq = 0, visOk = 0
  const visStds = group
    ? refs.visibilityStandards.filter(v => v.standard_group === group && v.ps_tier === objectif && v.is_required)
    : []
  for (const v of visStds) {
    visReq++
    if (visibilite?.[v.zone]?.[v.element_key] === true) visOk++
  }
  const visibiliteTaux = visReq > 0 ? visOk / visReq : null

  // (5) Score composite renormalisé sur les composantes présentes
  const cfg = refs.scoreConfig || DEFAULT_SCORE_CONFIG
  let score = 0, wden = 0
  if (osaLineaire !== null) { score += cfg.w_osa_lineaire * osaLineaire; wden += cfg.w_osa_lineaire }
  if (osaPondere !== null) { score += cfg.w_osa_pondere * osaPondere; wden += cfg.w_osa_pondere }
  if (assortimentTaux !== null) { score += cfg.w_assortiment * assortimentTaux; wden += cfg.w_assortiment }
  if (visibiliteTaux !== null) { score += cfg.w_visibilite * visibiliteTaux; wden += cfg.w_visibilite }
  const scoreGlobal = wden > 0 ? score / wden : null

  // (6) Gating tier (COALESCE: osa 0, assort 1, visi 0, promo 0)
  const promoTaux: number | null = null
  const osaG = osaPondere ?? 0
  const assortG = assortimentTaux ?? 1
  const visG = visibiliteTaux ?? 0
  const promoG = promoTaux ?? 0

  const tierAtteint = [...refs.tierConfig]
    .sort((a, b) => b.rang - a.rang)
    .find(c =>
      osaG >= c.osa_min
      && assortG >= c.assort_min
      && visG >= c.visi_min
      && (c.promo_min == null || promoG >= c.promo_min),
    )?.ps_tier ?? null

  return {
    basis,
    osaLineaire,
    osaPondere,
    osaNote10: Math.round((osaPondere ?? 0) * 10 * 100) / 100,
    assortimentTaux,
    visibiliteTaux,
    promoTaux,
    scoreGlobal,
    dispoCategorie: catDetail,
    isPerfectStore: tierAtteint !== null,
    tierAtteint,
  }
}

// ============================================================================
// SYSTÈME B — scorer aperçu offline, miroir TS de calculer_perfect_store (SQL,
// supabase/nouveau/20260630130100_friesland_perfect_store_calcul.sql).
// Modèle B : disponibilité pondérée par catégorie + matrice de visibilité par
// segment/niveau + promotion optionnelle, via les référentiels normalisés.
// ============================================================================

export interface PerfectStoreRefsB {
  /** Pont clé JSONB (categorie_jsonb + sku_key) -> nom de référence. */
  correspondance: { categorie_jsonb: string; sku_key: string; reference_nom: string }[]
  /** Poids de chaque référence par canal (GT/MT). */
  poids: { reference_nom: string; canal: TradeType; base_calcul: PerfectBasis; poids: number }[]
  /** Quantité minimale par référence × segment × grade. */
  seuils: { reference_nom: string; segment: string; grade: string; quantite_min: number }[]
  /** Résolution type de PDV (= pdv.sous_categorie_pdv) -> canal/segment/grade. */
  segmentGrade: { type_pdv_nom: string; canal: TradeType | null; segment: string; grade: string }[]
  /** Catalogue et matrice de visibilité/promotion issus du fichier BIG FIVE KPI. */
  visibilityElements: VisibilityElementRef[]
  visibilityStandards: {
    segment: VisibilitySegment
    niveau_perfect_store: 'flagship' | 'vip' | 'core' | 'basic'
    element_code: string
    requis: boolean
  }[]
  visibilitySegmentMap: { type_pdv_nom: string; segment: VisibilitySegment }[]
  /** Niveaux Perfect Store : disponibilité + visibilité parfaite + promotion optionnelle. */
  niveaux: {
    code: string
    rang: number
    dispo_rayon_min: number | null
    visibilite_min: number | null
    promotion_min: number | null
  }[]
}

export interface PerfectStoreResultB {
  /** Dispo en rayon (ratio 0–1) — exposée sous osaPondere/scoreGlobal pour parité d'affichage avec le Système A. */
  osaPondere: number | null
  scoreGlobal: number | null
  assortimentTaux: null
  visibiliteTaux: number | null
  promotionTaux: number | null
  /** Détail par catégorie EVAP/IMP/SCM (dispo en %, ou null si non évaluable). */
  dispoCategorie: Record<string, number | null>
  isPerfectStore: boolean
  tierAtteint: string | null
}

interface ScorePdvB { sous_categorie_pdv?: string | null; canal?: string | null }

/**
 * Aperçu Perfect Store (Système B) pour une visite. Réplique exacte de la
 * fonction SQL calculer_perfect_store : moyenne des catégories EVAP/IMP/SCM
 * évaluables, gating conjonctif par dispo_rayon_min.
 */
export function scoreVisiteB(
  data: VisiteData,
  pdv: ScorePdvB,
  refs: PerfectStoreRefsB,
  basis: PerfectBasis = 'taux_vente',
): PerfectStoreResultB {
  const produits: any = (data as any)?.produits || {}
  const sg = refs.segmentGrade.find(s => s.type_pdv_nom === (pdv.sous_categorie_pdv || ''))
  // Canal : segment_grade > canal du pdv (modern/MT) > GT par défaut (cf. SQL).
  const canal: TradeType = sg?.canal ?? tradeTypeForCanal(pdv.canal)
  const dispoSegment = sg?.segment
  const grade = sg?.grade

  const dispoCategorie: Record<string, number | null> = {}
  for (const cat of ['evap', 'imp', 'scm']) {
    const poids: number[] = []
    const dispo: number[] = []
    for (const c of refs.correspondance.filter(x => x.categorie_jsonb === cat)) {
      const p = refs.poids.find(x =>
        x.reference_nom === c.reference_nom
        && x.canal === canal
        && x.base_calcul === basis,
      )
      const s = dispoSegment && grade
        ? refs.seuils.find(x => x.reference_nom === c.reference_nom && x.segment === dispoSegment && x.grade === grade)
        : undefined
      if (!p || !s) continue   // référence non évaluable pour ce canal/segment/grade
      const qteRaw = produits?.[cat]?.quantites?.[c.sku_key]
      const qte = Number.isFinite(Number(qteRaw)) ? Number(qteRaw) : 0
      poids.push(Number(p.poids))
      dispo.push(estDisponible(qte, s.quantite_min))
    }
    dispoCategorie[cat] = poids.length ? calculerDisponibiliteRayon(poids, dispo) : null
  }

  const cats = Object.values(dispoCategorie).filter((x): x is number => x !== null)
  const dispoRayon = cats.length ? Math.round(cats.reduce((a, b) => a + b, 0) / cats.length) : null

  const segment = refs.visibilitySegmentMap
    .find(item => item.type_pdv_nom === (pdv.sous_categorie_pdv || ''))?.segment
    ?? visibilitySegmentForPdv(pdv.sous_categorie_pdv)
  const promotionApplicable = (data as any)?.visibilite?.promotion_applicable === true
  const tierKey = (code: string) => {
    const normalized = code.trim().toLowerCase()
    if (normalized.startsWith('flagship')) return 'flagship'
    if (normalized.startsWith('vip')) return 'vip'
    if (normalized.startsWith('core')) return 'core'
    return 'basic'
  }
  const rateFor = (code: string, pillar: 'visibilite' | 'promotion'): number | null => {
    if (!segment) return null
    const matrixRows = refs.visibilityStandards
      .filter(standard =>
        standard.segment === segment
        && standard.niveau_perfect_store === tierKey(code)
      )
    if (!matrixRows.length) return null
    const requiredCodes = matrixRows
      .filter(standard => standard.requis)
      .map(standard => refs.visibilityElements.find(element =>
        element.segment === segment
        && element.code === standard.element_code
        && element.pilier === pillar
        && !element.optionnel,
      ))
      .filter((element): element is VisibilityElementRef => !!element)
      .map(element => element.code)
    if (!requiredCodes.length) return 1
    const observed = requiredCodes.filter(codeValue => visibilityElementObserved(data, codeValue)).length
    return observed / requiredCodes.length
  }

  let niveau: string | null = null
  let visibiliteTaux: number | null = null
  let promotionTaux: number | null = null
  const niveaux = [...refs.niveaux].sort((a, b) => b.rang - a.rang)
  for (const candidate of niveaux) {
    const visibility = rateFor(candidate.code, 'visibilite')
    const promotion = promotionApplicable ? rateFor(candidate.code, 'promotion') : null
    const availabilityOk = dispoRayon != null
      && candidate.dispo_rayon_min != null
      && dispoRayon >= candidate.dispo_rayon_min
    const visibilityOk = visibility != null
      && visibility * 100 >= (candidate.visibilite_min ?? 100)
    const promotionOk = !promotionApplicable
      || (promotion != null && promotion * 100 >= (candidate.promotion_min ?? 100))

    if (candidate === niveaux.at(-1)) {
      visibiliteTaux = visibility
      promotionTaux = promotion
    }
    if (availabilityOk && visibilityOk && promotionOk) {
      niveau = candidate.code
      visibiliteTaux = visibility
      promotionTaux = promotion
      break
    }
  }

  const scoreParts = [
    dispoRayon == null ? null : dispoRayon / 100,
    visibiliteTaux,
    promotionApplicable ? promotionTaux : null,
  ].filter((value): value is number => value != null)
  const scoreGlobal = scoreParts.length
    ? scoreParts.reduce((sum, value) => sum + value, 0) / scoreParts.length
    : null

  return {
    osaPondere: dispoRayon == null ? null : dispoRayon / 100,
    scoreGlobal,
    assortimentTaux: null,
    visibiliteTaux,
    promotionTaux,
    dispoCategorie,
    isPerfectStore: niveau !== null,
    tierAtteint: niveau,
  }
}
