<template>
  <div />
</template>

<script setup lang="ts">
import { homePathForRole } from '~/utils/roles'
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

  return navigateTo(homePathForRole(authStore.profile?.role))
}

// Redirect based on auth & role
watchEffect(() => {
  void redirectUser()
})
</script>
