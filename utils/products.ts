// utils/products.ts
// Catalogue des SKU produits Friesland.
//
// Depuis la 1.0.12, le catalogue vient de la base (Référentiels › Produits du
// formulaire : tables categorie_releve et sku_thresholds), chargé par
// composables/useCatalogueReleve.ts et gardé hors ligne. PRODUCT_CATALOG
// ci-dessous n'est plus que le repli (premier lancement sans réseau) : les
// clés (catégorie, SKU) sont celles de visites.data.produits et ne changent
// jamais — ne pas les « corriger » (imp.br_400g = boîte de 2500 g).
import { shallowRef } from 'vue'
import type { ProductStatus } from '~/types'

// Les six catégories d'origine, plus toute catégorie créée dans l'admin.
export type ProductCategoryKey = 'evap' | 'imp' | 'scm' | 'uht' | 'yaourt' | 'cereales' | (string & {})

export interface SkuDef {
  key: string
  label: string
  /** Seuil "stock bas" par défaut (modifiable par SKU en base via sku_thresholds). */
  seuilBasDefaut: number
  /** Faux : retiré du formulaire, gardé pour lire l'historique. */
  actif?: boolean
}

export interface ProductCategoryDef {
  key: ProductCategoryKey
  label: string
  color: string
  /** SKU actifs, dans l'ordre du formulaire. */
  skus: SkuDef[]
  /** Saisie des facings en Modern Trade. */
  facings?: boolean
  /** Faux : catégorie retirée du formulaire (historique conservé). */
  actif?: boolean
  ordre?: number
}

const DEFAULT_SEUIL_BAS = 3

export const PRODUCT_CATALOG: ProductCategoryDef[] = [
  {
    key: 'evap', label: 'EVAP', color: '#3B82F6', skus: [
      { key: 'br_gold', label: 'BR Gold', seuilBasDefaut: DEFAULT_SEUIL_BAS },
      { key: 'br_160g', label: 'BR 150g', seuilBasDefaut: DEFAULT_SEUIL_BAS },
      { key: 'brb_160g', label: 'BRB 150g', seuilBasDefaut: DEFAULT_SEUIL_BAS },
      { key: 'br_400g', label: 'BR 380g', seuilBasDefaut: DEFAULT_SEUIL_BAS },
      { key: 'brb_400g', label: 'BRB 380g', seuilBasDefaut: DEFAULT_SEUIL_BAS },
      { key: 'pearl_400g', label: 'Pearl 380g', seuilBasDefaut: DEFAULT_SEUIL_BAS },
    ],
  },
  {
    // Libellés = ceux du formulaire 1.0.10 (repris par la migration 20261007130000).
    key: 'imp', label: 'IMP', color: '#10B981', skus: [
      { key: 'br_400g', label: 'BR tin 2500g', seuilBasDefaut: DEFAULT_SEUIL_BAS },
      { key: 'br_20g', label: 'BR 15g', seuilBasDefaut: DEFAULT_SEUIL_BAS },
      { key: 'brb_25g', label: 'BRB 16g', seuilBasDefaut: DEFAULT_SEUIL_BAS }, // TODO confirmer client (pas de référence IMP BRB)
      { key: 'br_375g', label: 'BR 360g', seuilBasDefaut: DEFAULT_SEUIL_BAS },
      { key: 'br_900g', label: 'BR 400g Tin', seuilBasDefaut: DEFAULT_SEUIL_BAS },
      { key: 'brb_400g', label: 'BRB 360g', seuilBasDefaut: DEFAULT_SEUIL_BAS }, // TODO confirmer client (pas de référence IMP BRB)
      { key: 'br_2_5kg', label: 'BR 900g Tin', seuilBasDefaut: DEFAULT_SEUIL_BAS },
      { key: 'brd_15g', label: 'BRD 15g', seuilBasDefaut: DEFAULT_SEUIL_BAS },
      { key: 'brd_350g', label: 'BR Délice Pouch 350g', seuilBasDefaut: DEFAULT_SEUIL_BAS },
    ],
  },
  {
    // SCM = 2 produits seulement (confirmé Friesland 2026-07-15).
    key: 'scm', label: 'SCM', color: '#F59E0B', skus: [
      { key: 'pearl_1kg', label: 'Pearl 1Kg', seuilBasDefaut: DEFAULT_SEUIL_BAS },
      { key: 'br_1kg', label: 'BR 1Kg', seuilBasDefaut: DEFAULT_SEUIL_BAS },
    ],
  },
  {
    key: 'uht', label: 'UHT', color: '#8B5CF6', skus: [
      { key: 'demi_ecreme', label: 'BR 516ml', seuilBasDefaut: DEFAULT_SEUIL_BAS },
      { key: 'elopack_500ml', label: 'Elopack 500 ml', seuilBasDefaut: DEFAULT_SEUIL_BAS },
      { key: 'brique_1l', label: 'Brique 1L', seuilBasDefaut: DEFAULT_SEUIL_BAS },
    ],
  },
  {
    key: 'yaourt', label: 'YAOURT', color: '#EC4899', skus: [
      { key: 'br_yogoo_fraise_mini_90ml', label: 'BR Yogoo fraise mini 90 ml', seuilBasDefaut: DEFAULT_SEUIL_BAS },
      { key: 'br_yogoo_fraise_maxi_318ml', label: 'BR Yogoo fraise maxi 318 ml', seuilBasDefaut: DEFAULT_SEUIL_BAS },
      { key: 'br_yogoo_nature_mini_90ml', label: 'BR Yogoo nature mini 90 ml', seuilBasDefaut: DEFAULT_SEUIL_BAS },
      { key: 'br_yogoo_nature_maxi_318ml', label: 'BR Yogoo nature maxi 318 ml', seuilBasDefaut: DEFAULT_SEUIL_BAS },
    ],
  },
  {
    key: 'cereales', label: 'CÉRÉALES', color: '#06B6D4', skus: [
      // Libellés provisoires (à confirmer) — modifiables en base.
      { key: 'brcv', label: 'Céréales BRCV', seuilBasDefaut: DEFAULT_SEUIL_BAS },
      { key: 'brcc', label: 'Céréales BRCC', seuilBasDefaut: DEFAULT_SEUIL_BAS },
    ],
  },
]

