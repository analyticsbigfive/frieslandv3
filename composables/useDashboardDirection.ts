/**
 * Composable pour les données du dashboard direction
 * Charge les visites avec jointure PDV et applique les filtres
 * Fallback automatique si la RPC n'existe pas
 */
import type { DashboardFilterValues } from '~/components/DashboardFilters.vue'
import { agregerParPeriode } from '~/utils/agregation'

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
    quartier: string
  } | null
}

export function useDashboardDirection() {
  const supabase = useSupabaseClient()
  const toast = useToast()

  const visites = ref<VisiteWithPDV[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
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
    division: '',
    region: '',
    zone: '',
    area: '',
    quartier: '',
    nomPdv: '',
  })

  /** Fallback: requête directe visites + join PDV si la RPC n'existe pas */
  async function fetchVisitesFallback() {
    let query = supabase
      .from('visites')
      .select('visite_id, date_visite, commercial, email, data, pdv_id, pdv:pdv_id(pdv_id, nom_pdv, canal, categorie_pdv, sous_categorie_pdv, region, zone, quartier)')
      .order('date_visite', { ascending: false })
      .limit(2000)

    if (filters.value.dateFrom) {
      query = query.gte('date_visite', filters.value.dateFrom + 'T00:00:00')
    }
    if (filters.value.dateTo) {
      query = query.lte('date_visite', filters.value.dateTo + 'T23:59:59')
    }
    if (filters.value.commercial) {
      query = query.ilike('commercial', `%${filters.value.commercial}%`)
    }

    const { data, error: qError } = await query

    if (qError) throw qError

    // Filtres PDV appliqués côté client (le fallback ne sait filtrer que
    // dates + commercial en SQL). La division n'est pas résolvable ici.
    const f = filters.value
    const rows = (data || []).filter((row: any) => {
      const p = row.pdv
      if (f.canal && p?.canal !== f.canal) return false
      if (f.categorie && p?.categorie_pdv !== f.categorie) return false
      if (f.sousCategorie && p?.sous_categorie_pdv !== f.sousCategorie) return false
      if (f.region && p?.region !== f.region) return false
      if (f.zone && p?.zone !== f.zone) return false
      if (f.quartier && !(p?.quartier || '').toLowerCase().includes(f.quartier.toLowerCase())) return false
      if (f.nomPdv && !(p?.nom_pdv || '').toLowerCase().includes(f.nomPdv.toLowerCase())) return false
      return true
    })

    visites.value = rows.map((row: any) => ({
      visite_id: row.visite_id,
      date_visite: row.date_visite,
      commercial: row.commercial,
      email: row.email,
      data: row.data,
      pdv: row.pdv || null,
    }))
  }

  async function fetchVisites() {
    loading.value = true
    error.value = null
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
        p_secteur: filters.value.quartier || null,
        p_nom_pdv: filters.value.nomPdv || null,
        p_division: filters.value.division || null,
        p_area: filters.value.area || null,
      }

      // PAGINÉ. La RPC se terminait par un `limit 2000` en dur pour 26 261
      // visites en base : sur un périmètre large, les écrans analysaient
      // silencieusement les 2 000 plus récentes et rendaient des chiffres faux
      // vers le bas. Le plafond reste borné (MAX_LIGNES) pour ne pas ramener
      // tout l'historique dans le navigateur — mais il est explicite, et
      // atteint il se signale dans la console plutôt que de tronquer sans rien
      // dire.
      // PAGE = 1000 et pas davantage : PostgREST plafonne toute réponse à
      // 1 000 lignes, RPC comprises (vérifié le 7 sept. — un `p_limit` à 2 000
      // rend 1 000 lignes). Une page plus large ferait croire à la dernière
      // page dès la première et rétablirait la troncature qu'on corrige.
      const PAGE = 1000
      const MAX_LIGNES = 20000
      const lignes: any[] = []
      for (let offset = 0; offset < MAX_LIGNES; offset += PAGE) {
        const { data: page, error: rpcError } = await supabase.rpc('get_visites_filtered', {
          ...params,
          p_limit: PAGE,
          p_offset: offset,
        } as any)

        if (rpcError) {
          if (offset === 0) {
            // Tant que la migration 20260910150000 n'est pas appliquée, la RPC
            // n'accepte pas p_limit/p_offset et PostgREST répond « function not
            // found ». On réessaie sans eux : l'ancien comportement (2 000
            // lignes) vaut mieux que le repli client, qui ne sait pas filtrer
            // sur la géographie.
            const { data: ancienne, error: erreurAncienne } = await supabase.rpc('get_visites_filtered', params)
            if (!erreurAncienne) {
              lignes.push(...(ancienne || []))
              console.warn('get_visites_filtered : pagination indisponible (migration 20260910150000 non appliquée), lecture plafonnée à 1 000 visites.')
              break
            }
            console.warn('RPC get_visites_filtered indisponible, fallback query directe:', rpcError.message)
            await fetchVisitesFallback()
            return
          }
          console.warn('get_visites_filtered : page suivante indisponible', rpcError.message)
          break
        }

        lignes.push(...(page || []))
        if ((page?.length || 0) < PAGE) break
        if (lignes.length >= MAX_LIGNES) {
          console.warn(`get_visites_filtered : ${MAX_LIGNES} visites atteintes, resserrez la période ou le périmètre.`)
        }
      }

      // Transform flat RPC result to VisiteWithPDV structure
      visites.value = lignes.map((row: any) => ({
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
              quartier: row.quartier,
            }
          : null,
      }))
    }
    catch (err: any) {
      const msg = err?.message || 'Erreur inconnue'
      error.value = msg
      console.error('Erreur chargement visites direction:', err)
      toast.add({
        title: 'Erreur de chargement',
        description: `Impossible de charger les visites : ${msg}`,
        color: 'red',
        icon: 'i-heroicons-exclamation-triangle',
        timeout: 6000,
      })
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

  // Agrégation par semaine ISO pour l'évolution — implémentation unique dans
  // utils/agregation.ts (lot 5), partagée avec les écrans d'évolution.
  function evolutionParSemaine(predicate: (v: VisiteWithPDV) => boolean) {
    const points = agregerParPeriode(visites.value, v => v.date_visite, 'semaine', predicate)
    return {
      labels: points.map(p => p.label),
      counts: points.map(p => p.match),
      totals: points.map(p => p.total),
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
    error,
    totalVisites,
    filters,
    fetchVisites,
    countWhere,
    pctWhere,
    presenceAbsence,
    evolutionParSemaine,
    etatBreakdown,
  }
}
