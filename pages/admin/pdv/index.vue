<template>
  <div>
    <!-- Header actions -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <UInput
          v-model="searchQuery"
          placeholder="Rechercher un PDV..."
          icon="i-heroicons-magnifying-glass"
          size="sm"
          class="w-64"
          @input="debouncedSearch"
        />
        <USelectMenu
          v-model="selectedZone"
          :options="zoneOptions"
          placeholder="Zone"
          size="sm"
          class="w-40"
          @update:model-value="loadPDV"
        />
        <USelectMenu
          v-model="selectedRegion"
          :options="regionOptions"
          placeholder="Région"
          size="sm"
          class="w-40"
          @update:model-value="loadPDV"
        />
      </div>

      <div class="flex gap-2">
        <UButton size="sm" variant="outline" @click="handleExport" icon="i-heroicons-arrow-down-tray">
          Export
        </UButton>
        <UButton size="sm" variant="outline" @click="showImport = true" icon="i-heroicons-arrow-up-tray">
          Import CSV
        </UButton>
        <UButton size="sm" @click="showCreate = true" icon="i-heroicons-plus" class="bg-fc-blue">
          Nouveau PDV
        </UButton>
      </div>
    </div>

    <!-- PDV Table -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nom</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Canal</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Catégorie</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Zone</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Secteur</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Région</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">GPS</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="pdv in pdvList"
              :key="pdv.pdv_id"
              class="hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-fc-blue-50 flex items-center justify-center">
                    <MapPin class="w-4 h-4 text-fc-blue" />
                  </div>
                  <div>
                    <div class="flex items-center gap-1">
                      <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ pdv.nom_pdv }}</p>
                      <PDVPhotoModal :image-url="pdv.image_url" :pdv-id="pdv.pdv_id" :pdv-name="pdv.nom_pdv" />
                    </div>
                    <p class="text-xs text-gray-400">{{ pdv.pdv_id }}</p>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3 text-sm text-gray-600">{{ pdv.canal }}</td>
              <td class="px-4 py-3 text-sm text-gray-600">{{ pdv.sous_categorie_pdv }}</td>
              <td class="px-4 py-3 text-sm text-gray-600">{{ pdv.zone }}</td>
              <td class="px-4 py-3 text-sm text-gray-600">{{ pdv.secteur }}</td>
              <td class="px-4 py-3 text-sm text-gray-600">{{ pdv.region }}</td>
              <td class="px-4 py-3 text-center">
                <UIcon
                  :name="pdv.geolocation_lat ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle'"
                  :class="pdv.geolocation_lat ? 'text-emerald-500' : 'text-gray-300'"
                  class="w-5 h-5"
                />
              </td>
              <td class="px-4 py-3 text-center">
                <UDropdown :items="getPDVActions(pdv)">
                  <UButton variant="ghost" size="xs" icon="i-heroicons-ellipsis-vertical" />
                </UDropdown>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="loading" class="p-8 text-center">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-fc-blue mx-auto" />
      </div>

      <div v-if="!loading && !pdvList.length" class="p-12 text-center text-gray-400">
        <MapPin class="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Aucun PDV trouvé</p>
      </div>

      <!-- Pagination -->
      <div class="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ total }} PDV trouvé(s)</p>
        <div class="flex gap-2">
          <UButton
            size="xs"
            variant="outline"
            :disabled="pdvStore.filters.page <= 1"
            @click="pdvStore.filters.page--; loadPDV()"
          >
            Précédent
          </UButton>
          <UButton
            size="xs"
            variant="outline"
            :disabled="pdvList.length < pdvStore.filters.perPage"
            @click="pdvStore.filters.page++; loadPDV()"
          >
            Suivant
          </UButton>
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <UModal v-model="showCreate" :ui="{ width: 'max-w-2xl' }">
      <div class="p-6">
        <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 mb-6">
          {{ editingPDV ? 'Modifier le PDV' : 'Nouveau Point de Vente' }}
        </h3>

        <form @submit.prevent="handleSavePDV" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <UFormGroup label="Nom du PDV" required>
              <UInput v-model="pdvForm.nom_pdv" placeholder="Nom..." />
            </UFormGroup>
            <UFormGroup label="Canal">
              <USelectMenu
                v-model="pdvForm.canal"
                :options="['General trade', 'Modern trade']"
              />
            </UFormGroup>
            <UFormGroup label="Catégorie">
              <USelectMenu
                v-model="pdvForm.categorie_pdv"
                :options="['Point de vente détail', 'Point de consommation', 'Supermarché', 'Grossiste']"
              />
            </UFormGroup>
            <UFormGroup label="Sous-catégorie">
              <USelectMenu
                v-model="pdvForm.sous_categorie_pdv"
                :options="['Boutique A', 'Boutique B', 'Boutique C', 'Superette GT', 'Kiosque']"
              />
            </UFormGroup>
            <UFormGroup label="Zone">
              <UInput v-model="pdvForm.zone" placeholder="Zone..." />
            </UFormGroup>
            <UFormGroup label="Secteur">
              <UInput v-model="pdvForm.secteur" placeholder="Secteur..." />
            </UFormGroup>
            <UFormGroup label="Région">
              <UInput v-model="pdvForm.region" placeholder="Région..." />
            </UFormGroup>
            <UFormGroup label="Adressage">
              <UInput v-model="pdvForm.adressage" placeholder="Adresse..." />
            </UFormGroup>
            <UFormGroup label="Latitude">
              <UInput v-model="pdvForm.geolocation_lat" type="number" step="any" />
            </UFormGroup>
            <UFormGroup label="Longitude">
              <UInput v-model="pdvForm.geolocation_lng" type="number" step="any" />
            </UFormGroup>
          </div>

          <div class="flex justify-end gap-2 pt-4">
            <UButton variant="ghost" @click="showCreate = false">Annuler</UButton>
            <UButton type="submit" class="bg-fc-blue" :loading="saving">
              {{ editingPDV ? 'Mettre à jour' : 'Créer' }}
            </UButton>
          </div>
        </form>
      </div>
    </UModal>

    <!-- Import Modal -->
    <UModal v-model="showImport">
      <div class="p-6">
        <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Import CSV PDV</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Importez un fichier CSV avec les colonnes : PDV ID, Nom du PDV, Canal, Catégorie de PDV, etc.
        </p>

        <div class="border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-lg p-8 text-center mb-4">
          <input
            ref="fileInput"
            type="file"
            accept=".csv"
            class="hidden"
            @change="handleFileSelect"
          />
          <UButton variant="outline" @click="($refs.fileInput as HTMLInputElement)?.click()">
            Choisir un fichier CSV
          </UButton>
          <p v-if="importFile" class="text-sm text-gray-600 mt-2">{{ importFile.name }}</p>
        </div>

        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="showImport = false">Annuler</UButton>
          <UButton
            class="bg-fc-blue"
            :disabled="!importFile"
            :loading="importing"
            @click="handleImport"
          >
            Importer
          </UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { MapPin } from 'lucide-vue-next'
