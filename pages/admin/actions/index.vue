<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold text-gray-900">ACTIONS</h1>

    <DashboardFilters
      v-model="dashboard.filters.value"
      :zone-options="dashboard.availableZones.value"
      @filter="dashboard.fetchVisites()"
    />

    <div v-if="dashboard.loading.value" class="flex items-center justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-fc-blue" />
    </div>

    <template v-else>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total visites" :value="String(dashboard.totalVisites.value)" icon="i-heroicons-clipboard-document-list" color="blue" />
      </div>

      <!-- Pie charts par action -->
      <h2 class="text-lg font-bold text-gray-800">Taux de réalisation par action</h2>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <ClientOnly>
          <div v-for="action in actionDefs" :key="action.key" class="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h4 class="text-xs font-semibold text-gray-500 mb-2 text-center">{{ action.label }}</h4>
            <ChartsPieChart
              :labels="['Non', 'Oui']"
              :values="[actionAbsent(action.key), actionPresent(action.key)]"
              :colors="['#D1D5DB', '#3B82F6']"
              height="sm"
              :show-percentages="true"
            />
          </div>
        </ClientOnly>
      </div>

      <!-- Barres de progression détaillées -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 class="font-bold text-gray-900 mb-4">Détail des taux</h3>
        <div class="space-y-4">
          <div v-for="action in actionStats" :key="action.key" class="space-y-1">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-gray-700">{{ action.label }}</span>
              <span class="text-sm font-bold" :class="action.pct >= 50 ? 'text-green-600' : 'text-orange-500'">
                {{ action.pct }}% ({{ action.count }}/{{ dashboard.totalVisites.value }})
              </span>
            </div>
            <div class="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all"
                :class="action.pct >= 50 ? 'bg-green-500' : action.pct >= 25 ? 'bg-orange-400' : 'bg-red-400'"
                :style="{ width: action.pct + '%' }"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Évolution -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 class="text-sm font-semibold text-gray-700 mb-4">Évolution des actions réalisées</h3>
        <ClientOnly>
          <ChartsVisitesLineChart
            v-if="evoData.length"
            title=""
            :data="evoData"
          />
        </ClientOnly>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const dashboard = useDashboardDirection()

const actionDefs = [
  { key: 'referencement_produits', label: 'Référencement produits' },
  { key: 'execution_activites_promotionnelles', label: 'Activités promo.' },
  { key: 'prospection_pdv', label: 'Prospection PDV' },
  { key: 'verification_fifo', label: 'Vérification FIFO' },
  { key: 'rangement_produits', label: 'Rangement produits' },
  { key: 'pose_affiches', label: "Pose d'affiches" },
  { key: 'pose_materiel_visibilite', label: 'Pose mat. visibilité' },
]

function actionPresent(key: string) {
  return dashboard.countWhere(v => v.data?.actions?.[key])
}
function actionAbsent(key: string) {
  return dashboard.totalVisites.value - actionPresent(key)
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

onMounted(async () => {
  await dashboard.fetchZones()
  await dashboard.fetchVisites()
})
</script>
