<template>
  <div class="flex min-h-dvh bg-[var(--admin-bg)] dark:bg-slate-950">
    <a href="#admin-main-content" class="sr-only z-[60] rounded-md bg-white px-4 py-2 text-sm font-semibold text-brand-600 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
      Aller au contenu
    </a>
    <button
      v-if="mobileSidebarOpen"
      type="button"
      aria-label="Fermer le menu"
      class="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
      @click="mobileSidebarOpen = false"
    />

    <AdminSidebar
      :collapsed="sidebarCollapsed"
      :mobile-open="mobileSidebarOpen"
      @toggle="sidebarCollapsed = !sidebarCollapsed"
      @navigate="mobileSidebarOpen = false"
    />

    <div
      class="flex min-h-dvh min-w-0 flex-1 flex-col transition-[margin] duration-300"
      :class="sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'"
    >
      <!-- En-tête : où je suis (fil d'Ariane), état du terrain, aide, compte.
           Le titre de la page est le h1 d'AdminPageHeader, pas ici. -->
      <header class="sticky top-0 z-30 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6 lg:px-8">
        <div class="flex min-h-14 items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-2">
            <button
              type="button"
              aria-label="Ouvrir le menu"
              class="-ml-2 flex h-10 w-10 items-center justify-center rounded-md text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
              @click="mobileSidebarOpen = true"
            >
              <UIcon name="i-heroicons-bars-3" class="h-5 w-5" aria-hidden="true" />
            </button>
            <nav v-if="courant" aria-label="Fil d'Ariane" class="min-w-0">
              <ol class="flex min-w-0 items-center gap-1.5 text-sm">
                <li class="min-w-0 truncate">
                  <NuxtLink
                    v-if="filAriane.vue && arriveeDomaine"
                    :to="arriveeDomaine"
                    class="text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline dark:text-slate-300 dark:hover:text-white"
                  >{{ courant.domain.label }}</NuxtLink>
                  <span v-else class="font-semibold text-slate-900 dark:text-white" aria-current="page">{{ courant.domain.label }}</span>
                </li>
                <template v-if="filAriane.vue">
                  <li aria-hidden="true" class="text-slate-400">
                    <UIcon name="i-heroicons-chevron-right-20-solid" class="h-4 w-4" />
                  </li>
                  <li class="min-w-0 truncate font-semibold text-slate-900 dark:text-white" aria-current="page">{{ filAriane.vue }}</li>
                </template>
              </ol>
            </nav>
          </div>

          <div class="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <!-- Présence terrain : personnes en tournée (point GPS des 10 dernières minutes). -->
            <NuxtLink
              v-if="peutOuvrir('/admin/trajets')"
              to="/admin/trajets"
              class="flex h-9 items-center gap-2 rounded-md border border-slate-200 px-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              :aria-label="`${commerciauxEnTournee} personne(s) en tournée en ce moment, ouvrir le suivi des équipes`"
              :title="`${commerciauxEnTournee} personne(s) en tournée en ce moment`"
            >
              <span
                class="inline-flex h-2.5 w-2.5 rounded-full"
                :class="commerciauxEnTournee > 0 ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'"
                aria-hidden="true"
              />
              <span class="tabular-nums">{{ commerciauxEnTournee }}</span>
              <span class="hidden sm:inline">en tournée</span>
            </NuxtLink>

            <div v-if="pendingCount > 0" class="hidden h-9 items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 text-sm font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200 sm:flex">
              <UIcon name="i-heroicons-arrow-path" class="h-4 w-4 animate-spin" aria-hidden="true" />
              {{ pendingCount }} en attente sur cet appareil
            </div>

            <NuxtLink
              v-if="errorCount > 0"
              to="/admin/visites"
              class="flex h-9 items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 text-sm font-medium text-red-800 transition-colors hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
              :aria-label="`${errorCount} envoi(s) en échec sur cet appareil, ouvrir les visites`"
            >
              <UIcon name="i-heroicons-exclamation-triangle" class="h-4 w-4" aria-hidden="true" />
              <span class="hidden sm:inline">{{ errorCount }} envoi{{ errorCount > 1 ? 's' : '' }} en échec</span>
            </NuxtLink>

            <a
              :href="lienGuide"
              target="_blank"
              rel="noopener"
              class="flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              title="Ouvrir le guide d'utilisation (PDF)"
            >
              <UIcon name="i-heroicons-question-mark-circle" class="h-5 w-5" aria-hidden="true" />
              <span class="hidden md:inline">Aide</span>
            </a>

            <DarkModeToggle />

            <UDropdown :items="userMenuItems" :popper="{ placement: 'bottom-end' }">
              <button
                type="button"
                class="flex h-9 items-center gap-2 rounded-md border border-slate-200 px-1.5 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 md:pr-2.5"
                :aria-label="`Mon compte : ${authStore.profile?.nom || authStore.profile?.email || ''}`"
              >
                <span class="flex h-7 w-7 items-center justify-center rounded bg-brand-500 text-xs font-semibold text-white" aria-hidden="true">
                  {{ userInitials }}
                </span>
                <span class="hidden max-w-40 truncate text-sm text-slate-700 dark:text-slate-200 md:inline">{{ authStore.profile?.nom || authStore.profile?.email }}</span>
              </button>
            </UDropdown>
          </div>
        </div>
      </header>

      <main id="admin-main-content" class="flex-1 px-4 py-5 dark:text-slate-200 sm:px-6 lg:px-8 lg:py-6">
        <div class="mx-auto w-full max-w-[1600px]">
          <AdminSectionTabs class="mb-6" />
          <AdminTableEnhancer>
            <slot />
          </AdminTableEnhancer>
        </div>
      </main>

      <footer class="border-t border-slate-200 px-4 py-4 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300 sm:px-6 lg:px-8">
        <div class="mx-auto flex w-full max-w-[1600px] flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <p>
            Développé par
            <a href="https://bigfive.solutions" target="_blank" rel="noopener noreferrer" class="font-semibold text-brand-600 hover:underline dark:text-brand-300">Big Five</a>
          </p>
          <div class="flex items-center gap-3">
            <a href="mailto:jeanluc@bigfiveabidjan.com" class="inline-flex items-center gap-1 transition-colors hover:text-brand-600">
              <UIcon name="i-heroicons-envelope" class="h-4 w-4" aria-hidden="true" />
              Contacter le support
            </a>
            <span class="text-slate-400" aria-hidden="true">·</span>
            <span class="tabular-nums">Version {{ appVersion }}</span>
          </div>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const toast = useToast()
const authStore = useAuthStore()
const { pendingCount, errorCount } = useOfflineSync()
const supabase = useSupabaseClient()
const { courant, arrivee, peutOuvrir, titreCourant } = useAdminNavigation()
const appVersion = useRuntimeConfig().public.appVersion

const sidebarCollapsed = ref(false)
const mobileSidebarOpen = ref(false)

// Fil d'Ariane « Domaine › Vue » ; un domaine à une seule vue n'a qu'un maillon.
const filAriane = computed(() => {
  const c = courant.value
  if (!c || c.domain.tabs.length <= 1 || !c.tab) return { vue: null as string | null }
  return { vue: c.tab.label }
})
const arriveeDomaine = computed(() => (courant.value ? arrivee(courant.value.domain) : null))

useHead(() => ({ title: titreCourant.value ? `${titreCourant.value} · Bonnet Rouge` : 'Bonnet Rouge' }))

// Guide d'utilisation : celui du compte agence pour l'agence, le guide
// administrateur sinon (server/routes/guides/[nom].get.ts).
const lienGuide = computed(() => (authStore.isAgence ? '/guides/GUIDE-ADMIN-ATOM.pdf' : '/guides/GUIDE-ADMIN.pdf'))

// Personnes « en tournée » : un point GPS envoyé dans les 10 dernières minutes
// (l'app mobile émet un point toutes les 1 à 2 min pendant une tournée).
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

const userInitials = computed(() => {
  const nom = authStore.profile?.nom || authStore.profile?.email || '?'
  return nom.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2)
})

