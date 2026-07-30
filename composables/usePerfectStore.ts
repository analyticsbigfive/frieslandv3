// composables/usePerfectStore.ts
// SYSTÈME B (référentiel supabase/nouveau). Charge les tables B nécessaires au
// scoring offline (pont correspondance_reference + poids_reference + seuils +
// segment_grade) et expose les KPI agrégés depuis les vues B
// (v_perfect_store_global / v_perfect_store_par_categorie_pdv).
//
// Le score Big Five combine disponibilité, visibilité parfaite et promotion
// lorsqu'elle est applicable. L'assortiment applique le minimum de SKU présents
// et l'obligation des Hero SKU indiqués dans le fichier.
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
  assortiment_moyen_pct: number | null
  visibilite_moyenne_pct: number | null
  promotion_moyenne_pct: number | null
}

export interface PerfectStoreTypeKpi {
  type_pdv: string
  /** PDV distincts scorés (dernière visite de la période). Base de comptage du dashboard. */
  pdv_scores: number
  pdv_perfect_stores: number
  perfect_store_pct: number | null
  score_global_moyen_pct: number | null
  /** Nombre de passages, doublons compris. Suivi d'activité, pas base du taux. */
  visites_scorees: number
}

/** Ventilation Flagship / VIP / Core / Basic, du niveau le plus exigeant au moins exigeant. */
export interface PerfectStoreNiveauCount {
  niveau: string
  nb_pdv: number
}

/** Couverture des visites d'un merchandiser sur la période (tâche 2.2). */
export interface CouvertureCommercial {
  commercial: string
  email: string
  /** Tous les passages, y compris plusieurs sur le même PDV. */
  nb_visites: number
  /** PDV distincts touchés. */
  nb_pdv: number
  /** Jours pendant lesquels au moins une visite a été faite. */
  nb_jours: number
  /** nb_visites / nb_jours — à comparer à l'objectif journalier. */
  visites_par_jour: number | null
  pdv_visites: { pdv_id: string; nom_pdv: string; passages: number; derniere_visite: string }[]
}

export interface CoverageKpi {
  periode: string
  pdv_vus: number
  pdv_total: number
  couverture_pct: number | null
}

/**
 * Retour de dashboard_perfect_store_filtre : les KPI Perfect Store en base PDV
 * distincts (un PDV = sa dernière visite scorée de la période), la couverture
 * effective (PDV uniques / parc) et la couverture des visites (tous passages).
 */
export interface PerfectStoreDashboardKpi extends PerfectStoreGlobalKpi {
  pdv_scores: number
  pdv_perfect_stores: number
  pdv_perfect_store_pct: number | null
  pdv_non_conformes: number
  par_niveau: PerfectStoreNiveauCount[]
  pdv_vus: number
  pdv_total: number
  couverture_pct: number | null
  /** Nombre total de passages sur la période — les visites répétées comptent. */
  visites_total: number
  /** Distribution numérique : part des SKU relevés à quantité >= 1. */
  presence_moyenne_pct: number | null
  par_categorie: PresenceCategorie[]
}

/** Présence vs disponibilité pour une famille de produits (evap / imp / scm). */
export interface PresenceCategorie {
  categorie: string
  presence_pct: number | null
  disponibilite_pct: number | null
}

/** Présence vs disponibilité pour un SKU clé (rôle phare ou nouveauté). */
export interface PresenceSku {
  reference_nom: string
  role: string
  categorie: string
  releves: number
  presents: number
  disponibles: number
  presence_pct: number | null
  disponibilite_pct: number | null
}

export interface PerfectStoreEvolutionPoint {
  date: string
  perfect_stores: number
  /** PDV distincts scorés ce jour-là. */
  pdv_scores: number
  perfect_store_pct: number | null
}

export interface PerfectStoreManqueItem {
  visite_id: string
  pdv_id: string
  nom_pdv: string
  type_pdv: string
  division: string | null
  zone: string | null
  quartier: string | null
  distributor_name: string | null
  niveau_actuel: string | null
  niveau_cible: string
  dispo_manque: boolean
  dispo_rayon: number | null
  dispo_rayon_min: number | null
  assortiment_manque: boolean
  visibilite_manques: string[]
  promotion_manques: string[]
}

export interface PerfectStoreListItem {
  visite_id: string
  pdv_id: string
  nom_pdv: string
  type_pdv: string
  zone: string | null
  date_visite: string
  commercial: string | null
  niveau: string
  score_global: number | null
  dispo_rayon: number | null
  assortiment: number | null
  visibilite: number | null
  promotion: number | null
}

