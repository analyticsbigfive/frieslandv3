<template>
  <div class="space-y-6">
    <AdminPageHeader
      title="Concurrence — évolution"
      eyebrow="Domaine concurrence"
    />

    <DashboardFilters
      v-model="dashboard.filters.value"
      @filter="dashboard.fetchVisites()"
    />

    <div v-if="dashboard.loading.value" class="flex items-center justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-fc-blue" />
    </div>

    <template v-else>
      <!-- KPI -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total visites" :value="String(dashboard.totalVisites.value)" icon="i-heroicons-clipboard-document-list" color="blue" />
        <StatsCard title="Concurrence détectée" :value="concPct + '%'" icon="i-heroicons-exclamation-triangle" color="red" />
        <StatsCard title="Concurrents en activité" :value="String(enActiviteCount)" subtitle="promo, fidélité, référencement…" icon="i-heroicons-megaphone" color="orange" />
        <StatsCard title="Concurrents signalés" :value="String(concurrentsLibres.length)" subtitle="noms saisis sur le terrain" icon="i-heroicons-user-plus" color="green" />
      </div>

      <!-- Concurrents signalés en texte libre, agrégés par nom normalisé
           (« Cowmilk », « cowmilk » et « Cow Milk » = une seule ligne). -->
      <div class="admin-surface overflow-hidden">
        <div class="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-700">
          <h2 class="font-bold text-gray-900 dark:text-gray-100">Concurrents signalés par les merchandisers</h2>
          <span class="text-xs text-slate-400">{{ concurrentsLibres.length }} nom(s) distinct(s)</span>
        </div>

        <div v-if="!concurrentsLibres.length" class="px-5 py-10 text-center text-sm text-slate-400">
          Aucun concurrent saisi librement sur cette période.
        </div>

        <div v-else class="overflow-x-auto">
          <table class="admin-table w-full text-sm">
            <thead class="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Concurrent</th>
                <th class="px-4 py-2 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Signalements</th>
                <th class="px-4 py-2 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">En activité</th>
                <th class="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Actions relevées</th>
                <th class="px-4 py-2 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Photos</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-for="c in concurrentsLibres" :key="c.cle">
                <td class="px-4 py-2">
                  <span class="font-medium text-gray-900 dark:text-white">{{ c.nom }}</span>
                  <span v-if="c.categories.length" class="ml-2 text-xs uppercase text-gray-400">{{ c.categories.join(', ') }}</span>
                </td>
                <td class="px-4 py-2 text-center tabular-nums">{{ c.signalements }}</td>
                <td class="px-4 py-2 text-center tabular-nums" :class="c.en_activite ? 'font-semibold text-amber-600' : 'text-gray-400'">
                  {{ c.en_activite }}
                </td>
                <td class="px-4 py-2">
                  <div v-if="c.actions.length" class="flex flex-wrap gap-1.5">
                    <span v-for="a in c.actions" :key="a" class="rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">{{ a }}</span>
                  </div>
                  <span v-else class="text-xs text-gray-400">—</span>
                </td>
                <td class="px-4 py-2 text-center">
                  <div v-if="c.photos.length" class="flex justify-center gap-1">
                    <a v-for="(p, i) in c.photos.slice(0, 3)" :key="p" :href="p" target="_blank" rel="noopener">
                      <img :src="p" :alt="`Photo ${i + 1} de ${c.nom}`" class="h-9 w-9 rounded object-cover" />
                    </a>
                  </div>
                  <span v-else class="text-xs text-gray-400">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Pie charts par catégorie: Présence/Absence -->
      <h2 class="text-lg font-bold text-gray-800 dark:text-gray-100">Présence concurrence par catégorie</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ClientOnly>
          <div v-for="cat in categories" :key="cat.key" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
            <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 text-center">{{ cat.label }}</h4>
            <ChartsPieChart
              :labels="['Absent', 'Présent']"
              :values="[catAbsent(cat.key), catPresent(cat.key)]"
              :colors="['#D1D5DB', '#EF4444']"
              height="sm"
              :show-percentages="true"
            />
          </div>
        </ClientOnly>
      </div>

      <!-- Détail concurrents par catégorie -->
      <h2 class="text-lg font-bold text-gray-800 dark:text-gray-100">Détail par concurrent</h2>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div v-for="cat in categories" :key="cat.key" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 class="font-bold text-gray-900 dark:text-gray-100 mb-4">{{ cat.label }}</h3>
          <div class="space-y-3">
            <div v-for="comp in cat.competitors" :key="comp.key" class="flex items-center justify-between">
              <span class="text-sm text-gray-700 dark:text-gray-300">{{ comp.label }}</span>
              <div class="flex items-center gap-2">
                <div class="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full"
                    :class="getCompPct(cat.key, comp.key) > 50 ? 'bg-red-500' : 'bg-orange-400'"
                    :style="{ width: getCompPct(cat.key, comp.key) + '%' }"
                  />
                </div>
                <span class="text-xs font-bold text-gray-600 w-10 text-right">{{ getCompPct(cat.key, comp.key) }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Evolution stacked bar chart -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Évolution de la concurrence par semaine</h3>
        <ClientOnly>
          <Bar v-if="evolutionChartData" :data="evolutionChartData" :options="chartOptions" />
        </ClientOnly>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Bar } from 'vue-chartjs'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const dashboard = useDashboardDirection()

