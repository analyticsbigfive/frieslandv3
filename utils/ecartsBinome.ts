// utils/ecartsBinome.ts
// Contrôle d'écart SSF ↔ merchandiser (réunion client du 08/10/2026) : le SSF
// et le merchandiser d'un binôme doivent passer dans les mêmes PDV. Un PDV de
// la tournée du merchandiser absent du routing DMS des SSF de son binôme du
// jour est un écart. Même règle que la RPC ecarts_binome_resume
// (migration 20261008140000) ; pur et testé (tests/ecartsBinome.spec.ts).

export type StatutEcart = 'ok' | 'hors_routing_ssf' | 'routing_ssf_absent' | 'sans_binome'

export const LIBELLES_ECART: Record<StatutEcart, { label: string, aide: string, couleur: 'green' | 'red' | 'amber' | 'gray' }> = {
  ok: { label: 'Aligné', aide: 'Tous les PDV de la tournée sont dans le routing du SSF du binôme.', couleur: 'green' },
  hors_routing_ssf: { label: 'Écart', aide: 'Des PDV de la tournée ne sont pas dans le routing du SSF du binôme.', couleur: 'red' },
  routing_ssf_absent: { label: 'Routing SSF absent', aide: 'Le SSF du binôme n’a pas de routing importé (Imports terrain › Routing des SSF).', couleur: 'amber' },
  sans_binome: { label: 'Sans binôme', aide: 'Aucun binôme SSF prévu ce jour pour ce merchandiser.', couleur: 'gray' },
}

/**
 * Statut d'une tournée : `ssfDuJour` = SSF des binômes du jour ; `routing`
 * = PDV du routing de chaque SSF (jour 0 = tous les jours, ou ce jour-là).
 */
export function calculerEcart(
  pdvTournee: string[],
  ssfDuJour: number[],
  routing: Map<number, Set<string>>,
): { statut: StatutEcart, hors: string[] } {
  if (!ssfDuJour.length) return { statut: 'sans_binome', hors: [] }
  const connus = ssfDuJour.filter(id => (routing.get(id)?.size || 0) > 0)
  if (!connus.length) return { statut: 'routing_ssf_absent', hors: [] }
  const hors = pdvTournee.filter(p => !connus.some(id => routing.get(id)!.has(p)))
  return { statut: hors.length ? 'hors_routing_ssf' : 'ok', hors }
}

/** Part des PDV de la tournée hors routing (0-100, arrondie). */
export const tauxEcart = (nbHors: number | null | undefined, nbPdv: number | null | undefined) =>
  nbPdv && nbHors != null ? Math.round((nbHors / nbPdv) * 100) : null
