<template>
  <div class="space-y-6">
    <header class="space-y-1">
      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-fc-red">Perfect Store · Visibilité</p>
      <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Visibilité extérieure — récapitulatif</h1>
      <p class="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
        Détail par PDV des éléments extérieurs mesurés (référentiel Perfect Store).
      </p>
    </header>

    <DashboardFilters
      v-model="dashboard.filters.value"
      @filter="dashboard.fetchVisites()"
    />

    <!-- KPI -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div class="admin-metric-tile">
        <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Visites analysées</p>
        <p class="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{{ filteredVisites.length }}</p>
      </div>
      <div class="admin-metric-tile">
        <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Au moins 1 élément présent</p>
        <p class="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{{ presCount }}</p>
      </div>
      <VisibilityPresenceTile :present="extTotals.present" :total="extTotals.applicable" />
    </div>

    <!-- Filtres par élément -->
    <div class="admin-toolbar">
      <p class="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">Filtrer par élément</p>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <UFormGroup v-for="col in extColumns" :key="col.code" :label="col.label" size="sm">
          <USelectMenu v-model="columnFilters[col.code]" :options="['', 'Présent', 'Absent']" placeholder="Tous" size="sm" />
        </UFormGroup>
      </div>
      <p v-if="!extColumns.length" class="text-sm text-slate-400">Aucun élément extérieur pour les segments des visites chargées.</p>
    </div>

    <!-- Table -->
    <section class="admin-surface overflow-hidden">
      <div class="flex items-center justify-between px-5 py-4">
        <h2 class="text-base font-semibold text-slate-900 dark:text-white">Détail par PDV</h2>
        <span class="text-xs tabular-nums text-slate-400">{{ filteredVisites.length }} PDV</span>
      </div>
      <div class="overflow-x-auto">
        <table class="admin-table" data-no-column-tools>
          <thead>
            <tr>
              <th class="cursor-pointer select-none" @click="sortBy = 'nom'; sortAsc = !sortAsc">
                PDV <span class="text-slate-400">{{ sortBy === 'nom' ? (sortAsc ? '▲' : '▼') : '' }}</span>
              </th>
              <th>Type</th>
              <th>Zone</th>
              <th>Quartier</th>
              <th v-for="col in extColumns" :key="col.code" class="text-center">{{ col.label }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in paginatedRows" :key="idx">
              <td class="font-medium text-slate-900 dark:text-slate-100">
                <div class="flex items-center gap-1.5">
                  <span class="max-w-[200px] truncate">{{ row.nom }}</span>
                  <PDVPhotoModal :pdv-id="row.pdv_id" :image-url="row.image_url" :pdv-name="row.nom" />
                </div>
              </td>
              <td>{{ row.type }}</td>
              <td>{{ row.zone }}</td>
              <td>{{ row.quartier }}</td>
              <td v-for="col in extColumns" :key="col.code + idx" class="text-center">
                <span v-if="!row.applicable[col.code]" class="text-slate-300 dark:text-slate-600">—</span>
                <UIcon
                  v-else
                  :name="row.standards[col.code] ? 'i-heroicons-check-circle-20-solid' : 'i-heroicons-x-mark-20-solid'"
                  class="h-4 w-4"
                  :class="row.standards[col.code] ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex items-center justify-between border-t border-slate-100 px-5 py-3 dark:border-slate-700">
        <p class="text-sm text-slate-500 dark:text-slate-400">{{ page * 100 - 99 }} - {{ Math.min(page * 100, filteredVisites.length) }} / {{ filteredVisites.length }}</p>
        <div class="flex gap-2">
          <UButton size="xs" variant="outline" :disabled="page <= 1" @click="page--">‹</UButton>
          <UButton size="xs" variant="outline" :disabled="page * 100 >= filteredVisites.length" @click="page++">›</UButton>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const dashboard = useDashboardDirection()
const { typePdvLabel, fetchTypePdvLabels } = useTypePdvLabels()
const { fetchElements, columns, applicable, standardsOf, hasPresence, elementTotals } = useVisibilityAggregation()
const page = ref(1)
const sortBy = ref('nom')
const sortAsc = ref(true)

const extColumns = computed(() => columns(dashboard.visites.value, 'exterieure'))
const columnFilters = reactive<Record<string, string>>({})

const filteredVisites = computed(() => dashboard.visites.value.filter((v) => {
  const std = standardsOf(v)
  for (const col of extColumns.value) {
    const f = columnFilters[col.code]
    if (f === 'Présent' && !std[col.code]) return false
    if (f === 'Absent' && std[col.code]) return false
  }
  return true
}))

const presCount = computed(() => filteredVisites.value.filter(v => hasPresence(v, 'exterieure')).length)
const extTotals = computed(() => elementTotals(filteredVisites.value, 'exterieure'))

const tableRows = computed(() => filteredVisites.value.map(v => ({
  nom: v.pdv?.nom_pdv || v.visite_id.substring(0, 8),
  pdv_id: v.pdv?.pdv_id || '',
  image_url: (v.pdv as any)?.image_url || null,
  type: typePdvLabel(v.pdv?.sous_categorie_pdv) || '',
  zone: v.pdv?.zone || '',
  quartier: v.pdv?.quartier || '',
  standards: standardsOf(v),
  applicable: applicable(v.pdv?.sous_categorie_pdv, 'exterieure'),
})).sort((a, b) => {
  const va = (a as any)[sortBy.value] || ''
  const vb = (b as any)[sortBy.value] || ''
  return sortAsc.value ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va))
}))

const paginatedRows = computed(() => tableRows.value.slice((page.value - 1) * 100, page.value * 100))

onMounted(() => {
  Promise.all([dashboard.fetchVisites(), fetchElements(), fetchTypePdvLabels()])
})
</script>
