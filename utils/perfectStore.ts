// utils/perfectStore.ts
// Scorer Perfect Store TS PUR — parité exacte avec la fonction SQL
// public.compute_perfect_store (migration 013_016_perfect_store.sql).
// Sert à l'aperçu offline dans l'app mobile (cohérent avec useOfflineSync).
// La logique de référence reste le SQL ; voir FORMULE_ET_TESTS_perfect_store.md.
import type { VisiteData } from '~/types'

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
