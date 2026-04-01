// stores/visites.ts
import { defineStore, skipHydrate } from 'pinia'
import { markRaw } from 'vue'
import type { Visite, DashboardStats } from '~/types'

export const useVisitesStore = defineStore('visites', () => {
  const supabase = skipHydrate(markRaw(useSupabaseClient()))

  const visites = ref<Visite[]>([])
  const currentVisite = ref<Visite | null>(null)
  const loading = ref(false)
  const total = ref(0)
  const stats = ref<DashboardStats | null>(null)

  // Stats cache: TTL 5 minutes + deduplication
  const statsCacheTTL = 5 * 60 * 1000
  let statsCacheTimestamp = 0
  let statsPromise: Promise<void> | null = null

  // Filters
  const filters = ref({
    dateFrom: '',
    dateTo: '',
    commercial: '',
    email: '',
    pdv_id: '',
    zone: '',
    region: '',
    page: 1,
    perPage: 50,
  })

  async function fetchVisites() {
    loading.value = true

    try {
      let query = supabase
        .from('visites')
        .select('*, pdv:pdv_id(pdv_id, nom_pdv, zone, secteur, region, canal, image_url)', { count: 'exact' })
        .order('date_visite', { ascending: false })

      if (filters.value.dateFrom) {
        query = query.gte('date_visite', filters.value.dateFrom)
      }
      if (filters.value.dateTo) {
        query = query.lte('date_visite', filters.value.dateTo + 'T23:59:59')
      }
      if (filters.value.commercial) {
        query = query.ilike('commercial', `%${filters.value.commercial}%`)
      }
      if (filters.value.email) {
        query = query.eq('email', filters.value.email)
      }
      if (filters.value.pdv_id) {
        query = query.eq('pdv_id', filters.value.pdv_id)
      }

      const from = (filters.value.page - 1) * filters.value.perPage
      const to = from + filters.value.perPage - 1
      query = query.range(from, to)

      const { data, count, error } = await query

      if (error) throw error
      visites.value = (data || []) as Visite[]
      total.value = count || 0
    }
    catch (err) {
      console.error('Erreur chargement visites:', err)
    }
    finally {
      loading.value = false
    }
  }

  async function fetchVisiteById(id: string) {
    const { data, error } = await supabase
      .from('visites')
      .select('*, pdv:pdv_id(nom_pdv, zone, secteur, region)')
      .eq('visite_id', id)
      .single()

    if (error) throw error
    currentVisite.value = data as Visite
    return data
  }

  async function createVisite(visite: Partial<Visite>) {
    const { data, error } = await supabase
      .from('visites')
      .insert(visite)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async function updateVisite(id: string, updates: Partial<Visite>) {
    const { data, error } = await supabase
      .from('visites')
      .update(updates)
      .eq('visite_id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async function deleteVisite(id: string) {
    const { error } = await supabase
      .from('visites')
      .delete()
      .eq('visite_id', id)

    if (error) throw error
    visites.value = visites.value.filter(v => v.visite_id !== id)
  }

  async function fetchStats(options: { force?: boolean } = {}) {
    // Return cached if still valid
    if (!options.force && stats.value && Date.now() - statsCacheTimestamp < statsCacheTTL) {
      return
    }

    // Deduplicate concurrent calls
    if (statsPromise) {
      return statsPromise
    }

    statsPromise = (async () => {
      try {
        // All 5 queries in parallel — each with individual error handling
        const [statsResult, perfResult, jourResult, distResult, countResult] = await Promise.all([
          supabase.from('v_stats_visites').select('*').single().then(r => r).catch(() => ({ data: null, error: 'view missing' })),
          supabase.from('v_performance_commerciaux').select('*').limit(20).then(r => r).catch(() => ({ data: null, error: 'view missing' })),
          supabase.from('v_visites_par_jour').select('*').limit(30).then(r => r).catch(() => ({ data: null, error: 'view missing' })),
          supabase.from('v_distribution_pdv').select('*').then(r => r).catch(() => ({ data: null, error: 'view missing' })),
          supabase.from('pdv').select('*', { count: 'exact', head: true }).eq('is_active', true),
        ])

        // Log warnings for missing views
        const viewErrors: string[] = []
        if (statsResult.error) viewErrors.push('v_stats_visites')
        if (perfResult.error) viewErrors.push('v_performance_commerciaux')
        if (jourResult.error) viewErrors.push('v_visites_par_jour')
        if (distResult.error) viewErrors.push('v_distribution_pdv')

        if (viewErrors.length > 0) {
          console.warn('Vues SQL manquantes ou inaccessibles:', viewErrors.join(', '))
        }

        const statsData = statsResult.data as any
        const perfData = (perfResult.data || []) as any[]
        const jourData = (jourResult.data || []) as any[]
        const distData = (distResult.data || []) as any[]
        const totalPDV = (countResult as any).count

        // Fallback: si v_stats_visites manquante, calculer les stats de base
        let fallbackStats: any = null
        if (!statsData) {
          const { count } = await supabase.from('visites').select('*', { count: 'exact', head: true })
          const { count: monthCount } = await supabase.from('visites')
            .select('*', { count: 'exact', head: true })
            .gte('date_visite', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
          fallbackStats = {
            total_visites: count || 0,
            visites_month: monthCount || 0,
            commerciaux_actifs: 0,
            visites_today: 0,
            visites_week: 0,
          }
        }

        // Fallback: si v_distribution_pdv manquante, calculer depuis pdv
        let fallbackDist: any[] = distData
        if (!distData.length && !distResult.error) {
          // Data is just empty
        }
        else if (distResult.error) {
          const { data: pdvData } = await supabase
            .from('pdv')
            .select('sous_categorie_pdv')
            .eq('is_active', true)
          if (pdvData) {
            const grouped = new Map<string, number>()
            pdvData.forEach((p: any) => {
              const key = p.sous_categorie_pdv || 'Autre'
              grouped.set(key, (grouped.get(key) || 0) + 1)
            })
            fallbackDist = [...grouped.entries()]
              .map(([type, count]) => ({ type, count }))
              .sort((a, b) => b.count - a.count)
          }
        }

        const src = statsData || fallbackStats || {}

        stats.value = {
          total_visites: src.total_visites || 0,
          total_pdv: totalPDV || 0,
          total_commerciaux: src.commerciaux_actifs || 0,
          visites_today: src.visites_today || 0,
          visites_week: src.visites_week || 0,
          visites_month: src.visites_month || 0,
          taux_evap: src.taux_evap || 0,
          taux_imp: src.taux_imp || 0,
          taux_scm: src.taux_scm || 0,
          taux_uht: src.taux_uht || 0,
          taux_yaourt: src.taux_yaourt || 0,
          taux_prix_evap: 0,
          taux_prix_imp: 0,
          taux_prix_scm: 0,
          performance_commerciaux: perfData.map((p: any) => ({
            nom: p.nom,
            email: p.email,
            total_visites: p.total_visites,
            visites_mois: p.visites_mois,
            taux_completion: 0,
          })),
          visites_par_jour: jourData.map((j: any) => ({
            date: j.date,
            count: j.count,
          })),
          distribution_pdv: (fallbackDist.length ? fallbackDist : distData).map((d: any) => ({
            type: d.type,
            count: d.count,
          })),
        }

        statsCacheTimestamp = Date.now()
      }
      catch (err) {
        console.error('Erreur chargement stats:', err)
        // Initialize with empty stats so the page still renders
        if (!stats.value) {
          stats.value = {
            total_visites: 0,
            total_pdv: 0,
            total_commerciaux: 0,
            visites_today: 0,
            visites_week: 0,
            visites_month: 0,
            taux_evap: 0,
            taux_imp: 0,
            taux_scm: 0,
            taux_uht: 0,
            taux_yaourt: 0,
            taux_prix_evap: 0,
            taux_prix_imp: 0,
            taux_prix_scm: 0,
            performance_commerciaux: [],
            visites_par_jour: [],
            distribution_pdv: [],
          }
        }
      }
      finally {
        statsPromise = null
      }
    })()

    return statsPromise
  }

  return {
    visites,
    currentVisite,
    loading,
    total,
    stats,
    filters,
    fetchVisites,
    fetchVisiteById,
    createVisite,
    updateVisite,
    deleteVisite,
    fetchStats,
  }
})
