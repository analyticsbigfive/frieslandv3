// composables/useReferentiels.ts
// Charge les référentiels métier (migration 020) : distributeurs, hiérarchie
// géo (division/sous-région/territoire/area), types de PDV.
export interface Distributeur { name: string; trade_type: 'GT' | 'MT' }
export interface GeoDivision { code: string; name: string }
export interface GeoSubRegion { code: string; name: string; division_code: string | null }
export interface GeoTerritory { code: string; name: string; sub_region_code: string | null }
export interface GeoArea { territory_code: string; area_code: string; area_name: string | null; distributor_name: string | null }
export interface PosType { level4_type: string; level3_group: string; tier: string | null }

export function useReferentiels() {
  const supabase = useSupabaseClient()

  const distributeurs = useState<Distributeur[]>('ref-distributeurs', () => [])
  const divisions = useState<GeoDivision[]>('ref-divisions', () => [])
  const subRegions = useState<GeoSubRegion[]>('ref-subregions', () => [])
  const territories = useState<GeoTerritory[]>('ref-territories', () => [])
  const areas = useState<GeoArea[]>('ref-areas', () => [])
  const posTypes = useState<PosType[]>('ref-postypes', () => [])
  const loaded = useState<boolean>('ref-loaded', () => false)
  const error = useState<string | null>('ref-error', () => null)

  async function fetchReferentiels(force = false) {
    if (loaded.value && !force) return
    error.value = null
    try {
      const [d, dv, sr, t, a, p] = await Promise.all([
        supabase.from('distributeurs').select('name, trade_type').order('name'),
        supabase.from('geo_divisions').select('code, name').order('name'),
        supabase.from('geo_sub_regions').select('code, name, division_code').order('name'),
        supabase.from('geo_territories').select('code, name, sub_region_code').order('name'),
        supabase.from('geo_areas').select('territory_code, area_code, area_name, distributor_name').order('territory_code'),
        supabase.from('pos_types').select('level4_type, level3_group, tier').order('level3_group'),
      ])
      const firstErr = [d, dv, sr, t, a, p].find(r => r.error)?.error
      if (firstErr) throw firstErr
      distributeurs.value = (d.data || []) as Distributeur[]
      divisions.value = (dv.data || []) as GeoDivision[]
      subRegions.value = (sr.data || []) as GeoSubRegion[]
      territories.value = (t.data || []) as GeoTerritory[]
      areas.value = (a.data || []) as GeoArea[]
      posTypes.value = (p.data || []) as PosType[]
      loaded.value = true
    }
    catch (err: any) {
      error.value = err?.message || 'Erreur de chargement des référentiels'
      console.warn('useReferentiels: indisponible (migration 020 lancée ?)', error.value)
    }
  }

  return { distributeurs, divisions, subRegions, territories, areas, posTypes, loaded, error, fetchReferentiels }
}
