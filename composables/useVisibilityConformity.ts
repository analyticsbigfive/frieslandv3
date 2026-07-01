// composables/useVisibilityConformity.ts
// Conformité "à la Perfect Store" : reproduit calculer_taux_standard côté client.
// Pour un (segment, niveau, pilier[, emplacement]) : taux = éléments REQUIS présents
// / éléments REQUIS, où requis = standard_visibilite.requis ET NON element.optionnel.
// C'est un GATE : le score PS valide un niveau si le taux visibilité = 100.
// (⚠️ le pilier 'visibilite' du score combine extérieur + intérieur ; ici on peut
//  décomposer par emplacement pour l'affichage par page.)
import type { VisibilityPlacement } from '~/utils/visibilityStandards'

interface StandardRow { segment: string; niveau: string; element_id: number; requis: boolean }

export const PS_LEVELS = [
  { key: 'flagship', label: 'Flagship' },
  { key: 'vip', label: 'VIP' },
  { key: 'core', label: 'Core' },
  { key: 'basic', label: 'Basic' },
]

export function useVisibilityConformity() {
  const supabase = useSupabaseClient()
  const { elements, fetchElements, visibilitySegmentForPdv } = useVisibilityStandards()
  const standards = useState<StandardRow[]>('visibility-standards-rows', () => [])
  const loaded = useState<boolean>('visibility-standards-loaded', () => false)

  async function fetchConformity(force = false) {
    await fetchElements(force)
    if (loaded.value && !force) return
    const { data, error } = await supabase
      .from('standard_visibilite')
      .select('segment, niveau_perfect_store, element_visibilite_id, requis')
    if (!error) {
      standards.value = (data || []).map((r: any) => ({
        segment: r.segment,
        niveau: r.niveau_perfect_store,
        element_id: r.element_visibilite_id,
        requis: !!r.requis,
      }))
    }
    loaded.value = true
  }

  const elementById = computed(() => {
    const m = new Map<number, any>()
    for (const e of elements.value) m.set(e.id, e)
    return m
  })

  // Codes REQUIS pour (segment, niveau, pilier[, emplacement]).
  function requiredCodes(segment: string, niveau: string, pilier: string, placement?: VisibilityPlacement) {
    const codes: string[] = []
    for (const s of standards.value) {
      if (s.segment !== segment || s.niveau !== niveau || !s.requis) continue
      const el = elementById.value.get(s.element_id)
      if (!el || el.optionnel || el.pilier !== pilier) continue
      if (placement && el.emplacement !== placement) continue
      codes.push(el.code)
    }
    return codes
  }

  // Taux de conformité d'une visite (null si aucun élément requis pour ce contexte).
  function visiteRate(v: any, niveau: string, pilier: string, placement?: VisibilityPlacement): number | null {
    const segment = visibilitySegmentForPdv(v?.pdv?.sous_categorie_pdv)
    if (!segment) return null
    const codes = requiredCodes(segment, niveau, pilier, placement)
    if (!codes.length) return null
    const std = (v?.data?.visibilite?.standards || {}) as Record<string, boolean>
    const ok = codes.filter(c => std[c]).length
    return Math.round((ok / codes.length) * 100)
  }

  // Agrège par niveau sur un ensemble de visites : taux moyen + % de PDV au gate (=100).
  function byLevel(visites: any[], pilier: string, placement?: VisibilityPlacement) {
    return PS_LEVELS.map((lvl) => {
      let sum = 0, n = 0, gate = 0
      for (const v of visites) {
        const r = visiteRate(v, lvl.key, pilier, placement)
        if (r === null) continue
        sum += r; n += 1
        if (r === 100) gate += 1
      }
      return {
        key: lvl.key,
        label: lvl.label,
        avgRate: n ? Math.round(sum / n) : 0,
        gatePassCount: gate,
        total: n,
        gatePassPct: n ? Math.round((gate / n) * 100) : 0,
      }
    })
  }

  return { fetchConformity, requiredCodes, visiteRate, byLevel, PS_LEVELS }
}
