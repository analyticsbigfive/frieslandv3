<template>
  <section v-if="tournee.isNative" class="mobile-card mt-3 overflow-hidden" aria-label="Ma tournée">
    <!-- En-tête statut -->
    <div class="flex items-center justify-between gap-3 p-4">
      <div class="min-w-0">
        <p class="text-xs uppercase tracking-wide text-gray-400">Ma tournée</p>
        <p v-if="tournee.isTracking.value" class="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          <span class="relative flex h-2.5 w-2.5">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          En tournée
          <span v-if="startedLabel" class="font-normal text-gray-400">· depuis {{ startedLabel }}</span>
        </p>
        <p v-else class="text-sm text-gray-500 dark:text-gray-400">
          Suivi arrêté — reprend au prochain lancement
        </p>
        <p v-if="tournee.trackingError.value" class="mt-1 text-xs font-medium text-red-600">
          {{ tournee.trackingError.value }}
        </p>
      </div>
      <UButton
        :color="tournee.isTracking.value ? 'gray' : 'red'"
        :icon="tournee.isTracking.value ? 'i-heroicons-stop-circle' : 'i-heroicons-play-circle'"
        :loading="busy"
        size="sm"
        @click="toggle"
      >
        {{ tournee.isTracking.value ? 'Fin' : 'Début' }}
      </UButton>
    </div>

    <!-- Stats du jour -->
    <div v-if="tournee.isTracking.value" class="grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100 dark:divide-gray-700 dark:border-gray-700">
      <div class="p-3 text-center">
        <p class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ durationLabel }}</p>
        <p class="text-[11px] uppercase tracking-wide text-gray-400">Durée</p>
      </div>
      <div class="p-3 text-center">
        <p class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ tournee.distanceKm.value.toFixed(1) }}<span class="text-xs font-normal text-gray-400"> km</span></p>
        <p class="text-[11px] uppercase tracking-wide text-gray-400">Parcouru</p>
      </div>
      <div class="p-3 text-center">
        <p class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ visitCount }}<span class="text-xs font-normal text-gray-400"> / {{ dailyTarget }}</span></p>
        <p class="text-[11px] uppercase tracking-wide text-gray-400">PDV visités</p>
      </div>
    </div>

    <!-- Prochain PDV -->
    <div v-if="nextPdv" class="flex items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
      <div class="min-w-0">
        <p class="text-[11px] uppercase tracking-wide text-gray-400">Prochain PDV</p>
        <p class="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{{ nextPdvName }}</p>
        <p v-if="nextPdvDistance !== null" class="text-xs text-gray-500">à {{ formatDistance(nextPdvDistance) }}</p>
      </div>
      <UButton
        v-if="nextPdvCoords"
        color="red"
        variant="soft"
        size="sm"
        icon="i-heroicons-map"
        @click="openDirections"
      >
        Itinéraire
      </UButton>
    </div>

    <TourneeOnboardingModal
      v-model="showOnboarding"
      @start="startNow"
      @open-settings="tournee.openLocationSettings()"
    />
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{
  visitCount: number
  dailyTarget: number
}>()

const tournee = useTournee()
const routingStore = useRoutingStore()
const user = useSupabaseUser()
const geoProvider = useGeoProvider()
const { currentPosition } = useUserGeolocation()
const { haversineDistance } = useGeofencing()
const { isExempt: isBatteryExempt } = useBatteryOptimization()

const busy = ref(false)
const showOnboarding = ref(false)

// Horloge partagée pour la durée live.
const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  clock = setInterval(() => { now.value = Date.now() }, 1000)
  if (user.value?.id) {
    await routingStore.fetchTodayRouting(user.value.id).catch(() => {})
  }
})

onUnmounted(() => {
  if (clock) clearInterval(clock)
})

const elapsedMs = computed(() => {
  const started = tournee.startedAt.value
  if (!tournee.isTracking.value || !started) return 0
  return Math.max(0, now.value - new Date(started).getTime())
})

const durationLabel = computed(() => {
  const total = Math.floor(elapsedMs.value / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0
    ? `${h}h${String(m).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
})

const startedLabel = computed(() => {
  const started = tournee.startedAt.value
  if (!started) return ''
  return new Date(started).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
})

const nextPdv = computed(() => routingStore.nextPendingPDV)
const nextPdvName = computed(() => nextPdv.value?.pdv?.nom_pdv || 'PDV suivant')

const nextPdvCoords = computed(() => {
  const p = nextPdv.value
  const lat = p?.pdv?.geolocation_lat ?? p?.geolocation_lat
  const lng = p?.pdv?.geolocation_lng ?? p?.geolocation_lng
  return (lat && lng) ? { lat, lng } : null
})

const nextPdvDistance = computed(() => {
  const pos = currentPosition.value
  const target = nextPdvCoords.value
  if (!pos || !target) return null
  return haversineDistance(pos.lat, pos.lng, target.lat, target.lng)
})

function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
}

function openDirections() {
  const c = nextPdvCoords.value
  if (!c) return
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`, '_blank')
}

async function toggle() {
  if (tournee.isTracking.value) {
    busy.value = true
    try {
      await tournee.stopTournee()
    }
    finally {
      busy.value = false
    }
    return
  }

  const [permission, batteryOk] = await Promise.all([
    geoProvider.checkPermission(),
    isBatteryExempt(),
  ])

  if (permission !== 'granted' || !batteryOk) {
    showOnboarding.value = true
    return
  }

  await startNow()
}

async function startNow() {
  showOnboarding.value = false
  busy.value = true
  try {
    await tournee.startTournee()
  }
  finally {
    busy.value = false
  }
}
</script>
