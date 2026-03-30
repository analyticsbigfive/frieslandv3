<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Visibilité</h1>
      <div class="flex gap-3">
        <UInput v-model="dateFrom" type="date" size="sm" />
        <UInput v-model="dateTo" type="date" size="sm" />
        <UButton icon="i-heroicons-funnel" size="sm" @click="fetchData">Filtrer</UButton>
      </div>
    </div>

    <!-- KPI -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatsCard label="Total visites" :value="String(total)" icon="i-heroicons-eye" color="blue" />
      <StatsCard label="Visibilité int. présente" :value="intPct + '%'" icon="i-heroicons-building-storefront" color="green" />
      <StatsCard label="Concurrence visible" :value="concPct + '%'" icon="i-heroicons-exclamation-triangle" color="red" />
    </div>

    <!-- Detail table -->
    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <div class="p-4 border-b">
        <h3 class="font-bold text-gray-900">Visibilité concurrence détail</h3>
      </div>
      <table class="w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="text-left text-xs font-medium text-gray-500 px-4 py-3">Concurrent</th>
            <th class="text-center text-xs font-medium text-gray-500 px-4 py-3">Extérieur</th>
            <th class="text-center text-xs font-medium text-gray-500 px-4 py-3">Intérieur</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="row in concurrenceRows" :key="row.name">
            <td class="px-4 py-3 text-sm font-medium text-gray-900">{{ row.name }}</td>
            <td class="px-4 py-3 text-center">
              <div class="flex items-center justify-center gap-2">
                <span class="text-sm font-bold" :class="row.extPct > 30 ? 'text-red-500' : 'text-green-600'">{{ row.extPct }}%</span>
              </div>
            </td>
            <td class="px-4 py-3 text-center">
              <span class="text-sm font-bold" :class="row.intPct > 30 ? 'text-red-500' : 'text-green-600'">{{ row.intPct }}%</span>
            </td>
          </tr>
        </tbody>
      </table>
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

const intPct = computed(() => {
  if (!total.value) return 0
  const count = visites.value.filter(v => v.data?.visibilite?.interieure?.presence_visibilite).length
  return Math.round(count / total.value * 100)
})

const concPct = computed(() => {
  if (!total.value) return 0
  const count = visites.value.filter(v => v.data?.visibilite?.concurrence?.presence_visibilite).length
  return Math.round(count / total.value * 100)
})

const concurrenceRows = computed(() => {
  const items = [
    { name: 'NIDO', extKey: 'nido_exterieur', intKey: 'nido_interieur' },
    { name: 'LAITY', extKey: 'laity_exterieur', intKey: 'laity_interieur' },
    { name: 'CANDIA', extKey: 'candia_exterieur', intKey: 'candia_interieur' },
  ]

  const withConc = visites.value.filter(v => v.data?.visibilite?.concurrence?.presence_visibilite)
  const denominator = withConc.length || 1

  return items.map(i => ({
    name: i.name,
    extPct: Math.round(withConc.filter(v => v.data?.visibilite?.concurrence?.[i.extKey]).length / denominator * 100),
    intPct: Math.round(withConc.filter(v => v.data?.visibilite?.concurrence?.[i.intKey]).length / denominator * 100),
  }))
})

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
