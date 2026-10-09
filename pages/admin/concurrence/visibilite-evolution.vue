<template>
  <div class="space-y-6">
    <AdminPageHeader
      description="Marques concurrentes visibles à l'extérieur et à l'intérieur des points de vente visités."
    />

    <DashboardFilters
      v-model="dashboard.filters.value"
      @filter="dashboard.fetchVisites()"
    />

    <ChargementContenu v-if="dashboard.loading.value" libelle="Chargement des visites…" />

    <template v-else>
      <!-- Indicateurs -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard title="Visites analysées" :value="dashboard.totalVisites.value" icon="i-heroicons-clipboard-document-list" color="blue" />
        <StatsCard
          title="Concurrence visible à l'extérieur"
          :value="`${concExtPct.toLocaleString('fr-FR')} %`"
          format="none"
          :subtitle="`${nombre(concExtCount)} visite${concExtCount > 1 ? 's' : ''} avec au moins une marque`"
          icon="i-heroicons-building-storefront"
          color="orange"
        />
        <StatsCard
          title="Concurrence visible à l'intérieur"
          :value="`${concIntPct.toLocaleString('fr-FR')} %`"
          format="none"
          :subtitle="`${nombre(concIntCount)} visite${concIntCount > 1 ? 's' : ''} avec au moins une marque`"
          icon="i-heroicons-squares-2x2"
          color="orange"
        />
      </div>

      <!-- Visibilité par marque : une ligne par marque, extérieur et intérieur côte à côte -->
      <section class="admin-surface overflow-hidden">
        <div class="px-5 py-4">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Visibilité par marque concurrente</h2>
          <p class="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
            Part des visites où la marque est visible, à l'extérieur puis à l'intérieur du point de vente.
          </p>
        </div>
        <p
          v-if="!dashboard.totalVisites.value"
          class="border-t border-slate-200 px-5 py-8 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
        >
          Aucune visite sur la période. Élargissez la période ou changez les filtres.
        </p>
        <div v-else class="overflow-x-auto border-t border-slate-200 dark:border-slate-700">
          <table class="admin-table" data-no-column-tools>
            <thead>
              <tr>
                <th>Marque</th>
                <th class="min-w-[12rem]">À l'extérieur</th>
                <th class="min-w-[12rem]">À l'intérieur</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in concMarques" :key="item.key">
                <td>
                  <span class="flex items-center gap-2 font-medium text-slate-900 dark:text-white">
                    <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: item.color }" aria-hidden="true" />
                    {{ item.label }}
                  </span>
                </td>
                <td v-for="emp in emplacements" :key="emp.cle">
                  <div class="flex items-baseline justify-between gap-3">
                    <strong class="font-semibold tabular-nums text-slate-900 dark:text-white">{{ nombre(pctVisites(emp.compter(item.key))) }} %</strong>
                    <span class="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                      {{ nombre(emp.compter(item.key)) }} visite{{ emp.compter(item.key) > 1 ? 's' : '' }}
                    </span>
                  </div>
                  <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700" aria-hidden="true">
                    <div class="h-full rounded-full" :style="{ width: `${pctVisites(emp.compter(item.key))}%`, backgroundColor: item.color }" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Évolution (extérieur) -->
      <section class="admin-surface p-5 sm:p-6">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Évolution de la visibilité concurrente à l'extérieur</h2>
        <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Nombre de visites, par semaine, où chaque marque est visible à l'extérieur du point de vente.
        </p>
        <ClientOnly>
          <div v-if="evolutionChartData" class="mt-4 h-72">
            <Bar :data="evolutionChartData" :options="chartOptions" />
          </div>
          <p v-else class="mt-4 text-sm text-slate-600 dark:text-slate-300">
            Pas assez de visites sur la période pour tracer une évolution. Élargissez la période.
          </p>
        </ClientOnly>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Bar } from 'vue-chartjs'
import { visibiliteConcurrencePresente } from '~/utils/concurrence'
import { AXES, couleurSerie } from '~/utils/chartPalette'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const dashboard = useDashboardDirection()

