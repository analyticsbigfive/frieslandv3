<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <ClientOnly>
    <LocationDisclosureModal />
  </ClientOnly>
</template>

<script setup lang="ts">
useHead({
  title: 'Friesland Bonnet Rouge',
  htmlAttrs: { lang: 'fr' },
})
</script>
