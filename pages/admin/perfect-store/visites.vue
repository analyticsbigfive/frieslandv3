<template>
  <div />
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'] })
await navigateTo('/admin/visites', { replace: true })
</script>
