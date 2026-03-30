<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Concurrence</h1>
      <div class="flex gap-3">
        <UInput v-model="dateFrom" type="date" size="sm" />
        <UInput v-model="dateTo" type="date" size="sm" />
        <UButton icon="i-heroicons-funnel" size="sm" @click="fetchData">Filtrer</UButton>
      </div>
    </div>

    <!-- KPI -->
    <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
      <StatsCard label="Total visites" :value="String(total)" icon="i-heroicons-clipboard-document-list" color="blue" />
      <StatsCard label="Concurrence détectée" :value="concPct + '%'" icon="i-heroicons-exclamation-triangle" color="red" />
      <StatsCard label="Sans concurrent" :value="(100 - concPct) + '%'" icon="i-heroicons-shield-check" color="green" />
    </div>

    <!-- Par catégorie -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div v-for="cat in categories" :key="cat.key" class="bg-white rounded-xl shadow-sm p-6">
        <h3 class="font-bold text-gray-900 mb-4">{{ cat.label }}</h3>
        <div class="space-y-3">
          <div v-for="comp in cat.competitors" :key="comp.key" class="flex items-center justify-between">
            <span class="text-sm text-gray-700">{{ comp.label }}</span>
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
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const supabase = useSupabaseClient()

const dateFrom = ref(new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 10))
const dateTo = ref(new Date().toISOString().slice(0, 10))
const visites = ref<any[]>([])

const total = computed(() => visites.value.length)

const concPct = computed(() => {
  if (!total.value) return 0
  const count = visites.value.filter(v => v.data?.concurrence?.presence_concurrents).length
  return Math.round(count / total.value * 100)
})

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

function getCompPct(catKey: string, compKey: string) {
  const withConc = visites.value.filter(v => v.data?.concurrence?.[catKey]?.present)
  if (withConc.length === 0) return 0
  const count = withConc.filter(v => v.data?.concurrence?.[catKey]?.[compKey] === 'Présent').length
  return Math.round(count / withConc.length * 100)
}

async function fetchData() {
  const { data } = await supabase
    .from('visites')
    .select('visite_id, data, date_visite')
    .gte('date_visite', dateFrom.value + 'T00:00:00')
    .lte('date_visite', dateTo.value + 'T23:59:59')

  visites.value = data || []
}

onMounted(fetchData)
</script>
