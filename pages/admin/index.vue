<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Perfect Store</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        Suivez la conformité globale et les résultats par type de magasin.
      </p>
    </div>

    <div v-if="loading" class="grid gap-4 lg:grid-cols-3">
      <div class="admin-surface h-44 animate-pulse bg-slate-100 dark:bg-slate-800 lg:col-span-2" />
      <div class="admin-surface h-44 animate-pulse bg-slate-100 dark:bg-slate-800" />
    </div>

    <template v-else-if="global">
      <!-- Compteur global -->
      <div class="admin-surface relative overflow-hidden p-6 sm:p-8">
        <div class="absolute inset-y-0 left-0 w-1.5 bg-fc-red" />
        <div class="flex items-center justify-between flex-wrap gap-6">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.16em] text-fc-red">Performance réseau</p>
            <p class="mt-3 text-5xl font-semibold tracking-tight text-slate-950 dark:text-white">{{ fmtPct(global.perfect_store_pct) }}</p>
            <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {{ global.perfect_stores }} / {{ global.visites_scorees }} visites conformes
            </p>
          </div>
          <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-fc-red dark:bg-red-950/30">
            <UIcon name="i-heroicons-trophy" class="h-8 w-8" />
          </div>
        </div>
      </div>

      <!-- KPI Big Five -->
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatsCard title="Couverture du mois" :value="String(coverage?.pdv_vus ?? 0)" format="none" :icon="MapPinned" color="purple" />
        <StatsCard title="Score global moyen" :value="fmtPct(global.score_global_moyen_pct)" format="none" :icon="BarChart3" color="blue" />
        <StatsCard title="OSA pondérée moyenne" :value="fmtPct(global.osa_moyen_pct)" format="none" :icon="Package" color="green" />
        <StatsCard title="Assortiment moyen" :value="fmtPct(global.assortiment_moyen_pct)" format="none" :icon="ListChecks" color="purple" />
        <StatsCard title="Visibilité moyenne" :value="fmtPct(global.visibilite_moyenne_pct)" format="none" :icon="Eye" color="orange" />
        <StatsCard title="Promotion effective" :value="fmtPct(global.promotion_moyenne_pct)" format="none" :icon="BadgePercent" color="red" />
      </div>

      <!-- Ventilation par type de PDV (accordéons) -->
      <div class="admin-surface overflow-hidden">
        <div class="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          <h2 class="font-bold text-gray-900 dark:text-gray-100">Perfect Store par type de magasin</h2>
          <span class="text-xs text-gray-400">{{ parType.length }} type(s) · cliquez pour dérouler</span>
        </div>

        <div v-if="!parType.length" class="px-4 py-8 text-center text-sm text-gray-400">Aucune visite scorée.</div>

        <div v-else class="divide-y divide-gray-100 dark:divide-gray-700">
          <div v-for="row in parType" :key="row.type_pdv">
            <!-- En-tête accordéon -->
            <button
              type="button"
              class="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-50 dark:hover:bg-gray-700/40"
              :aria-expanded="isTypeOpen(row.type_pdv)"
              @click="toggleType(row.type_pdv)"
            >
              <UIcon
                name="i-heroicons-chevron-right"
                class="h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200"
                :class="isTypeOpen(row.type_pdv) ? 'rotate-90 text-fc-red' : ''"
              />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{{ row.type_pdv }}</span>
                <span class="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                  {{ row.visites_scorees }} visite(s) · <span class="text-emerald-600 font-medium">{{ row.perfect_stores }} perfect</span>
                </span>
              </span>
              <span class="hidden w-44 items-center gap-2 sm:flex">
                <span class="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                  <span
                    class="block h-full rounded-full transition-all"
                    :class="(row.perfect_store_pct ?? 0) >= 50 ? 'bg-emerald-500' : (row.perfect_store_pct ?? 0) > 0 ? 'bg-amber-500' : 'bg-red-500'"
                    :style="{ width: (row.perfect_store_pct ?? 0) + '%' }"
                  />
                </span>
                <span class="w-10 text-right text-xs text-gray-500 dark:text-gray-400">{{ fmtPct(row.perfect_store_pct) }}</span>
              </span>
              <span class="w-16 shrink-0 text-right text-sm font-medium tabular-nums text-gray-600 dark:text-gray-300">{{ fmtPct(row.score_global_moyen_pct) }}</span>
            </button>

            <!-- Panneau : liste paginée (client, sans rechargement) -->
            <div v-show="isTypeOpen(row.type_pdv)" class="bg-gray-50/60 px-4 pb-4 dark:bg-gray-900/20">
              <div v-if="typeState(row.type_pdv).loading" class="space-y-2 pt-3">
                <div v-for="i in 3" :key="i" class="h-14 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-700/60" />
              </div>

              <ul v-else-if="typeState(row.type_pdv).items.length" class="divide-y divide-gray-100 dark:divide-gray-700">
                <li v-for="store in typeState(row.type_pdv).items" :key="store.visite_id">
                  <button
                    type="button"
                    class="flex w-full items-center justify-between gap-4 rounded-lg px-2 py-3 text-left transition hover:bg-white focus-visible:bg-white dark:hover:bg-gray-700/40 dark:focus-visible:bg-gray-700/40"
                    @click="openStoreDetail(store)"
                  >
                    <span class="min-w-0 flex-1">
                      <span class="flex items-center gap-2">
                        <span class="h-2 w-2 shrink-0 rounded-full" :class="tierDotClass(store.niveau)" />
                        <span class="truncate text-sm font-semibold text-gray-900 dark:text-white">{{ store.nom_pdv || store.pdv_id }}</span>
                      </span>
                      <span class="mt-1 block truncate pl-4 text-xs text-gray-500 dark:text-gray-400">
                        {{ store.niveau }}<template v-if="store.zone"> · {{ store.zone }}</template><template v-if="store.commercial"> · {{ store.commercial }}</template>
                      </span>
                    </span>
                    <span class="shrink-0 text-right">
                      <span class="block text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{{ fmtPct(store.score_global) }}</span>
                      <span class="mt-1 block text-xs text-gray-400">{{ formatDate(store.date_visite) }}</span>
                    </span>
                  </button>
                </li>
              </ul>

              <div v-else class="pt-6 pb-2 text-center text-sm text-gray-400">Aucun magasin dans ce type.</div>

              <div v-if="typeState(row.type_pdv).total > typePerPage" class="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-700">
                <span class="text-xs text-gray-400">Page {{ typeState(row.type_pdv).page }} / {{ typePageCount(typeState(row.type_pdv).total) }} · {{ typeState(row.type_pdv).total }} au total</span>
                <div class="flex gap-2">
                  <UButton
                    size="xs"
                    variant="outline"
                    :disabled="typeState(row.type_pdv).page <= 1 || typeState(row.type_pdv).loading"
                    @click="changeTypePage(row.type_pdv, typeState(row.type_pdv).page - 1)"
                  >
                    Précédent
                  </UButton>
                  <UButton
                    size="xs"
                    variant="outline"
                    :disabled="typeState(row.type_pdv).page >= typePageCount(typeState(row.type_pdv).total) || typeState(row.type_pdv).loading"
                    @click="changeTypePage(row.type_pdv, typeState(row.type_pdv).page + 1)"
                  >
                    Suivant
                  </UButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p class="text-xs text-gray-400">Couverture = nombre de PDV distincts effectivement visités pendant le mois. La promotion est exclue du score lorsqu’elle n’est pas applicable.</p>

      <!-- PDV classés par niveau -->
      <section class="admin-surface overflow-hidden" aria-labelledby="stores-by-tier-heading">
        <div class="border-b border-slate-100 px-5 py-4 dark:border-slate-700">
          <h2 id="stores-by-tier-heading" class="font-bold text-gray-900 dark:text-gray-100">Points de vente par niveau</h2>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Chaque magasin apparaît dans le niveau obtenu lors de sa dernière visite.
          </p>
        </div>

        <div class="grid xl:grid-cols-2">
          <article
            v-for="tier in tierStoreLists"
            :key="tier.code"
            class="border-b border-slate-100 p-5 odd:xl:border-r dark:border-slate-700"
          >
            <div class="mb-4 flex items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <span class="h-2.5 w-2.5 rounded-full" :class="tierDotClass(tier.code)" />
                <h3 class="font-semibold text-slate-900 dark:text-white">{{ tier.code }}</h3>
              </div>
              <span class="text-xs font-medium text-slate-400">{{ tier.total }} magasin(s)</span>
            </div>

            <div v-if="tier.loading" class="space-y-2">
              <div v-for="i in 3" :key="i" class="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-700/60" />
            </div>

            <ul v-else-if="tier.items.length" class="divide-y divide-slate-100 dark:divide-slate-700">
              <li v-for="store in tier.items" :key="store.pdv_id">
                <button
                  type="button"
                  class="flex w-full items-center justify-between gap-4 rounded-lg py-3 text-left transition hover:bg-slate-50 focus-visible:bg-slate-50 dark:hover:bg-slate-700/40 dark:focus-visible:bg-slate-700/40"
                  @click="openStoreDetail(store)"
                >
                  <div class="min-w-0 px-2">
                    <p class="truncate text-sm font-semibold text-slate-900 dark:text-white">{{ store.nom_pdv || store.pdv_id }}</p>
                    <p class="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                      {{ store.type_pdv }}<template v-if="store.zone"> · {{ store.zone }}</template>
                    </p>
                  </div>
                  <div class="shrink-0 px-2 text-right">
                    <p class="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{{ fmtPct(store.score_global) }}</p>
                    <p class="mt-1 text-xs text-slate-400">{{ formatDate(store.date_visite) }}</p>
                  </div>
                </button>
              </li>
            </ul>

            <div v-else class="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400 dark:bg-slate-700/30">
              Aucun magasin dans ce niveau.
            </div>

            <div v-if="tier.total > storesPerPage" class="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-700">
              <span class="text-xs text-slate-400">Page {{ tier.page }} / {{ tierPageCount(tier.total) }}</span>
              <div class="flex gap-2">
                <UButton size="xs" variant="outline" :disabled="tier.page <= 1 || tier.loading" @click="changeTierPage(tier.code, tier.page - 1)">
                  Précédent
                </UButton>
                <UButton size="xs" variant="outline" :disabled="tier.page >= tierPageCount(tier.total) || tier.loading" @click="changeTierPage(tier.code, tier.page + 1)">
                  Suivant
                </UButton>
              </div>
            </div>
          </article>
        </div>

        <div v-if="storesError" class="border-t border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
          La liste détaillée sera disponible après l’application de la migration Perfect Store la plus récente.
        </div>
      </section>
    </template>

    <div v-else class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-sm text-amber-800 dark:text-amber-200">
      Vues Perfect Store indisponibles. Lance les migrations <code>supabase/nouveau</code> dans Supabase.
    </div>

    <!-- Explication du calcul et seuils par niveau -->
    <div class="admin-surface overflow-hidden">
      <div class="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
        <h2 class="font-bold text-gray-900 dark:text-gray-100">Comprendre le résultat</h2>
      </div>
      <div class="p-5 space-y-4">
        <p class="text-sm text-gray-600 dark:text-gray-300">
          Chaque visite est comparée aux standards du type de magasin. Le point de vente obtient le meilleur niveau
          pour lequel tous les critères sont atteints.
        </p>

        <div class="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-700/40">
            <p class="font-semibold text-gray-900 dark:text-gray-100">Disponibilité</p>
            <p class="mt-1 text-gray-500 dark:text-gray-400">Les produits attendus sont disponibles.</p>
          </div>
          <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-700/40">
            <p class="font-semibold text-gray-900 dark:text-gray-100">Assortiment</p>
            <p class="mt-1 text-gray-500 dark:text-gray-400">Les références requises sont présentes.</p>
          </div>
          <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-700/40">
            <p class="font-semibold text-gray-900 dark:text-gray-100">Visibilité</p>
            <p class="mt-1 text-gray-500 dark:text-gray-400">Les supports demandés sont installés.</p>
          </div>
          <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-700/40">
            <p class="font-semibold text-gray-900 dark:text-gray-100">Promotion</p>
            <p class="mt-1 text-gray-500 dark:text-gray-400">La promotion est correctement mise en place.</p>
          </div>
        </div>

        <!-- Seuils par niveau -->
        <div class="overflow-x-auto border border-gray-100 dark:border-gray-700 rounded-lg">
          <table class="admin-table text-sm">
            <thead class="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Niveau</th>
                <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Disponibilité</th>
                <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Assortiment</th>
                <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Visibilité</th>
                <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Promotion</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-for="t in tiers" :key="t.ps_tier">
                <td class="px-4 py-2 font-bold text-gray-900 dark:text-gray-100">{{ t.ps_tier }}</td>
                <td class="px-4 py-2 text-center">{{ fmtRatio(t.osa_min) }}</td>
                <td class="px-4 py-2 text-center">{{ fmtRatio(t.assort_min) }}</td>
                <td class="px-4 py-2 text-center">{{ fmtRatio(t.visi_min) }}</td>
                <td class="px-4 py-2 text-center text-gray-400">{{ t.promo_min == null ? 'Non évaluée' : fmtRatio(t.promo_min) }}</td>
              </tr>
              <tr v-if="!tiers.length">
                <td colspan="5" class="px-4 py-6 text-center text-xs text-gray-400">Seuils indisponibles — lance les migrations Big Five.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="text-xs text-gray-400">
          Un magasin est Perfect Store dès qu’il atteint le niveau BASIC.
          <NuxtLink to="/admin/perfect-store/standards" class="text-fc-red underline">Modifier les standards</NuxtLink>
        </p>
      </div>
    </div>

    <VisitDetailModal
      v-model="showStoreDetail"
      :visite="selectedStoreVisite"
      :perfect-store="selectedStorePerfect"
    />
  </div>
