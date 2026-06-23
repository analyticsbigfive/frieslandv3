<template>
  <div>
    <div class="mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Perfect Store par visite</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Score et conformité Perfect Store de chaque visite (mêmes filtres que la section Visites).</p>
    </div>

    <!-- Filters (identiques à la section Visites) -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 mb-6">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <UFormGroup label="Date début">
          <UInput v-model="filters.dateFrom" type="date" size="sm" />
        </UFormGroup>
        <UFormGroup label="Date fin">
          <UInput v-model="filters.dateTo" type="date" size="sm" />
        </UFormGroup>
        <UFormGroup label="Commercial">
          <USelectMenu
            v-model="filters.commercial"
            :options="commercialOptions"
            placeholder="Tous"
            size="sm"
            searchable
            searchable-placeholder="Rechercher..."
            :search-attributes="['label']"
            value-attribute="value"
            option-attribute="label"
          />
        </UFormGroup>
        <UFormGroup label="Email">
          <USelectMenu
            v-model="filters.email"
            :options="emailOptions"
            placeholder="Tous"
            size="sm"
            searchable
            searchable-placeholder="Rechercher..."
            :search-attributes="['label']"
            value-attribute="value"
            option-attribute="label"
          />
        </UFormGroup>
        <div class="flex items-end gap-2">
          <UButton size="sm" icon="i-heroicons-magnifying-glass" @click="loadVisites">Filtrer</UButton>
          <UButton size="sm" variant="ghost" @click="resetFilters">Reset</UButton>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Commercial</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">PDV</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">OSA pond.</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Assort.</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Visi.</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Score</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Conformité</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="row in scored" :key="row.v.visite_id" class="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{{ formatDate(row.v.date_visite) }}</td>
              <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{{ row.v.commercial }}</td>
              <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{{ row.v.pdv?.nom_pdv || row.v.pdv_id?.substring(0, 8) }}</td>
              <td class="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{{ row.v.pdv?.sous_categorie_pdv || '—' }}</td>
              <td class="px-4 py-3 text-center text-sm">{{ pct(row.ps?.osaPondere) }}</td>
              <td class="px-4 py-3 text-center text-sm">{{ pct(row.ps?.assortimentTaux) }}</td>
              <td class="px-4 py-3 text-center text-sm">{{ pct(row.ps?.visibiliteTaux) }}</td>
              <td class="px-4 py-3 text-center">
                <span class="text-sm font-bold" :class="scoreColor(row.ps?.scoreGlobal)">{{ pct(row.ps?.scoreGlobal) }}</span>
              </td>
              <td class="px-4 py-3 text-center">
                <UBadge v-if="row.ps?.isPerfectStore" :color="tierColor(row.ps.tierAtteint)" variant="soft" size="sm">
                  {{ row.ps.tierAtteint }}
                </UBadge>
                <UBadge v-else color="gray" variant="soft" size="sm">Non conforme</UBadge>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="!loading && !visites.length" class="p-12 text-center text-gray-400">
        <UIcon name="i-heroicons-trophy" class="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Aucune visite trouvée</p>
      </div>
      <div v-if="loading" class="p-12 text-center">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-fc-red mx-auto" />
      </div>

      <!-- Pagination -->
      <div class="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ total }} visite(s)</p>
        <div class="flex gap-2">
          <UButton size="xs" variant="outline" :disabled="filters.page <= 1" @click="filters.page--; loadVisites()">Précédent</UButton>
          <UButton size="xs" variant="outline" :disabled="visites.length < filters.perPage" @click="filters.page++; loadVisites()">Suivant</UButton>
        </div>
      </div>
    </div>

    <p v-if="!refsReady" class="mt-3 text-xs text-amber-600">
      Référentiels Perfect Store indisponibles (lance la migration <code>013_016_perfect_store.sql</code>) — scores vides en attendant.
    </p>
  </div>
</template>

<script setup lang="ts">
import type { PerfectTier } from '~/utils/perfectStore'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const visitesStore = useVisitesStore()
const { users: cachedUsers, fetchUsers: fetchCachedUsers } = useUsersCache()
const { refs, fetchRefs, scoreVisite } = usePerfectStore()

const visites = computed(() => visitesStore.visites)
const total = computed(() => visitesStore.total)
const loading = computed(() => visitesStore.loading)
const filters = visitesStore.filters
const refsReady = computed(() => !!refs.value)

const commercialOptions = computed(() => [
  { value: '', label: 'Tous' },
  ...cachedUsers.value.filter(u => u.is_active !== false).map(u => ({ value: u.nom || u.email || '', label: `${u.nom || '—'} (${u.email})` })),
])
const emailOptions = computed(() => [
  { value: '', label: 'Tous' },
  ...cachedUsers.value.filter(u => u.is_active !== false && u.email).map(u => ({ value: u.email!, label: u.email! })),
])

// Score chaque visite côté client (parité SQL via utils/perfectStore)
const scored = computed(() =>
  visites.value.map(v => ({
    v,
    ps: refs.value ? scoreVisite((v as any).data, (v as any).pdv || {}) : null,
  })),
)

function pct(v: number | null | undefined): string {
  return v == null ? '—' : `${Math.round(v * 100)}%`
}
function scoreColor(v: number | null | undefined): string {
  if (v == null) return 'text-gray-400'
  if (v >= 0.85) return 'text-emerald-600'
  if (v >= 0.6) return 'text-amber-600'
  return 'text-red-600'
}
function tierColor(t: PerfectTier | null | undefined): any {
  const map: Record<string, string> = { FLAGSHIP: 'purple', VIP: 'green', CORE: 'blue', BASIC: 'orange' }
  return (t && map[t]) || 'gray'
}
function formatDate(date: string) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function resetFilters() {
  filters.dateFrom = ''
  filters.dateTo = ''
  filters.commercial = ''
  filters.email = ''
  filters.page = 1
  loadVisites()
}
async function loadVisites() {
  await visitesStore.fetchVisites()
}

onMounted(() => {
  fetchCachedUsers()
  fetchRefs()
  loadVisites()
})
</script>
