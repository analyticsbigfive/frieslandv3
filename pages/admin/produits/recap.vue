<template>
  <div class="space-y-6">
    <AdminPageHeader
      title="Récapitulatif produits"
      description="Présence, prix respectés et détail par famille de produit."
      eyebrow="Domaine produits"
    />

    <DashboardFilters
      v-model="dashboard.filters.value"
      @filter="dashboard.fetchVisites()"
    />

    <div v-if="dashboard.loading.value" class="flex items-center justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-fc-blue" />
    </div>

    <template v-else>
      <!-- Indicateurs compacts par catégorie produit -->
      <div class="admin-surface grid grid-cols-2 gap-x-5 gap-y-3 px-4 py-3 sm:grid-cols-3 xl:grid-cols-6">
        <div v-for="cat in productCategories" :key="cat.key" class="min-w-0">
          <p class="truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">{{ cat.label }} présent</p>
          <p class="mt-1 text-xl font-semibold tabular-nums" :class="catPct(cat.key) >= 50 ? 'text-emerald-600' : 'text-amber-600'">{{ catPct(cat.key) }}%</p>
        </div>
      </div>

      <!-- Pie charts côte à côte -->
      <h2 class="text-base font-semibold text-slate-900 dark:text-white">Présence par famille de produit</h2>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <ClientOnly>
          <div v-for="cat in productCategories" :key="cat.key" class="admin-surface p-4">
            <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 text-center">{{ cat.label }}</h4>
            <ChartsPieChart
              :labels="['Absent', 'Présent']"
              :values="[catAbsent(cat.key), catPresent(cat.key)]"
              :colors="['#D1D5DB', cat.color]"
              height="sm"
              :show-percentages="true"
            />
          </div>
        </ClientOnly>
      </div>

      <!-- Prix respectés par famille -->
      <h2 class="text-base font-semibold text-slate-900 dark:text-white">Prix respectés</h2>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <ClientOnly>
          <div v-for="cat in productCategories" :key="cat.key + '_prix'" class="admin-surface p-4">
            <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 text-center">{{ cat.label }} prix</h4>
            <ChartsPieChart
              :labels="['Non respecté', 'Respecté']"
              :values="[prixNon(cat.key), prixOui(cat.key)]"
              :colors="['#EF4444', '#10B981']"
              height="sm"
              :show-percentages="true"
            />
          </div>
        </ClientOnly>
      </div>

      <!-- Tableau récapitulatif global -->
      <div class="admin-surface overflow-hidden">
        <div class="border-b border-slate-100 px-5 py-4 dark:border-slate-700">
          <h3 class="font-semibold text-slate-900 dark:text-white">Tableau récapitulatif</h3>
        </div>
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">Catégorie</th>
              <th class="text-center text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">Présent</th>
              <th class="text-center text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">% Présence</th>
              <th class="text-center text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">Prix respectés</th>
              <th class="text-center text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">% Prix</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="cat in productCategories" :key="cat.key" class="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{{ cat.label }}</td>
              <td class="px-4 py-3 text-center text-sm font-bold text-green-600">{{ catPresent(cat.key) }}</td>
              <td class="px-4 py-3 text-center">
                <div class="flex items-center justify-center gap-2">
                  <div class="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div class="h-full rounded-full" :style="{ width: catPct(cat.key) + '%', backgroundColor: cat.color }" />
                  </div>
                  <span class="text-xs font-medium text-gray-600">{{ catPct(cat.key) }}%</span>
                </div>
              </td>
              <td class="px-4 py-3 text-center text-sm font-bold text-red-600">{{ prixOui(cat.key) }}</td>
              <td class="px-4 py-3 text-center text-sm">
                {{ catPresent(cat.key) > 0 ? Math.round(prixOui(cat.key) / catPresent(cat.key) * 100) : 0 }}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const dashboard = useDashboardDirection()

const productCategories = [
  { key: 'evap', label: 'EVAP', color: '#3B82F6' },
  { key: 'imp', label: 'IMP', color: '#10B981' },
  { key: 'scm', label: 'SCM', color: '#F59E0B' },
  { key: 'uht', label: 'UHT', color: '#8B5CF6' },
  { key: 'yaourt', label: 'YAOURT', color: '#EC4899' },
  { key: 'cereales', label: 'CÉRÉALES', color: '#06B6D4' },
]

function catPresent(key: string) {
  return dashboard.countWhere(v => v.data?.produits?.[key]?.present)
}
function catAbsent(key: string) {
  return dashboard.totalVisites.value - catPresent(key)
}
function catPct(key: string) {
  return dashboard.pctWhere(v => v.data?.produits?.[key]?.present)
}
function prixOui(key: string) {
  return dashboard.countWhere(v =>
    v.data?.produits?.[key]?.present && v.data?.produits?.[key]?.prix_respectes
  )
}
function prixNon(key: string) {
  return catPresent(key) - prixOui(key)
}

onMounted(() => {
  Promise.all([dashboard.fetchVisites()])
})
</script>
