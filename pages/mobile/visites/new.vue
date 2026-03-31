<template>
  <div class="bg-gray-50 min-h-full">
    <!-- Tab navigation -->
    <div class="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
      <div class="flex overflow-x-auto">
        <button
          v-for="(tab, idx) in tabs"
          :key="tab.key"
          class="flex-1 min-w-[100px] py-3 px-2 text-center text-xs font-medium border-b-2 transition-colors whitespace-nowrap"
          :class="currentTab === idx
            ? 'border-fc-blue text-fc-blue bg-fc-blue-50'
            : 'border-transparent text-gray-500'"
          @click="currentTab = idx"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- Tab Content -->
    <div class="px-4 py-4 pb-32">
      <!-- TAB 0: Général -->
      <div v-show="currentTab === 0" class="space-y-5">
        <!-- PDV Selection -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">PDV *</label>
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

        <!-- Date -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Date *</label>
          <UInput v-model="form.date_visite" type="datetime-local" size="lg" />
        </div>

        <!-- Email (auto) -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Email *</label>
          <UInput :model-value="userEmail" disabled size="lg" />
        </div>
      </div>

      <!-- TAB 1: Dispo et prix -->
      <div v-show="currentTab === 1" class="space-y-6">
        <!-- EVAP -->
        <div class="space-y-3">
          <h3 class="text-sm font-bold text-gray-800">EVAP Présent? *</h3>
          <ToggleYesNo v-model="form.produits.evap.present" />

          <template v-if="form.produits.evap.present">
            <div v-for="prod in evapProducts" :key="prod.key" class="space-y-1">
              <label class="text-sm font-medium text-gray-600">EVAP : {{ prod.label }} *</label>
              <ToggleStatus v-model="form.produits.evap[prod.key]" />
            </div>
            <div class="space-y-1">
              <label class="text-sm font-medium text-gray-600">EVAP : Prix respectés? *</label>
              <ToggleYesNo v-model="form.produits.evap.prix_respectes" />
            </div>
          </template>
        </div>

        <!-- IMP -->
        <div class="space-y-3">
          <h3 class="text-sm font-bold text-gray-800">IMP Présent? *</h3>
          <ToggleYesNo v-model="form.produits.imp.present" />

          <template v-if="form.produits.imp.present">
            <div v-for="prod in impProducts" :key="prod.key" class="space-y-1">
              <label class="text-sm font-medium text-gray-600">IMP : {{ prod.label }} *</label>
              <ToggleStatus v-model="form.produits.imp[prod.key]" />
            </div>
            <div class="space-y-1">
              <label class="text-sm font-medium text-gray-600">IMP : Prix respectés? *</label>
              <ToggleYesNo v-model="form.produits.imp.prix_respectes" />
            </div>
          </template>
        </div>

        <!-- SCM -->
        <div class="space-y-3">
          <h3 class="text-sm font-bold text-gray-800">SCM Présent? *</h3>
          <ToggleYesNo v-model="form.produits.scm.present" />

          <template v-if="form.produits.scm.present">
            <div v-for="prod in scmProducts" :key="prod.key" class="space-y-1">
              <label class="text-sm font-medium text-gray-600">SCM : {{ prod.label }} *</label>
              <ToggleStatus v-model="form.produits.scm[prod.key]" />
            </div>
            <div class="space-y-1">
              <label class="text-sm font-medium text-gray-600">SCM : Prix respectés? *</label>
              <ToggleYesNo v-model="form.produits.scm.prix_respectes" />
            </div>
          </template>
        </div>

        <!-- UHT -->
        <div class="space-y-3">
          <h3 class="text-sm font-bold text-gray-800">UHT Présent? *</h3>
          <ToggleYesNo v-model="form.produits.uht.present" />

          <template v-if="form.produits.uht.present">
            <div v-for="prod in uhtProducts" :key="prod.key" class="space-y-1">
              <label class="text-sm font-medium text-gray-600">UHT : {{ prod.label }} *</label>
              <ToggleStatus v-model="form.produits.uht[prod.key]" />
            </div>
            <div class="space-y-1">
              <label class="text-sm font-medium text-gray-600">UHT prix respectés? *</label>
              <ToggleYesNo v-model="form.produits.uht.prix_respectes" />
            </div>
          </template>
        </div>

        <!-- YAOURT -->
        <div class="space-y-3">
          <h3 class="text-sm font-bold text-gray-800">YAOURT Présent?</h3>
          <ToggleYesNo v-model="form.produits.yaourt.present" />

          <template v-if="form.produits.yaourt.present">
            <div v-for="prod in yaourtProducts" :key="prod.key" class="space-y-1">
              <label class="text-sm font-medium text-gray-600">YAOURT : {{ prod.label }} *</label>
              <ToggleStatus v-model="form.produits.yaourt[prod.key]" />
            </div>
            <div class="space-y-1">
              <label class="text-sm font-medium text-gray-600">YAOURT : Prix respectés?</label>
              <ToggleYesNo v-model="form.produits.yaourt.prix_respectes" />
            </div>
          </template>
        </div>
      </div>

      <!-- TAB 2: Concurrence -->
      <div v-show="currentTab === 2" class="space-y-6">
        <div class="space-y-3">
          <h3 class="text-sm font-bold text-gray-800">Présence de concurrents *</h3>
          <ToggleYesNo v-model="form.concurrence.presence_concurrents" />
        </div>

        <template v-if="form.concurrence.presence_concurrents">
          <!-- Concurrent EVAP -->
          <div class="space-y-3">
            <h4 class="text-sm font-bold text-gray-700">Concurrent EVAP présent? *</h4>
            <ToggleYesNo v-model="form.concurrence.evap.present" />

            <template v-if="form.concurrence.evap.present">
              <div class="space-y-1">
                <label class="text-sm font-medium text-gray-600">Concurrent EVAP : Cowmilk présent? *</label>
                <ToggleStatus v-model="form.concurrence.evap.cowmilk" />
              </div>
              <div class="space-y-1">
                <label class="text-sm font-medium text-gray-600">Concurrent EVAP : NIDO 150g présent? *</label>
                <ToggleStatus v-model="form.concurrence.evap.nido_150g" />
              </div>
              <div class="space-y-1">
                <label class="text-sm font-medium text-gray-600">Concurrent EVAP : autre *</label>
                <ToggleStatus v-model="form.concurrence.evap.autre" />
              </div>
              <div v-if="form.concurrence.evap.autre === 'Présent'" class="space-y-1">
                <label class="text-sm font-medium text-gray-600">Nom du concurrent EVAP *</label>
                <UInput v-model="form.concurrence.evap.nom_concurrent" placeholder="Nom du concurrent" size="lg" />
              </div>
            </template>
          </div>

          <!-- Concurrent IMP -->
          <div class="space-y-3">
            <h4 class="text-sm font-bold text-gray-700">Concurrent IMP présent? *</h4>
            <ToggleYesNo v-model="form.concurrence.imp.present" />

            <template v-if="form.concurrence.imp.present">
              <div class="space-y-1">
                <label class="text-sm font-medium text-gray-600">Concurrent IMP : Nido présent? *</label>
                <ToggleStatus v-model="form.concurrence.imp.nido" />
              </div>
              <div class="space-y-1">
                <label class="text-sm font-medium text-gray-600">Concurrent IMP : Laity présent? *</label>
                <ToggleStatus v-model="form.concurrence.imp.laity" />
              </div>
              <div class="space-y-1">
                <label class="text-sm font-medium text-gray-600">Concurrent IMP : Top lait présent? *</label>
                <ToggleStatus v-model="form.concurrence.imp.top_lait" />
              </div>
              <div class="space-y-1">
                <label class="text-sm font-medium text-gray-600">Concurrent IMP : autre *</label>
                <ToggleStatus v-model="form.concurrence.imp.autre" />
              </div>
              <div v-if="form.concurrence.imp.autre === 'Présent'" class="space-y-1">
                <label class="text-sm font-medium text-gray-600">Nom du concurrent IMP *</label>
                <UInput v-model="form.concurrence.imp.nom_concurrent" placeholder="Nom du concurrent" size="lg" />
              </div>
            </template>
          </div>

          <!-- Concurrent SCM -->
          <div class="space-y-3">
            <h4 class="text-sm font-bold text-gray-700">Concurrent SCM présent? *</h4>
            <ToggleYesNo v-model="form.concurrence.scm.present" />

            <template v-if="form.concurrence.scm.present">
              <div class="space-y-1">
                <label class="text-sm font-medium text-gray-600">Concurrent SCM : Top Saho présent? *</label>
                <ToggleStatus v-model="form.concurrence.scm.top_saho" />
              </div>
              <div class="space-y-1">
                <label class="text-sm font-medium text-gray-600">Concurrent SCM : autre *</label>
                <ToggleStatus v-model="form.concurrence.scm.autre" />
              </div>
              <div v-if="form.concurrence.scm.autre === 'Présent'" class="space-y-1">
                <label class="text-sm font-medium text-gray-600">Nom du concurrent SCM *</label>
                <UInput v-model="form.concurrence.scm.nom_concurrent" placeholder="Nom du concurrent" size="lg" />
              </div>
            </template>
          </div>

          <!-- Concurrent UHT -->
          <div class="space-y-3">
            <h4 class="text-sm font-bold text-gray-700">Concurrent UHT présent? *</h4>
            <ToggleYesNo v-model="form.concurrence.uht.present" />

            <template v-if="form.concurrence.uht.present">
              <div class="space-y-1">
                <label class="text-sm font-medium text-gray-600">Concurrent UHT : Candia présent? *</label>
                <ToggleStatus v-model="form.concurrence.uht.candia" />
              </div>
              <div class="space-y-1">
                <label class="text-sm font-medium text-gray-600">Concurrent UHT : autre *</label>
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

      <!-- TAB 3: Visibilité -->
      <div v-show="currentTab === 3" class="space-y-6">
        <div>
          <h3 class="text-lg font-bold text-gray-800 mb-4">Visibilité intérieure</h3>
          <div class="space-y-3">
            <h4 class="text-sm font-medium text-gray-700">Présence de visibilité intérieure *</h4>
            <ToggleYesNo v-model="form.visibilite.interieure.presence_visibilite" />
          </div>
        </div>

        <div>
          <h3 class="text-lg font-bold text-gray-800 mb-4">Visibilité concurrence</h3>
          <div class="space-y-3">
            <div class="space-y-1">
              <label class="text-sm font-medium text-gray-700">Présence de visibilité *</label>
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
      </div>

      <!-- TAB 4: Actions -->
      <div v-show="currentTab === 4" class="space-y-5">
        <div v-for="action in actionItems" :key="action.key" class="space-y-2">
          <h3 class="text-sm font-bold text-gray-800">{{ action.label }} *</h3>
          <ToggleYesNo v-model="form.actions[action.key]" />
        </div>
      </div>
    </div>

    <!-- Bottom Navigation Buttons -->
    <div class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between z-50 safe-area-bottom">
      <button
        class="text-sm font-medium text-gray-600 px-4 py-2"
        :disabled="currentTab === 0"
        @click="prevTab"
      >
        Prev
      </button>
      <button
        class="text-sm font-medium text-gray-500 px-4 py-2"
        @click="handleCancel"
      >
        Cancel
      </button>
      <button
        v-if="currentTab < tabs.length - 1"
        class="text-sm font-bold text-fc-blue px-4 py-2"
        @click="nextTab"
      >
        Next
      </button>
      <button
        v-else
        class="text-sm font-bold text-fc-red px-4 py-2"
        :disabled="saving"
        @click="handleSave"
      >
        {{ saving ? 'Saving...' : 'Save' }}
      </button>
    </div>

    <!-- Geofence Alert -->
    <PDVQuickCreateModal
      v-model="showCreatePDV"
      @created="handlePDVCreated"
    />

    <UModal v-model="showGeofenceAlert">
      <div class="p-6 text-center">
        <div class="w-16 h-16 mx-auto mb-4 bg-red-50 rounded-full flex items-center justify-center">
          <UIcon name="i-heroicons-map-pin" class="w-8 h-8 text-red-500" />
        </div>
        <h3 class="text-lg font-bold text-gray-900 mb-2">Hors zone</h3>
        <p class="text-sm text-gray-500 mb-1">
          Vous êtes à {{ geofenceDistance }}m du PDV.
        </p>
        <p class="text-sm text-gray-400 mb-6">
          Distance maximum autorisée : {{ geofenceRadius }}m
        </p>
        <div class="flex gap-3 justify-center">
          <UButton variant="ghost" @click="showGeofenceAlert = false">Annuler</UButton>
          <UButton class="bg-fc-blue" @click="showGeofenceAlert = false; forceSubmit()">
            Soumettre quand même
          </UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { getDefaultVisiteData } from '~/types'
