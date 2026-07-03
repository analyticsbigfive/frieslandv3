<template>
  <div class="min-h-dvh bg-gray-50 dark:bg-gray-900 flex flex-col safe-area-top transition-colors">
    <a
      href="#mobile-main"
      class="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-fc-red focus:shadow-lg"
    >
      Aller au contenu
    </a>

    <!-- Mobile Header -->
    <header class="sticky top-0 z-40 bg-fc-red text-white px-3 py-2.5 flex min-h-[56px] items-center justify-between gap-2 shadow-sm">
      <div class="flex min-w-0 items-center gap-2">
        <button
          v-if="canGoBack"
          type="button"
          class="touch-target inline-flex items-center justify-center rounded-xl transition-colors hover:bg-white/10 active:bg-white/15"
          aria-label="Revenir à l'écran précédent"
          @click="$router.back()"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <img src="~/assets/logo.png" alt="FC" class="w-7 h-7 rounded object-contain bg-white/90 p-0.5" />
        <h1 class="truncate text-base font-semibold leading-tight">{{ pageTitle }}</h1>
      </div>

      <div class="flex shrink-0 items-center gap-1.5">
        <!-- Dark mode toggle -->
        <DarkModeToggle variant="mobile" />

        <!-- GPS status -->
        <button
          type="button"
          class="touch-target relative inline-flex items-center justify-center rounded-xl transition-colors hover:bg-white/10 active:bg-white/15"
          :title="gpsTooltip"
          :aria-label="gpsTooltip"
          @click="refreshGps"
        >
          <UIcon
            name="i-heroicons-map-pin"
            class="w-4 h-4"
            :class="gpsIconClass"
          />
          <span
            v-if="isLocating"
            class="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-400 rounded-full animate-ping"
          />
        </button>

        <!-- Tournée en cours (app native) -->
        <span
          v-if="isTrackingTournee"
          class="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-white/10 px-2 text-[11px] font-semibold"
          :title="`Tournée en cours — ${tourneePointCount} point(s) capté(s)`"
          aria-label="Tournée en cours"
        >
          <span class="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" aria-hidden="true" />
          <span>Tournée</span>
        </span>

        <!-- Online status -->
        <span
          class="inline-flex min-h-8 items-center gap-1.5 rounded-full px-2 text-[11px] font-semibold"
          :class="isOnline ? 'bg-white/10 text-white' : 'bg-amber-200 text-amber-950'"
          :aria-label="isOnline ? 'Connexion active' : 'Mode hors ligne'"
        >
          <span
            class="h-2 w-2 rounded-full"
            :class="isOnline ? 'bg-emerald-300' : 'bg-amber-700'"
            aria-hidden="true"
          />
          <span>{{ isOnline ? 'En ligne' : 'Offline' }}</span>
        </span>

        <!-- Pending sync -->
        <span
          v-if="pendingCount > 0"
          class="rounded-full bg-amber-400 px-2 py-1 text-xs font-bold text-amber-950"
          :aria-label="`${pendingCount} synchronisation(s) en attente`"
        >
          {{ pendingCount }}
        </span>
      </div>
    </header>

    <!-- Offline Banner -->
    <OfflineBanner />

    <!-- Content -->
    <main id="mobile-main" class="flex-1 overflow-auto mobile-bottom-inset dark:text-gray-200" tabindex="-1">
      <slot />
    </main>

    <!-- Bottom Navigation -->
    <MobileBottomNav />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { isOnline, pendingCount } = useOfflineSync()
const { currentPosition, isLocating, positionError, requestPosition } = useUserGeolocation()
const { isTracking: isTrackingTournee, pointCount: tourneePointCount, autoStart, stopTournee } = useTournee()
const tourneeUser = useSupabaseUser()

// Tournée automatique (natif) : démarre ou reprend dès que l'utilisateur
// est connecté, s'arrête au logout.
watch(tourneeUser, (u) => {
  if (u) {
    void autoStart()
  }
  else if (isTrackingTournee.value) {
    void stopTournee()
  }
}, { immediate: true })

const gpsIconClass = computed(() => {
  if (isLocating.value) return 'text-amber-300 animate-pulse'
  if (currentPosition.value) return 'text-emerald-300'
  if (positionError.value) return 'text-red-300'
  return 'text-white/50'
})

const gpsTooltip = computed(() => {
  if (isLocating.value) return 'Recherche GPS en cours...'
  if (currentPosition.value) {
    return `GPS actif — Précision: ${currentPosition.value.accuracy}m`
  }
  if (positionError.value) return positionError.value
  return 'Position GPS non disponible'
})

function refreshGps() {
  requestPosition()
}

const canGoBack = computed(() => {
  return route.path !== '/mobile' && route.path !== '/mobile/'
})

const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    '/mobile': 'Friesland',
    '/mobile/visites': 'Mes Visites',
    '/mobile/visites/new': 'Nouvelle Visite',
    '/mobile/pdv': 'Points de Vente',
    '/mobile/routing': 'Mon Routing',
    '/mobile/calendar': 'Calendrier',
    '/mobile/map': 'Carte',
    '/mobile/contacts': 'Contacts',
  }
  if (titles[route.path]) return titles[route.path]
  if (route.path.startsWith('/mobile/pdv/')) return 'Détail PDV'
  if (route.path.startsWith('/mobile/visites/')) return 'Détail Visite'
  return 'Friesland'
})
</script>
