<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Produits — {{ title }}</h1>
      <div class="flex gap-3">
        <UInput v-model="dateFrom" type="date" size="sm" />
        <UInput v-model="dateTo" type="date" size="sm" />
        <UButton icon="i-heroicons-funnel" size="sm" @click="fetchData">Filtrer</UButton>
      </div>
    </div>

    <!-- KPI Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatsCard
        v-for="kpi in kpis"
        :key="kpi.label"
        :label="kpi.label"
        :value="kpi.value"
        :icon="kpi.icon"
        :color="kpi.color"
      />
    </div>

    <!-- Product detail table -->
    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <div class="p-4 border-b">
        <h3 class="font-bold text-gray-900">Détail par produit</h3>
      </div>
      <table class="w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="text-left text-xs font-medium text-gray-500 px-4 py-3">Produit</th>
            <th class="text-center text-xs font-medium text-gray-500 px-4 py-3">Présent</th>
            <th class="text-center text-xs font-medium text-gray-500 px-4 py-3">En rupture</th>
            <th class="text-center text-xs font-medium text-gray-500 px-4 py-3">% Présence</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="row in productRows" :key="row.name">
            <td class="px-4 py-3 text-sm font-medium text-gray-900">{{ row.name }}</td>
            <td class="px-4 py-3 text-center text-sm text-green-600 font-bold">{{ row.present }}</td>
            <td class="px-4 py-3 text-center text-sm text-red-500 font-bold">{{ row.rupture }}</td>
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

    <!-- Prix respectes -->
    <div class="bg-white rounded-xl shadow-sm p-6">
      <h3 class="font-bold text-gray-900 mb-4">Prix respectés</h3>
      <div class="flex items-center gap-4">
        <div class="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
          <div class="h-full bg-green-500 rounded-full" :style="{ width: prixPct + '%' }" />
        </div>
        <span class="text-lg font-bold text-gray-900">{{ prixPct }}%</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const route = useRoute()
const supabase = useSupabaseClient()

const category = computed(() => (route.params.category as string) || 'evap')
const title = computed(() => category.value.toUpperCase())

const dateFrom = ref(new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 10))
const dateTo = ref(new Date().toISOString().slice(0, 10))

const visites = ref<any[]>([])

const productDefs: Record<string, { key: string; name: string }[]> = {
  evap: [
    { key: 'br_gold', name: 'BR Gold' },
    { key: 'br_160g', name: 'BR 150g' },
    { key: 'brb_160g', name: 'BRB 150g' },
    { key: 'br_400g', name: 'BR 380g' },
    { key: 'brb_400g', name: 'BRB 380g' },
    { key: 'pearl_400g', name: 'Pearl 380g' },
  ],
  imp: [
    { key: 'br_400g', name: 'BR 2' },
    { key: 'br_20g', name: 'BR 15g' },
    { key: 'brb_25g', name: 'BRB 16g' },
    { key: 'br_375g', name: 'BR 360g' },
    { key: 'br_900g', name: 'BR 400g Tin' },
    { key: 'brb_400g', name: 'BRB 360g' },
    { key: 'br_2_5kg', name: 'BR 900g Tin' },
    { key: 'brd_15g', name: 'BRD 15g' },
  ],
  scm: [
    { key: 'pearl_1kg', name: 'Pearl 1Kg' },
    { key: 'br_1kg', name: 'BR 1Kg' },
    { key: 'brb_1kg', name: 'BRB 1Kg' },
    { key: 'br_397g', name: 'BR 397g' },
    { key: 'brb_397g', name: 'BRB 397g' },
  ],
  uht: [
    { key: 'demi_ecreme', name: 'BR 516ml' },
    { key: 'elopack_500ml', name: 'Elopack 500ml' },
    { key: 'brique_1l', name: 'Brique 1L' },
  ],
  yaourt: [
    { key: 'br_yogoo_fraise_mini_90ml', name: 'Yogoo Fraise Mini 90ml' },
    { key: 'br_yogoo_fraise_maxi_318ml', name: 'Yogoo Fraise Maxi 318ml' },
    { key: 'br_yogoo_nature_mini_90ml', name: 'Yogoo Nature Mini 90ml' },
    { key: 'br_yogoo_nature_maxi_318ml', name: 'Yogoo Nature Maxi 318ml' },
  ],
}

const kpis = computed(() => {
  const total = visites.value.length
  const present = visites.value.filter(v => v.data?.produits?.[category.value]?.present).length
  const prixOk = visites.value.filter(v => v.data?.produits?.[category.value]?.prix_respectes).length

  return [
    { label: 'Total visites', value: String(total), icon: 'i-heroicons-clipboard-document-list', color: 'blue' },
    { label: `${title.value} Présent`, value: String(present), icon: 'i-heroicons-check-circle', color: 'green' },
    { label: '% Présence', value: total ? Math.round(present / total * 100) + '%' : '0%', icon: 'i-heroicons-chart-bar', color: 'purple' },
    { label: 'Prix respectés', value: present ? Math.round(prixOk / present * 100) + '%' : '0%', icon: 'i-heroicons-currency-euro', color: 'orange' },
  ]
})

const productRows = computed(() => {
  const prods = productDefs[category.value] || []
  const cat = category.value
  const visitesWithCat = visites.value.filter(v => v.data?.produits?.[cat]?.present)

  return prods.map(p => {
    const total = visitesWithCat.length
    const present = visitesWithCat.filter(v => v.data?.produits?.[cat]?.[p.key] === 'Présent').length
    const rupture = total - present
    return {
      name: p.name,
      present,
      rupture,
      pct: total > 0 ? Math.round(present / total * 100) : 0,
    }
  })
})

const prixPct = computed(() => {
  const cat = category.value
  const withPresent = visites.value.filter(v => v.data?.produits?.[cat]?.present)
  if (withPresent.length === 0) return 0
  const prixOk = withPresent.filter(v => v.data?.produits?.[cat]?.prix_respectes).length
  return Math.round(prixOk / withPresent.length * 100)
})

async function fetchData() {
  const { data } = await supabase
    .from('visites')
    .select('visite_id, data, date_visite')
    .gte('date_visite', dateFrom.value + 'T00:00:00')
    .lte('date_visite', dateTo.value + 'T23:59:59')
    .order('date_visite', { ascending: false })

  visites.value = data || []
}

onMounted(fetchData)
</script>
