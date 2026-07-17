<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Inventaire SKU</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        Snapshot des niveaux de stock par produit — basé sur la dernière visite de chaque PDV (synchronisée à la fin de visite).
      </p>
    </div>

    <DashboardFilters
      v-model="dashboard.filters.value"
      @filter="dashboard.fetchVisites()"
    />

    <div v-if="dashboard.loading.value" class="flex items-center justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-fc-blue" />
    </div>

    <template v-else>
      <!-- KPIs globaux -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard title="PDV couverts" :value="String(pdvCouverts)" format="none" :icon="Building2" color="blue" />
        <StatsCard title="SKU en rupture (≥1 PDV)" :value="String(skuEnRupture)" format="none" :icon="XCircle" color="red" />
        <StatsCard title="Lignes stock bas" :value="String(totalLow)" format="none" :icon="AlertTriangle" color="orange" />
        <StatsCard title="Dispo moyenne" :value="dispoMoyenne + '%'" format="none" :icon="CheckCircle" :color="dispoMoyenne >= 50 ? 'green' : 'orange'" />
      </div>

      <!-- Tableaux par catégorie -->
      <div v-for="cat in catalog" :key="cat.key" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div class="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
          <span class="w-3 h-3 rounded-full" :style="{ backgroundColor: cat.color }" />
          <h2 class="font-bold text-gray-900 dark:text-gray-100">{{ cat.label }}</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">SKU</th>
                <th class="px-4 py-2.5 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Qté totale</th>
                <th class="px-4 py-2.5 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">PDV</th>
                <th class="px-4 py-2.5 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Dispo</th>
                <th class="px-4 py-2.5 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Stock bas</th>
                <th class="px-4 py-2.5 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Rupture</th>
                <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-40">% Disponibilité</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-for="row in rowsByCat[cat.key]" :key="row.sku" class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td class="px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100">{{ row.label }}</td>
                <td class="px-4 py-2.5 text-center text-sm font-bold text-gray-900 dark:text-gray-100">{{ row.qtyTotale }}</td>
                <td class="px-4 py-2.5 text-center text-sm text-gray-500 dark:text-gray-400">{{ row.nbPdv }}</td>
                <td class="px-4 py-2.5 text-center">
                  <span class="text-sm font-medium text-emerald-600">{{ row.nbDispo }}</span>
                </td>
                <td class="px-4 py-2.5 text-center">
                  <span class="text-sm font-medium" :class="row.nbLow ? 'text-amber-600' : 'text-gray-400'">{{ row.nbLow }}</span>
                </td>
                <td class="px-4 py-2.5 text-center">
                  <span class="text-sm font-medium" :class="row.nbOos ? 'text-red-600' : 'text-gray-400'">{{ row.nbOos }}</span>
                </td>
                <td class="px-4 py-2.5">
                  <div class="flex items-center gap-2">
                    <div class="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                      <div
                        class="h-full rounded-full"
                        :class="row.pctDispo >= 50 ? 'bg-emerald-500' : row.pctDispo > 0 ? 'bg-amber-500' : 'bg-red-500'"
                        :style="{ width: row.pctDispo + '%' }"
                      />
                    </div>
                    <span class="text-xs text-gray-500 dark:text-gray-400 w-10 text-right">{{ row.pctDispo }}%</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p v-if="!dashboard.totalVisites.value" class="text-center text-gray-400 py-10 text-sm">
        Aucune visite sur la période. Les niveaux de stock apparaîtront après les premières remontées terrain.
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Building2, XCircle, AlertTriangle, CheckCircle } from 'lucide-vue-next'
import { PRODUCT_CATALOG, computeSkuInventory, type SkuInventoryRow } from '~/utils/products'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const dashboard = useDashboardDirection()
const { fetchThresholds, getSeuil } = useSkuThresholds()

const catalog = PRODUCT_CATALOG

const inventory = computed<SkuInventoryRow[]>(() =>
  computeSkuInventory(dashboard.visites.value as any, getSeuil)
)

const rowsByCat = computed<Record<string, SkuInventoryRow[]>>(() => {
  const map: Record<string, SkuInventoryRow[]> = {}
  for (const row of inventory.value) {
    if (!map[row.category]) map[row.category] = []
    map[row.category].push(row)
  }
  return map
})

// KPIs
const pdvCouverts = computed(() => {
  const ids = new Set<string>()
  for (const v of dashboard.visites.value) {
    if (v.pdv?.pdv_id) ids.add(v.pdv.pdv_id)
  }
  return ids.size
})
const skuEnRupture = computed(() => inventory.value.filter(r => r.nbOos > 0).length)
const totalLow = computed(() => inventory.value.reduce((s, r) => s + r.nbLow, 0))
const dispoMoyenne = computed(() => {
  const rows = inventory.value.filter(r => r.nbPdv > 0)
  if (!rows.length) return 0
  return Math.round(rows.reduce((s, r) => s + r.pctDispo, 0) / rows.length * 10) / 10
})

onMounted(() => {
  
  fetchThresholds()
  dashboard.fetchVisites()
})
</script>
