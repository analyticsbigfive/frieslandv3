<template>
  <div class="flex flex-wrap items-end gap-x-3 gap-y-2">
    <div>
      <p v-if="label" class="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">{{ label }}</p>
      <div class="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700" role="group" :aria-label="label || 'Période'">
        <button
          v-for="opt in options"
          :key="opt.value"
          type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition"
          :class="model.preset === opt.value
            ? 'bg-fc-red text-white'
            : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'"
          :aria-pressed="model.preset === opt.value"
          @click="choisir(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <!-- Bornes libres : visibles uniquement en mode personnalisé. -->
    <template v-if="model.preset === 'personnalise'">
      <UFormGroup label="Du" size="xs">
        <UInput :model-value="model.debut" type="date" size="xs" @update:model-value="majBorne('debut', $event)" />
      </UFormGroup>
      <UFormGroup label="Au" size="xs">
        <UInput :model-value="model.fin" type="date" size="xs" @update:model-value="majBorne('fin', $event)" />
      </UFormGroup>
    </template>

    <p v-else-if="showResume" class="pb-1 text-xs text-slate-400 dark:text-slate-500">{{ resume }}</p>
  </div>
</template>

<script setup lang="ts">
import { PERIODE_OPTIONS, plageDePeriode, libellePlage, type PeriodePreset } from '~/utils/periode'

export interface PeriodeValue {
  preset: PeriodePreset
  /** Borne basse incluse, AAAA-MM-JJ. Vide = pas de borne. */
  debut: string
  /** Borne haute incluse, AAAA-MM-JJ. Vide = pas de borne. */
  fin: string
}

const props = withDefaults(defineProps<{
  modelValue: PeriodeValue
  label?: string
  showResume?: boolean
}>(), {
  label: 'Période',
  showResume: true,
})

const emit = defineEmits<{ 'update:modelValue': [PeriodeValue] }>()

const model = computed(() => props.modelValue)
const options = PERIODE_OPTIONS

const resume = computed(() => libellePlage({ debut: model.value.debut, fin: model.value.fin }))

function choisir(preset: PeriodePreset) {
  if (preset === 'personnalise') {
    // On garde les bornes du preset précédent comme point de départ éditable.
    emit('update:modelValue', { ...model.value, preset })
    return
  }
  emit('update:modelValue', { preset, ...plageDePeriode(preset) })
}

function majBorne(cle: 'debut' | 'fin', valeur: string) {
  emit('update:modelValue', { ...model.value, preset: 'personnalise', [cle]: valeur })
}
</script>
