<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">VISIBILITÉ INTÉRIEURE (MT) RÉCAPITULATIF</h1>

    <DashboardFilters
      v-model="dashboard.filters.value"
      :zone-options="dashboard.availableZones.value"
      @filter="dashboard.fetchVisites()"
    />

    <!-- Column filters -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <UFormGroup v-for="item in mtItems" :key="item.key" :label="item.label" size="sm">
          <USelectMenu v-model="colFilters[item.key]" :options="['', 'Présent', 'Absent']" placeholder="Tous" size="sm" />
        </UFormGroup>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
        <UFormGroup v-for="item in mtItems" :key="'e-'+item.key" label="État" size="sm">
          <USelectMenu v-model="etatFs[item.key]" :options="['', 'Bon', 'À renouveler']" placeholder="Tous" size="sm" />
        </UFormGroup>
      </div>
    </div>

    <!-- KPI -->
    <div class="flex items-center gap-6">
      <div>
        <p class="text-sm text-gray-500 dark:text-gray-400">Présence de visibilité intérieure</p>
        <p class="text-3xl font-bold text-gray-900 dark:text-gray-100">{{ mtVisites.length }}</p>
      </div>
      <ClientOnly>
        <ChartsPieChart
          :labels="['Présent', 'Absent']"
          :values="[presCount, mtVisites.length - presCount]"
          :colors="['#F59E0B', '#FB923C']"
          height="sm"
          class="w-44"
        />
      </ClientOnly>
    </div>

    <!-- Table -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-amber-50">
            <tr>
              <th class="px-3 py-2 text-left font-semibold text-amber-900">Nom du PDV</th>
              <th class="px-3 py-2 text-left font-semibold text-amber-900">Région</th>
              <th class="px-3 py-2 text-left font-semibold text-amber-900">Zone</th>
              <th class="px-3 py-2 text-left font-semibold text-amber-900">Secteur</th>
              <th v-for="item in mtItems" :key="item.key" class="px-3 py-2 text-center font-semibold text-amber-900">
                {{ item.label }}
              </th>
              <th v-for="item in mtItems" :key="'e-'+item.key" class="px-3 py-2 text-center font-semibold text-amber-900">
                État
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="(row, idx) in paginatedRows" :key="idx" class="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td class="px-3 py-2 font-medium text-gray-900 dark:text-gray-100 max-w-[180px]">
                <div class="flex items-center gap-1">
                  <span class="truncate">{{ row.nom }}</span>
                  <PDVPhotoModal :pdv-id="row.pdv_id" :image-url="row.image_url" :pdv-name="row.nom" />
                </div>
              </td>
              <td class="px-3 py-2 text-gray-600">{{ row.region }}</td>
              <td class="px-3 py-2 text-gray-600">{{ row.zone }}</td>
              <td class="px-3 py-2 text-gray-600">{{ row.secteur }}</td>
              <td v-for="item in mtItems" :key="item.key + idx" class="px-3 py-2 text-center">
                <span :class="row[item.key] ? 'text-green-600 font-medium' : 'text-gray-400'">
                  {{ row[item.key] ? 'Présent' : 'Absent' }}
                </span>
              </td>
              <td v-for="item in mtItems" :key="'e'+item.key + idx" class="px-3 py-2 text-center text-gray-600 text-xs">
                {{ row[item.etatKey] || '' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ (page - 1) * 100 + 1 }} - {{ Math.min(page * 100, filteredRows.length) }} / {{ filteredRows.length }}</p>
        <div class="flex gap-2">
          <UButton size="xs" variant="outline" :disabled="page <= 1" @click="page--">‹</UButton>
          <UButton size="xs" variant="outline" :disabled="page * 100 >= filteredRows.length" @click="page++">›</UButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const dashboard = useDashboardDirection()
const page = ref(1)

const mtItems = [
  { key: 'habillage_rayon', etatKey: 'etat_habillage', label: 'Habillage rayon' },
  { key: 'merchandising', etatKey: 'etat_merchandising', label: 'Merchandising' },
  { key: 'tete_gondole', etatKey: 'etat_tete_gondole', label: 'Tête de gondole' },
  { key: 'autre_interieure', etatKey: 'etat_autre_int', label: 'Autres visibilité int.' },
]

const colFilters = reactive<Record<string, string>>({})
const etatFs = reactive<Record<string, string>>({})

// Only Modern trade visites
const mtVisites = computed(() =>
  dashboard.visites.value.filter(v => v.pdv?.canal === 'Modern trade')
)

const presCount = computed(() =>
  mtVisites.value.filter(v => v.data?.visibilite?.interieure?.presence_visibilite).length
)

const allRows = computed(() => {
  return mtVisites.value.map(v => {
    const int = v.data?.visibilite?.interieure || {} as any
    return {
      nom: v.pdv?.nom_pdv || '',
      pdv_id: v.pdv?.pdv_id || '',
      image_url: (v.pdv as any)?.image_url || null,
      region: v.pdv?.region || '',
      zone: v.pdv?.zone || '',
      secteur: v.pdv?.secteur || '',
      ...Object.fromEntries(mtItems.map(i => [i.key, int[i.key] || false])),
      ...Object.fromEntries(mtItems.map(i => [i.etatKey, int[i.etatKey] || ''])),
    }
  })
})

const filteredRows = computed(() => {
  return allRows.value.filter(row => {
    for (const item of mtItems) {
      const cf = colFilters[item.key]
      if (cf === 'Présent' && !row[item.key]) return false
      if (cf === 'Absent' && row[item.key]) return false
      const ef = etatFs[item.key]
      if (ef && row[item.etatKey] !== ef) return false
    }
    return true
  })
})

const paginatedRows = computed(() => filteredRows.value.slice((page.value - 1) * 100, page.value * 100))

onMounted(() => {
  Promise.all([dashboard.fetchZones(), dashboard.fetchVisites()])
})
</script>
