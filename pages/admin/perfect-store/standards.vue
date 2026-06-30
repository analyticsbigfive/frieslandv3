<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Standards Perfect Store</h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Disponibilité, visibilité intérieure/extérieure et promotion issus du fichier BIG FIVE KPI.
      </p>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 animate-spin text-fc-red" />
    </div>

    <template v-else>
      <div class="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div class="border-b border-gray-100 px-5 py-3 dark:border-gray-700">
          <h2 class="font-bold text-gray-900 dark:text-gray-100">Seuils des niveaux</h2>
          <p class="mt-1 text-xs text-gray-400">La visibilité parfaite est exigée à 100 %. La promotion est contrôlée uniquement lorsqu’elle est applicable.</p>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th class="th-l">Niveau</th>
                <th class="th-c">Disponibilité min.</th>
                <th class="th-c">Visibilité min.</th>
                <th class="th-c">Promotion min.</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-for="niveau in niveaux" :key="niveau.code">
                <td class="px-4 py-3 text-sm font-bold text-gray-900 dark:text-gray-100">{{ niveau.code }}</td>
                <td class="px-4 py-3 text-center text-sm">{{ pct(niveau.dispo_rayon_min) }}</td>
                <td class="px-4 py-3 text-center text-sm">{{ pct(niveau.visibilite_min) }}</td>
                <td class="px-4 py-3 text-center text-sm">{{ pct(niveau.promotion_min) }} <span class="text-xs text-gray-400">(si active)</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div class="grid gap-3 sm:grid-cols-3">
          <UFormGroup label="Segment">
            <USelectMenu v-model="segmentFilter" :options="segmentOptions" option-attribute="label" value-attribute="value" />
          </UFormGroup>
          <UFormGroup label="Niveau">
            <USelectMenu v-model="niveauFilter" :options="niveauFilterOptions" option-attribute="label" value-attribute="value" />
          </UFormGroup>
          <UFormGroup label="Pilier">
            <USelectMenu v-model="pillarFilter" :options="pillarOptions" option-attribute="label" value-attribute="value" />
          </UFormGroup>
        </div>
      </div>

      <div class="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div class="border-b border-gray-100 px-5 py-3 dark:border-gray-700">
          <h2 class="font-bold text-gray-900 dark:text-gray-100">Matrice des standards</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th class="th-l">Segment</th>
                <th class="th-l">Niveau</th>
                <th class="th-l">Emplacement</th>
                <th class="th-l">Élément</th>
                <th class="th-c">Statut</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-for="row in filteredStandards" :key="`${row.segment}-${row.niveau_perfect_store}-${row.code}`">
                <td class="px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100">{{ segmentLabel(row.segment) }}</td>
                <td class="px-4 py-2.5"><UBadge size="xs" variant="soft" color="blue">{{ tierLabel(row.niveau_perfect_store) }}</UBadge></td>
                <td class="px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400">{{ placementLabel(row.emplacement) }}</td>
                <td class="px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100">{{ row.nom }}</td>
                <td class="px-4 py-2.5 text-center">
                  <UBadge v-if="row.optionnel" size="xs" variant="soft" color="amber">Optionnel</UBadge>
                  <UBadge v-else-if="row.requis" size="xs" variant="soft" color="green">Requis</UBadge>
                  <span v-else class="text-gray-300">—</span>
                </td>
              </tr>
              <tr v-if="!filteredStandards.length">
                <td colspan="5" class="px-4 py-8 text-center text-sm text-gray-400">Aucun standard correspondant.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const supabase = useSupabaseClient()
const loading = ref(true)
const niveaux = ref<any[]>([])
const standards = ref<any[]>([])
const segmentFilter = ref('all')
const niveauFilter = ref('all')
const pillarFilter = ref('all')

const segmentOptions = [
  { value: 'all', label: 'Tous les segments' },
  { value: 'boutique', label: 'Boutique' },
  { value: 'superette', label: 'Superette / MT' },
  { value: 'table_top', label: 'Table Top' },
  { value: 'pushcart', label: 'Pushcart' },
  { value: 'porridge', label: 'Porridge' },
  { value: 'kiosque_aboki', label: 'Kiosque / Aboki' },
]
const niveauFilterOptions = [
  { value: 'all', label: 'Tous les niveaux' },
  { value: 'flagship', label: 'FLAGSHIP' },
  { value: 'vip', label: 'VIP' },
  { value: 'core', label: 'CORE' },
  { value: 'basic', label: 'BASIC' },
]
const pillarOptions = [
  { value: 'all', label: 'Tous les piliers' },
  { value: 'visibilite', label: 'Visibilité' },
  { value: 'promotion', label: 'Promotion' },
]

const filteredStandards = computed(() => standards.value.filter(row =>
  (segmentFilter.value === 'all' || row.segment === segmentFilter.value)
  && (niveauFilter.value === 'all' || row.niveau_perfect_store === niveauFilter.value)
  && (pillarFilter.value === 'all' || row.pilier === pillarFilter.value)
  && (row.requis || row.optionnel),
))

const pct = (value: number | null) => value == null ? '—' : `${Number(value)} %`
const segmentLabel = (value: string) => segmentOptions.find(option => option.value === value)?.label || value
const tierLabel = (value: string) => value.toUpperCase()
const placementLabel = (value: string) => ({
  exterieure: 'Extérieure',
  interieure: 'Intérieure',
  promotion: 'Promotion',
}[value] || value)
const one = (value: any) => Array.isArray(value) ? value[0] : value

onMounted(async () => {
  try {
    const [niveauResult, standardResult] = await Promise.all([
      supabase.from('niveau_perfect_store')
        .select('code, rang, dispo_rayon_min, visibilite_min, promotion_min')
        .order('rang', { ascending: false }),
      supabase.from('standard_visibilite')
        .select('segment, niveau_perfect_store, requis, element_visibilite(code, nom, pilier, emplacement, optionnel)')
        .order('segment')
        .order('niveau_perfect_store'),
    ])
    if (niveauResult.error) throw niveauResult.error
    if (standardResult.error) throw standardResult.error
    niveaux.value = niveauResult.data || []
    standards.value = (standardResult.data || []).map((row: any) => ({
      ...row,
      ...one(row.element_visibilite),
    }))
  }
  finally {
    loading.value = false
  }
})
</script>

<style scoped>
.th-l { @apply px-4 py-2.5 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400; }
.th-c { @apply px-4 py-2.5 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400; }
</style>