import type { PDV } from '~/types'

definePageMeta({
  middleware: ['auth', 'admin'],
  layout: 'admin',
})

const pdvStore = usePDVStore()
const { exportPDVToExcel, parseCsv } = useCsvExport()
const toast = useToast()

const pdvList = computed(() => pdvStore.pdvList)
const total = computed(() => pdvStore.total)
const loading = computed(() => pdvStore.loading)

const searchQuery = ref('')
const selectedZone = ref('')
const selectedRegion = ref('')
const showCreate = ref(false)
const showImport = ref(false)
const editingPDV = ref<PDV | null>(null)
const saving = ref(false)
const importing = ref(false)
const importFile = ref<File | null>(null)

const pdvForm = ref({
  nom_pdv: '',
  canal: 'General trade',
  categorie_pdv: 'Point de vente détail',
  sous_categorie_pdv: 'Boutique C',
  zone: '',
  secteur: '',
  region: '',
  adressage: '',
  geolocation_lat: null as number | null,
  geolocation_lng: null as number | null,
})

const zoneOptions = computed(() => ['', ...pdvStore.uniqueZones])
const regionOptions = computed(() => ['', ...pdvStore.uniqueRegions])

let searchTimeout: any

function debouncedSearch() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    pdvStore.filters.search = searchQuery.value
    pdvStore.filters.page = 1
    loadPDV()
  }, 300)
}

function getPDVActions(pdv: PDV) {
  return [[
    {
      label: 'Modifier',
      icon: 'i-heroicons-pencil',
      click: () => {
        editingPDV.value = pdv
        Object.assign(pdvForm.value, pdv)
        showCreate.value = true
      },
    },
    {
      label: 'Voir sur la carte',
      icon: 'i-heroicons-map-pin',
      click: () => navigateTo(`/admin/map?lat=${pdv.geolocation_lat}&lng=${pdv.geolocation_lng}`),
    },
    {
      label: 'Supprimer',
      icon: 'i-heroicons-trash',
      click: async () => {
        if (confirm('Supprimer ce PDV ?')) {
          await pdvStore.deletePDV(pdv.pdv_id)
          toast.add({ title: 'PDV supprimé' })
          loadPDV()
        }
      },
    },
  ]]
}

async function handleSavePDV() {
  saving.value = true
  try {
    if (editingPDV.value) {
      await pdvStore.updatePDV(editingPDV.value.pdv_id, pdvForm.value)
      toast.add({ title: 'PDV mis à jour' })
    }
    else {
      await pdvStore.createPDV(pdvForm.value)
      toast.add({ title: 'PDV créé' })
    }
    showCreate.value = false
    editingPDV.value = null
    loadPDV()
  }
  catch (err: any) {
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
  }
  finally {
    saving.value = false
  }
}

async function handleExport() {
  const all = await pdvStore.fetchAllPDV()
  await exportPDVToExcel(all)
}

function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  importFile.value = target.files?.[0] || null
}

async function handleImport() {
  if (!importFile.value) return
  importing.value = true

  try {
    const text = await importFile.value.text()
    const records = parseCsv(text)
    const count = await pdvStore.importPDVFromCSV(records)
    toast.add({ title: `${count} PDV importés avec succès` })
    showImport.value = false
    importFile.value = null
    loadPDV()
  }
  catch (err: any) {
    toast.add({ title: 'Erreur d\'import', description: err.message, color: 'red' })
  }
  finally {
    importing.value = false
  }
}

async function loadPDV() {
  pdvStore.filters.zone = selectedZone.value
  pdvStore.filters.region = selectedRegion.value
  await pdvStore.fetchPDV()
}

onMounted(() => {
  loadPDV()
})
</script>
