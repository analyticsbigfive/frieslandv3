<template>
  <nav
    class="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/95 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 safe-area-bottom"
    aria-label="Navigation mobile principale"
  >
    <div class="grid px-1 pt-1" :class="navItems.length === 3 ? 'grid-cols-3' : navItems.length === 5 ? 'grid-cols-5' : 'grid-cols-4'">
      <NuxtLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="touch-target flex flex-col items-center justify-center rounded-xl px-1 py-2 text-center transition-colors"
        :aria-current="isActive(item.to) ? 'page' : undefined"
        :aria-label="item.ariaLabel"
        :class="isActive(item.to)
          ? 'bg-red-50 text-fc-red dark:bg-red-950/40 dark:text-red-200'
          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'"
      >
        <span class="relative">
          <component :is="icons[item.key]" class="h-5 w-5" aria-hidden="true" />
          <span
            v-if="badgeDe(item.key)"
            class="absolute -right-2 -top-1.5 min-w-4 rounded-full bg-fc-red px-1 text-[10px] font-bold leading-4 text-white"
          >{{ badgeDe(item.key)! > 9 ? '9+' : badgeDe(item.key) }}</span>
        </span>
        <span class="mt-0.5 text-[11px] font-semibold leading-tight">{{ item.label }}</span>
      </NuxtLink>
    </div>
  </nav>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import {
  ClipboardList,
  Route,
  MapPin,
  MoreHorizontal,
  Users,
  ClipboardCheck,
  GraduationCap,
} from 'lucide-vue-next'

import { mobileNavItems, type MobileNavItem } from '~/utils/roles'

const route = useRoute()
const authStore = useAuthStore()

function isActive(path: string) {
  if (path === '/mobile') return route.path === '/mobile'
  return route.path.startsWith(path)
}

const icons: Record<MobileNavItem['key'], Component> = {
  visites: ClipboardList,
  routing: Route,
  pdv: MapPin,
  equipe: Users,
  actions: ClipboardCheck,
  coaching: GraduationCap,
  more: MoreHorizontal,
}

// Onglets selon le rôle (utils/roles.ts) : le commercial n'a pas de Routing.
const navItems = computed(() => mobileNavItems(authStore.profile?.role))

// Actions ouvertes qui me sont assignées. Le compteur est alimenté par
// layouts/mobile.vue (chargement + Realtime) ; on ne fait qu'afficher.
// L'onglet porteur dépend du rôle : le commercial a « Actions » dans sa barre,
// le merchandiseur passe par « Plus » — le badge suit le chemin réel.
const { actionsOuvertes } = useActionsCommerciales()
const ongletPorteur = computed<MobileNavItem['key']>(() =>
  navItems.value.some(i => i.key === 'actions') ? 'actions' : 'more',
)
function badgeDe(key: MobileNavItem['key']): number | null {
  return key === ongletPorteur.value && actionsOuvertes.value > 0 ? actionsOuvertes.value : null
}
</script>