const concPct = computed(() =>
  dashboard.pctWhere(v => v.data?.concurrence?.presence_concurrents)
)

// Familles + marques depuis le référentiel marque_concurrente (réunion 23/07) :
// une marque ajoutée dans les Référentiels apparaît ici sans redéploiement.
const { categories, charger: chargerMarques } = useMarquesConcurrentes()

// Un concurrent présent mais inactif n'appelle pas la même réaction qu'un
// concurrent qui pousse une promo : on compte les visites où au moins une
// famille est déclarée « en activité ».
const enActiviteCount = computed(() =>
  dashboard.countWhere(v => categories.value.some(cat => v.data?.concurrence?.[cat.key]?.en_activite))
)

// Agrégation sur nom normalisé, ancien et nouveau format confondus.
const concurrentsLibres = computed(() => agregerConcurrents(dashboard.visites.value))

function catPresent(catKey: string) {
  return dashboard.countWhere(v => v.data?.concurrence?.[catKey]?.present)
}
function catAbsent(catKey: string) {
  return dashboard.totalVisites.value - catPresent(catKey)
}

function getCompPct(catKey: string, compKey: string) {
  const withConc = dashboard.visites.value.filter(v => v.data?.concurrence?.[catKey]?.present)
  if (withConc.length === 0) return 0
  const count = withConc.filter(v => v.data?.concurrence?.[catKey]?.[compKey] === 'Présent').length
  return Math.round(count / withConc.length * 100)
}

const evolutionChartData = computed(() => {
  if (!dashboard.visites.value.length) return null

  const weeks = new Map<string, Record<string, number>>()
  const catKeys = categories.value.map(c => c.key)

  dashboard.visites.value.forEach(v => {
    const d = new Date(v.date_visite)
    const weekStart = new Date(d)
    weekStart.setDate(d.getDate() - d.getDay())
    const key = weekStart.toISOString().slice(0, 10)

    if (!weeks.has(key)) {
      weeks.set(key, Object.fromEntries(catKeys.map(k => [k, 0])))
    }
    const w = weeks.get(key)!
    for (const k of catKeys) {
      if (v.data?.concurrence?.[k]?.present) w[k]++
    }
  })

  const sorted = [...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B']

  return {
    labels: sorted.map(([k]) => new Date(k).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })),
    datasets: categories.value.map((cat, i) => ({
      label: cat.label,
      data: sorted.map(([, v]) => v[cat.key]),
      backgroundColor: colors[i],
    })),
  }
})

const chartOptions = {
  responsive: true,
  plugins: { legend: { position: 'top' as const } },
  scales: {
    x: { stacked: true },
    y: { stacked: true, beginAtZero: true },
  },
}

onMounted(() => {
  Promise.all([dashboard.fetchVisites(), chargerMarques()])
})
</script>
