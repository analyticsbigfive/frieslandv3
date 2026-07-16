<template>
  <div>
    <!-- Header actions -->
    <div class="admin-toolbar mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <UInput
          v-model="searchQuery"
          placeholder="Rechercher un PDV..."
          icon="i-heroicons-magnifying-glass"
          size="sm"
          class="w-full sm:w-64"
          @input="debouncedSearch"
        />
        <USelectMenu
          v-model="selectedZone"
          :options="zoneOptions"
          placeholder="Territoire"
          size="sm"
          class="w-40"
          @update:model-value="loadPDV"
        />
        <USelectMenu
          v-model="selectedRegion"
          :options="regionOptions"
          placeholder="Sous-région"
          size="sm"
          class="w-40"
          @update:model-value="loadPDV"
        />
      </div>

      <div class="flex flex-wrap gap-2">
        <UButton size="sm" variant="outline" @click="handleExport" icon="i-heroicons-arrow-down-tray">
          Export
        </UButton>
        <UButton size="sm" variant="outline" @click="showImport = true" icon="i-heroicons-arrow-up-tray">
          Import CSV
        </UButton>
        <UButton size="sm" @click="openCreatePDV" icon="i-heroicons-plus" class="bg-fc-blue">
          Nouveau PDV
        </UButton>
      </div>
    </div>

    <!-- PDV Table -->
    <div class="admin-surface overflow-hidden">
      <div class="overflow-x-auto">
        <table class="admin-table w-full">
          <thead>
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nom</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Canal</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Catégorie</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Sous-région</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Territoire</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Code area</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Quartier</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Distributeur</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Perfect Store</th>
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
              <td class="px-4 py-3 text-sm text-gray-600">{{ pdv.region }}</td>
              <td class="px-4 py-3 text-sm text-gray-600">{{ pdv.zone }}</td>
              <td class="px-4 py-3 font-mono text-xs text-gray-500">{{ pdv.area_code || '—' }}</td>
              <td class="px-4 py-3 text-sm text-gray-600">{{ pdv.quartier }}</td>
              <td class="px-4 py-3 text-sm text-gray-600">{{ pdv.distributor_name || '—' }}</td>
              <td class="px-4 py-3 text-center">
                <div v-if="perfectStoreByPdv[pdv.pdv_id]" class="flex items-center justify-center gap-1.5">
                  <span class="h-2 w-2 rounded-full" :class="tierDotClass(perfectStoreByPdv[pdv.pdv_id].niveau)" />
                  <span class="text-xs font-medium text-gray-700 dark:text-gray-300">{{ perfectStoreByPdv[pdv.pdv_id].niveau }}</span>
                  <span class="text-xs text-gray-400">({{ perfectStoreByPdv[pdv.pdv_id].score_global }}%)</span>
                </div>
                <span v-else class="text-xs text-gray-300">—</span>
              </td>
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
    <AdminFormModal
      v-model="showCreate"
      :title="editingPDV ? 'Modifier le point de vente' : 'Nouveau point de vente'"
      description="Renseignez l’identité, la zone commerciale et les coordonnées du PDV."
      icon="i-heroicons-map-pin"
      width="sm:max-w-3xl"
      body-class="space-y-8"
      as-form
      required-note
      @submit="handleSavePDV"
    >
      <section aria-labelledby="pdv-identite-title">
              <div class="mb-4 flex items-center gap-3">
                <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  <UIcon name="i-heroicons-building-storefront" class="h-4 w-4" />
                </div>
                <div>
                  <h4 id="pdv-identite-title" class="text-sm font-semibold text-slate-900 dark:text-white">
                    Identité commerciale
                  </h4>
                  <p class="text-xs text-slate-500 dark:text-slate-400">Informations utilisées dans les listes et les rapports.</p>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
                <UFormGroup label="Nom du PDV" required size="md">
                  <UInput v-model="pdvForm.nom_pdv" placeholder="Ex. Pharmacie du Marché" size="md" class="w-full" />
                </UFormGroup>
                <UFormGroup label="Canal" size="md" help="Déduit de la catégorie choisie">
                  <UInput :model-value="derivedCanal" disabled size="md" class="w-full" />
                </UFormGroup>
                <UFormGroup label="Catégorie" help="Groupe de niveau 3 du référentiel." size="md">
                  <USelectMenu
                    v-model="pdvForm.categorie_pdv"
                    :options="categorieOptions"
                    searchable
                    searchable-placeholder="Rechercher une catégorie..."
                    placeholder="Sélectionner une catégorie"
                    size="md"
                    class="w-full"
                    @update:model-value="onCategorieChange"
                  />
                </UFormGroup>
                <UFormGroup label="Sous-catégorie" help="Type de PDV utilisé pour le scoring Perfect Store." size="md">
                  <USelectMenu
                    v-model="pdvForm.sous_categorie_pdv"
                    :options="sousCategorieOptions"
                    :disabled="!pdvForm.categorie_pdv"
                    searchable
                    searchable-placeholder="Rechercher un type..."
                    placeholder="Sélectionner un type de PDV"
                    size="md"
                    class="w-full"
                  />
                </UFormGroup>
              </div>
      </section>

      <section aria-labelledby="pdv-zone-title" class="border-t border-slate-200 pt-7 dark:border-slate-700">
              <div class="mb-4 flex items-center gap-3">
                <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  <UIcon name="i-heroicons-map" class="h-4 w-4" />
                </div>
                <div>
                  <h4 id="pdv-zone-title" class="text-sm font-semibold text-slate-900 dark:text-white">
                    Zone commerciale
                  </h4>
                  <p class="text-xs text-slate-500 dark:text-slate-400">Sélectionnez les niveaux dans l’ordre : région, territoire, puis quartier.</p>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
                <UFormGroup label="Division" size="md">
                  <USelectMenu
                    v-model="pdvForm.region_code"
                    :options="regionCascadeOptions"
                    option-attribute="label"
                    value-attribute="value"
                    placeholder="Sélectionner une division"
                    searchable
                    searchable-placeholder="Rechercher..."
                    size="md"
                    class="w-full"
                    @update:model-value="onRegionChange"
                  />
                </UFormGroup>
                <UFormGroup label="Sous-région" size="md">
                  <USelectMenu
                    v-model="pdvForm.sub_region_code"
                    :options="subRegionCascadeOptions"
                    option-attribute="label"
                    value-attribute="value"
                    :disabled="!pdvForm.region_code"
                    placeholder="Sélectionner une sous-région"
                    searchable
                    searchable-placeholder="Rechercher..."
                    size="md"
                    class="w-full"
                    @update:model-value="onSousRegionChange"
                  />
                </UFormGroup>
                <UFormGroup label="Territoire" size="md">
                  <USelectMenu
                    v-model="pdvForm.territory_code"
                    :options="territoryCascadeOptions"
                    option-attribute="label"
                    value-attribute="value"
                    :disabled="!pdvForm.region_code"
                    placeholder="Sélectionner un territoire"
                    searchable
                    searchable-placeholder="Rechercher..."
                    size="md"
                    class="w-full"
                    @update:model-value="onTerritoryChange"
                  />
                </UFormGroup>
                <UFormGroup label="Code area" size="md">
                  <USelectMenu
                    v-model="pdvForm.area_code"
                    :options="areaCascadeOptions"
                    option-attribute="label"
                    value-attribute="value"
                    :disabled="!pdvForm.territory_code"
                    placeholder="Sélectionner une area"
                    searchable
                    searchable-placeholder="Rechercher..."
                    size="md"
                    class="w-full"
                    @update:model-value="onAreaChange"
                  />
                </UFormGroup>
                <UFormGroup label="Quartier" size="md">
                  <USelectMenu
                    v-model="pdvForm.quartier_nom"
                    :options="quartierCascadeOptions"
                    option-attribute="label"
                    value-attribute="value"
                    :disabled="!pdvForm.area_code"
                    placeholder="Sélectionner un quartier"
                    searchable
                    searchable-placeholder="Rechercher..."
                    size="md"
                    class="w-full"
                  />
                </UFormGroup>
                <UFormGroup label="Distributeur" help="Distributeurs nationaux et liés au territoire." size="md">
                  <USelectMenu
                    v-model="pdvForm.distributor_name"
                    :options="distributorOptions"
                    option-attribute="label"
                    value-attribute="value"
                    placeholder="Sélectionner un distributeur"
                    searchable
                    searchable-placeholder="Rechercher..."
                    size="md"
                    class="w-full"
                  />
                </UFormGroup>
              </div>
      </section>

      <section aria-labelledby="pdv-details-title" class="border-t border-slate-200 pt-7 dark:border-slate-700">
              <div class="mb-4 flex items-center gap-3">
                <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  <UIcon name="i-heroicons-map-pin" class="h-4 w-4" />
                </div>
                <div>
                  <h4 id="pdv-details-title" class="text-sm font-semibold text-slate-900 dark:text-white">
                    Détails et coordonnées
                  </h4>
                  <p class="text-xs text-slate-500 dark:text-slate-400">Adresse terrain, objectif commercial et position GPS.</p>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
                <UFormGroup label="Objectif Perfect Store" size="md">
                  <USelectMenu
                    v-model="pdvForm.objectif_perfect_store"
                    :options="['', 'FLAGSHIP', 'VIP', 'CORE', 'BASIC']"
                    placeholder="Sélectionner un objectif"
                    size="md"
                    class="w-full"
                  />
                </UFormGroup>
                <UFormGroup label="Adressage" size="md">
                  <UInput v-model="pdvForm.adressage" placeholder="Ex. Rue du Commerce, près du marché" size="md" class="w-full" />
                </UFormGroup>
                <UFormGroup label="Latitude" size="md">
                  <UInput v-model="pdvForm.geolocation_lat" type="number" step="any" placeholder="Ex. 5.3472" size="md" class="w-full" />
                </UFormGroup>
                <UFormGroup label="Longitude" size="md">
                  <UInput v-model="pdvForm.geolocation_lng" type="number" step="any" placeholder="Ex. -4.0268" size="md" class="w-full" />
                </UFormGroup>
              </div>
      </section>

      <template #footer>
        <UButton type="button" color="gray" variant="ghost" @click="showCreate = false">
          Annuler
        </UButton>
        <UButton
          type="submit"
          icon="i-heroicons-check"
          class="bg-fc-blue text-white hover:bg-fc-blue-600 disabled:bg-fc-blue-300 aria-disabled:bg-fc-blue-300 focus-visible:outline-fc-blue-500 dark:bg-fc-blue dark:text-white dark:hover:bg-fc-blue-600 dark:disabled:bg-fc-blue-700 dark:aria-disabled:bg-fc-blue-700 dark:focus-visible:outline-fc-blue-400"
          :loading="saving"
        >
          {{ editingPDV ? 'Mettre à jour' : 'Créer le PDV' }}
        </UButton>
      </template>
    </AdminFormModal>

    <!-- Import Modal -->
    <UModal v-model="showImport">
      <div class="p-6">
        <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Import CSV PDV</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Colonnes : PDV ID, Nom du PDV, Canal, Catégorie de PDV, Région, Zone, Quartier, Geolocation, Adressage…
          <br>Référentiels (optionnel) : <strong>Territoire</strong> (code), <strong>Area</strong> (code), <strong>Distributeur</strong>, <strong>Objectif Perfect Store</strong> (FLAGSHIP/VIP/CORE/BASIC).
          <br>Astuce : exporte d'abord (bouton Export) pour récupérer le modèle avec les bons en-têtes.
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
const supabase = useSupabaseClient()

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
  categorie_pdv: '',
  sous_categorie_pdv: '',
  zone: '',
  region: '',
  region_code: '',
  sub_region_code: '',
  adressage: '',
  geolocation_lat: null as number | null,
  geolocation_lng: null as number | null,
  territory_code: '',
  area_code: '',
  quartier_nom: '',
  distributor_name: '',
  objectif_perfect_store: '',
})

