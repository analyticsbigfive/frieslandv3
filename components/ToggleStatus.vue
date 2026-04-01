<template>
  <div class="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
    <button
      class="flex-1 py-3 px-4 text-sm font-semibold text-center transition-all duration-200"
      :class="modelValue === 'En rupture'
        ? 'bg-fc-red text-white shadow-inner'
        : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'"
      @click="$emit('update:modelValue', 'En rupture')"
    >
      En rupture
    </button>
    <button
      class="flex-1 py-3 px-4 text-sm font-semibold text-center transition-all duration-200"
      :class="modelValue === 'Présent'
        ? 'bg-fc-red text-white shadow-inner'
        : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'"
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
