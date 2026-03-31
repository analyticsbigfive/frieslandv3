<template>
  <UModal v-model="isOpen" :ui="{ width: 'max-w-lg' }">
    <div class="p-6">
      <div class="mb-5">
        <h3 class="text-lg font-bold text-gray-900">Nouveau PDV</h3>
        <p class="text-sm text-gray-500 mt-1">
          Créez un point de vente et utilisez-le immédiatement pour une visite.
        </p>
      </div>

      <form class="space-y-4" @submit.prevent="handleSave">
        <UFormGroup label="Nom du PDV" required>
          <UInput
            v-model="form.nom_pdv"
            placeholder="Nom du point de vente"
            size="lg"
          />
        </UFormGroup>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormGroup label="Canal">
            <USelectMenu
              v-model="form.canal"
              :options="canalOptions"
            />
          </UFormGroup>

          <UFormGroup label="Catégorie">
            <USelectMenu
              v-model="form.categorie_pdv"
              :options="categorieOptions"
            />
          </UFormGroup>

          <UFormGroup label="Sous-catégorie">
            <USelectMenu
              v-model="form.sous_categorie_pdv"
              :options="sousCategorieOptions"
            />
          </UFormGroup>

          <UFormGroup label="Secteur" :required="secteurOptions.length > 0">
            <USelectMenu
              v-if="secteurOptions.length > 0"
              v-model="form.secteur"
              :options="secteurOptions"
              placeholder="Choisir un secteur"
            />
            <UInput
              v-else
              v-model="form.secteur"
              placeholder="Secteur"
            />
          </UFormGroup>

          <UFormGroup label="Zone" required>
            <UInput
              v-model="form.zone"
              :disabled="isMerchandiser && !!defaultZone"
              placeholder="Zone"
            />
          </UFormGroup>

          <UFormGroup label="Région" required>
            <UInput
              v-model="form.region"
              :disabled="isMerchandiser && !!defaultRegion"
              placeholder="Région"
            />
          </UFormGroup>
        </div>

        <UFormGroup label="Adressage">
          <UInput
            v-model="form.adressage"
            placeholder="Adresse ou repère"
          />
        </UFormGroup>

        <div class="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-medium text-gray-800">Coordonnées GPS</p>
              <p v-if="hasCoordinates" class="text-xs text-gray-500 mt-1">
                {{ form.geolocation_lat?.toFixed(6) }}, {{ form.geolocation_lng?.toFixed(6) }}
              </p>
              <p v-else class="text-xs text-gray-500 mt-1">
                Aucune position enregistrée pour ce PDV.
              </p>
              <p
                v-if="currentPosition"
                class="text-[11px] text-gray-400 mt-1"
              >
                Position mobile disponible, précision {{ currentPosition.accuracy }}m
              </p>
            </div>

            <UButton
              type="button"
              size="sm"
              variant="outline"
              :loading="gpsLoading"
              @click.prevent="fillWithCurrentPosition"
            >
              {{ hasCoordinates ? 'Mettre à jour' : 'Utiliser mon GPS' }}
            </UButton>
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <UButton type="button" variant="ghost" @click="isOpen = false">
            Annuler
          </UButton>
          <UButton type="submit" class="bg-fc-blue" :loading="saving">
            Créer le PDV
          </UButton>
        </div>
      </form>
    </div>
  </UModal>
</template>

<script setup lang="ts">
import type { PDV, PDVCategorie, PDVSousCategorie } from '~/types'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'created', value: PDV): void
}>()

const authStore = useAuthStore()
const pdvStore = usePDVStore()
const user = useSupabaseUser()
const toast = useToast()
const config = useRuntimeConfig()
const { isOnline, addToQueue } = useOfflineSync()
const { currentPosition, requestPosition } = useUserGeolocation()

const saving = ref(false)
const gpsLoading = ref(false)

const isOpen = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const isMerchandiser = computed(() => authStore.profile?.role === 'merchandiser')
const defaultZone = computed(() => authStore.profile?.zone_assignee || '')
const defaultRegion = computed(() => authStore.profile?.region || '')
const secteurOptions = computed(() => authStore.profile?.secteurs_assignes?.filter(Boolean) || [])

const canalOptions = ['General trade', 'Modern trade']
const categorieOptions: PDVCategorie[] = [
  'Point de vente détail',
  'Point de consommation',
  'Supermarché',
  'Grossiste',
]
const sousCategorieOptions: PDVSousCategorie[] = [
  'Boutique A',
  'Boutique B',
  'Boutique C',
  'Superette GT',
  'Kiosque',
]