const zoneOptions = computed(() => ['', ...pdvStore.uniqueZones])
const regionOptions = computed(() => ['', ...pdvStore.uniqueRegions])

// Référentiels géo (Système B) : hiérarchie Region → Sous-région → Territoire → Area.
const { distributeurs, regions, territories, areas, quartiers, subRegions, posTypes, territoireDistributeurs, fetchReferentiels } = useReferentiels()

// Cascade Catégorie (level3 / groupe) → Sous-catégorie (level4 / type de PDV).
const categorieOptions = computed(() => [...new Set(posTypes.value.map(p => p.level3_group).filter(Boolean))].sort())
// Canal dérivé de la catégorie (categorie_pdv.canal), aligné sur le calcul
// Perfect Store — plus de saisie manuelle.
const derivedCanal = computed(() => {
  const pos = posTypes.value.find(p => p.level3_group === pdvForm.value.categorie_pdv)
  return canalLabelFromCode((pos as any)?.canal)
})
const sousCategorieOptions = computed(() => posTypes.value
  .filter(p => !pdvForm.value.categorie_pdv || p.level3_group === pdvForm.value.categorie_pdv)
  .map(p => p.level4_type))
function onCategorieChange() {
  // Réinitialise la sous-catégorie si elle n'appartient plus à la catégorie choisie.
  if (!sousCategorieOptions.value.includes(pdvForm.value.sous_categorie_pdv)) {
    pdvForm.value.sous_categorie_pdv = ''
  }
}

