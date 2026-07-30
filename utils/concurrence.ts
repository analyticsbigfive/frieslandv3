// utils/concurrence.ts
// Agrégation des concurrents signalés en texte libre par les merchandisers.
//
// Le client veut pouvoir saisir un nouveau concurrent librement ET le retrouver
// agrégé proprement dans le dashboard. Ces deux exigences sont contradictoires
// tant que « Cowmilk », « cowmilk » et « Cow Milk » comptent pour trois entrées.
// D'où le regroupement sur une clé normalisée, avec conservation de la première
// graphie rencontrée pour l'affichage.

import type { ConcurrentSignale, VisiteConcurrence } from '~/types'

/**
 * Clé de regroupement : minuscules, sans accent, sans séparateur.
 *
 * Les séparateurs sont retirés et non normalisés en espaces : sur le terrain,
 * la même marque est écrite « Cowmilk », « Cow Milk » et « Cow-Milk ». Se
 * contenter de compresser les espaces laisserait trois entrées distinctes dans
 * le dashboard, ce qui est précisément le défaut à corriger. Le risque inverse
 * (deux marques différentes qui se rejoignent une fois les espaces retirés)
 * est négligeable sur un référentiel de marques laitières.
 */
export function normaliserNomConcurrent(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // diacritiques laissés par NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

export interface ConcurrentAgrege {
  /** Clé normalisée : sert au regroupement et de clé de rendu. */
  cle: string
  /** Première graphie rencontrée — c'est elle qu'on affiche. */
  nom: string
  /** Nombre de visites où ce concurrent a été signalé. */
  signalements: number
  /** Parmi elles, combien le décrivent comme en activité. */
  en_activite: number
  /** Actions relevées, dédoublonnées, dans l'ordre de rencontre. */
  actions: string[]
  /** Catégories dans lesquelles il a été signalé (evap, imp, scm, uht…). */
  categories: string[]
  photos: string[]
}

/** Les 4 familles suivies dans le formulaire mobile. */
const CATEGORIES_CONNUES = ['evap', 'imp', 'scm', 'uht'] as const

/** Marque du référentiel `marque_concurrente` (voir 20260730150000). */
export interface MarqueConcurrente {
  famille: string
  /** Clé JSONB du statut dans visites.data.concurrence.<famille>.<code>. */
  code: string
  nom: string
  ordre?: number | null
}

/**
 * Marques historiquement codées en dur dans le formulaire. Servent de repli
 * quand le référentiel est injoignable (mobile hors ligne, table vide) : sans
 * lui, un merchandiser sans réseau perdrait tout le relevé concurrence.
 */
export const MARQUES_CONCURRENTES_DEFAUT: MarqueConcurrente[] = [
  { famille: 'evap', code: 'cowmilk', nom: 'Cowmilk', ordre: 1 },
  { famille: 'evap', code: 'nido_150g', nom: 'NIDO 150g', ordre: 2 },
  { famille: 'imp', code: 'nido', nom: 'Nido', ordre: 1 },
  { famille: 'imp', code: 'laity', nom: 'Laity', ordre: 2 },
  { famille: 'imp', code: 'top_lait', nom: 'Top Lait', ordre: 3 },
  { famille: 'scm', code: 'top_saho', nom: 'Top Saho', ordre: 1 },
  { famille: 'uht', code: 'candia', nom: 'Candia', ordre: 1 },
]

/** Regroupe les marques par famille, triées par ordre puis nom. */
export function grouperMarquesParFamille(marques: MarqueConcurrente[]): Record<string, MarqueConcurrente[]> {
  const parFamille: Record<string, MarqueConcurrente[]> = {}
  for (const m of marques) {
    if (!m?.famille || !m.code) continue
    ;(parFamille[m.famille] ||= []).push(m)
  }
  for (const liste of Object.values(parFamille)) {
    liste.sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0) || a.nom.localeCompare(b.nom, 'fr'))
  }
  return parFamille
}

/**
 * Extrait les concurrents libres d'UNE visite, dans les deux formats :
 *  - nouveau : `concurrence.autres[] = { nom, en_activite, action_concurrence }`
 *  - ancien  : `concurrence.<cat>.autre === 'Présent'` + `<cat>.nom_concurrent`
 * Sans le second, les visites antérieures à juillet 2026 disparaîtraient du
 * dashboard le jour du déploiement.
 */
export function concurrentsDeLaVisite(concurrence: Partial<VisiteConcurrence> | null | undefined): ConcurrentSignale[] {
  if (!concurrence) return []
  const sortie: ConcurrentSignale[] = []

  for (const cat of CATEGORIES_CONNUES) {
    const bloc = (concurrence as any)[cat]
    if (!bloc) continue
    const nomLegacy = String(bloc.nom_concurrent || '').trim()
    if (bloc.autre === 'Présent' && nomLegacy) {
      sortie.push({
        nom: nomLegacy,
        categorie: cat,
        en_activite: bloc.en_activite,
        action_concurrence: bloc.action_concurrence,
      })
    }
  }

  for (const c of concurrence.autres || []) {
    const nom = String(c?.nom || '').trim()
    if (nom) sortie.push({ ...c, nom })
  }

  return sortie
}

/** Regroupe les concurrents libres de plusieurs visites par nom normalisé. */
export function agregerConcurrents(
  visites: { data?: { concurrence?: Partial<VisiteConcurrence> } | null }[],
): ConcurrentAgrege[] {
  const parCle = new Map<string, ConcurrentAgrege>()

  for (const visite of visites) {
    for (const c of concurrentsDeLaVisite(visite.data?.concurrence)) {
      const cle = normaliserNomConcurrent(c.nom)
      if (!cle) continue

      let entree = parCle.get(cle)
      if (!entree) {
        entree = { cle, nom: c.nom, signalements: 0, en_activite: 0, actions: [], categories: [], photos: [] }
        parCle.set(cle, entree)
      }

      entree.signalements++
      if (c.en_activite) entree.en_activite++

      const action = String(c.action_concurrence || '').trim()
      if (action && !entree.actions.includes(action)) entree.actions.push(action)
      if (c.categorie && !entree.categories.includes(c.categorie)) entree.categories.push(c.categorie)
      if (c.photo_url && !entree.photos.includes(c.photo_url)) entree.photos.push(c.photo_url)
    }
  }

  return [...parCle.values()].sort((a, b) => b.signalements - a.signalements || a.nom.localeCompare(b.nom, 'fr'))
}
