<template>
  <input
    type="number"
    min="0"
    max="1"
    step="0.01"
    :value="modelValue"
    :disabled="disabled"
    class="w-20 h-9 text-center rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-fc-red focus:outline-none disabled:opacity-50"
    @input="onInput"
    @change="$emit('change')"
  />
</template>

<script setup lang="ts">
defineProps<{ modelValue: number; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [number]; change: [] }>()

function onInput(e: Event) {
  let n = parseFloat((e.target as HTMLInputElement).value)
  if (Number.isNaN(n)) n = 0
  n = Math.max(0, Math.min(1, n))
  emit('update:modelValue', n)
}
</script>
