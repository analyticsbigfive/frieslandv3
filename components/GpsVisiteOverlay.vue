<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-[70] overflow-y-auto bg-white/95 backdrop-blur-sm dark:bg-gray-900/95"
    role="dialog"
    aria-modal="true"
    :aria-label="etat.phase === 'recherche' ? TEXTES_GPS.recherche : TEXTES_GPS.titreBloque"
  >
    <div class="mx-auto flex min-h-full max-w-xl flex-col justify-center px-4 py-8">
      <div v-if="etat.phase === 'recherche'" class="space-y-4 text-center" role="status" aria-live="polite">
        <UIcon name="i-heroicons-map-pin" class="mx-auto h-14 w-14 animate-pulse text-fc-red" aria-hidden="true" />
        <p class="text-xl font-bold text-gray-900 dark:text-gray-100">
          {{ TEXTES_GPS.recherche }}
          <span v-if="etat.precision != null" class="block text-base font-medium text-gray-600 dark:text-gray-300">
            ({{ TEXTES_GPS.precisionActuelle(etat.precision) }}, {{ TEXTES_GPS.precisionDemandee(etat.max) }})
          </span>
        </p>
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ TEXTES_GPS.attente }}</p>
        <UButton color="gray" variant="ghost" @click="fermer">Annuler</UButton>
      </div>

      <AideGpsTablette
        v-else-if="etat.phase === 'aide'"
        :cause="etat.cause"
        :precision="etat.precision"
        :max="etat.max"
        @reessayer="reessayer"
        @fermer="fermer"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// Écran plein de la recherche de position (useGpsVisite), monté une fois dans
// app.vue : au-dessus des fenêtres (création de PDV), sous l'explication de
// la localisation exigée par Google Play, qui passe d'abord.
import { TEXTES_GPS } from '~/utils/aideGpsTablette'

const { etat, cheminDemande, reessayer, fermer } = useGpsVisite()
const { isOpen: explicationOuverte } = useLocationDisclosure()
const visible = computed(() => etat.value.phase !== 'ferme' && !explicationOuverte.value)

// Retour Android ou changement d'écran : la recherche s'arrête, l'écran qui
// l'attendait reçoit « pas de position ».
const route = useRoute()
watch(() => route.fullPath, (chemin) => {
  if (etat.value.phase !== 'ferme' && chemin !== cheminDemande.value) fermer()
})
</script>
