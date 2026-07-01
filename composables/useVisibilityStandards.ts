import {
  FALLBACK_VISIBILITY_ELEMENTS,
  visibilitySegmentForPdv as inferVisibilitySegmentForPdv,
  type VisibilityElementRef,
  type VisibilityPlacement,
  type VisibilitySegment,
} from '~/utils/visibilityStandards'

export function useVisibilityStandards() {
  const supabase = useSupabaseClient()
  const elements = useState<VisibilityElementRef[]>('visibility-elements', () => [])
  const mappings = useState<{ type_pdv_nom: string; segment: VisibilitySegment }[]>('visibility-type-mappings', () => [])
  const loaded = useState<boolean>('visibility-elements-loaded', () => false)

  async function fetchElements(force = false) {
    if (loaded.value && !force) return elements.value
    const [elementResult, mappingResult] = await Promise.all([
      supabase
        .from('element_visibilite')
        .select('id, segment, code, nom, pilier, emplacement, optionnel')
        .order('segment')
        .order('emplacement')
        .order('nom'),
      supabase
        .from('segment_visibilite_type_pdv')
        .select('segment, type_pdv(nom)'),
    ])

    elements.value = !elementResult.error && elementResult.data?.length
      ? elementResult.data as VisibilityElementRef[]
      : FALLBACK_VISIBILITY_ELEMENTS
    const one = (value: any) => Array.isArray(value) ? value[0] : value
    mappings.value = !mappingResult.error
      ? (mappingResult.data || []).map((row: any) => ({
          type_pdv_nom: one(row.type_pdv)?.nom || '',
          segment: row.segment as VisibilitySegment,
        })).filter(row => row.type_pdv_nom)
      : []
    loaded.value = true
    return elements.value
  }

  function visibilitySegmentForPdv(typePdv?: string | null): VisibilitySegment | null {
    const normalized = (typePdv || '').trim().replace(/\s+/g, ' ').toLowerCase()
    const configured = mappings.value.find(item =>
      item.type_pdv_nom.trim().replace(/\s+/g, ' ').toLowerCase() === normalized,
    )
    return configured?.segment || inferVisibilitySegmentForPdv(typePdv)
  }

  function forPdv(typePdv?: string | null, placement?: VisibilityPlacement) {
    const segment = visibilitySegmentForPdv(typePdv)
    if (!segment) return []
    const source = elements.value.length ? elements.value : FALLBACK_VISIBILITY_ELEMENTS
    return source.filter(element =>
      element.segment === segment
      && (!placement || element.emplacement === placement),
    )
  }

  return { elements, mappings, loaded, fetchElements, forPdv, visibilitySegmentForPdv }
}
