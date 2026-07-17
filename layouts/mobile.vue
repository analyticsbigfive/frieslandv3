<template>
  <div class="min-h-dvh bg-gray-50 dark:bg-gray-900 flex flex-col safe-area-top transition-colors">
    <a
      href="#mobile-main"
      class="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-fc-red focus:shadow-lg"
    >
      Aller au contenu
    </a>

    <!-- Mobile Header -->
    <header class="relative sticky top-0 z-40 bg-fc-red text-white px-3 py-2.5 flex min-h-[56px] items-center justify-between gap-2 shadow-sm">
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
        <button
          type="button"
          class="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-white/10 px-2.5 text-[11px] font-semibold transition-colors hover:bg-white/15 active:bg-white/20"
          :aria-expanded="showStatusPanel"
          aria-controls="mobile-status-panel"
          aria-label="Afficher l’état de l’application"
          @click="showStatusPanel = !showStatusPanel"
        >
          <span class="h-2 w-2 rounded-full" :class="statusDotClass" aria-hidden="true" />
          <span>{{ statusSummary }}</span>
          <UIcon name="i-heroicons-chevron-down" class="h-3.5 w-3.5 transition-transform" :class="showStatusPanel ? 'rotate-180' : ''" aria-hidden="true" />
        </button>

        <!-- Account / logout menu -->
        <UDropdown :items="userMenuItems" :popper="{ placement: 'bottom-end' }">
          <button
            type="button"
            class="touch-target inline-flex items-center justify-center rounded-xl transition-colors hover:bg-white/10 active:bg-white/15"
            aria-label="Compte et déconnexion"
          >
            <UIcon name="i-heroicons-user-circle" class="w-6 h-6" />
          </button>
        </UDropdown>
      </div>

      <!-- Consolidated app status: all existing indicators remain available here. -->
      <div
        v-if="showStatusPanel"
        id="mobile-status-panel"
        class="absolute right-3 top-[calc(100%-2px)] z-50 w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-red-100 bg-white p-3 text-gray-900 shadow-xl dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
      >
        <div class="mb-3 flex items-start justify-between gap-3">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">État de l’application</p>
            <p class="mt-1 text-sm font-semibold">{{ isOnline ? 'Connexion active' : 'Mode hors ligne' }}</p>
          </div>
          <span class="rounded-full px-2 py-1 text-[10px] font-bold" :class="isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'">
            {{ isOnline ? 'En ligne' : 'Offline' }}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs">
          <button type="button" class="flex min-h-11 items-center gap-2 rounded-xl bg-gray-50 px-3 text-left transition hover:bg-red-50 dark:bg-gray-700/60 dark:hover:bg-red-950/30" :title="gpsTooltip" @click="refreshGps">
            <UIcon name="i-heroicons-map-pin" class="h-4 w-4 shrink-0" :class="gpsIconClass" aria-hidden="true" />
            <span><strong class="block font-semibold">GPS</strong><span class="text-[10px] text-gray-500 dark:text-gray-400">{{ isLocating ? 'Recherche…' : currentPosition ? 'Disponible' : 'Non disponible' }}</span></span>
          </button>
          <div class="flex min-h-11 items-center gap-2 rounded-xl bg-gray-50 px-3 dark:bg-gray-700/60">
            <UIcon name="i-heroicons-arrow-path" class="h-4 w-4 shrink-0" :class="pendingCount > 0 ? 'text-amber-600' : 'text-emerald-600'" aria-hidden="true" />
            <span><strong class="block font-semibold">Synchronisation</strong><span class="text-[10px] text-gray-500 dark:text-gray-400">{{ pendingCount > 0 ? `${pendingCount} en attente` : 'À jour' }}</span></span>
          </div>
        </div>

        <div v-if="isTrackingTournee" class="mt-2 flex min-h-11 items-center justify-between gap-2 rounded-xl bg-emerald-50 px-3 text-xs text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
          <span class="flex items-center gap-2"><span class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" /> Tournée en cours</span>
          <span class="font-semibold">{{ tourneePointCount }} point(s)</span>
        </div>

        <div class="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-gray-700">
          <DarkModeToggle variant="mobile" />
          <span class="text-[10px] text-gray-400">{{ syncTooltip }}</span>
        </div>
      </div>
    </header>

    <!-- Offline Banner -->
    <OfflineBanner />

    <!-- Content -->
    <main id="mobile-main" class="flex-1 overflow-auto mobile-bottom-inset dark:text-gray-200" tabindex="-1">
      <slot />
    </main>

    <!-- Bottom Navigation: hidden during visit creation to keep one action bar. -->
    <MobileBottomNav v-if="!isVisitWizard" />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const authStore = useAuthStore()
