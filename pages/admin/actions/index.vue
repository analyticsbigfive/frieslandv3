<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Actions</h1>
      <div class="flex gap-3">
        <UInput v-model="dateFrom" type="date" size="sm" />
        <UInput v-model="dateTo" type="date" size="sm" />
        <UButton icon="i-heroicons-funnel" size="sm" @click="fetchData">Filtrer</UButton>
      </div>
    </div>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatsCard label="Total visites" :value="String(total)" icon="i-heroicons-clipboard-document-list" color="blue" />
    </div>

    <!-- Actions breakdown -->
    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <div class="p-4 border-b">
        <h3 class="font-bold text-gray-900">Taux de réalisation par action</h3>
      </div>
      <div class="p-6 space-y-4">
        <div v-for="action in actionStats" :key="action.key" class="space-y-1">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-gray-700">{{ action.label }}</span>
            <span class="text-sm font-bold" :class="action.pct >= 50 ? 'text-green-600' : 'text-orange-500'">
              {{ action.pct }}% ({{ action.count }}/{{ total }})
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
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const supabase = useSupabaseClient()

const dateFrom = ref(new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 10))
const dateTo = ref(new Date().toISOString().slice(0, 10))
const visites = ref<any[]>([])

const total = computed(() => visites.value.length)

const actionDefs = [
  { key: 'referencement_produits', label: 'Référencement produits' },
  { key: 'execution_activites_promotionnelles', label: 'Exécution activités promotionnelles' },
  { key: 'prospection_pdv', label: 'Prospection PDV' },
  { key: 'verification_fifo', label: 'Vérification FIFO' },
  { key: 'rangement_produits', label: 'Rangement produits' },
  { key: 'pose_affiches', label: 'Pose d\'affiches' },
  { key: 'pose_materiel_visibilite', label: 'Pose matériel de visibilité' },
]

const actionStats = computed(() =>
  actionDefs.map(a => {
    const count = visites.value.filter(v => v.data?.actions?.[a.key]).length
    return {
      ...a,
      count,
      pct: total.value > 0 ? Math.round(count / total.value * 100) : 0,
    }
  })
)

async function fetchData() {
  const { data } = await supabase
    .from('visites')
    .select('visite_id, data, date_visite')
    .gte('date_visite', dateFrom.value + 'T00:00:00')
    .lte('date_visite', dateTo.value + 'T23:59:59')

  visites.value = data || []
}

onMounted(fetchData)
</script>