export interface PerfectStoreListPage {
  items: PerfectStoreListItem[]
  total: number
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
      const [corr, poids, seuils, assortiment, sg, niv, elements, standards, segmentMap, seuilsMt] = await Promise.all([
        supabase.from('correspondance_reference').select('categorie_jsonb, sku_key, reference_produit(nom, role)'),
        supabase.from('poids_reference').select('canal, base_calcul, poids, reference_produit(nom)'),
        supabase.from('seuil_disponibilite').select('segment, grade, quantite_min, reference_produit(nom)'),
        supabase.from('standard_assortiment').select('segment, grade, sku_cibles, min_sku_presents, heros_obligatoires'),
        supabase.from('segment_grade_type_pdv').select('segment, grade, type_pdv(nom, categorie_pdv(canal))'),
        supabase.from('niveau_perfect_store').select('code, rang, dispo_rayon_min, visibilite_min, promotion_min').order('rang', { ascending: false }),
        supabase.from('element_visibilite').select('id, segment, code, nom, pilier, emplacement, optionnel'),
        supabase.from('standard_visibilite').select('segment, niveau_perfect_store, requis, element_visibilite(code)'),
        supabase.from('segment_visibilite_type_pdv').select('segment, type_pdv(nom)'),
        supabase.from('seuil_disponibilite_mt').select('segment_mt, quantite_min, facings, reference_produit(nom)'),
      ])
      const firstError = [corr, poids, seuils, assortiment, sg, niv, elements, standards, segmentMap].find(result => result.error)?.error
      if (firstError) throw firstError

      const nomOf = (r: any) => r?.reference_produit?.nom ?? r?.reference_produit?.[0]?.nom ?? ''
      const one = (value: any) => Array.isArray(value) ? value[0] : value
      refs.value = {
        correspondance: (corr.data || []).map((r: any) => ({
          categorie_jsonb: r.categorie_jsonb,
          sku_key: r.sku_key,
          reference_nom: nomOf(r),
          role: one(r.reference_produit)?.role,
        })),
        poids: (poids.data || []).map((r: any) => ({
          reference_nom: nomOf(r),
          canal: r.canal,
          base_calcul: r.base_calcul,
          poids: Number(r.poids),
        })),
        seuils: (seuils.data || []).map((r: any) => ({ reference_nom: nomOf(r), segment: r.segment, grade: r.grade, quantite_min: r.quantite_min })),
        seuilsMt: (seuilsMt.data || []).map((r: any) => ({ reference_nom: nomOf(r), segment_mt: r.segment_mt, quantite_min: r.quantite_min, facings: r.facings })),
        assortmentStandards: (assortiment.data || []).map((r: any) => ({
          segment: r.segment,
          grade: r.grade,
          sku_cibles: Number(r.sku_cibles),
          min_sku_presents: Number(r.min_sku_presents),
          heros_obligatoires: !!r.heros_obligatoires,
        })),
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
          assort_min: 1,
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
      .select('visites_scorees, perfect_stores, perfect_store_pct, score_global_moyen_pct, osa_moyen_pct, assortiment_moyen_pct, visibilite_moyenne_pct, promotion_moyenne_pct')
      .maybeSingle()
    if (error) {
      console.warn('v_perfect_store_global (B) indisponible', error.message)
      return null
    }
    return data as PerfectStoreGlobalKpi | null
  }

  /**
   * Filtres du dashboard : géographie + période.
   * dateDebut / dateFin sont des bornes INCLUSIVES au format AAAA-MM-JJ.
   * Les vues globales sans paramètre ne savent pas filtrer par date : dès qu'une
   * borne est posée, il faut passer par la RPC — d'où leur présence dans
   * hasDashFilters.
   */
  type DashFilters = {
    division?: string
    territoire?: string
    area?: string
    distributeur?: string
    dateDebut?: string
    dateFin?: string
  }
  /**
   * Vrai dès que l'appelant fournit un objet de filtres, même vide.
   *
   * Le test portait avant sur « au moins un filtre non vide », ce qui renvoyait
   * le dashboard vers les vues globales dès que l'utilisateur choisissait la
   * période « Tout » sans filtre géographique. Or ces vues comptent des VISITES
   * là où les RPC comptent des PDV distincts : la même page affichait alors deux
   * dénominateurs contradictoires. Les RPC acceptent tous leurs paramètres à
   * null — passer par elles en permanence ne coûte rien et garantit une base de
   * comptage unique. Les vues ne servent plus qu'aux écrans qui n'ont pas de
   * filtres du tout (perfect-store/liste.vue et sa recherche texte).
   */
  const hasDashFilters = (f?: DashFilters) => !!f
  const dashFilterParams = (f: DashFilters) => ({
    p_division: f.division || null,
    p_territoire: f.territoire || null,
    p_area: f.area || null,
    p_distributeur: f.distributeur || null,
    p_date_debut: f.dateDebut || null,
    p_date_fin: f.dateFin || null,
  })

