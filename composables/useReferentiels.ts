// composables/useReferentiels.ts
// SYSTÈME B (référentiel supabase/nouveau). Lit les tables normalisées B
// (territoire, distributeur, type_pdv/categorie_pdv, reference_produit,
// poids_reference, seuil_disponibilite) et les remet en forme dans les tableaux
// déjà consommés par les écrans, pour ne rien casser côté affichage.
//
// ⚠️ Divergences B vs A (décisions actées) :
//   - distributeur : champ `national` (booléen) à la place de trade_type GT/MT.
//   - les 179 AREA du fichier sont stockées dans `zone` et exposées via `areas`.
//   - poids : pas de `basis` en B -> exposé en dur 'taux_vente'.
//   - type PDV : pas de `tier` en B (le grade vit dans segment_grade_type_pdv).
export interface Distributeur { name: string; national: boolean }
export interface GeoRegion { code: string; name: string; nom_affichage: string | null }
export interface GeoSubRegion { code: string; name: string; nom_affichage: string | null; region_code: string | null }
export interface GeoTerritory { code: string; name: string; sub_region_code: string | null }
export interface GeoArea { id: number; code: string; name: string; territory_code: string }
export interface PosType { level4_type: string; level3_group: string; tier: string | null; canal: 'GT' | 'MT' | null }
export interface ReferenceProduit { id: number; nom: string; category: string }
export interface CategoriePdvRef { id: number; nom: string; canal: 'GT' | 'MT' | null }
export interface TerritoireDistributeur { territory_code: string; territory_name: string; distributor_name: string }
export interface ZoneDistributeur { zone_id: number; distributor_name: string }
// AvailabilityWeight / AvailabilityStandard : types auto-importés de utils/perfectStore.

