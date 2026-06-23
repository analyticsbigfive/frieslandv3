// composables/useSkuThresholds.ts
// Charge les seuils "stock bas" par SKU (table sku_thresholds), avec repli
// sur le seuil par défaut du catalogue si la table n'est pas configurée.
import { getSkus, getCategoryDef } from '~/utils/products'

export interface SkuThresholdRow {
  category: string
  sku: string
  label: string | null
  seuil_bas: number
  ordre: number
}

export function useSkuThresholds() {
  const supabase = useSupabaseClient()

  // map "category:sku" -> seuil_bas
  const thresholds = useState<Record<string, number>>('sku-thresholds', () => ({}))
  const loaded = useState<boolean>('sku-thresholds-loaded', () => false)

  function keyOf(category: string, sku: string) {
    return `${category}:${sku}`
  }

  async function fetchThresholds(force = false) {
    if (loaded.value && !force) return
    const { data, error } = await supabase
      .from('sku_thresholds')
      .select('category, sku, seuil_bas')
    if (error) {
      console.warn('useSkuThresholds: table indisponible, repli catalogue', error.message)
      loaded.value = true
      return
    }
    const map: Record<string, number> = {}
    for (const row of (data || []) as any[]) {
      map[keyOf(row.category, row.sku)] = row.seuil_bas
    }
    thresholds.value = map
    loaded.value = true
  }

  function getSeuil(category: string, sku: string): number {
    const v = thresholds.value[keyOf(category, sku)]
    if (typeof v === 'number') return v
    // Repli: seuil par défaut du catalogue
    const def = getSkus(category).find(s => s.key === sku)
    return def?.seuilBasDefaut ?? 3
  }

  async function updateSeuil(category: string, sku: string, seuil: number) {
    const label = getSkus(category).find(s => s.key === sku)?.label || sku
    const { error } = await supabase
      .from('sku_thresholds')
      .upsert({ category, sku, label, seuil_bas: seuil, updated_at: new Date().toISOString() }, { onConflict: 'category,sku' })
    if (error) throw error
    thresholds.value = { ...thresholds.value, [keyOf(category, sku)]: seuil }
  }

  return { thresholds, loaded, fetchThresholds, getSeuil, updateSeuil, getCategoryDef }
}
