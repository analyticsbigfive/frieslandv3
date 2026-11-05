<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <ClientOnly>
    <LocationDisclosureModal />
    <GpsVisiteOverlay />
    <MiseAJourObligatoire />
  </ClientOnly>
  <!-- Conteneur des messages (useToast), pour toutes les pages. Il n'était
       monté que dans le layout admin : dans l'app mobile, aucun message
       (« Zone et région requises », « Position obligatoire »…) ne s'affichait.
       Mobile : en haut, sous la barre d'état, pour ne pas passer sous la barre
       de navigation du bas. -->
  <UNotifications :ui="uiNotifications" />
</template>

<script setup lang="ts">
const route = useRoute()
const uiNotifications = computed(() => route.path.startsWith('/mobile')
  ? { position: 'top-0 bottom-auto end-0', container: 'px-4 pb-6 pt-[calc(env(safe-area-inset-top,0px)_+_0.75rem)] space-y-3 overflow-y-auto' }
  : {})

useHead({
  title: 'Friesland Bonnet Rouge',
  htmlAttrs: { lang: 'fr' },
})
</script>
