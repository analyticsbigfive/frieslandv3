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

/** SKU concurrent du référentiel `marque_concurrente_sku` (lot 6, 1.0.4). */
export interface SkuConcurrent {
  /** Identifiant de la marque (marque_concurrente.id), ou clé famille:code en repli. */
  marque_id: string
  famille: string
  /** Code de la marque parente (marque_concurrente.code). */
  marque_code: string
  /** Clé JSONB du statut dans visites.data.concurrence.<famille>.skus.<code>. */
  code: string
  libelle: string
  grammage_g?: number | null
  format?: string | null
  image_url?: string | null
  ordre?: number | null
}

/**
 * SKU de la liste « Présence » du client (7 septembre 2026), repli hors ligne.
 * Même raison que MARQUES_CONCURRENTES_DEFAUT : sans réseau, le relevé SKU
 * doit rester possible.
 */
export const SKUS_CONCURRENTS_DEFAUT: SkuConcurrent[] = [
  { marque_id: 'evap:cowmilk', famille: 'evap', marque_code: 'cowmilk', code: 'cowmilk_160g', libelle: 'Cowmilk 160g', grammage_g: 160, ordre: 1 },
  { marque_id: 'evap:laity', famille: 'evap', marque_code: 'laity', code: 'laity_150g', libelle: 'Laity 150g', grammage_g: 150, ordre: 1 },
  { marque_id: 'evap:soleil', famille: 'evap', marque_code: 'soleil', code: 'soleil_400g', libelle: 'Soleil 400g', grammage_g: 400, ordre: 1 },
  { marque_id: 'imp:nido', famille: 'imp', marque_code: 'nido', code: 'nido_15g', libelle: 'Nido 15g', grammage_g: 15, ordre: 1 },
  { marque_id: 'imp:nido', famille: 'imp', marque_code: 'nido', code: 'nido_350g', libelle: 'Nido 350g', grammage_g: 350, ordre: 2 },
  { marque_id: 'imp:nido', famille: 'imp', marque_code: 'nido', code: 'nido_400g', libelle: 'Nido 400g', grammage_g: 400, ordre: 3 },
  { marque_id: 'imp:nido', famille: 'imp', marque_code: 'nido', code: 'nido_800g', libelle: 'Nido 800g', grammage_g: 800, ordre: 4 },
  { marque_id: 'imp:nido', famille: 'imp', marque_code: 'nido', code: 'nido_2500g', libelle: 'Nido 2500g', grammage_g: 2500, ordre: 5 },
  { marque_id: 'imp:top_lait', famille: 'imp', marque_code: 'top_lait', code: 'top_lait_12g', libelle: 'Top lait 12g', grammage_g: 12, ordre: 1 },
  { marque_id: 'imp:top_lait', famille: 'imp', marque_code: 'top_lait', code: 'top_lait_400g', libelle: 'Top lait 400g', grammage_g: 400, ordre: 2 },
  { marque_id: 'imp:laity', famille: 'imp', marque_code: 'laity', code: 'laity_18g', libelle: 'Laity 18g', grammage_g: 18, ordre: 1 },
  { marque_id: 'imp:laity', famille: 'imp', marque_code: 'laity', code: 'laity_360g', libelle: 'Laity 360g', grammage_g: 360, ordre: 2 },
  { marque_id: 'imp:laity', famille: 'imp', marque_code: 'laity', code: 'laity_400g', libelle: 'Laity 400g', grammage_g: 400, ordre: 3 },
  { marque_id: 'imp:laity', famille: 'imp', marque_code: 'laity', code: 'laity_900g', libelle: 'Laity 900g', grammage_g: 900, ordre: 4 },
  { marque_id: 'imp:biblos', famille: 'imp', marque_code: 'biblos', code: 'biblos_16g', libelle: 'Biblos FC 16g', grammage_g: 16, ordre: 1 },
  { marque_id: 'imp:biblos', famille: 'imp', marque_code: 'biblos', code: 'biblos_360g', libelle: 'Biblos Full Cream 360g', grammage_g: 360, ordre: 2 },
  { marque_id: 'imp:biblos', famille: 'imp', marque_code: 'biblos', code: 'biblos_900g', libelle: 'Biblos Fat Filled 900g', grammage_g: 900, ordre: 3 },
  { marque_id: 'imp:captain', famille: 'imp', marque_code: 'captain', code: 'captain_12g', libelle: 'Captain 12g', grammage_g: 12, ordre: 1 },
  { marque_id: 'imp:captain', famille: 'imp', marque_code: 'captain', code: 'captain_22g', libelle: 'Captain 22g', grammage_g: 22, ordre: 2 },
]

