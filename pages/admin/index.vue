<template>
  <div id="dashboard-print-area">
    <definePageMeta :middleware="['auth', 'admin']" :layout="'admin'" />

    <!-- Loading Overlay -->
    <div v-if="loadingDashboard" class="flex flex-col items-center justify-center py-24 gap-4">
      <div class="animate-spin w-10 h-10 border-4 border-fc-blue border-t-transparent rounded-full" />
      <p class="text-sm text-gray-500 dark:text-gray-400">Chargement du tableau de bord…</p>
    </div>

    <template v-else>
    <!-- Header with actions -->
    <div class="flex items-center justify-between mb-6 print:hidden">
      <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">Tableau de bord</h2>
      <div class="flex items-center gap-2">
        <UButton
          size="sm"
          variant="outline"
          icon="i-heroicons-printer"
          @click="handlePrint"
        >
          Imprimer
        </UButton>
        <UDropdown :items="exportMenuItems">
          <UButton
            size="sm"
            variant="outline"
            icon="i-heroicons-arrow-down-tray"
            trailing-icon="i-heroicons-chevron-down"
          >
            Exporter
          </UButton>
        </UDropdown>
      </div>
    </div>

    <!-- KPI Cards Row -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatsCard
        title="Total Visites"
        :value="stats?.total_visites ?? 0"
        subtitle="Tous les temps"
        :icon="ClipboardList"
        color="blue"
      />
      <StatsCard
        title="Visites ce mois"
        :value="stats?.visites_month ?? 0"
        subtitle="Mois en cours"
        :icon="Calendar"
        color="green"
      />
      <StatsCard
        title="Points de Vente"
        :value="stats?.total_pdv ?? 0"
        subtitle="PDV actifs"
        :icon="MapPin"
        color="orange"
      />
      <StatsCard
        title="Commerciaux"
        :value="stats?.total_commerciaux ?? 0"
        subtitle="Actifs ce mois"
        :icon="Users"
        color="purple"
      />
    </div>

    <!-- Taux de présence produits -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
      <div
        v-for="cat in productCategories"
        :key="cat.key"
        class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 text-center"
      >
        <p class="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">{{ cat.label }}</p>
        <p class="text-2xl font-bold" :class="getPercentColor(cat.value)">
          {{ cat.value }}%
        </p>
        <p class="text-[10px] text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-0.5">présence</p>
      </div>
    </div>

    <!-- Charts Row -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <ClientOnly>
        <ChartsVisitesLineChart
          title="Évolution des visites"
          :data="stats?.visites_par_jour ?? []"
        />
      </ClientOnly>

      <ClientOnly>
        <ChartsDistributionChart
          title="Distribution par type de PDV"
          :data="stats?.distribution_pdv ?? []"
        />
      </ClientOnly>
    </div>

    <!-- Performance Commerciaux -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div class="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Performance Commerciaux</h3>
        <div class="flex items-center gap-2">
          <UButton
            size="xs"
            variant="ghost"
            icon="i-heroicons-arrow-down-tray"
            class="print:hidden"
            @click="exportPerformance"
          >
            CSV
          </UButton>
          <NuxtLink to="/admin/users" class="text-xs text-fc-blue hover:underline print:hidden">
            Voir tout →
          </NuxtLink>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th class="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Commercial</th>
              <th class="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Email</th>
              <th class="px-5 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
              <th class="px-5 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ce mois</th>
              <th class="px-5 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Progression</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr
              v-for="com in stats?.performance_commerciaux?.slice(0, 10)"
              :key="com.email"
              class="hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <td class="px-5 py-3">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-fc-blue-50 text-fc-blue flex items-center justify-center text-xs font-medium">
                    {{ com.nom?.substring(0, 2).toUpperCase() }}
                  </div>
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ com.nom }}</span>
                </div>
              </td>
              <td class="px-5 py-3 text-sm text-gray-500 dark:text-gray-400">{{ com.email }}</td>
              <td class="px-5 py-3 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">{{ com.total_visites }}</td>
              <td class="px-5 py-3 text-center text-sm font-semibold text-fc-blue">{{ com.visites_mois }}</td>
              <td class="px-5 py-3">
                <div class="flex items-center justify-center">
                  <div class="w-24 h-2 bg-gray-100 dark:bg-gray-600 rounded-full overflow-hidden">
                    <div
                      class="h-full bg-fc-blue rounded-full transition-all"
                      :style="{ width: getProgressWidth(com) }"
                    />
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="!stats?.performance_commerciaux?.length" class="p-12 text-center text-gray-400 dark:text-gray-500 dark:text-gray-400">
        <ClipboardList class="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Aucune donnée de performance disponible</p>
      </div>
    </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ClipboardList, Calendar, MapPin, Users } from 'lucide-vue-next'

definePageMeta({
  middleware: ['auth', 'admin'],
  layout: 'admin',
})

const visitesStore = useVisitesStore()
const { exportToCsv } = useCsvExport()
const toast = useToast()

const loadingDashboard = ref(true)
const stats = computed(() => visitesStore.stats)

const productCategories = computed(() => [
  { key: 'evap', label: 'EVAP', value: stats.value?.taux_evap ?? 0 },
  { key: 'imp', label: 'IMP', value: stats.value?.taux_imp ?? 0 },
  { key: 'scm', label: 'SCM', value: stats.value?.taux_scm ?? 0 },
  { key: 'uht', label: 'UHT', value: stats.value?.taux_uht ?? 0 },
  { key: 'yaourt', label: 'YAOURT', value: stats.value?.taux_yaourt ?? 0 },
])