// Cascade géographique simplifiée (CI uniquement) : Région → Territoire → Area.
// La sous-région est intermédiaire, dérivée automatiquement du territoire.
const subRegionCodesForRegion = computed(() => new Set(
  subRegions.value.filter(s => s.region_code === pdvForm.value.region_code).map(s => s.code),
))
const regionCascadeOptions = computed(() => regions.value.map(r => ({ value: r.code, label: r.nom_affichage ? `${r.nom_affichage} · ${r.name}` : r.name })))
const subRegionCascadeOptions = computed(() => subRegions.value
  .filter(s => !pdvForm.value.region_code || s.region_code === pdvForm.value.region_code)
  .map(s => ({ value: s.code, label: s.nom_affichage ? `${s.nom_affichage} · ${s.name}` : s.name })))
const territoryCascadeOptions = computed(() => territories.value
  .filter(t => pdvForm.value.sub_region_code
    ? t.sub_region_code === pdvForm.value.sub_region_code
    : (!pdvForm.value.region_code || subRegionCodesForRegion.value.has(t.sub_region_code || '')))
  .map(t => ({ value: t.code, label: t.name })))
const areaCascadeOptions = computed(() => areas.value
  .filter(a => !pdvForm.value.territory_code || a.territory_code === pdvForm.value.territory_code)
  .map(a => ({ value: a.code, label: a.code })))
