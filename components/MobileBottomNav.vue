<template>
  <nav class="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 safe-area-bottom">
    <div class="flex items-center justify-around py-1">
      <NuxtLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="flex flex-col items-center py-2 px-3 min-w-[64px] transition-colors"
        :class="isActive(item.to)
          ? 'text-fc-red border-t-2 border-fc-red -mt-[2px]'
          : 'text-gray-400 dark:text-gray-500 dark:text-gray-400'"
      >
        <component :is="item.icon" class="w-5 h-5" />
        <span class="text-[10px] mt-0.5 font-medium">{{ item.label }}</span>
      </NuxtLink>
    </div>
  </nav>
</template>

<script setup lang="ts">
import {
  ClipboardList,
  MapPin,
  Users,
  Route,
  Map,
} from 'lucide-vue-next'

const route = useRoute()

function isActive(path: string) {
  if (path === '/mobile') return route.path === '/mobile'
  return route.path.startsWith(path)
}

const navItems = [
  { label: 'Visites', to: '/mobile', icon: ClipboardList },
  { label: 'PDV', to: '/mobile/pdv', icon: MapPin },
  { label: 'Contacts', to: '/mobile/contacts', icon: Users },
  { label: 'Routing', to: '/mobile/routing', icon: Route },
  { label: 'Map', to: '/mobile/map', icon: Map },
]
</script>
