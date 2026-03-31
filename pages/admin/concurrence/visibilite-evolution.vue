<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold text-gray-900">VISIBILITÉ CONCURRENCE — ÉVOLUTION</h1>

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
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard title="Total visites" :value="String(dashboard.totalVisites.value)" icon="i-heroicons-clipboard-document-list" color="blue" />
        <StatsCard title="Conc. extérieure" :value="String(concExtCount)" icon="i-heroicons-eye" color="red" />
        <StatsCard title="Conc. intérieure" :value="String(concIntCount)" icon="i-heroicons-eye-slash" color="orange" />
        <StatsCard title="% Ext. présent" :value="concExtPct + '%'" icon="i-heroicons-chart-bar" color="purple" />
      </div>

      <!-- Pie charts: Visibilité extérieure concurrence -->
      <h2 class="text-lg font-bold text-gray-800">Visibilité extérieure concurrence</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ClientOnly>
          <div v-for="item in concMarques" :key="item.key + '_ext'" class="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h4 class="text-xs font-semibold text-gray-500 mb-2 text-center">{{ item.label }} (Ext.)</h4>
            <ChartsPieChart
              :labels="['Absent', 'Présent']"
              :values="[countExtAbsent(item.key), countExtPresent(item.key)]"
              :colors="['#FB923C', item.color]"
              height="sm"
              :show-percentages="true"
            />
          </div>
        </ClientOnly>
      </div>

      <!-- Pie charts: Visibilité intérieure concurrence -->
      <h2 class="text-lg font-bold text-gray-800">Visibilité intérieure concurrence</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ClientOnly>
          <div v-for="item in concMarques" :key="item.key + '_int'" class="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h4 class="text-xs font-semibold text-gray-500 mb-2 text-center">{{ item.label }} (Int.)</h4>
            <ChartsPieChart
              :labels="['Absent', 'Présent']"
              :values="[countIntAbsent(item.key), countIntPresent(item.key)]"
              :colors="['#FB923C', item.color]"
              height="sm"
              :show-percentages="true"
            />
          </div>
        </ClientOnly>
      </div>

      <!-- Stacked bar chart: Evolution -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 class="text-sm font-semibold text-gray-700 mb-4">Évolution de la visibilité concurrence (extérieure)</h3>
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

const concMarques = [
  { key: 'nido', label: 'NIDO', color: '#EF4444' },
  { key: 'laity', label: 'LAITY', color: '#3B82F6' },
  { key: 'candia', label: 'CANDIA', color: '#10B981' },
  { key: 'autre', label: 'AUTRE', color: '#8B5CF6' },
]

const concExtCount = computed(() =>
  dashboard.countWhere(v => v.data?.visibilite?.concurrence?.exterieure?.presence)
)
const concIntCount = computed(() =>
  dashboard.countWhere(v => v.data?.visibilite?.concurrence?.interieure?.presence)
)
const concExtPct = computed(() =>
  dashboard.pctWhere(v => v.data?.visibilite?.concurrence?.exterieure?.presence)
)

function countExtPresent(marque: string) {
  return dashboard.countWhere(v =>
    v.data?.visibilite?.concurrence?.exterieure?.[marque] === true ||
    v.data?.visibilite?.concurrence?.exterieure?.[marque] === 'Présent'
  )
}
function countExtAbsent(marque: string) {
  return dashboard.totalVisites.value - countExtPresent(marque)
}

function countIntPresent(marque: string) {
  return dashboard.countWhere(v =>
    v.data?.visibilite?.concurrence?.interieure?.[marque] === true ||
    v.data?.visibilite?.concurrence?.interieure?.[marque] === 'Présent'
  )
}
function countIntAbsent(marque: string) {
  return dashboard.totalVisites.value - countIntPresent(marque)
}

// Stacked bar chart: par semaine, présence de chaque marque en ext.
const evolutionChartData = computed(() => {
  if (!dashboard.visites.value.length) return null

  const weeks = new Map<string, Record<string, number>>()

  dashboard.visites.value.forEach(v => {
    const d = new Date(v.date_visite)
    const weekStart = new Date(d)
    weekStart.setDate(d.getDate() - d.getDay())
    const key = weekStart.toISOString().slice(0, 10)

    if (!weeks.has(key)) {
      weeks.set(key, { nido: 0, laity: 0, candia: 0, autre: 0 })
    }
    const w = weeks.get(key)!
    for (const m of concMarques) {
      const val = v.data?.visibilite?.concurrence?.exterieure?.[m.key]
      if (val === true || val === 'Présent') w[m.key]++
    }
  })

  const sorted = [...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0]))

  return {
    labels: sorted.map(([k]) => {
      const d = new Date(k)
      return d.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })
    }),
    datasets: concMarques.map(m => ({
      label: m.label,
      data: sorted.map(([, v]) => v[m.key]),
      backgroundColor: m.color,
    })),
  }
})

const chartOptions = {
  responsive: true,
  plugins: {
    legend: { position: 'top' as const },
  },
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
