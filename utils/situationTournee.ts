// utils/situationTournee.ts
// Situation d'une visite dans la tournée de son merchandiser, le jour de la
// visite (migration 20261105120000, colonne calculée visites.situation_tournee).
// Décision de Jean Luc du 05/11 : on l'indique seulement, la visite compte
// toujours.
//
// Aucune dépendance Nuxt : module couvert par des tests unitaires.

export type SituationTournee = 'prevue' | 'ajoutee_jour' | 'pdv_cree_sur_place' | 'hors_tournee'

export interface BadgeSituation {
  libelle: string
  aide: string
  couleur: 'amber' | 'blue'
}

const BADGES: Record<Exclude<SituationTournee, 'prevue'>, BadgeSituation> = {
  hors_tournee: {
    libelle: 'Hors tournée',
    aide: 'Ce PDV n’était pas dans la tournée du merchandiser ce jour-là. La visite compte quand même.',
    couleur: 'amber',
  },
  pdv_cree_sur_place: {
    libelle: 'PDV créé sur place',
    aide: 'Hors tournée : le merchandiser a créé ce PDV sur place, puis l’a visité. La visite compte quand même. Vérifiez qu’il ne double pas un PDV existant.',
    couleur: 'amber',
  },
  // Jour de visite libre, ou pushcart « à trouver » un jour avec point de
  // visite : « Jour de visite libre » serait faux pour les pushcarts.
  ajoutee_jour: {
    libelle: 'Ajoutée à la tournée du jour',
    aide: 'Jour de visite libre ou pushcart à trouver : le PDV s’est ajouté à la tournée au moment de la visite.',
    couleur: 'blue',
  },
}

/** Badge à afficher, ou null pour une visite prévue ou un jour sans tournée. */
export function badgeSituation(situation: string | null | undefined): BadgeSituation | null {
  if (!situation || situation === 'prevue') return null
  return BADGES[situation as keyof typeof BADGES] ?? null
}

/** Choix du filtre « Tournée » de l'écran des visites. */
export type FiltreSituation = '' | 'hors' | 'cree' | 'ajoutee' | 'prevue' | 'sans'

export const OPTIONS_FILTRE_SITUATION: { value: FiltreSituation; label: string }[] = [
  { value: '', label: 'Toutes' },
  { value: 'hors', label: 'Hors tournée (y compris PDV créés sur place)' },
  { value: 'cree', label: 'PDV créé sur place' },
  { value: 'ajoutee', label: 'Ajoutée à la tournée du jour' },
  { value: 'prevue', label: 'Prévue dans la tournée' },
  { value: 'sans', label: 'Jour sans tournée' },
]

/**
 * Condition PostgREST du filtre : valeurs de situation_tournee à garder, ou
 * 'null' pour les jours sans tournée. Null : pas de filtre.
 */
export function conditionFiltreSituation(filtre: string | null | undefined): SituationTournee[] | 'null' | null {
  switch (filtre) {
    case 'hors': return ['hors_tournee', 'pdv_cree_sur_place']
    case 'cree': return ['pdv_cree_sur_place']
    case 'ajoutee': return ['ajoutee_jour']
    case 'prevue': return ['prevue']
    case 'sans': return 'null'
    default: return null
  }
}

/** Ligne de recap_situation_tournee(début, fin). */
export interface RecapSituationTournee {
  user_id: string
  merchandiser: string | null
  email: string | null
  employeur: string | null
  visites: number
  prevues: number
  ajoutees_visite_libre: number
  pushcarts_a_trouver: number
  /** Comprend les visites sur un PDV créé sur place (« dont »). */
  hors_tournee: number
  dont_pdv_cree: number
  sans_tournee: number
  pdv_crees: number
  /** Null hors admin et superviseur : les doublons possibles ne leur sont pas lisibles. */
  pdv_doublons_a_verifier: number | null
}

/**
 * Vrai si la base n'a pas encore la migration 20261105120000 : colonne
 * calculée inconnue (42703) ou fonction absente (PGRST202 / 42883).
 */
export function estSituationIndisponible(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown }
  const code = String(e.code ?? '')
  const texte = `${e.message ?? ''} ${e.details ?? ''} ${e.hint ?? ''}`
  if (code === 'PGRST202') return true
  return (code === '42703' || code === '42883') && /situation_tournee/.test(texte)
}
