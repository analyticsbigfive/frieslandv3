// utils/products.ts
// Catalogue central des SKU produits Friesland — source de vérité unique.
// Remplace les listes dupliquées dans new.vue / [category].vue / useCsvExport.
import type { ProductStatus } from '~/types'

export type ProductCategoryKey = 'evap' | 'imp' | 'scm' | 'uht' | 'yaourt' | 'cereales'

export interface SkuDef {
  key: string
  label: string
  /** Seuil "stock bas" par défaut (modifiable par SKU en base via sku_thresholds). */
  seuilBasDefaut: number
}

export interface ProductCategoryDef {
  key: ProductCategoryKey
  label: string
  color: string
  skus: SkuDef[]
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
    // Libellés alignés sur reference_produit.nom (référentiel) — clés JSONB inchangées.
    key: 'imp', label: 'IMP', color: '#10B981', skus: [
      { key: 'br_400g', label: 'BR tin 2500g', seuilBasDefaut: DEFAULT_SEUIL_BAS },
      { key: 'br_20g', label: 'BR 15g', seuilBasDefaut: DEFAULT_SEUIL_BAS },
      { key: 'brb_25g', label: 'BRB 16g', seuilBasDefaut: DEFAULT_SEUIL_BAS }, // TODO confirmer client (pas de référence IMP BRB)
      { key: 'br_375g', label: 'BR Pouch 360g', seuilBasDefaut: DEFAULT_SEUIL_BAS },
      { key: 'br_900g', label: 'BR tin 400g', seuilBasDefaut: DEFAULT_SEUIL_BAS },
      { key: 'brb_400g', label: 'BRB 360g', seuilBasDefaut: DEFAULT_SEUIL_BAS }, // TODO confirmer client (pas de référence IMP BRB)
      { key: 'br_2_5kg', label: 'BR tin 900g', seuilBasDefaut: DEFAULT_SEUIL_BAS },
      { key: 'brd_15g', label: 'BR Délice 15g', seuilBasDefaut: DEFAULT_SEUIL_BAS },
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
      { key: 'elopack_500ml', label: 'Elopack 500ml', seuilBasDefaut: DEFAULT_SEUIL_BAS },
      { key: 'brique_1l', label: 'Brique 1L', seuilBasDefaut: DEFAULT_SEUIL_BAS },
    ],
  },
  {
    key: 'yaourt', label: 'YAOURT', color: '#EC4899', skus: [
      { key: 'br_yogoo_fraise_mini_90ml', label: 'Yogoo Fraise Mini 90ml', seuilBasDefaut: DEFAULT_SEUIL_BAS },
      { key: 'br_yogoo_fraise_maxi_318ml', label: 'Yogoo Fraise Maxi 318ml', seuilBasDefaut: DEFAULT_SEUIL_BAS },
      { key: 'br_yogoo_nature_mini_90ml', label: 'Yogoo Nature Mini 90ml', seuilBasDefaut: DEFAULT_SEUIL_BAS },
      { key: 'br_yogoo_nature_maxi_318ml', label: 'Yogoo Nature Maxi 318ml', seuilBasDefaut: DEFAULT_SEUIL_BAS },
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

export function getCategoryDef(key: string): ProductCategoryDef | undefined {
  return PRODUCT_CATALOG.find(c => c.key === key)
}

export function getSkus(categoryKey: string): SkuDef[] {
  return getCategoryDef(categoryKey)?.skus || []
}

export function getSkuLabel(categoryKey: string, skuKey: string): string {
  return getSkus(categoryKey).find(s => s.key === skuKey)?.label || skuKey
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

/** Catégorie "présente" = au moins un SKU disponible. */
export function categoryPresent(catData: any, categoryKey: string): boolean {
  if (!catData) return false
  return getSkus(categoryKey).some(s => skuIsAvailable(catData, s.key))
}

/** Quantité totale (SKU à quantité connue) d'une catégorie. */
export function categoryTotalQuantity(catData: any, categoryKey: string): number {
  if (!catData) return 0
  return getSkus(categoryKey).reduce((sum, s) => {
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
  for (const cat of PRODUCT_CATALOG) {
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
