<template>
  <div class="space-y-5">
    <!-- Actions de page dans l'en-tête : la barre de filtres garde la place
         pour la recherche et les trois filtres sur une ligne à 1440 px. -->
    <AdminPageHeader>
      <template #actions>
        <UButton variant="outline" icon="i-heroicons-arrow-down-tray" title="Exporte les points de vente de la liste, filtres compris" @click="handleExport">
          Exporter
        </UButton>
        <UButton v-if="peutEcrire" variant="outline" icon="i-heroicons-arrow-up-tray" @click="showImport = true">
          Importer (CSV)
        </UButton>
        <UButton v-if="peutEcrire" icon="i-heroicons-plus" @click="openCreatePDV">
          Nouveau point de vente
        </UButton>
      </template>
    </AdminPageHeader>

    <AdminListToolbar
      :search="searchQuery"
      search-placeholder="Nom, code client ou adresse…"
      search-label="Rechercher un point de vente"
      result-label="PDV"
      :result-count="loading && !total ? undefined : total"
      :chips="filterChips"
      @update:search="updateSearch"
      @reset="resetListFilters"
      @remove-chip="removeFilterChip"
    >
      <template #filters>
        <UFormGroup label="Territoire" size="sm" class="w-full min-w-40 sm:w-44">
          <USelectMenu
            v-model="selectedZone"
            :options="zoneOptions"
            placeholder="Tous"
            size="sm"
            class="w-full"
            searchable
            searchable-placeholder="Rechercher un territoire…"
            :loading="!refsLoaded"
            @update:model-value="applyListScope"
          />
        </UFormGroup>
        <UFormGroup label="Sous-région" size="sm" class="w-full min-w-40 sm:w-44">
          <USelectMenu
            v-model="selectedRegion"
            :options="regionOptions"
            placeholder="Toutes"
            size="sm"
            class="w-full"
            searchable
            searchable-placeholder="Rechercher une sous-région…"
            :loading="!refsLoaded"
            @update:model-value="applyListScope"
          />
        </UFormGroup>
        <UFormGroup label="Position GPS" size="sm" class="w-full min-w-40 sm:w-32 sm:min-w-32">
          <USelect
            v-model="selectedGps"
            :options="gpsOptions"
            size="sm"
            class="w-full"
            @update:model-value="applyListScope"
          />
        </UFormGroup>
      </template>

      <template #actions>
        <!-- Raccourci vers le filtre « Sans GPS ». Rouge 700 sur voile rouge :
             contraste 5,6:1 (le rouge 500 du variant soft restait à 3,4:1). -->
        <button
          v-if="pdvStore.nbSansGps && selectedGps !== 'sans'"
          type="button"
          class="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950/60"
          :title="`${pdvStore.nbSansGps.toLocaleString('fr-FR')} points de vente actifs sans coordonnées : pas de rayon de visite ni d'ordre de tournée. Cliquez pour les afficher.`"
          @click="voirSansGps"
        >
          <UIcon name="i-heroicons-exclamation-triangle" class="h-4 w-4" aria-hidden="true" />
          {{ pdvStore.nbSansGps.toLocaleString('fr-FR') }} PDV sans GPS
        </button>
      </template>
    </AdminListToolbar>

    <!-- Liste : l'essentiel par colonne ; le canal, la sous-région et la zone
         commerciale passent en texte secondaire sous la valeur principale. -->
    <div class="admin-surface overflow-hidden">
      <div class="overflow-x-auto">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Point de vente</th>
              <th class="whitespace-nowrap">Sous-catégorie</th>
              <th>Territoire</th>
              <th>Quartier</th>
              <th>Distributeur</th>
              <th class="whitespace-nowrap">Perfect Store</th>
              <th class="text-right"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="pdv in pdvList" :key="pdv.pdv_id">
              <td>
                <div class="min-w-48">
                  <div class="flex items-center gap-1">
                    <p class="font-medium text-slate-900 dark:text-white">{{ pdv.nom_pdv || 'Point de vente sans nom' }}</p>
                    <PDVPhotoModal :image-url="pdv.image_url" :pdv-id="pdv.pdv_id" :pdv-name="pdv.nom_pdv" />
                  </div>
                  <p v-if="pdv.mdm" class="text-xs text-slate-500 dark:text-slate-400">
                    Code client : <span class="tabular-nums">{{ pdv.mdm }}</span>
                  </p>
                  <span
                    v-if="!hasCoordinates(pdv)"
                    class="mt-1 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300"
                    :title="motifSansGps(pdv)"
                  >
                    <UIcon name="i-heroicons-map-pin" class="h-3.5 w-3.5" aria-hidden="true" />
                    Sans GPS
                  </span>
                  <span
                    v-else-if="gpsInfoByPdv[pdv.pdv_id]?.gps_source === 'terrain'"
                    class="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    :title="libelleGpsTerrain(pdv)"
                  >
                    <UIcon name="i-heroicons-map-pin-solid" class="h-3.5 w-3.5" aria-hidden="true" />
                    GPS relevé sur le terrain
                  </span>
                </div>
              </td>
              <td class="min-w-36">
                <p>{{ typePdvLabel(pdv.sous_categorie_pdv) || 'Non renseignée' }}</p>
                <p v-if="pdv.canal" class="text-xs text-slate-500 dark:text-slate-400">{{ libelleCanal(pdv.canal) }}</p>
              </td>
              <td>
                <p>{{ pdv.zone || 'Sans territoire' }}</p>
                <p v-if="pdv.region" class="text-xs text-slate-500 dark:text-slate-400">{{ pdv.region }}</p>
              </td>
              <td>
                <p>{{ pdv.quartier || '—' }}</p>
                <p v-if="pdv.area_code" class="text-xs text-slate-500 dark:text-slate-400">Zone commerciale {{ pdv.area_code }}</p>
              </td>
              <td>{{ pdv.distributor_name || '—' }}</td>
              <td class="whitespace-nowrap">
                <div v-if="perfectStoreByPdv[pdv.pdv_id]" class="flex items-center gap-1.5">
                  <span class="h-2 w-2 shrink-0 rounded-full" :style="{ backgroundColor: couleurNiveau(perfectStoreByPdv[pdv.pdv_id].niveau) }" aria-hidden="true" />
                  <span class="font-medium text-slate-900 dark:text-white">{{ libelleNiveau(perfectStoreByPdv[pdv.pdv_id].niveau) }}</span>
                  <span v-if="perfectStoreByPdv[pdv.pdv_id].score_global != null" class="text-xs tabular-nums text-slate-500 dark:text-slate-400">{{ perfectStoreByPdv[pdv.pdv_id].score_global }} %</span>
                </div>
                <span v-else class="text-slate-500" title="Pas encore de visite évaluée">—</span>
              </td>
              <td>
                <div class="flex items-center justify-end gap-1">
                  <UButton
                    v-if="peutEcrire"
                    color="gray"
                    variant="ghost"
                    size="xs"
                    icon="i-heroicons-pencil"
                    :aria-label="`Modifier ${pdv.nom_pdv || 'ce point de vente'}`"
                    title="Modifier"
                    @click="editPDV(pdv)"
                  />
                  <UButton
                    color="gray"
                    variant="ghost"
                    size="xs"
                    icon="i-heroicons-map-pin"
                    :disabled="!hasCoordinates(pdv)"
                    :aria-label="`Voir ${pdv.nom_pdv || 'ce point de vente'} sur la carte`"
                    :title="hasCoordinates(pdv) ? 'Voir sur la carte' : 'Coordonnées GPS manquantes'"
                    @click="openPDVOnMap(pdv)"
                  />
                  <UButton
                    v-if="peutEcrire"
                    color="red"
                    variant="ghost"
                    size="xs"
                    icon="i-heroicons-trash"
                    :aria-label="`Supprimer ${pdv.nom_pdv || 'ce point de vente'}`"
                    title="Supprimer"
                    @click="deletePDV(pdv)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <ChargementContenu v-if="loading" variante="lignes" :nombre="6" libelle="Chargement des points de vente…" class="p-5" />

      <div v-if="!loading && !pdvList.length" class="px-6 py-12 text-center">
        <UIcon name="i-heroicons-map-pin" class="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" aria-hidden="true" />
        <p class="mt-3 text-sm font-medium text-slate-900 dark:text-white">Aucun point de vente ne correspond</p>
        <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Modifiez la recherche ou réinitialisez les filtres.</p>
        <UButton class="mt-4" size="xs" variant="outline" icon="i-heroicons-arrow-path" @click="resetListFilters">
          Réinitialiser les filtres
        </UButton>
      </div>

      <AdminPagination
        v-if="total || !loading"
        :total="total"
        :page="pdvStore.filters.page"
        :page-size="pdvStore.filters.perPage"
        :loading="loading"
        item-label="PDV"
        @update:page="(p) => { pdvStore.filters.page = p; loadPDV() }"
      />
    </div>

    <!-- Create/Edit Modal -->
    <AdminFormModal
      v-model="showCreate"
      :title="editingPDV ? 'Modifier le point de vente' : 'Nouveau point de vente'"
      description="Renseignez l’identité, la zone commerciale et les coordonnées du point de vente."
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
                  <p class="text-xs text-slate-600 dark:text-slate-300">Informations utilisées dans les listes et les rapports.</p>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
                <UFormGroup label="Nom du point de vente" required size="md">
                  <UInput v-model="pdvForm.nom_pdv" placeholder="Ex. Pharmacie du Marché" size="md" class="w-full" />
                </UFormGroup>
                <UFormGroup label="Canal" size="md" help="Déduit de la catégorie choisie.">
                  <UInput :model-value="libelleCanal(derivedCanal)" disabled size="md" class="w-full" />
                </UFormGroup>
                <UFormGroup label="Catégorie" help="Grande famille de commerce ; elle détermine le canal." size="md">
                  <USelectMenu
                    v-model="pdvForm.categorie_pdv"
                    :options="categorieOptions"
                    value-attribute="value"
                    option-attribute="label"
                    searchable
                    searchable-placeholder="Rechercher une catégorie…"
                    placeholder="Sélectionner une catégorie"
                    size="md"
                    class="w-full"
                    @update:model-value="onCategorieChange"
                  />
                </UFormGroup>
                <UFormGroup label="Sous-catégorie" help="Type de point de vente : il fixe les critères Perfect Store appliqués." size="md">
                  <USelectMenu
                    v-model="pdvForm.sous_categorie_pdv"
                    :options="sousCategorieOptions"
                    value-attribute="value"
                    option-attribute="label"
                    :disabled="!pdvForm.categorie_pdv"
                    searchable
                    searchable-placeholder="Rechercher une sous-catégorie…"
                    placeholder="Sélectionner une sous-catégorie"
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
                  <p class="text-xs text-slate-600 dark:text-slate-300">Choisissez dans l’ordre : direction, sous-région, territoire, zone commerciale, puis quartier.</p>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
                <UFormGroup label="Direction" size="md">
                  <USelectMenu
                    v-model="pdvForm.region_code"
                    :options="regionCascadeOptions"
                    option-attribute="label"
                    value-attribute="value"
                    placeholder="Sélectionner une direction"
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
                <UFormGroup label="Zone commerciale" size="md">
                  <USelectMenu
                    v-model="pdvForm.area_code"
                    :options="areaCascadeOptions"
                    option-attribute="label"
                    value-attribute="value"
                    :disabled="!pdvForm.territory_code"
                    placeholder="Sélectionner une zone commerciale"
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
                <UFormGroup label="Distributeur" help="Distributeurs nationaux et ceux liés au territoire ou à la zone commerciale." size="md">
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
                  <p class="text-xs text-slate-600 dark:text-slate-300">Adresse, objectif Perfect Store et position GPS.</p>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
                <UFormGroup label="Objectif Perfect Store" help="Niveau visé pour ce point de vente." size="md">
                  <USelectMenu
                    v-model="pdvForm.objectif_perfect_store"
                    :options="['', 'FLAGSHIP', 'VIP', 'CORE', 'BASIC']"
                    placeholder="Sélectionner un objectif"
                    size="md"
                    class="w-full"
                  />
                </UFormGroup>
                <UFormGroup label="Adresse" size="md">
                  <UInput v-model="pdvForm.adressage" placeholder="Ex. Rue du Commerce, près du marché" size="md" class="w-full" />
                </UFormGroup>
                <UFormGroup label="Code client du distributeur" size="md" help="Code client du fichier du distributeur (DMS) : il sert à rapprocher les imports.">
                  <UInput v-model="pdvForm.mdm" placeholder="Ex. 150009895" size="md" class="w-full" />
                </UFormGroup>
                <UFormGroup label="Rayon de visite (m)" size="md" help="Distance maximale pour démarrer une visite ici. Laissé vide : rayon par défaut des paramètres terrain.">
                  <UInput v-model.number="pdvForm.rayon_geofence" type="number" min="20" max="2000" placeholder="Par défaut" size="md" class="w-full" />
                </UFormGroup>
                <UFormGroup label="Latitude (GPS)" size="md" help="En degrés décimaux, entre 4 et 11 en Côte d’Ivoire. Laissée vide : relevée à la première visite.">
                  <UInput v-model="pdvForm.geolocation_lat" type="number" step="any" placeholder="Ex. 5.3472" size="md" class="w-full" />
                </UFormGroup>
                <UFormGroup label="Longitude (GPS)" size="md" help="En degrés décimaux, négative en Côte d’Ivoire (entre -9 et -2).">
                  <UInput v-model="pdvForm.geolocation_lng" type="number" step="any" placeholder="Ex. -4.0268" size="md" class="w-full" />
                </UFormGroup>
              </div>
      </section>

      <template #footer>
        <UButton type="button" color="gray" variant="ghost" @click="showCreate = false">
          Annuler
        </UButton>
        <UButton type="submit" icon="i-heroicons-check" :loading="saving">
          {{ editingPDV ? 'Enregistrer les modifications' : 'Créer le point de vente' }}
        </UButton>
      </template>
    </AdminFormModal>

    <!-- Import Modal -->
    <UModal v-model="showImport">
      <div class="p-6">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Importer des points de vente (CSV)</h2>
        <div class="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <p>
            Le plus simple : exportez d’abord la liste (bouton « Exporter ») pour obtenir un modèle avec les bons en-têtes,
            complétez-le, puis importez-le ici.
          </p>
          <p>
            Colonnes attendues : PDV ID, Nom du PDV, Canal, Catégorie de PDV, Région, Zone, Quartier, Geolocation, Adressage…
          </p>
          <p>
            Colonnes facultatives : <strong class="font-semibold text-slate-900 dark:text-white">Territoire</strong> (code),
            <strong class="font-semibold text-slate-900 dark:text-white">Area</strong> (code de la zone commerciale),
            <strong class="font-semibold text-slate-900 dark:text-white">Distributeur</strong>,
            <strong class="font-semibold text-slate-900 dark:text-white">Objectif Perfect Store</strong> (FLAGSHIP, VIP, CORE ou BASIC).
          </p>
        </div>

        <div class="my-4 rounded-lg border-2 border-dashed border-slate-300 p-8 text-center dark:border-slate-600">
          <input
            ref="fileInput"
            type="file"
            accept=".csv"
            class="hidden"
            @change="handleFileSelect"
          />
          <UButton variant="outline" icon="i-heroicons-document-arrow-up" @click="($refs.fileInput as HTMLInputElement)?.click()">
            Choisir un fichier CSV
          </UButton>
          <p v-if="importFile" class="mt-2 text-sm text-slate-700 dark:text-slate-200">{{ importFile.name }}</p>
          <p v-else class="mt-2 text-xs text-slate-600 dark:text-slate-300">Aucun fichier choisi.</p>
        </div>

        <div class="flex justify-end gap-2">
          <UButton color="gray" variant="ghost" @click="showImport = false">Annuler</UButton>
          <UButton
            icon="i-heroicons-arrow-up-tray"
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
import type { PDV } from '~/types'
import { SANS_ZONE, type FiltreGps } from '~/stores/pdv'
import { canWriteTerrain } from '~/utils/roles'
import { isModernTrade } from '~/utils/canal'
import { messageUtilisateur } from '~/utils/supabaseErrors'
import { COULEUR_NON_CONFORME, niveauPerfectStore } from '~/utils/chartPalette'

