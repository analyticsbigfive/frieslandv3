<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">VISIBILITÉ INTÉRIEURE — ÉVOLUTION</h1>

    <DashboardFilters
      v-model="dashboard.filters.value"
      :zone-options="dashboard.availableZones.value"
      @filter="dashboard.fetchVisites()"
    />

    <!-- KPI + présence globale -->
    <div class="flex flex-wrap items-center gap-6">
      <div>
        <p class="text-sm text-gray-500 dark:text-gray-400">Présence de visibilité intérieure</p>
        <p class="text-3xl font-bold text-gray-900 dark:text-gray-100">{{ visIntCount }}</p>
      </div>
    </div>

    <!-- GT Pie charts -->
    <h2 class="text-lg font-bold text-gray-800">General trade</h2>
    <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
      <ClientOnly>
        <ChartsPieChart
          v-for="item in gtItems"
          :key="item.key"
          :title="item.label"
          :labels="['Absent', 'Présent']"
          :values="[countAbsent(item.key), countPresent(item.key)]"
          :colors="['#FB923C', '#F59E0B']"
          height="sm"
        />
      </ClientOnly>
    </div>

    <!-- MT Pie charts -->
    <h2 class="text-lg font-bold text-gray-800">Modern trade</h2>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <ClientOnly>
        <ChartsPieChart
          v-for="item in mtItems"
          :key="item.key"
          :title="item.label"
          :labels="['Absent', 'Présent']"
          :values="[countAbsent(item.key), countPresent(item.key)]"
          :colors="['#FB923C', '#EC4899']"
          height="sm"
        />
      </ClientOnly>
    </div>

    <!-- Evolution chart -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
      <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Évolution des visites avec visibilité intérieure</h3>
      <ClientOnly>
        <ChartsVisitesLineChart
          v-if="evolutionData.length"
          title=""
          :data="evolutionData"
        />
      </ClientOnly>
    </div>

    <div v-if="dashboard.loading.value" class="flex items-center justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-fc-blue" />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const dashboard = useDashboardDirection()

const visIntCount = computed(() =>
  dashboard.countWhere(v => v.data?.visibilite?.interieure?.presence_visibilite)
)

const gtItems = [
  { key: 'hanger', label: 'Hanger' },
  { key: 'maison_bonnet_rouge', label: 'Maison BR' },
  { key: 'reglettes', label: 'Réglettes' },
  { key: 'zone_chaude', label: 'Zone chaude' },
  { key: 'presentoirs', label: 'Présentoirs' },
  { key: 'bacs_pouch', label: 'Bacs à Pouch' },
  { key: 'produits_frigo', label: 'Prod. frigo' },
]

const mtItems = [
  { key: 'habillage_rayon', label: 'Habillage rayon' },
  { key: 'merchandising', label: 'Merchandising' },
  { key: 'tete_gondole', label: 'Tête de gondole' },
  { key: 'autre_interieure', label: 'Autre (MT)' },
]

function countPresent(key: string) {
  return dashboard.countWhere(v => (v.data?.visibilite?.interieure as any)?.[key])
}
function countAbsent(key: string) {
  return dashboard.totalVisites.value - countPresent(key)
}

const evolutionData = computed(() => {
  const evo = dashboard.evolutionParSemaine(
    v => v.data?.visibilite?.interieure?.presence_visibilite
  )
  return evo.labels.map((label, i) => ({ date: label, count: evo.counts[i] }))
})

onMounted(() => {
  Promise.all([dashboard.fetchZones(), dashboard.fetchVisites()])
})
</script>