// zone.id de l'area sélectionnée (territoire + code) : clé pour désambiguïser les
// quartiers homonymes (ex SLEIL sur GAG 1 vs GAG 2).
const selectedZoneId = computed(() => areas.value.find(a =>
  a.code === pdvForm.value.area_code && a.territory_code === pdvForm.value.territory_code)?.id)
const quartierCascadeOptions = computed(() => quartiers.value
  .filter(q => q.zone_id === selectedZoneId.value)
  .sort((a, b) => a.ordre - b.ordre)
  .map(q => ({ value: q.nom, label: q.nom })))

// Reset des niveaux enfants quand un parent change.
function onRegionChange() { pdvForm.value.sub_region_code = ''; pdvForm.value.territory_code = ''; pdvForm.value.area_code = ''; pdvForm.value.quartier_nom = '' }
function onSousRegionChange() { pdvForm.value.territory_code = ''; pdvForm.value.area_code = ''; pdvForm.value.quartier_nom = '' }
function onAreaChange() { pdvForm.value.quartier_nom = '' }
function onTerritoryChange() {
  pdvForm.value.area_code = ''
  pdvForm.value.quartier_nom = ''
  // Dérive la sous-région du territoire choisi (interne, pour le save).
  const terr = territories.value.find(t => t.code === pdvForm.value.territory_code)
  if (terr?.sub_region_code) pdvForm.value.sub_region_code = terr.sub_region_code
  // Distributeur par défaut : premier lié au territoire, sinon premier national.
  if (!pdvForm.value.distributor_name) {
    pdvForm.value.distributor_name = territoryDistributors.value[0]?.name || nationalDistributors.value[0]?.name || ''
  }
}

// Édition : reconstruit region_code/sub_region_code depuis le territory_code enregistré.
function hydrateGeoCascade() {
  const terr = territories.value.find(t => t.code === pdvForm.value.territory_code)
  const sr = terr ? subRegions.value.find(s => s.code === terr.sub_region_code) : null
  pdvForm.value.sub_region_code = sr?.code || ''
  pdvForm.value.region_code = sr?.region_code || ''
}

