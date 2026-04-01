<template>
  <div class="p-6 space-y-6">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Répartition des PDV</h1>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Par canal -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <h3 class="font-bold text-gray-900 dark:text-gray-100 mb-4">Répartition par canal</h3>
        <DistributionChart v-if="canalData" :data="canalData" />
      </div>

      <!-- Par zone -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <h3 class="font-bold text-gray-900 dark:text-gray-100 mb-4">Répartition par zone</h3>
        <DistributionChart v-if="zoneData" :data="zoneData" />
      </div>

      <!-- Par catégorie -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <h3 class="font-bold text-gray-900 dark:text-gray-100 mb-4">Répartition par catégorie</h3>
        <DistributionChart v-if="categorieData" :data="categorieData" />
      </div>

      <!-- Par région -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <h3 class="font-bold text-gray-900 dark:text-gray-100 mb-4">Répartition par région</h3>
        <DistributionChart v-if="regionData" :data="regionData" />
      </div>
    </div>

    <!-- Table detail -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
      <div class="p-4 border-b">
        <h3 class="font-bold text-gray-900 dark:text-gray-100">Détail par zone</h3>
      </div>
      <table class="w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">Zone</th>
            <th class="text-center text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">Nb PDV</th>
            <th class="text-center text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">%</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="row in zoneTable" :key="row.zone">
            <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{{ row.zone }}</td>
            <td class="px-4 py-3 text-center text-sm text-fc-blue font-bold">{{ row.count }}</td>
            <td class="px-4 py-3 text-center text-sm text-gray-600">{{ row.pct }}%</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const pdvStore = usePDVStore()
const allPDV = ref<any[]>([])

const colors = ['#003DA5', '#C8102E', '#FF6B35', '#00B894', '#6C5CE7', '#FDCB6E', '#636E72', '#0984E3', '#E17055', '#00CEC9']

function buildChartData(field: string) {
  const counts = new Map<string, number>()
  allPDV.value.forEach((p: any) => {
    const key = p[field] || 'Non défini'
    counts.set(key, (counts.get(key) || 0) + 1)
  })

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  return {
    labels: sorted.map(([k]) => k),
    datasets: [{
      data: sorted.map(([, v]) => v),
      backgroundColor: colors,
    }],
  }
}

const canalData = ref<any>(null)
const zoneData = ref<any>(null)
const categorieData = ref<any>(null)
const regionData = ref<any>(null)

const zoneTable = computed(() => {
  const counts = new Map<string, number>()
  allPDV.value.forEach((p: any) => {
    const key = p.zone || 'Non défini'
    counts.set(key, (counts.get(key) || 0) + 1)
  })
  const total = allPDV.value.length || 1
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([zone, count]) => ({ zone, count, pct: Math.round(count / total * 100) }))
})

onMounted(async () => {
  allPDV.value = await pdvStore.fetchAllPDV()
  canalData.value = buildChartData('canal')
  zoneData.value = buildChartData('zone')
  categorieData.value = buildChartData('categorie')
  regionData.value = buildChartData('region')
})
</script>
