<template>
  <div class="flex rounded-lg overflow-hidden border border-gray-200">
    <button
      class="flex-1 py-3 px-4 text-sm font-semibold text-center transition-all duration-200"
      :class="!modelValue
        ? 'bg-fc-red text-white shadow-inner'
        : 'bg-white text-gray-500 hover:bg-gray-50'"
      @click="$emit('update:modelValue', false)"
    >
      NON
    </button>
    <button
      class="flex-1 py-3 px-4 text-sm font-semibold text-center transition-all duration-200"
      :class="modelValue
        ? 'bg-fc-red text-white shadow-inner'
        : 'bg-white text-gray-500 hover:bg-gray-50'"
      @click="$emit('update:modelValue', true)"
    >
      OUI
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{ modelValue: boolean }>()
defineEmits(['update:modelValue'])
</script>
