<template>
  <div class="bg-gray-50 dark:bg-gray-700/50 min-h-full">
    <FormWizard
      v-model="currentTab"
      :steps="wizardSteps"
      :saving="saving"
      submit-label="Enregistrer la visite"
      @submit="handleSave"
      @cancel="handleCancel"
      @step-change="onStepChange"
    >
      <!-- STEP: Général -->
      <template #general>
        <div class="space-y-5">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">PDV *</label>
            <USelectMenu
              v-model="form.pdv_id"
              :options="pdvOptions"
              placeholder="Sélectionner un PDV"
              searchable
              searchable-placeholder="Rechercher..."
              option-attribute="label"
              value-attribute="value"
              size="lg"
            />
            <div v-if="canCreatePDV" class="mt-2 flex justify-end">
              <UButton
                size="xs"
                variant="soft"
                icon="i-heroicons-plus"
                @click="showCreatePDV = true"
              >
                PDV introuvable ? Créer un PDV
              </UButton>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date *</label>
            <UInput v-model="form.date_visite" type="datetime-local" size="lg" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
            <UInput :model-value="userEmail" disabled size="lg" />
          </div>
        </div>
      </template>

      <!-- STEP: EVAP -->
      <template #evap>
        <div class="space-y-4">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <span class="text-lg font-bold text-fc-red">E</span>
            </div>
            <div>
              <h3 class="text-base font-bold text-gray-900 dark:text-gray-100">EVAP — Évaporé</h3>
              <p class="text-xs text-gray-400">Disponibilité et prix des produits évaporés</p>
            </div>
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-xl p-4 space-y-3 shadow-sm">
            <h4 class="text-sm font-bold text-gray-800">EVAP Présent? *</h4>
            <ToggleYesNo v-model="form.produits.evap.present" />

            <template v-if="form.produits.evap.present">
              <div v-for="prod in evapProducts" :key="prod.key" class="space-y-1">
                <label class="text-sm font-medium text-gray-600">{{ prod.label }} *</label>
                <ToggleStatus v-model="form.produits.evap[prod.key]" />
              </div>
              <div class="space-y-1 pt-2 border-t border-gray-100 dark:border-gray-700">
                <label class="text-sm font-medium text-gray-600">Prix respectés? *</label>
                <ToggleYesNo v-model="form.produits.evap.prix_respectes" />
              </div>
            </template>
          </div>
        </div>
      </template>

      <!-- STEP: IMP -->
      <template #imp>
        <div class="space-y-4">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
              <span class="text-lg font-bold text-orange-600">I</span>
            </div>
            <div>
              <h3 class="text-base font-bold text-gray-900 dark:text-gray-100">IMP — Importé</h3>
              <p class="text-xs text-gray-400">Disponibilité et prix des produits importés</p>
            </div>
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-xl p-4 space-y-3 shadow-sm">
            <h4 class="text-sm font-bold text-gray-800">IMP Présent? *</h4>
            <ToggleYesNo v-model="form.produits.imp.present" />

            <template v-if="form.produits.imp.present">
              <div v-for="prod in impProducts" :key="prod.key" class="space-y-1">
                <label class="text-sm font-medium text-gray-600">{{ prod.label }} *</label>
                <ToggleStatus v-model="form.produits.imp[prod.key]" />
              </div>
              <div class="space-y-1 pt-2 border-t border-gray-100 dark:border-gray-700">
                <label class="text-sm font-medium text-gray-600">Prix respectés? *</label>
                <ToggleYesNo v-model="form.produits.imp.prix_respectes" />
              </div>
            </template>
          </div>
        </div>
      </template>

      <!-- STEP: SCM -->
      <template #scm>
        <div class="space-y-4">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <span class="text-lg font-bold text-emerald-600">S</span>
            </div>
            <div>
              <h3 class="text-base font-bold text-gray-900 dark:text-gray-100">SCM — Sweetened Condensed</h3>
              <p class="text-xs text-gray-400">Disponibilité et prix SCM</p>
            </div>
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-xl p-4 space-y-3 shadow-sm">
            <h4 class="text-sm font-bold text-gray-800">SCM Présent? *</h4>
            <ToggleYesNo v-model="form.produits.scm.present" />

            <template v-if="form.produits.scm.present">
              <div v-for="prod in scmProducts" :key="prod.key" class="space-y-1">
                <label class="text-sm font-medium text-gray-600">{{ prod.label }} *</label>
                <ToggleStatus v-model="form.produits.scm[prod.key]" />
              </div>
              <div class="space-y-1 pt-2 border-t border-gray-100 dark:border-gray-700">
                <label class="text-sm font-medium text-gray-600">Prix respectés? *</label>
                <ToggleYesNo v-model="form.produits.scm.prix_respectes" />
              </div>
            </template>
          </div>
        </div>
      </template>

      <!-- STEP: UHT -->
      <template #uht>
        <div class="space-y-4">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center">
              <span class="text-lg font-bold text-sky-600">U</span>
            </div>
            <div>
              <h3 class="text-base font-bold text-gray-900 dark:text-gray-100">UHT</h3>
              <p class="text-xs text-gray-400">Disponibilité et prix UHT</p>
            </div>
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-xl p-4 space-y-3 shadow-sm">
            <h4 class="text-sm font-bold text-gray-800">UHT Présent? *</h4>
            <ToggleYesNo v-model="form.produits.uht.present" />

            <template v-if="form.produits.uht.present">
              <div v-for="prod in uhtProducts" :key="prod.key" class="space-y-1">
                <label class="text-sm font-medium text-gray-600">{{ prod.label }} *</label>
                <ToggleStatus v-model="form.produits.uht[prod.key]" />
              </div>
              <div class="space-y-1 pt-2 border-t border-gray-100 dark:border-gray-700">
                <label class="text-sm font-medium text-gray-600">Prix respectés? *</label>
                <ToggleYesNo v-model="form.produits.uht.prix_respectes" />
              </div>
            </template>
          </div>
        </div>
      </template>

      <!-- STEP: YAOURT -->
      <template #yaourt>
        <div class="space-y-4">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center">
              <span class="text-lg font-bold text-pink-600">Y</span>
            </div>
            <div>
              <h3 class="text-base font-bold text-gray-900 dark:text-gray-100">YAOURT</h3>
              <p class="text-xs text-gray-400">Disponibilité et prix yaourts</p>
            </div>
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-xl p-4 space-y-3 shadow-sm">
            <h4 class="text-sm font-bold text-gray-800">YAOURT Présent?</h4>
            <ToggleYesNo v-model="form.produits.yaourt.present" />

            <template v-if="form.produits.yaourt.present">
              <div v-for="prod in yaourtProducts" :key="prod.key" class="space-y-1">
                <label class="text-sm font-medium text-gray-600">{{ prod.label }} *</label>
                <ToggleStatus v-model="form.produits.yaourt[prod.key]" />
              </div>
              <div class="space-y-1 pt-2 border-t border-gray-100 dark:border-gray-700">
                <label class="text-sm font-medium text-gray-600">Prix respectés?</label>
                <ToggleYesNo v-model="form.produits.yaourt.prix_respectes" />
              </div>
            </template>
          </div>
        </div>
      </template>

      <!-- STEP: Concurrence -->
      <template #concurrence>
        <div class="space-y-6">
          <div class="bg-white dark:bg-gray-800 rounded-xl p-4 space-y-3 shadow-sm">
            <h3 class="text-sm font-bold text-gray-800">Présence de concurrents *</h3>
            <ToggleYesNo v-model="form.concurrence.presence_concurrents" />
          </div>

          <template v-if="form.concurrence.presence_concurrents">
            <!-- Concurrent EVAP -->
            <div class="bg-white dark:bg-gray-800 rounded-xl p-4 space-y-3 shadow-sm">
              <h4 class="text-sm font-bold text-gray-700 dark:text-gray-300">Concurrent EVAP présent? *</h4>
              <ToggleYesNo v-model="form.concurrence.evap.present" />
              <template v-if="form.concurrence.evap.present">
                <div class="space-y-1">
                  <label class="text-sm font-medium text-gray-600">Cowmilk présent? *</label>
                  <ToggleStatus v-model="form.concurrence.evap.cowmilk" />
                </div>
                <div class="space-y-1">
                  <label class="text-sm font-medium text-gray-600">NIDO 150g présent? *</label>
                  <ToggleStatus v-model="form.concurrence.evap.nido_150g" />
                </div>
                <div class="space-y-1">
                  <label class="text-sm font-medium text-gray-600">Autre *</label>
                  <ToggleStatus v-model="form.concurrence.evap.autre" />
                </div>
                <div v-if="form.concurrence.evap.autre === 'Présent'" class="space-y-1">
                  <label class="text-sm font-medium text-gray-600">Nom du concurrent EVAP *</label>
                  <UInput v-model="form.concurrence.evap.nom_concurrent" placeholder="Nom du concurrent" size="lg" />
                </div>
              </template>
            </div>

            <!-- Concurrent IMP -->
            <div class="bg-white dark:bg-gray-800 rounded-xl p-4 space-y-3 shadow-sm">
              <h4 class="text-sm font-bold text-gray-700 dark:text-gray-300">Concurrent IMP présent? *</h4>
              <ToggleYesNo v-model="form.concurrence.imp.present" />
              <template v-if="form.concurrence.imp.present">
                <div class="space-y-1">
                  <label class="text-sm font-medium text-gray-600">Nido présent? *</label>
                  <ToggleStatus v-model="form.concurrence.imp.nido" />
                </div>
                <div class="space-y-1">
                  <label class="text-sm font-medium text-gray-600">Laity présent? *</label>
                  <ToggleStatus v-model="form.concurrence.imp.laity" />
                </div>
                <div class="space-y-1">
                  <label class="text-sm font-medium text-gray-600">Top lait présent? *</label>
                  <ToggleStatus v-model="form.concurrence.imp.top_lait" />
                </div>
                <div class="space-y-1">
                  <label class="text-sm font-medium text-gray-600">Autre *</label>
                  <ToggleStatus v-model="form.concurrence.imp.autre" />
                </div>
                <div v-if="form.concurrence.imp.autre === 'Présent'" class="space-y-1">
                  <label class="text-sm font-medium text-gray-600">Nom du concurrent IMP *</label>
                  <UInput v-model="form.concurrence.imp.nom_concurrent" placeholder="Nom du concurrent" size="lg" />
                </div>
              </template>
            </div>

            <!-- Concurrent SCM -->
            <div class="bg-white dark:bg-gray-800 rounded-xl p-4 space-y-3 shadow-sm">
              <h4 class="text-sm font-bold text-gray-700 dark:text-gray-300">Concurrent SCM présent? *</h4>
              <ToggleYesNo v-model="form.concurrence.scm.present" />
              <template v-if="form.concurrence.scm.present">
                <div class="space-y-1">
                  <label class="text-sm font-medium text-gray-600">Top Saho présent? *</label>
                  <ToggleStatus v-model="form.concurrence.scm.top_saho" />
                </div>
                <div class="space-y-1">
                  <label class="text-sm font-medium text-gray-600">Autre *</label>
                  <ToggleStatus v-model="form.concurrence.scm.autre" />
                </div>
                <div v-if="form.concurrence.scm.autre === 'Présent'" class="space-y-1">
                  <label class="text-sm font-medium text-gray-600">Nom du concurrent SCM *</label>
                  <UInput v-model="form.concurrence.scm.nom_concurrent" placeholder="Nom du concurrent" size="lg" />
                </div>
              </template>
            </div>

            <!-- Concurrent UHT -->
            <div class="bg-white dark:bg-gray-800 rounded-xl p-4 space-y-3 shadow-sm">
              <h4 class="text-sm font-bold text-gray-700 dark:text-gray-300">Concurrent UHT présent? *</h4>
              <ToggleYesNo v-model="form.concurrence.uht.present" />
              <template v-if="form.concurrence.uht.present">
                <div class="space-y-1">
                  <label class="text-sm font-medium text-gray-600">Candia présent? *</label>
                  <ToggleStatus v-model="form.concurrence.uht.candia" />
                </div>
                <div class="space-y-1">
                  <label class="text-sm font-medium text-gray-600">Autre *</label>
                  <ToggleStatus v-model="form.concurrence.uht.autre" />
                </div>
                <div v-if="form.concurrence.uht.autre === 'Présent'" class="space-y-1">
                  <label class="text-sm font-medium text-gray-600">Nom du concurrent UHT *</label>
                  <UInput v-model="form.concurrence.uht.nom_concurrent" placeholder="Nom du concurrent" size="lg" />
                </div>
              </template>
            </div>
          </template>
        </div>
      </template>

      <!-- STEP: Visibilité -->
      <template #visibilite>
        <div class="space-y-6">
          <div class="bg-white dark:bg-gray-800 rounded-xl p-4 space-y-3 shadow-sm">
            <h3 class="text-lg font-bold text-gray-800 mb-2">Visibilité intérieure</h3>
            <div class="space-y-1">
              <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">Présence de visibilité intérieure *</h4>
              <ToggleYesNo v-model="form.visibilite.interieure.presence_visibilite" />
            </div>
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-xl p-4 space-y-3 shadow-sm">
            <h3 class="text-lg font-bold text-gray-800 mb-2">Visibilité concurrence</h3>
            <div class="space-y-1">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Présence de visibilité *</label>
              <ToggleYesNo v-model="form.visibilite.concurrence.presence_visibilite" />
            </div>

            <template v-if="form.visibilite.concurrence.presence_visibilite">
              <div v-for="item in visibConcurrenceItems" :key="item.key" class="space-y-1">
                <label class="text-sm font-medium text-gray-600">{{ item.label }} *</label>
                <ToggleYesNo v-model="form.visibilite.concurrence[item.key]" />
              </div>
            </template>
          </div>
        </div>
      </template>

      <!-- STEP: Actions -->
      <template #actions>
        <div class="space-y-4">
          <div class="bg-white dark:bg-gray-800 rounded-xl p-4 space-y-4 shadow-sm">
            <div v-for="action in actionItems" :key="action.key" class="space-y-2">
              <h3 class="text-sm font-bold text-gray-800">{{ action.label }} *</h3>
              <ToggleYesNo v-model="form.actions[action.key]" />
            </div>
          </div>
        </div>
      </template>

      <!-- STEP: Photos -->
      <template #photos>
        <div class="space-y-4">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <UIcon name="i-heroicons-camera" class="w-5 h-5 text-fc-red" />
            </div>
            <div>
              <h3 class="text-base font-bold text-gray-900 dark:text-gray-100">Photos du PDV</h3>
              <p class="text-xs text-gray-400">Prenez des photos du rayon et de la visibilité</p>
            </div>
          </div>

          <!-- Camera capture -->
          <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm space-y-4">
            <button
              type="button"
              class="w-full flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl py-8 hover:border-fc-red hover:bg-red-50 transition-colors"
              @click="triggerCamera"
            >
              <UIcon name="i-heroicons-camera" class="w-10 h-10 text-gray-400 mb-2" />
              <span class="text-sm font-medium text-gray-600">Prendre une photo</span>
              <span class="text-xs text-gray-400 mt-1">ou importer depuis la galerie</span>
            </button>
            <input
              ref="cameraInput"
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              class="hidden"
              @change="onPhotosSelected"
            />

            <!-- Thumbnails -->
            <div v-if="form.images.length > 0" class="grid grid-cols-3 gap-2">
              <div
                v-for="(img, idx) in photoThumbnails"
                :key="idx"
                class="relative group"
              >
                <img
                  :src="img"
                  class="w-full h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-600"
                />
                <button
                  type="button"
                  class="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                  style="opacity: 1;"
                  @click="removePhoto(idx)"
                >
                  ✕
                </button>
              </div>
            </div>

            <p class="text-xs text-gray-400 text-center">
              {{ form.images.length }} photo{{ form.images.length !== 1 ? 's' : '' }} ajoutée{{ form.images.length !== 1 ? 's' : '' }}
            </p>
          </div>
        </div>
      </template>
    </FormWizard>

    <!-- Save Overlay -->
    <SaveOverlay
      :visible="showSaveOverlay"
      :status="saveStatus"
      :progress="saveProgress"
      saving-title="Enregistrement de la visite"
      saving-message="Synchronisation des données..."
      success-title="Visite enregistrée ✓"
      success-message="Les données ont été sauvegardées avec succès."
      @update:visible="showSaveOverlay = $event"
      @closed="onSaveComplete"
      @retry="handleSave"
    />

    <!-- Modals -->
    <PDVQuickCreateModal
      v-model="showCreatePDV"
      @created="handlePDVCreated"
    />

    <UModal v-model="showGeofenceAlert">
      <div class="p-6 text-center">
        <div class="w-16 h-16 mx-auto mb-4 bg-red-50 rounded-full flex items-center justify-center">
          <UIcon name="i-heroicons-map-pin" class="w-8 h-8 text-red-500" />
        </div>
        <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Hors zone</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">
          Vous êtes à {{ geofenceDistance }}m du PDV.
        </p>
        <p class="text-sm text-gray-400 mb-6">
          Distance maximum autorisée : {{ geofenceRadius }}m
        </p>
        <div class="flex gap-3 justify-center">
          <UButton variant="ghost" @click="showGeofenceAlert = false">Annuler</UButton>
          <UButton class="bg-fc-red" @click="showGeofenceAlert = false; forceSubmit()">
            Soumettre quand même
          </UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { getDefaultVisiteData } from '~/types'