definePageMeta({
  middleware: ['auth', 'admin'],
  layout: 'admin',
})

// La matrice RBAC ouvre la section « pdv » au commercial, qui consulte en
// lecture seule : la base refuse déjà ses écritures (pdv_insert_terrain /
// pdv_update_terrain, migration 20260907140100), on ne lui montre pas des
// boutons qui échoueraient.
const authStore = useAuthStore()
const peutEcrire = computed(() => canWriteTerrain(authStore.profile?.role))

const pdvStore = usePDVStore()
const { exportPDVToExcel, parseCsv } = useCsvExport()
const toast = useToast()
const supabase = useSupabaseClient()

const pdvList = computed(() => pdvStore.pdvList)
const total = computed(() => pdvStore.total)
// Le drapeau du store vaut false avant le premier fetch : sans
// premierChargement, l'état vide s'affichait pendant le chargement initial.
const premierChargement = ref(true)
const loading = computed(() => pdvStore.loading || premierChargement.value)
watch(() => pdvStore.loading, (enCours, avant) => {
  if (avant && !enCours) premierChargement.value = false
})

const searchQuery = ref('')
const selectedZone = ref('')
const selectedRegion = ref('')
const selectedGps = ref<FiltreGps>('')
const gpsOptions = [
  { label: 'GPS : tous', value: '' },
  { label: 'Sans GPS', value: 'sans' },
  { label: 'Avec GPS', value: 'avec' },
]

