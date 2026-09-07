// composables/useCategoriesReleve.ts
// Catégories du relevé produit, pilotées par la table `categorie_releve`.
// Même patron que useMarquesConcurrentes : état partagé via useState, repli
// hors ligne sur CATEGORIES_RELEVE_DEFAUT (yaourt et céréales fermés).

import {
  CATEGORIES_RELEVE_DEFAUT,
  categoriesActives as calculerActives,
  codesActifs as calculerCodesActifs,
  filtrerParCategoriesActives,
  type CategorieReleve,
} from '~/utils/categoriesReleve'

export function useCategoriesReleve() {
  const supabase = useSupabaseClient()
  const categories = useState<CategorieReleve[]>('categories-releve', () => [...CATEGORIES_RELEVE_DEFAUT])
  const chargees = useState('categories-releve-chargees', () => false)

  async function charger(force = false) {
    if (chargees.value && !force) return
    const { data, error } = await supabase
      .from('categorie_releve')
      .select('code, libelle, actif, ordre')
    if (!error && data?.length) {
      categories.value = data as CategorieReleve[]
      chargees.value = true
    }
  }

  const actives = computed(() => calculerActives(categories.value))
  const codesActifs = computed(() => calculerCodesActifs(categories.value))

  function estActive(code: string) {
    return codesActifs.value.has(code)
  }

  function filtrer<T>(items: T[], cle: (item: T) => string): T[] {
    return filtrerParCategoriesActives(items, categories.value, cle)
  }

  return { categories, actives, codesActifs, estActive, filtrer, charger }
}
