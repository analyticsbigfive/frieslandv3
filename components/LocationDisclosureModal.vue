<template>
  <UModal v-model="isOpen" prevent-close>
    <div class="p-5 space-y-4">
      <div class="flex items-start gap-3">
        <UIcon name="i-heroicons-map-pin" class="mt-0.5 w-7 h-7 shrink-0 text-fc-red" />
        <div>
          <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">Utilisation de votre position</h2>
          <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
            <strong>Bonnet Rouge collecte des données de localisation</strong> pour valider votre présence
            en point de vente lors d'une visite et pour reconstituer votre trajet pendant une tournée,
            <strong>y compris lorsque l'application est fermée ou n'est pas utilisée</strong>
            (uniquement entre « Démarrer » et « Terminer la tournée »).
          </p>
        </div>
      </div>

      <ul class="list-disc space-y-1 pl-5 text-xs text-gray-600 dark:text-gray-400">
        <li>Position utilisée uniquement pour le suivi des visites et des tournées de votre organisation.</li>
        <li>Jamais vendue ni partagée à des fins publicitaires.</li>
        <li>Une notification reste affichée tant que le suivi de tournée est actif.</li>
      </ul>

      <p class="text-xs text-gray-500 dark:text-gray-400">
        Détails dans la
        <NuxtLink to="/privacy-policy" class="text-fc-red underline" @click="decline">politique de confidentialité</NuxtLink>.
      </p>

      <div class="flex justify-end gap-2 pt-1">
        <UButton color="gray" variant="ghost" @click="decline">Refuser</UButton>
        <UButton color="red" @click="accept">Accepter</UButton>
      </div>
    </div>
  </UModal>
</template>

<script setup lang="ts">
// Divulgation bien visible exigée par Google Play avant toute demande de
// permission localisation (voir useLocationDisclosure).
const { isOpen, accept, decline } = useLocationDisclosure()
</script>
