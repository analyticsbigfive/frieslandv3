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

// Statuts d'une action encore à traiter. Source unique : le badge de la nav
// mobile, la liste et le compteur serveur doivent compter la même chose.
export const STATUTS_OUVERTS: readonly ActionCommercialeStatut[] = ['a_faire', 'en_cours']

export function estOuverte(action: Pick<ActionCommerciale, 'statut'>): boolean {
  return STATUTS_OUVERTS.includes(action.statut as ActionCommercialeStatut)
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

// ---- Envoi WhatsApp (retour du 7 sept.) ----
// Numéro ivoirien : 10 chiffres commençant par 0 (format 2021, le 0 fait
// partie du numéro) → préfixé de l'indicatif 225. Un numéro déjà
// international (+225…, 00225…) est conservé. Renvoie null si illisible.
export function normaliserTelephoneInternational(tel?: string | null, indicatif = '225'): string | null {
  const brut = (tel || '').replace(/[^\d+]/g, '')
  if (!brut) return null
  let n = brut.startsWith('+') ? brut.slice(1) : brut.startsWith('00') ? brut.slice(2) : brut
  if (!n.startsWith(indicatif) && (n.length === 8 || n.length === 10)) n = indicatif + n
  return /^\d{10,15}$/.test(n) ? n : null
}

export function lienWhatsApp(tel: string | null | undefined, message: string): string | null {
  const n = normaliserTelephoneInternational(tel)
  if (!n) return null
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`
}

// Message récapitulatif des actions ouvertes d'un merchandiseur.
export function messageActionsPourMerchandiser(
  prenom: string | null | undefined,
  actions: (Pick<ActionCommerciale, 'type_code' | 'echeance' | 'commentaire' | 'statut'> & { pdv?: { nom_pdv?: string | null } | null; type?: { libelle?: string } | null })[],
  auteur?: string | null,
): string {
  const ouvertes = actions.filter(estOuverte)
  const lignes = ouvertes.map((a, i) => {
    const type = a.type?.libelle || a.type_code
    const ech = a.echeance ? ` — avant le ${new Date(a.echeance).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}` : ''
    const com = a.commentaire ? ` (${a.commentaire})` : ''
    return `${i + 1}. ${a.pdv?.nom_pdv || 'PDV'} : ${type}${ech}${com}`
  })
  const tete = `Bonjour ${prenom || ''}`.trim() + `, voici ${ouvertes.length > 1 ? 'les actions à réaliser' : "l'action à réaliser"} sur tes points de vente :`
  const pied = auteur ? `\nMerci de les marquer « Faite » dans l'application. — ${auteur}` : '\nMerci de les marquer « Faite » dans l\'application.'
  return [tete, ...lignes].join('\n') + pied
}
