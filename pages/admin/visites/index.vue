<template>
  <div>
    <!-- Filters -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 mb-6">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <UFormGroup label="Date début">
          <UInput v-model="filters.dateFrom" type="date" size="sm" />
        </UFormGroup>

        <UFormGroup label="Date fin">
          <UInput v-model="filters.dateTo" type="date" size="sm" />
        </UFormGroup>

        <UFormGroup label="Commercial">
          <UInput v-model="filters.commercial" placeholder="Nom..." size="sm" />
        </UFormGroup>

        <UFormGroup label="Email">
          <UInput v-model="filters.email" placeholder="Email..." size="sm" />
        </UFormGroup>

        <div class="flex items-end gap-2">
          <UButton size="sm" @click="loadVisites" icon="i-heroicons-magnifying-glass">
            Filtrer
          </UButton>
          <UButton size="sm" variant="ghost" @click="resetFilters">
            Reset
          </UButton>
          <UButton size="sm" variant="outline" @click="handleExport" icon="i-heroicons-arrow-down-tray">
            Export
          </UButton>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">ID</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Commercial</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">PDV</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">EVAP</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">IMP</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">SCM</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">UHT</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Concurrence</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">GPS</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="visite in visites"
              :key="visite.visite_id"
              class="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
              @click="viewVisite(visite)"
            >
              <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-mono">{{ visite.visite_id?.substring(0, 8) }}</td>
              <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{{ formatDate(visite.date_visite) }}</td>
              <td class="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 font-medium">{{ visite.commercial }}</td>
              <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{{ (visite as any).pdv?.nom_pdv || visite.pdv_id?.substring(0, 8) }}</td>
              <td class="px-4 py-3 text-center">
                <span :class="visite.data?.produits?.evap?.present ? 'badge-disponible' : 'badge-rupture'">
                  {{ visite.data?.produits?.evap?.present ? 'Oui' : 'Non' }}
                </span>
              </td>
              <td class="px-4 py-3 text-center">
                <span :class="visite.data?.produits?.imp?.present ? 'badge-disponible' : 'badge-rupture'">
                  {{ visite.data?.produits?.imp?.present ? 'Oui' : 'Non' }}
                </span>
              </td>
              <td class="px-4 py-3 text-center">
                <span :class="visite.data?.produits?.scm?.present ? 'badge-disponible' : 'badge-rupture'">
                  {{ visite.data?.produits?.scm?.present ? 'Oui' : 'Non' }}
                </span>
              </td>
              <td class="px-4 py-3 text-center">
                <span :class="visite.data?.produits?.uht?.present ? 'badge-disponible' : 'badge-rupture'">
                  {{ visite.data?.produits?.uht?.present ? 'Oui' : 'Non' }}
                </span>
              </td>
              <td class="px-4 py-3 text-center">
                <span :class="visite.data?.concurrence?.presence_concurrents ? 'badge-rupture' : 'badge-disponible'">
                  {{ visite.data?.concurrence?.presence_concurrents ? 'Oui' : 'Non' }}
                </span>
              </td>
              <td class="px-4 py-3 text-center">
                <UIcon
                  :name="visite.geofence_validated ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle'"
                  :class="visite.geofence_validated ? 'text-emerald-500' : 'text-gray-300'"
                  class="w-5 h-5"
                />
              </td>
              <td class="px-4 py-3 text-center">
                <UDropdown :items="getVisiteActions(visite)" :popper="{ placement: 'bottom-end' }">
                  <UButton variant="ghost" size="xs" icon="i-heroicons-ellipsis-vertical" />
                </UDropdown>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Empty State -->
      <div v-if="!loading && !visites.length" class="p-12 text-center text-gray-400">
        <UIcon name="i-heroicons-clipboard-document-list" class="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Aucune visite trouvée</p>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="p-12 text-center">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-fc-blue mx-auto" />
      </div>

      <!-- Pagination -->
      <div class="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ total }} visite(s) trouvée(s)
        </p>
        <div class="flex gap-2">
          <UButton
            size="xs"
            variant="outline"
            :disabled="filters.page <= 1"
            @click="filters.page--; loadVisites()"
          >
            Précédent
          </UButton>
          <UButton
            size="xs"
            variant="outline"
            :disabled="visites.length < filters.perPage"
            @click="filters.page++; loadVisites()"
          >
            Suivant
          </UButton>
        </div>
      </div>
    </div>

    <!-- Detail Modal -->
    <UModal v-model="showDetail" :ui="{ width: 'max-w-3xl' }">
      <div class="p-6" v-if="selectedVisite">
        <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
          Détail Visite - {{ selectedVisite.visite_id?.substring(0, 8) }}
        </h3>

        <div class="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">Commercial</p>
            <p class="font-medium">{{ selectedVisite.commercial }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">Date</p>
            <p class="font-medium">{{ formatDate(selectedVisite.date_visite) }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">Email</p>
            <p class="font-medium">{{ selectedVisite.email }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">Géofence validé</p>
            <p class="font-medium">{{ selectedVisite.geofence_validated ? 'Oui ✓' : 'Non ✗' }}</p>
          </div>
        </div>

        <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4">
          <h4 class="text-sm font-semibold mb-2">Données brutes (JSON)</h4>
          <pre class="text-xs overflow-auto max-h-64 bg-gray-900 text-green-400 p-3 rounded">{{ JSON.stringify(selectedVisite.data, null, 2) }}</pre>
        </div>

        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="showDetail = false">Fermer</UButton>
          <UButton color="red" @click="handleDelete(selectedVisite)">Supprimer</UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { Visite } from '~/types'

definePageMeta({
  middleware: ['auth', 'admin'],
  layout: 'admin',
})

const visitesStore = useVisitesStore()
const { exportVisitesToExcel } = useCsvExport()

const visites = computed(() => visitesStore.visites)
const total = computed(() => visitesStore.total)
const loading = computed(() => visitesStore.loading)
const filters = visitesStore.filters

const showDetail = ref(false)
const selectedVisite = ref<Visite | null>(null)

function formatDate(date: string) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function viewVisite(visite: Visite) {
  selectedVisite.value = visite
  showDetail.value = true
}

function getVisiteActions(visite: Visite) {
  return [[
    {
      label: 'Voir détails',
      icon: 'i-heroicons-eye',
      click: () => viewVisite(visite),
    },
    {
      label: 'Supprimer',
      icon: 'i-heroicons-trash',
      click: () => handleDelete(visite),
    },
  ]]
}

async function handleDelete(visite: Visite) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer cette visite ?')) return
  await visitesStore.deleteVisite(visite.visite_id)
  showDetail.value = false
  await loadVisites()
}

async function handleExport() {
  await exportVisitesToExcel(visites.value)
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
  loadVisites()
})
</script>
