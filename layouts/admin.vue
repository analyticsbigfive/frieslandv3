<template>
  <div class="min-h-screen flex bg-gray-50 dark:bg-gray-900 transition-colors">
    <!-- Sidebar -->
    <AdminSidebar
      :collapsed="sidebarCollapsed"
      @toggle="sidebarCollapsed = !sidebarCollapsed"
    />

    <!-- Main Content -->
    <div
      class="flex-1 flex flex-col min-h-screen transition-all duration-300"
      :class="sidebarCollapsed ? 'ml-16' : 'ml-64'"
    >
      <!-- Top Header -->
      <header class="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <button
            class="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300"
            @click="sidebarCollapsed = !sidebarCollapsed"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 class="text-lg font-semibold text-gray-800 dark:text-gray-100">{{ pageTitle }}</h1>
        </div>

        <div class="flex items-center gap-4">
          <!-- Online/Offline indicator -->
          <div class="flex items-center gap-2 text-sm">
            <span
              class="w-2.5 h-2.5 rounded-full"
              :class="isOnline ? 'bg-emerald-500' : 'bg-red-500'"
            />
            <span class="text-gray-500 dark:text-gray-400 hidden sm:inline">
              {{ isOnline ? 'En ligne' : 'Hors ligne' }}
            </span>
          </div>

          <!-- Sync pending -->
          <div v-if="pendingCount > 0" class="flex items-center gap-1 text-amber-600 text-sm">
            <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {{ pendingCount }} en attente
          </div>

          <!-- Dark mode toggle -->
          <DarkModeToggle />

          <!-- User dropdown -->
          <UDropdown
            :items="userMenuItems"
            :popper="{ placement: 'bottom-end' }"
          >
            <button class="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
              <div class="w-8 h-8 rounded-full bg-fc-red flex items-center justify-center">
                <span class="text-white text-sm font-medium">
                  {{ userInitials }}
                </span>
              </div>
              <span class="text-sm text-gray-700 dark:text-gray-300 hidden md:inline">{{ authStore.profile?.nom || authStore.profile?.email }}</span>
            </button>
          </UDropdown>
        </div>
      </header>

      <!-- Page content -->
      <main class="flex-1 p-6 dark:text-gray-200">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const authStore = useAuthStore()
const { isOnline, pendingCount } = useOfflineSync()

const sidebarCollapsed = ref(false)

const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    '/admin': 'Dashboard',
    '/admin/routing': 'Routing & Planning',
    '/admin/visites': 'Visites',
    '/admin/pdv': 'Points de Vente',
    '/admin/users': 'Utilisateurs',
    '/admin/produits': 'Produits',
    '/admin/import': 'Import / Export',
    '/admin/map': 'Carte',
  }
  return titles[route.path] || 'Dashboard'
})

const userInitials = computed(() => {
  const nom = authStore.profile?.nom || authStore.profile?.email || '?'
  return nom.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2)
})

const userMenuItems = [
  [{
    label: 'Mon profil',
    icon: 'i-heroicons-user-circle',
    click: () => navigateTo('/admin/profile'),
  }],
  [{
    label: 'App Mobile',
    icon: 'i-heroicons-device-phone-mobile',
    click: () => navigateTo('/mobile'),
  }],
  [{
    label: 'Déconnexion',
    icon: 'i-heroicons-arrow-right-on-rectangle',
    click: () => {
      authStore.logout()
      navigateTo('/login')
    },
  }],
]
</script>
