<template>
  <div id="dashboard-print-area" class="space-y-6">
    <div v-if="loadingDashboard" class="space-y-6" role="status" aria-label="Chargement du tableau de bord">
      <div class="h-9 w-72 max-w-full animate-pulse rounded-md bg-slate-200 dark:bg-slate-700" />
      <div class="grid gap-5 lg:grid-cols-12">
        <div class="admin-surface h-56 animate-pulse lg:col-span-7" />
        <div class="grid grid-cols-2 gap-4 lg:col-span-5">
          <div v-for="i in 4" :key="i" class="admin-surface h-28 animate-pulse" />
        </div>
      </div>
    </div>

    <template v-else>
      <AdminPageHeader class="print:hidden" description="La couverture terrain, la performance des équipes et la disponibilité produit, tous points de vente confondus.">
        <template #description>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">{{ lastRefreshLabel }}</p>
        </template>
        <template #actions>
          <UButton size="sm" color="gray" variant="ghost" icon="i-heroicons-printer" @click="handlePrint">Imprimer</UButton>
          <UDropdown :items="exportMenuItems">
            <UButton size="sm" variant="outline" icon="i-heroicons-arrow-down-tray" trailing-icon="i-heroicons-chevron-down">
              Exporter
            </UButton>
          </UDropdown>
        </template>
      </AdminPageHeader>

      <!-- Une seule vue : ce qui est à traiter, les indicateurs, puis l'activité récente. -->
      <section v-if="dashboardAlerts.length" class="admin-surface overflow-hidden" aria-labelledby="dashboard-alerts-heading">
        <div class="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 id="dashboard-alerts-heading" class="text-lg font-semibold text-slate-900 dark:text-white">À traiter maintenant</h2>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Les points qui demandent une action ou une vérification.</p>
        </div>
        <ul class="divide-y divide-slate-200 dark:divide-slate-700">
          <li v-for="alert in dashboardAlerts" :key="alert.key">
            <component
              :is="peutOuvrir(alert.to) ? LienNuxt : 'div'"
              :to="peutOuvrir(alert.to) ? alert.to : undefined"
              class="group flex items-center gap-3 px-5 py-3"
              :class="peutOuvrir(alert.to) ? 'transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 dark:hover:bg-slate-700/40 dark:focus-visible:bg-slate-700/40' : ''"
            >
              <UIcon
                :name="alert.level === 'critical' ? 'i-heroicons-exclamation-circle' : 'i-heroicons-exclamation-triangle'"
                class="h-5 w-5 shrink-0"
                :class="alert.level === 'critical' ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'"
                aria-hidden="true"
              />
              <span class="min-w-0 flex-1">
                <span class="flex flex-wrap items-center gap-2">
                  <span class="text-sm font-semibold text-slate-900 dark:text-white">{{ alert.title }}</span>
                  <span
                    class="rounded-full px-2 py-0.5 text-xs font-semibold"
                    :class="alert.level === 'critical' ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-200' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'"
                  >{{ alert.level === 'critical' ? 'Critique' : 'À surveiller' }}</span>
                </span>
                <span class="mt-0.5 block text-sm text-slate-600 dark:text-slate-300">{{ alert.description }}</span>
              </span>
              <span class="shrink-0 text-lg font-semibold tabular-nums text-slate-900 dark:text-white">{{ alert.value }}</span>
              <span v-if="peutOuvrir(alert.to)" class="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-fc-red">
                Ouvrir
                <UIcon name="i-heroicons-arrow-right" class="h-4 w-4" aria-hidden="true" />
              </span>
            </component>
          </li>
        </ul>
      </section>

      <section v-if="psGlobal" aria-labelledby="performance-heading" class="grid gap-5 lg:grid-cols-12">
        <NuxtLink
          to="/admin"
          class="admin-surface group flex flex-col justify-between gap-6 p-5 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 dark:hover:bg-slate-700/40 lg:col-span-7"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 id="performance-heading" class="text-base font-semibold text-slate-900 dark:text-white">Performance Perfect Store</h2>
              <p class="mt-3 text-3xl font-bold leading-none tabular-nums text-slate-900 dark:text-white">
                {{ formatPercent(psGlobal.perfect_store_pct) }}
              </p>
              <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">des visites évaluées sont au standard</p>
            </div>
            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300" aria-hidden="true">
              <Trophy class="h-4 w-4" />
            </div>
          </div>
          <div>
            <div class="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600 dark:text-slate-300">
              <span><strong class="font-semibold tabular-nums text-slate-900 dark:text-white">{{ numberFormatter.format(psGlobal.perfect_stores ?? 0) }}</strong> visites conformes</span>
              <span><strong class="font-semibold tabular-nums text-slate-900 dark:text-white">{{ numberFormatter.format(psGlobal.visites_scorees ?? 0) }}</strong> évaluées</span>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700" aria-hidden="true">
              <div class="h-full rounded-full bg-slate-700 transition-all duration-700 dark:bg-slate-200" :style="{ width: perfectStoreProgress }" />
            </div>
            <p class="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-fc-red">
              Ouvrir l'analyse détaillée
              <UIcon name="i-heroicons-arrow-right" class="h-4 w-4" aria-hidden="true" />
            </p>
          </div>
        </NuxtLink>

        <div class="grid grid-cols-2 gap-4 lg:col-span-5">
          <component
            :is="peutOuvrir(metric.to) ? LienNuxt : 'div'"
            v-for="metric in activityMetrics"
            :key="metric.label"
            :to="peutOuvrir(metric.to) ? metric.to : undefined"
            class="admin-metric-tile"
            :class="peutOuvrir(metric.to) ? 'transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 dark:hover:bg-slate-700/40' : ''"
          >
            <div class="flex items-start justify-between gap-3">
              <p class="text-xs font-semibold text-slate-600 dark:text-slate-300">{{ metric.label }}</p>
              <component :is="metric.icon" class="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-300" aria-hidden="true" />
            </div>
            <p class="mt-3 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{{ metric.value }}</p>
            <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">{{ metric.hint }}</p>
          </component>
        </div>
      </section>

      <section v-if="psGlobal" aria-labelledby="pillars-heading">
        <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="pillars-heading" class="text-lg font-semibold text-slate-900 dark:text-white">Santé des piliers</h2>
            <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Les composantes qui déterminent la conformité Perfect Store.</p>
          </div>
          <NuxtLink
            v-if="peutOuvrir('/admin/perfect-store/standards')"
            to="/admin/perfect-store/standards"
            class="text-sm font-semibold text-fc-red underline-offset-4 hover:underline"
          >
            Voir les standards
          </NuxtLink>
        </div>
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard title="Disponibilité en rayon (pondérée)" :value="formatPercent(psGlobal.osa_moyen_pct ?? 0)" format="none" subtitle="Quantité au moins égale au seuil" :icon="Package" color="green" />
          <StatsCard title="Assortiment" :value="formatPercent(psGlobal.assortiment_moyen_pct ?? 0)" format="none" subtitle="Références minimum et prioritaires" :icon="ListChecks" color="blue" />
          <StatsCard title="Visibilité" :value="formatPercent(psGlobal.visibilite_moyenne_pct ?? 0)" format="none" subtitle="PLV requise présente" :icon="Eye" color="orange" />
          <StatsCard title="Promotion" :value="formatPercent(psGlobal.promotion_moyenne_pct ?? 0)" format="none" subtitle="Quand une promotion est en cours" :icon="BadgePercent" color="red" />
        </div>
      </section>

      <section class="grid gap-6 xl:grid-cols-12">
        <article class="admin-surface p-6 xl:col-span-5" aria-labelledby="dispo-categorie-heading">
          <div class="mb-5">
            <h3 id="dispo-categorie-heading" class="text-base font-semibold text-slate-900 dark:text-white">Disponibilité par catégorie</h3>
            <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">Part des visites où la catégorie est présente. Seuil d'alerte : 40 %.</p>
          </div>
          <ul v-if="productCategories.length" class="space-y-5">
            <li v-for="cat in productCategories" :key="cat.key">
              <div class="mb-2 flex items-center justify-between gap-3">
                <span class="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  {{ cat.label }}
                  <span v-if="Number(cat.value) < 40" class="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-200">Sous le seuil</span>
                </span>
                <span class="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{{ formatPercent(cat.value) }}</span>
              </div>
              <div class="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700" aria-hidden="true">
                <div class="h-full rounded-full transition-all duration-700" :style="{ width: `${Math.min(100, Math.max(0, cat.value))}%`, backgroundColor: couleurFamille(cat.key) }" />
              </div>
            </li>
          </ul>
          <p v-else class="text-sm text-slate-600 dark:text-slate-300">Aucune catégorie de relevé active. Elles se règlent dans les référentiels.</p>
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

        <article class="admin-surface overflow-hidden xl:col-span-7" aria-labelledby="activite-commerciaux-heading">
          <div class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-6 py-5 dark:border-slate-700">
            <div>
              <h3 id="activite-commerciaux-heading" class="text-base font-semibold text-slate-900 dark:text-white">Activité des commerciaux</h3>
              <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">Classement selon le volume total de visites.</p>
            </div>
            <UButton size="xs" variant="outline" icon="i-heroicons-arrow-down-tray" class="print:hidden" :disabled="!stats?.performance_commerciaux?.length" @click="exportPerformance">Exporter (CSV)</UButton>
          </div>
          <div v-if="stats?.performance_commerciaux?.length" class="overflow-x-auto">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Commercial</th>
                  <th class="text-right">Total</th>
                  <th class="text-right">Ce mois</th>
                  <th>Volume relatif</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="com in stats.performance_commerciaux.slice(0, 8)" :key="com.email">
                  <td>
                    <div class="flex items-center gap-3">
                      <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200" aria-hidden="true">
                        {{ com.nom?.substring(0, 2).toUpperCase() }}
                      </div>
                      <div class="min-w-0">
                        <p class="font-medium text-slate-900 dark:text-white">{{ com.nom }}</p>
                        <p class="truncate text-xs text-slate-600 dark:text-slate-300">{{ com.email }}</p>
                      </div>
                    </div>
                  </td>
                  <td class="text-right font-semibold tabular-nums text-slate-900 dark:text-white">{{ numberFormatter.format(com.total_visites ?? 0) }}</td>
                  <td class="text-right tabular-nums">{{ numberFormatter.format(com.visites_mois ?? 0) }}</td>
                  <td>
                    <div class="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700" aria-hidden="true">
                      <div class="h-full rounded-full bg-slate-600 transition-all dark:bg-slate-300" :style="{ width: getProgressWidth(com) }" />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="px-6 py-14 text-center">
            <ClipboardList class="mx-auto h-9 w-9 text-slate-300 dark:text-slate-600" aria-hidden="true" />
            <p class="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Aucune visite enregistrée pour l'instant</p>
            <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Les commerciaux apparaîtront ici dès leurs premières visites.</p>
          </div>
        </article>
      </section>

      <CommerciauxEnTournee class="print:hidden" />

      <section class="admin-surface overflow-hidden" aria-labelledby="recent-visits-heading">
        <div class="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700 sm:px-6">
          <div>
            <h2 id="recent-visits-heading" class="text-lg font-semibold text-slate-900 dark:text-white">Dernières visites</h2>
            <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Les visites terrain les plus récentes.</p>
          </div>
          <UButton
            size="xs"
            color="gray"
            variant="ghost"
            icon="i-heroicons-arrow-path"
            :loading="loadingRecentVisits"
            aria-label="Actualiser les dernières visites"
            @click="fetchRecentVisits"
          />
        </div>
        <ChargementContenu v-if="loadingRecentVisits" variante="lignes" :nombre="3" libelle="Chargement des dernières visites…" class="px-5 py-5 sm:px-6" />
        <div v-else-if="recentVisits.length" class="divide-y divide-slate-200 dark:divide-slate-700">
          <NuxtLink
            v-for="visit in recentVisits"
            :key="visit.id"
            to="/admin/visites"
            class="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 dark:hover:bg-slate-800/70 sm:px-6"
          >
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200" aria-hidden="true">
              <UIcon name="i-heroicons-clipboard-document-check" class="h-4 w-4" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium text-slate-900 dark:text-white">{{ visit.pdv?.nom_pdv || 'Point de vente sans nom' }}</span>
              <span class="mt-0.5 block truncate text-xs text-slate-600 dark:text-slate-300">{{ visit.commercial || 'Commercial non renseigné' }}</span>
            </span>
            <time class="shrink-0 text-xs tabular-nums text-slate-600 dark:text-slate-300" :datetime="visit.date_visite">{{ formatRecentDate(visit.date_visite) }}</time>
          </NuxtLink>
        </div>
        <div v-else class="px-5 py-8 text-center sm:px-6">
          <UIcon name="i-heroicons-inbox" class="mx-auto h-7 w-7 text-slate-300 dark:text-slate-600" aria-hidden="true" />
          <p class="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Aucune visite récente</p>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Les nouvelles visites apparaîtront ici dès leur envoi depuis le terrain.</p>
        </div>
        <div class="border-t border-slate-200 px-5 py-3 dark:border-slate-700 sm:px-6">
          <NuxtLink to="/admin/visites" class="inline-flex items-center gap-1 text-sm font-semibold text-fc-red underline-offset-4 hover:underline">
            Voir toutes les visites
            <UIcon name="i-heroicons-arrow-right" class="h-4 w-4" aria-hidden="true" />
          </NuxtLink>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ClipboardList, Calendar, MapPin, Users, Trophy, Package, Eye, BadgePercent, ListChecks } from 'lucide-vue-next'
