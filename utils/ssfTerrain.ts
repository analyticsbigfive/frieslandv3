// utils/ssfTerrain.ts
// SSF côté terrain (merchandisers d'agence) : planning de la semaine (binômes
// SSF ↔ merchandiser, RPC ssf_semaine), SSF du jour, et appartenance d'un PDV
// aux quartiers du SSF (même règle que etapes_quota_du_jour : zone et quartier
// exacts). Le SSF ne dirige pas le merchandiser : les deux dépendent du
// commercial et passent dans les mêmes PDV.
// Pur et testé (tests/ssfTerrain.spec.ts).

/** Une ligne de ssf_semaine : un SSF prévu un jour de la semaine (0 = dimanche). */
export interface JourSsf {
  jour_semaine: number
  /** Règle « SSF — » qui porte le binôme ; null si le binôme n'a pas (encore) de règle. */
  template_id: string | null
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

/**
 * Une case du routing mensuel de la semaine (RPC routing_semaine, migration
 * 20261008130000) : lieu du jour et SSF éventuel (null = « Aucun SSF »).
 */
export interface JourRouting {
  jour_semaine: number
  date_jour: string | null
  semaine: number | null
  secteur: string | null
  point_visite: string | null
  zone: string | null
  quartiers: string[] | null
  ssf_id: number | null
  ssf_nom: string | null
  ssf_telephone: string | null
  distributeur: string | null
  type_engin: string | null
}

/** Planning SSF de l'ancienne RPC (ssf_semaine) au format du routing mensuel. */
export const versRouting = (semaine: JourSsf[]): JourRouting[] => semaine.map(l => ({
  jour_semaine: l.jour_semaine, date_jour: null, semaine: null, secteur: null, point_visite: null,
  zone: l.zone, quartiers: l.quartiers, ssf_id: l.ssf_id, ssf_nom: l.ssf_nom, ssf_telephone: l.ssf_telephone,
  distributeur: l.distributeur, type_engin: null,
}))

/** Semaine lundi → samedi : les cases de chaque jour (vide = portefeuille). */
export function routingParJour(lignes: JourRouting[]) {
  return JOURS_TERRAIN.map(j => ({ ...j, cases: lignes.filter(l => l.jour_semaine === j.jour) }))
}
