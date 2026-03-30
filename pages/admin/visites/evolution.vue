<template>
  <div class="p-6 space-y-6">
    <h1 class="text-2xl font-bold text-gray-900">Évolution des visites</h1>

    <div class="flex gap-3 items-center">
      <UInput v-model="dateFrom" type="date" size="sm" />
      <UInput v-model="dateTo" type="date" size="sm" />
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
      <UButton icon="i-heroicons-funnel" size="sm" @click="fetchData">Actualiser</UButton>
    </div>

    <!-- Chart -->
    <div class="bg-white rounded-xl shadow-sm p-6">
      <VisitesLineChart v-if="chartData" :data="chartData" />
      <p v-else class="text-center text-gray-400 py-10">Chargement...</p>
    </div>

    <!-- Table summary -->
    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="text-left text-xs font-medium text-gray-500 px-4 py-3">Période</th>
            <th class="text-center text-xs font-medium text-gray-500 px-4 py-3">Nb visites</th>
            <th class="text-center text-xs font-medium text-gray-500 px-4 py-3">GPS validé</th>
            <th class="text-center text-xs font-medium text-gray-500 px-4 py-3">Commerciaux</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="row in tableData" :key="row.period">
            <td class="px-4 py-3 text-sm font-medium text-gray-900">{{ row.period }}</td>
            <td class="px-4 py-3 text-center text-sm text-fc-blue font-bold">{{ row.count }}</td>
            <td class="px-4 py-3 text-center text-sm text-green-600">{{ row.gpsOk }}</td>
            <td class="px-4 py-3 text-center text-sm text-gray-600">{{ row.commerciaux }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const supabase = useSupabaseClient()

const dateFrom = ref(new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().slice(0, 10))
const dateTo = ref(new Date().toISOString().slice(0, 10))
const groupBy = ref('day')
const chartData = ref<any>(null)
const visites = ref<any[]>([])

const tableData = computed(() => {
  const groups = new Map<string, { count: number; gpsOk: number; commerciaux: Set<string> }>()

  visites.value.forEach((v: any) => {
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

  return Array.from(groups.entries()).map(([period, g]) => ({
    period,
    count: g.count,
    gpsOk: g.gpsOk,
    commerciaux: g.commerciaux.size,
  }))
})

function getWeek(d: Date) {
  const oneJan = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7)
}

async function fetchData() {
  const { data } = await supabase
    .from('visites')
    .select('visite_id, date_visite, commercial, geofence_validated')
    .gte('date_visite', dateFrom.value + 'T00:00:00')
    .lte('date_visite', dateTo.value + 'T23:59:59')
    .order('date_visite')

  visites.value = data || []

  // Build chart data
  const labels = tableData.value.map(r => r.period)
  const counts = tableData.value.map(r => r.count)

  chartData.value = {
    labels,
    datasets: [{
      label: 'Visites',
      data: counts,
      borderColor: '#003DA5',
      backgroundColor: 'rgba(0, 61, 165, 0.1)',
      fill: true,
      tension: 0.4,
    }],
  }
}

onMounted(fetchData)
</script>
