<template>
  <aside
    class="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200/80 bg-[#fbfcf8] shadow-[18px_0_48px_-44px_rgba(23,32,24,0.85)] transition-transform duration-300 dark:border-slate-700 dark:bg-slate-900 lg:translate-x-0"
    :class="[
      mobileOpen ? 'translate-x-0' : '-translate-x-full',
      collapsed ? 'lg:w-16' : 'lg:w-64',
    ]"
  >
    <!-- Logo -->
    <div class="h-20 flex items-center justify-center border-b border-slate-200/80 px-4 dark:border-gray-700">
      <div v-if="!collapsed" class="flex items-center gap-3">
        <div class="flex h-11 w-11 items-center justify-center rounded-xl border border-red-100 bg-white shadow-[0_12px_28px_-24px_rgba(200,16,46,0.9)]">
          <img src="~/assets/logo.png" alt="Friesland" class="h-8 w-8 rounded-lg object-contain" />
        </div>
        <div>
          <h2 class="text-sm font-bold leading-none text-slate-950 dark:text-white">Friesland</h2>
          <p class="mt-1 text-[10px] font-semibold uppercase tracking-normal text-fc-red">Bonnet Rouge</p>
        </div>
      </div>
      <img v-else src="~/assets/logo.png" alt="FC" class="w-8 h-8 rounded-lg object-contain" />
    </div>

    <!-- Navigation -->
    <nav class="flex-1 overflow-y-auto px-2.5 py-4">
      <div
        v-for="section in visibleSections"
        :key="section.title"
        :class="section.items.length > 1 ? 'mb-4' : 'mb-0.5'"
      >
        <!-- Libellé de groupe statique : uniquement pour les groupes de 2+ liens
             (menu déployé). Les sections mono-item n'ont plus de titre : le lien
             se suffit à lui-même. -->
        <p
          v-if="!collapsed && section.items.length > 1"
          class="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-normal text-slate-400 dark:text-slate-500"
        >
          {{ section.title }}
        </p>

        <NuxtLink
          v-for="item in section.items"
          :key="item.to"
          :to="item.to"
          class="group relative mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200"
          :class="isActive(item.to, item.activePaths)
            ? 'bg-white text-fc-red font-semibold shadow-[0_12px_30px_-26px_rgba(200,16,46,0.9)] ring-1 ring-red-100 dark:bg-red-950/30 dark:ring-red-900/40'
            : 'text-slate-600 hover:bg-white/80 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'"
          @click="$emit('navigate')"
        >
          <span
            v-if="isActive(item.to, item.activePaths)"
            class="absolute inset-y-2 left-0 w-1 rounded-r-full bg-fc-red"
            aria-hidden="true"
          />
          <component :is="item.icon" class="h-5 w-5 flex-shrink-0" :class="isActive(item.to, item.activePaths) ? 'text-fc-red' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'" />
          <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
          <span
            v-if="item.badge && !collapsed"
            class="ml-auto rounded-md bg-fc-red px-2 py-0.5 text-xs text-white"
          >
            {{ item.badge }}
          </span>
        </NuxtLink>
      </div>
    </nav>

    <!-- Collapse toggle -->
    <div class="hidden border-t border-slate-200/80 p-2 dark:border-gray-700 lg:block">
      <button
        type="button"
        :aria-label="collapsed ? 'Déployer le menu' : 'Réduire le menu'"
        class="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-gray-400 transition-colors hover:bg-white hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
        @click="$emit('toggle')"
      >
        <svg
          class="w-5 h-5 transition-transform"
          :class="collapsed ? 'rotate-180' : ''"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
        </svg>
        <span v-if="!collapsed" class="text-sm">Réduire</span>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import {
  LayoutDashboard,
  MapPin,
  ClipboardList,
  Package,
  Map,
  Eye,
  Swords,
  Zap,
  Route,
  Navigation,
  SlidersHorizontal,
  Trophy,
} from 'lucide-vue-next'

defineProps<{ collapsed: boolean; mobileOpen?: boolean }>()
defineEmits(['toggle', 'navigate'])

const route = useRoute()

type AdminNavItem = {
  label: string
  to: string
  icon: any
  badge?: string | number
  activePaths?: string[]
}

function isActive(path: string, activePaths: string[] = []): boolean {
  const targetPath = path.split('?')[0]
  if (targetPath === '/admin') return route.path === '/admin'
  return route.path.startsWith(targetPath) || activePaths.some(activePath => route.path.startsWith(activePath))
}

const navSections: Array<{ key: string; title: string; items: AdminNavItem[] }> = [
  {
    key: 'principal',
    title: 'Principal',
    items: [
      { label: 'Perfect Store', to: '/admin', icon: Trophy },
      { label: 'Activité', to: '/admin/activite', icon: LayoutDashboard },
      { label: 'Routing & Planning', to: '/admin/routing', icon: Route },
      { label: 'Carte', to: '/admin/map', icon: Map },
      { label: 'Suivi commerciaux', to: '/admin/trajets', icon: Navigation },
    ],
  },
  {
    key: 'pdv',
    title: 'PDV',
    items: [
      { label: 'Points de vente', to: '/admin/pdv', icon: MapPin },
    ],
  },
  {
    key: 'visites',
    title: 'Visites',
    items: [
      { label: 'Visites', to: '/admin/visites', icon: ClipboardList },
    ],
  },
  {
    key: 'visibilite',
    title: 'Visibilité',
    items: [
      { label: 'Visibilité extérieure', to: '/admin/visibilite', icon: Eye },
    ],
  },
  {
    key: 'concurrence',
    title: 'Concurrence',
    items: [
      { label: 'Concurrence', to: '/admin/concurrence', icon: Swords },
    ],
  },
  {
    key: 'produits',
    title: 'Produits',
    items: [
      { label: 'Produits', to: '/admin/produits/recap', icon: Package },
    ],
  },
  {
    key: 'actions',
    title: 'Actions',
    items: [
      { label: 'Actions', to: '/admin/actions', icon: Zap },
    ],
  },
  {
    key: 'parametres',
    title: 'Paramètres',
    items: [
      {
        label: 'Paramètres',
        to: '/admin/referentiels',
        icon: SlidersHorizontal,
        activePaths: [
          '/admin/perfect-store/standards',
          '/admin/produits/seuils',
          '/admin/referentiels',
          '/admin/users',
          '/admin/permissions',
          '/admin/import-export',
        ],
      },
    ],
  },
]

// RBAC: ne montrer que les sections autorisées pour le rôle courant.
// Avant montage (SSR + 1er rendu client) on affiche tout pour éviter un
// mismatch d'hydratation ; le filtrage s'applique une fois le profil chargé.
const { fetchAccess, canAccessSection } = useAccessControl()
const mounted = ref(false)
const visibleSections = computed(() =>
  mounted.value ? navSections.filter(s => canAccessSection(s.key)) : navSections
)

onMounted(async () => {
  await fetchAccess()
  mounted.value = true
})
</script>
