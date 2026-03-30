// stores/pdv.ts
import { defineStore } from 'pinia'
import type { PDV, ZoneSecteur } from '~/types'

export const usePDVStore = defineStore('pdv', () => {
  const supabase = useSupabaseClient()

  const pdvList = ref<PDV[]>([])
  const currentPDV = ref<PDV | null>(null)
  const zones = ref<ZoneSecteur[]>([])
  const loading = ref(false)
  const total = ref(0)

  const filters = ref({
    search: '',
    zone: '',
    region: '',
    canal: '',
    categorie: '',
    page: 1,
    perPage: 50,
  })

  // Unique values for filters
  const uniqueZones = computed(() => [...new Set(pdvList.value.map(p => p.zone).filter(Boolean))])
  const uniqueRegions = computed(() => [...new Set(pdvList.value.map(p => p.region).filter(Boolean))])
  const uniqueCanaux = computed(() => [...new Set(pdvList.value.map(p => p.canal).filter(Boolean))])

  async function fetchPDV() {
    loading.value = true

    try {
      let query = supabase
        .from('pdv')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .order('nom_pdv', { ascending: true })

      if (filters.value.search) {
        query = query.or(`nom_pdv.ilike.%${filters.value.search}%,pdv_id.ilike.%${filters.value.search}%,adressage.ilike.%${filters.value.search}%`)
      }
      if (filters.value.zone) {
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
    return data
  }

  async function deletePDV(pdvId: string) {
    const { error } = await supabase
      .from('pdv')
      .update({ is_active: false })
      .eq('pdv_id', pdvId)

    if (error) throw error
    pdvList.value = pdvList.value.filter(p => p.pdv_id !== pdvId)
  }

  async function fetchZones() {
    const { data, error } = await supabase
      .from('zones_secteurs')
      .select('*')
      .order('zone')

    if (error) throw error
    zones.value = (data || []) as ZoneSecteur[]
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
      secteur: r['Secteur'] || null,
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
    fetchPDV,
    fetchAllPDV,
    fetchPDVById,
    createPDV,
    updatePDV,
    deletePDV,
    fetchZones,
    importPDVFromCSV,
  }
})