import type { PDV, VisiteData, VisiteProduits, VisiteConcurrence, VisiteVisibilite, VisiteActions } from '~/types'

// Helper types: exclude 'present' & 'prix_respectes' so indexed access yields ProductStatus only
type ProductKey<T> = Exclude<keyof T, 'present' | 'prix_respectes'>
type VisibConcKey = Exclude<keyof VisiteVisibilite['concurrence'], 'presence_visibilite' | 'nom_concurrent_ext' | 'nom_concurrent_int'>

definePageMeta({
  middleware: ['auth'],
  layout: false,
})

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const authStore = useAuthStore()
const pdvStore = usePDVStore()
const routingStore = useRoutingStore()
const { validateGeofence, grabPosition } = useGeofencing()
const { completeMission } = useRouting()
const { addToQueue, isOnline } = useOfflineSync()
const { uploadImages } = useImageUpload()
const toast = useToast()
const router = useRouter()
const route = useRoute()
const config = useRuntimeConfig()

const geofenceRadius = config.public.geofenceRadius as number || 300

// Routing context (pre-selected PDV from routing page)
const routingPdvId = computed(() => route.query.routing_pdv_id as string || '')
const preselectedPdvId = computed(() => route.query.pdv_id as string || '')

const currentTab = ref(0)
const saving = ref(false)
const showGeofenceAlert = ref(false)
const geofenceDistance = ref(0)
const showCreatePDV = ref(false)

