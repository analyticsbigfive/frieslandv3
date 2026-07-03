<template>
  <aside
    class="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200/80 bg-white transition-transform duration-300 dark:border-slate-700 dark:bg-slate-900 lg:translate-x-0"
    :class="[
      mobileOpen ? 'translate-x-0' : '-translate-x-full',
      collapsed ? 'lg:w-16' : 'lg:w-64',
    ]"
  >
    <!-- Logo -->
    <div class="h-16 flex items-center justify-center border-b border-gray-100 dark:border-gray-700 px-4">
      <div v-if="!collapsed" class="flex items-center gap-3">
        <img src="~/assets/logo.png" alt="Friesland" class="w-8 h-8 rounded-lg object-contain" />
        <div>
          <h2 class="text-sm font-bold text-fc-red leading-none">Friesland</h2>
          <p class="text-[10px] text-gray-400 leading-none mt-0.5">Bonnet Rouge</p>
        </div>
      </div>
      <img v-else src="~/assets/logo.png" alt="FC" class="w-8 h-8 rounded-lg object-contain" />
    </div>

    <!-- Navigation -->
    <nav class="flex-1 overflow-y-auto py-4 px-2">
      <div v-for="section in visibleSections" :key="section.title" class="mb-4">
        <!-- Titre repliable (menu déployé uniquement) -->
        <button
          v-if="!collapsed"
          type="button"
          class="mb-2 flex w-full items-center justify-between rounded-lg px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          :aria-expanded="isExpanded(section.key)"
          @click="toggleSection(section.key)"
        >
          <span>{{ section.title }}</span>
          <svg
            class="h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200"
            :class="isExpanded(section.key) ? 'rotate-90' : ''"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <div v-show="collapsed || isExpanded(section.key)">
          <NuxtLink
            v-for="item in section.items"
            :key="item.to"
            :to="item.to"
            class="group mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200"
            :class="isActive(item.to)
              ? 'bg-red-50 text-fc-red font-semibold dark:bg-red-950/30'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'"
            @click="$emit('navigate')"
          >
            <component :is="item.icon" class="w-5 h-5 flex-shrink-0" />
            <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
            <span
              v-if="item.badge && !collapsed"
              class="ml-auto bg-fc-red text-white text-xs px-2 py-0.5 rounded-full"
            >
              {{ item.badge }}
            </span>
          </NuxtLink>
        </div>
      </div>
    </nav>

    <!-- Collapse toggle -->
    <div class="hidden border-t border-gray-100 p-2 dark:border-gray-700 lg:block">
      <button
        type="button"
        :aria-label="collapsed ? 'Déployer le menu' : 'Réduire le menu'"
        class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
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
  Users,
  Package,
  Upload,
  Map,
  BarChart3,
  Eye,
  Swords,
  Zap,
  ShoppingBag,
  Route,
  Navigation,
  ShieldCheck,
  Boxes,
  SlidersHorizontal,
  Trophy,
  Database,
} from 'lucide-vue-next'

defineProps<{ collapsed: boolean; mobileOpen?: boolean }>()
defineEmits(['toggle', 'navigate'])

const route = useRoute()

function isActive(path: string): boolean {
  if (path === '/admin') return route.path === '/admin'
  // La page Standards vit sous /admin/perfect-store mais appartient aux Paramètres.
  if (path === '/admin/perfect-store') {
    return route.path.startsWith(path) && !route.path.startsWith('/admin/perfect-store/standards')
  }
  return route.path.startsWith(path)
}

