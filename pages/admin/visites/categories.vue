<template>
  <div class="space-y-6">
    <AdminPageHeader description="Où ont lieu les visites : boutiques (GT) ou supermarchés (MT), et par catégorie de point de vente." />

    <DashboardFilters
      v-model="dashboard.filters.value"
      :show-quartier="false"
      @filter="dashboard.fetchVisites()"
    />

    <ChargementContenu v-if="dashboard.loading.value" variante="cartes" :nombre="2" classe-carte="admin-surface" libelle="Chargement des visites…" />

    <template v-else>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard title="Visites" :value="dashboard.totalVisites.value" icon="i-heroicons-clipboard-document-list" color="red" />
        <StatsCard title="En boutiques (GT)" :value="gtCount" :subtitle="part(gtCount)" icon="i-heroicons-shopping-bag" />
        <StatsCard title="En supermarchés (MT)" :value="mtCount" :subtitle="part(mtCount)" icon="i-heroicons-building-storefront" />
      </div>

      <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section class="admin-surface p-5">
          <h2 class="text-base font-semibold text-slate-900 dark:text-white">Répartition par canal</h2>
          <ClientOnly>
            <ChartsPieChart
              v-if="canalPie.values.length"
              class="mt-4"
              bare
              :labels="canalPie.labels"
              :values="canalPie.values"
              :colors="canalPie.colors"
              height="md"
            />
          </ClientOnly>
          <p v-if="!canalPie.values.length" class="mt-4 flex h-40 items-center justify-center rounded-md bg-slate-50 px-4 text-center text-sm text-slate-600 dark:bg-slate-700/40 dark:text-slate-300">
            Aucune visite sur la période. Élargissez les dates ou retirez des filtres.
          </p>
        </section>
        <section class="admin-surface p-5">
          <h2 class="text-base font-semibold text-slate-900 dark:text-white">Répartition par catégorie de point de vente</h2>
          <ClientOnly>
            <ChartsPieChart
              v-if="categoriePie.labels.length"
              class="mt-4"
              bare
              :labels="categoriePie.labels"
              :values="categoriePie.values"
              :colors="categoriePie.colors"
              height="md"
            />
          </ClientOnly>
          <p v-if="!categoriePie.labels.length" class="mt-4 flex h-40 items-center justify-center rounded-md bg-slate-50 px-4 text-center text-sm text-slate-600 dark:bg-slate-700/40 dark:text-slate-300">
            Aucune visite sur la période. Élargissez les dates ou retirez des filtres.
          </p>
        </section>
      </div>

      <section class="admin-surface p-5">
        <h2 class="text-base font-semibold text-slate-900 dark:text-white">Évolution des visites par canal</h2>
        <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">Visites de chaque semaine, repérée par son premier jour.</p>
        <ClientOnly>
          <div v-if="evoChartData" class="mt-4 h-72">
            <Bar :data="evoChartData" :options="chartOptions" />
          </div>
        </ClientOnly>
        <p v-if="!evoChartData" class="mt-4 flex h-40 items-center justify-center rounded-md bg-slate-50 px-4 text-center text-sm text-slate-600 dark:bg-slate-700/40 dark:text-slate-300">
          Aucune visite sur la période. Élargissez les dates ou retirez des filtres.
        </p>
      </section>

      <section class="admin-surface overflow-hidden">
        <div class="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 class="text-base font-semibold text-slate-900 dark:text-white">Détail par catégorie de point de vente</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Catégorie</th>
                <th class="text-right">Visites</th>
                <th>Part des visites</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in categorieRows" :key="row.name">
                <td class="font-medium text-slate-900 dark:text-white">{{ row.name }}</td>
                <td class="text-right font-semibold tabular-nums text-slate-900 dark:text-white">{{ row.count.toLocaleString('fr-FR') }}</td>
                <td>
                  <div class="flex items-center gap-2">
                    <div class="h-2 w-24 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700" aria-hidden="true">
                      <div class="h-full rounded-full" :style="{ width: row.pct + '%', backgroundColor: SERIES[0] }" />
                    </div>
                    <span class="text-sm tabular-nums text-slate-700 dark:text-slate-200">{{ row.pct }} %</span>
                  </div>
                </td>
              </tr>
              <tr v-if="!categorieRows.length">
                <td colspan="3" class="py-8 text-center text-slate-600 dark:text-slate-300">
                  Aucune visite sur la période. Élargissez les dates ou retirez des filtres.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Bar } from 'vue-chartjs'
