// composables/useCatalogueReleve.ts
// Catalogue des produits du formulaire de visite, piloté par l'admin
// (Référentiels › Produits du formulaire) : catégories (categorie_releve) et
// SKU (sku_thresholds : libellé, ordre, actif, seuil « stock bas »).
//
// Chargement : cache hors ligne d'abord (démarrage sans réseau), puis la base ;
// sans l'un ni l'autre, repli sur PRODUCT_CATALOG. Le catalogue est poussé dans
// utils/products.ts (getSkus, getCategoryDef… deviennent celui de la base), et
// les états partagés des catégories et des seuils sont alignés.
import { get, set } from 'idb-keyval'
import {
  PRODUCT_CATALOG, categoriesProduitsActives, definirCatalogue,
  type ProductCategoryDef, type SkuDef,
} from '../utils/products'
import type { CategorieReleve } from '../utils/categoriesReleve'

const CLE_CACHE = 'offline:catalogue-releve'
const COULEUR_DEFAUT = '#6B7280'
const AVEC_FACINGS = new Set(['evap', 'imp', 'scm'])

export interface LigneCategorie { code: string, libelle: string, actif: boolean, ordre?: number | null, facings?: boolean | null }
export interface LigneSku { category: string, sku: string, label?: string | null, seuil_bas?: number | null, ordre?: number | null, actif?: boolean | null }

/** Catalogue complet (catégories actives et retirées) depuis les lignes de la base. */
export function construireCatalogue(categories: LigneCategorie[], skus: LigneSku[]) {
  const tous: Record<string, SkuDef[]> = {}
  const catalogue: ProductCategoryDef[] = [...categories]
    .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0) || String(a.libelle).localeCompare(String(b.libelle), 'fr'))
    .map((c) => {
      const base = PRODUCT_CATALOG.find(p => p.key === c.code)
      const lignes = skus.filter(s => s.category === c.code)
        .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0) || String(a.label || a.sku).localeCompare(String(b.label || b.sku), 'fr'))
      const tousSkus: SkuDef[] = lignes.length
        ? lignes.map(l => ({
            key: l.sku,
            label: l.label || base?.skus.find(s => s.key === l.sku)?.label || l.sku,
            seuilBasDefaut: Number.isFinite(l.seuil_bas) ? Number(l.seuil_bas) : 3,
            actif: l.actif !== false,
          }))
        : (base?.skus || []).map(s => ({ ...s, actif: true }))
      tous[c.code] = tousSkus
      return {
        key: c.code,
        label: c.libelle || base?.label || c.code,
        color: base?.color || COULEUR_DEFAUT,
        skus: tousSkus.filter(s => s.actif !== false),
        facings: c.facings ?? AVEC_FACINGS.has(c.code),
        actif: c.actif !== false,
        ordre: c.ordre ?? 0,
      }
    })
  return { catalogue, tous }
}

export function useCatalogueReleve() {
  const charge = useState('catalogue-releve-charge', () => false)
  const categoriesEtat = useState<CategorieReleve[]>('categories-releve')
  const categoriesChargees = useState('categories-releve-chargees', () => false)
  const seuils = useState<Record<string, number>>('sku-thresholds', () => ({}))
  const seuilsCharges = useState<boolean>('sku-thresholds-loaded', () => false)

  function appliquer(brut: { categories: LigneCategorie[], skus: LigneSku[] }) {
    const { catalogue, tous } = construireCatalogue(brut.categories, brut.skus)
    definirCatalogue(catalogue, tous)
    // États partagés d'useCategoriesReleve et d'useSkuThresholds alignés.
    categoriesEtat.value = brut.categories.map(c => ({ code: c.code, libelle: c.libelle, actif: c.actif, ordre: c.ordre }))
    categoriesChargees.value = true
    if (brut.skus.length) {
      seuils.value = Object.fromEntries(brut.skus.map(s => [`${s.category}:${s.sku}`, Number(s.seuil_bas ?? 3)]))
      seuilsCharges.value = true
    }
  }

  async function charger(force = false) {
    if (!import.meta.client || (charge.value && !force)) return
    if (!charge.value) {
      try {
        const cache = await get<{ categories: LigneCategorie[], skus: LigneSku[] }>(CLE_CACHE)
        if (cache?.categories?.length) appliquer(cache)
      }
      catch { /* IndexedDB indisponible */ }
    }
    try {
      const supabase = useSupabaseClient() as any
      // Colonnes ajoutées par la migration 20261007130000 : repli sans elles.
      let cat = await supabase.from('categorie_releve').select('code, libelle, actif, ordre, facings')
      if (cat.error) cat = await supabase.from('categorie_releve').select('code, libelle, actif, ordre')
      let sk = await supabase.from('sku_thresholds').select('category, sku, label, seuil_bas, ordre, actif')
      if (sk.error) sk = await supabase.from('sku_thresholds').select('category, sku, label, seuil_bas, ordre')
      if (cat.error || !cat.data?.length) return
      const brut = { categories: cat.data as LigneCategorie[], skus: (sk.error ? [] : sk.data) as LigneSku[] }
      appliquer(brut)
      charge.value = true
      await set(CLE_CACHE, JSON.parse(JSON.stringify(brut))).catch(() => {})
    }
    catch { /* hors ligne : cache ou repli */ }
  }

  const categoriesActives = computed(() => categoriesProduitsActives())

  return { charger, categoriesActives }
}
