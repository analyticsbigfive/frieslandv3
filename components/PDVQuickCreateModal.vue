<template>
  <UModal v-model="isOpen" :ui="{ width: 'max-w-lg' }">
    <div class="p-6">
      <div class="mb-5">
        <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">Nouveau PDV</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
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
          <UFormGroup label="Canal" help="Déduit de la catégorie choisie">
            <UInput :model-value="derivedCanal" disabled />
          </UFormGroup>

          <UFormGroup label="Catégorie">
            <USelectMenu
              v-model="form.categorie_pdv"
              :options="categorieOptions"
              searchable
              placeholder="Catégorie..."
              @update:model-value="onCategorieChange"
            />
          </UFormGroup>

          <UFormGroup label="Sous-catégorie">
            <USelectMenu
              v-model="form.sous_categorie_pdv"
              :options="sousCategorieOptions"
              :disabled="!form.categorie_pdv"
              searchable
              placeholder="Type de PDV..."
            />
          </UFormGroup>

          <UFormGroup label="Quartier" :required="quartierOptions.length > 0">
            <USelectMenu
              v-if="quartierOptions.length > 0"
              v-model="form.quartier"
              :options="quartierOptions"
              placeholder="Choisir un quartier"
            />
            <UInput
              v-else
              v-model="form.quartier"
              placeholder="Quartier"
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

          <UFormGroup label="Distributeur" hint="Nationaux + liés au territoire" class="sm:col-span-2">
            <USelectMenu
              v-model="form.distributor_name"
              :options="distributorOptions"
              option-attribute="label"
              value-attribute="value"
              placeholder="Distributeur..."
              searchable
              searchable-placeholder="Rechercher..."
            />
          </UFormGroup>
        </div>

        <UFormGroup label="Adressage">
          <UInput
            v-model="form.adressage"
            placeholder="Adresse ou repère"
          />
        </UFormGroup>

        <div class="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-4 space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-medium text-gray-800 dark:text-gray-100">Coordonnées GPS</p>
              <p v-if="hasCoordinates" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {{ form.geolocation_lat?.toFixed(6) }}, {{ form.geolocation_lng?.toFixed(6) }}
              </p>
              <p v-else class="text-xs text-gray-500 dark:text-gray-400 mt-1">
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
import type { PDV } from '~/types'

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
const quartierOptions = computed(() => authStore.profile?.quartiers_assignes?.filter(Boolean) || [])

// Géo Système B : zone = territoire (name), quartier = quartier.nom. L'area est
// résolue depuis le quartier choisi (quartier -> zone_id -> zone.code) ; le
// distributeur découle de cette area (zone_distributeur), repli territoire ;
// les nationaux sont toujours proposés.
const { distributeurs, territories, areas, quartiers, territoireDistributeurs, zoneDistributeurs, posTypes, fetchReferentiels } = useReferentiels()

const currentTerritory = computed(() => territories.value.find(t => t.name === form.zone))
const territoryCode = computed(() => currentTerritory.value?.code || '')
const scopedAreas = computed(() => areas.value.filter(a => !territoryCode.value || a.territory_code === territoryCode.value))
const selectedQuartier = computed(() => {
  const zoneIds = new Set(scopedAreas.value.map(a => a.id))
  return quartiers.value.find(q => q.nom === form.quartier && zoneIds.has(q.zone_id))
})
const selectedArea = computed(() =>
  scopedAreas.value.find(a => a.id === selectedQuartier.value?.zone_id)
  // Repli legacy : profil dont quartiers_assignes contient encore un nom d'area.
  || scopedAreas.value.find(a => a.name === form.quartier)
)