</template>

<script setup lang="ts">
import { BarChart3, Package, Eye, MapPinned, BadgePercent, ListChecks } from 'lucide-vue-next'
import type {
  CoverageKpi,
  PerfectStoreGlobalKpi,
  PerfectStoreListItem,
  PerfectStoreTypeKpi,
} from '~/composables/usePerfectStore'
import type { Visite } from '~/types'
import type { PerfectStoreResultB } from '~/utils/perfectStore'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const visitesStore = useVisitesStore()
const {
  refs,
  fetchRefs,
  scoreVisite,
  fetchGlobalKpi,
  fetchKpiParType,
  fetchCoverage,
  fetchStoresByTier,
  fetchPerfectStoreListe,
} = usePerfectStore()

const loading = ref(true)
const global = ref<PerfectStoreGlobalKpi | null>(null)
const parType = ref<PerfectStoreTypeKpi[]>([])
const coverage = ref<CoverageKpi | null>(null)
const storesPerPage = 5
const storesError = ref(false)
const showStoreDetail = ref(false)
const selectedStoreVisite = ref<Visite | null>(null)
const selectedStorePerfect = ref<PerfectStoreResultB | null>(null)
const tierStoreState = reactive<Record<string, {
  items: PerfectStoreListItem[]
  total: number
  page: number
  loading: boolean
}>>({})