import { AUTRE, AXES, SERIES } from '~/utils/chartPalette'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const dashboard = useDashboardDirection()
const { categoriePdvLabel, fetchTypePdvLabels } = useTypePdvLabels()

// Libellés d'affichage : les valeurs de base restent General trade / Modern trade.
const LIBELLE_GT = 'Boutiques (GT)'
const LIBELLE_MT = 'Supermarchés (MT)'
const COULEUR_GT = SERIES[0]
const COULEUR_MT = SERIES[1]
const NON_RENSEIGNE = 'Non renseignée'

const gtCount = computed(() => dashboard.countWhere(v => v.pdv?.canal === 'General trade'))
const mtCount = computed(() => dashboard.countWhere(v => v.pdv?.canal === 'Modern trade'))
const autreCount = computed(() => dashboard.totalVisites.value - gtCount.value - mtCount.value)

function part(n: number): string {
  const total = dashboard.totalVisites.value
  return total ? `${Math.round(n / total * 100)} % des visites` : ''
}

// Parts nulles retirées : la légende ne montre que ce qui existe.
const canalPie = computed(() => {
  const parts = [
    { label: LIBELLE_GT, value: gtCount.value, color: COULEUR_GT },
    { label: LIBELLE_MT, value: mtCount.value, color: COULEUR_MT },
    { label: 'Canal non renseigné', value: autreCount.value, color: AUTRE },
  ].filter(p => p.value > 0)
  return { labels: parts.map(p => p.label), values: parts.map(p => p.value), colors: parts.map(p => p.color) }
})

const categoriePie = computed(() => {
  let i = 0
  return {
    labels: categorieBreakdown.value.labels,
    values: categorieBreakdown.value.values,
    colors: categorieBreakdown.value.labels.map(l => (l === NON_RENSEIGNE ? AUTRE : SERIES[i++] ?? AUTRE)),
  }
})

const categorieBreakdown = computed(() => {
  const counts = new Map<string, number>()
  dashboard.visites.value.forEach(v => {
    const cat = v.pdv?.categorie_pdv ? categoriePdvLabel(v.pdv.categorie_pdv) : NON_RENSEIGNE
    counts.set(cat, (counts.get(cat) || 0) + 1)
  })
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  return {
    labels: sorted.map(([k]) => k),
    values: sorted.map(([, v]) => v),
  }
})

const categorieRows = computed(() => {
  const total = dashboard.totalVisites.value
  return categorieBreakdown.value.labels.map((name, i) => ({
    name,
    count: categorieBreakdown.value.values[i],
    pct: total > 0 ? Math.round(categorieBreakdown.value.values[i] / total * 100) : 0,
  }))
})

const evoChartData = computed(() => {
  if (!dashboard.visites.value.length) return null

  const weeks = new Map<string, { gt: number; mt: number; autre: number }>()

  dashboard.visites.value.forEach(v => {
    const d = new Date(v.date_visite)
    const weekStart = new Date(d)
    weekStart.setDate(d.getDate() - d.getDay())
    const key = weekStart.toISOString().slice(0, 10)

    if (!weeks.has(key)) weeks.set(key, { gt: 0, mt: 0, autre: 0 })
    const w = weeks.get(key)!
    if (v.pdv?.canal === 'General trade') w.gt++
    else if (v.pdv?.canal === 'Modern trade') w.mt++
    else w.autre++
  })

  const sorted = [...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0]))

  return {
    labels: sorted.map(([k]) => new Date(k).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })),
    datasets: [
      { label: LIBELLE_GT, data: sorted.map(([, v]) => v.gt), backgroundColor: COULEUR_GT },
      { label: LIBELLE_MT, data: sorted.map(([, v]) => v.mt), backgroundColor: COULEUR_MT },
      { label: 'Canal non renseigné', data: sorted.map(([, v]) => v.autre), backgroundColor: AUTRE },
    ],
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: { usePointStyle: true, pointStyle: 'circle', font: { size: AXES.taillePolice }, color: AXES.texte },
    },
    tooltip: { backgroundColor: AXES.infobulleFond, padding: 10, cornerRadius: 8 },
  },
  scales: {
    x: { stacked: true, grid: { display: false }, ticks: { font: { size: AXES.taillePolice }, color: AXES.texte } },
    y: { stacked: true, beginAtZero: true, grid: { color: AXES.grille }, ticks: { font: { size: AXES.taillePolice }, color: AXES.texte } },
  },
}

onMounted(() => {
  fetchTypePdvLabels()
  Promise.all([dashboard.fetchVisites()])
})
</script>
