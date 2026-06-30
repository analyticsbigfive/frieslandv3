<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Perfect Store</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        Compteur global + ventilation par type de magasin. Score recalculé à chaque visite (base : taux de vente).
      </p>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-fc-red" />
    </div>

    <template v-else-if="global">
      <!-- Compteur global -->
      <div class="bg-gradient-to-br from-fc-red to-fc-red-600 rounded-2xl p-6 text-white shadow-sm">
        <div class="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p class="text-sm/none opacity-80 mb-1">Taux Perfect Store global</p>
            <p class="text-5xl font-extrabold">{{ fmtPct(global.perfect_store_pct) }}</p>
            <p class="text-sm opacity-80 mt-2">
              {{ global.perfect_stores }} / {{ global.visites_scorees }} visites conformes
            </p>
          </div>
          <UIcon name="i-heroicons-trophy" class="w-20 h-20 opacity-30" />
        </div>
      </div>

      <!-- KPI Big Five -->
      <div class="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <StatsCard title="Couverture du mois" :value="String(coverage?.pdv_vus ?? 0)" format="none" :icon="MapPinned" color="purple" />
        <StatsCard title="Score global moyen" :value="fmtPct(global.score_global_moyen_pct)" format="none" :icon="BarChart3" color="blue" />
        <StatsCard title="OSA pondérée moyenne" :value="fmtPct(global.osa_moyen_pct)" format="none" :icon="Package" color="green" />
        <StatsCard title="Visibilité moyenne" :value="fmtPct(global.visibilite_moyenne_pct)" format="none" :icon="Eye" color="orange" />
        <StatsCard title="Promotion effective" :value="fmtPct(global.promotion_moyenne_pct)" format="none" :icon="BadgePercent" color="red" />
      </div>

      <!-- Ventilation par type de PDV -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div class="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          <h2 class="font-bold text-gray-900 dark:text-gray-100">Perfect Store par type de magasin</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                <th class="px-4 py-2.5 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Visites</th>
                <th class="px-4 py-2.5 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Perfect</th>
                <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-56">% Perfect Store</th>
                <th class="px-4 py-2.5 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Score moyen</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-for="row in parType" :key="row.type_pdv" class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td class="px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100">{{ row.type_pdv }}</td>
                <td class="px-4 py-2.5 text-center text-sm text-gray-500 dark:text-gray-400">{{ row.visites_scorees }}</td>
                <td class="px-4 py-2.5 text-center text-sm font-medium text-emerald-600">{{ row.perfect_stores }}</td>
                <td class="px-4 py-2.5">
                  <div class="flex items-center gap-2">
                    <div class="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                      <div
                        class="h-full rounded-full"
                        :class="(row.perfect_store_pct ?? 0) >= 50 ? 'bg-emerald-500' : (row.perfect_store_pct ?? 0) > 0 ? 'bg-amber-500' : 'bg-red-500'"
                        :style="{ width: (row.perfect_store_pct ?? 0) + '%' }"
                      />
                    </div>
                    <span class="text-xs text-gray-500 dark:text-gray-400 w-12 text-right">{{ fmtPct(row.perfect_store_pct) }}</span>
                  </div>
                </td>
                <td class="px-4 py-2.5 text-center text-sm text-gray-600 dark:text-gray-300">{{ fmtPct(row.score_global_moyen_pct) }}</td>
              </tr>
              <tr v-if="!parType.length">
                <td colspan="5" class="px-4 py-8 text-center text-sm text-gray-400">Aucune visite scorée.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p class="text-xs text-gray-400">Couverture = nombre de PDV distincts effectivement visités pendant le mois. La promotion est exclue du score lorsqu’elle n’est pas applicable.</p>
    </template>

    <div v-else class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-sm text-amber-800 dark:text-amber-200">
      Vues Perfect Store indisponibles. Lance les migrations <code>supabase/nouveau</code> dans Supabase.
    </div>

    <!-- Légende : comprendre le calcul + seuils par tier -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div class="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
        <h2 class="font-bold text-gray-900 dark:text-gray-100">Comment le Perfect Store est calculé</h2>
      </div>
      <div class="p-5 space-y-4">
        <p class="text-sm text-gray-600 dark:text-gray-300">
          100% déduit des données de visite (quantités par SKU + visibilité), comparées aux standards.
          Un PDV décroche le <strong>tier le plus élevé</strong> dont il remplit <strong>tous</strong> les minimums simultanément (règle conjonctive).
        </p>

        <dl class="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt class="font-semibold text-gray-900 dark:text-gray-100">Tier</dt>
            <dd class="text-gray-500 dark:text-gray-400">Niveau Perfect Store : FLAGSHIP &gt; VIP &gt; CORE &gt; BASIC. Atteindre ≥ BASIC = « Perfect Store ».</dd>
          </div>
          <div>
            <dt class="font-semibold text-gray-900 dark:text-gray-100">OSA min</dt>
            <dd class="text-gray-500 dark:text-gray-400">Disponibilité pondérée minimale : part des SKU disponibles (qté ≥ seuil), pondérée par importance commerciale.</dd>
          </div>
          <div>
            <dt class="font-semibold text-gray-900 dark:text-gray-100">Assort min</dt>
            <dd class="text-gray-500 dark:text-gray-400">Assortiment minimal : SKU présents ÷ nombre minimum requis pour le type de PDV.</dd>
          </div>
          <div>
            <dt class="font-semibold text-gray-900 dark:text-gray-100">Visi min</dt>
            <dd class="text-gray-500 dark:text-gray-400">Visibilité minimale : part des éléments PLV requis (poster, sign board, réglettes…) réellement présents.</dd>
          </div>
          <div>
            <dt class="font-semibold text-gray-900 dark:text-gray-100">Promo min</dt>
            <dd class="text-gray-500 dark:text-gray-400">Exécution promo minimale. « off » = non prise en compte aujourd'hui (activable).</dd>
          </div>
        </dl>

        <!-- Seuils par tier (live) -->
        <div class="overflow-x-auto border border-gray-100 dark:border-gray-700 rounded-lg">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tier</th>
                <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">OSA min</th>
                <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Assort min</th>
                <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Visi min</th>
                <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Promo min</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-for="t in tiers" :key="t.ps_tier">
                <td class="px-4 py-2 font-bold text-gray-900 dark:text-gray-100">{{ t.ps_tier }}</td>
                <td class="px-4 py-2 text-center">{{ fmtRatio(t.osa_min) }}</td>
                <td class="px-4 py-2 text-center">{{ fmtRatio(t.assort_min) }}</td>
                <td class="px-4 py-2 text-center">{{ fmtRatio(t.visi_min) }}</td>
                <td class="px-4 py-2 text-center text-gray-400">{{ t.promo_min == null ? 'off' : fmtRatio(t.promo_min) }}</td>
              </tr>
              <tr v-if="!tiers.length">
                <td colspan="5" class="px-4 py-6 text-center text-xs text-gray-400">Seuils indisponibles — lance les migrations Big Five.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="text-xs text-gray-400">
          Distinct du <strong>score global</strong> (moyenne pondérée continue des piliers, pour les tendances). Seuils éditables dans
          <NuxtLink to="/admin/perfect-store/standards" class="text-fc-red underline">Standards</NuxtLink>.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { BarChart3, Package, Eye, MapPinned, BadgePercent } from 'lucide-vue-next'
import type { CoverageKpi, PerfectStoreGlobalKpi, PerfectStoreTypeKpi } from '~/composables/usePerfectStore'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const { refs, fetchRefs, fetchGlobalKpi, fetchKpiParType, fetchCoverage } = usePerfectStore()

const loading = ref(true)
const global = ref<PerfectStoreGlobalKpi | null>(null)
const parType = ref<PerfectStoreTypeKpi[]>([])
const coverage = ref<CoverageKpi | null>(null)

// Seuils de tier (live depuis les référentiels), triés du + exigeant au - exigeant
const tiers = computed(() => [...(refs.value?.tierConfig || [])].sort((a, b) => b.rang - a.rang))

function fmtPct(v: number | null | undefined): string {
  return v == null ? '—' : `${v}%`
}
function fmtRatio(v: number | null | undefined): string {
  return v == null ? 'off' : `${Math.round(v * 100)}%`
}

onMounted(async () => {
  fetchRefs()
  try {
    const [g, t, c] = await Promise.all([fetchGlobalKpi(), fetchKpiParType(), fetchCoverage()])
    global.value = g
    parType.value = t
    coverage.value = c
  } finally {
    loading.value = false
  }
})
</script>
