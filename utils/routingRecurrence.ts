// utils/routingRecurrence.ts
//
// Expansion d'une règle de routing récurrente en dates concrètes.
//
// PÉRIMÈTRE : ces fonctions servent l'AFFICHAGE côté admin — montrer les
// prochaines occurrences d'une règle pour pouvoir en décocher une. La
// matérialisation réelle des tournées reste faite en SQL par
// `materialiser_routing_jour` (migration 20260730140000), seule source de
// vérité. Les deux doivent rester d'accord sur une chose : la convention de
// jour de semaine (0 = dimanche … 6 = samedi), identique à `Date.getDay()` en
// JS et à `extract(dow …)` en PostgreSQL.

import { toIsoJour } from './periode'

export interface RegleRecurrente {
  days_of_week?: number[] | null
  /** Champ historique : une règle ne portait qu'un seul jour. */
  day_of_week?: number | null
  date_debut?: string | null
  date_fin?: string | null
  is_active?: boolean | null
}

export interface ExceptionRegle {
  /** null = toute la tournée est suspendue sur la période. */
  pdv_id?: string | null
  date_debut: string
  date_fin: string
}

export const JOURS_SEMAINE = [
  { value: 1, label: 'Lundi', court: 'Lun' },
  { value: 2, label: 'Mardi', court: 'Mar' },
  { value: 3, label: 'Mercredi', court: 'Mer' },
  { value: 4, label: 'Jeudi', court: 'Jeu' },
  { value: 5, label: 'Vendredi', court: 'Ven' },
  { value: 6, label: 'Samedi', court: 'Sam' },
  { value: 0, label: 'Dimanche', court: 'Dim' },
]

/** Jours d'une règle, en gérant les anciennes règles à jour unique. */
export function joursDeRegle(regle: RegleRecurrente): number[] {
  if (regle.days_of_week?.length) return [...regle.days_of_week]
  if (regle.day_of_week !== null && regle.day_of_week !== undefined) return [regle.day_of_week]
  return []
}

/** « Lun · Jeu » — libellé compact pour les cartes de règle. */
export function libelleJours(regle: RegleRecurrente): string {
  const jours = joursDeRegle(regle)
  return JOURS_SEMAINE.filter(j => jours.includes(j.value)).map(j => j.court).join(' · ') || 'Aucun jour'
}

/** Vrai si `date` (AAAA-MM-JJ) tombe dans la fenêtre d'une exception. */
export function dansException(exception: ExceptionRegle, date: string): boolean {
  return date >= exception.date_debut && date <= exception.date_fin
}

/**
 * Dates où la règle s'applique entre `debut` et `fin` (bornes incluses).
 *
 * Une exception SANS pdv_id suspend toute la tournée : la date disparaît de la
 * liste. Une exception AVEC pdv_id ne retire qu'une étape — la date reste, ce
 * qui est justement ce que le client veut pouvoir décocher finement.
 */
export function datesDeRegle(
  regle: RegleRecurrente,
  debut: string,
  fin: string,
  exceptions: ExceptionRegle[] = [],
): string[] {
  const jours = joursDeRegle(regle)
  if (!jours.length) return []
  if (regle.is_active === false) return []

  const sorties: string[] = []
  const curseur = new Date(`${debut}T00:00:00`)
  const borne = new Date(`${fin}T00:00:00`)

  while (curseur <= borne) {
    const iso = toIsoJour(curseur)
    const dansFenetre = (!regle.date_debut || iso >= regle.date_debut)
      && (!regle.date_fin || iso <= regle.date_fin)
    const suspendue = exceptions.some(e => !e.pdv_id && dansException(e, iso))

    if (jours.includes(curseur.getDay()) && dansFenetre && !suspendue) sorties.push(iso)
    curseur.setDate(curseur.getDate() + 1)
  }

  return sorties
}

/** PDV retirés d'une occurrence donnée par une exception ciblée. */
export function pdvExclus(exceptions: ExceptionRegle[], date: string): string[] {
  return exceptions
    .filter(e => e.pdv_id && dansException(e, date))
    .map(e => e.pdv_id as string)
}
