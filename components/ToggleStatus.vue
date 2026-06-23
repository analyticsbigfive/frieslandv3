<template>
  <div
    class="grid grid-cols-2 overflow-hidden rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-600 dark:bg-gray-800"
    role="radiogroup"
    aria-label="Statut produit"
  >
    <button
      type="button"
      class="touch-target rounded-lg px-4 py-3 text-center text-sm font-semibold transition-all duration-200 active:scale-[0.98]"
      role="radio"
      :aria-checked="modelValue === 'En rupture'"
      :class="modelValue === 'En rupture'
        ? 'bg-fc-red text-white shadow-sm'
        : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'"
      @click="$emit('update:modelValue', 'En rupture')"
    >
      En rupture
    </button>
    <button
      type="button"
      class="touch-target rounded-lg px-4 py-3 text-center text-sm font-semibold transition-all duration-200 active:scale-[0.98]"
      role="radio"
      :aria-checked="modelValue === 'Présent'"
      :class="modelValue === 'Présent'
        ? 'bg-fc-red text-white shadow-sm'
        : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'"
      @click="$emit('update:modelValue', 'Présent')"
    >
      Présent
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{ modelValue?: string }>()
defineEmits(['update:modelValue'])
</script>
