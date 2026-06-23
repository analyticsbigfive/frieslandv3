<template>
  <div class="mobile-page">
    <!-- Search & Filters -->
    <div class="p-4 space-y-3">
      <UInput
        v-model="search"
        icon="i-heroicons-magnifying-glass"
        placeholder="Rechercher un PDV..."
        size="lg"
        class="w-full"
        aria-label="Rechercher un point de vente"
      />

      <!-- Sort toggle: proximity vs alphabetical -->
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="touch-target flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-colors"
          :class="sortByProximity ? 'bg-fc-red text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'"
          :aria-pressed="sortByProximity"
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

      <div class="flex gap-2 overflow-x-auto pb-1" aria-label="Filtrer par zone">
        <button
          v-for="zone in zones"
          :key="zone"
          type="button"
          class="min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold transition-colors"
          :class="selectedZone === zone
            ? 'bg-fc-red text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'"
          :aria-pressed="selectedZone === zone"
          @click="selectedZone = selectedZone === zone ? '' : zone"
        >
          {{ zone }}
        </button>
      </div>

      <UButton
        v-if="canCreatePDV"
        block
        size="sm"
        icon="i-heroicons-plus"
        class="bg-fc-red"
        @click="showCreatePDV = true"
      >
        Nouveau PDV
      </UButton>
    </div>

    <!-- PDV List -->
    <div v-if="loading" class="px-4 space-y-3">
      <div v-for="i in 5" :key="i" class="mobile-card p-4 animate-pulse">
        <div class="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
        <div class="mt-3 flex gap-2">
          <div class="h-5 w-20 rounded-full bg-gray-100 dark:bg-gray-700" />
          <div class="h-5 w-24 rounded-full bg-gray-100 dark:bg-gray-700" />
        </div>
      </div>
    </div>

    <div v-else-if="filteredPDV.length" class="px-4 space-y-3">
      <article
        v-for="pdv in filteredPDV"
        :key="pdv.pdv_id"
        class="mobile-card overflow-hidden transition-all hover:border-red-100 hover:bg-red-50/40 dark:hover:border-red-900/50 dark:hover:bg-red-950/20"
      >
        <div class="flex items-start justify-between gap-3 p-4">
          <NuxtLink
            :to="`/mobile/pdv/${pdv.pdv_id}`"
            class="min-w-0 flex-1"
            :aria-label="`Ouvrir le PDV ${pdv.nom_pdv}`"
          >
            <h3 class="font-bold text-gray-900 dark:text-gray-100">{{ pdv.nom_pdv }}</h3>
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
          </NuxtLink>
          <NuxtLink
            v-if="pdv.geolocation_lat"
            :to="`https://www.google.com/maps?q=${pdv.geolocation_lat},${pdv.geolocation_lng}`"
            target="_blank"
            class="touch-target inline-flex items-center justify-center rounded-xl text-fc-red hover:bg-red-50 dark:hover:bg-red-950/30"
            :aria-label="`Ouvrir ${pdv.nom_pdv} dans Google Maps`"
          >
            <UIcon name="i-heroicons-map-pin" class="w-5 h-5 text-fc-red" />
          </NuxtLink>
        </div>
      </article>
    </div>

    <div v-else class="px-4 py-14 text-center">
      <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/30">
        <UIcon name="i-heroicons-map-pin" class="h-8 w-8 text-fc-red" />
      </div>
      <p class="font-semibold text-gray-700 dark:text-gray-200">Aucun PDV trouvé</p>
      <p class="mx-auto mt-1 max-w-[260px] text-sm text-gray-500 dark:text-gray-400">
        Essayez une autre recherche ou changez de zone.
      </p>
    </div>
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
const loading = ref(true)

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
  loading.value = true
  try {
    if (!authStore.profile) {
      await authStore.fetchProfile()
    }

    allPDV.value = await pdvStore.fetchScopedPDV(authStore.profile)
    // Demander la position GPS si pas encore disponible
    if (!currentPosition.value) {
      requestPosition()
    }
  }
  finally {
    loading.value = false
  }
})
</script>
