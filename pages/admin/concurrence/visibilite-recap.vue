<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">VISIBILITÉ CONCURRENCE — RÉCAPITULATIF</h1>

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
      <div class="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
        <span>Total visites : <strong class="text-gray-900 dark:text-gray-100">{{ dashboard.totalVisites.value }}</strong></span>
        <span>Lignes affichées : <strong class="text-gray-900 dark:text-gray-100">{{ paginatedRows.length }}</strong></span>
      </div>

      <!-- Tableau récapitulatif -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-x-auto">
        <table class="w-full text-xs">
          <thead class="bg-gray-50 dark:bg-gray-700/50 sticky top-0">
            <tr>
              <th class="px-3 py-2 text-left font-semibold text-gray-600">Date</th>
              <th class="px-3 py-2 text-left font-semibold text-gray-600">PDV</th>
              <th class="px-3 py-2 text-left font-semibold text-gray-600">Canal</th>
              <th class="px-3 py-2 text-left font-semibold text-gray-600">Région</th>
              <th class="px-3 py-2 text-left font-semibold text-gray-600">Zone</th>
              <th class="px-3 py-2 text-left font-semibold text-gray-600">Commercial</th>
              <th v-for="m in marques" :key="m.key + '_ext'" class="px-2 py-2 text-center font-semibold" :class="m.textClass">
                {{ m.label }} Ext.
              </th>
              <th v-for="m in marques" :key="m.key + '_int'" class="px-2 py-2 text-center font-semibold" :class="m.textClass">
                {{ m.label }} Int.
              </th>
            </tr>
            <!-- Column filters -->
            <tr class="bg-gray-25">
              <th class="px-3 py-1"><UInput v-model="colFilters.date" size="2xs" placeholder="Filtrer..." class="w-20" /></th>
              <th class="px-3 py-1"><UInput v-model="colFilters.pdv" size="2xs" placeholder="Filtrer..." class="w-24" /></th>
              <th class="px-3 py-1">
                <USelectMenu v-model="colFilters.canal" :options="['', 'General trade', 'Modern trade']" size="2xs" class="w-24" />
              </th>
              <th class="px-3 py-1"><UInput v-model="colFilters.region" size="2xs" placeholder="Filtrer..." class="w-20" /></th>
              <th class="px-3 py-1"><UInput v-model="colFilters.zone" size="2xs" placeholder="Filtrer..." class="w-20" /></th>
              <th class="px-3 py-1"><UInput v-model="colFilters.commercial" size="2xs" placeholder="Filtrer..." class="w-20" /></th>
              <th v-for="m in marques" :key="m.key + '_ext_f'" class="px-2 py-1">
                <USelectMenu v-model="colFilters[m.key + '_ext']" :options="presenceOptions" size="2xs" class="w-16" />
              </th>
              <th v-for="m in marques" :key="m.key + '_int_f'" class="px-2 py-1">
                <USelectMenu v-model="colFilters[m.key + '_int']" :options="presenceOptions" size="2xs" class="w-16" />
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="row in paginatedRows" :key="row.visite_id" class="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td class="px-3 py-2 whitespace-nowrap">{{ formatDate(row.date_visite) }}</td>
              <td class="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{{ row.pdv?.nom_pdv || '—' }}</td>
              <td class="px-3 py-2">{{ row.pdv?.canal || '—' }}</td>
              <td class="px-3 py-2">{{ row.pdv?.region || '—' }}</td>
              <td class="px-3 py-2">{{ row.pdv?.zone || '—' }}</td>
              <td class="px-3 py-2">{{ row.commercial }}</td>
              <td v-for="m in marques" :key="m.key + '_ext_v'" class="px-2 py-2 text-center">
                <span
                  class="inline-block w-5 h-5 rounded-full text-white text-[10px] font-bold leading-5"
                  :class="getExtVal(row, m.key) ? 'bg-green-500' : 'bg-gray-300'"
                >
                  {{ getExtVal(row, m.key) ? '✓' : '—' }}
                </span>
              </td>
              <td v-for="m in marques" :key="m.key + '_int_v'" class="px-2 py-2 text-center">
                <span
                  class="inline-block w-5 h-5 rounded-full text-white text-[10px] font-bold leading-5"
                  :class="getIntVal(row, m.key) ? 'bg-green-500' : 'bg-gray-300'"
                >
                  {{ getIntVal(row, m.key) ? '✓' : '—' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <span>Page {{ page }} / {{ totalPages }}</span>
        <div class="flex gap-2">
          <UButton size="xs" variant="outline" :disabled="page <= 1" @click="page--">Précédent</UButton>
          <UButton size="xs" variant="outline" :disabled="page >= totalPages" @click="page++">Suivant</UButton>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const dashboard = useDashboardDirection()

const marques = [
  { key: 'nido', label: 'NIDO', textClass: 'text-red-600' },
  { key: 'laity', label: 'LAITY', textClass: 'text-orange-600' },
  { key: 'candia', label: 'CANDIA', textClass: 'text-green-600' },
  { key: 'autre', label: 'AUTRE', textClass: 'text-purple-600' },
]

const presenceOptions = ['', 'Présent', 'Absent']

const colFilters = reactive<Record<string, string>>({
  date: '',
  pdv: '',
  canal: '',
  region: '',
  zone: '',
  commercial: '',
  nido_ext: '',
  laity_ext: '',
  candia_ext: '',
  autre_ext: '',
  nido_int: '',
  laity_int: '',
  candia_int: '',
  autre_int: '',
})

const page = ref(1)
const perPage = 100

function getExtVal(row: any, marque: string) {
  const val = row.data?.visibilite?.concurrence?.exterieure?.[marque]
  return val === true || val === 'Présent'
}
function getIntVal(row: any, marque: string) {
  const val = row.data?.visibilite?.concurrence?.interieure?.[marque]
  return val === true || val === 'Présent'
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const filteredRows = computed(() => {
  let rows = dashboard.visites.value

  if (colFilters.date) rows = rows.filter(r => formatDate(r.date_visite).includes(colFilters.date))
  if (colFilters.pdv) rows = rows.filter(r => r.pdv?.nom_pdv?.toLowerCase().includes(colFilters.pdv.toLowerCase()))
  if (colFilters.canal) rows = rows.filter(r => r.pdv?.canal === colFilters.canal)
  if (colFilters.region) rows = rows.filter(r => r.pdv?.region?.toLowerCase().includes(colFilters.region.toLowerCase()))
  if (colFilters.zone) rows = rows.filter(r => r.pdv?.zone?.toLowerCase().includes(colFilters.zone.toLowerCase()))
  if (colFilters.commercial) rows = rows.filter(r => r.commercial?.toLowerCase().includes(colFilters.commercial.toLowerCase()))

  for (const m of marques) {
    const extFilter = colFilters[m.key + '_ext']
    if (extFilter) {
      rows = rows.filter(r => {
        const present = getExtVal(r, m.key)
        return extFilter === 'Présent' ? present : !present
      })
    }
    const intFilter = colFilters[m.key + '_int']
    if (intFilter) {
      rows = rows.filter(r => {
        const present = getIntVal(r, m.key)
        return intFilter === 'Présent' ? present : !present
      })
    }
  }

  return rows
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredRows.value.length / perPage)))
const paginatedRows = computed(() => {
  const start = (page.value - 1) * perPage
  return filteredRows.value.slice(start, start + perPage)
})

watch(filteredRows, () => { page.value = 1 })

onMounted(async () => {
  await dashboard.fetchZones()
  await dashboard.fetchVisites()
})
</script>
