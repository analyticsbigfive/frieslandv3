<template>
  <div id="dashboard-print-area" class="space-y-8">
    <div v-if="loadingDashboard" class="space-y-6" aria-label="Chargement du tableau de bord">
      <div class="h-9 w-72 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
      <div class="grid gap-5 lg:grid-cols-12">
        <div class="h-64 animate-pulse rounded-3xl bg-white dark:bg-slate-800 lg:col-span-7" />
        <div class="grid grid-cols-2 gap-4 lg:col-span-5">
          <div v-for="i in 4" :key="i" class="h-28 animate-pulse rounded-2xl bg-white dark:bg-slate-800" />
        </div>
      </div>
    </div>

    <template v-else>
      <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between print:hidden">
        <div>
          <p class="text-sm font-medium text-fc-red">Pilotage commercial</p>
          <h2 class="mt-1 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">Vue d’ensemble</h2>
          <p class="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Suivi du Perfect Store, de la couverture terrain et de la disponibilité produit.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <UButton size="sm" variant="ghost" icon="i-heroicons-printer" @click="handlePrint">Imprimer</UButton>
          <UDropdown :items="exportMenuItems">
            <UButton size="sm" variant="outline" icon="i-heroicons-arrow-down-tray" trailing-icon="i-heroicons-chevron-down">
              Exporter
            </UButton>
          </UDropdown>
        </div>
      </header>

      <CommerciauxEnTournee class="print:hidden" />

      <section v-if="psGlobal" aria-labelledby="performance-heading" class="grid gap-5 lg:grid-cols-12">
        <NuxtLink
          to="/admin/perfect-store"
          class="group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.45)] transition duration-300 hover:-translate-y-0.5 hover:border-red-200 dark:border-slate-700 dark:bg-slate-800 lg:col-span-7"
        >
          <div class="absolute inset-y-0 left-0 w-1.5 bg-fc-red" />
          <div class="flex h-full flex-col justify-between gap-8 pl-2">
            <div class="flex items-start justify-between gap-4">
              <div>
                <p id="performance-heading" class="text-sm font-semibold text-slate-500 dark:text-slate-400">Performance Perfect Store</p>
                <div class="mt-3 flex items-end gap-3">
                  <span class="text-6xl font-semibold tracking-[-0.06em] text-slate-950 dark:text-white">
                    {{ formatPercent(psGlobal.perfect_store_pct) }}
                  </span>
                  <span class="mb-2 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-fc-red dark:bg-red-950/40">
                    {{ psGlobal.perfect_stores }} conformes
                  </span>
                </div>
              </div>
              <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-fc-red transition group-hover:scale-105 dark:bg-red-950/40">
                <Trophy class="h-6 w-6" />
              </div>
            </div>
            <div>
              <div class="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>{{ psGlobal.perfect_stores }} visites conformes</span>
                <span>{{ psGlobal.visites_scorees }} évaluées</span>
              </div>
              <div class="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                <div class="h-full rounded-full bg-fc-red transition-all duration-700" :style="{ width: perfectStoreProgress }" />
              </div>
              <p class="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-fc-red">
                Ouvrir l’analyse détaillée
                <UIcon name="i-heroicons-arrow-right" class="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </p>
            </div>
          </div>
        </NuxtLink>

        <div class="grid grid-cols-2 gap-4 lg:col-span-5">
          <article v-for="metric in activityMetrics" :key="metric.label" class="admin-metric-tile">
            <div class="flex items-start justify-between gap-3">
              <p class="text-sm font-medium text-slate-500 dark:text-slate-400">{{ metric.label }}</p>
              <component :is="metric.icon" class="h-4 w-4 text-slate-400" />
            </div>
            <p class="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{{ metric.value }}</p>
            <p class="mt-1 text-xs text-slate-400 dark:text-slate-500">{{ metric.hint }}</p>
          </article>
        </div>
      </section>

      <section v-if="psGlobal" aria-labelledby="pillars-heading">
        <div class="mb-4 flex items-end justify-between gap-4">
          <div>
            <h3 id="pillars-heading" class="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">Santé des piliers</h3>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Les composantes qui déterminent la conformité Perfect Store.</p>
          </div>
          <NuxtLink to="/admin/perfect-store/standards" class="text-sm font-semibold text-fc-red hover:underline">Voir les standards</NuxtLink>
        </div>
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard title="OSA pondérée" :value="psGlobal.osa_moyen_pct ?? 0" format="percent" subtitle="Disponibilité au seuil" :icon="Package" color="green" />
          <StatsCard title="Assortiment" :value="psGlobal.assortiment_moyen_pct ?? 0" format="percent" subtitle="Minimum SKU et Hero" :icon="ListChecks" color="purple" />
          <StatsCard title="Visibilité" :value="psGlobal.visibilite_moyenne_pct ?? 0" format="percent" subtitle="PLV requise présente" :icon="Eye" color="orange" />
          <StatsCard title="Promotion" :value="psGlobal.promotion_moyenne_pct ?? 0" format="percent" subtitle="Si une promotion est active" :icon="BadgePercent" color="red" />
        </div>
      </section>

      <section class="grid gap-6 xl:grid-cols-12">
        <article class="admin-surface p-6 xl:col-span-5">
          <div class="mb-6">
            <h3 class="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">Disponibilité par catégorie</h3>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Part des visites où la catégorie est présente.</p>
          </div>
          <div class="space-y-5">
            <div v-for="cat in productCategories" :key="cat.key">
              <div class="mb-2 flex items-center justify-between">
                <span class="text-sm font-medium text-slate-700 dark:text-slate-300">{{ cat.label }}</span>
                <span class="text-sm font-semibold tabular-nums" :class="getPercentColor(cat.value)">{{ cat.value }}%</span>
              </div>
              <div class="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                <div class="h-full rounded-full transition-all duration-700" :class="getPercentBarColor(cat.value)" :style="{ width: `${Math.min(100, Math.max(0, cat.value))}%` }" />
              </div>
            </div>
          </div>
        </article>

        <div class="xl:col-span-7">
          <ClientOnly>
            <ChartsVisitesLineChart title="Évolution des visites" :data="stats?.visites_par_jour ?? []" />
          </ClientOnly>
        </div>
      </section>

      <section class="grid gap-6 xl:grid-cols-12">
        <div class="xl:col-span-5">
          <ClientOnly>
            <ChartsDistributionChart title="Répartition des points de vente" :data="stats?.distribution_pdv ?? []" />
          </ClientOnly>
        </div>

        <article class="admin-surface overflow-hidden xl:col-span-7">
          <div class="flex items-center justify-between border-b border-slate-100 px-6 py-5 dark:border-slate-700">
            <div>
              <h3 class="font-semibold text-slate-950 dark:text-white">Activité des commerciaux</h3>
              <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Classement selon le volume total de visites.</p>
            </div>
            <UButton size="xs" variant="ghost" icon="i-heroicons-arrow-down-tray" class="print:hidden" @click="exportPerformance">CSV</UButton>
          </div>
          <div class="overflow-x-auto">
            <table class="admin-table w-full">
              <thead>
                <tr>
                  <th>Commercial</th>
                  <th class="text-center">Total</th>
                  <th class="text-center">Ce mois</th>
                  <th>Volume relatif</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="com in stats?.performance_commerciaux?.slice(0, 8)" :key="com.email">
                  <td>
                    <div class="flex items-center gap-3">
                      <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                        {{ com.nom?.substring(0, 2).toUpperCase() }}
                      </div>
                      <div>
                        <p class="font-medium text-slate-900 dark:text-white">{{ com.nom }}</p>
                        <p class="text-xs text-slate-400">{{ com.email }}</p>
                      </div>
                    </div>
                  </td>
                  <td class="text-center font-semibold tabular-nums">{{ com.total_visites }}</td>
                  <td class="text-center font-semibold tabular-nums text-fc-red">{{ com.visites_mois }}</td>
                  <td>
                    <div class="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                      <div class="h-full rounded-full bg-fc-red transition-all" :style="{ width: getProgressWidth(com) }" />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="!stats?.performance_commerciaux?.length" class="px-6 py-14 text-center">
            <ClipboardList class="mx-auto h-9 w-9 text-slate-300" />
            <p class="mt-3 text-sm font-medium text-slate-500">Aucune activité disponible</p>
          </div>
        </article>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ClipboardList, Calendar, MapPin, Users, Trophy, Package, Eye, BadgePercent, ListChecks } from 'lucide-vue-next'