const nationalDistributors = computed(() => distributeurs.value.filter(d => d.national))
const territoryDistributors = computed(() => {
  if (!territoryCode.value) return []
  const linked = new Set(
    territoireDistributeurs.value
      .filter(td => td.territory_code === territoryCode.value)
      .map(td => td.distributor_name)
  )
  return distributeurs.value.filter(d => linked.has(d.name) && !d.national)
})
// Distributeurs rattachés à l'area sélectionnée (zone_distributeur). Permet de
// varier le distributeur d'une area à l'autre dans un même territoire.
const areaDistributors = computed(() => {
  const zid = selectedArea.value?.id
  if (!zid) return []
  const linked = new Set(
    zoneDistributeurs.value
      .filter(zd => zd.zone_id === zid)
      .map(zd => zd.distributor_name)
  )
  return distributeurs.value.filter(d => linked.has(d.name) && !d.national)
})
// Portée locale = area si elle a des distributeurs propres, sinon repli territoire.
const scopedDistributors = computed(() =>
  areaDistributors.value.length ? areaDistributors.value : territoryDistributors.value
)
const distributorOptions = computed(() => {
  const out: { value: string, label: string }[] = []
  const seen = new Set<string>()
  for (const d of [...scopedDistributors.value, ...nationalDistributors.value]) {
    if (seen.has(d.name)) continue
    seen.add(d.name)
    out.push({ value: d.name, label: d.national ? `${d.name} · national` : d.name })
  }
  if (form.distributor_name && !seen.has(form.distributor_name)) {
    out.push({ value: form.distributor_name, label: form.distributor_name })
  }
  return out
})

// Cascade Catégorie (level3 / groupe) → Sous-catégorie (level4 / type de PDV),
// lues depuis posTypes (référentiel type_pdv) → uniquement des valeurs valides.
// Le level4 pilote le scoring Perfect Store.
const categorieOptions = computed(() => [...new Set(posTypes.value.map(p => p.level3_group).filter(Boolean))].sort())
// Le canal se déduit de la catégorie (categorie_pdv.canal), comme dans le
// calcul Perfect Store — il n'est plus saisi pour éviter toute divergence.
const derivedCanal = computed(() => {
  const pos = posTypes.value.find(p => p.level3_group === form.categorie_pdv)
  return canalLabelFromCode((pos as any)?.canal)
})
const sousCategorieOptions = computed(() => posTypes.value
  .filter(p => !form.categorie_pdv || p.level3_group === form.categorie_pdv)
  .map(p => p.level4_type))
function onCategorieChange() {
  if (!sousCategorieOptions.value.includes(form.sous_categorie_pdv)) {
    form.sous_categorie_pdv = ''
  }
}

const form = reactive({
  nom_pdv: '',
  categorie_pdv: '' as string,
  sous_categorie_pdv: '' as string,
  zone: '',
  quartier: '',
  region: '',
  distributor_name: '',
  adressage: '',
  geolocation_lat: null as number | null,
  geolocation_lng: null as number | null,
})

const hasCoordinates = computed(() =>
  form.geolocation_lat !== null && form.geolocation_lng !== null
)

function resetForm() {
  form.nom_pdv = ''
  form.categorie_pdv = ''
  form.sous_categorie_pdv = ''
  form.zone = defaultZone.value
  form.quartier = quartierOptions.value[0] || ''
  form.region = defaultRegion.value
  form.distributor_name = scopedDistributors.value[0]?.name || nationalDistributors.value[0]?.name || ''
  form.adressage = ''
  form.geolocation_lat = currentPosition.value?.lat || null
  form.geolocation_lng = currentPosition.value?.lng || null
}

watch(() => props.modelValue, async (open) => {
  if (open) {
    await fetchReferentiels()
    resetForm()
  }
})

onMounted(() => { fetchReferentiels() })

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
    canal: derivedCanal.value,
    categorie_pdv: form.categorie_pdv,
    sous_categorie_pdv: form.sous_categorie_pdv,
    autre_sous_categorie: null,
    region: form.region.trim(),
    zone: form.zone.trim(),
    quartier: form.quartier.trim(),
    territory_code: territoryCode.value || null,
    area_code: selectedArea.value?.code || null,
    distributor_name: form.distributor_name || null,
    geolocation_lat: form.geolocation_lat,
    geolocation_lng: form.geolocation_lng,
    rayon_geofence: Number(config.public.geofenceRadius) || 200,
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

  if (quartierOptions.value.length > 0 && !form.quartier.trim()) {
    toast.add({
      title: 'Quartier requis',
      description: 'Choisissez un quartier pour que le PDV soit rattaché à votre zone.',
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
