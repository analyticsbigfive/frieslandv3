<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">VISIBILITÉ CONCURRENCE — ÉVOLUTION</h1>

    <DashboardFilters
      v-model="dashboard.filters.value"
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
      <h2 class="text-lg font-bold text-gray-800 dark:text-gray-100">Visibilité extérieure concurrence</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ClientOnly>
          <div v-for="item in concMarques" :key="item.key + '_ext'" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
            <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 text-center">{{ item.label }} (Ext.)</h4>
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
      <h2 class="text-lg font-bold text-gray-800 dark:text-gray-100">Visibilité intérieure concurrence</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ClientOnly>
          <div v-for="item in concMarques" :key="item.key + '_int'" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
            <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 text-center">{{ item.label }} (Int.)</h4>
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
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Évolution de la visibilité concurrence (extérieure)</h3>
        <ClientOnly>
          <Bar v-if="evolutionChartData" :data="evolutionChartData" :options="chartOptions" />
        </ClientOnly>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Bar } from 'vue-chartjs'
import { visibiliteConcurrencePresente } from '~/utils/concurrence'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const dashboard = useDashboardDirection()

// Marques du référentiel (lot 6), même liste que l'étape 9/11 du wizard.
const { marquesVisibilite, charger: chargerMarques } = useMarquesConcurrentes()
const COLORS = ['#EF4444', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4']
const concMarques = computed(() =>
  marquesVisibilite.value.map((m, i) => ({ key: m.cle, label: m.nom.toUpperCase(), color: COLORS[i % COLORS.length] })),
)

// Présence d'au moins une marque à l'emplacement, dans les deux formats
// (indicateur `presence` écrit depuis septembre 2026, clés plates avant).
function presenceEmplacement(v: any, emplacement: 'exterieure' | 'interieure') {
  const conc = v.data?.visibilite?.concurrence
  if (conc?.[emplacement]?.presence === true) return true
  return concMarques.value.some(m => visibiliteConcurrencePresente(conc, emplacement, m.key))
}

const concExtCount = computed(() => dashboard.countWhere(v => presenceEmplacement(v, 'exterieure')))
const concIntCount = computed(() => dashboard.countWhere(v => presenceEmplacement(v, 'interieure')))
const concExtPct = computed(() => dashboard.pctWhere(v => presenceEmplacement(v, 'exterieure')))

function countExtPresent(marque: string) {
  return dashboard.countWhere(v => visibiliteConcurrencePresente(v.data?.visibilite?.concurrence, 'exterieure', marque))
}
function countExtAbsent(marque: string) {
  return dashboard.totalVisites.value - countExtPresent(marque)
}

function countIntPresent(marque: string) {
  return dashboard.countWhere(v => visibiliteConcurrencePresente(v.data?.visibilite?.concurrence, 'interieure', marque))
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
      weeks.set(key, Object.fromEntries(concMarques.value.map(m => [m.key, 0])))
    }
    const w = weeks.get(key)!
    for (const m of concMarques.value) {
      if (visibiliteConcurrencePresente(v.data?.visibilite?.concurrence, 'exterieure', m.key)) w[m.key]++
    }
  })

  const sorted = [...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0]))

  return {
    labels: sorted.map(([k]) => {
      const d = new Date(k)
      return d.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })
    }),
    datasets: concMarques.value.map(m => ({
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

onMounted(() => {
  Promise.all([dashboard.fetchVisites(), chargerMarques()])
})
</script>
