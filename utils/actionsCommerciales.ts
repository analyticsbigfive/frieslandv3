// utils/actionsCommerciales.ts
// Logique testable des actions commerciales (lot 3.5) et de la fraîcheur de
// visite (lot 3.2). Les composants n'y ajoutent que de l'affichage.
import type { ActionCommerciale, ActionCommercialeStatut, TypeActionCommerciale } from '~/types'

export const TYPES_ACTION_DEFAUT: TypeActionCommerciale[] = [
  { code: 'activation_ssr', libelle: 'Activation SSR', ordre: 10, actif: true },
  { code: 'activation_ssm', libelle: 'Activation SSM', ordre: 20, actif: true },
  { code: 'referencement_produit', libelle: 'Référencement produit', ordre: 30, actif: true },
]

export const STATUTS_ACTION: { value: ActionCommercialeStatut; label: string; color: string }[] = [
  { value: 'a_faire', label: 'À faire', color: 'orange' },
  { value: 'en_cours', label: 'En cours', color: 'blue' },
  { value: 'faite', label: 'Faite', color: 'green' },
  { value: 'annulee', label: 'Annulée', color: 'gray' },
]

export function statutActionLabel(statut?: string | null): string {
  return STATUTS_ACTION.find(s => s.value === statut)?.label || statut || '—'
}

export function statutActionColor(statut?: string | null): string {
  return STATUTS_ACTION.find(s => s.value === statut)?.color || 'gray'
}

export function estOuverte(action: Pick<ActionCommerciale, 'statut'>): boolean {
  return action.statut === 'a_faire' || action.statut === 'en_cours'
}

export function typesActifs(types: TypeActionCommerciale[]): TypeActionCommerciale[] {
  return types
    .filter(t => t.actif)
    .sort((a, b) => a.ordre - b.ordre || a.libelle.localeCompare(b.libelle, 'fr'))
}

// Échéance dépassée : action encore ouverte dont la date est passée.
export function estEnRetard(action: Pick<ActionCommerciale, 'statut' | 'echeance'>, aujourdhui = new Date()): boolean {
  if (!estOuverte(action) || !action.echeance) return false
  const ref = aujourdhui.toISOString().slice(0, 10)
  return action.echeance < ref
}

// Transitions offertes au merchandiseur assigné : il avance, il ne réouvre pas.
export function transitionsAssigne(statut: ActionCommercialeStatut): ActionCommercialeStatut[] {
  if (statut === 'a_faire') return ['en_cours', 'faite']
  if (statut === 'en_cours') return ['faite']
  return []
}

// ---- Fraîcheur de visite (lot 3.2) : miroir de pdv_fraicheur_filtre ----
export type EtatFraicheur = 'a_jour' | 'en_retard' | 'jamais_visite'

export const ETATS_FRAICHEUR: { value: EtatFraicheur; label: string; color: string }[] = [
  { value: 'jamais_visite', label: 'Jamais visité', color: 'red' },
  { value: 'en_retard', label: 'En retard', color: 'orange' },
  { value: 'a_jour', label: 'À jour', color: 'green' },
]

export function etatFraicheurLabel(etat?: string | null): string {
  return ETATS_FRAICHEUR.find(e => e.value === etat)?.label || '—'
}

export function etatFraicheurColor(etat?: string | null): string {
  return ETATS_FRAICHEUR.find(e => e.value === etat)?.color || 'gray'
}

// Même calcul que la RPC : jamais visité, en retard au-delà de la fréquence
// (7 jours par défaut), sinon à jour.
export function calculerEtatFraicheur(
  derniereVisite: string | Date | null | undefined,
  frequenceJours = 7,
  aujourdhui = new Date(),
): { etat: EtatFraicheur; joursDepuis: number | null } {
  if (!derniereVisite) return { etat: 'jamais_visite', joursDepuis: null }
  const d = new Date(derniereVisite)
  const jour = (x: Date) => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())
  const joursDepuis = Math.floor((jour(aujourdhui) - jour(d)) / 86_400_000)
  return { etat: joursDepuis > frequenceJours ? 'en_retard' : 'a_jour', joursDepuis }
}

export function libelleFraicheur(etat: EtatFraicheur, joursDepuis: number | null): string {
  if (etat === 'jamais_visite') return 'Jamais visité'
  if (joursDepuis === 0) return "Visité aujourd'hui"
  if (joursDepuis === 1) return 'Visité hier'
  return `Il y a ${joursDepuis} j`
}