// Distributeurs : nationaux (toujours) + ceux liés au territoire sélectionné.
const nationalDistributors = computed(() => distributeurs.value.filter(d => d.national))
const territoryDistributors = computed(() => {
  if (!pdvForm.value.territory_code) return []
  const linked = new Set(territoireDistributeurs.value
    .filter(td => td.territory_code === pdvForm.value.territory_code)
    .map(td => td.distributor_name))
  return distributeurs.value.filter(d => linked.has(d.name) && !d.national)
})
const distributorOptions = computed(() => {
  const seen = new Set<string>()
  const out: { value: string; label: string }[] = [{ value: '', label: '—' }]
  for (const d of territoryDistributors.value) { if (!seen.has(d.name)) { seen.add(d.name); out.push({ value: d.name, label: `${d.name} (Territoire)` }) } }
  for (const d of nationalDistributors.value) { if (!seen.has(d.name)) { seen.add(d.name); out.push({ value: d.name, label: `${d.name} (National)` }) } }
  // Conserve la valeur courante si hors liste (édition d'un ancien PDV).
  if (pdvForm.value.distributor_name && !seen.has(pdvForm.value.distributor_name)) {
    out.push({ value: pdvForm.value.distributor_name, label: pdvForm.value.distributor_name })
  }
  return out
})

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
      click: async () => {
        editingPDV.value = pdv
        Object.assign(pdvForm.value, pdv)
        // Reset référentiels (absents de LIST_COLUMNS), puis préremplir via la ligne complète
        pdvForm.value.territory_code = ''
        pdvForm.value.area_code = ''
        pdvForm.value.quartier_nom = ''
        pdvForm.value.distributor_name = ''
        pdvForm.value.objectif_perfect_store = ''
        showCreate.value = true
        try {
          const full: any = await pdvStore.fetchPDVById(pdv.pdv_id)
          if (full) {
            pdvForm.value.territory_code = full.territory_code || ''
            pdvForm.value.area_code = full.area_code || ''
            pdvForm.value.distributor_name = full.distributor_name || ''
            pdvForm.value.objectif_perfect_store = full.objectif_perfect_store || ''
            hydrateGeoCascade()
            // Préselection quartier si présent dans les options de l'area (byte-exact).
            pdvForm.value.quartier_nom = quartierCascadeOptions.value.some(o => o.value === full.quartier)
              ? full.quartier
              : ''
          }
        } catch { /* colonnes absentes avant migration 020 — ignorer */ }
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

function openCreatePDV() {
  editingPDV.value = null
  pdvForm.value = {
    nom_pdv: '',
    canal: 'General trade',
    categorie_pdv: '',
    sous_categorie_pdv: '',
    zone: '',
    region: '',
    region_code: '',
    sub_region_code: '',
    adressage: '',
    geolocation_lat: null,
    geolocation_lng: null,
    territory_code: '',
    area_code: '',
    quartier_nom: '',
    distributor_name: '',
    objectif_perfect_store: '',
  }
  showCreate.value = true
}

async function handleSavePDV() {
  saving.value = true
  try {
    // Dérive zone (territoire.nom) / region (sous_region) depuis la cascade géo,
    // pour rester cohérent avec le scoping (matchesPDVScope lit zone + quartier).
    const terr = territories.value.find(t => t.code === pdvForm.value.territory_code)
    const sr = subRegions.value.find(s => s.code === pdvForm.value.sub_region_code)
    const payload: any = { ...pdvForm.value, canal: derivedCanal.value }
    if (terr) payload.zone = terr.name
    if (sr) payload.region = sr.nom_affichage || sr.name
    // quartier = nom exact du quartier choisi (plus de bloc d'area collé).
    payload.quartier = pdvForm.value.quartier_nom || null
    // region_code/sub_region_code/quartier_nom ne sont pas des colonnes pdv (cascade UI only).
    delete payload.region_code
    delete payload.sub_region_code
    delete payload.quartier_nom
    payload.territory_code = payload.territory_code || null
    payload.area_code = payload.area_code || null
    payload.distributor_name = payload.distributor_name || null
    payload.objectif_perfect_store = payload.objectif_perfect_store || null

    if (editingPDV.value) {
      await pdvStore.updatePDV(editingPDV.value.pdv_id, payload)
      toast.add({ title: 'PDV mis à jour' })
    }
    else {
      await pdvStore.createPDV(payload)
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

// Dernier niveau Perfect Store connu par PDV (vue v_perfect_store_liste : 1 ligne/PDV, visite la plus récente).
const perfectStoreByPdv = ref<Record<string, { niveau: string; score_global: number | null }>>({})

function tierDotClass(tier: string): string {
  if (tier?.startsWith('FLAGSHIP')) return 'bg-violet-500'
  if (tier?.startsWith('VIP')) return 'bg-emerald-500'
  if (tier?.startsWith('CORE')) return 'bg-blue-500'
  return 'bg-amber-500'
}

async function loadPerfectStoreForList() {
  const pdvIds = pdvList.value.map(p => p.pdv_id)
  if (!pdvIds.length) {
    perfectStoreByPdv.value = {}
    return
  }
  const { data, error } = await supabase
    .from('v_perfect_store_liste')
    .select('pdv_id, niveau, score_global')
    .in('pdv_id', pdvIds)
  if (error) {
    console.warn('v_perfect_store_liste indisponible', error.message)
    return
  }
  perfectStoreByPdv.value = Object.fromEntries((data || []).map((r: any) => [r.pdv_id, { niveau: r.niveau, score_global: r.score_global }]))
}

async function loadPDV() {
  pdvStore.filters.zone = selectedZone.value
  pdvStore.filters.region = selectedRegion.value
  await pdvStore.fetchPDV()
  await loadPerfectStoreForList()
}

onMounted(() => {
  loadPDV()
  fetchReferentiels()
})
</script>
