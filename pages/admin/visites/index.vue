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
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">📷</th>
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
              <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                <div class="flex items-center gap-1">
                  <span>{{ (visite as any).pdv?.nom_pdv || visite.pdv_id?.substring(0, 8) }}</span>
                  <PDVPhotoModal :pdv-id="visite.pdv_id" :pdv-name="(visite as any).pdv?.nom_pdv" />
                </div>
              </td>
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
                <UBadge v-if="visite.image_urls?.length" variant="soft" color="cyan" size="xs">
                  {{ visite.image_urls.length }} 📷
                </UBadge>
                <span v-else class="text-gray-300 text-xs">—</span>
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
    <UModal v-model="showDetail" :ui="{ width: 'max-w-4xl' }">
      <div class="p-6 max-h-[85vh] overflow-y-auto" v-if="selectedVisite">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">
            Détail Visite
          </h3>
          <UButton variant="ghost" size="xs" icon="i-heroicons-x-mark" @click="showDetail = false" />
        </div>

        <!-- Info générale -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <p class="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-medium">Commercial</p>
            <p class="font-semibold text-sm text-gray-900 dark:text-gray-100 mt-0.5">{{ selectedVisite.commercial }}</p>
          </div>
          <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <p class="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-medium">Date</p>
            <p class="font-semibold text-sm text-gray-900 dark:text-gray-100 mt-0.5">{{ formatDate(selectedVisite.date_visite) }}</p>
          </div>
          <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <p class="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-medium">PDV</p>
            <p class="font-semibold text-sm text-gray-900 dark:text-gray-100 mt-0.5">{{ (selectedVisite as any).pdv?.nom_pdv || selectedVisite.pdv_id?.substring(0, 8) }}</p>
          </div>
          <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <p class="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-medium">GPS Validé</p>
            <p class="font-semibold text-sm mt-0.5" :class="selectedVisite.geofence_validated ? 'text-emerald-600' : 'text-red-500'">
              {{ selectedVisite.geofence_validated ? '✓ Oui' : '✗ Non' }}
            </p>
          </div>
        </div>

        <!-- Produits -->
        <div class="mb-5" v-if="selectedVisite.data?.produits">
          <h4 class="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-fc-blue" /> Présence Produits
          </h4>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Catégorie</th>
                  <th class="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">Présent</th>
                  <th class="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">Prix respectés</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                <tr v-for="cat in productCategories" :key="cat.key">
                  <td class="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{{ cat.label }}</td>
                  <td class="px-3 py-2 text-center">
                    <span class="inline-block w-5 h-5 rounded-full text-white text-[10px] font-bold leading-5"
                      :class="selectedVisite.data.produits[cat.key]?.present ? 'bg-green-500' : 'bg-gray-300'">
                      {{ selectedVisite.data.produits[cat.key]?.present ? '✓' : '—' }}
                    </span>
                  </td>
                  <td class="px-3 py-2 text-center">
                    <span class="inline-block w-5 h-5 rounded-full text-white text-[10px] font-bold leading-5"
                      :class="selectedVisite.data.produits[cat.key]?.prix_respectes ? 'bg-green-500' : 'bg-gray-300'">
                      {{ selectedVisite.data.produits[cat.key]?.prix_respectes ? '✓' : '—' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Concurrence -->
        <div class="mb-5" v-if="selectedVisite.data?.concurrence">
          <h4 class="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-fc-red" /> Concurrence
          </h4>
          <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <p class="text-sm">
              Présence concurrents :
              <span class="font-bold" :class="selectedVisite.data.concurrence.presence_concurrents ? 'text-red-500' : 'text-emerald-600'">
                {{ selectedVisite.data.concurrence.presence_concurrents ? 'Oui' : 'Non' }}
              </span>
            </p>
            <div v-if="selectedVisite.data.concurrence.presence_concurrents" class="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div v-for="cat in concurrenceCategories" :key="cat.key" class="text-xs">
                <span class="font-medium text-gray-700 dark:text-gray-300">{{ cat.label }}:</span>
                <span :class="(selectedVisite.data.concurrence as any)[cat.key]?.present ? 'text-red-500 font-bold' : 'text-gray-400'">
                  {{ (selectedVisite.data.concurrence as any)[cat.key]?.present ? ' Oui' : ' Non' }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Visibilité -->
        <div class="mb-5" v-if="selectedVisite.data?.visibilite">
          <h4 class="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-amber-500" /> Visibilité
          </h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <!-- Extérieure -->
            <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Extérieure</p>
              <div class="space-y-1 text-xs">
                <div v-for="item in extItems" :key="item.key" class="flex justify-between">
                  <span class="text-gray-700 dark:text-gray-300">{{ item.label }}</span>
                  <span :class="(selectedVisite.data.visibilite.exterieure as any)?.[item.key] ? 'text-green-600 font-medium' : 'text-gray-400'">
                    {{ (selectedVisite.data.visibilite.exterieure as any)?.[item.key] ? 'Présent' : 'Absent' }}
                  </span>
                </div>
              </div>
            </div>
            <!-- Intérieure -->
            <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Intérieure</p>
              <div class="space-y-1 text-xs">
                <div v-for="item in intItems" :key="item.key" class="flex justify-between">
                  <span class="text-gray-700 dark:text-gray-300">{{ item.label }}</span>
                  <span :class="(selectedVisite.data.visibilite.interieure as any)?.[item.key] ? 'text-green-600 font-medium' : 'text-gray-400'">
                    {{ (selectedVisite.data.visibilite.interieure as any)?.[item.key] ? 'Présent' : 'Absent' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="mb-5" v-if="selectedVisite.data?.actions">
          <h4 class="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-purple-500" /> Actions réalisées
          </h4>
          <div class="flex flex-wrap gap-2">
            <UBadge v-for="a in actionItems" :key="a.key"
              :color="(selectedVisite.data.actions as any)[a.key] ? 'green' : 'gray'"
              variant="soft" size="sm"
            >
              {{ (selectedVisite.data.actions as any)[a.key] ? '✓' : '—' }} {{ a.label }}
            </UBadge>
          </div>
        </div>

        <!-- Photos -->
        <div class="mb-5" v-if="selectedVisite.image_urls?.length">
          <h4 class="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-cyan-500" /> Photos ({{ selectedVisite.image_urls.length }})
          </h4>
          <div class="flex gap-2 overflow-x-auto">
            <img v-for="(url, idx) in selectedVisite.image_urls" :key="idx"
              :src="url" class="w-24 h-24 rounded-lg object-cover border border-gray-200 dark:border-gray-600" />
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-4 border-t border-gray-100 dark:border-gray-700">
          <UButton variant="ghost" @click="showDetail = false">Fermer</UButton>
          <UButton color="red" variant="soft" @click="handleDelete(selectedVisite)">Supprimer</UButton>
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
const { users: cachedUsers, fetchUsers: fetchCachedUsers } = useUsersCache()

const commercialOptions = computed(() => [
  { value: '', label: 'Tous' },
  ...cachedUsers.value
    .filter(u => u.is_active !== false)
    .map(u => ({ value: u.nom || u.email || '', label: `${u.nom || '—'} (${u.email})` }))
])

const emailOptions = computed(() => [
  { value: '', label: 'Tous' },
  ...cachedUsers.value
    .filter(u => u.is_active !== false && u.email)
    .map(u => ({ value: u.email!, label: u.email! }))
])

const visites = computed(() => visitesStore.visites)
const total = computed(() => visitesStore.total)
const loading = computed(() => visitesStore.loading)
const filters = visitesStore.filters

const showDetail = ref(false)
const selectedVisite = ref<Visite | null>(null)

// Constantes modale structurée
const productCategories = [
  { key: 'evap', label: 'Lait Évaporé (EVAP)' },
  { key: 'imp', label: 'Lait en Poudre (IMP)' },
  { key: 'scm', label: 'Lait Concentré Sucré (SCM)' },
  { key: 'uht', label: 'Lait UHT' },
  { key: 'cereales', label: 'Céréales' },
  { key: 'yaourt', label: 'Yaourt' },
]
const concurrenceCategories = [
  { key: 'evap', label: 'EVAP' },
  { key: 'imp', label: 'IMP' },
  { key: 'scm', label: 'SCM' },
  { key: 'uht', label: 'UHT' },
]
const extItems = [
  { key: 'full_branding', label: 'Full Branding' },
  { key: 'poster', label: 'Poster' },
  { key: 'panneau_privilege', label: 'Panneau Privilège' },
  { key: 'sign_board', label: 'Sign Board' },
  { key: 'guirlande', label: 'Guirlande' },
  { key: 'autre_branding', label: 'Autre' },
]
const intItems = [
  { key: 'hanger', label: 'Hanger' },
  { key: 'tete_gondole', label: 'Tête de gondole' },
  { key: 'maison_bonnet_rouge', label: 'Maison Bonnet Rouge' },
  { key: 'reglettes', label: 'Réglettes' },
  { key: 'zone_chaude', label: 'Zone chaude' },
  { key: 'produits_frigo', label: 'Produits frigo' },
  { key: 'presentoirs', label: 'Présentoirs' },
  { key: 'bacs_pouch', label: 'Bacs Pouch' },
  { key: 'habillage_rayon', label: 'Habillage rayon' },
  { key: 'merchandising', label: 'Merchandising' },
]
const actionItems = [
  { key: 'referencement_produits', label: 'Référencement produits' },
  { key: 'execution_activites_promotionnelles', label: 'Activités promotionnelles' },
  { key: 'prospection_pdv', label: 'Prospection PDV' },
  { key: 'verification_fifo', label: 'Vérification FIFO' },
  { key: 'rangement_produits', label: 'Rangement produits' },
  { key: 'pose_affiches', label: 'Pose affiches' },
  { key: 'pose_materiel_visibilite', label: 'Pose matériel visibilité' },
]

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
  fetchCachedUsers()
  loadVisites()
})
</script>
