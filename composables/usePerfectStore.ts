// composables/usePerfectStore.ts
// SYSTÈME B (référentiel supabase/nouveau). Charge les tables B nécessaires au
// scoring offline (pont correspondance_reference + poids_reference + seuils +
// segment_grade) et expose les KPI agrégés depuis les vues B
// (v_perfect_store_global / v_perfect_store_par_categorie_pdv).
//
// Le score Big Five combine disponibilité, visibilité parfaite et promotion
// lorsqu'elle est applicable. L'assortiment séparé du système historique reste nul.
import {
  scoreVisiteB,
  type PerfectStoreRefsB,
  type PerfectStoreResultB,
} from '~/utils/perfectStore'
import type { VisiteData } from '~/types'

export interface PerfectStoreGlobalKpi {
  visites_scorees: number
  perfect_stores: number
  perfect_store_pct: number | null
  score_global_moyen_pct: number | null
  osa_moyen_pct: number | null
  visibilite_moyenne_pct: number | null
  promotion_moyenne_pct: number | null
}

export interface PerfectStoreTypeKpi {
  type_pdv: string
  visites_scorees: number
  perfect_stores: number
  perfect_store_pct: number | null
  score_global_moyen_pct: number | null
}

export interface CoverageKpi {
  periode: string
  pdv_vus: number
}

// Référentiels B + dérivé tierConfig (niveaux) pour l'affichage du tableau de seuils.
export interface PerfectStoreDashboardRefs extends PerfectStoreRefsB {
  tierConfig: { ps_tier: string; osa_min: number; assort_min: number; visi_min: number; promo_min: number | null; rang: number }[]
}

