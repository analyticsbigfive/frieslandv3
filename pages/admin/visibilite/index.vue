<template>
  <div class="space-y-6">
    <!-- En-tête -->
    <header class="space-y-1">
      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-fc-red">Perfect Store · Visibilité</p>
      <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Visibilité extérieure</h1>
      <p class="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
        Taux de présence des éléments extérieurs mesurés, issus du référentiel Perfect Store
        (<code class="rounded bg-slate-100 px-1 py-0.5 text-[11px] dark:bg-slate-700">data.visibilite.standards</code>).
      </p>
    </header>

    <DashboardFilters
      v-model="dashboard.filters.value"
      :zone-options="dashboard.availableZones.value"
      :show-nom-pdv="true"
      @filter="dashboard.fetchVisites()"
    />

    <!-- KPI -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div class="admin-metric-tile">
        <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Visites analysées</p>
        <p class="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{{ totalVisites }}</p>
      </div>
      <div class="admin-metric-tile">
        <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Avec visibilité extérieure</p>
        <p class="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{{ visExtCount }}</p>
      </div>
      <VisibilityPresenceTile :present="extTotals.present" :total="extTotals.applicable" />
    </div>

    <!-- Présence par élément -->
    <section class="admin-surface p-5 sm:p-6">
      <div class="mb-5 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-700">
        <h2 class="text-base font-semibold text-slate-900 dark:text-white">Présence par élément</h2>
        <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium tabular-nums text-slate-500 dark:bg-slate-700 dark:text-slate-300">
          {{ extElements.length }} élément{{ extElements.length > 1 ? 's' : '' }}
        </span>
      </div>
      <div v-if="extElements.length" class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <VisibilityStatTile
          v-for="el in extElements"
          :key="el.code"
          :label="el.label"
          :present="el.present"
          :total="el.applicable"
        />
      </div>
      <p v-else class="text-sm text-slate-400">Aucun élément extérieur pour les segments des visites chargées.</p>
    </section>

    <!-- Conformité par niveau (éléments requis, aligné score PS) -->
    <section class="admin-surface p-5 sm:p-6">
      <div class="mb-1 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-700">
        <h2 class="text-base font-semibold text-slate-900 dark:text-white">Conformité par niveau — extérieur</h2>
        <span class="text-xs text-slate-400">éléments requis uniquement</span>
      </div>
      <p class="mb-4 mt-3 text-xs text-slate-500 dark:text-slate-400">
        Part des PDV dont <strong>tous</strong> les éléments extérieurs <em>requis</em> du niveau sont présents (gate = 100 %).
        Le score Perfect Store combine extérieur + intérieur ; ceci en est la composante extérieure.
      </p>
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <VisibilityLevelCard
          v-for="lvl in extConformity"
          :key="lvl.key"
          :level-key="lvl.key"
          :label="lvl.label"
          :gate-pass-pct="lvl.gatePassPct"
          :avg-rate="lvl.avgRate"
          :total="lvl.total"
        />
      </div>
    </section>

    <!-- Évolution -->
    <section class="admin-surface p-5 sm:p-6">
      <h3 class="mb-4 text-base font-semibold text-slate-900 dark:text-white">Évolution des visites avec visibilité extérieure</h3>
      <ClientOnly>
        <ChartsVisitesLineChart v-if="evolutionData.length" title="" :data="evolutionData" />
        <p v-else class="text-sm text-slate-400">Pas assez de données pour tracer l'évolution.</p>
      </ClientOnly>
    </section>

    <div v-if="dashboard.loading.value" class="flex items-center justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 animate-spin text-fc-red" />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const dashboard = useDashboardDirection()
const { fetchElements, aggregate, hasPresence, elementTotals } = useVisibilityAggregation()
const { fetchConformity, byLevel } = useVisibilityConformity()

const totalVisites = computed(() => dashboard.visites.value.length)
const visExtCount = computed(() => dashboard.visites.value.filter(v => hasPresence(v, 'exterieure')).length)
const extTotals = computed(() => elementTotals(dashboard.visites.value, 'exterieure'))

const extElements = computed(() => aggregate(dashboard.visites.value, 'exterieure'))
const extConformity = computed(() => byLevel(dashboard.visites.value, 'visibilite', 'exterieure'))

const evolutionData = computed(() => {
  const evo = dashboard.evolutionParSemaine(v => hasPresence(v, 'exterieure'))
  return evo.labels.map((label: string, i: number) => ({ date: label, count: evo.counts[i] }))
})

onMounted(() => {
  Promise.all([dashboard.fetchZones(), dashboard.fetchVisites(), fetchElements(), fetchConformity()])
})
</script>
