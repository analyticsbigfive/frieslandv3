<template>
  <div class="mobile-page">
    <div class="p-4">
      <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-fc-red">Autres écrans</p>
      <h2 class="mt-1 text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Retrouver les outils</h2>

      <nav class="mt-5 space-y-2" aria-label="Autres écrans mobiles">
        <NuxtLink
          v-for="item in secondaryItems"
          :key="item.to"
          :to="item.to"
          class="flex min-h-16 items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 transition hover:border-red-100 hover:bg-red-50/40 active:scale-[0.99] dark:border-gray-700 dark:bg-gray-800 dark:hover:border-red-900/50 dark:hover:bg-red-950/20"
        >
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-fc-red dark:bg-red-950/30 dark:text-red-200">
            <UIcon :name="item.icon" class="h-5 w-5" aria-hidden="true" />
          </span>
          <span class="min-w-0 flex-1">
            <strong class="block text-sm font-semibold text-gray-900 dark:text-gray-100">{{ item.label }}</strong>
            <span class="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{{ item.description }}</span>
          </span>
          <UIcon name="i-heroicons-chevron-right" class="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
        </NuxtLink>
      </nav>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth'], layout: 'mobile' })

const secondaryItems = [
  { label: 'Calendrier', description: 'Visites récentes et navigation par mois', to: '/mobile/calendar', icon: 'i-heroicons-calendar-days' },
  { label: 'Contacts', description: 'Annuaire, téléphone et email', to: '/mobile/contacts', icon: 'i-heroicons-users' },
  { label: 'Carte', description: 'Routing, PDV proches et rayon', to: '/mobile/map', icon: 'i-heroicons-map' },
]
</script>