import type { PDV, VisiteData } from '~/types'

definePageMeta({
  middleware: ['auth'],
  layout: false, // Custom layout for this form
})

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const authStore = useAuthStore()
const pdvStore = usePDVStore()
const { validateGeofence, grabPosition } = useGeofencing()
const { addToQueue, isOnline } = useOfflineSync()
const { uploadImages, capturePhoto } = useImageUpload()
const toast = useToast()
const router = useRouter()
const config = useRuntimeConfig()

const geofenceRadius = config.public.geofenceRadius as number || 300

const currentTab = ref(0)
const saving = ref(false)
const showGeofenceAlert = ref(false)
const geofenceDistance = ref(0)
const showCreatePDV = ref(false)

const tabs = [
  { key: 'general', label: 'Général' },
  { key: 'dispo', label: 'Dispo et prix' },
  { key: 'concurrence', label: 'Concurrence' },
  { key: 'visibilite', label: 'Visibilité' },
  { key: 'actions', label: 'Actions' },
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
  // Admins and superviseurs see all PDVs
  if (!profile || profile.role === 'admin' || profile.role === 'superviseur') {
    return pdvList.value
  }
  let list = pdvList.value
  // Filter by zone_assignee
  if (profile.zone_assignee) {
    list = list.filter(p => p.zone === profile.zone_assignee)
  }
  // Further filter by secteurs_assignes if set
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
const evapProducts = [
  { key: 'br_gold', label: 'BR Gold' },
  { key: 'br_160g', label: 'BR 150g' },
  { key: 'brb_160g', label: 'BRB 150g' },
  { key: 'br_400g', label: 'BR 380g' },
  { key: 'brb_400g', label: 'BRB 380g' },
  { key: 'pearl_400g', label: 'Pearl 380g' },
]

const impProducts = [
  { key: 'br_400g', label: 'BR 2' },
  { key: 'br_20g', label: 'BR 15g' },
  { key: 'brb_25g', label: 'BRB 16g' },
  { key: 'br_375g', label: 'BR 360g' },
  { key: 'br_900g', label: 'BR 400g Tin' },
  { key: 'brb_400g', label: 'BRB 360g' },
  { key: 'br_2_5kg', label: 'BR 900g Tin' },
  { key: 'brd_15g', label: 'BRD 15g' },
]

const scmProducts = [
  { key: 'pearl_1kg', label: 'Pearl 1Kg' },
  { key: 'br_1kg', label: 'BR 1Kg' },
  { key: 'brb_1kg', label: 'BRB 1Kg' },
  { key: 'br_397g', label: 'BR 397g' },
  { key: 'brb_397g', label: 'BRB 397g' },
]

const uhtProducts = [
  { key: 'demi_ecreme', label: 'BR 516ml' },
  { key: 'elopack_500ml', label: 'Elopack 500 ml' },
  { key: 'brique_1l', label: 'Brique 1L' },
]

const yaourtProducts = [
  { key: 'br_yogoo_fraise_mini_90ml', label: 'BR Yogoo fraise mini 90 ml' },
  { key: 'br_yogoo_fraise_maxi_318ml', label: 'BR Yogoo fraise maxi 318 ml' },
  { key: 'br_yogoo_nature_mini_90ml', label: 'BR Yogoo nature mini 90 ml' },
  { key: 'br_yogoo_nature_maxi_318ml', label: 'BR Yogoo nature maxi 318 ml' },
]

const visibConcurrenceItems = [
  { key: 'nido_exterieur', label: 'Visibilité extérieure NIDO' },
  { key: 'nido_interieur', label: 'Visibilité intérieure NIDO' },
  { key: 'laity_exterieur', label: 'Visibilité extérieure LAITY' },
  { key: 'laity_interieur', label: 'Visibilité intérieure LAITY' },
  { key: 'candia_exterieur', label: 'Visibilité extérieure CANDIA' },
  { key: 'candia_interieur', label: 'Visibilité intérieure CANDIA' },
]

const actionItems = [
  { key: 'referencement_produits', label: 'Référencement produits' },
  { key: 'execution_activites_promotionnelles', label: 'Exécution d\'activités promotionnelles' },
  { key: 'prospection_pdv', label: 'Prospection PDV' },
  { key: 'verification_fifo', label: 'Vérification FIFO' },
  { key: 'rangement_produits', label: 'Rangement produits' },
  { key: 'pose_affiches', label: 'Pose d\'affiches' },
  { key: 'pose_materiel_visibilite', label: 'Pose matériel de visibilité' },
]

function prevTab() {
  if (currentTab.value > 0) currentTab.value--
}

function nextTab() {
  if (currentTab.value === 0 && !form.pdv_id) {
    toast.add({ title: 'Sélectionnez un PDV', color: 'red' })
    return
  }
  if (currentTab.value < tabs.length - 1) currentTab.value++
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

async function handleSave() {
  if (!form.pdv_id) {
    toast.add({ title: 'Sélectionnez un PDV', color: 'red' })
    currentTab.value = 0
    return
  }

  saving.value = true

  try {
    // Grab GPS position
    const position = await grabPosition()

    // Check geofence
    const selectedPDV = pdvList.value.find(p => p.pdv_id === form.pdv_id)
    let geofenceOk = false

    if (selectedPDV?.geolocation_lat && position) {
      try {
        const result = await validateGeofence(selectedPDV.geolocation_lat, selectedPDV.geolocation_lng)
        geofenceOk = result.isWithinRange

        if (!geofenceOk) {
          geofenceDistance.value = result.distance
          showGeofenceAlert.value = true
          saving.value = false
          return
        }
      }
      catch {
        // GPS error - continue without geofence
        geofenceOk = false
      }
    }

    await submitVisite(position, geofenceOk)
  }
  catch (err: any) {
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
  }
  finally {
    saving.value = false
  }
}

async function forceSubmit() {
  saving.value = true
  try {
    const position = await grabPosition()
    await submitVisite(position, false)
  }
  catch (err: any) {
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
  }
  finally {
    saving.value = false
  }
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

  // Upload images if any
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
    const { error } = await supabase.from('visites').insert(visite)
    if (error) throw error
  }
  else {
    // Add to offline queue
    addToQueue({ type: 'visite', data: { ...visite, sync_status: 'pending' } })
  }

  toast.add({ title: 'Visite enregistrée ✓', color: 'green' })
  router.push('/mobile')
}

onMounted(async () => {
  if (!authStore.profile) {
    await authStore.fetchProfile()
  }

  pdvList.value = await pdvStore.fetchScopedPDV(authStore.profile)
})
</script>
