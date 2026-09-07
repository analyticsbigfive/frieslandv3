// utils/visiteCompletude.ts
// Complétude d'un relevé de visite.
//
// Pourquoi ce fichier. Mesuré en base le 7 septembre 2026 : sur les 6 098
// visites depuis le 1er avril, 17 seulement (0,3 %) portent une quantité par
// SKU et 16 une visibilité. Or `dispo_rayon`, le score Perfect Store et
// l'analyse des gaps (`v_perfect_store_manques`) se calculent exclusivement à
// partir de ces deux blocs : sans eux, tous les tableaux de bord affichent
// zéro. On mesure donc explicitement ce qui est renseigné, pour le montrer à la
// saisie comme à la lecture.
//
// Règle de comptage des quantités : `setQty` (pages/mobile/visites/new.vue:971)
// écrit toujours un nombre >= 0. Une clé PRÉSENTE vaut donc « répondu », y
// compris à 0 — 0 est une réponse (« rupture »), pas une absence de réponse.
// Une clé ABSENTE vaut « non renseigné ». Ne jamais tester la valeur.

/** Familles de produits du relevé, dans l'ordre du wizard. */
export const CATEGORIES_RELEVE = ['evap', 'imp', 'scm', 'uht', 'yaourt', 'cereales'] as const
export type CategorieReleve = (typeof CATEGORIES_RELEVE)[number]

export interface SectionCompletude {
  key: string
  label: string
  rempli: boolean
}

export interface Completude {
  /** Part des sections attendues qui sont renseignées, arrondie à l'entier. */
  pct: number
  sections: SectionCompletude[]
  /** Libellés des sections vides, prêts à afficher. */
  manquantes: string[]
  /** Aucune section renseignée : la visite n'apporte rien aux tableaux de bord. */
  vide: boolean
}

const LIBELLES: Record<string, string> = {
  evap: 'EVAP',
  imp: 'IMP',
  scm: 'SCM',
  uht: 'UHT',
  yaourt: 'Yaourt',
  cereales: 'Céréales',
  visibilite: 'Visibilité',
}

/**
 * Une catégorie est renseignée dès qu'une quantité a été saisie pour au moins
 * un SKU. Tolère un bloc absent, nul ou non-objet (visites importées).
 */
export function categorieRenseignee(bloc: unknown): boolean {
  const quantites = (bloc as { quantites?: unknown } | null | undefined)?.quantites
  if (!quantites || typeof quantites !== 'object') return false
  return Object.keys(quantites as Record<string, unknown>).length > 0
}

/** La visibilité est renseignée dès qu'un standard a été coché ou décoché. */
export function visibiliteRenseignee(data: unknown): boolean {
  const standards = (data as { visibilite?: { standards?: unknown } } | null | undefined)
    ?.visibilite?.standards
  if (!standards || typeof standards !== 'object') return false
  return Object.keys(standards as Record<string, unknown>).length > 0
}

/**
 * Complétude d'un `visites.data`.
 *
 * @param data           Le payload de la visite (peut être nul : import ancien).
 * @param categoriesActives Familles attendues. Par défaut les six ; passer la
 *   liste issue de `useCategoriesReleve` pour ne pas réclamer une catégorie
 *   désactivée dans l'admin (yaourt et céréales l'ont été au lot 6).
 */
export function completudeReleve(
  data: unknown,
  categoriesActives: readonly string[] = CATEGORIES_RELEVE,
): Completude {
  const produits = (data as { produits?: Record<string, unknown> } | null | undefined)?.produits
  const sections: SectionCompletude[] = categoriesActives.map(cat => ({
    key: cat,
    label: LIBELLES[cat] || cat.toUpperCase(),
    rempli: categorieRenseignee(produits?.[cat]),
  }))
  sections.push({ key: 'visibilite', label: LIBELLES.visibilite, rempli: visibiliteRenseignee(data) })

  const remplies = sections.filter(s => s.rempli).length
  return {
    pct: sections.length ? Math.round((remplies / sections.length) * 100) : 0,
    sections,
    manquantes: sections.filter(s => !s.rempli).map(s => s.label),
    vide: remplies === 0,
  }
}