const { isOnline, pendingCount, lastSyncAt } = useOfflineSync()
const { currentPosition, isLocating, positionError, requestPosition } = useUserGeolocation()
const { isTracking: isTrackingTournee, pointCount: tourneePointCount, autoStart, stopTournee } = useTournee()
const tourneeUser = useSupabaseUser()
const showStatusPanel = ref(false)
const isVisitWizard = computed(() => route.path === '/mobile/visites/new')

// Déconnexion : logout() purge le cache offline (dont la file d'attente des
// visites non synchronisées), d'où le garde-fou si pendingCount > 0.
async function handleLogout() {
  if (pendingCount.value > 0) {
    const ok = window.confirm(
      `${pendingCount.value} visite(s) non synchronisée(s) seront perdues à la déconnexion. Se déconnecter quand même ?`,
    )
    if (!ok) return
  }
  await authStore.logout()
  await navigateTo('/login')
}

const userMenuItems = computed(() => [
  [{
    label: authStore.profile?.nom || authStore.profile?.email || 'Mon compte',
    icon: 'i-heroicons-user-circle',
    disabled: true,
  }],
  [{
    label: 'Déconnexion',
    icon: 'i-heroicons-arrow-right-on-rectangle',
    click: handleLogout,
  }],
])

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

const syncTooltip = computed(() => {
  if (pendingCount.value > 0) return `${pendingCount.value} synchronisation(s) en attente`
  if (lastSyncAt.value) return `Dernière synchronisation : ${new Date(lastSyncAt.value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
  return isOnline.value ? 'Données synchronisées' : 'Mode hors ligne'
})

const statusSummary = computed(() => {
  if (!isOnline.value) return 'Offline'
  if (pendingCount.value > 0) return `${pendingCount.value} à sync`
  if (isTrackingTournee.value) return 'Tournée'
  return 'En ligne'
})

const statusDotClass = computed(() => {
  if (!isOnline.value) return 'bg-amber-300'
  if (pendingCount.value > 0) return 'bg-amber-300'
  if (isTrackingTournee.value) return 'bg-emerald-300 animate-pulse'
  return 'bg-emerald-300'
})

watch(() => route.path, () => {
  showStatusPanel.value = false
})

function refreshGps() {
  requestPosition()
}

const canGoBack = computed(() => {
  return route.path !== '/mobile' && route.path !== '/mobile/'
})

const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    '/mobile': 'Visites',
    '/mobile/visites': 'Mes Visites',
    '/mobile/visites/new': 'Nouvelle Visite',
    '/mobile/pdv': 'Points de Vente',
    '/mobile/routing': 'Mon Routing',
    '/mobile/calendar': 'Calendrier',
    '/mobile/map': 'Carte',
    '/mobile/contacts': 'Contacts',
    '/mobile/more': 'Plus',
  }
  if (titles[route.path]) return titles[route.path]
  if (route.path.startsWith('/mobile/pdv/')) return 'Détail PDV'
  if (route.path.startsWith('/mobile/visites/')) return 'Détail Visite'
  return 'Friesland'
})
</script>