export function usePerfectStore() {
  const supabase = useSupabaseClient()

  const refs = useState<PerfectStoreDashboardRefs | null>('ps-refs-b', () => null)
  const loaded = useState<boolean>('ps-refs-b-loaded', () => false)

  async function fetchRefs(force = false) {
    if (loaded.value && !force && refs.value) return refs.value
    try {
      const [corr, poids, seuils, sg, niv, elements, standards, segmentMap] = await Promise.all([
        supabase.from('correspondance_reference').select('categorie_jsonb, sku_key, reference_produit(nom)'),
        supabase.from('poids_reference').select('canal, base_calcul, poids, reference_produit(nom)'),
        supabase.from('seuil_disponibilite').select('segment, grade, quantite_min, reference_produit(nom)'),
        supabase.from('segment_grade_type_pdv').select('segment, grade, type_pdv(nom, categorie_pdv(canal))'),
        supabase.from('niveau_perfect_store').select('code, rang, dispo_rayon_min, visibilite_min, promotion_min').order('rang', { ascending: false }),
        supabase.from('element_visibilite').select('id, segment, code, nom, pilier, emplacement, optionnel'),
        supabase.from('standard_visibilite').select('segment, niveau_perfect_store, requis, element_visibilite(code)'),
        supabase.from('segment_visibilite_type_pdv').select('segment, type_pdv(nom)'),
      ])
      const firstError = [corr, poids, seuils, sg, niv, elements, standards, segmentMap].find(result => result.error)?.error
      if (firstError) throw firstError

      const nomOf = (r: any) => r?.reference_produit?.nom ?? r?.reference_produit?.[0]?.nom ?? ''
      const one = (value: any) => Array.isArray(value) ? value[0] : value
      refs.value = {
        correspondance: (corr.data || []).map((r: any) => ({ categorie_jsonb: r.categorie_jsonb, sku_key: r.sku_key, reference_nom: nomOf(r) })),
        poids: (poids.data || []).map((r: any) => ({
          reference_nom: nomOf(r),
          canal: r.canal,
          base_calcul: r.base_calcul,
          poids: Number(r.poids),
        })),
        seuils: (seuils.data || []).map((r: any) => ({ reference_nom: nomOf(r), segment: r.segment, grade: r.grade, quantite_min: r.quantite_min })),
        segmentGrade: (sg.data || []).map((r: any) => {
          const tp = Array.isArray(r.type_pdv) ? r.type_pdv[0] : r.type_pdv
          const cp = tp ? (Array.isArray(tp.categorie_pdv) ? tp.categorie_pdv[0] : tp.categorie_pdv) : null
          return { type_pdv_nom: tp?.nom ?? '', canal: cp?.canal ?? null, segment: r.segment, grade: r.grade }
        }),
        visibilityElements: (elements.data || []) as any,
        visibilityStandards: (standards.data || []).map((standard: any) => ({
          segment: standard.segment,
          niveau_perfect_store: standard.niveau_perfect_store,
          element_code: one(standard.element_visibilite)?.code ?? '',
          requis: standard.requis,
        })).filter((standard: any) => standard.element_code),
        visibilitySegmentMap: (segmentMap.data || []).map((mapping: any) => ({
          type_pdv_nom: one(mapping.type_pdv)?.nom ?? '',
          segment: mapping.segment,
        })).filter((mapping: any) => mapping.type_pdv_nom),
        niveaux: (niv.data || []).map((n: any) => ({
          code: n.code,
          rang: n.rang,
          dispo_rayon_min: n.dispo_rayon_min,
          visibilite_min: n.visibilite_min,
          promotion_min: n.promotion_min,
        })),
        tierConfig: (niv.data || []).map((n: any) => ({
          ps_tier: n.code,
          osa_min: n.dispo_rayon_min == null ? 0 : Number(n.dispo_rayon_min) / 100,
          assort_min: 0,
          visi_min: n.visibilite_min == null ? 0 : Number(n.visibilite_min) / 100,
          promo_min: n.promotion_min == null ? null : Number(n.promotion_min) / 100,
          rang: n.rang,
        })),
      }
      loaded.value = true
    }
    catch (err) {
      console.error('usePerfectStore (B): échec chargement référentiels', err)
    }
    return refs.value
  }

  /** Aperçu offline (parité SQL calculer_perfect_store). Nécessite fetchRefs(). */
  function scoreVisite(data: VisiteData, pdv: { sous_categorie_pdv?: string | null; canal?: string | null }): PerfectStoreResultB | null {
    if (!refs.value) return null
    return scoreVisiteB(data, pdv, refs.value)
  }

  /** KPI global calculé côté PostgreSQL sur toutes les visites scorées. */
  async function fetchGlobalKpi(): Promise<PerfectStoreGlobalKpi | null> {
    const { data, error } = await supabase.from('v_perfect_store_global')
      .select('visites_scorees, perfect_stores, perfect_store_pct, score_global_moyen_pct, osa_moyen_pct, visibilite_moyenne_pct, promotion_moyenne_pct')
      .maybeSingle()
    if (error) {
      console.warn('v_perfect_store_global (B) indisponible', error.message)
      return null
    }
    return data as PerfectStoreGlobalKpi | null
  }

  /** KPI par catégorie de PDV. */
  async function fetchKpiParType(): Promise<PerfectStoreTypeKpi[]> {
    const { data, error } = await supabase.from('v_perfect_store_par_categorie_pdv')
      .select('type_pdv, visites_scorees, perfect_stores, perfect_store_pct, score_global_moyen_pct')
    if (error) {
      console.warn('v_perfect_store_par_categorie_pdv (B) indisponible', error.message)
      return []
    }
    return (data || []) as PerfectStoreTypeKpi[]
  }

  async function fetchCoverage(): Promise<CoverageKpi | null> {
    const currentPeriod = new Date().toISOString().slice(0, 7)
    const { data, error } = await supabase.from('v_couverture_globale')
      .select('periode, pdv_vus')
      .eq('periode', currentPeriod)
      .maybeSingle()
    if (error) {
      console.warn('v_couverture_globale indisponible', error.message)
      return null
    }
    return data as CoverageKpi | null
  }

  return { refs, fetchRefs, scoreVisite, fetchGlobalKpi, fetchKpiParType, fetchCoverage }
}
