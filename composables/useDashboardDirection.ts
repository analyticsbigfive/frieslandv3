/**
 * Composable pour les données du dashboard direction
 * Charge les visites avec jointure PDV et applique les filtres
 */
import type { DashboardFilterValues } from '~/components/DashboardFilters.vue'

export interface VisiteWithPDV {
  visite_id: string
  date_visite: string
  commercial: string
  email: string
  data: any
  pdv: {
    pdv_id: string
    nom_pdv: string
    canal: string
    categorie_pdv: string
    sous_categorie_pdv: string
    region: string
    zone: string
    secteur: string
  } | null
}

export function useDashboardDirection() {
  const supabase = useSupabaseClient()

  const visites = ref<VisiteWithPDV[]>([])
  const loading = ref(false)
  const totalVisites = computed(() => visites.value.length)

  const now = new Date()
  const threeMonthsAgo = new Date(now)
  threeMonthsAgo.setMonth(now.getMonth() - 3)

  const filters = ref<DashboardFilterValues>({
    dateFrom: threeMonthsAgo.toISOString().slice(0, 10),
    dateTo: now.toISOString().slice(0, 10),
    canal: '',
    categorie: '',
    sousCategorie: '',
    commercial: '',
    region: '',
    zone: '',
    secteur: '',
    nomPdv: '',
  })

  // Zones disponibles pour les filtres
  const availableZones = ref<string[]>([''])

  async function fetchZones() {
    const { data } = await supabase
      .from('pdv')
      .select('zone')
      .not('zone', 'is', null)
      .order('zone')
    const zones = [...new Set((data || []).map((d: any) => d.zone).filter(Boolean))]
    availableZones.value = ['', ...zones]
  }

  async function fetchVisites() {
    loading.value = true
    try {
      const params: Record<string, string | null> = {
        p_date_from: filters.value.dateFrom ? filters.value.dateFrom + 'T00:00:00' : null,
        p_date_to: filters.value.dateTo ? filters.value.dateTo + 'T23:59:59' : null,
        p_commercial: filters.value.commercial || null,
        p_canal: filters.value.canal || null,
        p_categorie: filters.value.categorie || null,
        p_sous_categorie: filters.value.sousCategorie || null,
        p_region: filters.value.region || null,
        p_zone: filters.value.zone || null,
        p_secteur: filters.value.secteur || null,
        p_nom_pdv: filters.value.nomPdv || null,
      }

      const { data, error } = await supabase.rpc('get_visites_filtered', params)

      if (error) throw error

      // Transform flat RPC result to VisiteWithPDV structure
      visites.value = (data || []).map((row: any) => ({
        visite_id: row.visite_id,
        date_visite: row.date_visite,
        commercial: row.commercial,
        email: row.email,
        data: row.data,
        pdv: row.pdv_id
          ? {
              pdv_id: row.pdv_id,
              nom_pdv: row.nom_pdv,
              canal: row.canal,
              categorie_pdv: row.categorie_pdv,
              sous_categorie_pdv: row.sous_categorie_pdv,
              region: row.region,
              zone: row.zone,
              secteur: row.secteur,
            }
          : null,
      }))
    }
    catch (err) {
      console.error('Erreur chargement visites direction:', err)
    }
    finally {
      loading.value = false
    }
  }

  // Helpers de stats
  function countWhere(predicate: (v: VisiteWithPDV) => boolean) {
    return visites.value.filter(predicate).length
  }

  function pctWhere(predicate: (v: VisiteWithPDV) => boolean, total?: number) {
    const t = total ?? visites.value.length
    if (t === 0) return 0
    return Math.round(countWhere(predicate) / t * 100 * 10) / 10
  }

  function presenceAbsence(predicate: (v: VisiteWithPDV) => boolean) {
    const present = countWhere(predicate)
    const absent = visites.value.length - present
    return {
      labels: ['Présent', 'Absent'],
      values: [present, absent],
      pctPresent: visites.value.length > 0 ? Math.round(present / visites.value.length * 1000) / 10 : 0,
    }
  }

  // Aggrégation par semaine pour l'évolution
  function evolutionParSemaine(predicate: (v: VisiteWithPDV) => boolean) {
    const weeks = new Map<string, { total: number; match: number }>()

    visites.value.forEach(v => {
      const d = new Date(v.date_visite)
      const weekStart = new Date(d)
      weekStart.setDate(d.getDate() - d.getDay())
      const key = weekStart.toISOString().slice(0, 10)

      if (!weeks.has(key)) weeks.set(key, { total: 0, match: 0 })
      const w = weeks.get(key)!
      w.total++
      if (predicate(v)) w.match++
    })

    const sorted = [...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    return {
      labels: sorted.map(([k]) => {
        const d = new Date(k)
        return d.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })
      }),
      counts: sorted.map(([, v]) => v.match),
      totals: sorted.map(([, v]) => v.total),
    }
  }

  // État breakdown (Bon, À renouveler, etc.)
  function etatBreakdown(getEtat: (v: VisiteWithPDV) => string | undefined, filterPresent: (v: VisiteWithPDV) => boolean) {
    const counts = new Map<string, number>()
    const filtered = visites.value.filter(filterPresent)
    
    filtered.forEach(v => {
      const etat = getEtat(v) || 'Non défini'
      counts.set(etat, (counts.get(etat) || 0) + 1)
    })

    const etatColors: Record<string, string> = {
      'Bon': '#3B82F6',
      'Acceptable': '#F59E0B',
      'À renouveler': '#06B6D4',
      'Au standard': '#EC4899',
      'Non défini': '#9CA3AF',
    }

    const entries = [...counts.entries()].sort((a, b) => b[1] - a[1])
    return {
      labels: entries.map(([k]) => k),
      values: entries.map(([, v]) => v),
      colors: entries.map(([k]) => etatColors[k] || '#9CA3AF'),
    }
  }

  return {
    visites,
    loading,
    totalVisites,
    filters,
    availableZones,
    fetchZones,
    fetchVisites,
    countWhere,
    pctWhere,
    presenceAbsence,
    evolutionParSemaine,
    etatBreakdown,
  }
}
