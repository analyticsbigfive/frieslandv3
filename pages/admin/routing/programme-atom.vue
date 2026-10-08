<template>
  <div />
</template>

<script setup lang="ts">
// Ancienne adresse (« Programme Atom ») : renvoie vers le programme South.
definePageMeta({
  middleware: ['auth', 'admin'],
  layout: 'admin',
  redirect: { path: '/admin/routing/programme-merchandiser', query: { direction: 'south' } },
})
</script>