const navSections = [
  {
    key: 'principal',
    title: 'Principal',
    items: [
      { label: 'Dashboard', to: '/admin', icon: LayoutDashboard },
      { label: 'Routing & Planning', to: '/admin/routing', icon: Route },
      { label: 'Carte', to: '/admin/map', icon: Map },
      { label: 'Suivi commerciaux', to: '/admin/trajets', icon: Navigation },
    ],
  },
  {
    key: 'pdv',
    title: 'Stats · PDV',
    items: [
      { label: 'Liste des PDV', to: '/admin/pdv', icon: MapPin },
      { label: 'Répartition', to: '/admin/pdv/repartition', icon: BarChart3 },
      { label: 'Ajouts : Évolution', to: '/admin/pdv/evolution', icon: BarChart3 },
    ],
  },
  {
    key: 'visites',
    title: 'Stats · Visites',
    items: [
      { label: 'Visites', to: '/admin/visites', icon: ClipboardList },
      { label: 'Visites : Évolution', to: '/admin/visites/evolution', icon: BarChart3 },
      { label: 'Évolution par catég.', to: '/admin/visites/categories', icon: ShoppingBag },
      { label: 'Perf. commerciaux', to: '/admin/visites/commerciaux', icon: Users },
    ],
  },
  {
    key: 'perfect-store',
    title: 'Stats · Perfect Store',
    items: [
      { label: 'Perfect Store', to: '/admin/perfect-store', icon: Trophy },
    ],
  },
  {
    key: 'visibilite',
    title: 'Stats · Visibilité',
    items: [
      { label: 'Visibilité extérieure', to: '/admin/visibilite', icon: Eye },
      { label: 'Extérieure : Récap.', to: '/admin/visibilite/exterieure-recap', icon: ClipboardList },
      { label: 'Visibilité intérieure', to: '/admin/visibilite/interieure', icon: Eye },
      { label: 'Intérieure : évolution', to: '/admin/visibilite/interieure-evolution', icon: BarChart3 },
      { label: 'Intérieure (GT) : R.', to: '/admin/visibilite/interieure-gt-recap', icon: ClipboardList },
      { label: 'Intérieure (MT) : R.', to: '/admin/visibilite/interieure-mt-recap', icon: ClipboardList },
      { label: 'Promotion : Récap.', to: '/admin/visibilite/promotion-recap', icon: ClipboardList },
    ],
  },
  {
    key: 'concurrence',
    title: 'Stats · Concurrence',
    items: [
      { label: 'Visibilité conc. : év.', to: '/admin/concurrence/visibilite-evolution', icon: Eye },
      { label: 'Visibilité conc. : Ré.', to: '/admin/concurrence/visibilite-recap', icon: ClipboardList },
      { label: 'Concurrence : évol.', to: '/admin/concurrence', icon: Swords },
    ],
  },
  {
    key: 'produits',
    title: 'Stats · Produits',
    items: [
      { label: 'Inventaire SKU', to: '/admin/produits/inventaire', icon: Boxes },
      { label: 'Dispo. EVAP', to: '/admin/produits/evap', icon: Package },
      { label: 'Prix EVAP', to: '/admin/produits/evap?tab=prix', icon: Package },
      { label: 'Récap. EVAP', to: '/admin/produits/evap?tab=recap', icon: ClipboardList },
      { label: 'Dispo. IMP', to: '/admin/produits/imp', icon: Package },
      { label: 'Récap. IMP', to: '/admin/produits/imp?tab=recap', icon: ClipboardList },
      { label: 'Dispo. SCM', to: '/admin/produits/scm', icon: Package },
      { label: 'Récap. SCM', to: '/admin/produits/scm?tab=recap', icon: ClipboardList },
      { label: 'Dispo. UHT', to: '/admin/produits/uht', icon: Package },
      { label: 'Récap. UHT', to: '/admin/produits/uht?tab=recap', icon: ClipboardList },
      { label: 'Dispo. YAOURT', to: '/admin/produits/yaourt', icon: Package },
      { label: 'Récap. YAOURT', to: '/admin/produits/yaourt?tab=recap', icon: ClipboardList },
      { label: 'Dispo. CÉRÉALES', to: '/admin/produits/cereales', icon: Package },
      { label: 'Récap. produit', to: '/admin/produits/recap', icon: ClipboardList },
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
      { label: 'Standards Perfect Store', to: '/admin/perfect-store/standards', icon: SlidersHorizontal },
      { label: 'Seuils stock', to: '/admin/produits/seuils', icon: SlidersHorizontal },
      { label: 'Référentiels', to: '/admin/referentiels', icon: Database },
      { label: 'Utilisateurs', to: '/admin/users', icon: Users },
      { label: 'Permissions', to: '/admin/permissions', icon: ShieldCheck },
      { label: 'Import / Export', to: '/admin/import-export', icon: Upload },
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

// Repliage des sections : seules les 2 premières sont dépliées par défaut.
const expandedSections = ref<Set<string>>(new Set(navSections.slice(0, 2).map(s => s.key)))
function isExpanded(key: string) {
  return expandedSections.value.has(key)
}
function toggleSection(key: string) {
  const next = new Set(expandedSections.value)
  next.has(key) ? next.delete(key) : next.add(key)
  expandedSections.value = next
}

onMounted(async () => {
  await fetchAccess()
  mounted.value = true
})
</script>
