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
// Aucune dépendance Nuxt : module couvert par des tests unitaires.
import { CANAUX_ATOM } from './canalAtom'

export interface ObjectifsVisiteLibre {
  type: 'visite_libre'
  quotas: Record<string, number>
  total: number
  realise?: Record<string, number>
  nb_realise?: number
  nb_visites?: number
}

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

/** Résultat par type, dans l'ordre de la grille (Boutique d'abord). */
export function bilanVisiteLibre(o: ObjectifsVisiteLibre): LigneBilan[] {
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
export function totalVisiteLibre(o: ObjectifsVisiteLibre): { fait: number, total: number } {
  const lignes = bilanVisiteLibre(o)
  return {
    fait: lignes.reduce((s, l) => s + l.fait, 0),
    total: Number(o.total) || lignes.reduce((s, l) => s + l.quota, 0),
  }
}

/** « Boutiques 4/6 · Porridge 0/1 · … » */
export function texteBilanVisiteLibre(o: ObjectifsVisiteLibre): string {
  return bilanVisiteLibre(o).map(l => `${l.libelle} ${l.fait}/${l.quota}`).join(' · ')
}

/** « Boutiques 6 · Porridge 1 · … » (objectif d'un jour à venir) */
export function texteObjectifVisiteLibre(o: ObjectifsVisiteLibre): string {
  return bilanVisiteLibre(o).map(l => `${l.libelle} ${l.quota}`).join(' · ')
}

/** Objectif atteint pour chaque type. */
export function objectifAtteint(o: ObjectifsVisiteLibre): boolean {
  return bilanVisiteLibre(o).every(l => l.fait >= l.quota)
}

/** Remarques sur une visite d'un jour de visite libre (badges de l'admin). */
export function remarquesVisiteLibre(objectifs: unknown): string[] {
  const o = objectifs as Record<string, unknown> | null | undefined
  if (!o || o.visite_libre !== true) return []
  const out: string[] = []
  if (o.deja_ce_mois) out.push('Déjà vu ce mois-ci, ne compte pas')
  else if (o.hors_quota) out.push(o.canal ? 'Quota du type déjà atteint, ne compte pas' : 'Type hors grille, ne compte pas')
  if (o.hors_liste) out.push('Hors de sa liste')
  return out
}
