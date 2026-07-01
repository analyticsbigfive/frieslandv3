// composables/useVisibilityAggregation.ts
// Agrégations de visibilité alignées Perfect Store : lit data.visibilite.standards
// ({ code: bool }) et classe les éléments par segment/emplacement via le référentiel
// (element_visibilite / segment_visibilite_type_pdv), exposé par useVisibilityStandards.
// Remplace l'ancienne lecture data.visibilite.{exterieure,interieure}.<clé legacy>.
import type { VisibilityPlacement } from '~/utils/visibilityStandards'

export function useVisibilityAggregation() {
  const { fetchElements, forPdv, visibilitySegmentForPdv } = useVisibilityStandards()

  const standardsOf = (v: any) =>
    (v?.data?.visibilite?.standards || {}) as Record<string, boolean>

  // Au moins un élément (du pilier/emplacement) présent pour cette visite.
  function hasPresence(v: any, placement: VisibilityPlacement) {
    const std = standardsOf(v)
    return forPdv(v?.pdv?.sous_categorie_pdv, placement).some(el => std[el.code])
  }

  // Codes applicables au segment de la visite (Absent vs Non applicable).
  function applicable(typePdv?: string | null, placement?: VisibilityPlacement) {
    const set: Record<string, boolean> = {}
    for (const el of forPdv(typePdv, placement)) set[el.code] = true
    return set
  }

  // Union des colonnes (code → libellé) sur un ensemble de visites.
  function columns(visites: any[], placement: VisibilityPlacement) {
    const map = new Map<string, string>()
    for (const v of visites) {
      for (const el of forPdv(v?.pdv?.sous_categorie_pdv, placement)) {
        if (!map.has(el.code)) map.set(el.code, el.nom)
      }
    }
    return [...map.entries()].map(([code, label]) => ({ code, label }))
  }

  // Présence par élément : comptée parmi les visites dont le segment prévoit l'élément.
  function aggregate(visites: any[], placement: VisibilityPlacement) {
    const acc = new Map<string, { code: string; label: string; present: number; applicable: number }>()
    for (const v of visites) {
      const std = standardsOf(v)
      for (const el of forPdv(v?.pdv?.sous_categorie_pdv, placement)) {
        const e = acc.get(el.code) || { code: el.code, label: el.nom, present: 0, applicable: 0 }
        e.applicable += 1
        if (std[el.code]) e.present += 1
        acc.set(el.code, e)
      }
    }
    return [...acc.values()].map(e => ({ ...e, absent: e.applicable - e.present }))
  }

  return { fetchElements, forPdv, visibilitySegmentForPdv, standardsOf, hasPresence, applicable, columns, aggregate }
}
