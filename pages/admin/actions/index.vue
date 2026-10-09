<template>
  <div class="space-y-6">
    <AdminPageHeader description="La part des visites où chaque action a été réalisée, sur la période et le périmètre choisis." />

    <DashboardFilters
      v-model="dashboard.filters.value"
      @filter="dashboard.fetchVisites()"
    />

    <ChargementContenu v-if="dashboard.loading.value" variante="cartes" :nombre="2" classe-carte="admin-surface" libelle="Chargement des visites…" />

    <template v-else>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatsCard title="Visites analysées" :value="dashboard.totalVisites.value" icon="i-heroicons-clipboard-document-list" />
        <StatsCard
          title="Visites avec au moins une action"
          :value="visitesAvecAction"
          :subtitle="dashboard.totalVisites.value ? `${pctAvecAction} % des visites` : ''"
          icon="i-heroicons-check-badge"
          color="green"
        />
      </div>

      <!-- Une seule représentation par action : la barre et son pourcentage
           (les sept camemberts répétaient la même information). -->
      <section class="admin-surface p-5">
        <h2 class="text-base font-semibold text-slate-900 dark:text-white">Taux de réalisation par action</h2>
        <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">Part des visites de la période où l’action a été cochée.</p>
        <ul v-if="dashboard.totalVisites.value" class="mt-5 space-y-4">
          <li v-for="action in actionStats" :key="action.key" class="space-y-1.5">
            <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span class="text-sm font-medium text-slate-700 dark:text-slate-200">{{ action.label }}</span>
              <span class="text-sm tabular-nums text-slate-600 dark:text-slate-300">
                <span class="font-semibold text-slate-900 dark:text-white">{{ formatPct(action.pct) }} %</span>
                ({{ action.count.toLocaleString('fr-FR') }} sur {{ dashboard.totalVisites.value.toLocaleString('fr-FR') }} visites)
              </span>
            </div>
            <div class="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700" aria-hidden="true">
              <div class="h-full rounded-full" :style="{ width: action.pct + '%', backgroundColor: SERIES[0] }" />
            </div>
          </li>
        </ul>
        <p v-else class="mt-4 rounded-md bg-slate-50 px-4 py-8 text-center text-sm text-slate-600 dark:bg-slate-700/40 dark:text-slate-300">
          Aucune visite sur la période. Élargissez les dates ou retirez des filtres.
        </p>
      </section>

      <ClientOnly>
        <ChartsMultiLineChart
          title="Visites avec au moins une action, par semaine"
          subtitle="Semaines du lundi au dimanche."
          :labels="evoData.map(p => p.date)"
          :series="[{ label: 'Visites avec au moins une action', data: evoData.map(p => p.count) }]"
          empty-label="Aucune visite sur la période. Élargissez les dates ou retirez des filtres."
        />
      </ClientOnly>
    </template>
  </div>
</template>

<script setup lang="ts">
import { SERIES } from '~/utils/chartPalette'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const dashboard = useDashboardDirection()

const actionDefs = [
  { key: 'referencement_produits', label: 'Référencement de produits' },
  { key: 'execution_activites_promotionnelles', label: 'Activités promotionnelles' },
  { key: 'prospection_pdv', label: 'Prospection de points de vente' },
  { key: 'verification_fifo', label: 'Rotation des stocks (premier entré, premier sorti)' },
  { key: 'rangement_produits', label: 'Rangement des produits' },
  { key: 'pose_affiches', label: 'Pose d’affiches' },
  { key: 'pose_materiel_visibilite', label: 'Pose de matériel de visibilité' },
]

function actionPresent(key: string) {
  return dashboard.countWhere(v => v.data?.actions?.[key])
}

// Même prédicat que la courbe : au moins une des actions cochée.
const visitesAvecAction = computed(() => dashboard.countWhere(v => actionDefs.some(a => v.data?.actions?.[a.key])))
const pctAvecAction = computed(() => {
  const total = dashboard.totalVisites.value
  return total ? Math.round(visitesAvecAction.value / total * 100) : 0
})

function formatPct(v: number): string {
  return v.toLocaleString('fr-FR', { maximumFractionDigits: 1 })
}

const actionStats = computed(() =>
  actionDefs.map(a => ({
    ...a,
    count: actionPresent(a.key),
    pct: dashboard.pctWhere(v => v.data?.actions?.[a.key]),
  }))
)

const evoData = computed(() => {
  // Evolution: nombre d'actions totales réalisées par semaine
  const evo = dashboard.evolutionParSemaine(v => {
    return actionDefs.some(a => v.data?.actions?.[a.key])
  })
  return evo.labels.map((label, i) => ({ date: label, count: evo.counts[i] }))
})

onMounted(() => {
  Promise.all([dashboard.fetchVisites()])
})
</script>
