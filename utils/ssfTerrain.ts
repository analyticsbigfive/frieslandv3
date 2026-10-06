// utils/ssfTerrain.ts
// SSF côté terrain (merchandisers Atom) : planning de la semaine renvoyé par
// la RPC ssf_semaine, SSF du jour, et appartenance d'un PDV à la sous-zone
// d'un SSF (même règle que etapes_quota_du_jour : zone et quartier exacts).
// Pur et testé (tests/ssfTerrain.spec.ts).

/** Une ligne de ssf_semaine : un SSF prévu un jour de la semaine (0 = dimanche). */
export interface JourSsf {
  jour_semaine: number
  template_id: string
  libelle: string | null
  ssf_id: number
  ssf_nom: string
  ssf_telephone: string | null
  distributeur: string | null
  zone: string | null
  quartiers: string[] | null
}

export interface SsfTerrain {
  id: number
  nom: string
  telephone: string | null
  distributeur: string | null
}

/** Quartier d'une sous-zone (table ssf_quartier). */
export interface QuartierSsf {
  ssf_id: number
  zone: string
  quartier: string
}

/** Jours travaillés, dans l'ordre de la semaine (convention JS getDay()). */
export const JOURS_TERRAIN = [
  { jour: 1, libelle: 'Lundi' },
  { jour: 2, libelle: 'Mardi' },
  { jour: 3, libelle: 'Mercredi' },
  { jour: 4, libelle: 'Jeudi' },
  { jour: 5, libelle: 'Vendredi' },
  { jour: 6, libelle: 'Samedi' },
] as const

/**
 * SSF prévu un jour donné. S'il y en a plusieurs, celui de la règle qui a
 * produit la tournée du jour (`templateId`), sinon le premier.
 */
export function ssfDuJour(semaine: JourSsf[], jour: number, templateId?: string | null): JourSsf | null {
  const duJour = semaine.filter(l => l.jour_semaine === jour)
  return (templateId ? duJour.find(l => l.template_id === templateId) : undefined) ?? duJour[0] ?? null
}

/** Semaine lundi → samedi : pour chaque jour, les SSF prévus (souvent un seul). */
export function semaineParJour(semaine: JourSsf[]) {
  return JOURS_TERRAIN.map(j => ({ ...j, ssf: semaine.filter(l => l.jour_semaine === j.jour) }))
}

const net = (v: unknown) => String(v ?? '').trim()

/**
 * Le PDV est-il dans la sous-zone du SSF ? `null` quand on ne peut pas le
 * dire (sous-zone non définie, PDV sans quartier) : pas d'avertissement.
 */
export function pdvDansSousZone(
  pdv: { zone?: string | null, quartier?: string | null } | null | undefined,
  quartiers: QuartierSsf[],
  ssfId: number | null | undefined,
): boolean | null {
  if (!pdv || !ssfId) return null
  const lignes = quartiers.filter(q => q.ssf_id === ssfId)
  if (!lignes.length || !net(pdv.quartier)) return null
  return lignes.some(q => net(q.zone) === net(pdv.zone) && net(q.quartier) === net(pdv.quartier))
}

/** Quartiers d'un SSF, pour l'affichage (« Adjamé : 220 Lgts, Bracodi »). */
export function libelleSousZone(quartiers: QuartierSsf[], ssfId: number | null | undefined): string {
  const parZone = new Map<string, string[]>()
  for (const q of quartiers.filter(q => q.ssf_id === ssfId)) {
    const liste = parZone.get(q.zone) ?? []
    liste.push(q.quartier)
    parZone.set(q.zone, liste)
  }
  return [...parZone].map(([zone, qs]) => `${zone} : ${qs.join(', ')}`).join(' · ')
}
