<template>
  <div class="min-h-screen bg-gray-50 flex flex-col safe-area-top safe-area-bottom">
    <!-- Mobile Header -->
    <header class="sticky top-0 z-40 bg-fc-blue text-white px-4 py-3 flex items-center justify-between shadow-md">
      <div class="flex items-center gap-3">
        <button
          v-if="canGoBack"
          class="p-1 rounded-lg hover:bg-white/10"
          @click="$router.back()"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 class="text-lg font-semibold">{{ pageTitle }}</h1>
      </div>

      <div class="flex items-center gap-3">
        <!-- Online status -->
        <span
          class="w-2.5 h-2.5 rounded-full"
          :class="isOnline ? 'bg-emerald-400' : 'bg-red-400'"
        />

        <!-- Pending sync -->
        <span
          v-if="pendingCount > 0"
          class="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full"
        >
          {{ pendingCount }}
        </span>
      </div>
    </header>

    <!-- Content -->
    <main class="flex-1 overflow-auto pb-20">
      <slot />
    </main>

    <!-- Bottom Navigation -->
    <MobileBottomNav />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { isOnline, pendingCount } = useOfflineSync()

const canGoBack = computed(() => {
  return route.path !== '/mobile' && route.path !== '/mobile/'
})

const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    '/mobile': 'Friesland',
    '/mobile/visites': 'Mes Visites',
    '/mobile/visites/new': 'Nouvelle Visite',
    '/mobile/pdv': 'Points de Vente',
    '/mobile/calendar': 'Calendrier',
    '/mobile/map': 'Carte',
    '/mobile/contacts': 'Contacts',
  }
  return titles[route.path] || 'Friesland'
})
</script>