// Save overlay state
const showSaveOverlay = ref(false)
const saveStatus = ref<'saving' | 'success' | 'error'>('saving')
const saveProgress = ref(0)

// Wizard steps — one per product type for Dispo & Prix
const wizardSteps = [
  { key: 'general', label: 'Général' },
  { key: 'evap', label: 'EVAP' },
  { key: 'imp', label: 'IMP' },
  { key: 'scm', label: 'SCM' },
  { key: 'uht', label: 'UHT' },
  { key: 'yaourt', label: 'Yaourt' },
  { key: 'concurrence', label: 'Concurrence' },
  { key: 'visibilite', label: 'Visibilité' },
  { key: 'actions', label: 'Actions' },
  { key: 'photos', label: 'Photos' },
]

// Form state
const defaultData = getDefaultVisiteData()
const form = reactive({
  pdv_id: '',
  date_visite: new Date().toISOString().slice(0, 16),
  produits: defaultData.produits,
  concurrence: defaultData.concurrence,
  visibilite: defaultData.visibilite,
  actions: defaultData.actions,
  images: [] as File[],
})

// PDV list (filtered by user's zone/secteurs)
const pdvList = ref<any[]>([])
const filteredPdvList = computed(() => {
  const profile = authStore.profile
  if (!profile || profile.role === 'admin' || profile.role === 'superviseur') {
    return pdvList.value
  }
  let list = pdvList.value
  if (profile.zone_assignee) {
    list = list.filter(p => p.zone === profile.zone_assignee)
  }
  if (profile.secteurs_assignes && profile.secteurs_assignes.length > 0) {
    list = list.filter(p => profile.secteurs_assignes!.includes(p.secteur))
  }
  return list
})
const pdvOptions = computed(() =>
  filteredPdvList.value.map(p => ({
    label: `${p.nom_pdv} (${p.zone || ''})`,
    value: p.pdv_id,
  }))
)
const canCreatePDV = computed(() => authStore.profile?.role === 'merchandiser')

