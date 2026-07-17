<template>
  <nav
    class="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/95 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 safe-area-bottom"
    aria-label="Navigation mobile principale"
  >
    <div class="grid grid-cols-4 px-1 pt-1">
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
        <component :is="item.icon" class="h-5 w-5" aria-hidden="true" />
        <span class="mt-0.5 text-[11px] font-semibold leading-tight">{{ item.label }}</span>
      </NuxtLink>
    </div>
  </nav>
</template>

<script setup lang="ts">
import {
  ClipboardList,
  Route,
  MapPin,
  MoreHorizontal,
} from 'lucide-vue-next'

const route = useRoute()

function isActive(path: string) {
  if (path === '/mobile') return route.path === '/mobile'
  return route.path.startsWith(path)
}

const navItems = [
  { label: 'Visites', to: '/mobile', icon: ClipboardList, ariaLabel: 'Voir les visites' },
  { label: 'Routing', to: '/mobile/routing', icon: Route, ariaLabel: 'Voir le routing' },
  { label: 'PDV', to: '/mobile/pdv', icon: MapPin, ariaLabel: 'Voir les points de vente' },
  { label: 'Plus', to: '/mobile/more', icon: MoreHorizontal, ariaLabel: 'Voir les autres écrans' },
]
</script>
