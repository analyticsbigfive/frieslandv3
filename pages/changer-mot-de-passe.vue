<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
    <div class="w-full max-w-md">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-8">
        <div class="text-center mb-6">
          <UIcon name="i-heroicons-key" class="w-10 h-10 text-fc-red mx-auto mb-3" />
          <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">Nouveau mot de passe requis</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Pour sécuriser votre compte, choisissez un mot de passe personnel avant de continuer.
          </p>
        </div>

        <form class="space-y-4" @submit.prevent="submit">
          <UFormGroup label="Nouveau mot de passe" required>
            <UInput
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              size="lg"
              icon="i-heroicons-lock-closed"
              placeholder="8 caractères minimum"
              :disabled="loading"
              :ui="{ icon: { trailing: { pointer: '' } } }"
            >
              <template #trailing>
                <button
                  type="button"
                  class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  @click="showPassword = !showPassword"
                >
                  <UIcon :name="showPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'" class="w-5 h-5" />
                </button>
              </template>
            </UInput>
          </UFormGroup>

          <UFormGroup label="Confirmer le mot de passe" required>
            <UInput
              v-model="confirmation"
              :type="showPassword ? 'text' : 'password'"
              size="lg"
              icon="i-heroicons-lock-closed"
              placeholder="Retapez le mot de passe"
              :disabled="loading"
            />
          </UFormGroup>

          <div
            v-if="errorMessage"
            class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2"
          >
            <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-red-500 flex-shrink-0" />
            {{ errorMessage }}
          </div>

          <UButton type="submit" block size="lg" :loading="loading" class="bg-fc-red hover:bg-fc-red-600">
            Enregistrer et continuer
          </UButton>

          <UButton block size="sm" variant="ghost" color="gray" :disabled="loading" @click="logout">
            Se déconnecter
          </UButton>
        </form>
      </div>

      <p class="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">
        FrieslandCampina © {{ new Date().getFullYear() }} — Bonnet Rouge
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false, middleware: ['auth'] })

const supabase = useSupabaseClient()
const authStore = useAuthStore()

const password = ref('')
const confirmation = ref('')
const showPassword = ref(false)
const loading = ref(false)
const errorMessage = ref('')

async function submit() {
  errorMessage.value = ''
  if (password.value.length < 8) {
    errorMessage.value = 'Le mot de passe doit contenir au moins 8 caractères.'
    return
  }
  if (password.value !== confirmation.value) {
    errorMessage.value = 'Les deux mots de passe ne correspondent pas.'
    return
  }

  loading.value = true
  try {
    // Change le mot de passe ET lève le flag en un seul appel
    const { error } = await supabase.auth.updateUser({
      password: password.value,
      data: { must_change_password: false },
    })
    if (error) throw error

    // Rafraîchit la session pour que useSupabaseUser reflète le nouveau metadata
    await supabase.auth.refreshSession()

    const dest = authStore.isAdmin || authStore.isSuperviseur ? '/admin' : '/mobile'
    await navigateTo(dest, { replace: true })
  }
  catch (err: any) {
    errorMessage.value = err?.message === 'New password should be different from the old password.'
      ? 'Le nouveau mot de passe doit être différent de l\'ancien.'
      : (err?.message || 'Impossible de changer le mot de passe. Réessayez.')
  }
  finally {
    loading.value = false
  }
}

async function logout() {
  await authStore.logout()
  await navigateTo('/login', { replace: true })
}
</script>
