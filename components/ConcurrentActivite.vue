<template>
  <div class="space-y-3">
    <div class="space-y-1">
      <label class="text-sm font-medium text-gray-600">En activité ? *</label>
      <ToggleYesNo :model-value="enActivite" @update:model-value="emit('update:enActivite', $event)" />
    </div>

    <!-- L'action n'est demandée que si le concurrent est actif : sinon le champ
         se remplit de « RAS » et pollue l'agrégation. -->
    <div v-if="enActivite" class="space-y-1">
      <label class="text-sm font-medium text-gray-600">Action de la concurrence *</label>
      <UTextarea
        :model-value="action"
        :rows="2"
        placeholder="Promotion, programme de fidélité, opération de référencement…"
        size="lg"
        @update:model-value="emit('update:action', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  enActivite?: boolean
  action?: string
}>()

const emit = defineEmits<{
  'update:enActivite': [boolean]
  'update:action': [string]
}>()
</script>
