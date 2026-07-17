<template>
  <div class="flex min-h-dvh bg-[var(--admin-bg)] transition-colors dark:bg-slate-950">
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
      <header class="sticky top-0 z-30 border-b border-slate-200/80 bg-white/[0.82] px-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90 sm:px-6 lg:px-8">
        <div class="flex min-h-20 flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div class="flex min-w-0 items-center gap-4">
          <button
            type="button"
            aria-label="Ouvrir le menu"
            class="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-gray-300 dark:hover:bg-gray-700 lg:hidden"
            @click="mobileSidebarOpen = true"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
            <div class="min-w-0">
              <p class="text-[11px] font-semibold uppercase tracking-normal text-fc-red">Administration</p>
              <h1 class="truncate text-xl font-semibold leading-tight text-slate-950 dark:text-gray-100">{{ pageTitle }}</h1>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 lg:justify-end">
            <div class="hidden items-center gap-2 xl:flex">
              <div v-for="metric in headerMetrics" :key="metric.label" class="admin-kpi-chip min-w-28">
                <p class="text-[10px] font-semibold uppercase tracking-normal text-slate-400">{{ metric.label }}</p>
                <p class="mt-0.5 text-sm font-semibold tabular-nums text-slate-950 dark:text-white">{{ metric.value }}</p>
              </div>
            </div>
          <!-- Présence terrain : commerciaux en ligne (ping GPS récent) + accès
               au suivi des tournées. -->
          <NuxtLink
            to="/admin/trajets"
            class="flex h-10 items-center gap-2 rounded-xl border border-slate-200/80 bg-white/70 px-3 text-sm shadow-[0_10px_24px_-22px_rgba(15,23,42,0.7)] transition hover:bg-white dark:border-slate-700 dark:bg-slate-800/70 dark:hover:bg-slate-800"
            :aria-label="`${commerciauxEnTournee} commercial(aux) en ligne, ouvrir le suivi terrain`"
          >
            <span class="relative flex h-2.5 w-2.5">
              <span
                v-if="commerciauxEnTournee > 0"
                class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
              />
              <span
                class="relative inline-flex h-2.5 w-2.5 rounded-full"
                :class="commerciauxEnTournee > 0 ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'"
              />
            </span>
            <span class="text-gray-500 dark:text-gray-400 hidden sm:inline">
              {{ commerciauxEnTournee }} en ligne
            </span>
          </NuxtLink>

          <!-- Sync pending -->
          <div v-if="pendingCount > 0" class="flex h-10 items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-3 text-sm font-medium text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {{ pendingCount }} en attente sur cet appareil
          </div>

          <NuxtLink
            v-if="errorCount > 0"
            to="/admin/visites"
            class="flex h-10 items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700 transition hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50"
            :aria-label="`${errorCount} synchronisation(s) en erreur sur cet appareil, ouvrir les visites`"
          >
            <UIcon name="i-heroicons-exclamation-triangle" class="h-4 w-4" aria-hidden="true" />
            {{ errorCount }} erreur{{ errorCount > 1 ? 's' : '' }} sur cet appareil
          </NuxtLink>

          <!-- Dark mode toggle -->
          <DarkModeToggle />

          <!-- User dropdown -->
          <UDropdown
            :items="userMenuItems"
            :popper="{ placement: 'bottom-end' }"
          >
            <button class="flex h-10 items-center gap-2 rounded-xl border border-slate-200/80 bg-white/70 px-2.5 shadow-[0_10px_24px_-22px_rgba(15,23,42,0.7)] transition hover:bg-white dark:border-slate-700 dark:bg-slate-800/70 dark:hover:bg-slate-800">
              <div class="w-8 h-8 rounded-lg bg-fc-red flex items-center justify-center">
                <span class="text-white text-sm font-medium">
                  {{ userInitials }}
                </span>
              </div>
              <span class="text-sm text-gray-700 dark:text-gray-300 hidden md:inline">{{ authStore.profile?.nom || authStore.profile?.email }}</span>
            </button>
          </UDropdown>
          </div>
        </div>
      </header>

      <!-- Page content -->
      <main id="admin-main-content" class="flex-1 px-4 py-6 dark:text-slate-200 sm:px-6 lg:px-8 lg:py-8">
        <div class="mx-auto w-full max-w-[1600px]">
          <AdminSectionTabs class="mb-6" />
          <AdminTableEnhancer>
            <slot />
          </AdminTableEnhancer>
        </div>
      </main>

      <!-- Footer -->
      <footer class="border-t border-slate-200/80 px-4 py-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:px-6 lg:px-8">
        <div class="mx-auto flex w-full max-w-[1600px] flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <p>
            Développé par
            <a
              href="https://bigfive.solutions"
              target="_blank"
              rel="noopener noreferrer"
              class="font-semibold text-fc-red hover:underline"
            >Big Five</a>
          </p>
          <div class="flex items-center gap-3">
            <a
              href="mailto:jeanluc@bigfiveabidjan.com"
              class="inline-flex items-center gap-1 transition hover:text-fc-red"
            >
              <UIcon name="i-heroicons-envelope" class="h-3.5 w-3.5" aria-hidden="true" />
              Contacter le support
            </a>
            <span class="text-slate-300 dark:text-slate-600">·</span>
            <span class="tabular-nums">Version 3.0</span>
          </div>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const authStore = useAuthStore()
const { pendingCount, errorCount } = useOfflineSync()
const visitesStore = useVisitesStore()
const supabase = useSupabaseClient()

const sidebarCollapsed = ref(false)
const mobileSidebarOpen = ref(false)
const numberFormatter = new Intl.NumberFormat('fr-FR')

// Commerciaux « en tournée » : un point GPS envoyé dans les 10 dernières
// minutes (l'app mobile émet un point toutes les 1–2 min pendant une tournée).
// Distinct du témoin « En ligne » du header, qui reflète le réseau de ce poste.
const PRESENCE_WINDOW_MIN = 10
const commerciauxEnTournee = ref(0)
let presenceTimer: ReturnType<typeof setInterval> | null = null

async function fetchCommerciauxEnTournee() {
  const since = new Date(Date.now() - PRESENCE_WINDOW_MIN * 60_000).toISOString()
  const { data, error } = await supabase
    .from('position_tournee')
    .select('user_id')
    .gte('captured_at', since)
  if (error) return
  commerciauxEnTournee.value = new Set((data || []).map((r: any) => r.user_id)).size
}

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
    '/admin/trajets': 'Suivi commerciaux',
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

const headerMetrics = computed(() => {
  const stats = visitesStore.stats
  return [
    { label: 'Visites mois', value: numberFormatter.format(stats?.visites_month ?? 0) },
    { label: 'PDV actifs', value: numberFormatter.format(stats?.total_pdv ?? 0) },
    { label: 'Commerciaux actifs', value: `${commerciauxEnTournee.value} / ${numberFormatter.format(stats?.total_commerciaux ?? 0)}` },
  ]
})

watch(mobileSidebarOpen, (opened) => {
  if (opened) sidebarCollapsed.value = false
})

onMounted(() => {
  visitesStore.fetchStats().catch(() => {})
  fetchCommerciauxEnTournee()
  presenceTimer = setInterval(fetchCommerciauxEnTournee, 60_000)
})

onBeforeUnmount(() => {
  if (presenceTimer) clearInterval(presenceTimer)
})
</script>
