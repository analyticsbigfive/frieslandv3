<template>
  <div class="mobile-page">
    <div class="space-y-5 p-4">
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-fc-red">Position</p>
        <h2 class="mt-1 text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{{ TEXTES_GPS.menuPlus }}</h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">Pas de position, pas de visite. Vérifiez ici que la tablette trouve sa position, avant d'arriver au point de vente.</p>
      </div>

      <UButton size="xl" color="red" block icon="i-heroicons-map-pin" class="justify-center" :loading="verification" @click="verifier">
        {{ TEXTES_GPS.verifier }}
      </UButton>
      <p v-if="trouvee != null" class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-base font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200" role="status">
        {{ TEXTES_GPS.positionTrouvee(trouvee) }}
      </p>

      <div class="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
        <p v-if="modele"><strong>Votre tablette :</strong> {{ modele }}</p>
        <p v-if="type === 'wifi'" class="mt-1 text-amber-700 dark:text-amber-300">{{ TEXTES_GPS.modeleWifi }}</p>
        <p v-else-if="type === 'gps'" class="mt-1">{{ TEXTES_GPS.modeleGps }}</p>
        <p class="mt-1 text-gray-500 dark:text-gray-400">{{ TEXTES_GPS.modeleChemin }}</p>
      </div>

      <div>
        <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Si la position ne vient pas</h3>
        <div class="mt-2 grid grid-cols-3 gap-2" role="group" aria-label="Choisir le cas">
          <button
            v-for="c in (['A', 'B', 'C'] as const)"
            :key="c"
            type="button"
            class="min-h-14 rounded-xl border px-2 py-2 text-sm font-semibold transition active:scale-[0.98]"
            :class="cas === c ? 'border-fc-red bg-red-50 text-fc-red dark:bg-red-950/30 dark:text-red-200' : 'border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200'"
            :aria-pressed="cas === c"
            @click="cas = c"
          >
            {{ LIBELLES_CAS[c] }}
          </button>
        </div>
      </div>

      <AideGpsTablette :cas="cas" :avec-boutons="false" />
    </div>
  </div>
</template>

<script setup lang="ts">
// Aide GPS de la tablette, depuis « Plus » : tester la position et lire les
// réglages de chaque cas (A localisation coupée, B autorisation, C lent).
import { TEXTES_GPS, typeTablette, type CasAideGps } from '~/utils/aideGpsTablette'

definePageMeta({ middleware: ['auth'], layout: 'mobile' })

const LIBELLES_CAS: Record<CasAideGps, string> = { A: 'Localisation coupée', B: 'Autorisation', C: 'Position lente' }

const { exigerPosition } = useGpsVisite()
const { modeleAppareil } = useAppareil()

const cas = ref<CasAideGps>('A')
const verification = ref(false)
const trouvee = ref<number | null>(null)
const modele = ref<string | null>(null)
const type = computed(() => typeTablette(modele.value))

async function verifier() {
  verification.value = true
  trouvee.value = null
  try {
    const position = await exigerPosition()
    if (position) trouvee.value = position.accuracy
  }
  finally {
    verification.value = false
  }
}

onMounted(async () => {
  modele.value = await modeleAppareil()
})
</script>