function getPercentColor(val: number) {
  if (val >= 70) return 'text-emerald-600'
  if (val >= 40) return 'text-amber-600'
  return 'text-red-600'
}

function getProgressWidth(com: any) {
  const max = stats.value?.performance_commerciaux?.[0]?.total_visites || 1
  return `${Math.round((com.total_visites / max) * 100)}%`
}

// ---- Export Functions ----
const exportMenuItems = computed(() => [[
  {
    label: 'KPIs & Taux (CSV)',
    icon: 'i-heroicons-chart-bar',
    click: () => exportKPIs(),
  },
  {
    label: 'Performance Commerciaux (CSV)',
    icon: 'i-heroicons-users',
    click: () => exportPerformance(),
  },
  {
    label: 'Visites par jour (CSV)',
    icon: 'i-heroicons-calendar-days',
    click: () => exportVisitesParJour(),
  },
  {
    label: 'Distribution PDV (CSV)',
    icon: 'i-heroicons-map-pin',
    click: () => exportDistribution(),
  },
  {
    label: 'Tout exporter (CSV)',
    icon: 'i-heroicons-arrow-down-tray',
    click: () => exportAll(),
  },
]])

function exportKPIs() {
  if (!stats.value) return
  const data = [{
    'Total Visites': stats.value.total_visites,
    'Visites ce mois': stats.value.visites_month,
    'Visites cette semaine': stats.value.visites_week,
    'Visites aujourd\'hui': stats.value.visites_today,
    'Total PDV': stats.value.total_pdv,
    'Total Commerciaux': stats.value.total_commerciaux,
    'Taux EVAP (%)': stats.value.taux_evap,
    'Taux IMP (%)': stats.value.taux_imp,
    'Taux SCM (%)': stats.value.taux_scm,
    'Taux UHT (%)': stats.value.taux_uht,
    'Taux YAOURT (%)': stats.value.taux_yaourt,
    'Prix EVAP respectés (%)': stats.value.taux_prix_evap,
    'Prix IMP respectés (%)': stats.value.taux_prix_imp,
    'Prix SCM respectés (%)': stats.value.taux_prix_scm,
  }]
  exportToCsv(data, `dashboard-kpis-${new Date().toISOString().slice(0, 10)}.csv`)
  toast.add({ title: 'KPIs exportés', color: 'green' })
}

function exportPerformance() {
  if (!stats.value?.performance_commerciaux?.length) return
  const data = stats.value.performance_commerciaux.map(c => ({
    'Commercial': c.nom,
    'Email': c.email,
    'Total Visites': c.total_visites,
    'Visites ce mois': c.visites_mois,
    'Taux Complétion (%)': c.taux_completion,
  }))
  exportToCsv(data, `performance-commerciaux-${new Date().toISOString().slice(0, 10)}.csv`)
  toast.add({ title: 'Performance exportée', color: 'green' })
}

function exportVisitesParJour() {
  if (!stats.value?.visites_par_jour?.length) return
  const data = stats.value.visites_par_jour.map(v => ({
    'Date': v.date,
    'Nombre de visites': v.count,
  }))
  exportToCsv(data, `visites-par-jour-${new Date().toISOString().slice(0, 10)}.csv`)
  toast.add({ title: 'Visites par jour exportées', color: 'green' })
}

function exportDistribution() {
  if (!stats.value?.distribution_pdv?.length) return
  const data = stats.value.distribution_pdv.map(d => ({
    'Type de PDV': d.type,
    'Nombre': d.count,
  }))
  exportToCsv(data, `distribution-pdv-${new Date().toISOString().slice(0, 10)}.csv`)
  toast.add({ title: 'Distribution exportée', color: 'green' })
}

function exportAll() {
  exportKPIs()
  exportPerformance()
  exportVisitesParJour()
  exportDistribution()
}

function handlePrint() {
  window.print()
}

// Load stats on mount
onMounted(async () => {
  loadingDashboard.value = true
  try {
    await visitesStore.fetchStats()
    if (!stats.value?.total_visites && !stats.value?.total_pdv) {
      toast.add({
        title: 'Aucune donnée',
        description: 'Les vues SQL ne semblent pas configurées. Exécutez les migrations Supabase.',
        color: 'amber',
        icon: 'i-heroicons-exclamation-triangle',
        timeout: 8000,
      })
    }
  }
  catch {
    toast.add({
      title: 'Erreur de chargement',
      description: 'Impossible de charger les statistiques du dashboard.',
      color: 'red',
      icon: 'i-heroicons-exclamation-triangle',
    })
  }
  finally {
    loadingDashboard.value = false
  }
})
</script>

<style>
@media print {
  /* Hide everything except the dashboard content */
  body * {
    visibility: hidden;
  }
  #dashboard-print-area,
  #dashboard-print-area * {
    visibility: visible;
  }
  #dashboard-print-area {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    padding: 20px;
  }
  /* Hide sidebar, nav, and action buttons */
  aside, nav, [class*="print\:hidden"] {
    display: none !important;
  }
  /* Improve table print styling */
  table {
    font-size: 11px;
  }
  /* Force background colors for print */
  .bg-white {
    background-color: white !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .bg-gray-50 {
    background-color: #f9fafb !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  /* Page setup */
  @page {
    margin: 15mm;
    size: landscape;
  }
}
</style>
