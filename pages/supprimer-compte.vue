<template>
  <div class="min-h-screen bg-gray-50 px-6 py-12 dark:bg-gray-900">
    <main class="mx-auto max-w-2xl">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Supprimer mon compte — Bonnet Rouge</h1>
      <p class="mt-1 text-sm text-gray-400">Demande de suppression du compte et des données associées</p>

      <div class="mt-8 space-y-6 text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">
        <p>
          Vous pouvez demander la suppression de votre compte <strong>Bonnet Rouge</strong> et des données
          personnelles qui lui sont rattachées. Les comptes étant créés par l'administrateur de votre
          organisation, la demande lui est transmise et traitée sous <strong>30 jours</strong>.
        </p>

        <section>
          <h2 class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Ce qui est supprimé</h2>
          <ul class="list-disc space-y-1 pl-5">
            <li>Votre compte de connexion (e-mail, mot de passe) et votre profil (nom, téléphone, rôle, périmètre).</li>
            <li>Les positions GPS de vos tournées.</li>
            <li>Le rattachement de vos visites à votre identité.</li>
          </ul>
          <p class="mt-2">
            Les relevés de visite (stocks, visibilité, photos de points de vente) sont des données
            professionnelles appartenant à l'organisation cliente : ils sont conservés de façon anonymisée,
            sans lien avec votre compte.
          </p>
        </section>

        <section v-if="!sent" class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Formulaire de demande</h2>
          <form class="space-y-4" @submit.prevent="submit">
            <UFormGroup label="Adresse e-mail du compte" required>
              <UInput v-model="email" type="email" autocomplete="email" placeholder="prenom.nom@exemple.com" :disabled="!!user" />
            </UFormGroup>
            <UFormGroup label="Motif (facultatif)">
              <UTextarea v-model="reason" :rows="3" placeholder="Départ de l'entreprise, changement de poste…" />
            </UFormGroup>
            <UCheckbox
              v-model="confirm"
              label="Je comprends que cette demande entraîne la suppression définitive de mon compte et que je ne pourrai plus me connecter."
            />
            <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
            <div class="flex items-center justify-end gap-3 pt-2">
              <UButton color="red" icon="i-heroicons-trash" :loading="sending" :disabled="!confirm || !email" type="submit">
                Envoyer la demande
              </UButton>
            </div>
          </form>
        </section>

        <section v-else class="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-800 dark:bg-emerald-950/30">
          <h2 class="mb-2 text-lg font-semibold text-emerald-800 dark:text-emerald-200">Demande enregistrée</h2>
          <p class="text-emerald-900 dark:text-emerald-100">
            Votre demande a été transmise à l'administrateur. Si l'adresse <strong>{{ email }}</strong> correspond
            à un compte, il sera supprimé sous 30 jours. Vous pouvez aussi écrire à
            <a href="mailto:jeanluc@bigfiveabidjan.com" class="underline">jeanluc@bigfiveabidjan.com</a>
            pour toute question.
          </p>
        </section>

        <section>
          <h2 class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Autre moyen</h2>
          <p>
            Vous pouvez également adresser votre demande par e-mail à
            <a href="mailto:jeanluc@bigfiveabidjan.com?subject=Suppression%20de%20mon%20compte%20Bonnet%20Rouge" class="text-fc-red underline">jeanluc@bigfiveabidjan.com</a>,
            en précisant l'adresse e-mail de votre compte.
          </p>
        </section>
      </div>

      <p class="mt-10 flex flex-wrap justify-center gap-x-4 text-center text-xs text-gray-400">
        <NuxtLink :to="user ? '/mobile/more' : '/login'" class="underline">← Retour</NuxtLink>
        <NuxtLink to="/privacy-policy" class="underline">Politique de confidentialité</NuxtLink>
      </p>
    </main>
  </div>
</template>

<script setup lang="ts">
// Page publique (exigence Google Play : lien de suppression de compte
// accessible hors connexion). Pas de middleware d'authentification ; si
// l'utilisateur est connecté, son e-mail est prérempli et son compte ciblé.
definePageMeta({ layout: false })
useHead({ title: 'Supprimer mon compte — Bonnet Rouge' })

const user = useSupabaseUser()
const email = ref(user.value?.email || '')
const reason = ref('')
const confirm = ref(false)
const sending = ref(false)
const sent = ref(false)
const error = ref('')

watch(user, (u) => { if (u?.email) email.value = u.email }, { immediate: true })

async function submit() {
  error.value = ''
  sending.value = true
  try {
    await $fetch('/api/account/deletion-request', {
      method: 'POST',
      body: { email: email.value.trim(), reason: reason.value, confirm: confirm.value },
    })
    sent.value = true
  }
  catch (err: any) {
    error.value = err?.data?.statusMessage || err?.data?.message || err?.message || 'Envoi impossible, réessayez.'
  }
  finally {
    sending.value = false
  }
}
</script>
