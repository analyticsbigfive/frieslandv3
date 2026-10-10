<template>
  <div class="space-y-6">
    <AdminPageHeader
      description="Présence de chaque élément intérieur, en boutiques (GT) et en supermarchés (MT), et tendance des visites dans le temps."
    />

    <DashboardFilters
      v-model="dashboard.filters.value"
      @filter="dashboard.fetchVisites()"
    />

    <ChargementContenu v-if="dashboard.loading.value" libelle="Chargement des visites…" />
    <template v-else>
      <!-- Indicateurs -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard title="Visites analysées" :value="totalVisites" icon="i-heroicons-clipboard-document-list" color="blue" />
        <StatsCard
          title="Visites avec au moins un élément intérieur"
          :value="visIntCount"
          icon="i-heroicons-eye"
          color="green"
        />
        <StatsCard
          title="Taux de présence des éléments"
          :value="`${pct(intTotals.present, intTotals.applicable)} %`"
          format="none"
          :subtitle="`${nombre(intTotals.present)} présents sur ${nombre(intTotals.applicable)} attendus`"
          icon="i-heroicons-chart-bar"
          color="green"
        />
      </div>

      <!-- Évolution : la question de la page, en premier -->
      <ClientOnly>
        <ChartsVisitesLineChart
          v-if="evolutionData.length"
          title="Évolution des visites avec visibilité intérieure"
          subtitle="Nombre de visites, par semaine, où au moins un élément intérieur est présent."
          series-label="Visites"
          :data="evolutionData"
        />
        <section v-else class="admin-surface p-5 sm:p-6">
          <h2 class="text-base font-semibold text-slate-900 dark:text-white">Évolution des visites avec visibilité intérieure</h2>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Pas assez de visites sur la période pour tracer une évolution. Élargissez la période.
          </p>
        </section>
      </ClientOnly>

      <!-- Présence par élément, par canal -->
      <div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section v-for="canal in canaux" :key="canal.cle" class="admin-surface p-5 sm:p-6">
          <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">{{ canal.titre }}</h2>
            <span class="text-sm tabular-nums text-slate-600 dark:text-slate-300">
              {{ nombre(canal.visites) }} visite{{ canal.visites > 1 ? 's' : '' }}
            </span>
          </div>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Part des visites où l'élément est présent, parmi celles où il est prévu.
          </p>
          <ul v-if="canal.elements.length" class="mt-5 space-y-4">
            <li v-for="el in canal.elements" :key="`${canal.cle}-${el.code}`">
              <div class="flex items-baseline justify-between gap-3 text-sm">
                <span class="min-w-0 text-slate-700 dark:text-slate-200">{{ el.label }}</span>
                <span class="shrink-0 tabular-nums text-slate-600 dark:text-slate-300">
                  <strong class="font-semibold text-slate-900 dark:text-white">{{ pct(el.present, el.applicable) }} %</strong>
                  · {{ nombre(el.present) }} sur {{ nombre(el.applicable) }}
                </span>
              </div>
              <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700" aria-hidden="true">
                <div class="h-full rounded-full" :style="{ width: `${pct(el.present, el.applicable)}%`, backgroundColor: STATUT.bon }" />
              </div>
            </li>
          </ul>
          <p v-else class="mt-5 text-sm text-slate-600 dark:text-slate-300">{{ canal.vide }}</p>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { STATUT } from '~/utils/chartPalette'
import { isModernTrade as isCanalModernTrade } from '~/utils/canal'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const dashboard = useDashboardDirection()
const { fetchElements, aggregate, hasPresence, elementTotals } = useVisibilityAggregation()

const isModernTrade = (v: any) => isCanalModernTrade(v.pdv?.canal)
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)

// Nombres à la française (« 9 587 »).
const nombre = (n: number) => n.toLocaleString('fr-FR')

const totalVisites = computed(() => dashboard.visites.value.length)
const visIntCount = computed(() => dashboard.visites.value.filter(v => hasPresence(v, 'interieure')).length)
const intTotals = computed(() => elementTotals(dashboard.visites.value, 'interieure'))

const gtVisites = computed(() => dashboard.visites.value.filter(v => !isModernTrade(v)))
const mtVisites = computed(() => dashboard.visites.value.filter(isModernTrade))
const gtCount = computed(() => gtVisites.value.length)
const mtCount = computed(() => mtVisites.value.length)
const gtElements = computed(() => aggregate(gtVisites.value, 'interieure'))
const mtElements = computed(() => aggregate(mtVisites.value, 'interieure'))

const canaux = computed(() => [
  {
    cle: 'gt',
    titre: 'Boutiques (GT)',
    visites: gtCount.value,
    elements: gtElements.value,
    vide: 'Aucune visite de boutique (GT) sur la période et les filtres choisis.',
  },
  {
    cle: 'mt',
    titre: 'Supermarchés (MT)',
    visites: mtCount.value,
    elements: mtElements.value,
    vide: 'Aucune visite de supermarché (MT) sur la période et les filtres choisis.',
  },
])

const evolutionData = computed(() => {
  const evo = dashboard.evolutionParSemaine(v => hasPresence(v, 'interieure'))
  return evo.labels.map((label: string, i: number) => ({ date: label, count: evo.counts[i] }))
})

onMounted(() => {
  Promise.all([dashboard.fetchVisites(), fetchElements()])
})
</script>
