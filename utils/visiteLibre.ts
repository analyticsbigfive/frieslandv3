// utils/visiteLibre.ts
// Jour de visite libre des merchandisers Atom (migration 20261022100000) :
// sans point de visite ce jour-là, aucun PDV n'est imposé ; chaque visite
// devient un PDV fait de la tournée, et compte dans l'objectif de son type de
// boutique (quotas routing_quota_canal du jour).
//
// routings.objectifs, tenu à jour par la base (bilan_visite_libre) :
//   { type: 'visite_libre', quotas: { Boutique: 6, … }, total: 10,
//     realise: { Boutique: 4, … }, nb_realise: 4, nb_visites: 5 }
// routing_pdv.objectifs d'une visite :
//   { visite_libre: true, canal, compte, hors_liste, deja_ce_mois, hors_quota }
//
// Pushcarts itinérants (migration 20261022120000) : les jours avec un point de
// visite, les pushcarts ne sont plus imposés par leur nom ; l'objectif du jour
// porte les pushcarts « à trouver » (même forme, type 'a_trouver'), et chaque
// pushcart visité devient une étape { a_trouver: true, canal, compte, … }.
//
// Aucune dépendance Nuxt : module couvert par des tests unitaires.
import { CANAUX_ATOM } from './canalAtom'

export interface ObjectifsDuJour {
  type: 'visite_libre' | 'a_trouver'
  quotas: Record<string, number>
  total: number
  realise?: Record<string, number>
  nb_realise?: number
  nb_visites?: number
}

export type ObjectifsVisiteLibre = ObjectifsDuJour & { type: 'visite_libre' }
export type ObjectifsATrouver = ObjectifsDuJour & { type: 'a_trouver' }

export interface LigneBilan {
  canal: string
  libelle: string
  fait: number
  quota: number
}

// Libellés des types de boutique dans les bilans (« Boutiques 4/6 »).
const LIBELLES: Record<string, string> = {
  Boutique: 'Boutiques',
  Superette: 'Superettes',
  Pushcart: 'Pushcarts',
  Porridge: 'Porridge',
  'Aboki & Kiosque': 'Aboki & Kiosque',
}

/** L'objectif d'une tournée, s'il s'agit d'un jour de visite libre. */
export function visiteLibre(objectifs: unknown): ObjectifsVisiteLibre | null {
  const o = objectifs as ObjectifsVisiteLibre | null | undefined
  return o && typeof o === 'object' && o.type === 'visite_libre' ? o : null
}

/** Les PDV « à trouver » d'un jour avec point de visite (pushcarts), sinon null. */
export function aTrouver(objectifs: unknown): ObjectifsATrouver | null {
  const o = objectifs as ObjectifsATrouver | null | undefined
  return o && typeof o === 'object' && o.type === 'a_trouver' ? o : null
}

/** Résultat par type, dans l'ordre de la grille (Boutique d'abord). */
export function bilanVisiteLibre(o: ObjectifsDuJour): LigneBilan[] {
  const ordre = ['Boutique', ...CANAUX_ATOM.filter(c => c !== 'Boutique')] as string[]
  return Object.entries(o.quotas || {})
    .filter(([, quota]) => Number(quota) > 0)
    .sort(([a], [b]) => (ordre.indexOf(a) + 1 || 99) - (ordre.indexOf(b) + 1 || 99))
    .map(([canal, quota]) => ({
      canal,
      libelle: LIBELLES[canal] || canal,
      fait: Math.min(Number(o.realise?.[canal]) || 0, Number(quota)),
      quota: Number(quota),
    }))
}

/** PDV comptés et objectif du jour : { fait: 4, total: 10 }. */
export function totalVisiteLibre(o: ObjectifsDuJour): { fait: number, total: number } {
  const lignes = bilanVisiteLibre(o)
  return {
    fait: lignes.reduce((s, l) => s + l.fait, 0),
    total: Number(o.total) || lignes.reduce((s, l) => s + l.quota, 0),
  }
}

/** « Boutiques 4/6 · Porridge 0/1 · … » */
export function texteBilanVisiteLibre(o: ObjectifsDuJour): string {
  return bilanVisiteLibre(o).map(l => `${l.libelle} ${l.fait}/${l.quota}`).join(' · ')
}

/** « Boutiques 6 · Porridge 1 · … » (objectif d'un jour à venir) */
export function texteObjectifVisiteLibre(o: ObjectifsDuJour): string {
  return bilanVisiteLibre(o).map(l => `${l.libelle} ${l.quota}`).join(' · ')
}

/** Objectif atteint pour chaque type. */
export function objectifAtteint(o: ObjectifsDuJour): boolean {
  return bilanVisiteLibre(o).every(l => l.fait >= l.quota)
}

export interface ProgressionJour {
  fait: number
  total: number
  /** Jour de visite libre : aucun PDV imposé, objectif par type de boutique. */
  libre: boolean
  /** Objectif du jour (visite libre ou pushcarts à trouver), pour le détail par type. */
  objectifs: ObjectifsDuJour | null
}

/**
 * Compteur « Progression x/y » de l'app (1.0.17, plan du 29/10) : l'objectif
 * du jour tenu par la base (bilan_visite_libre), pas les seules étapes.
 * - Visite libre : PDV qui comptent / objectif du jour (20, 15 ou 10).
 * - Pushcarts à trouver : PDV imposés + pushcarts. Les étapes ajoutées par
 *   une visite (nb_visites) sont retirées des compteurs, les pushcarts comptés
 *   et leur objectif ajoutés : 0/20 au lieu de 0/18.
 * - Autre tournée (Friesland, agent sans objectif) : les compteurs tels quels.
 * `compteurs` : étapes de toute la tournée (base), pas des pages chargées.
 */
export function progressionDuJour(objectifs: unknown, compteurs: { total: number, faits: number }): ProgressionJour {
  const libre = visiteLibre(objectifs)
  if (libre) {
    const t = totalVisiteLibre(libre)
    return { fait: t.fait, total: t.total, libre: true, objectifs: libre }
  }
  const trouver = aTrouver(objectifs)
  if (trouver) {
    const ajoutees = Math.max(0, Number(trouver.nb_visites) || 0)
    const t = totalVisiteLibre(trouver)
    const imposes = Math.max(0, compteurs.total - ajoutees)
    const imposesFaits = Math.min(Math.max(0, compteurs.faits - ajoutees), imposes)
    return { fait: imposesFaits + t.fait, total: imposes + t.total, libre: false, objectifs: trouver }
  }
  return { fait: compteurs.faits, total: compteurs.total, libre: false, objectifs: null }
}

/** Étape ajoutée par une visite (visite libre ou pushcart trouvé), pas imposée. */
export function etapeAjoutee(objectifs: unknown): boolean {
  const o = objectifs as Record<string, unknown> | null | undefined
  return !!o && (o.visite_libre === true || o.a_trouver === true)
}

/** Remarques sur une visite ajoutée à la tournée (badges de l'admin). */
export function remarquesVisiteLibre(objectifs: unknown): string[] {
  const o = objectifs as Record<string, unknown> | null | undefined
  if (!o || !etapeAjoutee(o)) return []
  const out: string[] = []
  if (o.deja_ce_mois) out.push('Déjà vu ce mois-ci, ne compte pas')
  else if (o.hors_quota) out.push(o.canal ? 'Quota du type déjà atteint, ne compte pas' : 'Type hors grille, ne compte pas')
  if (o.hors_liste) out.push('Hors de sa liste')
  return out
}
