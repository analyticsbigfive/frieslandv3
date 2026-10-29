<template>
  <div>
    <p v-if="progression.libre" class="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Visite libre</p>
    <div class="flex items-center justify-between text-sm mb-1">
      <span class="text-gray-500 dark:text-gray-400">Progression</span>
      <span class="font-bold tabular-nums" :class="pourcent >= 100 ? 'text-emerald-600' : 'text-fc-red'">
        {{ progression.fait }}/{{ progression.total }}
      </span>
    </div>
    <div class="w-full bg-gray-100 rounded-full h-2.5" role="progressbar" :aria-valuenow="progression.fait" aria-valuemin="0" :aria-valuemax="progression.total">
      <div
        class="h-2.5 rounded-full transition-all duration-500"
        :class="pourcent >= 100 ? 'bg-emerald-500' : 'bg-fc-red'"
        :style="{ width: `${pourcent}%` }"
      />
    </div>
    <!-- Visite libre : le détail par type ; jour normal : les pushcarts à trouver. -->
    <p v-if="detail" class="mt-2 text-xs text-gray-600 dark:text-gray-300">{{ detail }}</p>
    <p v-if="progression.libre" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
      Pas de point de visite aujourd'hui : visitez les PDV de votre liste. Un PDV déjà visité ce mois-ci ne compte pas.
    </p>
  </div>
</template>

<script setup lang="ts">
// Progression du jour de « Mon routing » (1.0.17) : visite libre 3/20 avec le
// détail par type, jour normal x/20 avec les pushcarts à trouver
// (utils/visiteLibre.ts, progressionDuJour).
import { bilanVisiteLibre, texteBilanVisiteLibre, type ProgressionJour } from '~/utils/visiteLibre'

const props = defineProps<{ progression: ProgressionJour }>()

const pourcent = computed(() =>
  props.progression.total > 0 ? Math.min(100, Math.round((props.progression.fait / props.progression.total) * 100)) : 0,
)

const detail = computed(() => {
  const o = props.progression.objectifs
  if (!o) return ''
  if (props.progression.libre) return texteBilanVisiteLibre(o)
  const pushcarts = bilanVisiteLibre(o).find(l => l.canal === 'Pushcart')
  return pushcarts ? `Pushcarts ${pushcarts.fait}/${pushcarts.quota} trouvés` : texteBilanVisiteLibre(o)
})
</script>
