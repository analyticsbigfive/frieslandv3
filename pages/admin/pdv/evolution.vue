<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">PDV — ÉVOLUTION AJOUTS</h1>

    <DashboardFilters
      v-model="dashboard.filters.value"
      :zone-options="dashboard.availableZones.value"
      show-date-from
      show-date-to
      @filter="fetchPDV"
    />

    <div v-if="loading" class="flex items-center justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-fc-blue" />
    </div>

    <template v-else>
      <!-- KPI -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="PDV total" :value="String(totalPDV)" icon="i-heroicons-map-pin" color="blue" />
        <StatsCard title="Ajoutés (période)" :value="String(addedCount)" icon="i-heroicons-plus-circle" color="green" />
        <StatsCard title="Zones" :value="String(zonesCount)" icon="i-heroicons-globe-alt" color="purple" />
        <StatsCard title="Canaux" :value="String(canauxCount)" icon="i-heroicons-building-storefront" color="orange" />
      </div>

      <!-- Evolution chart -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Évolution des ajouts de PDV par semaine</h3>
        <ClientOnly>
          <ChartsVisitesLineChart
            v-if="evoData.length"
            title=""
            :data="evoData"
          />
        </ClientOnly>
      </div>

      <!-- Répartition par canal -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Par canal</h3>
          <ClientOnly>
            <ChartsPieChart
              v-if="canalBreakdown.labels.length"
              :labels="canalBreakdown.labels"
              :values="canalBreakdown.values"
              height="md"
              :show-percentages="true"
            />
          </ClientOnly>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Par catégorie</h3>
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
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const supabase = useSupabaseClient()
const dashboard = useDashboardDirection()

const loading = ref(false)
const pdvList = ref<any[]>([])

const totalPDV = computed(() => pdvList.value.length)
const addedCount = computed(() => pdvList.value.filter(p => p.date_creation).length)
const zonesCount = computed(() => new Set(pdvList.value.map(p => p.zone).filter(Boolean)).size)
const canauxCount = computed(() => new Set(pdvList.value.map(p => p.canal).filter(Boolean)).size)

const canalBreakdown = computed(() => {
  const counts = new Map<string, number>()
  pdvList.value.forEach(p => {
    const c = p.canal || 'Non défini'
    counts.set(c, (counts.get(c) || 0) + 1)
  })
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  return { labels: sorted.map(([k]) => k), values: sorted.map(([, v]) => v) }
})

const categorieBreakdown = computed(() => {
  const counts = new Map<string, number>()
  pdvList.value.forEach(p => {
    const c = p.categorie_pdv || 'Non défini'
    counts.set(c, (counts.get(c) || 0) + 1)
  })
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  return { labels: sorted.map(([k]) => k), values: sorted.map(([, v]) => v) }
})

const evoData = computed(() => {
  const weeks = new Map<string, number>()
  pdvList.value.forEach(p => {
    if (!p.date_creation) return
    const d = new Date(p.date_creation)
    const weekStart = new Date(d)
    weekStart.setDate(d.getDate() - d.getDay())
    const key = weekStart.toISOString().slice(0, 10)
    weeks.set(key, (weeks.get(key) || 0) + 1)
  })
  const sorted = [...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  return sorted.map(([k, v]) => ({
    date: new Date(k).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
    count: v,
  }))
})

async function fetchPDV() {
  loading.value = true
  try {
    let query = supabase
      .from('pdv')
      .select('pdv_id, nom_pdv, canal, categorie_pdv, zone, region, date_creation')
      .order('date_creation', { ascending: false })

    if (dashboard.filters.value.dateFrom) {
      query = query.gte('date_creation', dashboard.filters.value.dateFrom)
    }
    if (dashboard.filters.value.dateTo) {
      query = query.lte('date_creation', dashboard.filters.value.dateTo)
    }

    const { data } = await query
    pdvList.value = data || []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  Promise.all([dashboard.fetchZones(), fetchPDV()])
})
</script>