const form = reactive({
  nom_pdv: '',
  canal: 'General trade',
  categorie_pdv: 'Point de vente détail' as PDVCategorie,
  sous_categorie_pdv: 'Boutique C' as PDVSousCategorie,
  zone: '',
  secteur: '',
  region: '',
  adressage: '',
  geolocation_lat: null as number | null,
  geolocation_lng: null as number | null,
})

const hasCoordinates = computed(() =>
  form.geolocation_lat !== null && form.geolocation_lng !== null
)

function resetForm() {
  form.nom_pdv = ''
  form.canal = 'General trade'
  form.categorie_pdv = 'Point de vente détail'
  form.sous_categorie_pdv = 'Boutique C'
  form.zone = defaultZone.value
  form.secteur = secteurOptions.value[0] || ''
  form.region = defaultRegion.value
  form.adressage = ''
  form.geolocation_lat = currentPosition.value?.lat || null
  form.geolocation_lng = currentPosition.value?.lng || null
}

watch(() => props.modelValue, (open) => {
  if (open) {
    resetForm()
  }
})

async function fillWithCurrentPosition() {
  gpsLoading.value = true

  try {
    const position = currentPosition.value || await requestPosition()

    if (!position) {
      toast.add({
        title: 'GPS indisponible',
        description: 'Impossible de récupérer votre position actuelle.',
        color: 'red',
      })
      return
    }

    form.geolocation_lat = position.lat
    form.geolocation_lng = position.lng

    toast.add({
      title: 'Position GPS récupérée',
      color: 'green',
    })
  }
  finally {
    gpsLoading.value = false
  }
}

function buildPayload() {
  const pdvId = crypto.randomUUID().substring(0, 8)
  const creator = authStore.profile?.nom || user.value?.email || 'Utilisateur mobile'
  const timestamp = new Date().toISOString()

  return {
    id: crypto.randomUUID(),
    pdv_id: pdvId,
    nom_pdv: form.nom_pdv.trim(),
    canal: form.canal,
    categorie_pdv: form.categorie_pdv,
    sous_categorie_pdv: form.sous_categorie_pdv,
    autre_sous_categorie: null,
    region: form.region.trim(),
    zone: form.zone.trim(),
    secteur: form.secteur.trim(),
    geolocation_lat: form.geolocation_lat,
    geolocation_lng: form.geolocation_lng,
    rayon_geofence: Number(config.public.geofenceRadius) || 300,
    adressage: form.adressage.trim() || null,
    image_url: null,
    date_creation: new Date().toISOString().slice(0, 10),
    ajoute_par: creator,
    jour_routing: null,
    position_routing: null,
    canal_routing: null,
    sales_rep_routing: null,
    mdm: null,
    is_active: true,
    created_at: timestamp,
    updated_at: timestamp,
  } as PDV
}

async function handleSave() {
  if (!form.nom_pdv.trim()) {
    toast.add({
      title: 'Nom du PDV requis',
      color: 'red',
    })
    return
  }

  if (!form.zone.trim() || !form.region.trim()) {
    toast.add({
      title: 'Zone et région requises',
      color: 'red',
    })
    return
  }

  if (secteurOptions.value.length > 0 && !form.secteur.trim()) {
    toast.add({
      title: 'Secteur requis',
      description: 'Choisissez un secteur pour que le PDV soit rattaché à votre zone.',
      color: 'red',
    })
    return
  }

  saving.value = true

  try {
    const payload = buildPayload()
    let createdPDV: PDV

    if (isOnline.value) {
      createdPDV = await pdvStore.createPDV(payload) as PDV
    }
    else {
      addToQueue({ type: 'pdv', data: payload })
      createdPDV = payload
    }

    emit('created', createdPDV)
    isOpen.value = false

    toast.add({
      title: isOnline.value ? 'PDV créé' : 'PDV enregistré hors ligne',
      description: isOnline.value
        ? 'Le PDV est disponible immédiatement.'
        : 'Le PDV sera synchronisé dès le retour de la connexion.',
      color: 'green',
    })
  }
  catch (err: any) {
    toast.add({
      title: 'Erreur de création',
      description: err.message || 'Impossible de créer le PDV.',
      color: 'red',
    })
  }
  finally {
    saving.value = false
  }
}
</script>
