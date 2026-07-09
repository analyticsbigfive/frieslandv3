<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Perfect Store — liste par niveau</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Un point de vente par ligne, avec le niveau obtenu à sa dernière visite scorée.
        </p>
      </div>
      <NuxtLink to="/admin/perfect-store" class="text-sm text-fc-red underline">← Tableau de bord</NuxtLink>
    </div>

    <!-- Filtres -->
    <div class="admin-surface flex flex-wrap items-end gap-3 p-4">
      <div class="flex-1 min-w-[220px]">
        <label class="mb-1 block text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Recherche</label>
        <UInput v-model="search" icon="i-heroicons-magnifying-glass" placeholder="Nom, code PDV, zone…" size="sm" @update:model-value="onFilterChange" />
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Niveau</label>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="opt in niveauOptions"
            :key="opt.value"
            type="button"
            class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
            :class="niveau === opt.value ? 'bg-fc-red text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'"
            @click="setNiveau(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="admin-surface overflow-hidden">
      <div class="overflow-x-auto">
        <table class="admin-table w-full">
          <thead class="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th class="th-l">Point de vente</th>
              <th class="th-l">Type</th>
              <th class="th-l">Zone</th>
              <th class="th-c">Niveau</th>
              <th class="th-c">Score</th>
              <th class="th-c">Dispo</th>
              <th class="th-c">Visi</th>
              <th class="th-l">Dernière visite</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr v-if="loading">
              <td colspan="8" class="px-4 py-10 text-center text-sm text-gray-400">
                <UIcon name="i-heroicons-arrow-path" class="mx-auto h-6 w-6 animate-spin text-fc-red" />
              </td>
            </tr>
            <tr
              v-for="row in items"
              v-else
              :key="row.pdv_id"
              class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
              @click="openDetail(row)"
            >
              <td class="px-4 py-2.5">
                <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ row.nom_pdv || row.pdv_id }}</p>
                <p class="text-xs text-gray-400">{{ row.pdv_id }}</p>
              </td>
              <td class="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{{ row.type_pdv }}</td>
              <td class="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{{ row.zone || '—' }}</td>
              <td class="px-4 py-2.5 text-center">
                <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" :class="niveauBadge(row.niveau)">
                  <span class="h-1.5 w-1.5 rounded-full" :class="niveauDot(row.niveau)" />
                  {{ row.niveau }}
                </span>
              </td>
              <td class="px-4 py-2.5 text-center text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{{ pct(row.score_global) }}</td>
              <td class="px-4 py-2.5 text-center text-sm tabular-nums text-gray-500 dark:text-gray-400">{{ pct(row.dispo_rayon) }}</td>
              <td class="px-4 py-2.5 text-center text-sm tabular-nums text-gray-500 dark:text-gray-400">{{ pct(row.visibilite) }}</td>
              <td class="px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400">
                {{ formatDate(row.date_visite) }}<template v-if="row.commercial"> · {{ row.commercial }}</template>
              </td>
            </tr>
            <tr v-if="!loading && !items.length">
              <td colspan="8" class="px-4 py-10 text-center text-sm text-gray-400">Aucun magasin pour ce filtre.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="total > perPage" class="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-gray-700">
        <span class="text-xs text-gray-400">{{ total }} magasin(s) · page {{ page }} / {{ pageCount }}</span>
        <div class="flex gap-2">
          <UButton size="xs" variant="outline" :disabled="page <= 1 || loading" @click="goto(page - 1)">Précédent</UButton>
          <UButton size="xs" variant="outline" :disabled="page >= pageCount || loading" @click="goto(page + 1)">Suivant</UButton>
        </div>
      </div>
    </div>

    <div v-if="error" class="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
      Liste indisponible — lance la migration <code>v_perfect_store_liste_full</code> (supabase/nouveau).
    </div>

    <VisitDetailModal v-model="showDetail" :visite="selectedVisite" :perfect-store="selectedPerfect" />
  </div>
</template>

<script setup lang="ts">
import type { PerfectStoreListItem } from '~/composables/usePerfectStore'
import type { Visite } from '~/types'
import type { PerfectStoreResultB } from '~/utils/perfectStore'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const { refs, fetchRefs, scoreVisite, fetchPerfectStoreListe } = usePerfectStore()
const visitesStore = useVisitesStore()

const items = ref<PerfectStoreListItem[]>([])
const total = ref(0)
const page = ref(1)
const perPage = 20
const loading = ref(true)
const error = ref(false)
const search = ref('')
const niveau = ref('TOUS')

const showDetail = ref(false)
const selectedVisite = ref<Visite | null>(null)
const selectedPerfect = ref<PerfectStoreResultB | null>(null)

const niveauOptions = [
  { value: 'TOUS', label: 'Tous' },
  { value: 'FLAGSHIP', label: 'Flagship' },
  { value: 'VIP', label: 'VIP' },
  { value: 'CORE', label: 'Core' },
  { value: 'BASIC', label: 'Basic' },
  { value: 'NON CONFORME', label: 'Non conforme' },
]

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / perPage)))

const pct = (v: number | null | undefined) => v == null ? '—' : `${v}%`
const formatDate = (v: string) => new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

function niveauDot(n: string): string {
  if (n?.startsWith('FLAGSHIP')) return 'bg-violet-500'
  if (n?.startsWith('VIP')) return 'bg-emerald-500'
  if (n?.startsWith('CORE')) return 'bg-blue-500'
  if (n?.startsWith('BASIC')) return 'bg-amber-500'
  return 'bg-red-500'
}
function niveauBadge(n: string): string {
  if (n?.startsWith('FLAGSHIP')) return 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300'
  if (n?.startsWith('VIP')) return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
  if (n?.startsWith('CORE')) return 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
  if (n?.startsWith('BASIC')) return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
  return 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
async function load() {
  loading.value = true
  try {
    const res = await fetchPerfectStoreListe({ niveau: niveau.value, search: search.value, page: page.value, perPage })
    items.value = res.items
    total.value = res.total
    error.value = false
  }
  catch {
    error.value = true
    items.value = []
    total.value = 0
  }
  finally {
    loading.value = false
  }
}

function onFilterChange() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1; load() }, 350)
}
function setNiveau(v: string) {
  niveau.value = v
  page.value = 1
  load()
}
function goto(p: number) {
  page.value = p
  load()
}

async function openDetail(row: PerfectStoreListItem) {
  try {
    const visite = await visitesStore.fetchVisiteByDatabaseId(row.visite_id)
    selectedVisite.value = visite
    selectedPerfect.value = refs.value ? scoreVisite(visite.data, visite.pdv || {}) : null
    showDetail.value = true
  }
  catch {
    selectedVisite.value = null
    selectedPerfect.value = null
  }
}

onMounted(async () => {
  await fetchRefs()
  await load()
})
</script>

<style scoped>
.th-l { @apply px-4 py-2.5 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400; }
.th-c { @apply px-4 py-2.5 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400; }
</style>
