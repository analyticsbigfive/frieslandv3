// stores/pdv.ts
import { defineStore, skipHydrate } from 'pinia'
import { markRaw } from 'vue'
import type { PDV, Profile, ZoneSecteur } from '~/types'

// Colonnes nécessaires aux listes (admin table + mobile).
// Évite select('*') qui tire 24 colonnes inutiles (mdm, routing, dates…).
const LIST_COLUMNS = 'id,pdv_id,nom_pdv,canal,categorie_pdv,sous_categorie_pdv,autre_sous_categorie,zone,quartier,region,territory_code,area_code,distributor_name,adressage,image_url,geolocation_lat,geolocation_lng'

// Valeur sentinelle du filtre zone : PDV dont la zone n'est pas renseignée.
export const SANS_ZONE = '__SANS_ZONE__'

export const usePDVStore = defineStore('pdv', () => {
  const supabase = skipHydrate(markRaw(useSupabaseClient()))
  const cacheTTL = 5 * 60 * 1000

  const pdvList = ref<PDV[]>([])
  const currentPDV = ref<PDV | null>(null)
  const zones = ref<ZoneSecteur[]>([])
  const loading = ref(false)
  const total = ref(0)
  const scopedCache = ref<Record<string, { data: PDV[]; timestamp: number }>>({})

  const filters = ref({
    search: '',
    zone: '',
    region: '',
    canal: '',
    categorie: '',
    page: 1,
    perPage: 50,
  })

  // Unique values for filters — dérivées de la PAGE courante seulement (à
  // n'utiliser que pour un affichage lié aux lignes visibles).
  const uniqueZones = computed(() => [...new Set(pdvList.value.map(p => p.zone).filter(Boolean))])
  const uniqueRegions = computed(() => [...new Set(pdvList.value.map(p => p.region).filter(Boolean))])
  const uniqueCanaux = computed(() => [...new Set(pdvList.value.map(p => p.canal).filter(Boolean))])

  // Facettes de filtre = valeurs distinctes sur TOUT le parc scopé (pas la page
  // courante). La liste PDV est paginée : sans ça, les dropdowns Territoire /
  // Sous-région n'affichaient que les valeurs de la page affichée.
  const facetZones = ref<string[]>([])
  const facetRegions = ref<string[]>([])
  async function fetchFilterFacets(profile?: Profile | null) {
    let query = supabase.from('pdv').select('zone, region').eq('is_active', true)
    if (profile && !isPrivilegedProfile(profile)) {
      const territoires = profileTerritories(profile)
      if (territoires.length === 1) query = query.eq('zone', territoires[0])
      else if (territoires.length > 1) query = query.in('zone', territoires)
      const quartiers = (profile.quartiers_assignes || []).filter(Boolean)
      if (quartiers.length) query = query.or(quartierOrFilter(quartiers))
    }
    const { data, error } = await query
    if (error) return
    const rows = (data || []) as { zone: string | null; region: string | null }[]
    facetZones.value = [...new Set(rows.map(r => r.zone).filter((z): z is string => !!z))].sort((a, b) => a.localeCompare(b, 'fr'))
    facetRegions.value = [...new Set(rows.map(r => r.region).filter((r): r is string => !!r))].sort((a, b) => a.localeCompare(b, 'fr'))
  }

  function isPrivilegedProfile(profile?: Profile | null) {
    return profile?.role === 'admin' || profile?.role === 'superviseur'
  }

  // Filtre quartier serveur : quartier ∈ liste OU quartier non renseigné (NULL).
  // Un PDV sans quartier reste visible dès que la zone matche (même règle que pdvInScope).
  function quartierOrFilter(quartiers: string[]) {
    const list = quartiers.map(q => `"${q.replace(/"/g, '\\"')}"`).join(',')
    return `quartier.is.null,quartier.in.(${list})`
  }

  function getScopeKey(profile?: Profile | null) {
    if (!profile) return 'anonymous'

    if (isPrivilegedProfile(profile)) {
      return `privileged:${profile.id}`
    }

    const quartiers = (profile.quartiers_assignes || []).filter(Boolean).sort().join('|')
    const territoires = profileTerritories(profile).slice().sort().join('|')
    return [
      profile.id,
      profile.role,
      territoires,
      profile.region || '',
      quartiers,
    ].join(':')
  }

  function buildScopedQuery(profile?: Profile | null) {
    let query = supabase
      .from('pdv')
      .select(LIST_COLUMNS)
      .eq('is_active', true)
      .order('nom_pdv')

    if (!profile || isPrivilegedProfile(profile)) {
      return query
    }

    const territoires = profileTerritories(profile)
    if (territoires.length === 1) {
      query = query.eq('zone', territoires[0])
    }
    else if (territoires.length > 1) {
      query = query.in('zone', territoires)
    }

    const quartiers = (profile.quartiers_assignes || []).filter(Boolean)
    if (quartiers.length) {
      query = query.or(quartierOrFilter(quartiers))
    }

    return query
  }

  function clearScopedCache() {
    scopedCache.value = {}
  }

  async function fetchPDV() {
    loading.value = true

    try {
      let query = supabase
        .from('pdv')
        // 'exact' obligatoire : 'estimated' repose sur les stats du planificateur,
        // fausses après un import massif → total et pagination erronés.
        .select(LIST_COLUMNS, { count: 'exact' })
        .eq('is_active', true)
        .order('nom_pdv', { ascending: true })

      if (filters.value.search) {
        query = query.or(`nom_pdv.ilike.%${filters.value.search}%,pdv_id.ilike.%${filters.value.search}%,adressage.ilike.%${filters.value.search}%`)
      }
      // Sentinelle : isole les PDV sans zone, invisibles de tout périmètre
      // terrain tant qu'un admin ne les a pas rattachés à un territoire.
      if (filters.value.zone === SANS_ZONE) {
        query = query.or('zone.is.null,zone.eq.')
      }
      else if (filters.value.zone) {
        query = query.eq('zone', filters.value.zone)
      }
      if (filters.value.region) {
        query = query.eq('region', filters.value.region)
      }
      if (filters.value.canal) {
        query = query.eq('canal', filters.value.canal)
      }

      const from = (filters.value.page - 1) * filters.value.perPage
      const to = from + filters.value.perPage - 1
      query = query.range(from, to)

      const { data, count, error } = await query
      if (error) throw error

      pdvList.value = (data || []) as PDV[]
      total.value = count || 0
    }
    catch (err) {
      console.error('Erreur chargement PDV:', err)
    }
    finally {
      loading.value = false
    }
  }

  async function fetchAllPDV(): Promise<PDV[]> {
    const { data, error } = await supabase
      .from('pdv')
      .select('*')
      .eq('is_active', true)
      .order('nom_pdv')

    if (error) throw error
    return (data || []) as PDV[]
  }

  async function fetchScopedPDV(profile?: Profile | null, force = false): Promise<PDV[]> {
    const cacheKey = getScopeKey(profile)
    const cached = scopedCache.value[cacheKey]

    if (!force && cached && Date.now() - cached.timestamp < cacheTTL) {
      return cached.data
    }

    try {
      const { data, error } = await buildScopedQuery(profile)

      if (error) throw error

      const scopedData = (data || []) as PDV[]
      scopedCache.value[cacheKey] = {
        data: scopedData,
        timestamp: Date.now(),
      }

      // Persist to IndexedDB for offline fallback
      if (import.meta.client) {
        const { cachePDVList } = useOfflineData()
        void cachePDVList(scopedData)
      }

      return scopedData
    }
    catch (err) {
      // Fallback to IndexedDB cache on network error
      if (import.meta.client) {
        const { getCachedPDVListFallback } = useOfflineData()
        const fallback = await getCachedPDVListFallback()
        if (fallback) {
          console.warn('fetchScopedPDV: using offline cache fallback')
          return fallback
        }
      }
      throw err
    }
  }

  async function fetchPDVById(pdvId: string) {
    const { data, error } = await supabase
      .from('pdv')
      .select('*')
      .eq('pdv_id', pdvId)
      .single()

    if (error) throw error
    currentPDV.value = data as PDV
    return data
  }

  async function createPDV(pdv: Partial<PDV>) {
    const { data, error } = await supabase
      .from('pdv')
      .insert({
        ...pdv,
        pdv_id: pdv.pdv_id || crypto.randomUUID().substring(0, 8),
      })
      .select()
      .single()

    if (error) throw error
    clearScopedCache()
    return data
  }

  async function updatePDV(pdvId: string, updates: Partial<PDV>) {
    const { data, error } = await supabase
      .from('pdv')
      .update(updates)
      .eq('pdv_id', pdvId)
      .select()
      .single()

    if (error) throw error
    clearScopedCache()
    return data
  }

  async function deletePDV(pdvId: string) {
    const { error } = await supabase
      .from('pdv')
      .update({ is_active: false })
      .eq('pdv_id', pdvId)

    if (error) throw error
    pdvList.value = pdvList.value.filter(p => p.pdv_id !== pdvId)
    clearScopedCache()
  }

  async function fetchZones() {
    try {
      const { data, error } = await supabase
        .from('zones_secteurs')
        .select('*')
        .order('zone')

      if (error) throw error
      zones.value = (data || []) as ZoneSecteur[]

      // Persist to IndexedDB for offline fallback
      if (import.meta.client) {
        const { cacheZones } = useOfflineData()
        void cacheZones(zones.value)
      }
    }
    catch (err) {
      // Fallback to IndexedDB cache on network error
      if (import.meta.client) {
        const { getCachedZonesFallback } = useOfflineData()
        const fallback = await getCachedZonesFallback()
        if (fallback) {
          console.warn('fetchZones: using offline cache fallback')
          zones.value = fallback
          return
        }
      }
      throw err
    }
  }

  async function importPDVFromCSV(records: Record<string, string>[]) {
    const pdvData = records.map(r => ({
      pdv_id: r['PDV ID'] || crypto.randomUUID().substring(0, 8),
      nom_pdv: r['Nom du PDV'] || '',
      canal: r['Canal'] || 'General trade',
      categorie_pdv: r['Catégorie de PDV'] || 'Point de vente détail',
      sous_categorie_pdv: r['Sous-catégorie de PDV'] || 'Boutique C',
      autre_sous_categorie: r['Autre sous-catégorie de pdv'] || null,
      region: r['Région'] || null,
      zone: r['Zone'] || null,
      quartier: r['Quartier'] || r['Secteur'] || null,
      geolocation_lat: r['Geolocation'] ? parseFloat(r['Geolocation'].split(',')[0]?.trim()) : null,
      geolocation_lng: r['Geolocation'] ? parseFloat(r['Geolocation'].split(',')[1]?.trim()) : null,
      adressage: r['Adressage'] || null,
      image_url: r['Image'] || null,
      date_creation: r['Date'] || null,
      ajoute_par: r['Ajouté par'] || null,
      jour_routing: r['Jour du routing'] || null,
      position_routing: r['Position dans le routing'] ? parseInt(r['Position dans le routing']) : null,
      canal_routing: r['Canal de routing'] || null,
      sales_rep_routing: r['Sales Rep routing'] || null,
      // Référentiels (migration 020) + Perfect Store
      territory_code: r['Territoire'] || r['Territory'] || null,
      area_code: r['Area'] || null,
      distributor_name: r['Distributeur'] || r['Distributor'] || null,
      objectif_perfect_store: ['FLAGSHIP', 'VIP', 'CORE', 'BASIC'].includes((r['Objectif Perfect Store'] || '').trim().toUpperCase())
        ? (r['Objectif Perfect Store'] || '').trim().toUpperCase()
        : null,
    }))

    const batchSize = 500
    for (let i = 0; i < pdvData.length; i += batchSize) {
      const batch = pdvData.slice(i, i + batchSize)
      const { error } = await supabase.from('pdv').upsert(batch, { onConflict: 'pdv_id' })
      if (error) throw error
    }

    return pdvData.length
  }

  return {
    pdvList,
    currentPDV,
    zones,
    loading,
    total,
    filters,
    uniqueZones,
    uniqueRegions,
    uniqueCanaux,
    facetZones,
    facetRegions,
    fetchFilterFacets,
    fetchPDV,
    fetchAllPDV,
    fetchScopedPDV,
    fetchPDVById,
    createPDV,
    updatePDV,
    deletePDV,
    fetchZones,
    importPDVFromCSV,
    clearScopedCache,
  }
})