import { couleurFamille } from '~/utils/chartPalette'

definePageMeta({
  middleware: ['auth', 'admin'],
  layout: 'admin',
})

const visitesStore = useVisitesStore()
const authStore = useAuthStore()
const { exportToCsv } = useCsvExport()
const { fetchGlobalKpi, fetchCoverage } = usePerfectStore()
const toast = useToast()
const { peutOuvrir } = useAdminNavigation()
// Lien seulement vers un écran que le compte peut ouvrir (sinon simple tuile).
const LienNuxt = resolveComponent('NuxtLink')

const loadingDashboard = ref(true)
const stats = computed(() => visitesStore.stats)
const psGlobal = ref<Awaited<ReturnType<typeof fetchGlobalKpi>> | null>(null)
const coverage = ref<Awaited<ReturnType<typeof fetchCoverage>> | null>(null)
const loadingRecentVisits = ref(true)
const recentVisits = ref<Array<{
  id: string
  date_visite: string
  commercial: string | null
  pdv?: { nom_pdv?: string } | null
}>>([])
const supabase: any = useSupabaseClient()
const numberFormatter = new Intl.NumberFormat('fr-FR')
const lastRefreshAt = ref<Date | null>(null)

const dashboardAlerts = computed(() => {
  const alerts: Array<{ key: string; title: string; description: string; value: string; to: string; level: 'warning' | 'critical' }> = []
  const lowCategories = productCategories.value.filter(category => Number(category.value) < 40)
  if (lowCategories.length > 0) {
    alerts.push({ key: 'products-low', title: 'Disponibilité', description: `${lowCategories.map(category => category.label).join(', ')} sous le seuil de 40 %.`, value: String(lowCategories.length), to: '/admin/produits/recap', level: 'critical' })
  }
  if (psGlobal.value && Number(psGlobal.value.perfect_store_pct ?? 0) < 40) {
    alerts.push({ key: 'perfect-store-low', title: 'Perfect Store', description: 'Le score global est sous le seuil critique.', value: formatPercent(psGlobal.value.perfect_store_pct), to: '/admin', level: 'critical' })
  }
  return alerts.slice(0, 4)
})