export const PRODUCT_CATEGORY_KEYS = PRODUCT_CATALOG.map(c => c.key)

// ---- Catalogue courant (base, sinon repli) ----------------------------------
// Réactif : un calcul ou un template qui lit getSkus() se met à jour quand le
// catalogue de la base arrive.
const catalogueCourant = shallowRef<ProductCategoryDef[]>(PRODUCT_CATALOG.map((c, i) => ({
  ...c, facings: ['evap', 'imp', 'scm'].includes(c.key), actif: !['yaourt', 'cereales'].includes(c.key), ordre: i + 1,
})))
// Tous les SKU par catégorie, désactivés compris (lecture de l'historique).
const skusTous = shallowRef<Record<string, SkuDef[]>>({})

/** Remplace le catalogue courant (composables/useCatalogueReleve.ts). */
export function definirCatalogue(categories: ProductCategoryDef[], tous: Record<string, SkuDef[]> = {}) {
  catalogueCourant.value = categories
  skusTous.value = tous
}

/** Toutes les catégories connues (actives et retirées), dans l'ordre. */
export function catalogueProduits(): ProductCategoryDef[] {
  return catalogueCourant.value
}

/** Catégories du formulaire, dans l'ordre de l'admin. */
export function categoriesProduitsActives(): ProductCategoryDef[] {
  return catalogueCourant.value.filter(c => c.actif !== false)
    .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0) || a.label.localeCompare(b.label, 'fr'))
}

export function getCategoryDef(key: string): ProductCategoryDef | undefined {
  return catalogueCourant.value.find(c => c.key === key) || PRODUCT_CATALOG.find(c => c.key === key)
}

/** SKU actifs d'une catégorie ; `inclureInactifs` pour relire les anciennes visites. */
export function getSkus(categoryKey: string, { inclureInactifs = false }: { inclureInactifs?: boolean } = {}): SkuDef[] {
  if (inclureInactifs && skusTous.value[categoryKey]?.length) return skusTous.value[categoryKey]
  return getCategoryDef(categoryKey)?.skus || []
}

export function getSkuLabel(categoryKey: string, skuKey: string): string {
  return getSkus(categoryKey, { inclureInactifs: true }).find(s => s.key === skuKey)?.label
    || PRODUCT_CATALOG.find(c => c.key === categoryKey)?.skus.find(s => s.key === skuKey)?.label
    || skuKey
}

// Statuts hérités considérés comme "produit présent" (anciennes visites).
const LEGACY_PRESENT = new Set<string>(['Présent', 'Disponible , Prix respecté', 'Présent , Prix respecté'])

/**
 * Quantité numérique d'un SKU à partir d'une valeur de visite.
 * - Nouveau format: quantité (number) lue depuis data.produits[cat].quantites[sku]
 * - Ancien format: statut (string) → null (quantité inconnue)
 */
export function skuQuantity(catData: any, skuKey: string): number | null {
  const q = catData?.quantites?.[skuKey]
  if (typeof q === 'number' && !Number.isNaN(q)) return q
  return null
}

