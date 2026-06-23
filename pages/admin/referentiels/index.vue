<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Référentiels</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Distributeurs, territoires et types de point de vente (source : BIG FIVE KPI).</p>
    </div>

    <!-- Tabs -->
    <div class="border-b border-gray-200 dark:border-gray-600">
      <nav class="flex gap-6">
        <button
          v-for="t in tabs"
          :key="t.key"
          class="pb-3 text-sm font-medium border-b-2 transition-colors"
          :class="tab === t.key ? 'border-fc-red text-fc-red' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700'"
          @click="tab = t.key"
        >
          {{ t.label }} <span class="text-xs text-gray-400">({{ t.count }})</span>
        </button>
      </nav>
    </div>

    <div v-if="error" class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-200">
      Référentiels indisponibles — lance la migration <code>020_referentiels_geo_distrib_pos.sql</code> dans Supabase.
    </div>

    <UInput v-model="search" icon="i-heroicons-magnifying-glass" placeholder="Rechercher..." size="sm" class="w-72" />

    <!-- Distributeurs -->
    <div v-if="tab === 'distributeurs'" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-gray-700/50">
          <tr>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Distributeur</th>
            <th class="px-4 py-2.5 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Canal</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-for="d in filteredDistributeurs" :key="d.name" class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <td class="px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100">{{ d.name }}</td>
            <td class="px-4 py-2.5 text-center">
              <UBadge :color="d.trade_type === 'MT' ? 'purple' : 'blue'" variant="soft" size="xs">{{ d.trade_type }}</UBadge>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Territoires -->
    <div v-else-if="tab === 'territoires'" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-gray-700/50">
          <tr>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Territoire</th>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Sous-région</th>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Division</th>
            <th class="px-4 py-2.5 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Areas</th>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Distributeur</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-for="t in filteredTerritories" :key="t.code" class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <td class="px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100">{{ t.name }}</td>
            <td class="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{{ subRegionName(t.sub_region_code) }}</td>
            <td class="px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400">{{ divisionName(t.sub_region_code) }}</td>
            <td class="px-4 py-2.5 text-center text-sm text-gray-500 dark:text-gray-400">{{ areaCount(t.code) }}</td>
            <td class="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{{ territoryDistributor(t.name) || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Types PDV -->
    <div v-else class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-gray-700/50">
          <tr>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type (Level 4)</th>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Groupe (Level 3)</th>
            <th class="px-4 py-2.5 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tier</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-for="p in filteredPosTypes" :key="p.level4_type" class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <td class="px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100">{{ p.level4_type }}</td>
            <td class="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{{ p.level3_group }}</td>
            <td class="px-4 py-2.5 text-center">
              <UBadge v-if="p.tier" color="gray" variant="soft" size="xs">{{ p.tier }}</UBadge>
              <span v-else class="text-gray-300">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const { distributeurs, subRegions, divisions, territories, areas, posTypes, error, fetchReferentiels } = useReferentiels()

const tab = ref<'distributeurs' | 'territoires' | 'pos'>('distributeurs')
const search = ref('')

const tabs = computed(() => [
  { key: 'distributeurs', label: 'Distributeurs', count: distributeurs.value.length },
  { key: 'territoires', label: 'Territoires', count: territories.value.length },
  { key: 'pos', label: 'Types de PDV', count: posTypes.value.length },
])

const q = computed(() => search.value.trim().toLowerCase())
const filteredDistributeurs = computed(() => distributeurs.value.filter(d => !q.value || d.name.toLowerCase().includes(q.value)))
const filteredTerritories = computed(() => territories.value.filter(t => !q.value || t.name.toLowerCase().includes(q.value)))
const filteredPosTypes = computed(() => posTypes.value.filter(p => !q.value || p.level4_type.toLowerCase().includes(q.value) || p.level3_group.toLowerCase().includes(q.value)))

const subRegionName = (code: string | null) => subRegions.value.find(s => s.code === code)?.name || '—'
const divisionName = (subCode: string | null) => {
  const sr = subRegions.value.find(s => s.code === subCode)
  return divisions.value.find(d => d.code === sr?.division_code)?.name || '—'
}
const areaCountMap = computed(() => {
  const m: Record<string, number> = {}
  for (const a of areas.value) m[a.territory_code] = (m[a.territory_code] || 0) + 1
  return m
})
const areaCount = (code: string) => areaCountMap.value[code] || 0
const tdMap = useState<Record<string, string>>('ref-td-map', () => ({}))
const territoryDistributor = (name: string) => tdMap.value[name] || ''

onMounted(async () => {
  await fetchReferentiels()
  // mapping territoire->distributeur (table dédiée)
  const supabase = useSupabaseClient()
  const { data } = await supabase.from('territory_distributeur').select('territory_name, distributor_name')
  const m: Record<string, string> = {}
  for (const r of (data || []) as any[]) m[r.territory_name] = r.distributor_name
  tdMap.value = m
})
</script>
