<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">CONCURRENCE — ÉVOLUTION</h1>

    <DashboardFilters
      v-model="dashboard.filters.value"
      :zone-options="dashboard.availableZones.value"
      @filter="dashboard.fetchVisites()"
    />

    <div v-if="dashboard.loading.value" class="flex items-center justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-fc-blue" />
    </div>

    <template v-else>
      <!-- KPI -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total visites" :value="String(dashboard.totalVisites.value)" icon="i-heroicons-clipboard-document-list" color="blue" />
        <StatsCard title="Concurrence détectée" :value="concPct + '%'" icon="i-heroicons-exclamation-triangle" color="red" />
        <StatsCard title="Sans concurrent" :value="(100 - concPct) + '%'" icon="i-heroicons-shield-check" color="green" />
        <StatsCard title="Nb. avec concurrent" :value="String(concCount)" icon="i-heroicons-chart-bar" color="orange" />
      </div>

      <!-- Pie charts par catégorie: Présence/Absence -->
      <h2 class="text-lg font-bold text-gray-800">Présence concurrence par catégorie</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ClientOnly>
          <div v-for="cat in categories" :key="cat.key" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
            <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 text-center">{{ cat.label }}</h4>
            <ChartsPieChart
              :labels="['Absent', 'Présent']"
              :values="[catAbsent(cat.key), catPresent(cat.key)]"
              :colors="['#D1D5DB', '#EF4444']"
              height="sm"
              :show-percentages="true"
            />
          </div>
        </ClientOnly>
      </div>

      <!-- Détail concurrents par catégorie -->
      <h2 class="text-lg font-bold text-gray-800">Détail par concurrent</h2>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div v-for="cat in categories" :key="cat.key" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 class="font-bold text-gray-900 dark:text-gray-100 mb-4">{{ cat.label }}</h3>
          <div class="space-y-3">
            <div v-for="comp in cat.competitors" :key="comp.key" class="flex items-center justify-between">
              <span class="text-sm text-gray-700 dark:text-gray-300">{{ comp.label }}</span>
              <div class="flex items-center gap-2">
                <div class="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full"
                    :class="getCompPct(cat.key, comp.key) > 50 ? 'bg-red-500' : 'bg-orange-400'"
                    :style="{ width: getCompPct(cat.key, comp.key) + '%' }"
                  />
                </div>
                <span class="text-xs font-bold text-gray-600 w-10 text-right">{{ getCompPct(cat.key, comp.key) }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Evolution stacked bar chart -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Évolution de la concurrence par semaine</h3>
        <ClientOnly>
          <Bar v-if="evolutionChartData" :data="evolutionChartData" :options="chartOptions" />
        </ClientOnly>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Bar } from 'vue-chartjs'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const dashboard = useDashboardDirection()

const concCount = computed(() =>
  dashboard.countWhere(v => v.data?.concurrence?.presence_concurrents)
)
const concPct = computed(() =>
  dashboard.pctWhere(v => v.data?.concurrence?.presence_concurrents)
)

const categories = [
  {
    key: 'evap',
    label: 'Concurrent EVAP',
    competitors: [
      { key: 'cowmilk', label: 'Cowmilk' },
      { key: 'nido_150g', label: 'NIDO 150g' },
      { key: 'autre', label: 'Autre' },
    ],
  },
  {
    key: 'imp',
    label: 'Concurrent IMP',
    competitors: [
      { key: 'nido', label: 'Nido' },
      { key: 'laity', label: 'Laity' },
      { key: 'top_lait', label: 'Top Lait' },
      { key: 'autre', label: 'Autre' },
    ],
  },
  {
    key: 'scm',
    label: 'Concurrent SCM',
    competitors: [
      { key: 'top_saho', label: 'Top Saho' },
      { key: 'autre', label: 'Autre' },
    ],
  },
  {
    key: 'uht',
    label: 'Concurrent UHT',
    competitors: [
      { key: 'candia', label: 'Candia' },
      { key: 'autre', label: 'Autre' },
    ],
  },
]

function catPresent(catKey: string) {
  return dashboard.countWhere(v => v.data?.concurrence?.[catKey]?.present)
}
function catAbsent(catKey: string) {
  return dashboard.totalVisites.value - catPresent(catKey)
}

function getCompPct(catKey: string, compKey: string) {
  const withConc = dashboard.visites.value.filter(v => v.data?.concurrence?.[catKey]?.present)
  if (withConc.length === 0) return 0
  const count = withConc.filter(v => v.data?.concurrence?.[catKey]?.[compKey] === 'Présent').length
  return Math.round(count / withConc.length * 100)
}

const evolutionChartData = computed(() => {
  if (!dashboard.visites.value.length) return null

  const weeks = new Map<string, Record<string, number>>()
  const catKeys = categories.map(c => c.key)

  dashboard.visites.value.forEach(v => {
    const d = new Date(v.date_visite)
    const weekStart = new Date(d)
    weekStart.setDate(d.getDate() - d.getDay())
    const key = weekStart.toISOString().slice(0, 10)

    if (!weeks.has(key)) {
      weeks.set(key, Object.fromEntries(catKeys.map(k => [k, 0])))
    }
    const w = weeks.get(key)!
    for (const k of catKeys) {
      if (v.data?.concurrence?.[k]?.present) w[k]++
    }
  })

  const sorted = [...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B']

  return {
    labels: sorted.map(([k]) => new Date(k).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })),
    datasets: categories.map((cat, i) => ({
      label: cat.label,
      data: sorted.map(([, v]) => v[cat.key]),
      backgroundColor: colors[i],
    })),
  }
})

const chartOptions = {
  responsive: true,
  plugins: { legend: { position: 'top' as const } },
  scales: {
    x: { stacked: true },
    y: { stacked: true, beginAtZero: true },
  },
}

onMounted(async () => {
  await dashboard.fetchZones()
  await dashboard.fetchVisites()
})
</script>
