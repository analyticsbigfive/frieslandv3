<template>
  <div class="space-y-6">
    <!-- En-tête -->
    <header class="space-y-1">
      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-fc-red">Perfect Store · Visibilité</p>
      <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Visibilité intérieure</h1>
      <p class="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
        Taux de présence des éléments intérieurs mesurés, par canal, issus du référentiel Perfect Store
        (<code class="rounded bg-slate-100 px-1 py-0.5 text-[11px] dark:bg-slate-700">data.visibilite.standards</code>).
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
        <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Visites analysées</p>
        <p class="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{{ totalVisites }}</p>
      </div>
      <div class="admin-metric-tile">
        <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Avec visibilité intérieure</p>
        <p class="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{{ visIntCount }}</p>
      </div>
      <VisibilityPresenceTile :present="intTotals.present" :total="intTotals.applicable" />
    </div>

    <!-- General trade -->
    <section class="admin-surface p-5 sm:p-6">
      <div class="mb-5 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-700">
        <h2 class="text-base font-semibold text-slate-900 dark:text-white">General trade</h2>
        <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium tabular-nums text-slate-500 dark:bg-slate-700 dark:text-slate-300">
          {{ gtCount }} visite{{ gtCount > 1 ? 's' : '' }}
        </span>
      </div>
      <div v-if="gtElements.length" class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <VisibilityStatTile
          v-for="el in gtElements"
          :key="'gt-' + el.code"
          :label="el.label"
          :present="el.present"
          :total="el.applicable"
        />
      </div>
      <p v-else class="text-sm text-slate-400">Aucune visite General trade sur la période.</p>
    </section>

    <!-- Modern trade -->
    <section class="admin-surface p-5 sm:p-6">
      <div class="mb-5 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-700">
        <h2 class="text-base font-semibold text-slate-900 dark:text-white">Modern trade</h2>
        <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium tabular-nums text-slate-500 dark:bg-slate-700 dark:text-slate-300">
          {{ mtCount }} visite{{ mtCount > 1 ? 's' : '' }}
        </span>
      </div>
      <div v-if="mtElements.length" class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <VisibilityStatTile
          v-for="el in mtElements"
          :key="'mt-' + el.code"
          :label="el.label"
          :present="el.present"
          :total="el.applicable"
        />
      </div>
      <p v-else class="text-sm text-slate-400">Aucune visite Modern trade sur la période.</p>
    </section>

    <!-- Conformité par niveau (éléments requis, aligné score PS) -->
    <section class="admin-surface p-5 sm:p-6">
      <div class="mb-1 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-700">
        <h2 class="text-base font-semibold text-slate-900 dark:text-white">Conformité par niveau — intérieur</h2>
        <span class="text-xs text-slate-400">éléments requis uniquement</span>
      </div>
      <p class="mb-4 mt-3 text-xs text-slate-500 dark:text-slate-400">
        Part des PDV dont <strong>tous</strong> les éléments intérieurs <em>requis</em> du niveau sont présents (gate = 100 %).
        Le score Perfect Store combine extérieur + intérieur ; ceci en est la composante intérieure.
      </p>
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <VisibilityLevelCard
          v-for="lvl in intConformity"
          :key="lvl.key"
          :level-key="lvl.key"
          :label="lvl.label"
          :gate-pass-pct="lvl.gatePassPct"
          :avg-rate="lvl.avgRate"
          :total="lvl.total"
        />
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
const { fetchElements, aggregate, hasPresence, elementTotals } = useVisibilityAggregation()
const { fetchConformity, byLevel } = useVisibilityConformity()

import { isModernTrade as isCanalModernTrade } from '~/utils/canal'

const isModernTrade = (v: any) => isCanalModernTrade(v.pdv?.canal)

const intConformity = computed(() => byLevel(dashboard.visites.value, 'visibilite', 'interieure'))

const totalVisites = computed(() => dashboard.visites.value.length)
const visIntCount = computed(() => dashboard.visites.value.filter(v => hasPresence(v, 'interieure')).length)
const intTotals = computed(() => elementTotals(dashboard.visites.value, 'interieure'))

const gtVisites = computed(() => dashboard.visites.value.filter(v => !isModernTrade(v)))
const mtVisites = computed(() => dashboard.visites.value.filter(isModernTrade))
const gtCount = computed(() => gtVisites.value.length)
const mtCount = computed(() => mtVisites.value.length)

const gtElements = computed(() => aggregate(gtVisites.value, 'interieure'))
const mtElements = computed(() => aggregate(mtVisites.value, 'interieure'))

onMounted(() => {
  Promise.all([dashboard.fetchZones(), dashboard.fetchVisites(), fetchElements(), fetchConformity()])
})
</script>