// Chips des filtres actifs (sous la barre) — clic = retirer ce filtre seul.
const filterChips = computed(() => {
  const chips: { key: string; label: string }[] = []
  if (selectedZone.value) chips.push({ key: 'zone', label: `Territoire : ${selectedZone.value}` })
  if (selectedRegion.value) chips.push({ key: 'region', label: `Sous-région : ${selectedRegion.value}` })
  if (selectedGps.value) chips.push({ key: 'gps', label: selectedGps.value === 'sans' ? 'Sans GPS' : 'Avec GPS' })
  return chips
})
function removeFilterChip(key: string) {
  if (key === 'zone') selectedZone.value = ''
  if (key === 'region') selectedRegion.value = ''
  if (key === 'gps') selectedGps.value = ''
  applyListScope()
}

function voirSansGps() {
  selectedGps.value = 'sans'
  applyListScope()
}

// Traçabilité GPS des lignes affichées (migration 20260930091000). Lue à part :
// la liste reste utilisable si la migration n'est pas encore appliquée.
const gpsInfoByPdv = ref<Record<string, { gps_source: string | null; gps_precision_m: number | null; gps_maj_le: string | null; auteur: string | null }>>({})

async function loadGpsInfoForList() {
  const pdvIds = pdvList.value.map(p => p.pdv_id)
  if (!pdvIds.length) {
    gpsInfoByPdv.value = {}
    return
  }
  const { data, error } = await (supabase.from('pdv') as any)
    .select('pdv_id, gps_source, gps_precision_m, gps_maj_le, auteur:gps_maj_par(nom)')
    .in('pdv_id', pdvIds)
  if (error) {
    console.warn('Traçabilité GPS indisponible', error.message)
    return
  }
  gpsInfoByPdv.value = Object.fromEntries((data || []).map((r: any) => [r.pdv_id, {
    gps_source: r.gps_source,
    gps_precision_m: r.gps_precision_m,
    gps_maj_le: r.gps_maj_le,
    auteur: r.auteur?.nom || null,
  }]))
}