const userEmail = computed(() => user.value?.email || '')

// Product definitions
const evapProducts: { key: ProductKey<VisiteProduits['evap']>; label: string }[] = [
  { key: 'br_gold', label: 'BR Gold' },
  { key: 'br_160g', label: 'BR 150g' },
  { key: 'brb_160g', label: 'BRB 150g' },
  { key: 'br_400g', label: 'BR 380g' },
  { key: 'brb_400g', label: 'BRB 380g' },
  { key: 'pearl_400g', label: 'Pearl 380g' },
]

const impProducts: { key: ProductKey<VisiteProduits['imp']>; label: string }[] = [
  { key: 'br_400g', label: 'BR 2' },
  { key: 'br_20g', label: 'BR 15g' },
  { key: 'brb_25g', label: 'BRB 16g' },
  { key: 'br_375g', label: 'BR 360g' },
  { key: 'br_900g', label: 'BR 400g Tin' },
  { key: 'brb_400g', label: 'BRB 360g' },
  { key: 'br_2_5kg', label: 'BR 900g Tin' },
  { key: 'brd_15g', label: 'BRD 15g' },
]

const scmProducts: { key: ProductKey<VisiteProduits['scm']>; label: string }[] = [
  { key: 'pearl_1kg', label: 'Pearl 1Kg' },
  { key: 'br_1kg', label: 'BR 1Kg' },
  { key: 'brb_1kg', label: 'BRB 1Kg' },
  { key: 'br_397g', label: 'BR 397g' },
  { key: 'brb_397g', label: 'BRB 397g' },
]

