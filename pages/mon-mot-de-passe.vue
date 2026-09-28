<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
    <div class="w-full max-w-md">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-8">
        <div class="text-center mb-6">
          <UIcon :name="termine ? 'i-heroicons-check-badge' : 'i-heroicons-key'" class="w-10 h-10 mx-auto mb-3" :class="termine ? 'text-emerald-500' : 'text-fc-red'" />
          <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">
            {{ termine ? 'Mot de passe modifié' : 'Changer mon mot de passe' }}
          </h1>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {{ termine
              ? 'Utilisez votre nouveau mot de passe à la prochaine connexion.'
              : authStore.profile?.email }}
          </p>
        </div>

        <div v-if="termine" class="space-y-3">
          <UButton block size="lg" class="bg-fc-red hover:bg-fc-red-600" @click="retour">Retour</UButton>
        </div>

        <form v-else class="space-y-4" @submit.prevent="submit">
          <UFormGroup label="Mot de passe actuel" required>
            <UInput
              v-model="actuel"
              :type="showPassword ? 'text' : 'password'"
              size="lg"
              icon="i-heroicons-lock-open"
              autocomplete="current-password"
              :disabled="loading"
            />
          </UFormGroup>

          <UFormGroup label="Nouveau mot de passe" required>
            <UInput
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              size="lg"
              icon="i-heroicons-lock-closed"
              autocomplete="new-password"
              :disabled="loading"
              :ui="{ icon: { trailing: { pointer: '' } } }"
            >
              <template #trailing>
                <button
                  type="button"
                  class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  :aria-label="showPassword ? 'Masquer les mots de passe' : 'Afficher les mots de passe'"
                  @click="showPassword = !showPassword"
                >
                  <UIcon :name="showPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'" class="w-5 h-5" />
                </button>
              </template>
            </UInput>
          </UFormGroup>

          <ul class="space-y-1 text-xs">
            <li
              v-for="r in regles"
              :key="r.libelle"
              class="flex items-center gap-2"
              :class="r.respectee(password) ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'"
            >
              <UIcon :name="r.respectee(password) ? 'i-heroicons-check-circle' : 'i-heroicons-minus-circle'" class="h-4 w-4 shrink-0" />
              {{ r.libelle }}
            </li>
          </ul>

          <UFormGroup label="Confirmer le nouveau mot de passe" required>
            <UInput
              v-model="confirmation"
              :type="showPassword ? 'text' : 'password'"
              size="lg"
              icon="i-heroicons-lock-closed"
              autocomplete="new-password"
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
            Enregistrer
          </UButton>
          <UButton block size="sm" variant="ghost" color="gray" :disabled="loading" @click="retour">
            Annuler
          </UButton>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Changement de mot de passe à l'initiative de l'utilisateur (menu du compte).
// Distinct de /changer-mot-de-passe, réservé au changement imposé par le
// drapeau must_change_password (le middleware global en chasse les autres).
//
// Le mot de passe actuel est revérifié avant tout changement : une session
// restée ouverte sur un poste partagé ne doit pas suffire à s'approprier le
// compte, surtout celui d'un admin.
import { homePathForRole } from '~/utils/roles'
import { erreurMotDePasse, reglesMotDePasse } from '~/utils/motDePasse'

definePageMeta({ layout: false, middleware: ['auth'] })

const supabase = useSupabaseClient()
const authStore = useAuthStore()
const router = useRouter()

const actuel = ref('')
const password = ref('')
const confirmation = ref('')
const showPassword = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const termine = ref(false)
const regles = computed(() => reglesMotDePasse(authStore.profile?.role, authStore.profile?.email))

onMounted(() => { if (!authStore.profile) void authStore.fetchProfile() })

async function submit() {
  errorMessage.value = ''
  if (!authStore.profile) await authStore.fetchProfile()
  const email = authStore.profile?.email
  if (!email) {
    errorMessage.value = 'Session expirée, reconnectez-vous.'
    return
  }
  if (!actuel.value) {
    errorMessage.value = 'Saisissez votre mot de passe actuel.'
    return
  }
  const faiblesse = erreurMotDePasse(password.value, authStore.profile?.role, email)
  if (faiblesse) {
    errorMessage.value = faiblesse
    return
  }
  if (password.value !== confirmation.value) {
    errorMessage.value = 'Les deux mots de passe ne correspondent pas.'
    return
  }
  if (password.value === actuel.value) {
    errorMessage.value = 'Le nouveau mot de passe doit être différent de l\'ancien.'
    return
  }

  loading.value = true
  try {
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password: actuel.value })
    if (authError) {
      errorMessage.value = 'Mot de passe actuel incorrect.'
      return
    }

    const { error } = await supabase.auth.updateUser({
      password: password.value,
      data: { must_change_password: false },
    })
    if (error) throw error

    actuel.value = ''
    password.value = ''
    confirmation.value = ''
    termine.value = true
  }
  catch (err: any) {
    const message = String(err?.message || '')
    errorMessage.value = /different from the old/i.test(message)
      ? 'Le nouveau mot de passe doit être différent de l\'ancien.'
      : /reauthenticat/i.test(message)
        ? 'Confirmation supplémentaire requise par le serveur : déconnectez-vous puis réessayez.'
        : (message || 'Impossible de changer le mot de passe. Réessayez.')
  }
  finally {
    loading.value = false
  }
}

function retour() {
  if (window.history.length > 1) router.back()
  else navigateTo(homePathForRole(authStore.profile?.role), { replace: true })
}
</script>