definePageMeta({
  middleware: ['auth', 'admin'],
  layout: 'admin',
})

const visitesStore = useVisitesStore()
const { exportToCsv } = useCsvExport()
const { fetchGlobalKpi, fetchCoverage } = usePerfectStore()
const toast = useToast()

const loadingDashboard = ref(true)
const stats = computed(() => visitesStore.stats)
const psGlobal = ref<Awaited<ReturnType<typeof fetchGlobalKpi>> | null>(null)
const coverage = ref<Awaited<ReturnType<typeof fetchCoverage>> | null>(null)
const numberFormatter = new Intl.NumberFormat('fr-FR')

const activityMetrics = computed(() => [
  {
    label: 'Couverture du mois',
    value: numberFormatter.format(coverage.value?.pdv_vus ?? 0),
    hint: 'PDV distincts visités',
    icon: MapPin,
  },
  {
    label: 'Visites ce mois',
    value: numberFormatter.format(stats.value?.visites_month ?? 0),
    hint: 'Activité de la période',
    icon: Calendar,
  },
  {
    label: 'Parc actif',
    value: numberFormatter.format(stats.value?.total_pdv ?? 0),
    hint: 'Points de vente',
    icon: MapPin,
  },
  {
    label: 'Équipe active',
    value: numberFormatter.format(stats.value?.total_commerciaux ?? 0),
    hint: `${numberFormatter.format(stats.value?.total_visites ?? 0)} visites cumulées`,
    icon: Users,
  },
])

const perfectStoreProgress = computed(() => {
  const value = Number(psGlobal.value?.perfect_store_pct ?? 0)
  return `${Math.min(100, Math.max(0, value))}%`
})

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

function getPercentBarColor(val: number) {
  if (val >= 70) return 'bg-emerald-500'
  if (val >= 40) return 'bg-amber-500'
  return 'bg-fc-red'
}

function formatPercent(value: number | null | undefined) {
  if (value == null) return '—'
  return `${Number(value).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}%`
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
  fetchGlobalKpi().then(g => { psGlobal.value = g }).catch(() => {})
  fetchCoverage().then(c => { coverage.value = c }).catch(() => {})
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
