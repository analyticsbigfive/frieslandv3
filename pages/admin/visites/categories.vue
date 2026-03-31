<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold text-gray-900">VISITES — ÉVOLUTION PAR CATÉGORIE</h1>

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
      <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatsCard title="Total visites" :value="String(dashboard.totalVisites.value)" icon="i-heroicons-clipboard-document-list" color="blue" />
        <StatsCard title="General trade" :value="String(gtCount)" icon="i-heroicons-shopping-bag" color="green" />
        <StatsCard title="Modern trade" :value="String(mtCount)" icon="i-heroicons-building-storefront" color="purple" />
      </div>

      <!-- Pie Chart: GT vs MT -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 class="text-sm font-semibold text-gray-700 mb-4">Répartition par canal</h3>
          <ClientOnly>
            <ChartsPieChart
              :labels="['General trade', 'Modern trade', 'Autre']"
              :values="[gtCount, mtCount, autreCount]"
              :colors="['#3B82F6', '#10B981', '#9CA3AF']"
              height="md"
              :show-percentages="true"
            />
          </ClientOnly>
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 class="text-sm font-semibold text-gray-700 mb-4">Répartition par catégorie PDV</h3>
          <ClientOnly>
            <ChartsPieChart
              v-if="categorieBreakdown.labels.length"
              :labels="categorieBreakdown.labels"
              :values="categorieBreakdown.values"
              height="md"
              :show-percentages="true"
            />
          </ClientOnly>
        </div>
      </div>

      <!-- Stacked bar: Evolution par canal par semaine -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 class="text-sm font-semibold text-gray-700 mb-4">Évolution des visites par canal</h3>
        <ClientOnly>
          <Bar v-if="evoChartData" :data="evoChartData" :options="chartOptions" />
        </ClientOnly>
      </div>

      <!-- Table: par catégorie PDV -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="p-4 border-b">
          <h3 class="font-bold text-gray-900">Détail par catégorie de PDV</h3>
        </div>
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="text-left text-xs font-medium text-gray-500 px-4 py-3">Catégorie PDV</th>
              <th class="text-center text-xs font-medium text-gray-500 px-4 py-3">Nb visites</th>
              <th class="text-center text-xs font-medium text-gray-500 px-4 py-3">%</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="row in categorieRows" :key="row.name" class="hover:bg-gray-50">
              <td class="px-4 py-3 text-sm font-medium text-gray-900">{{ row.name }}</td>
              <td class="px-4 py-3 text-center text-sm font-bold text-fc-blue">{{ row.count }}</td>
              <td class="px-4 py-3 text-center">
                <div class="flex items-center justify-center gap-2">
                  <div class="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div class="h-full bg-fc-blue rounded-full" :style="{ width: row.pct + '%' }" />
                  </div>
                  <span class="text-xs font-medium text-gray-600">{{ row.pct }}%</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Bar } from 'vue-chartjs'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const dashboard = useDashboardDirection()

const gtCount = computed(() => dashboard.countWhere(v => v.pdv?.canal === 'General trade'))
const mtCount = computed(() => dashboard.countWhere(v => v.pdv?.canal === 'Modern trade'))
const autreCount = computed(() => dashboard.totalVisites.value - gtCount.value - mtCount.value)

const categorieBreakdown = computed(() => {
  const counts = new Map<string, number>()
  dashboard.visites.value.forEach(v => {
    const cat = v.pdv?.categorie_pdv || 'Non défini'
    counts.set(cat, (counts.get(cat) || 0) + 1)
  })
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  return {
    labels: sorted.map(([k]) => k),
    values: sorted.map(([, v]) => v),
  }
})

const categorieRows = computed(() => {
  const total = dashboard.totalVisites.value
  return categorieBreakdown.value.labels.map((name, i) => ({
    name,
    count: categorieBreakdown.value.values[i],
    pct: total > 0 ? Math.round(categorieBreakdown.value.values[i] / total * 100) : 0,
  }))
})

const evoChartData = computed(() => {
  if (!dashboard.visites.value.length) return null

  const weeks = new Map<string, { gt: number; mt: number; autre: number }>()

  dashboard.visites.value.forEach(v => {
    const d = new Date(v.date_visite)
    const weekStart = new Date(d)
    weekStart.setDate(d.getDate() - d.getDay())
    const key = weekStart.toISOString().slice(0, 10)

    if (!weeks.has(key)) weeks.set(key, { gt: 0, mt: 0, autre: 0 })
    const w = weeks.get(key)!
    if (v.pdv?.canal === 'General trade') w.gt++
    else if (v.pdv?.canal === 'Modern trade') w.mt++
    else w.autre++
  })

  const sorted = [...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0]))

  return {
    labels: sorted.map(([k]) => new Date(k).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })),
    datasets: [
      { label: 'General trade', data: sorted.map(([, v]) => v.gt), backgroundColor: '#3B82F6' },
      { label: 'Modern trade', data: sorted.map(([, v]) => v.mt), backgroundColor: '#10B981' },
      { label: 'Autre', data: sorted.map(([, v]) => v.autre), backgroundColor: '#9CA3AF' },
    ],
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