// Pas d'entrée « Mon profil » : il n'existe pas d'écran de profil.
const userMenuItems = [
  [{
    label: 'Application mobile',
    icon: 'i-heroicons-device-phone-mobile',
    click: () => navigateTo('/mobile'),
  }, {
    label: 'Changer mon mot de passe',
    icon: 'i-heroicons-key',
    click: () => navigateTo('/mon-mot-de-passe'),
  }],
  [{
    label: 'Se déconnecter',
    icon: 'i-heroicons-arrow-right-on-rectangle',
    click: () => {
      authStore.logout()
      navigateTo('/login')
    },
  }],
]

// Accès refusé : middleware/admin.ts renvoie ici avec le nom de l'écran.
function annoncerRefus() {
  const ecran = route.query.acces_refuse
  if (typeof ecran !== 'string' || !ecran) return
  toast.add({
    title: `Vous n'avez pas accès à « ${ecran} »`,
    description: 'Demandez à un administrateur si vous en avez besoin.',
    icon: 'i-heroicons-lock-closed',
    color: 'amber',
  })
  const { acces_refuse: _retire, ...reste } = route.query
  router.replace({ query: reste })
}
watch(() => route.query.acces_refuse, annoncerRefus)

watch(mobileSidebarOpen, (opened) => {
  if (opened) sidebarCollapsed.value = false
})

onMounted(() => {
  annoncerRefus()
  fetchCommerciauxEnTournee()
  presenceTimer = setInterval(fetchCommerciauxEnTournee, 60_000)
})

onBeforeUnmount(() => {
  if (presenceTimer) clearInterval(presenceTimer)
})
</script>
