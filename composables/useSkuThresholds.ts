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
    const def = getSkus(category, { inclureInactifs: true }).find(s => s.key === sku)
    return def?.seuilBasDefaut ?? 3
  }

  // Seul le seuil change : le libellé est géré dans Produits du formulaire et
  // ne doit pas être écrasé par celui du catalogue embarqué.
  async function updateSeuil(category: string, sku: string, seuil: number) {
    const table = supabase.from('sku_thresholds') as any
    const { data, error } = await table
      .update({ seuil_bas: seuil, updated_at: new Date().toISOString() })
      .eq('category', category).eq('sku', sku)
      .select('sku')
    if (error) throw error
    if (!data?.length) {
      const label = getSkus(category, { inclureInactifs: true }).find(s => s.key === sku)?.label || sku
      const { error: e2 } = await (supabase.from('sku_thresholds') as any)
        .insert({ category, sku, label, seuil_bas: seuil })
      if (e2) throw e2
    }
    thresholds.value = { ...thresholds.value, [keyOf(category, sku)]: seuil }
  }

  return { thresholds, loaded, fetchThresholds, getSeuil, updateSeuil, getCategoryDef }
}
