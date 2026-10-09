// utils/agences.ts
// Agences de merchandising et directions (réunion client du 08/10/2026).
//
// Le merchandiser est l'employé d'une agence : Atom BTL à Abidjan (South),
// une autre agence à l'intérieur (North). FrieslandCampina (« friesland »)
// regroupe les salariés, sans programme. Une agence « programme » suit les
// tournées par quotas et le programme mensuel de sa direction.
//
// Le code `atom` est conservé (l'app 1.0.12 compare employeur === 'atom').

export type Direction = 'south' | 'north' | 'mt'

export interface Agence {
  code: string
  nom: string
  direction: Direction | null
  programme: boolean
  actif: boolean
  ordre: number
}

export const EMPLOYEUR_FRIESLAND = 'friesland'

export const DIRECTIONS: { value: Direction, label: string, court: string }[] = [
  { value: 'south', label: 'South — Abidjan', court: 'South' },
  { value: 'north', label: 'North — intérieur', court: 'North' },
  { value: 'mt', label: 'Modern Trade', court: 'MT' },
]

export const libelleDirection = (d: string | null | undefined, court = false) => {
  const x = DIRECTIONS.find(o => o.value === d)
  return x ? (court ? x.court : x.label) : '—'
}

/**
 * Agences présentes avant que la table ne soit lue (hors ligne, migration
 * 20261008100000 pas encore appliquée) : mêmes valeurs que son remplissage.
 */
export const AGENCES_DEFAUT: Agence[] = [
  { code: 'friesland', nom: 'FrieslandCampina', direction: null, programme: false, actif: true, ordre: 10 },
  { code: 'atom', nom: 'Atom BTL', direction: 'south', programme: true, actif: true, ordre: 20 },
]

/**
 * Un merchandiser d'agence suit le programme (tournée par quotas, SSF du
 * jour, « Ma semaine », objectifs du mois). Sans la liste des agences (app
 * hors ligne), toute agence autre que FrieslandCampina est un programme.
 */
export function estMerchandiserProgramme(employeur: string | null | undefined, agences?: Agence[] | null) {
  if (!employeur || employeur === EMPLOYEUR_FRIESLAND) return false
  const a = agences?.find(x => x.code === employeur)
  return a ? a.programme : true
}

export const nomAgence = (code: string | null | undefined, agences: Agence[]) =>
  agences.find(a => a.code === code)?.nom || code || '—'
