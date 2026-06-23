<template>
  <div
    class="grid grid-cols-2 overflow-hidden rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-600 dark:bg-gray-800"
    role="radiogroup"
    aria-label="Choix oui ou non"
  >
    <button
      type="button"
      class="touch-target rounded-lg px-4 py-3 text-center text-sm font-semibold transition-all duration-200 active:scale-[0.98]"
      role="radio"
      :aria-checked="modelValue === false"
      :class="!modelValue
        ? 'bg-fc-red text-white shadow-sm'
        : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'"
      @click="$emit('update:modelValue', false)"
    >
      Non
    </button>
    <button
      type="button"
      class="touch-target rounded-lg px-4 py-3 text-center text-sm font-semibold transition-all duration-200 active:scale-[0.98]"
      role="radio"
      :aria-checked="modelValue === true"
      :class="modelValue
        ? 'bg-fc-red text-white shadow-sm'
        : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'"
      @click="$emit('update:modelValue', true)"
    >
      Oui
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{ modelValue?: boolean }>()
defineEmits(['update:modelValue'])
</script>
