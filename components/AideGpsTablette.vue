<template>
  <section class="space-y-5" :aria-labelledby="idTitre">
    <div class="flex items-start gap-3">
      <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-fc-red dark:bg-red-950/40 dark:text-red-200">
        <UIcon :name="icone" class="h-7 w-7" aria-hidden="true" />
      </span>
      <div class="min-w-0">
        <p v-if="avecBoutons" class="text-xs font-semibold uppercase tracking-[0.12em] text-fc-red">{{ TEXTES_GPS.titreBloque }}</p>
        <h2 :id="idTitre" class="mt-0.5 text-xl font-bold leading-snug text-gray-900 dark:text-gray-100">{{ bloc.titre }}</h2>
        <p class="mt-1 text-base text-gray-600 dark:text-gray-300">{{ bloc.explication }}</p>
        <p v-if="lignePrecision" class="mt-2 text-sm font-medium text-amber-700 dark:text-amber-300">{{ lignePrecision }}</p>
      </div>
    </div>

    <ol class="space-y-3">
      <li
        v-for="(etape, i) in etapes"
        :key="i"
        class="flex items-start gap-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
      >
        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fc-red text-lg font-bold text-white" aria-hidden="true">{{ i + 1 }}</span>
        <div class="min-w-0 pt-1.5">
          <p class="text-lg font-semibold leading-snug text-gray-900 dark:text-gray-100">{{ etape.texte }}</p>
          <p v-if="etape.detail" class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ etape.detail }}</p>
        </div>
      </li>
    </ol>

    <p class="text-sm text-gray-500 dark:text-gray-400">{{ TEXTES_GPS.noteMenus }}</p>

    <div v-if="avecBoutons" class="flex flex-col gap-3 sm:flex-row-reverse">
      <UButton size="xl" color="red" block icon="i-heroicons-arrow-path" class="justify-center" @click="emit('reessayer')">
        {{ TEXTES_GPS.reessayer }}
      </UButton>
      <UButton size="xl" color="gray" variant="ghost" block class="justify-center" @click="emit('fermer')">
        {{ TEXTES_GPS.fermer }}
      </UButton>
    </div>
  </section>
</template>

<script setup lang="ts">
// Écran d'aide GPS pour la Galaxy Tab A11 : seulement le cas qui correspond
// à l'erreur (A localisation coupée, B autorisation, C lent ou imprécis),
// en grosses étapes numérotées. Textes : utils/aideGpsTablette.ts.
import { CAS_AIDE_GPS, ETAPES_AIDE_GPS, ETAPES_AIDE_GPS_CHROME, TEXTES_GPS, casAideGps, type CasAideGps } from '~/utils/aideGpsTablette'
import type { CauseBlocageGps } from '~/utils/gpsVisite'

const props = withDefaults(defineProps<{
  /** Cause du blocage ; ou `cas` pour afficher un cas sans erreur (menu « Plus »). */
  cause?: CauseBlocageGps | null
  cas?: CasAideGps | null
  /** Meilleure précision obtenue pendant la recherche. */
  precision?: number | null
  /** Précision demandée (Paramètres terrain). */
  max?: number | null
  avecBoutons?: boolean
}>(), { cause: null, cas: null, precision: null, max: null, avecBoutons: true })

const emit = defineEmits<{ (e: 'reessayer'): void, (e: 'fermer'): void }>()

const { estNatif } = usePlateforme()
const idTitre = useId()

const casAffiche = computed<CasAideGps>(() => props.cas || (props.cause ? casAideGps(props.cause) : 'C'))
const bloc = computed(() => CAS_AIDE_GPS[casAffiche.value])
// Dans le navigateur, le site doit aussi être autorisé dans Chrome : ces
// étapes passent avant la dernière (« Revenez… et appuyez sur Réessayer »).
const etapes = computed(() => {
  const base = ETAPES_AIDE_GPS[casAffiche.value]
  if (casAffiche.value !== 'B' || estNatif.value) return base
  return [...base.slice(0, -1), ...ETAPES_AIDE_GPS_CHROME, ...base.slice(-1)]
})
const icone = computed(() => ({ A: 'i-heroicons-map-pin', B: 'i-heroicons-lock-closed', C: 'i-heroicons-signal' } as const)[casAffiche.value])

const lignePrecision = computed(() => {
  if (props.cause === 'approximative') return 'La tablette donne seulement une position approximative.'
  if (casAffiche.value !== 'C' || props.precision == null) return ''
  const demandee = props.max ? ` (${TEXTES_GPS.precisionDemandee(props.max)})` : ''
  return `${TEXTES_GPS.meilleurePrecision(props.precision)}${demandee}.`
})
</script>
