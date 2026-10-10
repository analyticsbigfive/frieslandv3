<template>
  <!-- Échec de chargement d'un bloc : jamais confondu avec un état vide.
       Dit ce qui manque, la cause en clair (messageUtilisateur) et propose de
       recommencer sans recharger toute la page. -->
  <div class="flex items-start gap-3 text-sm" :class="compact ? '' : 'px-5 py-6'" role="alert">
    <UIcon name="i-heroicons-exclamation-triangle" class="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
    <div class="min-w-0">
      <p class="font-semibold text-slate-900 dark:text-white">{{ titre }}</p>
      <p class="mt-0.5 text-slate-600 dark:text-slate-300">{{ message }}</p>
      <UButton
        class="mt-3"
        size="xs"
        color="white"
        icon="i-heroicons-arrow-path"
        :loading="enCours"
        @click="emit('reessayer')"
      >
        Réessayer
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { messageUtilisateur } from '~/utils/supabaseErrors'

const props = withDefaults(defineProps<{
  /** Ce qui n'a pas pu être chargé : « Les points de vente à faire progresser n'ont pas pu être chargés. » */
  titre: string
  /** Erreur brute (Supabase, réseau…) : traduite ici, le détail part dans la console. */
  erreur?: unknown
  enCours?: boolean
  /** Sans marge intérieure : dans une cellule de tableau ou une liste. */
  compact?: boolean
}>(), {
  enCours: false,
  compact: false,
})

const emit = defineEmits<{ (e: 'reessayer'): void }>()

const message = computed(() => messageUtilisateur(props.erreur))
</script>
