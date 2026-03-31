<template>
  <div class="pb-20">
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-fc-blue" />
    </div>

    <!-- Not found -->
    <div v-else-if="!pdv" class="text-center py-20 text-gray-400">
      <UIcon name="i-heroicons-map-pin" class="w-12 h-12 mx-auto mb-3 opacity-50" />
      <p>PDV introuvable</p>
    </div>

    <!-- Content -->
    <div v-else class="p-4 space-y-4">
      <!-- Header card -->
      <div class="bg-white rounded-xl shadow-sm p-4">
        <div class="flex items-start justify-between">
          <div>
            <h2 class="text-lg font-bold text-gray-900">{{ pdv.nom_pdv }}</h2>
            <p class="text-xs text-gray-400 mt-0.5">{{ pdv.pdv_id }}</p>
          </div>
          <UButton
            v-if="!editing"
            size="sm"
            icon="i-heroicons-pencil"
            class="bg-fc-blue"
            @click="startEditing"
          >
            Modifier
          </UButton>
        </div>
        <div class="flex gap-2 mt-3">
          <UBadge variant="subtle" color="blue" size="xs">{{ pdv.canal }}</UBadge>
          <UBadge variant="subtle" color="gray" size="xs">{{ pdv.categorie_pdv }}</UBadge>
          <UBadge v-if="pdv.sous_categorie_pdv" variant="subtle" color="green" size="xs">{{ pdv.sous_categorie_pdv }}</UBadge>
        </div>
      </div>

      <!-- Read mode -->
      <template v-if="!editing">
        <!-- Location info -->
        <div class="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h3 class="text-sm font-semibold text-gray-700">Localisation</h3>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <p class="text-xs text-gray-400">Zone</p>
              <p class="text-sm text-gray-900">{{ pdv.zone || '—' }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400">Secteur</p>
              <p class="text-sm text-gray-900">{{ pdv.secteur || '—' }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400">Région</p>
              <p class="text-sm text-gray-900">{{ pdv.region || '—' }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400">Adressage</p>
              <p class="text-sm text-gray-900">{{ pdv.adressage || '—' }}</p>
            </div>
          </div>
        </div>

        <!-- GPS -->
        <div class="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h3 class="text-sm font-semibold text-gray-700">Coordonnées GPS</h3>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <p class="text-xs text-gray-400">Latitude</p>
              <p class="text-sm text-gray-900">{{ pdv.geolocation_lat || '—' }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400">Longitude</p>
              <p class="text-sm text-gray-900">{{ pdv.geolocation_lng || '—' }}</p>
            </div>
          </div>
          <UButton
            v-if="pdv.geolocation_lat && pdv.geolocation_lng"
            variant="outline"
            size="sm"
            icon="i-heroicons-map-pin"
            block
            @click="openInMaps"
          >
            Ouvrir dans Google Maps
          </UButton>
        </div>
      </template>

      <!-- Edit mode -->
      <template v-else>
        <form @submit.prevent="handleSave" class="space-y-4">
          <div class="bg-white rounded-xl shadow-sm p-4 space-y-4">
            <h3 class="text-sm font-semibold text-gray-700">Informations</h3>

            <UFormGroup label="Nom du PDV" required>
              <UInput v-model="form.nom_pdv" placeholder="Nom..." />
            </UFormGroup>

            <UFormGroup label="Canal">
              <USelectMenu
                v-model="form.canal"
                :options="['General trade', 'Modern trade']"
              />
            </UFormGroup>

            <UFormGroup label="Catégorie">
              <USelectMenu
                v-model="form.categorie_pdv"
                :options="['Point de vente détail', 'Point de consommation', 'Supermarché', 'Grossiste']"
              />
            </UFormGroup>

            <UFormGroup label="Sous-catégorie">
              <USelectMenu
                v-model="form.sous_categorie_pdv"
                :options="['Boutique A', 'Boutique B', 'Boutique C', 'Superette GT', 'Kiosque']"
              />
            </UFormGroup>
          </div>

          <div class="bg-white rounded-xl shadow-sm p-4 space-y-4">
            <h3 class="text-sm font-semibold text-gray-700">Localisation</h3>

            <UFormGroup label="Zone">
              <UInput v-model="form.zone" placeholder="Zone..." />
            </UFormGroup>

            <UFormGroup label="Secteur">
              <UInput v-model="form.secteur" placeholder="Secteur..." />
            </UFormGroup>

            <UFormGroup label="Région">
              <UInput v-model="form.region" placeholder="Région..." />
            </UFormGroup>

            <UFormGroup label="Adressage">
              <UInput v-model="form.adressage" placeholder="Adresse..." />
            </UFormGroup>
          </div>

          <div class="bg-white rounded-xl shadow-sm p-4 space-y-4">
            <h3 class="text-sm font-semibold text-gray-700">Coordonnées GPS</h3>

            <UFormGroup label="Latitude">
              <UInput v-model="form.geolocation_lat" type="number" step="any" />
            </UFormGroup>

            <UFormGroup label="Longitude">
              <UInput v-model="form.geolocation_lng" type="number" step="any" />
            </UFormGroup>
          </div>

          <div class="flex gap-3">
            <UButton
              variant="outline"
              block
              @click="cancelEditing"
            >
              Annuler
            </UButton>
            <UButton
              type="submit"
              block
              class="bg-fc-blue"
              :loading="saving"
            >
              Enregistrer
            </UButton>
          </div>
        </form>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PDV } from '~/types'

definePageMeta({ middleware: ['auth'], layout: 'mobile' })

const route = useRoute()
const pdvStore = usePDVStore()
const authStore = useAuthStore()
const { matchesPDVScope } = useUserScope()
const toast = useToast()

const loading = ref(true)
const editing = ref(false)
const saving = ref(false)
const pdv = ref<PDV | null>(null)

const form = ref({
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

onMounted(async () => {
  try {
    if (!authStore.profile) {
      await authStore.fetchProfile()
    }

    const data = await pdvStore.fetchPDVById(route.params.id as string)
    pdv.value = matchesPDVScope(data as PDV) ? data as PDV : null
  }
  catch {
    pdv.value = null
  }
  finally {
    loading.value = false
  }
})

function startEditing() {
  if (!pdv.value) return
  form.value = {
    nom_pdv: pdv.value.nom_pdv,
    canal: pdv.value.canal,
    categorie_pdv: pdv.value.categorie_pdv,
    sous_categorie_pdv: pdv.value.sous_categorie_pdv,
    zone: pdv.value.zone,
    secteur: pdv.value.secteur,
    region: pdv.value.region,
    adressage: pdv.value.adressage || '',
    geolocation_lat: pdv.value.geolocation_lat,
    geolocation_lng: pdv.value.geolocation_lng,
  }
  editing.value = true
}

function cancelEditing() {
  editing.value = false
}

async function handleSave() {
  if (!pdv.value) return
  saving.value = true

  try {
    await pdvStore.updatePDV(pdv.value.pdv_id, form.value)
    // Refresh data
    const updated = await pdvStore.fetchPDVById(pdv.value.pdv_id)
    pdv.value = updated as PDV
    editing.value = false
    toast.add({ title: 'PDV mis à jour avec succès' })
  }
  catch (err: any) {
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
  }
  finally {
    saving.value = false
  }
}

function openInMaps() {
  if (!pdv.value?.geolocation_lat || !pdv.value?.geolocation_lng) return
  window.open(
    `https://www.google.com/maps?q=${pdv.value.geolocation_lat},${pdv.value.geolocation_lng}`,
    '_blank',
  )
}
</script>