function motifSansGps(pdv: PDV): string {
  const source = gpsInfoByPdv.value[pdv.pdv_id]?.gps_source
  const suite = 'Le merchandiser enregistre la position à sa première visite.'
  if (source === 'dms-depot') return `Le point GPS du fichier du distributeur (DMS) est partagé par de nombreux clients (dépôt du distributeur) : il a été écarté. ${suite}`
  if (source === 'dms-absent') return `Coordonnées absentes du fichier du distributeur (DMS). ${suite}`
  return `Coordonnées manquantes : pas de rayon de visite ni d’ordre de tournée. ${suite}`
}

// Affichage seulement : pdv.canal garde sa valeur de base (General trade / Modern trade).
function libelleCanal(canal?: string | null): string {
  if (!canal) return ''
  return isModernTrade(canal) ? 'Supermarchés (MT)' : 'Boutiques (GT)'
}

// Niveau Perfect Store en casse normale (« VIP », « Flagship »…), sans le suffixe « PERFECT STORE ».
function libelleNiveau(niveau?: string | null): string {
  const court = String(niveau || '').replace(/\s*PERFECT STORE\s*$/i, '').replace(/\s*STORE\s*$/i, '').trim()
  if (!court) return ''
  if (court.toUpperCase() === 'VIP') return 'VIP'
  return court.charAt(0).toUpperCase() + court.slice(1).toLowerCase()
}

