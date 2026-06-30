import {
  FALLBACK_VISIBILITY_ELEMENTS,
  visibilitySegmentForPdv,
  type VisibilityElementRef,
  type VisibilityPlacement,
} from '~/utils/visibilityStandards'

export function useVisibilityStandards() {
  const supabase = useSupabaseClient()
  const elements = useState<VisibilityElementRef[]>('visibility-elements', () => [])
  const loaded = useState<boolean>('visibility-elements-loaded', () => false)

  async function fetchElements(force = false) {
    if (loaded.value && !force) return elements.value
    const { data, error } = await supabase
      .from('element_visibilite')
      .select('id, segment, code, nom, pilier, emplacement, optionnel')
      .order('segment')
      .order('emplacement')
      .order('nom')

    elements.value = !error && data?.length
      ? data as VisibilityElementRef[]
      : FALLBACK_VISIBILITY_ELEMENTS
    loaded.value = true
    return elements.value
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

  return { elements, loaded, fetchElements, forPdv, visibilitySegmentForPdv }
}
