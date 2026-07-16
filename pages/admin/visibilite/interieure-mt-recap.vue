<template>
  <div class="space-y-6">
    <header class="space-y-1">
      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-fc-red">Perfect Store · Visibilité</p>
      <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Visibilité intérieure (MT) — récapitulatif</h1>
      <p class="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
        Détail par PDV des éléments intérieurs mesurés (Modern trade · référentiel Perfect Store).
      </p>
    </header>

    <DashboardFilters
      v-model="dashboard.filters.value"
      :zone-options="dashboard.availableZones.value"
      @filter="dashboard.fetchVisites()"
    />

    <!-- KPI -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div class="admin-metric-tile">
        <p class="text-xs font-medium uppercase tracking-wide text-slate-400">PDV Modern trade</p>
        <p class="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{{ mtVisites.length }}</p>
      </div>
      <div class="admin-metric-tile">
        <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Avec visibilité intérieure</p>
        <p class="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{{ presCount }}</p>
      </div>
      <VisibilityPresenceTile :present="intTotals.present" :total="intTotals.applicable" />
    </div>

    <!-- Filtres par élément -->
    <div class="admin-toolbar">
      <p class="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">Filtrer par élément</p>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <UFormGroup v-for="col in intColumns" :key="col.code" :label="col.label" size="sm">
          <USelectMenu v-model="colFilters[col.code]" :options="['', 'Présent', 'Absent']" placeholder="Tous" size="sm" />
        </UFormGroup>
      </div>
      <p v-if="!intColumns.length" class="text-sm text-slate-400">Aucun élément intérieur pour les segments MT chargés.</p>
    </div>

    <!-- Table -->
    <section class="admin-surface overflow-hidden">
      <div class="flex items-center justify-between px-5 py-4">
        <h2 class="text-base font-semibold text-slate-900 dark:text-white">Détail par PDV</h2>
        <span class="text-xs tabular-nums text-slate-400">{{ filteredRows.length }} PDV</span>
      </div>
      <div class="overflow-x-auto">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Nom du PDV</th>
              <th>Région</th>
              <th>Zone</th>
              <th>Quartier</th>
              <th>Sous-cat.</th>
              <th v-for="col in intColumns" :key="col.code" class="text-center">{{ col.label }}</th>
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

      <div class="flex items-center justify-between border-t border-slate-100 px-5 py-3 dark:border-slate-700">
        <p class="text-sm text-slate-500 dark:text-slate-400">{{ (page - 1) * 100 + 1 }} - {{ Math.min(page * 100, filteredRows.length) }} / {{ filteredRows.length }}</p>
        <div class="flex gap-2">
          <UButton size="xs" variant="outline" :disabled="page <= 1" @click="page--">‹</UButton>
          <UButton size="xs" variant="outline" :disabled="page * 100 >= filteredRows.length" @click="page++">›</UButton>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const dashboard = useDashboardDirection()
const { fetchElements, columns, applicable, standardsOf, hasPresence, elementTotals } = useVisibilityAggregation()
const page = ref(1)

const mtVisites = computed(() => dashboard.visites.value.filter(v => isModernTrade(v.pdv?.canal)))
const presCount = computed(() => mtVisites.value.filter(v => hasPresence(v, 'interieure')).length)
const intTotals = computed(() => elementTotals(mtVisites.value, 'interieure'))

const intColumns = computed(() => columns(mtVisites.value, 'interieure'))
const colFilters = reactive<Record<string, string>>({})

const allRows = computed(() => mtVisites.value.map(v => ({
  nom: v.pdv?.nom_pdv || '',
  pdv_id: v.pdv?.pdv_id || '',
  image_url: (v.pdv as any)?.image_url || null,
  region: v.pdv?.region || '',
  zone: v.pdv?.zone || '',
  quartier: v.pdv?.quartier || '',
  sousCategorie: v.pdv?.sous_categorie_pdv || '',
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
  Promise.all([dashboard.fetchZones(), dashboard.fetchVisites(), fetchElements()])
})
</script>
