<template>
  <div class="space-y-6">
    <header class="space-y-1">
      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-fc-red">Perfect Store · Visibilité</p>
      <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Visibilité intérieure — évolution</h1>
      <p class="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
        Présence par élément intérieur et tendance dans le temps (référentiel Perfect Store).
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
        <p class="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{{ totalVisites }}</p>
      </div>
      <div class="admin-metric-tile">
        <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Avec visibilité intérieure</p>
        <p class="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{{ visIntCount }}</p>
      </div>
      <VisibilityPresenceTile :present="intTotals.present" :total="intTotals.applicable" />
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

    <section class="admin-surface p-5 sm:p-6">
      <h3 class="mb-4 text-base font-semibold text-slate-900 dark:text-white">Évolution des visites avec visibilité intérieure</h3>
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

import { isModernTrade as isCanalModernTrade } from '~/utils/canal'

const isModernTrade = (v: any) => isCanalModernTrade(v.pdv?.canal)

const totalVisites = computed(() => dashboard.visites.value.length)
const visIntCount = computed(() => dashboard.visites.value.filter(v => hasPresence(v, 'interieure')).length)
const intTotals = computed(() => elementTotals(dashboard.visites.value, 'interieure'))

const gtVisites = computed(() => dashboard.visites.value.filter(v => !isModernTrade(v)))
const mtVisites = computed(() => dashboard.visites.value.filter(isModernTrade))
const gtCount = computed(() => gtVisites.value.length)
const mtCount = computed(() => mtVisites.value.length)
const gtElements = computed(() => aggregate(gtVisites.value, 'interieure'))
const mtElements = computed(() => aggregate(mtVisites.value, 'interieure'))

const evolutionData = computed(() => {
  const evo = dashboard.evolutionParSemaine(v => hasPresence(v, 'interieure'))
  return evo.labels.map((label: string, i: number) => ({ date: label, count: evo.counts[i] }))
})

onMounted(() => {
  Promise.all([dashboard.fetchVisites(), fetchElements()])
})
</script>
