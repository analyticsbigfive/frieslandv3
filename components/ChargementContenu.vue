<template>
  <!-- Indicateur de chargement partagé : remplace l'état vide (« Aucun … »)
       tant que les données ne sont pas arrivées. Squelettes à reflet animé +
       libellé annoncé aux lecteurs d'écran. -->
  <div role="status" aria-live="polite" :aria-busy="true" class="chargement-contenu">
    <!-- Barre fine sous un champ : libellé discret + progression indéterminée. -->
    <template v-if="variante === 'barre'">
      <div class="h-1 overflow-hidden rounded-full bg-brand-50 dark:bg-brand-950/40" aria-hidden="true">
        <div class="cc-barre h-full w-1/3 rounded-full bg-brand-500" />
      </div>
      <p class="mt-1.5 text-xs text-slate-600 dark:text-slate-300">{{ texte }}</p>
    </template>

    <p
      v-else
      class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
      :class="variante === 'compact' ? '' : 'mb-3'"
    >
      <UIcon name="i-heroicons-arrow-path" class="h-4 w-4 shrink-0 animate-spin text-slate-500 motion-reduce:animate-none dark:text-slate-400" aria-hidden="true" />
      <span>{{ texte }}</span>
    </p>

    <template v-if="variante === 'cartes'">
      <div class="space-y-3" aria-hidden="true">
        <div
          v-for="i in nombre"
          :key="i"
          class="overflow-hidden p-4"
          :class="classeCarte || 'admin-surface'"
        >
          <div class="flex items-center gap-3">
            <div class="cc-bloc h-10 w-10 shrink-0 rounded-full" />
            <div class="flex-1 space-y-2">
              <div class="cc-bloc h-4 rounded" :style="{ width: `${largeur(i, 45, 30)}%` }" />
              <div class="cc-bloc h-3 rounded" :style="{ width: `${largeur(i, 25, 20)}%` }" />
            </div>
            <div class="cc-bloc hidden h-8 w-28 rounded-md sm:block" />
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="variante === 'lignes'">
      <div class="space-y-2" aria-hidden="true">
        <div v-for="i in nombre" :key="i" class="flex items-center gap-3 px-1 py-1.5">
          <div class="cc-bloc h-7 w-7 shrink-0 rounded-full" />
          <div class="flex-1 space-y-1.5">
            <div class="cc-bloc h-3.5 rounded" :style="{ width: `${largeur(i, 55, 35)}%` }" />
            <div class="cc-bloc h-2.5 rounded" :style="{ width: `${largeur(i, 30, 20)}%` }" />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  /** Ce qui se charge, ex. « Chargement des tournées… ». */
  libelle?: string
  /** cartes : blocs de liste ; lignes : liste compacte ; compact : libellé seul ; barre : fine barre sous un champ. */
  variante?: 'cartes' | 'lignes' | 'compact' | 'barre'
  nombre?: number
  /** Éléments déjà reçus : affiché à la suite du libellé. */
  progression?: number | null
  /** Unité de la progression, ex. « PDV ». */
  unite?: string
  /** Classe des cartes (ex. mobile-card) pour coller au style de l'écran ; par défaut, la carte plate du back-office (admin-surface). */
  classeCarte?: string
}>(), {
  libelle: 'Chargement…',
  variante: 'cartes',
  nombre: 4,
  progression: null,
  unite: 'éléments',
  classeCarte: '',
})

const texte = computed(() => props.progression
  ? `${props.libelle} ${props.progression.toLocaleString('fr-FR')} ${props.unite} reçus`
  : props.libelle)

// Largeurs variées mais stables d'un rendu à l'autre (pas de Math.random :
// le rendu serveur et le client doivent coïncider).
function largeur(i: number, base: number, amplitude: number) {
  return base + ((i * 37) % amplitude)
}
</script>

<style scoped>
.cc-bloc {
  position: relative;
  overflow: hidden;
  background-color: rgb(241 245 249); /* slate-100 */
}
:global(.dark) .cc-bloc {
  background-color: rgb(51 65 85 / 0.6); /* slate-700 */
}
.cc-bloc::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / 0.6), transparent);
  animation: cc-reflet 1.4s ease-in-out infinite;
}
:global(.dark) .cc-bloc::after {
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / 0.08), transparent);
}
@keyframes cc-reflet {
  100% { transform: translateX(100%); }
}
.cc-barre {
  animation: cc-barre 1.3s ease-in-out infinite;
}
@keyframes cc-barre {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(300%); }
}
@media (prefers-reduced-motion: reduce) {
  .cc-bloc::after { animation: none; }
  .cc-barre { animation: none; width: 100%; opacity: 0.5; }
}
</style>
