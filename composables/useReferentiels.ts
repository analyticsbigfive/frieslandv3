// composables/useReferentiels.ts
// Charge les référentiels métier : distributeurs, hiérarchie géo
// (division/sous-région/territoire/area), types de PDV, et les barèmes
// Perfect Store éditables (poids SKU, seuils de disponibilité).
export interface Distributeur { name: string; trade_type: 'GT' | 'MT' }
export interface GeoDivision { code: string; name: string }
export interface GeoSubRegion { code: string; name: string; division_code: string | null }
export interface GeoTerritory { code: string; name: string; sub_region_code: string | null }
export interface GeoArea { territory_code: string; area_code: string; area_name: string | null; distributor_name: string | null }
export interface PosType { level4_type: string; level3_group: string; tier: string | null; canal: 'GT' | 'MT' | null }
// AvailabilityWeight / AvailabilityStandard sont définis dans utils/perfectStore.ts
// (auto-importés). On réutilise ces types ici pour éviter une double définition.

export function useReferentiels() {
  const supabase = useSupabaseClient()

  const distributeurs = useState<Distributeur[]>('ref-distributeurs', () => [])
  const divisions = useState<GeoDivision[]>('ref-divisions', () => [])
  const subRegions = useState<GeoSubRegion[]>('ref-subregions', () => [])
  const territories = useState<GeoTerritory[]>('ref-territories', () => [])
  const areas = useState<GeoArea[]>('ref-areas', () => [])
  const posTypes = useState<PosType[]>('ref-postypes', () => [])
  const availabilityWeights = useState<AvailabilityWeight[]>('ref-avweights', () => [])
  const availabilityStandards = useState<AvailabilityStandard[]>('ref-avstandards', () => [])
  const loaded = useState<boolean>('ref-loaded', () => false)
  const error = useState<string | null>('ref-error', () => null)

  async function fetchReferentiels(force = false) {
    if (loaded.value && !force) return
    error.value = null
    try {
      // pos_types : la colonne canal (migration 023) peut ne pas exister encore →
      // on retombe sur la sélection sans canal pour ne pas casser tout l'écran.
      let posReq = await supabase.from('pos_types').select('level4_type, level3_group, tier, canal').order('level3_group')
      if (posReq.error && /canal/i.test(posReq.error.message || '')) {
        posReq = await supabase.from('pos_types').select('level4_type, level3_group, tier').order('level3_group')
      }

      const [d, dv, sr, t, a, w, s] = await Promise.all([
        supabase.from('distributeurs').select('name, trade_type').order('name'),
        supabase.from('geo_divisions').select('code, name').order('name'),
        supabase.from('geo_sub_regions').select('code, name, division_code').order('name'),
        supabase.from('geo_territories').select('code, name, sub_region_code').order('name'),
        supabase.from('geo_areas').select('territory_code, area_code, area_name, distributor_name').order('territory_code'),
        supabase.from('availability_weights').select('category, trade_type, basis, sku, weight').order('category'),
        supabase.from('availability_standards').select('category, sku, standard_group, tier, min_quantity').order('category'),
      ])
      const firstErr = [posReq, d, dv, sr, t, a, w, s].find(r => r.error)?.error
      if (firstErr) throw firstErr
      distributeurs.value = (d.data || []) as Distributeur[]
      divisions.value = (dv.data || []) as GeoDivision[]
      subRegions.value = (sr.data || []) as GeoSubRegion[]
      territories.value = (t.data || []) as GeoTerritory[]
      areas.value = (a.data || []) as GeoArea[]
      posTypes.value = (posReq.data || []).map((p: any) => ({ canal: null, ...p })) as PosType[]
      availabilityWeights.value = (w.data || []) as AvailabilityWeight[]
      availabilityStandards.value = (s.data || []) as AvailabilityStandard[]
      loaded.value = true
    }
    catch (err: any) {
      error.value = err?.message || 'Erreur de chargement des référentiels'
      console.warn('useReferentiels: indisponible (migrations 020/023 lancées ?)', error.value)
    }
  }

  return {
    distributeurs, divisions, subRegions, territories, areas, posTypes,
    availabilityWeights, availabilityStandards,
    loaded, error, fetchReferentiels,
  }
}