/** Disponible: quantité ≥ 1, ou (legacy) statut présent. */
export function skuIsAvailable(catData: any, skuKey: string): boolean {
  const q = skuQuantity(catData, skuKey)
  if (q !== null) return q > 0
  const legacy = catData?.[skuKey]
  return typeof legacy === 'string' && LEGACY_PRESENT.has(legacy)
}

export type StockLevel = 'oos' | 'low' | 'ok' | 'unknown'

/** Niveau de stock d'un SKU selon sa quantité et un seuil "bas". */
export function skuStockLevel(catData: any, skuKey: string, seuilBas: number): StockLevel {
  const q = skuQuantity(catData, skuKey)
  if (q === null) {
    // Legacy: présence connue mais pas la quantité
    return skuIsAvailable(catData, skuKey) ? 'ok' : 'oos'
  }
  if (q <= 0) return 'oos'
  if (q <= seuilBas) return 'low'
  return 'ok'
}

/** Catégorie "présente" = au moins un SKU disponible (SKU retirés compris). */
export function categoryPresent(catData: any, categoryKey: string): boolean {
  if (!catData) return false
  return getSkus(categoryKey, { inclureInactifs: true }).some(s => skuIsAvailable(catData, s.key))
}

/** Quantité totale (SKU à quantité connue) d'une catégorie. */
export function categoryTotalQuantity(catData: any, categoryKey: string): number {
  if (!catData) return 0
  return getSkus(categoryKey, { inclureInactifs: true }).reduce((sum, s) => {
    const q = skuQuantity(catData, s.key)
    return sum + (q ?? 0)
  }, 0)
}

export const STOCK_LEVEL_META: Record<StockLevel, { label: string; color: string; badge: string }> = {
  oos: { label: 'Rupture', color: '#EF4444', badge: 'red' },
  low: { label: 'Stock bas', color: '#F59E0B', badge: 'orange' },
  ok: { label: 'Disponible', color: '#10B981', badge: 'green' },
  unknown: { label: 'Inconnu', color: '#9CA3AF', badge: 'gray' },
}

/** Conserve la compat avec le statut hérité ProductStatus. */
export function quantityToLegacyStatus(qty: number): ProductStatus {
  return qty > 0 ? 'Présent' : 'En rupture'
}

// ---- Inventaire SKU (snapshot: dernière visite par PDV) ----
export interface SkuInventoryRow {
  category: ProductCategoryKey
  categoryLabel: string
  sku: string
  label: string
  nbPdv: number       // PDV ayant remonté cette catégorie
  nbDispo: number     // qté ≥ 1 (ou legacy présent)
  nbOos: number       // qté = 0
  nbLow: number       // 0 < qté ≤ seuil
  qtyTotale: number   // somme des quantités connues
  pctDispo: number    // nbDispo / nbPdv * 100
}

interface InventoryVisite {
  date_visite: string
  data: any
  pdv?: { pdv_id?: string } | null
}

/**
 * Calcule l'inventaire SKU à partir des visites (snapshot = dernière visite par PDV).
 * @param visites liste de visites (avec data.produits + pdv.pdv_id)
 * @param getSeuil (category, sku) => seuil stock bas
 */
export function computeSkuInventory(
  visites: InventoryVisite[],
  getSeuil: (category: string, sku: string) => number,
): SkuInventoryRow[] {
  // Dernière visite par PDV
  const latest = new Map<string, InventoryVisite>()
  for (const v of visites) {
    const pdvId = v.pdv?.pdv_id
    if (!pdvId) continue
    const prev = latest.get(pdvId)
    if (!prev || new Date(v.date_visite) > new Date(prev.date_visite)) {
      latest.set(pdvId, v)
    }
  }
  const snapshot = [...latest.values()]

  const rows: SkuInventoryRow[] = []
  for (const cat of categoriesProduitsActives()) {
    for (const sku of cat.skus) {
      const seuil = getSeuil(cat.key, sku.key)
      let nbPdv = 0, nbDispo = 0, nbOos = 0, nbLow = 0, qtyTotale = 0
      for (const v of snapshot) {
        const catData = v.data?.produits?.[cat.key]
        if (!catData) continue
        nbPdv++
        const q = skuQuantity(catData, sku.key)
        if (q !== null) qtyTotale += q
        const level = skuStockLevel(catData, sku.key, seuil)
        if (level === 'oos') nbOos++
        else if (level === 'low') { nbLow++; nbDispo++ }
        else if (level === 'ok') nbDispo++
      }
      rows.push({
        category: cat.key,
        categoryLabel: cat.label,
        sku: sku.key,
        label: sku.label,
        nbPdv, nbDispo, nbOos, nbLow, qtyTotale,
        pctDispo: nbPdv > 0 ? Math.round((nbDispo / nbPdv) * 1000) / 10 : 0,
      })
    }
  }
  return rows
}
