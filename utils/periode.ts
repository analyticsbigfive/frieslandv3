// utils/periode.ts
// Presets de période (jour / semaine / mois) partagés par tous les écrans admin.
//
// Demande client du 23 juillet : suivre les merchandisers jour après jour, donc
// les mêmes trois raccourcis sur tous les KPI. Les bornes sont INCLUSIVES des
// deux côtés — c'est ce qu'attendent les RPC (`date_visite < fin + 1 jour`).
//
// Tout est calculé sur l'heure LOCALE et sérialisé à la main : `toISOString()`
// bascule en UTC et fait reculer la date d'un jour dès qu'on est à l'est de
// Greenwich (ou avancer à l'ouest). Sur un dashboard « aujourd'hui », c'est la
// différence entre voir ses visites et voir un écran vide.

// Import explicite (et non auto-import Nuxt) : ce module est couvert par des
// tests unitaires qui tournent hors contexte Nuxt.
import { formatDateFr } from './dates'

export type PeriodePreset = 'jour' | 'semaine' | 'mois' | 'tout' | 'personnalise'

export interface PlageDates {
  /** Borne basse incluse, format AAAA-MM-JJ. Vide = pas de borne. */
  debut: string
  /** Borne haute incluse, format AAAA-MM-JJ. Vide = pas de borne. */
  fin: string
}

/** Sérialise une Date en AAAA-MM-JJ sur ses composantes locales. */
export function toIsoJour(date: Date): string {
  const mois = String(date.getMonth() + 1).padStart(2, '0')
  const jour = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${mois}-${jour}`
}

/** Lundi de la semaine contenant `date` (semaine ISO : lundi → dimanche). */
export function debutDeSemaine(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  // getDay() : 0 = dimanche. On ramène dimanche à 7 pour que lundi soit le 1er.
  const jourSemaine = d.getDay() === 0 ? 7 : d.getDay()
  d.setDate(d.getDate() - (jourSemaine - 1))
  return d
}

/** Bornes du preset, relatives à `reference` (aujourd'hui par défaut). */
export function plageDePeriode(preset: PeriodePreset, reference: Date = new Date()): PlageDates {
  const ref = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate())

  if (preset === 'jour') {
    const jour = toIsoJour(ref)
    return { debut: jour, fin: jour }
  }

  if (preset === 'semaine') {
    const lundi = debutDeSemaine(ref)
    const dimanche = new Date(lundi)
    dimanche.setDate(lundi.getDate() + 6)
    return { debut: toIsoJour(lundi), fin: toIsoJour(dimanche) }
  }

  if (preset === 'mois') {
    const premier = new Date(ref.getFullYear(), ref.getMonth(), 1)
    // Jour 0 du mois suivant = dernier jour du mois courant.
    const dernier = new Date(ref.getFullYear(), ref.getMonth() + 1, 0)
    return { debut: toIsoJour(premier), fin: toIsoJour(dernier) }
  }

  // 'tout' et 'personnalise' : aucune borne imposée, l'appelant garde la main.
  return { debut: '', fin: '' }
}

/**
 * Libellé lisible de la plage, pour les sous-titres de cartes KPI.
 * Le suffixe 'T00:00:00' force une interprétation en heure LOCALE :
 * `new Date('2026-07-01')` vaut minuit UTC et s'afficherait « 30 juin » pour
 * tout lecteur situé à l'ouest de Greenwich.
 */
export function libellePlage(plage: PlageDates): string {
  const local = (jour: string) => `${jour}T00:00:00`
  if (!plage.debut && !plage.fin) return 'toute la période'
  if (plage.debut === plage.fin) return formatDateFr(local(plage.debut), { day: '2-digit', month: 'long', year: 'numeric' })
  return `${formatDateFr(local(plage.debut), { day: '2-digit', month: 'short' })} → ${formatDateFr(local(plage.fin), { day: '2-digit', month: 'short', year: 'numeric' })}`
}

export const PERIODE_OPTIONS: { value: PeriodePreset; label: string }[] = [
  { value: 'jour', label: 'Jour' },
  { value: 'semaine', label: 'Semaine' },
  { value: 'mois', label: 'Mois' },
  { value: 'tout', label: 'Tout' },
  { value: 'personnalise', label: 'Personnalisé' },
]
