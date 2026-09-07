// utils/agregation.ts
// Agrégation par période (jour / semaine / mois), unique pour tous les écrans.
//
// Avant le lot 5 (1.0.4), le même regroupement était réécrit trois fois
// (useDashboardDirection.evolutionParSemaine, visites/evolution.vue,
// pdv/evolution.vue) avec trois conventions de semaine différentes : début le
// dimanche, numéro de semaine calendaire, lundi ISO. Deux écrans côte à côte
// pouvaient donc afficher deux courbes décalées pour les mêmes visites.
//
// Convention retenue : semaine ISO (lundi → dimanche), la même que les presets
// de période (utils/periode.ts). Clés triables (AAAA-MM-JJ, AAAA-Wnn, AAAA-MM)
// et libellés français prêts pour un axe de catégories Chart.js.
//
// Import explicite (pas d'auto-import Nuxt) : module couvert par des tests
// unitaires hors contexte Nuxt.

import { debutDeSemaine, toIsoJour } from './periode'

export type Granularite = 'jour' | 'semaine' | 'mois'

export interface PointAgrege {
  /** Clé triable : 2026-09-07 · 2026-W37 · 2026-09 */
  cle: string
  /** Libellé d'axe : « 07 sept. » · « S37 2026 » · « septembre 2026 » */
  label: string
  /** Nombre d'éléments dans la période. */
  total: number
  /** Nombre d'éléments satisfaisant le prédicat (= total sans prédicat). */
  match: number
}

/** Numéro de semaine ISO 8601 et année ISO associée. */
export function semaineIso(date: Date): { annee: number; semaine: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const jour = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - jour)
  const debutAnnee = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const semaine = Math.ceil(((d.getTime() - debutAnnee.getTime()) / 86400000 + 1) / 7)
  return { annee: d.getUTCFullYear(), semaine }
}

const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const MOIS_COURT_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

/** Clé et libellé de la période contenant `date`, selon la granularité. */
export function clePeriode(date: Date, granularite: Granularite): { cle: string; label: string } {
  if (granularite === 'jour') {
    return {
      cle: toIsoJour(date),
      label: `${String(date.getDate()).padStart(2, '0')} ${MOIS_COURT_FR[date.getMonth()]}`,
    }
  }
  if (granularite === 'semaine') {
    const { annee, semaine } = semaineIso(debutDeSemaine(date))
    return { cle: `${annee}-W${String(semaine).padStart(2, '0')}`, label: `S${semaine} ${annee}` }
  }
  return {
    cle: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
    label: `${MOIS_FR[date.getMonth()]} ${date.getFullYear()}`,
  }
}

/**
 * Regroupe `items` par période, dans l'ordre chronologique. Les éléments sans
 * date exploitable sont ignorés. `predicate` compte un sous-ensemble (ex. les
 * visites où un produit est présent) sans changer le dénominateur.
 */
export function agregerParPeriode<T>(
  items: T[],
  getDate: (item: T) => string | Date | null | undefined,
  granularite: Granularite,
  predicate?: (item: T) => boolean,
): PointAgrege[] {
  const groupes = new Map<string, PointAgrege>()
  for (const item of items) {
    const brut = getDate(item)
    if (!brut) continue
    const date = brut instanceof Date ? brut : new Date(brut)
    if (Number.isNaN(date.getTime())) continue
    const { cle, label } = clePeriode(date, granularite)
    let point = groupes.get(cle)
    if (!point) {
      point = { cle, label, total: 0, match: 0 }
      groupes.set(cle, point)
    }
    point.total++
    if (!predicate || predicate(item)) point.match++
  }
  return [...groupes.values()].sort((a, b) => a.cle.localeCompare(b.cle))
}
