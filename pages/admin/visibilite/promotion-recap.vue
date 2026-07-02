<template>
  <div class="space-y-6">
    <header class="space-y-1">
      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-fc-red">Perfect Store · Visibilité</p>
      <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Promotion — récapitulatif</h1>
      <p class="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
        Éléments de promotion mesurés (pilier <code class="rounded bg-slate-100 px-1 py-0.5 text-[11px] dark:bg-slate-700">promotion</code> du référentiel Perfect Store).
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
        <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Promotion applicable</p>
        <p class="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{{ promoApplicableCount }}</p>
      </div>
      <div class="admin-metric-tile">
        <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Au moins 1 élément présent</p>
        <p class="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{{ promoPresenceCount }}</p>
      </div>
      <VisibilityPresenceTile :present="promoTotals.present" :total="promoTotals.applicable" />
    </div>

    <section class="admin-surface p-5 sm:p-6">
      <div class="mb-5 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-700">
        <h2 class="text-base font-semibold text-slate-900 dark:text-white">General trade</h2>
        <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium tabular-nums text-slate-500 dark:bg-slate-700 dark:text-slate-300">{{ gtCount }} visites</span>
      </div>
      <div v-if="gtElements.length" class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <VisibilityStatTile v-for="el in gtElements" :key="'gt-' + el.code" :label="el.label" :present="el.present" :total="el.applicable" />
      </div>
      <p v-else class="text-sm text-slate-400">Aucune visite General trade sur la période.</p>
    </section>

    <section class="admin-surface p-5 sm:p-6">
      <div class="mb-5 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-700">
        <h2 class="text-base font-semibold text-slate-900 dark:text-white">Modern trade</h2>
        <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium tabular-nums text-slate-500 dark:bg-slate-700 dark:text-slate-300">{{ mtCount }} visites</span>
      </div>
      <div v-if="mtElements.length" class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <VisibilityStatTile v-for="el in mtElements" :key="'mt-' + el.code" :label="el.label" :present="el.present" :total="el.applicable" />
      </div>
      <p v-else class="text-sm text-slate-400">Aucune visite Modern trade sur la période.</p>
    </section>

    <!-- Conformité par niveau (éléments requis, aligné score PS) -->
    <section class="admin-surface p-5 sm:p-6">
      <div class="mb-1 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-700">
        <h2 class="text-base font-semibold text-slate-900 dark:text-white">Conformité par niveau — promotion</h2>
        <span class="text-xs text-slate-400">éléments requis · promo applicable</span>
      </div>
      <p class="mb-4 mt-3 text-xs text-slate-500 dark:text-slate-400">
        Part des PDV (promotion applicable) dont <strong>tous</strong> les éléments promo <em>requis</em> du niveau sont présents (gate = 100 %).
      </p>
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <VisibilityLevelCard
          v-for="lvl in promoConformity"
          :key="lvl.key"
          :level-key="lvl.key"
          :label="lvl.label"
          :gate-pass-pct="lvl.gatePassPct"
          :avg-rate="lvl.avgRate"
          :total="lvl.total"
        />
      </div>
    </section>

    <!-- Détail par PDV -->
    <section class="admin-surface overflow-hidden">
      <div class="flex items-center justify-between px-5 py-4">
        <h2 class="text-base font-semibold text-slate-900 dark:text-white">Détail par PDV</h2>
        <span class="text-xs tabular-nums text-slate-400">{{ tableRows.length }} visites</span>
      </div>
      <div class="overflow-x-auto">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Nom du PDV</th>
              <th>Zone</th>
              <th>Sous-catégorie</th>
              <th class="text-center">Promo applicable</th>
              <th v-for="col in promoColumns" :key="col.code" class="text-center">{{ col.label }}</th>
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
              <td>{{ row.zone }}</td>
              <td>{{ row.sousCategorie }}</td>
              <td class="text-center">
                <span
                  class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="row.promoApplicable ? 'bg-fc-blue-light text-fc-red' : 'bg-slate-100 text-slate-400 dark:bg-slate-700'"
                >
                  {{ row.promoApplicable ? 'Oui' : 'Non' }}
                </span>
              </td>
              <td v-for="col in promoColumns" :key="col.code + idx" class="text-center">
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
        <p class="text-sm text-slate-500 dark:text-slate-400">{{ (page - 1) * 100 + 1 }} - {{ Math.min(page * 100, tableRows.length) }} / {{ tableRows.length }}</p>
        <div class="flex gap-2">
          <UButton size="xs" variant="outline" :disabled="page <= 1" @click="page--">‹</UButton>
          <UButton size="xs" variant="outline" :disabled="page * 100 >= tableRows.length" @click="page++">›</UButton>
        </div>
      </div>
    </section>

    <div v-if="dashboard.loading.value" class="flex items-center justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 animate-spin text-fc-red" />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const dashboard = useDashboardDirection()
const { fetchElements, aggregate, columns, applicable, standardsOf, hasPresence, elementTotals } = useVisibilityAggregation()
const { fetchConformity, byLevel } = useVisibilityConformity()
const page = ref(1)

import { isModernTrade as isCanalModernTrade } from '~/utils/canal'

const isModernTrade = (v: any) => isCanalModernTrade(v.pdv?.canal)
const promoApplicable = (v: any) => (v?.data?.visibilite?.promotion_applicable) !== false

const promoConformity = computed(() => byLevel(dashboard.visites.value.filter(promoApplicable), 'promotion'))

const totalVisites = computed(() => dashboard.visites.value.length)
const promoApplicableCount = computed(() => dashboard.visites.value.filter(promoApplicable).length)
const promoPresenceCount = computed(() => dashboard.visites.value.filter(v => hasPresence(v, 'promotion')).length)
const promoTotals = computed(() => elementTotals(dashboard.visites.value, 'promotion'))

const gtVisites = computed(() => dashboard.visites.value.filter(v => !isModernTrade(v)))
const mtVisites = computed(() => dashboard.visites.value.filter(isModernTrade))
const gtCount = computed(() => gtVisites.value.length)
const mtCount = computed(() => mtVisites.value.length)
const gtElements = computed(() => aggregate(gtVisites.value, 'promotion'))
const mtElements = computed(() => aggregate(mtVisites.value, 'promotion'))

const promoColumns = computed(() => columns(dashboard.visites.value, 'promotion'))

const tableRows = computed(() => dashboard.visites.value.map(v => ({
  nom: v.pdv?.nom_pdv || v.visite_id.substring(0, 8),
  pdv_id: v.pdv?.pdv_id || '',
  image_url: (v.pdv as any)?.image_url || null,
  zone: v.pdv?.zone || '',
  sousCategorie: v.pdv?.sous_categorie_pdv || '',
  promoApplicable: promoApplicable(v),
  standards: standardsOf(v),
  applicable: applicable(v.pdv?.sous_categorie_pdv, 'promotion'),
})))

const paginatedRows = computed(() => tableRows.value.slice((page.value - 1) * 100, page.value * 100))

onMounted(() => {
  Promise.all([dashboard.fetchZones(), dashboard.fetchVisites(), fetchElements(), fetchConformity()])
})
</script>