const lastRefreshLabel = computed(() => {
  if (!lastRefreshAt.value) return 'Actualisation en cours'
  return `Données actualisées à ${lastRefreshAt.value.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
})

async function fetchRecentVisits() {
  loadingRecentVisits.value = true
  try {
    const { data } = await supabase
      .from('visites')
      .select('id, date_visite, commercial, pdv:pdv_id(nom_pdv)')
      .order('date_visite', { ascending: false })
      .limit(4)
    recentVisits.value = (data || [])
  }
  catch {
    recentVisits.value = []
  }
  finally {
    loadingRecentVisits.value = false
  }
}

function formatRecentDate(value: string) {
  if (!value) return 'Date inconnue'
  return formatDateFr(value, { day: '2-digit', month: 'short' })
}

const activityMetrics = computed(() => [
  {
    label: 'Couverture du mois',
    value: `${numberFormatter.format(coverage.value?.pdv_vus ?? 0)} / ${numberFormatter.format(coverage.value?.pdv_total ?? 0)}`,
    hint: coverage.value?.couverture_pct != null
      ? `${formatPercent(coverage.value.couverture_pct)} du parc visité`
      : 'points de vente visités sur le parc actif',
    icon: MapPin,
    to: '/admin/pdv',
  },
  {
    label: 'Visites ce mois',
    value: numberFormatter.format(stats.value?.visites_month ?? 0),
    hint: 'Activité de la période',
    icon: Calendar,
    to: '/admin/visites',
  },
  {
    label: 'Parc actif',
    value: numberFormatter.format(stats.value?.total_pdv ?? 0),
    hint: 'Points de vente',
    icon: MapPin,
    to: '/admin/pdv',
  },
  {
    label: 'Équipe active',
    value: numberFormatter.format(stats.value?.total_commerciaux ?? 0),
    hint: `${numberFormatter.format(stats.value?.total_visites ?? 0)} visites cumulées`,
    icon: Users,
    to: '/admin/visites/commerciaux',
  },
])

const perfectStoreProgress = computed(() => {
  const value = Number(psGlobal.value?.perfect_store_pct ?? 0)
  return `${Math.min(100, Math.max(0, value))}%`
})

const { filtrer: filtrerCategoriesReleve, charger: chargerCategoriesReleve } = useCategoriesReleve()
const productCategories = computed(() => filtrerCategoriesReleve([
  { key: 'evap', label: 'EVAP', value: stats.value?.taux_evap ?? 0 },
  { key: 'imp', label: 'IMP', value: stats.value?.taux_imp ?? 0 },
  { key: 'scm', label: 'SCM', value: stats.value?.taux_scm ?? 0 },
  { key: 'uht', label: 'UHT', value: stats.value?.taux_uht ?? 0 },
  { key: 'yaourt', label: 'Yaourt', value: stats.value?.taux_yaourt ?? 0 },
], c => c.key))

function formatPercent(value: number | null | undefined) {
  if (value == null) return '—'
  return `${Number(value).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`
}

function getProgressWidth(com: any) {
  const max = stats.value?.performance_commerciaux?.[0]?.total_visites || 1
  return `${Math.round((com.total_visites / max) * 100)}%`
}

// ---- Export Functions ----
const exportMenuItems = computed(() => [[
  {
    label: 'Indicateurs et taux (CSV)',
    icon: 'i-heroicons-chart-bar',
    click: () => exportKPIs(),
  },
  {
    label: 'Activité des commerciaux (CSV)',
    icon: 'i-heroicons-users',
    click: () => exportPerformance(),
  },
  {
    label: 'Visites par jour (CSV)',
    icon: 'i-heroicons-calendar-days',
    click: () => exportVisitesParJour(),
  },
  {
    label: 'Répartition des points de vente (CSV)',
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
  toast.add({ title: 'Indicateurs exportés', color: 'green' })
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
  toast.add({ title: 'Activité des commerciaux exportée', color: 'green' })
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
  toast.add({ title: 'Répartition exportée', color: 'green' })
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
  void chargerCategoriesReleve()
  fetchRecentVisits()
  fetchGlobalKpi().then(g => { psGlobal.value = g }).catch(() => {})
  fetchCoverage().then(c => { coverage.value = c }).catch(() => {})
  try {
    await visitesStore.fetchStats()
    lastRefreshAt.value = new Date()
    // Statistiques vides : normal pour un compte agence (elles portent sur tout
    // le parc, pas sur son agence) ; sinon on le signale sans jargon.
    if (!stats.value?.total_visites && !stats.value?.total_pdv && !authStore.isAgence) {
      toast.add({
        title: 'Aucune statistique pour l’instant',
        description: 'Les chiffres apparaîtront dès que des visites auront été enregistrées. Si ce n’est pas normal, prévenez l’administrateur technique.',
        color: 'amber',
        icon: 'i-heroicons-information-circle',
        timeout: 8000,
      })
    }
  }
  catch {
    toast.add({
      title: 'Erreur de chargement',
      description: 'Les statistiques n\'ont pas pu être chargées. Rechargez la page dans quelques instants.',
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
    font-size: 12px;
  }
  /* Force background colors for print */
  .bg-white {
    background-color: white !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .bg-slate-50 {
    background-color: #f8fafc !important;
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
