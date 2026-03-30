<template>
  <nav class="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-bottom">
    <div class="flex items-center justify-around py-1">
      <NuxtLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="flex flex-col items-center py-2 px-3 min-w-[64px] transition-colors"
        :class="isActive(item.to)
          ? 'text-fc-red border-t-2 border-fc-red -mt-[2px]'
          : 'text-gray-400'"
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
  Calendar,
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
  { label: 'Calendrier', to: '/mobile/calendar', icon: Calendar },
  { label: 'Map', to: '/mobile/map', icon: Map },
]
</script>