/** Regroupe les SKU par « famille:marque_code », triés par ordre puis grammage. */
export function grouperSkusParMarque(skus: SkuConcurrent[]): Record<string, SkuConcurrent[]> {
  const parMarque: Record<string, SkuConcurrent[]> = {}
  for (const s of skus) {
    if (!s?.famille || !s.marque_code || !s.code) continue
    ;(parMarque[`${s.famille}:${s.marque_code}`] ||= []).push(s)
  }
  for (const liste of Object.values(parMarque)) {
    liste.sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0) || (a.grammage_g ?? 0) - (b.grammage_g ?? 0))
  }
  return parMarque
}

/**
 * Statut de marque dérivé de ses SKU : « Présent » dès qu'un SKU l'est. La clé
 * marque continue d'être écrite pour les dashboards qui la lisent ; sans cette
 * dérivation, un relevé fait au niveau SKU laisserait la marque « En rupture ».
 */
export function statutMarqueDerive(
  skusStatuts: Record<string, string | undefined> | null | undefined,
  codesSku: string[],
  statutActuel: string | undefined,
): string {
  if (codesSku.some(code => skusStatuts?.[code] === 'Présent')) return 'Présent'
  return statutActuel === 'Présent' ? 'Présent' : (statutActuel || 'En rupture')
}

/**
 * Clé d'une marque dans la visibilité concurrence (étape 9/11), indépendante
 * de la famille : « NIDO 150g » (evap) et « Nido » (imp) sont la même enseigne
 * sur une affiche. Le grammage terminal est retiré avant normalisation, ce
 * qui redonne les clés historiques nido / laity / candia lues par les
 * dashboards de visibilité concurrence.
 */
export function cleVisibiliteMarque(nom: string): string {
  return normaliserNomConcurrent(String(nom || '').replace(/\s*\d+(?:[.,]\d+)?\s*(g|kg|ml|l)\b\s*$/i, ''))
}

export interface MarqueVisibilite {
  cle: string
  nom: string
}

/** Marques distinctes pour la visibilité concurrence, toutes familles confondues. */
export function marquesPourVisibilite(marques: MarqueConcurrente[]): MarqueVisibilite[] {
  const vues = new Map<string, MarqueVisibilite>()
  for (const m of marques) {
    const cle = cleVisibiliteMarque(m.nom)
    if (!cle || vues.has(cle)) continue
    vues.set(cle, { cle, nom: m.nom.replace(/\s*\d+(?:[.,]\d+)?\s*(g|kg|ml|l)\b\s*$/i, '').trim() || m.nom })
  }
  return [...vues.values()]
}

/**
 * Lit la présence de visibilité d'une marque, dans les deux formats :
 *  - nouveau : `visibilite.concurrence.<emplacement>.<cle> = true`
 *  - ancien  : `visibilite.concurrence.<cle>_exterieur` / `_interieur = true`
 * Sans le second, les visites d'avant septembre 2026 perdraient leur relevé.
 */
export function visibiliteConcurrencePresente(
  concurrence: Record<string, any> | null | undefined,
  emplacement: 'exterieure' | 'interieure',
  cle: string,
): boolean {
  if (!concurrence) return false
  const v = concurrence[emplacement]?.[cle]
  if (v === true || v === 'Présent') return true
  const legacy = concurrence[`${cle}_${emplacement === 'exterieure' ? 'exterieur' : 'interieur'}`]
  return legacy === true || legacy === 'Présent'
}

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
