<template>
  <div />
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const authStore = useAuthStore()
const user = useSupabaseUser()

async function redirectUser() {
  if (!user.value) {
    return navigateTo('/login')
  }

  if (!authStore.profile) {
    await authStore.fetchProfile()
  }

  if (authStore.isAdmin || authStore.isSuperviseur) {
    return navigateTo('/admin')
  }

  return navigateTo('/mobile')
}

// Redirect based on auth & role
watchEffect(() => {
  void redirectUser()
})
</script>
