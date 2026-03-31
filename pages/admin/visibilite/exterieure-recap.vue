<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold text-gray-900">VISIBILITÉ EXTÉRIEURE RÉCAPITULATIF</h1>

    <DashboardFilters
      v-model="dashboard.filters.value"
      :zone-options="dashboard.availableZones.value"
      @filter="dashboard.fetchVisites()"
    />

    <!-- Dropdowns supplémentaires pour filtrer les colonnes -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <UFormGroup v-for="item in visItems" :key="item.key" :label="item.label" size="sm">
          <USelectMenu
            v-model="columnFilters[item.key]"
            :options="['', 'Présent', 'Absent']"
            placeholder="Tous"
            size="sm"
          />
        </UFormGroup>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-3">
        <UFormGroup v-for="item in visItems" :key="'etat-'+item.key" :label="'État'" size="sm">
          <USelectMenu
            v-model="etatFilters[item.key]"
            :options="['', 'Bon', 'À renouveler', 'Acceptable', 'Au standard']"
            placeholder="Tous"
            size="sm"
          />
        </UFormGroup>
      </div>
    </div>

    <!-- KPI -->
    <div class="flex items-center gap-6">
      <div>
        <p class="text-sm text-gray-500">Nombre de visites</p>
        <p class="text-3xl font-bold text-gray-900">{{ filteredVisites.length }}</p>
      </div>
      <ClientOnly>
        <ChartsPieChart
          :labels="['Présent', 'Absent']"
          :values="[presCount, absCount]"
          :colors="['#F59E0B', '#FB923C']"
          height="sm"
          class="w-44"
        />
      </ClientOnly>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-amber-50">
            <tr>
              <th class="px-3 py-2 text-left font-semibold text-amber-900 cursor-pointer" @click="sortBy='nom'; sortAsc=!sortAsc">
                PDV {{ sortBy === 'nom' ? (sortAsc ? '▲' : '▼') : '' }}
              </th>
              <th class="px-3 py-2 text-left font-semibold text-amber-900">Zone</th>
              <th class="px-3 py-2 text-left font-semibold text-amber-900">Secteur</th>
              <th v-for="item in visItems" :key="item.key" class="px-3 py-2 text-center font-semibold text-amber-900">
                {{ item.shortLabel }}
              </th>
              <th v-for="item in visItems" :key="'e-'+item.key" class="px-3 py-2 text-center font-semibold text-amber-900">
                État
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="(row, idx) in paginatedRows" :key="idx" class="hover:bg-gray-50">
              <td class="px-3 py-2 text-gray-900 font-medium max-w-[200px] truncate">{{ row.nom }}</td>
              <td class="px-3 py-2 text-gray-600">{{ row.zone }}</td>
              <td class="px-3 py-2 text-gray-600">{{ row.secteur }}</td>
              <td v-for="item in visItems" :key="item.key + idx" class="px-3 py-2 text-center">
                <span :class="row[item.key] ? 'text-green-600 font-medium' : 'text-gray-400'">
                  {{ row[item.key] ? 'Présent' : 'Absent' }}
                </span>
              </td>
              <td v-for="item in visItems" :key="'e'+item.key + idx" class="px-3 py-2 text-center text-gray-600">
                {{ row[item.etatKey] || '' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
        <p class="text-sm text-gray-500">{{ page * 100 - 99 }} - {{ Math.min(page * 100, filteredVisites.length) }} / {{ filteredVisites.length }}</p>
        <div class="flex gap-2">
          <UButton size="xs" variant="outline" :disabled="page <= 1" @click="page--">‹</UButton>
          <UButton size="xs" variant="outline" :disabled="page * 100 >= filteredVisites.length" @click="page++">›</UButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const dashboard = useDashboardDirection()
const page = ref(1)
const sortBy = ref('nom')
const sortAsc = ref(true)

const visItems = [
  { key: 'full_branding', etatKey: 'etat_branding', label: 'Full branding', shortLabel: 'Full Br.' },
  { key: 'poster', etatKey: 'etat_poster', label: 'Poster', shortLabel: 'Poster' },
  { key: 'panneau_privilege', etatKey: 'etat_panneau', label: 'Panneau privilège', shortLabel: 'Panneau' },
  { key: 'sign_board', etatKey: 'etat_sign_board', label: 'Sign board', shortLabel: 'Sign B.' },
  { key: 'guirlande', etatKey: 'etat_guirlande', label: 'Guirlande', shortLabel: 'Guirlande' },
]

const columnFilters = reactive<Record<string, string>>({})
const etatFilters = reactive<Record<string, string>>({})

const filteredVisites = computed(() => {
  return dashboard.visites.value.filter(v => {
    const ext = v.data?.visibilite?.exterieure
    if (!ext) return true

    for (const item of visItems) {
      const colFilter = columnFilters[item.key]
      if (colFilter === 'Présent' && !(ext as any)[item.key]) return false
      if (colFilter === 'Absent' && (ext as any)[item.key]) return false

      const eFilter = etatFilters[item.key]
      if (eFilter && (ext as any)[item.etatKey] !== eFilter) return false
    }
    return true
  })
})

const presCount = computed(() => filteredVisites.value.filter(v => v.data?.visibilite?.exterieure?.presence_visibilite).length)
const absCount = computed(() => filteredVisites.value.length - presCount.value)

const tableRows = computed(() => {
  return filteredVisites.value.map(v => {
    const ext = v.data?.visibilite?.exterieure || {} as any
    return {
      nom: v.pdv?.nom_pdv || v.visite_id.substring(0, 8),
      zone: v.pdv?.zone || '',
      secteur: v.pdv?.secteur || '',
      full_branding: ext.full_branding,
      etat_branding: ext.etat_branding || '',
      poster: ext.poster,
      etat_poster: ext.etat_poster || '',
      panneau_privilege: ext.panneau_privilege,
      etat_panneau: ext.etat_panneau || '',
      sign_board: ext.sign_board,
      etat_sign_board: ext.etat_sign_board || '',
      guirlande: ext.guirlande,
      etat_guirlande: ext.etat_guirlande || '',
    }
  }).sort((a, b) => {
    const va = (a as any)[sortBy.value] || ''
    const vb = (b as any)[sortBy.value] || ''
    return sortAsc.value ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va))
  })
})

const paginatedRows = computed(() => tableRows.value.slice((page.value - 1) * 100, page.value * 100))

onMounted(async () => {
  await dashboard.fetchZones()
  await dashboard.fetchVisites()
})
</script>