export function useReferentiels() {
  const supabase = useSupabaseClient()

  const distributeurs = useState<Distributeur[]>('refb-distributeurs', () => [])
  const regions = useState<GeoRegion[]>('refb-regions', () => [])
  const subRegions = useState<GeoSubRegion[]>('refb-subregions', () => [])
  const territories = useState<GeoTerritory[]>('refb-territories', () => [])
  const areas = useState<GeoArea[]>('refb-areas', () => [])
  const posTypes = useState<PosType[]>('refb-postypes', () => [])
  const availabilityWeights = useState<AvailabilityWeight[]>('refb-avweights', () => [])
  const availabilityStandards = useState<AvailabilityStandard[]>('refb-avstandards', () => [])
  // Helpers B pour le CRUD (résolution des FK par nom).
  const references = useState<ReferenceProduit[]>('refb-references', () => [])
  const categoriesPdv = useState<CategoriePdvRef[]>('refb-categories-pdv', () => [])
  const territoireDistributeurs = useState<TerritoireDistributeur[]>('refb-territoire-distributeurs', () => [])
  // Distributeur au niveau area (zone) : permet de faire varier le distributeur
  // d'une area à l'autre dans un même territoire. Défaut seedé = hérité du territoire.
  const zoneDistributeurs = useState<ZoneDistributeur[]>('refb-zone-distributeurs', () => [])
  const loaded = useState<boolean>('refb-loaded', () => false)
  const error = useState<string | null>('refb-error', () => null)

  // categorie_produit(code) peut revenir en objet ou tableau selon l'embed PostgREST.
  const catCode = (rp: any) => {
    const cp = rp?.categorie_produit
    return (Array.isArray(cp) ? cp[0]?.code : cp?.code) ?? ''
  }
  const one = (x: any) => (Array.isArray(x) ? x[0] : x)

  async function fetchReferentiels(force = false) {
    if (loaded.value && !force) return
    error.value = null
    try {
      const [d, rg, sr, t, z, tp, rp, pr, sd, td, zd] = await Promise.all([
        supabase.from('distributeur').select('nom, national').order('nom'),
        supabase.from('region').select('code, nom, nom_affichage').order('nom'),
        supabase.from('sous_region').select('code, nom, nom_affichage, region_code').order('nom'),
        supabase.from('territoire').select('code, nom, sous_region_code').order('nom'),
        supabase.from('zone').select('id, code, nom, territoire_code').order('territoire_code').order('nom'),
        supabase.from('type_pdv').select('nom, categorie_pdv(id, nom, canal)').order('nom'),
        supabase.from('reference_produit').select('id, nom, categorie_produit(code)').order('nom'),
        supabase.from('poids_reference').select('canal, base_calcul, poids, reference_produit(nom, categorie_produit(code))'),
        supabase.from('seuil_disponibilite').select('segment, grade, quantite_min, reference_produit(nom, categorie_produit(code))'),
        supabase.from('territoire_distributeur').select('territoire(code, nom), distributeur(nom)'),
        supabase.from('zone_distributeur').select('zone_id, distributeur(nom)'),
      ])
      const firstErr = [d, rg, sr, t, z, tp, rp, pr, sd, td, zd].find(r => r.error)?.error
      if (firstErr) throw firstErr

      distributeurs.value = (d.data || []).map((r: any) => ({ name: r.nom, national: !!r.national }))
      regions.value = (rg.data || []).map((r: any) => ({ code: r.code, name: r.nom, nom_affichage: r.nom_affichage }))
      subRegions.value = (sr.data || []).map((r: any) => ({ code: r.code, name: r.nom, nom_affichage: r.nom_affichage, region_code: r.region_code }))
      territories.value = (t.data || []).map((r: any) => ({ code: r.code, name: r.nom, sub_region_code: r.sous_region_code }))
      areas.value = (z.data || []).map((r: any) => ({
        id: r.id,
        code: r.code || '',
        name: r.nom,
        territory_code: r.territoire_code,
      }))

      posTypes.value = (tp.data || []).map((r: any) => {
        const cp = one(r.categorie_pdv)
        return { level4_type: r.nom, level3_group: cp?.nom ?? '', tier: null, canal: cp?.canal ?? null }
      })
      categoriesPdv.value = [...new Map((tp.data || [])
        .map((r: any) => one(r.categorie_pdv))
        .filter(Boolean)
        .map((cp: any) => [cp.id, { id: cp.id, nom: cp.nom, canal: cp.canal ?? null }]),
      ).values()] as CategoriePdvRef[]

      references.value = (rp.data || []).map((r: any) => ({ id: r.id, nom: r.nom, category: catCode(r) }))

      availabilityWeights.value = (pr.data || []).map((r: any) => {
        const ref = one(r.reference_produit)
        return { category: catCode(ref), sku: ref?.nom ?? '', trade_type: r.canal, basis: r.base_calcul, weight: Number(r.poids) }
      }) as AvailabilityWeight[]

      availabilityStandards.value = (sd.data || []).map((r: any) => {
        const ref = one(r.reference_produit)
        return { category: catCode(ref), sku: ref?.nom ?? '', standard_group: r.segment, tier: r.grade, min_quantity: r.quantite_min }
      }) as AvailabilityStandard[]

      territoireDistributeurs.value = (td.data || []).map((r: any) => {
        const terr = one(r.territoire)
        return { territory_code: terr?.code ?? '', territory_name: terr?.nom ?? '', distributor_name: one(r.distributeur)?.nom ?? '' }
      })

      zoneDistributeurs.value = (zd.data || []).map((r: any) => ({
        zone_id: Number(r.zone_id),
        distributor_name: one(r.distributeur)?.nom ?? '',
      }))

      loaded.value = true
    }
    catch (err: any) {
      error.value = err?.message || 'Erreur de chargement des référentiels (Système B)'
      console.warn('useReferentiels (B): indisponible', error.value)
    }
  }

  return {
    distributeurs, regions, subRegions, territories, areas, posTypes,
    availabilityWeights, availabilityStandards,
    references, categoriesPdv, territoireDistributeurs, zoneDistributeurs,
    loaded, error, fetchReferentiels,
  }
}
