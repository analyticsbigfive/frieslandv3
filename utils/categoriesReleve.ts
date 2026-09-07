// utils/categoriesReleve.ts
// Catégories du relevé produit (evap, imp, scm, uht, yaourt, cereales),
// pilotées par la table `categorie_releve` (lot 6, 1.0.4).
//
// Le client a demandé de retirer yaourt et céréales du relevé sans perdre
// l'historique, et de pouvoir le refaire depuis l'admin. Une catégorie
// désactivée disparaît du wizard mobile, des onglets et récaps admin ; les
// visites qui la portent restent lisibles telles quelles.
//
// Le repli hors ligne reflète le retrait : sans réseau, le merchandiser ne doit
// pas revoir apparaître des étapes que l'admin a fermées.

import { PRODUCT_CATALOG } from './products'

export interface CategorieReleve {
  code: string
  libelle: string
  actif: boolean
  ordre?: number | null
}

/** Codes désactivés par défaut (demande du 7 septembre 2026). */
const INACTIVES_PAR_DEFAUT = new Set(['yaourt', 'cereales'])

/** Repli quand la table est injoignable : le catalogue front, yaourt et céréales fermés. */
export const CATEGORIES_RELEVE_DEFAUT: CategorieReleve[] = PRODUCT_CATALOG.map((c, i) => ({
  code: c.key,
  libelle: c.label,
  actif: !INACTIVES_PAR_DEFAUT.has(c.key),
  ordre: i + 1,
}))

/** Catégories actives, triées par ordre puis libellé. */
export function categoriesActives(rows: CategorieReleve[]): CategorieReleve[] {
  return rows
    .filter(r => r?.code && r.actif !== false)
    .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0) || a.libelle.localeCompare(b.libelle, 'fr'))
}

/** Ensemble des codes actifs, pour filtrer une liste existante par sa clé. */
export function codesActifs(rows: CategorieReleve[]): Set<string> {
  return new Set(categoriesActives(rows).map(r => r.code))
}

/**
 * Filtre une liste d'objets porteurs d'un code de catégorie (étapes du wizard,
 * onglets, définitions de catalogue) sur les catégories actives. Les objets
 * dont la clé n'est pas une catégorie de relevé (général, concurrence…) sont
 * conservés : seules les catégories connues et fermées sont retirées.
 */
export function filtrerParCategoriesActives<T>(
  items: T[],
  rows: CategorieReleve[],
  cle: (item: T) => string,
): T[] {
  const connues = new Set(rows.map(r => r.code))
  const actifs = codesActifs(rows)
  return items.filter((item) => {
    const k = cle(item)
    return !connues.has(k) || actifs.has(k)
  })
}