function libelleGpsTerrain(pdv: PDV): string {
  const info = gpsInfoByPdv.value[pdv.pdv_id]
  if (!info) return ''
  const date = info.gps_maj_le ? new Date(info.gps_maj_le).toLocaleDateString('fr-FR') : '?'
  return `Position relevée sur le terrain${info.auteur ? ` par ${info.auteur}` : ''} le ${date}${info.gps_precision_m != null ? `, précision ${info.gps_precision_m} m` : ''}`
}
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
  mdm: '',
  rayon_geofence: undefined as number | undefined,
})

// Options depuis les facettes (tout le parc scopé), pas la page paginée courante.
// SANS_ZONE_LABEL isole les PDV sans territoire : invisibles des commerciaux et
// merchandisers (le scoping filtre sur zone), ils ne sont rattachables que d'ici.
const SANS_ZONE_LABEL = '— Sans territoire —'
const zoneOptions = computed(() => ['', SANS_ZONE_LABEL, ...pdvStore.facetZones])
const regionOptions = computed(() => ['', ...pdvStore.facetRegions])

// Référentiels géo (Système B) : hiérarchie Region → Sous-région → Territoire → Area.
const { distributeurs, regions, territories, areas, quartiers, subRegions, posTypes, territoireDistributeurs, zoneDistributeurs, fetchReferentiels, loaded: refsLoaded } = useReferentiels()
const { typePdvLabel, fetchTypePdvLabels } = useTypePdvLabels()

