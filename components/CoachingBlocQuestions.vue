<template>
  <div class="space-y-4 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
    <h3 class="text-sm font-bold text-gray-800 dark:text-gray-100">{{ BLOCS_COACHING[bloc] }}</h3>
    <div v-for="q in questionsDuBloc(bloc)" :key="q.code" class="space-y-2">
      <p class="text-sm font-medium text-gray-800 dark:text-gray-100">{{ q.libelle }} *</p>
      <div class="grid grid-cols-3 gap-2" role="radiogroup" :aria-label="q.libelle">
        <button
          v-for="r in REPONSES" :key="r.value" type="button" role="radio"
          :aria-checked="modelValue[q.code] === r.value"
          class="min-h-11 rounded-xl text-sm font-semibold transition-colors"
          :class="modelValue[q.code] === r.value
            ? (r.value === 'oui' ? 'bg-green-600 text-white' : r.value === 'non' ? 'bg-fc-red text-white' : 'bg-gray-500 text-white')
            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'"
          @click="$emit('update:modelValue', { ...modelValue, [q.code]: r.value })"
        >{{ r.label }}</button>
      </div>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { BLOCS_COACHING, REPONSES, questionsDuBloc } from '~/utils/fieldCoaching'

defineProps<{ bloc: 'visibilite' | 'promotion'; modelValue: Record<string, string> }>()
defineEmits<{ (e: 'update:modelValue', v: Record<string, string>): void }>()
</script>