const uhtProducts: { key: ProductKey<VisiteProduits['uht']>; label: string }[] = [
  { key: 'demi_ecreme', label: 'BR 516ml' },
  { key: 'elopack_500ml', label: 'Elopack 500 ml' },
  { key: 'brique_1l', label: 'Brique 1L' },
]

const yaourtProducts: { key: ProductKey<VisiteProduits['yaourt']>; label: string }[] = [
  { key: 'br_yogoo_fraise_mini_90ml', label: 'BR Yogoo fraise mini 90 ml' },
  { key: 'br_yogoo_fraise_maxi_318ml', label: 'BR Yogoo fraise maxi 318 ml' },
  { key: 'br_yogoo_nature_mini_90ml', label: 'BR Yogoo nature mini 90 ml' },
  { key: 'br_yogoo_nature_maxi_318ml', label: 'BR Yogoo nature maxi 318 ml' },
]

const visibConcurrenceItems: { key: VisibConcKey; label: string }[] = [
  { key: 'nido_exterieur', label: 'Visibilité extérieure NIDO' },
  { key: 'nido_interieur', label: 'Visibilité intérieure NIDO' },
  { key: 'laity_exterieur', label: 'Visibilité extérieure LAITY' },
  { key: 'laity_interieur', label: 'Visibilité intérieure LAITY' },
  { key: 'candia_exterieur', label: 'Visibilité extérieure CANDIA' },
  { key: 'candia_interieur', label: 'Visibilité intérieure CANDIA' },
]

