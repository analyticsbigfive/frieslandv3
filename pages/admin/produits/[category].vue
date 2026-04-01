<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">PRODUITS — {{ title }}</h1>

    <DashboardFilters
      v-model="dashboard.filters.value"
      :zone-options="dashboard.availableZones.value"
      @filter="dashboard.fetchVisites()"
    />

    <!-- Tabs -->
    <div class="flex gap-1 bg-gray-100 rounded-lg p-1">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors"
        :class="activeTab === t.key ? 'bg-white dark:bg-gray-800 shadow text-fc-blue' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300'"
        @click="activeTab = t.key"
      >
        {{ t.label }}
      </button>
    </div>

    <div v-if="dashboard.loading.value" class="flex items-center justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-fc-blue" />
    </div>

    <template v-else>
      <!-- ======= TAB: DISPONIBILITÉS ======= -->
      <template v-if="activeTab === 'dispo'">
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Total visites" :value="String(dashboard.totalVisites.value)" icon="i-heroicons-clipboard-document-list" color="blue" />
          <StatsCard :title="title + ' présent'" :value="String(catPresentCount)" icon="i-heroicons-check-circle" color="green" />
          <StatsCard title="% Présence" :value="catPresentPct + '%'" icon="i-heroicons-chart-bar" color="purple" />
          <StatsCard title="Prix respectés" :value="prixPct + '%'" icon="i-heroicons-currency-euro" color="orange" />
        </div>

        <!-- Pie charts par produit: Présent/Absent -->
        <h2 class="text-lg font-bold text-gray-800">Disponibilité par SKU</h2>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <ClientOnly>
            <div v-for="prod in prods" :key="prod.key" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
              <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 text-center truncate">{{ prod.name }}</h4>
              <ChartsPieChart
                :labels="['En rupture', 'Présent']"
                :values="[prodRupture(prod.key), prodPresent(prod.key)]"
                :colors="['#EF4444', '#3B82F6']"
                height="sm"
                :show-percentages="true"
              />
            </div>
          </ClientOnly>
        </div>

        <!-- Évolution -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Évolution de la disponibilité {{ title }}</h3>
          <ClientOnly>
            <ChartsVisitesLineChart
              v-if="evoData.length"
              title=""
              :data="evoData"
            />
          </ClientOnly>
        </div>
      </template>

      <!-- ======= TAB: PRIX ======= -->
      <template v-if="activeTab === 'prix'">
        <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatsCard title="Visites avec produit" :value="String(catPresentCount)" icon="i-heroicons-clipboard-document-list" color="blue" />
          <StatsCard title="Prix respectés" :value="prixPct + '%'" icon="i-heroicons-check-circle" color="green" />
          <StatsCard title="Prix non respectés" :value="(100 - prixPct) + '%'" icon="i-heroicons-x-circle" color="red" />
        </div>

        <!-- Pie chart global prix -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Prix respectés — {{ title }}</h3>
            <ClientOnly>
              <ChartsPieChart
                :labels="['Non respecté', 'Respecté']"
                :values="[prixNonRespecte, prixRespecte]"
                :colors="['#EF4444', '#10B981']"
                height="md"
                :show-percentages="true"
              />
            </ClientOnly>
          </div>
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Évolution prix respectés</h3>
            <ClientOnly>
              <ChartsVisitesLineChart
                v-if="prixEvoData.length"
                title=""
                :data="prixEvoData"
              />
            </ClientOnly>
          </div>
        </div>
      </template>

      <!-- ======= TAB: RÉCAPITULATIF ======= -->
      <template v-if="activeTab === 'recap'">
        <div class="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
          <span>Total : <strong class="text-gray-900 dark:text-gray-100">{{ filteredRecap.length }}</strong> lignes</span>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-x-auto">
          <table class="w-full text-xs">
            <thead class="bg-gray-50 dark:bg-gray-700/50 sticky top-0">
              <tr>
                <th class="px-3 py-2 text-left font-semibold text-gray-600">Date</th>
                <th class="px-3 py-2 text-left font-semibold text-gray-600">PDV</th>
                <th class="px-3 py-2 text-left font-semibold text-gray-600">Canal</th>
                <th class="px-3 py-2 text-left font-semibold text-gray-600">Région</th>
                <th class="px-3 py-2 text-left font-semibold text-gray-600">Commercial</th>
                <th class="px-3 py-2 text-center font-semibold text-gray-600">Cat. présent</th>
                <th class="px-3 py-2 text-center font-semibold text-gray-600">Prix OK</th>
                <th v-for="prod in prods" :key="prod.key" class="px-2 py-2 text-center font-semibold text-gray-600 whitespace-nowrap">
                  {{ prod.name }}
                </th>
              </tr>
              <!-- Column filters -->
              <tr class="bg-gray-25">
                <th class="px-3 py-1"><UInput v-model="recapFilters.date" size="2xs" placeholder="..." class="w-20" /></th>
                <th class="px-3 py-1"><UInput v-model="recapFilters.pdv" size="2xs" placeholder="..." class="w-24" /></th>
                <th class="px-3 py-1">
                  <USelectMenu v-model="recapFilters.canal" :options="['', 'General trade', 'Modern trade']" size="2xs" class="w-24" />
                </th>
                <th class="px-3 py-1"><UInput v-model="recapFilters.region" size="2xs" placeholder="..." class="w-20" /></th>
                <th class="px-3 py-1">
                  <USelectMenu v-model="recapFilters.commercial" :options="commercialColOptions" size="2xs" class="w-24" searchable searchable-placeholder="..." value-attribute="value" option-attribute="label" />
                </th>
                <th class="px-3 py-1">
                  <USelectMenu v-model="recapFilters.present" :options="['', 'Oui', 'Non']" size="2xs" class="w-16" />
                </th>
                <th class="px-3 py-1">
                  <USelectMenu v-model="recapFilters.prix" :options="['', 'Oui', 'Non']" size="2xs" class="w-16" />
                </th>
                <th v-for="prod in prods" :key="prod.key + '_f'" class="px-2 py-1" />
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="row in paginatedRecap" :key="row.visite_id" class="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td class="px-3 py-2 whitespace-nowrap">{{ formatDate(row.date_visite) }}</td>
                <td class="px-3 py-2 font-medium text-gray-900 dark:text-gray-100 max-w-[200px]">
                  <div class="flex items-center gap-1">
                    <span class="truncate">{{ row.pdv?.nom_pdv || '—' }}</span>
                    <PDVPhotoModal v-if="row.pdv?.pdv_id" :pdv-id="row.pdv.pdv_id" :pdv-name="row.pdv.nom_pdv" />
                  </div>
                </td>
                <td class="px-3 py-2">{{ row.pdv?.canal || '—' }}</td>
                <td class="px-3 py-2">{{ row.pdv?.region || '—' }}</td>
                <td class="px-3 py-2">{{ row.commercial }}</td>
                <td class="px-3 py-2 text-center">
                  <span class="inline-block w-5 h-5 rounded-full text-white text-[10px] font-bold leading-5"
                    :class="row.data?.produits?.[cat]?.present ? 'bg-green-500' : 'bg-gray-300'">
                    {{ row.data?.produits?.[cat]?.present ? '✓' : '—' }}
                  </span>
                </td>
                <td class="px-3 py-2 text-center">
                  <span class="inline-block w-5 h-5 rounded-full text-white text-[10px] font-bold leading-5"
                    :class="row.data?.produits?.[cat]?.prix_respectes ? 'bg-green-500' : 'bg-gray-300'">
                    {{ row.data?.produits?.[cat]?.prix_respectes ? '✓' : '—' }}
                  </span>
                </td>
                <td v-for="prod in prods" :key="prod.key + '_v'" class="px-2 py-2 text-center">
                  <span
                    class="inline-block w-5 h-5 rounded-full text-white text-[10px] font-bold leading-5"
                    :class="row.data?.produits?.[cat]?.[prod.key] === 'Présent' ? 'bg-red-500' : 'bg-gray-300'"
                  >
                    {{ row.data?.produits?.[cat]?.[prod.key] === 'Présent' ? '✓' : '—' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>Page {{ recapPage }} / {{ recapTotalPages }}</span>
          <div class="flex gap-2">
            <UButton size="xs" variant="outline" :disabled="recapPage <= 1" @click="recapPage--">Précédent</UButton>
            <UButton size="xs" variant="outline" :disabled="recapPage >= recapTotalPages" @click="recapPage++">Suivant</UButton>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const route = useRoute()
const dashboard = useDashboardDirection()
const { users: cachedUsers, fetchUsers: fetchCachedUsers } = useUsersCache()

const commercialColOptions = computed(() => [
  { value: '', label: 'Tous' },
  ...new Set(dashboard.visites.value.map(v => v.commercial).filter(Boolean))
].map(v => typeof v === 'string' ? { value: v, label: v } : v))

const cat = computed(() => (route.params.category as string) || 'evap')
const title = computed(() => cat.value.toUpperCase())

// Tab management
const tabs = [
  { key: 'dispo', label: 'Disponibilités' },
  { key: 'prix', label: 'Prix' },
  { key: 'recap', label: 'Récapitulatif' },
]
const activeTab = ref((route.query.tab as string) || 'dispo')

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
  cereales: [
    { key: 'br_cereales_500g', name: 'Céréales 500g' },
    { key: 'br_cereales_1kg', name: 'Céréales 1Kg' },
  ],
}

const prods = computed(() => productDefs[cat.value] || [])

// --- DISPONIBILITÉS ---
const catPresentCount = computed(() =>
  dashboard.countWhere(v => v.data?.produits?.[cat.value]?.present)
)
const catPresentPct = computed(() =>
  dashboard.pctWhere(v => v.data?.produits?.[cat.value]?.present)
)

function prodPresent(prodKey: string) {
  return dashboard.visites.value.filter(v =>
    v.data?.produits?.[cat.value]?.present && v.data?.produits?.[cat.value]?.[prodKey] === 'Présent'
  ).length
}
function prodRupture(prodKey: string) {
  const withCat = dashboard.visites.value.filter(v => v.data?.produits?.[cat.value]?.present)
  return withCat.length - prodPresent(prodKey)
}

const evoData = computed(() => {
  const evo = dashboard.evolutionParSemaine(v => v.data?.produits?.[cat.value]?.present)
  return evo.labels.map((label, i) => ({ date: label, count: evo.counts[i] }))
})

// --- PRIX ---
const prixRespecte = computed(() =>
  dashboard.visites.value.filter(v =>
    v.data?.produits?.[cat.value]?.present && v.data?.produits?.[cat.value]?.prix_respectes
  ).length
)
const prixNonRespecte = computed(() => catPresentCount.value - prixRespecte.value)
const prixPct = computed(() =>
  catPresentCount.value > 0 ? Math.round(prixRespecte.value / catPresentCount.value * 100) : 0
)

const prixEvoData = computed(() => {
  const evo = dashboard.evolutionParSemaine(v =>
    v.data?.produits?.[cat.value]?.present && v.data?.produits?.[cat.value]?.prix_respectes
  )
  return evo.labels.map((label, i) => ({ date: label, count: evo.counts[i] }))
})

// --- RÉCAPITULATIF ---
const recapFilters = reactive({
  date: '',
  pdv: '',
  canal: '',
  region: '',
  commercial: '',
  present: '',
  prix: '',
})
const recapPage = ref(1)
const perPage = 100

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const filteredRecap = computed(() => {
  let rows = dashboard.visites.value

  if (recapFilters.date) rows = rows.filter(r => formatDate(r.date_visite).includes(recapFilters.date))
  if (recapFilters.pdv) rows = rows.filter(r => r.pdv?.nom_pdv?.toLowerCase().includes(recapFilters.pdv.toLowerCase()))
  if (recapFilters.canal) rows = rows.filter(r => r.pdv?.canal === recapFilters.canal)
  if (recapFilters.region) rows = rows.filter(r => r.pdv?.region?.toLowerCase().includes(recapFilters.region.toLowerCase()))
  if (recapFilters.commercial) rows = rows.filter(r => r.commercial?.toLowerCase().includes(recapFilters.commercial.toLowerCase()))
  if (recapFilters.present) {
    rows = rows.filter(r => {
      const p = !!r.data?.produits?.[cat.value]?.present
      return recapFilters.present === 'Oui' ? p : !p
    })
  }
  if (recapFilters.prix) {
    rows = rows.filter(r => {
      const p = !!r.data?.produits?.[cat.value]?.prix_respectes
      return recapFilters.prix === 'Oui' ? p : !p
    })
  }

  return rows
})

const recapTotalPages = computed(() => Math.max(1, Math.ceil(filteredRecap.value.length / perPage)))
const paginatedRecap = computed(() => {
  const start = (recapPage.value - 1) * perPage
  return filteredRecap.value.slice(start, start + perPage)
})

watch(filteredRecap, () => { recapPage.value = 1 })

// Watch route changes
watch(() => route.params.category, () => {
  activeTab.value = (route.query.tab as string) || 'dispo'
  dashboard.fetchVisites()
})

watch(() => route.query.tab, (tab) => {
  if (tab) activeTab.value = tab as string
})

onMounted(() => {
  fetchCachedUsers()
  Promise.all([dashboard.fetchZones(), dashboard.fetchVisites()])
})
</script>
