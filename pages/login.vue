<template>
  <div class="min-h-screen flex">
    <!-- Left Panel - Branding -->
    <div class="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-fc-blue to-fc-blue-700 relative overflow-hidden">
      <div class="absolute inset-0 opacity-10">
        <div class="absolute -top-20 -right-20 w-96 h-96 bg-white rounded-full" />
        <div class="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-white rounded-full" />
      </div>
      <div class="relative z-10 flex flex-col items-center justify-center w-full px-12">
        <div class="w-24 h-24 bg-white rounded-2xl flex items-center justify-center mb-8 shadow-xl">
          <span class="text-fc-blue text-3xl font-black">FC</span>
        </div>
        <h1 class="text-4xl font-bold text-white mb-3">Friesland</h1>
        <h2 class="text-xl text-blue-200 mb-6">Bonnet Rouge</h2>
        <p class="text-blue-100 text-center max-w-sm leading-relaxed">
          Application de collecte de données terrain et de pilotage pour FrieslandCampina Côte d'Ivoire.
        </p>
      </div>
    </div>

    <!-- Right Panel - Login Form -->
    <div class="w-full lg:w-1/2 flex items-center justify-center px-6 py-12 bg-gray-50">
      <div class="w-full max-w-md">
        <!-- Mobile logo -->
        <div class="lg:hidden flex flex-col items-center mb-10">
          <div class="w-16 h-16 bg-fc-blue rounded-xl flex items-center justify-center mb-4">
            <span class="text-white text-2xl font-black">FC</span>
          </div>
          <h1 class="text-2xl font-bold text-gray-900">Friesland</h1>
          <p class="text-gray-500 text-sm">Bonnet Rouge</p>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 class="text-2xl font-bold text-gray-900 mb-1">Connexion</h2>
          <p class="text-gray-500 text-sm mb-8">Entrez vos identifiants pour accéder à l'application</p>

          <form @submit.prevent="handleLogin">
            <div class="space-y-5">
              <UFormGroup label="Email" required>
                <UInput
                  v-model="email"
                  type="email"
                  placeholder="nom@entreprise.com"
                  size="lg"
                  icon="i-heroicons-envelope"
                  :disabled="loading"
                />
              </UFormGroup>

              <UFormGroup label="Mot de passe" required>
                <UInput
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="••••••••"
                  size="lg"
                  icon="i-heroicons-lock-closed"
                  :disabled="loading"
                  :ui="{ icon: { trailing: { pointer: '' } } }"
                >
                  <template #trailing>
                    <button
                      type="button"
                      class="text-gray-400 hover:text-gray-600"
                      @click="showPassword = !showPassword"
                    >
                      <UIcon :name="showPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'" class="w-5 h-5" />
                    </button>
                  </template>
                </UInput>
              </UFormGroup>

              <!-- Error Message -->
              <div
                v-if="errorMessage"
                class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2"
              >
                <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-red-500 flex-shrink-0" />
                {{ errorMessage }}
              </div>

              <UButton
                type="submit"
                block
                size="lg"
                :loading="loading"
                class="bg-fc-blue hover:bg-fc-blue-600"
              >
                Se connecter
              </UButton>
            </div>
          </form>
        </div>

        <p class="text-center text-xs text-gray-400 mt-6">
          FrieslandCampina © {{ new Date().getFullYear() }} — Bonnet Rouge
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const authStore = useAuthStore()
const router = useRouter()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const errorMessage = ref('')

// Redirect if already logged in
watch(() => authStore.isAuthenticated, async (isAuth) => {
  if (!isAuth) {
    return
  }

  if (!authStore.profile) {
    await authStore.fetchProfile()
  }

  const redirect = authStore.isAdmin || authStore.isSuperviseur ? '/admin' : '/mobile'
  router.push(redirect)
}, { immediate: true })

async function handleLogin() {
  if (!email.value || !password.value) {
    errorMessage.value = 'Veuillez remplir tous les champs'
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    await authStore.login(email.value, password.value)

    // Récupérer la géolocalisation de l'utilisateur après connexion
    const { initialize: initGeo } = useUserGeolocation()
    initGeo()

    // Wait for profile to load
    await nextTick()
    const redirect = authStore.isAdmin || authStore.isSuperviseur ? '/admin' : '/mobile'
    router.push(redirect)
  }
  catch (err: any) {
    errorMessage.value = authStore.error || 'Erreur de connexion'
  }
  finally {
    loading.value = false
  }
}
</script>
