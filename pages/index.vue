<template>
  <div />
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const authStore = useAuthStore()
const user = useSupabaseUser()

// Redirect based on auth & role
watchEffect(() => {
  if (!user.value) {
    navigateTo('/login')
  }
  else if (authStore.isAdmin || authStore.isSuperviseur) {
    navigateTo('/admin')
  }
  else {
    navigateTo('/mobile')
  }
})
</script>
