<template>
  <div class="p-6 space-y-6">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Répartition des PDV</h1>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-fc-blue" />
      <span class="ml-3 text-gray-500">Chargement des données...</span>
    </div>

    <template v-else>
      <!-- KPI row -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 text-center">
          <p class="text-3xl font-bold text-fc-blue">{{ allPDV.length }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Total PDV actifs</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 text-center">
          <p class="text-3xl font-bold text-fc-red">{{ uniqueZones }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Zones</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 text-center">
          <p class="text-3xl font-bold text-emerald-600">{{ uniqueRegions }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Régions</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 text-center">
          <p class="text-3xl font-bold text-purple-600">{{ uniqueCanaux }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Canaux</p>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Par canal -->
        <ClientOnly>
          <DistributionChart title="Répartition par canal" :data="canalData" />
        </ClientOnly>

        <!-- Par zone -->
        <ClientOnly>
          <DistributionChart title="Répartition par zone" :data="zoneData" />
        </ClientOnly>

        <!-- Par catégorie -->
        <ClientOnly>
          <DistributionChart title="Répartition par catégorie" :data="categorieData" />
        </ClientOnly>

        <!-- Par région -->
        <ClientOnly>
          <DistributionChart title="Répartition par région" :data="regionData" />
        </ClientOnly>
      </div>

      <!-- Table detail -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div class="p-4 border-b border-gray-100 dark:border-gray-700">
          <h3 class="font-bold text-gray-900 dark:text-gray-100">Détail par zone</h3>
        </div>
        <table class="w-full">
          <thead class="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th class="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">Zone</th>
              <th class="text-center text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">Nb PDV</th>
              <th class="text-center text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">%</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr v-for="row in zoneTable" :key="row.zone" class="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{{ row.zone }}</td>
              <td class="px-4 py-3 text-center text-sm text-fc-blue font-bold">{{ row.count }}</td>
              <td class="px-4 py-3 text-center text-sm text-gray-600 dark:text-gray-400">{{ row.pct }}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const pdvStore = usePDVStore()
const allPDV = ref<any[]>([])
const loading = ref(true)

const uniqueZones = computed(() => new Set(allPDV.value.map(p => p.zone).filter(Boolean)).size)
const uniqueRegions = computed(() => new Set(allPDV.value.map(p => p.region).filter(Boolean)).size)
const uniqueCanaux = computed(() => new Set(allPDV.value.map(p => p.canal).filter(Boolean)).size)

function buildDistribution(field: string): { type: string; count: number }[] {
  const counts = new Map<string, number>()
  allPDV.value.forEach((p: any) => {
    const key = p[field] || 'Non défini'
    counts.set(key, (counts.get(key) || 0) + 1)
  })
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([type, count]) => ({ type, count }))
}

const canalData = computed(() => buildDistribution('canal'))
const zoneData = computed(() => buildDistribution('zone'))
const categorieData = computed(() => buildDistribution('categorie_pdv'))
const regionData = computed(() => buildDistribution('region'))

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
  try {
    allPDV.value = await pdvStore.fetchAllPDV()
  } catch (err) {
    console.error('Erreur chargement PDV:', err)
  } finally {
    loading.value = false
  }
})
</script>
