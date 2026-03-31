<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold text-gray-900">VISIBILITÉ INTÉRIEURE (GT) RÉCAPITULATIF</h1>

    <DashboardFilters
      v-model="dashboard.filters.value"
      :zone-options="dashboard.availableZones.value"
      @filter="dashboard.fetchVisites()"
    />

    <!-- Column filters -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <UFormGroup v-for="item in gtItems" :key="item.key" :label="item.label" size="sm">
          <USelectMenu v-model="colFilters[item.key]" :options="['', 'Présent', 'Absent']" placeholder="Tous" size="sm" />
        </UFormGroup>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mt-3">
        <UFormGroup v-for="item in gtItems" :key="'e-'+item.key" label="État" size="sm">
          <USelectMenu v-model="etatFs[item.key]" :options="['', 'Bon', 'À renouveler', 'Acceptable', 'Au standard']" placeholder="Tous" size="sm" />
        </UFormGroup>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-amber-50">
            <tr>
              <th class="px-3 py-2 text-left font-semibold text-amber-900 whitespace-nowrap">Nom du PDV</th>
              <th class="px-3 py-2 text-left font-semibold text-amber-900">Région</th>
              <th class="px-3 py-2 text-left font-semibold text-amber-900">Zone</th>
              <th class="px-3 py-2 text-left font-semibold text-amber-900">Secteur</th>
              <th class="px-3 py-2 text-left font-semibold text-amber-900">Canal</th>
              <th class="px-3 py-2 text-left font-semibold text-amber-900">Catégorie</th>
              <th class="px-3 py-2 text-left font-semibold text-amber-900">Sous-Cat</th>
              <th class="px-3 py-2 text-left font-semibold text-amber-900">Merchandiser</th>
              <th v-for="item in gtItems" :key="item.key" class="px-2 py-2 text-center font-semibold text-amber-900 whitespace-nowrap">
                {{ item.shortLabel }}
              </th>
              <th v-for="item in gtItems" :key="'e-'+item.key" class="px-2 py-2 text-center font-semibold text-amber-900">
                État
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="(row, idx) in paginatedRows" :key="idx" class="hover:bg-gray-50">
              <td class="px-3 py-2 font-medium text-gray-900 max-w-[180px] truncate">{{ row.nom }}</td>
              <td class="px-3 py-2 text-gray-600">{{ row.region }}</td>
              <td class="px-3 py-2 text-gray-600">{{ row.zone }}</td>
              <td class="px-3 py-2 text-gray-600">{{ row.secteur }}</td>
              <td class="px-3 py-2 text-gray-600">{{ row.canal }}</td>
              <td class="px-3 py-2 text-gray-600">{{ row.categorie }}</td>
              <td class="px-3 py-2 text-gray-600">{{ row.sousCategorie }}</td>
              <td class="px-3 py-2 text-gray-600">{{ row.commercial }}</td>
              <td v-for="item in gtItems" :key="item.key + idx" class="px-2 py-2 text-center">
                <span :class="row[item.key] ? 'text-green-600 font-medium' : 'text-gray-400'">
                  {{ row[item.key] ? 'Présent' : 'Absent' }}
                </span>
              </td>
              <td v-for="item in gtItems" :key="'e'+item.key + idx" class="px-2 py-2 text-center text-gray-600 text-xs">
                {{ row[item.etatKey] || '' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
        <p class="text-sm text-gray-500">{{ (page - 1) * 100 + 1 }} - {{ Math.min(page * 100, filteredRows.length) }} / {{ filteredRows.length }}</p>
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

const gtItems = [
  { key: 'hanger', etatKey: 'etat_hanger', label: 'Hanger', shortLabel: 'Hanger' },
  { key: 'reglettes', etatKey: 'etat_reglettes', label: 'Réglettes', shortLabel: 'Réglettes' },
  { key: 'maison_bonnet_rouge', etatKey: 'etat_maison_br', label: 'Maison bonnet Ro.', shortLabel: 'Maison BR' },
  { key: 'zone_chaude', etatKey: 'etat_zone_chaude', label: 'Zone chaude', shortLabel: 'Z. chaude' },
  { key: 'presentoirs', etatKey: 'etat_presentoirs', label: 'Présentoirs', shortLabel: 'Présentoirs' },
  { key: 'bacs_pouch', etatKey: 'etat_bacs', label: 'Bacs à pouch', shortLabel: 'Bacs' },
  { key: 'produits_frigo', etatKey: 'etat_frigo', label: 'Produits dans le fri.', shortLabel: 'Frigo' },
]

const colFilters = reactive<Record<string, string>>({})
const etatFs = reactive<Record<string, string>>({})

// Only General trade visites
const gtVisites = computed(() =>
  dashboard.visites.value.filter(v => !v.pdv?.canal || v.pdv.canal === 'General trade')
)

const allRows = computed(() => {
  return gtVisites.value.map(v => {
    const int = v.data?.visibilite?.interieure || {} as any
    return {
      nom: v.pdv?.nom_pdv || '',
      region: v.pdv?.region || '',
      zone: v.pdv?.zone || '',
      secteur: v.pdv?.secteur || '',
      canal: v.pdv?.canal || '',
      categorie: v.pdv?.categorie_pdv || '',
      sousCategorie: v.pdv?.sous_categorie_pdv || '',
      commercial: v.commercial || '',
      ...Object.fromEntries(gtItems.map(i => [i.key, int[i.key] || false])),
      ...Object.fromEntries(gtItems.map(i => [i.etatKey, int[i.etatKey] || ''])),
    }
  })
})

const filteredRows = computed(() => {
  return allRows.value.filter(row => {
    for (const item of gtItems) {
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

onMounted(async () => {
  await dashboard.fetchZones()
  await dashboard.fetchVisites()
})
</script>