const actionItems: { key: keyof VisiteActions; label: string }[] = [
  { key: 'referencement_produits', label: 'Référencement produits' },
  { key: 'execution_activites_promotionnelles', label: 'Exécution d\'activités promotionnelles' },
  { key: 'prospection_pdv', label: 'Prospection PDV' },
  { key: 'verification_fifo', label: 'Vérification FIFO' },
  { key: 'rangement_produits', label: 'Rangement produits' },
  { key: 'pose_affiches', label: 'Pose d\'affiches' },
  { key: 'pose_materiel_visibilite', label: 'Pose matériel de visibilité' },
]

function onStepChange(_step: number) {
  // Hook for step-specific validation
}

// --- Photo handling ---
const cameraInput = ref<HTMLInputElement | null>(null)

const photoThumbnails = computed(() => {
  return form.images.map(f => URL.createObjectURL(f))
})

function triggerCamera() {
  cameraInput.value?.click()
}

function onPhotosSelected(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) {
    form.images.push(...Array.from(input.files))
    input.value = '' // reset for re-select
  }
}

function removePhoto(idx: number) {
  form.images.splice(idx, 1)
}

function handleCancel() {
  if (confirm('Annuler la visite en cours ?')) {
    router.push('/mobile')
  }
}

function handlePDVCreated(pdv: PDV) {
  if (!pdvList.value.some(item => item.pdv_id === pdv.pdv_id)) {
    pdvList.value = [...pdvList.value, pdv].sort((a, b) =>
      (a.nom_pdv || '').localeCompare(b.nom_pdv || '')
    )
  }
  form.pdv_id = pdv.pdv_id
  toast.add({
    title: 'PDV sélectionné',
    description: `${pdv.nom_pdv} est prêt pour la visite.`,
    color: 'green',
  })
}