  /** KPI par catégorie de PDV (RPC filtrée si un filtre dashboard est actif). */
  async function fetchKpiParType(filters?: DashFilters): Promise<PerfectStoreTypeKpi[]> {
    if (hasDashFilters(filters)) {
      const { data, error } = await (supabase.rpc as any)('perfect_store_par_type_filtre', dashFilterParams(filters!))
      if (!error) return (data || []) as PerfectStoreTypeKpi[]
      console.warn('perfect_store_par_type_filtre indisponible (migration 20260717140000 ?), repli non filtré', error.message)
    }
    // Repli sans filtre : la vue compte des visites, pas des PDV distincts.
    // On la remappe pour que l'appelant n'ait qu'une seule forme à gérer.
    const { data, error } = await supabase.from('v_perfect_store_par_categorie_pdv')
      .select('type_pdv, visites_scorees, perfect_stores, perfect_store_pct, score_global_moyen_pct')
    if (error) {
      console.warn('v_perfect_store_par_categorie_pdv (B) indisponible', error.message)
      return []
    }
    return (data || []).map((row: any) => ({
      type_pdv: row.type_pdv,
      pdv_scores: row.visites_scorees,
      pdv_perfect_stores: row.perfect_stores,
      perfect_store_pct: row.perfect_store_pct,
      score_global_moyen_pct: row.score_global_moyen_pct,
      visites_scorees: row.visites_scorees,
    })) as PerfectStoreTypeKpi[]
  }

  async function fetchCoverage(): Promise<CoverageKpi | null> {
    const currentPeriod = new Date().toISOString().slice(0, 7)
    const { data, error } = await supabase.from('v_couverture_globale')
      .select('periode, pdv_vus, pdv_total, couverture_pct')
      .eq('periode', currentPeriod)
      .maybeSingle()
    if (error) {
      console.warn('v_couverture_globale indisponible', error.message)
      return null
    }
    return data as CoverageKpi | null
  }

  async function fetchStoresByTier(tier: string, page = 1, perPage = 5, filters?: DashFilters): Promise<PerfectStoreListPage> {
    if (hasDashFilters(filters)) {
      const { data, error } = await (supabase.rpc as any)('perfect_store_liste_filtre', {
        p_niveau: tier,
        p_type: null,
        p_page: page,
        p_per_page: perPage,
        p_order: 'date',
        ...dashFilterParams(filters!),
      })
      if (error) throw error
      return { items: (data?.items || []) as PerfectStoreListItem[], total: data?.total || 0 }
    }
    const from = (page - 1) * perPage
    const to = from + perPage - 1
    const { data, count, error } = await supabase
      .from('v_perfect_store_liste')
      .select(
        'visite_id, pdv_id, nom_pdv, type_pdv, zone, date_visite, commercial, niveau, score_global, dispo_rayon, assortiment, visibilite, promotion',
        { count: 'exact' },
      )
      .eq('niveau', tier)
      .order('date_visite', { ascending: false })
      .range(from, to)

    if (error) throw error
    return {
      items: (data || []) as PerfectStoreListItem[],
      total: count || 0,
    }
  }

  /** Liste plate filtrable (tous niveaux + non conformes) depuis v_perfect_store_liste_full. */
  async function fetchPerfectStoreListe(opts: {
    niveau?: string
    type?: string
    search?: string
    page?: number
    perPage?: number
    filters?: DashFilters
  } = {}): Promise<PerfectStoreListPage> {
    const page = opts.page && opts.page > 0 ? opts.page : 1
    const perPage = opts.perPage || 20
    if (hasDashFilters(opts.filters)) {
      const { data, error } = await (supabase.rpc as any)('perfect_store_liste_filtre', {
        p_niveau: opts.niveau && opts.niveau !== 'TOUS' ? opts.niveau : null,
        p_type: opts.type || null,
        p_page: page,
        p_per_page: perPage,
        p_order: 'score',
        p_search: opts.search?.trim() || null,
        ...dashFilterParams(opts.filters!),
      })
      if (error) throw error
      return { items: (data?.items || []) as PerfectStoreListItem[], total: data?.total || 0 }
    }
    const from = (page - 1) * perPage
    const to = from + perPage - 1
    let query = supabase
      .from('v_perfect_store_liste_full')
      .select(
        'visite_id, pdv_id, nom_pdv, type_pdv, zone, date_visite, commercial, niveau, score_global, dispo_rayon, assortiment, visibilite, promotion',
        { count: 'exact' },
      )
    // 'CONFORMES' est une sentinelle comprise par la RPC (tous niveaux Perfect
    // Store confondus) ; la vue ne connaît que les codes réels et 'NON CONFORME'.
    if (opts.niveau === 'CONFORMES') query = query.neq('niveau', 'NON CONFORME')
    else if (opts.niveau && opts.niveau !== 'TOUS') query = query.eq('niveau', opts.niveau)
    if (opts.type) query = query.eq('type_pdv', opts.type)
    const search = opts.search?.trim()
    if (search) query = query.or(`nom_pdv.ilike.%${search}%,pdv_id.ilike.%${search}%,zone.ilike.%${search}%`)
    query = query.order('score_global', { ascending: false, nullsFirst: false }).range(from, to)

    const { data, count, error } = await query
    if (error) throw error
    return { items: (data || []) as PerfectStoreListItem[], total: count || 0 }
  }

