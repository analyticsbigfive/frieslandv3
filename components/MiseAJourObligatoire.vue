<template>
  <!-- Nouvelle version publiée, pas encore obligatoire : bandeau discret. -->
  <div
    v-if="!etat.requise && etat.disponible && etat.url && !masque"
    class="fixed inset-x-3 bottom-24 z-[60] flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-lg dark:border-emerald-800 dark:bg-emerald-950/80"
    role="status"
  >
    <UIcon name="i-heroicons-arrow-down-tray" class="h-6 w-6 shrink-0 text-emerald-600" />
    <p class="flex-1 text-sm text-emerald-900 dark:text-emerald-100">
      Nouvelle version {{ etat.versionDispo || '' }} disponible.
    </p>
    <UButton size="xs" color="emerald" @click="telecharger">Installer</UButton>
    <UButton size="xs" color="gray" variant="ghost" icon="i-heroicons-x-mark" aria-label="Plus tard" @click="masque = true" />
  </div>
  <div
    v-if="etat.requise"
    class="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-white px-6 text-center dark:bg-gray-900"
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="mise-a-jour-titre"
  >
    <div class="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/40">
      <UIcon name="i-heroicons-arrow-down-tray" class="h-10 w-10 text-fc-red" />
    </div>
    <h1 id="mise-a-jour-titre" class="text-xl font-bold text-gray-900 dark:text-gray-100">
      Mise à jour obligatoire
    </h1>
    <p class="mt-2 max-w-sm text-sm text-gray-600 dark:text-gray-300">
      {{ etat.message || 'Une nouvelle version de l’application est disponible. Installez-la pour continuer.' }}
    </p>
    <p class="mt-3 text-xs text-gray-400">
      Version installée : {{ etat.versionInstallee || '?' }}
      <template v-if="etat.versionMin"> · requise : {{ etat.versionMin }} ou plus</template>
    </p>
    <UButton
      v-if="etat.url"
      class="mt-6 bg-fc-red hover:bg-fc-red/90"
      size="lg"
      icon="i-heroicons-arrow-down-tray"
      @click="telecharger"
    >
      Télécharger la mise à jour
    </UButton>
    <p v-else class="mt-6 text-sm text-gray-500 dark:text-gray-400">
      Demandez le lien de la nouvelle version à votre superviseur.
    </p>
  </div>
</template>

<script setup lang="ts">
import type { EtatMiseAJour } from '~/plugins/version-app.client'

const etat = useState<EtatMiseAJour>('mise-a-jour-app', () => ({
  requise: false, url: null, message: null, versionMin: null, versionInstallee: null,
}))

// « Plus tard » : masqué jusqu'au prochain lancement de l'app.
const masque = useState('mise-a-jour-disponible-masquee', () => false)

// _system : ouvre le navigateur du téléphone, qui propose l'installation de l'APK.
function telecharger() {
  if (etat.value.url) window.open(etat.value.url, '_system')
}
</script>
