// composables/usePerfectStore.ts
// Charge les référentiels Perfect Store + expose le scoring (parité SQL via
// utils/perfectStore) et les KPI agrégés (vues v_perfect_store_*).
import {
  scorePerfectStore,
  DEFAULT_SCORE_CONFIG,
  type PerfectStoreRefs,
  type PerfectBasis,
} from '~/utils/perfectStore'
import type { VisiteData } from '~/types'

export interface PerfectStoreGlobalKpi {
  visites_scorees: number
  perfect_stores: number
  perfect_store_pct: number | null
  score_global_moyen_pct: number | null
  osa_moyen_pct: number | null
  visibilite_moyenne_pct: number | null
}

export interface PerfectStoreTypeKpi {
  type_pdv: string
  visites_scorees: number
  perfect_stores: number
  perfect_store_pct: number | null
  score_global_moyen_pct: number | null
}

export function usePerfectStore() {
  const supabase = useSupabaseClient()

  const refs = useState<PerfectStoreRefs | null>('ps-refs', () => null)
  const loaded = useState<boolean>('ps-refs-loaded', () => false)

  async function fetchRefs(force = false) {
    if (loaded.value && !force && refs.value) return refs.value
    try {
      const [pos, avs, avw, ass, vis, tier, score] = await Promise.all([
        supabase.from('pos_standard_map').select('sous_categorie_pdv, standard_group, tier'),
        supabase.from('availability_standards').select('category, sku, standard_group, tier, min_quantity'),
        supabase.from('availability_weights').select('category, trade_type, basis, sku, weight'),
        supabase.from('assortment_standards').select('standard_group, tier, min_sku_present'),
        supabase.from('visibility_standards').select('standard_group, ps_tier, zone, element_key, is_required'),
        supabase.from('perfect_store_tier_config').select('ps_tier, osa_min, assort_min, visi_min, promo_min, rang'),
        supabase.from('perfect_store_score_config').select('w_osa_lineaire, w_osa_pondere, w_assortiment, w_visibilite').eq('id', 1).maybeSingle(),
      ])

      const posMap: Record<string, { standard_group: string; tier: string }> = {}
      for (const r of (pos.data || []) as any[]) {
        posMap[r.sous_categorie_pdv] = { standard_group: r.standard_group, tier: r.tier }
      }

      refs.value = {
        posStandardMap: posMap,
        availabilityStandards: (avs.data || []) as any,
        availabilityWeights: (avw.data || []) as any,
        assortmentStandards: (ass.data || []) as any,
        visibilityStandards: (vis.data || []) as any,
        tierConfig: (tier.data || []) as any,
        scoreConfig: (score.data as any) || DEFAULT_SCORE_CONFIG,
      }
      loaded.value = true
    }
    catch (err) {
      console.error('usePerfectStore: échec chargement référentiels', err)
    }
    return refs.value
  }

  /** Aperçu offline (parité SQL). Nécessite fetchRefs() au préalable. */
  function scoreVisite(data: VisiteData, pdv: { sous_categorie_pdv?: string | null; canal?: string | null; objectif_perfect_store?: string | null }, basis: PerfectBasis = 'taux_vente') {
    if (!refs.value) return null
    return scorePerfectStore(data, pdv, refs.value, basis)
  }

  async function fetchGlobalKpi(): Promise<PerfectStoreGlobalKpi | null> {
    const { data, error } = await supabase.from('v_perfect_store_global').select('*').maybeSingle()
    if (error) {
      console.warn('v_perfect_store_global indisponible (migration 013_016 lancée ?)', error.message)
      return null
    }
    return data as PerfectStoreGlobalKpi
  }

  async function fetchKpiParType(): Promise<PerfectStoreTypeKpi[]> {
    const { data, error } = await supabase.from('v_perfect_store_par_type').select('*')
    if (error) {
      console.warn('v_perfect_store_par_type indisponible', error.message)
      return []
    }
    return (data || []) as PerfectStoreTypeKpi[]
  }

  return { refs, fetchRefs, scoreVisite, fetchGlobalKpi, fetchKpiParType }
}