function animateProgress(targetPercent: number, durationMs: number) {
  const start = saveProgress.value
  const diff = targetPercent - start
  const startTime = Date.now()

  function tick() {
    const elapsed = Date.now() - startTime
    const t = Math.min(elapsed / durationMs, 1)
    saveProgress.value = start + diff * t
    if (t < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

async function handleSave() {
  if (!form.pdv_id) {
    toast.add({ title: 'Sélectionnez un PDV', color: 'red' })
    currentTab.value = 0
    return
  }

  saving.value = true
  showSaveOverlay.value = true
  saveStatus.value = 'saving'
  saveProgress.value = 0

  try {
    // Phase 1: Grab GPS (0→30%)
    animateProgress(30, 800)
    const position = await grabPosition()

    // Phase 2: Check geofence (30→50%)
    animateProgress(50, 400)
    const selectedPDV = pdvList.value.find(p => p.pdv_id === form.pdv_id)
    let geofenceOk = false

    if (selectedPDV?.geolocation_lat && position) {
      try {
        const result = await validateGeofence(selectedPDV.geolocation_lat, selectedPDV.geolocation_lng)
        geofenceOk = result.isWithinRange
        if (!geofenceOk) {
          geofenceDistance.value = result.distance
          showSaveOverlay.value = false
          showGeofenceAlert.value = true
          saving.value = false
          return
        }
      }
      catch {
        geofenceOk = false
      }
    }

    // Phase 3: Submit (50→100%)
    animateProgress(90, 600)
    await submitVisite(position, geofenceOk)

    saveProgress.value = 100
    saveStatus.value = 'success'
  }
  catch (err: any) {
    saveStatus.value = 'error'
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
  }
  finally {
    saving.value = false
  }
}

async function forceSubmit() {
  saving.value = true
  showSaveOverlay.value = true
  saveStatus.value = 'saving'
  saveProgress.value = 0

  try {
    animateProgress(50, 600)
    const position = await grabPosition()
    animateProgress(90, 600)
    await submitVisite(position, false)
    saveProgress.value = 100
    saveStatus.value = 'success'
  }
  catch (err: any) {
    saveStatus.value = 'error'
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
  }
  finally {
    saving.value = false
  }
}

function onSaveComplete() {
  router.push('/mobile')
}

async function submitVisite(
  position: { lat: number; lng: number; accuracy: number } | null,
  geofenceOk: boolean
) {
  const visiteId = crypto.randomUUID().substring(0, 8)

  const visiteData: VisiteData = {
    produits: JSON.parse(JSON.stringify(form.produits)),
    concurrence: JSON.parse(JSON.stringify(form.concurrence)),
    visibilite: JSON.parse(JSON.stringify(form.visibilite)),
    actions: JSON.parse(JSON.stringify(form.actions)),
  }

  let imageUrls: string[] = []
  if (form.images.length > 0 && isOnline.value) {
    imageUrls = await uploadImages(form.images, `visites/${visiteId}`)
  }

  const visite = {
    visite_id: visiteId,
    pdv_id: form.pdv_id,
    user_id: user.value?.id,
    date_visite: new Date(form.date_visite).toISOString(),
    commercial: authStore.profile?.nom || '',
    email: user.value?.email || '',
    geolocation_lat: position?.lat || null,
    geolocation_lng: position?.lng || null,
    geofence_validated: geofenceOk,
    precision_gps: position?.accuracy || null,
    data: visiteData,
    image_urls: imageUrls,
    sync_status: 'synced',
  }

  if (isOnline.value) {
    const { error } = await supabase.from('visites').insert(visite as any)
    if (error) throw error
  }
  else {
    addToQueue({ type: 'visite', data: { ...visite, sync_status: 'pending' } })
  }

  // Complete routing PDV if from routing context
  if (routingPdvId.value) {
    const routingPdvItem = routingStore.routingPDVList.find(rp => rp.id === routingPdvId.value)
    if (routingPdvItem) {
      await completeMission(routingPdvItem, visiteId)
    }
  }
}

onMounted(async () => {
  if (!authStore.profile) {
    await authStore.fetchProfile()
  }
  pdvList.value = await pdvStore.fetchScopedPDV(authStore.profile)

  // Pre-select PDV from routing context
  if (preselectedPdvId.value) {
    form.pdv_id = preselectedPdvId.value
  }
})
</script>