// Nombres à la française (« 9 587 »).
const nombre = (n: number) => n.toLocaleString('fr-FR')

// Marques du référentiel (lot 6), même liste que l'étape 9/11 du wizard.
// Couleur : série de la palette commune, dans l'ordre du référentiel.
const { marquesVisibilite, charger: chargerMarques } = useMarquesConcurrentes()
const concMarques = computed(() =>
  marquesVisibilite.value.map((m, i) => ({ key: m.cle, label: m.nom, color: couleurSerie(i) })),
)

// Présence d'au moins une marque à l'emplacement, dans les deux formats
// (indicateur `presence` écrit depuis septembre 2026, clés plates avant).
function presenceEmplacement(v: any, emplacement: 'exterieure' | 'interieure') {
  const conc = v.data?.visibilite?.concurrence
  if (conc?.[emplacement]?.presence === true) return true
  return concMarques.value.some(m => visibiliteConcurrencePresente(conc, emplacement, m.key))
}

const concExtCount = computed(() => dashboard.countWhere(v => presenceEmplacement(v, 'exterieure')))
const concIntCount = computed(() => dashboard.countWhere(v => presenceEmplacement(v, 'interieure')))
const concExtPct = computed(() => dashboard.pctWhere(v => presenceEmplacement(v, 'exterieure')))
const concIntPct = computed(() => dashboard.pctWhere(v => presenceEmplacement(v, 'interieure')))

function countExtPresent(marque: string) {
  return dashboard.countWhere(v => visibiliteConcurrencePresente(v.data?.visibilite?.concurrence, 'exterieure', marque))
}
function countIntPresent(marque: string) {
  return dashboard.countWhere(v => visibiliteConcurrencePresente(v.data?.visibilite?.concurrence, 'interieure', marque))
}

// Part des visites (ce qu'affichaient les camemberts présent / absent), à une
// décimale comme les autres pourcentages du tableau de bord.
function pctVisites(n: number) {
  const total = dashboard.totalVisites.value
  return total ? Math.round(n / total * 1000) / 10 : 0
}

const emplacements = [
  { cle: 'ext', compter: countExtPresent },
  { cle: 'int', compter: countIntPresent },
]

// Barres empilées : par semaine, présence de chaque marque à l'extérieur.
const evolutionChartData = computed(() => {
  if (!dashboard.visites.value.length) return null

  const weeks = new Map<string, Record<string, number>>()

  dashboard.visites.value.forEach(v => {
    const d = new Date(v.date_visite)
    const weekStart = new Date(d)
    weekStart.setDate(d.getDate() - d.getDay())
    const key = weekStart.toISOString().slice(0, 10)

    if (!weeks.has(key)) {
      weeks.set(key, Object.fromEntries(concMarques.value.map(m => [m.key, 0])))
    }
    const w = weeks.get(key)!
    for (const m of concMarques.value) {
      if (visibiliteConcurrencePresente(v.data?.visibilite?.concurrence, 'exterieure', m.key)) w[m.key]++
    }
  })

  const sorted = [...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0]))

  return {
    labels: sorted.map(([k]) => {
      const d = new Date(k)
      return d.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })
    }),
    datasets: concMarques.value.map(m => ({
      label: m.label,
      data: sorted.map(([, v]) => v[m.key]),
      backgroundColor: m.color,
      maxBarThickness: 40,
    })),
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
      labels: { usePointStyle: true, pointStyle: 'circle', font: { size: AXES.taillePolice }, color: AXES.texte, padding: 12 },
    },
    tooltip: { backgroundColor: AXES.infobulleFond, titleColor: AXES.infobulleTexte, bodyColor: AXES.infobulleTexte, padding: 10, cornerRadius: 8 },
  },
  scales: {
    x: { stacked: true, grid: { display: false }, ticks: { font: { size: AXES.taillePolice }, color: AXES.texte } },
    y: { stacked: true, beginAtZero: true, grid: { color: AXES.grille }, ticks: { font: { size: AXES.taillePolice }, color: AXES.texte, precision: 0 } },
  },
}

onMounted(() => {
  Promise.all([dashboard.fetchVisites(), chargerMarques()])
})
</script>
