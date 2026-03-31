<template>
  <div class="pb-20">
    <!-- Search & Filters -->
    <div class="p-4 space-y-3">
      <UInput
        v-model="search"
        icon="i-heroicons-magnifying-glass"
        placeholder="Rechercher un PDV..."
        size="lg"
        class="w-full"
      />

      <!-- Sort toggle: proximity vs alphabetical -->
      <div class="flex items-center gap-2">
        <button
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
          :class="sortByProximity ? 'bg-fc-blue text-white' : 'bg-gray-100 text-gray-600'"
          @click="sortByProximity = !sortByProximity"
        >
          <UIcon name="i-heroicons-map-pin" class="w-3.5 h-3.5" />
          {{ sortByProximity ? 'Tri par proximité' : 'Tri alphabétique' }}
        </button>
        <span v-if="sortByProximity && !userPosition" class="text-xs text-amber-500">
          <UIcon name="i-heroicons-exclamation-triangle" class="w-3 h-3 inline" />
          GPS indisponible
        </span>
        <span v-if="sortByProximity && isLocating" class="text-xs text-gray-400 animate-pulse">
          Localisation…
        </span>
      </div>

      <div class="flex gap-2 overflow-x-auto pb-1">
        <UBadge
          v-for="zone in zones"
          :key="zone"
          :color="selectedZone === zone ? 'blue' : 'gray'"
          variant="solid"
          class="cursor-pointer whitespace-nowrap"
          @click="selectedZone = selectedZone === zone ? '' : zone"
        >
          {{ zone }}
        </UBadge>
      </div>

      <UButton
        v-if="canCreatePDV"
        block
        size="sm"
        icon="i-heroicons-plus"
        class="bg-fc-blue"
        @click="showCreatePDV = true"
      >
        Nouveau PDV
      </UButton>
    </div>

    <!-- PDV List -->
    <div class="px-4 space-y-3">
      <div
        v-for="pdv in filteredPDV"
        :key="pdv.pdv_id"
        class="bg-white rounded-xl shadow-sm p-4 cursor-pointer active:bg-gray-50"
        @click="navigateTo(`/mobile/pdv/${pdv.pdv_id}`)"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <h3 class="font-bold text-gray-900">{{ pdv.nom_pdv }}</h3>
            <p class="text-xs text-gray-400 mt-1">{{ pdv.zone }} — {{ pdv.region }}</p>
            <div class="flex gap-2 mt-2">
              <UBadge variant="subtle" color="blue" size="xs">{{ pdv.canal }}</UBadge>
              <UBadge variant="subtle" color="gray" size="xs">{{ pdv.categorie_pdv }}</UBadge>
              <!-- Distance badge -->
              <UBadge
                v-if="sortByProximity && pdv._distance != null"
                variant="subtle"
                :color="pdv._distance < 500 ? 'green' : pdv._distance < 2000 ? 'orange' : 'red'"
                size="xs"
              >
                <UIcon name="i-heroicons-map-pin" class="w-3 h-3 mr-0.5 inline" />
                {{ formatDistance(pdv._distance) }}
              </UBadge>
            </div>
          </div>
          <NuxtLink
            v-if="pdv.geolocation_lat"
            :to="`https://www.google.com/maps?q=${pdv.geolocation_lat},${pdv.geolocation_lng}`"
            target="_blank"
            @click.stop
          >
            <UIcon name="i-heroicons-map-pin" class="w-5 h-5 text-fc-blue" />
          </NuxtLink>
        </div>
      </div>
    </div>

    <p v-if="filteredPDV.length === 0" class="text-center text-gray-400 py-10 text-sm">Aucun PDV trouvé</p>
    <PDVQuickCreateModal
      v-model="showCreatePDV"
      @created="handlePDVCreated"
    />
  </div>
</template>

<script setup lang="ts">
import type { PDV } from '~/types'

definePageMeta({ middleware: ['auth'], layout: 'mobile' })

const pdvStore = usePDVStore()
const authStore = useAuthStore()
const { currentPosition, isLocating, requestPosition } = useUserGeolocation()

const search = ref('')
const selectedZone = ref('')
const sortByProximity = ref(true)
const showCreatePDV = ref(false)

const allPDV = ref<any[]>([])
const zones = computed(() => [...new Set(allPDV.value.map(p => p.zone).filter(Boolean))].sort())
const canCreatePDV = computed(() => authStore.profile?.role === 'merchandiser')

const userPosition = computed(() => currentPosition.value)

/**
 * Calcul haversine de distance en mètres
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLng = (lng2 - lng1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Formater la distance en texte lisible
 */
function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(1)}km`
}

function handlePDVCreated(pdv: PDV) {
  if (!allPDV.value.some(item => item.pdv_id === pdv.pdv_id)) {
    allPDV.value = [...allPDV.value, pdv].sort((a, b) =>
      (a.nom_pdv || '').localeCompare(b.nom_pdv || '')
    )
  }

  selectedZone.value = pdv.zone || ''
  search.value = pdv.nom_pdv || ''
}

const filteredPDV = computed(() => {
  let list = allPDV.value

  // Filtrage par recherche
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(p => p.nom_pdv?.toLowerCase().includes(q) || p.zone?.toLowerCase().includes(q))
  }

  // Filtrage par zone
  if (selectedZone.value) {
    list = list.filter(p => p.zone === selectedZone.value)
  }

  // Calcul de distance et tri par proximité si GPS disponible
  if (sortByProximity.value && userPosition.value) {
    const { lat, lng } = userPosition.value
    list = list.map(p => ({
      ...p,
      _distance: (p.geolocation_lat && p.geolocation_lng)
        ? haversineDistance(lat, lng, p.geolocation_lat, p.geolocation_lng)
        : Infinity,
    }))
    list.sort((a, b) => a._distance - b._distance)
  } else {
    // Tri alphabétique par défaut
    list = list.map(p => ({ ...p, _distance: null }))
    list.sort((a, b) => (a.nom_pdv || '').localeCompare(b.nom_pdv || ''))
  }

  return list.slice(0, 50)
})

onMounted(async () => {
  if (!authStore.profile) {
    await authStore.fetchProfile()
  }

  allPDV.value = await pdvStore.fetchScopedPDV(authStore.profile)
  // Demander la position GPS si pas encore disponible
  if (!currentPosition.value) {
    requestPosition()
  }
})
</script>
