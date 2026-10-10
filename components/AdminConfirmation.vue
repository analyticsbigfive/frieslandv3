<template>
  <!-- Confirmation nommée (DESIGN.md, « Named Confirmation ») : le titre nomme
       l'élément, le texte dit la conséquence, le bouton répète le verbe. Le
       focus arrive sur « Annuler », premier bouton de la fenêtre. -->
  <UModal
    :model-value="ouvert"
    :prevent-close="enCours"
    :ui="{ width: 'w-full sm:max-w-lg', rounded: 'rounded-lg' }"
    @update:model-value="(v: boolean) => { if (!v) emit('annuler') }"
  >
    <div class="p-5 sm:p-6">
      <div class="flex items-start gap-3.5">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
          :class="destructif ? PASTILLE_ALERTE : PASTILLE_NEUTRE"
          aria-hidden="true"
        >
          <UIcon :name="icone || (destructif ? 'i-heroicons-exclamation-triangle' : 'i-heroicons-question-mark-circle')" class="h-5 w-5" />
        </div>
        <div class="min-w-0">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">{{ typo(titre) }}</h2>
          <p v-if="message" class="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600 dark:text-slate-300">{{ typo(message) }}</p>
          <slot />
        </div>
      </div>
      <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <UButton color="white" :disabled="enCours" class="justify-center" @click="emit('annuler')">{{ libelleRetour }}</UButton>
        <UButton color="primary" :loading="enCours" class="justify-center" @click="emit('confirmer')">{{ libelleAction }}</UButton>
      </div>
    </div>
  </UModal>
</template>

<script setup lang="ts">
// Pastille d'icône : voile d'erreur pour une suppression, slate sinon.
const PASTILLE_ALERTE = 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
const PASTILLE_NEUTRE = 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'

// Espaces insécables du français : « nom » ne se coupe pas après le guillemet,
// le « ? » ne part pas seul à la ligne.
const typo = (t: string) => t.replace(/« /g, '«\u00A0').replace(/ »/g, '\u00A0»').replace(/ ([?!:;])/g, '\u00A0$1')

withDefaults(defineProps<{
  ouvert: boolean
  titre: string
  message?: string
  libelleAction: string
  /** Bouton secondaire ; à changer quand le verbe de l'action est déjà « Annuler ». */
  libelleRetour?: string
  enCours?: boolean
  /** Suppression, retrait : pastille d'alerte. Sinon (appliquer, recalculer) : pastille neutre. */
  destructif?: boolean
  icone?: string
}>(), {
  message: '',
  libelleRetour: 'Annuler',
  enCours: false,
  destructif: true,
  icone: '',
})

const emit = defineEmits<{
  (e: 'confirmer'): void
  (e: 'annuler'): void
}>()
</script>
