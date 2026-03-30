<template>
  <aside
    class="fixed top-0 left-0 z-40 h-screen bg-white border-r border-gray-200 transition-all duration-300 flex flex-col"
    :class="collapsed ? 'w-16' : 'w-64'"
  >
    <!-- Logo -->
    <div class="h-16 flex items-center justify-center border-b border-gray-100 px-4">
      <div v-if="!collapsed" class="flex items-center gap-3">
        <div class="w-8 h-8 bg-fc-blue rounded-lg flex items-center justify-center">
          <span class="text-white font-bold text-sm">FC</span>
        </div>
        <div>
          <h2 class="text-sm font-bold text-fc-blue leading-none">Friesland</h2>
          <p class="text-[10px] text-gray-400 leading-none mt-0.5">Bonnet Rouge</p>
        </div>
      </div>
      <div v-else class="w-8 h-8 bg-fc-blue rounded-lg flex items-center justify-center">
        <span class="text-white font-bold text-sm">FC</span>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 overflow-y-auto py-4 px-2">
      <div v-for="section in navSections" :key="section.title" class="mb-6">
        <p
          v-if="!collapsed"
          class="px-3 mb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider"
        >
          {{ section.title }}
        </p>

        <NuxtLink
          v-for="item in section.items"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm transition-colors group"
          :class="isActive(item.to) 
            ? 'bg-fc-blue-50 text-fc-blue font-medium' 
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'"
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
    </nav>

    <!-- Collapse toggle -->
    <div class="border-t border-gray-100 p-2">
      <button
        class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
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
} from 'lucide-vue-next'

defineProps<{ collapsed: boolean }>()
defineEmits(['toggle'])

const route = useRoute()

function isActive(path: string): boolean {
  if (path === '/admin') return route.path === '/admin'
  return route.path.startsWith(path)
}

const navSections = [
  {
    title: 'Principal',
    items: [
      { label: 'Dashboard', to: '/admin', icon: LayoutDashboard },
    ],
  },
  {
    title: 'PDV',
    items: [
      { label: 'Liste des PDV', to: '/admin/pdv', icon: MapPin },
      { label: 'Répartition', to: '/admin/pdv/repartition', icon: BarChart3 },
      { label: 'Ajouts : Évolution', to: '/admin/pdv/evolution', icon: BarChart3 },
    ],
  },
  {
    title: 'Visites',
    items: [
      { label: 'Visites', to: '/admin/visites', icon: ClipboardList },
      { label: 'Visites : Évolution', to: '/admin/visites/evolution', icon: BarChart3 },
      { label: 'Par catégorie', to: '/admin/visites/categories', icon: ShoppingBag },
    ],
  },
  {
    title: 'Visibilité',
    items: [
      { label: 'Visibilité', to: '/admin/visibilite', icon: Eye },
    ],
  },
  {
    title: 'Concurrence',
    items: [
      { label: 'Concurrence', to: '/admin/concurrence', icon: Swords },
      { label: 'Évolution', to: '/admin/concurrence/evolution', icon: BarChart3 },
    ],
  },
  {
    title: 'Produits',
    items: [
      { label: 'Récapitulatif', to: '/admin/produits', icon: Package },
      { label: 'EVAP', to: '/admin/produits/evap', icon: Package },
      { label: 'IMP', to: '/admin/produits/imp', icon: Package },
      { label: 'SCM', to: '/admin/produits/scm', icon: Package },
      { label: 'UHT', to: '/admin/produits/uht', icon: Package },
      { label: 'YAOURT', to: '/admin/produits/yaourt', icon: Package },
    ],
  },
  {
    title: 'Actions',
    items: [
      { label: 'Résumé', to: '/admin/actions', icon: Zap },
      { label: 'Évolution', to: '/admin/actions/evolution', icon: BarChart3 },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Utilisateurs', to: '/admin/users', icon: Users },
      { label: 'Import / Export', to: '/admin/import-export', icon: Upload },
      { label: 'Carte', to: '/admin/map', icon: Map },
    ],
  },
]
</script>