// Seuils de tier (live depuis les référentiels), triés du + exigeant au - exigeant
const tiers = computed(() => [...(refs.value?.tierConfig || [])].sort((a, b) => b.rang - a.rang))
const tierStoreLists = computed(() => tiers.value.map(tier => ({
  code: tier.ps_tier,
  ...(tierStoreState[tier.ps_tier] || { items: [], total: 0, page: 1, loading: true }),
})))

function fmtPct(v: number | null | undefined): string {
  return v == null ? '—' : `${v}%`
}
function fmtRatio(v: number | null | undefined): string {
  return v == null ? 'off' : `${Math.round(v * 100)}%`
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function tierDotClass(tier: string): string {
  if (tier.startsWith('FLAGSHIP')) return 'bg-violet-500'
  if (tier.startsWith('VIP')) return 'bg-emerald-500'
  if (tier.startsWith('CORE')) return 'bg-blue-500'
  return 'bg-amber-500'
}

function tierPageCount(total: number): number {
  return Math.max(1, Math.ceil(total / storesPerPage))
}

async function loadTierStores(tier: string, page = 1) {
  const state = tierStoreState[tier] || { items: [], total: 0, page: 1, loading: false }
  tierStoreState[tier] = state
  state.loading = true
  try {
    const result = await fetchStoresByTier(tier, page, storesPerPage)
    state.items = result.items
    state.total = result.total
    state.page = page
  }
  catch {
    storesError.value = true
    state.items = []
    state.total = 0
  }
  finally {
    state.loading = false
  }
}

function changeTierPage(tier: string, page: number) {
  loadTierStores(tier, page)
}

// ---- Accordéons "par type de magasin" : liste paginée par 10, client-side ----
const typePerPage = 10
type TypeStore = { items: PerfectStoreListItem[]; total: number; page: number; loading: boolean }
const EMPTY_TYPE_STATE: TypeStore = { items: [], total: 0, page: 1, loading: false }
const openTypes = reactive(new Set<string>())
const typeStoreState = reactive<Record<string, TypeStore>>({})

function typeState(type: string): TypeStore {
  return typeStoreState[type] || EMPTY_TYPE_STATE
}
function isTypeOpen(type: string): boolean {
  return openTypes.has(type)
}
function typePageCount(total: number): number {
  return Math.max(1, Math.ceil(total / typePerPage))
}

async function loadTypeStores(type: string, page = 1) {
  if (!typeStoreState[type]) typeStoreState[type] = { items: [], total: 0, page: 1, loading: false }
  const state = typeStoreState[type]
  state.loading = true
  try {
    const result = await fetchPerfectStoreListe({ type, page, perPage: typePerPage })
    state.items = result.items
    state.total = result.total
    state.page = page
  }
  catch {
    state.items = []
    state.total = 0
  }
  finally {
    state.loading = false
  }
}

function toggleType(type: string) {
  if (openTypes.has(type)) {
    openTypes.delete(type)
    return
  }
  openTypes.add(type)
  if (!typeStoreState[type]) loadTypeStores(type, 1)
}

function changeTypePage(type: string, page: number) {
  loadTypeStores(type, page)
}

async function openStoreDetail(store: PerfectStoreListItem) {
  try {
    const visite = await visitesStore.fetchVisiteByDatabaseId(store.visite_id)
    selectedStoreVisite.value = visite
    selectedStorePerfect.value = refs.value ? scoreVisite(visite.data, visite.pdv || {}) : null
    showStoreDetail.value = true
  }
  catch {
    selectedStoreVisite.value = null
    selectedStorePerfect.value = null
  }
}

onMounted(async () => {
  await fetchRefs()
  try {
    const [g, t, c] = await Promise.all([fetchGlobalKpi(), fetchKpiParType(), fetchCoverage()])
    global.value = g
    parType.value = t
    coverage.value = c
    await Promise.all(tiers.value.map(tier => loadTierStores(tier.ps_tier)))
  } finally {
    loading.value = false
  }
})
</script>
