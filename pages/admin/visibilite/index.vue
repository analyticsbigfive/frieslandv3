<template>
  <div class="space-y-6">
    <AdminPageHeader
      description="Éléments de visibilité relevés à l'extérieur des points de vente visités : présence de chaque élément et conformité par niveau."
    />

    <DashboardFilters
      v-model="dashboard.filters.value"
      :show-nom-pdv="true"
      @filter="dashboard.fetchVisites()"
    />

    <ChargementContenu v-if="dashboard.loading.value" libelle="Chargement des visites…" />
    <template v-else>
      <!-- Indicateurs -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard title="Visites analysées" :value="totalVisites" icon="i-heroicons-clipboard-document-list" color="blue" />
        <StatsCard
          title="Visites avec au moins un élément extérieur"
          :value="visExtCount"
          icon="i-heroicons-eye"
          color="green"
        />
        <StatsCard
          title="Taux de présence des éléments"
          :value="`${pct(extTotals.present, extTotals.applicable)} %`"
          format="none"
          :subtitle="`${nombre(extTotals.present)} présents sur ${nombre(extTotals.applicable)} attendus`"
          icon="i-heroicons-chart-bar"
          color="green"
        />
      </div>

      <!-- Présence par élément -->
      <section class="admin-surface p-5 sm:p-6">
        <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Présence par élément</h2>
          <span class="text-sm tabular-nums text-slate-600 dark:text-slate-300">
            {{ extElements.length }} élément{{ extElements.length > 1 ? 's' : '' }}
          </span>
        </div>
        <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Part des visites où l'élément est présent, parmi celles où il est prévu pour le type de point de vente.
        </p>
        <ul v-if="extElements.length" class="mt-5 grid gap-x-10 gap-y-4 md:grid-cols-2">
          <li v-for="el in extElements" :key="el.code">
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
        <p v-else class="mt-5 text-sm text-slate-600 dark:text-slate-300">
          Aucun élément extérieur n'est prévu pour les points de vente visités sur la période. Élargissez la période ou changez les filtres.
        </p>
      </section>

      <!-- Conformité par niveau (éléments requis, aligné sur le score Perfect Store) -->
      <section class="admin-surface p-5 sm:p-6">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Conformité par niveau de point de vente</h2>
        <p class="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
          Part des visites où <strong class="font-semibold text-slate-900 dark:text-white">tous</strong> les éléments extérieurs requis
          pour le niveau du point de vente sont présents. Le score Perfect Store combine l'extérieur et l'intérieur : ce bloc en montre la part extérieure.
        </p>
        <dl class="mt-5 grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          <div v-for="lvl in extConformity" :key="lvl.key" class="min-w-0">
            <dt class="text-sm font-semibold text-slate-700 dark:text-slate-200">{{ lvl.label }}</dt>
            <dd v-if="lvl.total" class="mt-1">
              <p class="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{{ lvl.gatePassPct }} %</p>
              <p class="text-xs text-slate-600 dark:text-slate-300">
                des {{ nombre(lvl.total) }} visite{{ lvl.total > 1 ? 's' : '' }} ont tous les éléments requis
              </p>
              <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700" aria-hidden="true">
                <div class="h-full rounded-full" :style="{ width: `${lvl.gatePassPct}%`, backgroundColor: STATUT.bon }" />
              </div>
              <p class="mt-2 text-xs tabular-nums text-slate-600 dark:text-slate-300">
                En moyenne, {{ lvl.avgRate }} % des éléments requis sont présents.
              </p>
            </dd>
            <dd v-else class="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Aucune visite d'un point de vente de ce niveau sur la période.
            </dd>
          </div>
        </dl>
      </section>

      <!-- Évolution -->
      <ClientOnly>
        <ChartsVisitesLineChart
          v-if="evolutionData.length"
          title="Évolution des visites avec visibilité extérieure"
          subtitle="Nombre de visites, par semaine, où au moins un élément extérieur est présent."
          series-label="Visites"
          :data="evolutionData"
        />
        <section v-else class="admin-surface p-5 sm:p-6">
          <h2 class="text-base font-semibold text-slate-900 dark:text-white">Évolution des visites avec visibilité extérieure</h2>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Pas assez de visites sur la période pour tracer une évolution. Élargissez la période.
          </p>
        </section>
      </ClientOnly>
    </template>
  </div>
</template>

<script setup lang="ts">
import { STATUT } from '~/utils/chartPalette'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const dashboard = useDashboardDirection()
const { fetchElements, aggregate, hasPresence, elementTotals } = useVisibilityAggregation()
const { fetchConformity, byLevel } = useVisibilityConformity()

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)

// Nombres à la française (« 9 587 »).
const nombre = (n: number) => n.toLocaleString('fr-FR')

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
  Promise.all([dashboard.fetchVisites(), fetchElements(), fetchConformity()])
})
</script>