// Cascade Catégorie (level3 / groupe) → Sous-catégorie (level4 / type de PDV).
// Options {label: nom_fr, value: nom EN} : affichage français, valeur stockée
// inchangée (nom EN du référentiel, utilisé par le matching Perfect Store).
const categorieOptions = computed(() => {
  const byNom = new Map(posTypes.value.filter(p => p.level3_group).map(p => [p.level3_group, p.level3_fr]))
  return [...byNom.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'))
})
// Canal dérivé de la catégorie (categorie_pdv.canal), aligné sur le calcul
// Perfect Store — plus de saisie manuelle.
const derivedCanal = computed(() => {
  const pos = posTypes.value.find(p => p.level3_group === pdvForm.value.categorie_pdv)
  return canalLabelFromCode((pos as any)?.canal)
})
const sousCategorieOptions = computed(() => posTypes.value
  .filter(p => !pdvForm.value.categorie_pdv || p.level3_group === pdvForm.value.categorie_pdv)
  .map(p => ({ value: p.level4_type, label: p.level4_fr })))
function onCategorieChange() {
  // Réinitialise la sous-catégorie si elle n'appartient plus à la catégorie choisie.
  if (!sousCategorieOptions.value.some(o => o.value === pdvForm.value.sous_categorie_pdv)) {
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
function onAreaChange() {
  pdvForm.value.quartier_nom = ''
  // Le distributeur découle de l'area choisie (repli territoire puis national).
  pdvForm.value.distributor_name = localDistributors.value[0]?.name || nationalDistributors.value[0]?.name || ''
}
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

// Distributeurs : nationaux (toujours) + ceux liés au périmètre. Priorité à
// l'AREA sélectionnée (zone_distributeur, permet de varier d'une area à l'autre
// dans un même territoire), repli sur le territoire.
const nationalDistributors = computed(() => distributeurs.value.filter(d => d.national))
const territoryDistributors = computed(() => {
  if (!pdvForm.value.territory_code) return []
  const linked = new Set(territoireDistributeurs.value
    .filter(td => td.territory_code === pdvForm.value.territory_code)
    .map(td => td.distributor_name))
  return distributeurs.value.filter(d => linked.has(d.name) && !d.national)
})
const areaDistributors = computed(() => {
  if (!selectedZoneId.value) return []
  const linked = new Set(zoneDistributeurs.value
    .filter(zd => zd.zone_id === selectedZoneId.value)
    .map(zd => zd.distributor_name))
  return distributeurs.value.filter(d => linked.has(d.name) && !d.national)
})
// Portée locale = area si elle a des distributeurs propres, sinon repli territoire.
const localDistributors = computed(() =>
  areaDistributors.value.length ? areaDistributors.value : territoryDistributors.value)
const distributorScopeLabel = computed(() => areaDistributors.value.length ? 'Zone commerciale' : 'Territoire')
const distributorOptions = computed(() => {
  const seen = new Set<string>()
  const out: { value: string; label: string }[] = [{ value: '', label: '—' }]
  for (const d of localDistributors.value) { if (!seen.has(d.name)) { seen.add(d.name); out.push({ value: d.name, label: `${d.name} (${distributorScopeLabel.value})` }) } }
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

function updateSearch(value: string) {
  searchQuery.value = value
  debouncedSearch()
}

function resetListFilters() {
  searchQuery.value = ''
  selectedZone.value = ''
  selectedRegion.value = ''
  selectedGps.value = ''
  pdvStore.filters.search = ''
  pdvStore.filters.zone = ''
  pdvStore.filters.region = ''
  pdvStore.filters.gps = ''
  pdvStore.filters.page = 1
  loadPDV()
}

function applyListScope() {
  pdvStore.filters.page = 1
  loadPDV()
}

async function editPDV(pdv: PDV) {
  editingPDV.value = pdv
  Object.assign(pdvForm.value, pdv)
  // Reset référentiels (absents de LIST_COLUMNS), puis préremplir via la ligne complète
  pdvForm.value.territory_code = ''
  pdvForm.value.area_code = ''
  pdvForm.value.quartier_nom = ''
  pdvForm.value.distributor_name = ''
  pdvForm.value.objectif_perfect_store = ''
  pdvForm.value.mdm = ''
  pdvForm.value.rayon_geofence = undefined
  showCreate.value = true
  try {
    const full: any = await pdvStore.fetchPDVById(pdv.pdv_id)
    if (full) {
      pdvForm.value.territory_code = full.territory_code || ''
      pdvForm.value.area_code = full.area_code || ''
      pdvForm.value.distributor_name = full.distributor_name || ''
      pdvForm.value.objectif_perfect_store = full.objectif_perfect_store || ''
      pdvForm.value.mdm = full.mdm || ''
      pdvForm.value.rayon_geofence = full.rayon_geofence ?? undefined
      hydrateGeoCascade()
      // Préselection quartier si présent dans les options de l'area (byte-exact).
      pdvForm.value.quartier_nom = quartierCascadeOptions.value.some(o => o.value === full.quartier)
        ? full.quartier
        : ''
    }
  } catch { /* colonnes absentes avant migration 020 — ignorer */ }
}

function openPDVOnMap(pdv: PDV) {
  if (!hasCoordinates(pdv)) return
  navigateTo(`/admin/map?lat=${pdv.geolocation_lat}&lng=${pdv.geolocation_lng}`)
}

// Le store désactive le PDV (is_active = false) et ses lignes de tournée sont
// retirées : la confirmation le dit avec le nom du point de vente.
async function deletePDV(pdv: PDV) {
  const nom = pdv.nom_pdv || 'ce point de vente'
  if (!confirm(`Supprimer « ${nom} » ?\n\nIl n’apparaîtra plus dans les listes ni dans les tournées.`)) return
  try {
    await pdvStore.deletePDV(pdv.pdv_id)
    toast.add({ title: 'Point de vente supprimé', description: `« ${nom} » n’apparaît plus dans les listes ni dans les tournées.`, color: 'green' })
    loadPDV()
  }
  catch (err) {
    console.error('Suppression du PDV impossible', err)
    toast.add({ title: 'Suppression impossible', description: messageUtilisateur(err), color: 'red' })
  }
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
    mdm: '',
    rayon_geofence: undefined,
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
    payload.mdm = String(payload.mdm || '').trim() || null
    // Rayon vide : rayon par défaut des Paramètres terrain (création : défaut de la base).
    const rayon = payload.rayon_geofence === '' || payload.rayon_geofence == null ? null : Number(payload.rayon_geofence)
    if (rayon == null && !editingPDV.value) delete payload.rayon_geofence
    else payload.rayon_geofence = rayon

    if (editingPDV.value) {
      await pdvStore.updatePDV(editingPDV.value.pdv_id, payload)
      toast.add({ title: 'Point de vente mis à jour', color: 'green' })
    }
    else {
      await pdvStore.createPDV(payload)
      toast.add({ title: 'Point de vente créé', color: 'green' })
    }
    showCreate.value = false
    editingPDV.value = null
    loadPDV()
  }
  catch (err) {
    console.error('Enregistrement du PDV impossible', err)
    toast.add({ title: 'Enregistrement impossible', description: messageUtilisateur(err), color: 'red' })
  }
  finally {
    saving.value = false
  }
}

// Exporte la sélection affichée (filtres compris) : « Sans GPS » + Export =
// la liste à transmettre pour relever les coordonnées.
async function handleExport() {
  try {
    const all = await pdvStore.fetchAllPDV(true)
    await exportPDVToExcel(all)
  }
  catch (err) {
    console.error('Export des PDV impossible', err)
    toast.add({ title: 'Export impossible', description: messageUtilisateur(err), color: 'red' })
  }
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
    toast.add({ title: `${count} points de vente importés`, color: 'green' })
    showImport.value = false
    importFile.value = null
    loadPDV()
  }
  catch (err) {
    console.error('Import CSV des PDV impossible', err)
    toast.add({ title: 'Import impossible', description: messageUtilisateur(err), color: 'red' })
  }
  finally {
    importing.value = false
  }
}

// Dernier niveau Perfect Store connu par PDV (vue v_perfect_store_liste : 1 ligne/PDV, visite la plus récente).
const perfectStoreByPdv = ref<Record<string, { niveau: string; score_global: number | null }>>({})

// Échelle ordonnée des niveaux (DESIGN.md, NIVEAUX_PS) : une teinte bleue du
// foncé au clair, slate pour « Non conforme » ; le mot suit toujours le point.
function couleurNiveau(tier: string): string {
  return niveauPerfectStore(tier)?.couleur ?? COULEUR_NON_CONFORME
}

function hasCoordinates(pdv: PDV): boolean {
  if (pdv.geolocation_lat == null || pdv.geolocation_lng == null) return false
  if (String(pdv.geolocation_lat).trim() === '' || String(pdv.geolocation_lng).trim() === '') return false
  const latitude = Number(pdv.geolocation_lat)
  const longitude = Number(pdv.geolocation_lng)
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180
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
  pdvStore.filters.zone = selectedZone.value === SANS_ZONE_LABEL ? SANS_ZONE : selectedZone.value
  pdvStore.filters.region = selectedRegion.value
  pdvStore.filters.gps = selectedGps.value
  await pdvStore.fetchPDV()
  await Promise.all([loadPerfectStoreForList(), loadGpsInfoForList()])
}

onMounted(() => {
  // Préfiltre zone transmis par l'écran Répartition (?zone=...).
  const route = useRoute()
  const zoneParam = route.query.zone
  if (typeof zoneParam === 'string' && zoneParam) {
    selectedZone.value = zoneParam
    pdvStore.filters.page = 1
  }
  // ?gps=sans : lien direct vers les PDV à géolocaliser.
  const gpsParam = route.query.gps
  if (gpsParam === 'sans' || gpsParam === 'avec') {
    selectedGps.value = gpsParam
    pdvStore.filters.page = 1
  }
  loadPDV()
  pdvStore.compterSansGps()
  pdvStore.fetchFilterFacets()
  fetchReferentiels()
  fetchTypePdvLabels()
})
</script>
