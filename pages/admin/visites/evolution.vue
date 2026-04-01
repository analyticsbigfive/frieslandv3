<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">VISITES — ÉVOLUTION</h1>

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
        <StatsCard title="GPS validé" :value="String(gpsOkCount)" icon="i-heroicons-map-pin" color="green" />
        <StatsCard title="Commerciaux" :value="String(commerciauxCount)" icon="i-heroicons-users" color="purple" />
        <StatsCard title="Période" :value="periodLabel" icon="i-heroicons-calendar" color="orange" />
      </div>

      <!-- Groupement -->
      <div class="flex items-center gap-3">
        <span class="text-sm text-gray-500 dark:text-gray-400">Grouper par :</span>
        <USelectMenu
          v-model="groupBy"
          :options="[
            { label: 'Par jour', value: 'day' },
            { label: 'Par semaine', value: 'week' },
            { label: 'Par mois', value: 'month' },
          ]"
          option-attribute="label"
          value-attribute="value"
          size="sm"
        />
      </div>

      <!-- Chart -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Nombre de visites par {{ groupByLabel }}</h3>
        <ClientOnly>
          <ChartsVisitesLineChart v-if="chartData.length" title="" :data="chartData" />
        </ClientOnly>
      </div>

      <!-- Table summary -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">Période</th>
              <th class="text-center text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">Nb visites</th>
              <th class="text-center text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">GPS validé</th>
              <th class="text-center text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3">Commerciaux</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="row in tableData" :key="row.period" class="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{{ row.period }}</td>
              <td class="px-4 py-3 text-center text-sm text-fc-blue font-bold">{{ row.count }}</td>
              <td class="px-4 py-3 text-center text-sm text-green-600">{{ row.gpsOk }}</td>
              <td class="px-4 py-3 text-center text-sm text-gray-600">{{ row.commerciaux }}</td>
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
const groupBy = ref('day')

const groupByLabel = computed(() => {
  if (groupBy.value === 'week') return 'semaine'
  if (groupBy.value === 'month') return 'mois'
  return 'jour'
})

const gpsOkCount = computed(() =>
  dashboard.visites.value.filter((v: any) => v.geofence_validated).length
)
const commerciauxCount = computed(() =>
  new Set(dashboard.visites.value.map(v => v.commercial).filter(Boolean)).size
)
const periodLabel = computed(() => {
  const f = dashboard.filters.value
  return f.dateFrom && f.dateTo ? `${f.dateFrom} → ${f.dateTo}` : '—'
})

function getWeek(d: Date) {
  const oneJan = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7)
}

const tableData = computed(() => {
  const groups = new Map<string, { count: number; gpsOk: number; commerciaux: Set<string> }>()

  dashboard.visites.value.forEach((v: any) => {
    const d = new Date(v.date_visite)
    let key = ''
    if (groupBy.value === 'day') key = d.toISOString().slice(0, 10)
    else if (groupBy.value === 'week') {
      const week = getWeek(d)
      key = `S${week} - ${d.getFullYear()}`
    }
    else key = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

    if (!groups.has(key)) groups.set(key, { count: 0, gpsOk: 0, commerciaux: new Set() })
    const g = groups.get(key)!
    g.count++
    if (v.geofence_validated) g.gpsOk++
    if (v.commercial) g.commerciaux.add(v.commercial)
  })

  return Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, g]) => ({
      period,
      count: g.count,
      gpsOk: g.gpsOk,
      commerciaux: g.commerciaux.size,
    }))
})

const chartData = computed(() =>
  tableData.value.map(r => ({ date: r.period, count: r.count }))
)

onMounted(() => {
  Promise.all([dashboard.fetchZones(), dashboard.fetchVisites()])
})
</script>
