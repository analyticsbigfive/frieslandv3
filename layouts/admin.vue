<template>
  <div class="flex min-h-dvh bg-[#f6f7f9] transition-colors dark:bg-slate-950">
    <a href="#admin-main-content" class="sr-only z-[60] rounded-lg bg-white px-4 py-2 text-sm font-semibold text-fc-red focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
      Aller au contenu
    </a>
    <button
      v-if="mobileSidebarOpen"
      type="button"
      aria-label="Fermer le menu"
      class="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-sm lg:hidden"
      @click="mobileSidebarOpen = false"
    />

    <!-- Sidebar -->
    <AdminSidebar
      :collapsed="sidebarCollapsed"
      :mobile-open="mobileSidebarOpen"
      @toggle="sidebarCollapsed = !sidebarCollapsed"
      @navigate="mobileSidebarOpen = false"
    />

    <!-- Main Content -->
    <div
      class="flex min-h-dvh min-w-0 flex-1 flex-col transition-[margin] duration-300"
      :class="sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'"
    >
      <!-- Top Header -->
      <header class="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90 sm:px-6 lg:px-8">
        <div class="flex items-center gap-4">
          <button
            type="button"
            aria-label="Ouvrir le menu"
            class="rounded-lg p-2 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 lg:hidden"
            @click="mobileSidebarOpen = true"
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
      <main id="admin-main-content" class="flex-1 px-4 py-6 dark:text-slate-200 sm:px-6 lg:px-8 lg:py-8">
        <div class="mx-auto w-full max-w-[1600px]">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const authStore = useAuthStore()
const { isOnline, pendingCount } = useOfflineSync()

const sidebarCollapsed = ref(false)
const mobileSidebarOpen = ref(false)

const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    '/admin': 'Dashboard',
    '/admin/routing': 'Routing & Planning',
    '/admin/visites': 'Visites',
    '/admin/pdv': 'Points de Vente',
    '/admin/users': 'Utilisateurs',
    '/admin/permissions': 'Permissions & accès',
    '/admin/referentiels': 'Référentiels',
    '/admin/perfect-store': 'Perfect Store',
    '/admin/perfect-store/standards': 'Standards Perfect Store',
    '/admin/produits/inventaire': 'Inventaire SKU',
    '/admin/produits/seuils': 'Seuils de stock',
    '/admin/produits': 'Produits',
    '/admin/import-export': 'Import / Export',
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

watch(mobileSidebarOpen, (opened) => {
  if (opened) sidebarCollapsed.value = false
})
</script>
