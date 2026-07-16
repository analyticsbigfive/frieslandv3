<template>
  <div class="space-y-6">
    <div class="admin-toolbar flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <UInput
        v-model="search"
        placeholder="Rechercher un distributeur..."
        icon="i-heroicons-magnifying-glass"
        size="sm"
        class="w-full sm:w-72"
      />
      <p class="text-sm text-slate-500 dark:text-slate-400">{{ filtered.length }} distributeur(s)</p>
    </div>

    <div class="admin-surface overflow-hidden">
      <div class="border-b border-slate-100 px-5 py-4 dark:border-slate-700">
        <h2 class="font-semibold text-slate-900 dark:text-white">Distributeurs</h2>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Chaque distributeur regroupe les visites et PDV des territoires qui lui sont rattachés. Cliquez pour voir ses visites.
        </p>
      </div>

      <div class="overflow-x-auto">
        <table class="admin-table w-full">
          <thead>
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Distributeur</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Portée</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Territoires</th>
              <th class="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">PDV</th>
              <th class="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Visites</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <template v-for="d in paginated" :key="d.name">
              <tr class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700" @click="toggle(d.name)">
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <UIcon
                      :name="expanded === d.name ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'"
                      class="h-4 w-4 text-gray-400"
                    />
                    <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ d.name }}</span>
                  </div>
                </td>
                <td class="px-4 py-3">
                  <UBadge :color="d.national ? 'violet' : 'sky'" variant="soft" size="xs">
                    {{ d.national ? 'National' : 'Territoire' }}
                  </UBadge>
                </td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ d.territories.join(', ') || '—' }}</td>
                <td class="px-4 py-3 text-center text-sm font-semibold tabular-nums">{{ d.pdvCount }}</td>
                <td class="px-4 py-3 text-center text-sm font-semibold tabular-nums">{{ d.visites.length }}</td>
              </tr>
              <tr v-if="expanded === d.name">
                <td colspan="5" class="bg-gray-50 px-6 py-4 dark:bg-gray-800/50">
                  <div v-if="d.visites.length" class="space-y-1">
                    <div
                      v-for="v in d.visites"
                      :key="v.visite_id"
                      class="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm dark:bg-gray-900"
                    >
                      <span class="font-medium text-gray-900 dark:text-gray-100">{{ v.pdv_nom }}</span>
                      <span class="text-gray-500 dark:text-gray-400">{{ v.commercial }}</span>
                      <span class="text-xs text-gray-400">{{ formatDate(v.date_visite) }}</span>
                    </div>
                  </div>
                  <p v-else class="text-sm text-gray-400">Aucune visite pour ce distributeur.</p>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <div v-if="loading" class="p-8 text-center">
        <UIcon name="i-heroicons-arrow-path" class="mx-auto h-8 w-8 animate-spin text-fc-blue" />
      </div>

      <div v-if="!loading && !filtered.length" class="p-12 text-center text-gray-400">
        <p>Aucun distributeur trouvé</p>
      </div>

      <div class="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-gray-700">
        <p class="text-sm text-gray-500 dark:text-gray-400">Page {{ page }} / {{ pageCount }}</p>
        <div class="flex gap-2">
          <UButton size="xs" variant="outline" :disabled="page <= 1" @click="page--">Précédent</UButton>
          <UButton size="xs" variant="outline" :disabled="page >= pageCount" @click="page++">Suivant</UButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const supabase = useSupabaseClient()
const { distributeurs, territoireDistributeurs, fetchReferentiels } = useReferentiels()

const loading = ref(true)
const search = ref('')
const page = ref(1)
const perPage = 20
const expanded = ref<string | null>(null)

interface VisiteRow { visite_id: string; commercial: string; date_visite: string; pdv_nom: string; distributor_name: string }
const visiteRows = ref<VisiteRow[]>([])
const pdvCountByDistrib = ref<Record<string, number>>({})

// Agrégat par distributeur : territoires rattachés, nb PDV, visites.
const grouped = computed(() => {
  const terrByDistrib = new Map<string, Set<string>>()
  for (const td of territoireDistributeurs.value) {
    if (!terrByDistrib.has(td.distributor_name)) terrByDistrib.set(td.distributor_name, new Set())
    terrByDistrib.get(td.distributor_name)!.add(td.territory_name || td.territory_code)
  }
  const visitesByDistrib = new Map<string, VisiteRow[]>()
  for (const v of visiteRows.value) {
    if (!v.distributor_name) continue
    if (!visitesByDistrib.has(v.distributor_name)) visitesByDistrib.set(v.distributor_name, [])
    visitesByDistrib.get(v.distributor_name)!.push(v)
  }
  return distributeurs.value.map(d => ({
    name: d.name,
    national: d.national,
    territories: [...(terrByDistrib.get(d.name) || [])].sort(),
    pdvCount: pdvCountByDistrib.value[d.name] || 0,
    visites: visitesByDistrib.get(d.name) || [],
  }))
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  const base = q ? grouped.value.filter(d => d.name.toLowerCase().includes(q)) : grouped.value
  // Tri : distributeurs avec activité (visites) d'abord, puis alpha.
  return [...base].sort((a, b) => b.visites.length - a.visites.length || a.name.localeCompare(b.name))
})

const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / perPage)))
const paginated = computed(() => filtered.value.slice((page.value - 1) * perPage, page.value * perPage))

watch(search, () => { page.value = 1 })

function toggle(name: string) {
  expanded.value = expanded.value === name ? null : name
}

function formatDate(value: string): string {
  return formatDateFr(value, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

async function load() {
  loading.value = true
  try {
    await fetchReferentiels()
    const [{ data: visitesData }, { data: pdvData }] = await Promise.all([
      supabase
        .from('visites')
        .select('visite_id, commercial, date_visite, pdv:pdv_id(nom_pdv, distributor_name)')
        .order('date_visite', { ascending: false }),
      supabase
        .from('pdv')
        .select('distributor_name')
        .eq('is_active', true),
    ])
    visiteRows.value = (visitesData || []).map((r: any) => ({
      visite_id: r.visite_id,
      commercial: r.commercial,
      date_visite: r.date_visite,
      pdv_nom: r.pdv?.nom_pdv || r.visite_id,
      distributor_name: r.pdv?.distributor_name || '',
    }))
    const counts: Record<string, number> = {}
    for (const p of (pdvData || []) as any[]) {
      if (p.distributor_name) counts[p.distributor_name] = (counts[p.distributor_name] || 0) + 1
    }
    pdvCountByDistrib.value = counts
  }
  finally {
    loading.value = false
  }
}

onMounted(load)
</script>