  /** Évolution du taux de Perfect Stores par jour (RPC filtrée si filtres actifs). */
  async function fetchPerfectStoreEvolution(filters?: DashFilters): Promise<PerfectStoreEvolutionPoint[]> {
    if (hasDashFilters(filters)) {
      const { data, error } = await (supabase.rpc as any)('perfect_store_evolution_filtre', dashFilterParams(filters!))
      if (!error) return (data || []) as PerfectStoreEvolutionPoint[]
      console.warn('perfect_store_evolution_filtre indisponible (migration 20260717140000 ?), repli non filtré', error.message)
    }
    const { data, error } = await supabase
      .from('v_perfect_store_evolution')
      .select('date, perfect_stores, visites_scorees, perfect_store_pct')
      .order('date', { ascending: true })
    if (error) {
      console.warn('v_perfect_store_evolution indisponible', error.message)
      return []
    }
    return (data || []).map((row: any) => ({
      date: row.date,
      perfect_stores: row.perfect_stores,
      pdv_scores: row.visites_scorees,
      perfect_store_pct: row.perfect_store_pct,
    })) as PerfectStoreEvolutionPoint[]
  }

  /** KPI globaux filtrés par géographie + période (RPC). */
  async function fetchGlobalKpiFiltre(f: DashFilters): Promise<PerfectStoreDashboardKpi | null> {
    const { data, error } = await (supabase.rpc as any)('dashboard_perfect_store_filtre', dashFilterParams(f))
    if (error) {
      console.warn('dashboard_perfect_store_filtre indisponible', error.message)
      return null
    }
    return data as PerfectStoreDashboardKpi
  }

  /**
   * Couverture des visites détaillée par merchandiser (tâche 2.2) : nombre de
   * passages, PDV distincts touchés, et la liste des PDV avec leur nombre de
   * passages — pour suivre l'objectif journalier (ex. 20 visites/jour).
   */
  async function fetchCouvertureParCommercial(f: DashFilters = {}): Promise<CouvertureCommercial[]> {
    const { data, error } = await (supabase.rpc as any)('couverture_visites_par_commercial', dashFilterParams(f))
    if (error) {
      console.warn('couverture_visites_par_commercial indisponible', error.message)
      return []
    }
    return (data || []) as CouvertureCommercial[]
  }

  /**
   * Présence vs disponibilité par SKU clé (tâche 3.3) : les références de rôle
   * « phare » (2 SKU clés) et « nouveaute » (gamme Délice). La liste est pilotée
   * par reference_produit.role, pas codée en dur.
   */
  async function fetchPresenceSkus(f: DashFilters = {}): Promise<PresenceSku[]> {
    const { data, error } = await (supabase.rpc as any)('dashboard_presence_skus', dashFilterParams(f))
    if (error) {
      console.warn('dashboard_presence_skus indisponible', error.message)
      return []
    }
    return (data || []) as PresenceSku[]
  }

  /**
   * PDV avec leurs critères manquants pour atteindre le niveau supérieur.
   * Filtré géographie + période comme le reste du dashboard : la RPC ne garde
   * que la dernière visite de chaque PDV dans la période (la vue brute émet
   * une ligne par visite, tri déjà appliqué côté SQL).
   */
  async function fetchPerfectStoreManques(f: DashFilters = {}, limit = 50): Promise<PerfectStoreManqueItem[]> {
    const { data, error } = await (supabase.rpc as any)('perfect_store_manques_filtre', {
      ...dashFilterParams(f),
      p_limit: limit,
    })
    if (error) {
      console.warn('perfect_store_manques_filtre indisponible', error.message)
      return []
    }
    return (data || []) as PerfectStoreManqueItem[]
  }

  return {
    refs,
    fetchRefs,
    scoreVisite,
    fetchGlobalKpi,
    fetchKpiParType,
    fetchCoverage,
    fetchStoresByTier,
    fetchPerfectStoreListe,
    fetchPerfectStoreEvolution,
    fetchPerfectStoreManques,
    fetchGlobalKpiFiltre,
    fetchCouvertureParCommercial,
    fetchPresenceSkus,
  }
}
