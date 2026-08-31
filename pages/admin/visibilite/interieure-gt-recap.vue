<template>
  <div class="space-y-6">
    <header class="space-y-1">
      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-fc-red">Perfect Store · Visibilité</p>
      <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Visibilité intérieure (GT) — récapitulatif</h1>
      <p class="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
        Détail par PDV des éléments intérieurs mesurés (General trade · référentiel Perfect Store).
      </p>
    </header>

    <DashboardFilters
      v-model="dashboard.filters.value"
      @filter="dashboard.fetchVisites()"
    />

    <!-- Filtres par élément -->
    <div class="admin-toolbar">
      <p class="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">Filtrer par élément</p>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <UFormGroup v-for="col in intColumns" :key="col.code" :label="col.label" size="sm">
          <USelectMenu v-model="colFilters[col.code]" :options="['', 'Présent', 'Absent']" placeholder="Tous" size="sm" />
        </UFormGroup>
      </div>
      <p v-if="!intColumns.length" class="text-sm text-slate-400">Aucun élément intérieur pour les segments GT chargés.</p>
    </div>

    <!-- Table -->
    <section class="admin-surface overflow-hidden">
      <div class="flex items-center justify-between px-5 py-4">
        <h2 class="text-base font-semibold text-slate-900 dark:text-white">Détail par PDV</h2>
        <span class="text-xs tabular-nums text-slate-400">{{ filteredRows.length }} PDV</span>
      </div>
      <div class="overflow-x-auto">
        <table class="admin-table" data-no-column-tools>
          <thead>
            <tr>
              <th class="whitespace-nowrap">Nom du PDV</th>
              <th>Région</th>
              <th>Zone</th>
              <th>Quartier</th>
              <th>Sous-cat.</th>
              <th>Merchandiser</th>
              <th v-for="col in intColumns" :key="col.code" class="whitespace-nowrap text-center">{{ col.label }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in paginatedRows" :key="idx">
              <td class="font-medium text-slate-900 dark:text-slate-100">
                <div class="flex items-center gap-1.5">
                  <span class="max-w-[180px] truncate">{{ row.nom }}</span>
                  <PDVPhotoModal :pdv-id="row.pdv_id" :image-url="row.image_url" :pdv-name="row.nom" />
                </div>
              </td>
              <td>{{ row.region }}</td>
              <td>{{ row.zone }}</td>
              <td>{{ row.quartier }}</td>
              <td>{{ row.sousCategorie }}</td>
              <td>{{ row.commercial }}</td>
              <td v-for="col in intColumns" :key="col.code + idx" class="text-center">
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

      <div class="border-t border-slate-100 px-5 py-3 dark:border-slate-700">
        <AdminPagination
          :total="filteredRows.length"
          :page="page"
          :page-size="100"
          item-label="ligne(s)"
          @update:page="(p) => page = p"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const dashboard = useDashboardDirection()
const { typePdvLabel, fetchTypePdvLabels } = useTypePdvLabels()
const { fetchElements, columns, applicable, standardsOf } = useVisibilityAggregation()
const page = ref(1)

const gtVisites = computed(() =>
  dashboard.visites.value.filter(v => !v.pdv?.canal || v.pdv.canal === 'General trade')
)

const intColumns = computed(() => columns(gtVisites.value, 'interieure'))
const colFilters = reactive<Record<string, string>>({})

const allRows = computed(() => gtVisites.value.map(v => ({
  nom: v.pdv?.nom_pdv || '',
  pdv_id: v.pdv?.pdv_id || '',
  image_url: (v.pdv as any)?.image_url || null,
  region: v.pdv?.region || '',
  zone: v.pdv?.zone || '',
  quartier: v.pdv?.quartier || '',
  sousCategorie: typePdvLabel(v.pdv?.sous_categorie_pdv) || '',
  commercial: v.commercial || '',
  standards: standardsOf(v),
  applicable: applicable(v.pdv?.sous_categorie_pdv, 'interieure'),
})))

const filteredRows = computed(() => allRows.value.filter(row => {
  for (const col of intColumns.value) {
    const cf = colFilters[col.code]
    if (cf === 'Présent' && !row.standards[col.code]) return false
    if (cf === 'Absent' && row.standards[col.code]) return false
  }
  return true
}))

const paginatedRows = computed(() => filteredRows.value.slice((page.value - 1) * 100, page.value * 100))

onMounted(() => {
  Promise.all([dashboard.fetchVisites(), fetchElements(), fetchTypePdvLabels()])
})
</script>
