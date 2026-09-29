<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <ClientOnly>
    <LocationDisclosureModal />
    <MiseAJourObligatoire />
  </ClientOnly>
</template>

<script setup lang="ts">
useHead({
  title: 'Friesland Bonnet Rouge',
  htmlAttrs: { lang: 'fr' },
})
</script>
