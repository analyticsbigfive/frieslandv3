<template>
  <!-- Seul h1 de la page (le layout affiche un fil d'Ariane, pas de titre).
       Sans `title`, le titre vient de l'onglet courant (utils/adminNavigation.ts) ;
       sans `description`, la phrase d'aide de l'onglet quand il en a une. -->
  <header class="admin-page-header">
    <div class="min-w-0">
      <h1 class="admin-page-header__title">{{ title || titreCourant }}</h1>
      <p v-if="texteAide" class="admin-page-header__description">{{ texteAide }}</p>
      <slot name="description" />
    </div>
    <div v-if="$slots.actions" class="admin-page-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
const props = defineProps<{
  title?: string
  description?: string
}>()

const { titreCourant, courant } = useAdminNavigation()
const texteAide = computed(() => props.description ?? courant.value?.tab?.aide ?? '')
</script>
