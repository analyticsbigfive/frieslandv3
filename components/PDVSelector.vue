<template>
  <USelectMenu
    v-model="selected"
    :options="options"
    :loading="loading"
    :searchable="true"
    searchable-placeholder="Rechercher un PDV..."
    placeholder="Sélectionner un PDV"
    option-attribute="label"
    value-attribute="value"
    size="lg"
    class="w-full"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template #option="{ option }">
      <div class="flex flex-col py-1">
        <span class="font-medium">{{ option.label }}</span>
        <span class="text-xs text-gray-400">{{ option.detail }}</span>
      </div>
    </template>
  </USelectMenu>
</template>

<script setup lang="ts">
import type { PDV } from '~/types'

const props = defineProps<{
  modelValue: string
  pdvList: PDV[]
  loading?: boolean
}>()

defineEmits(['update:modelValue'])

const selected = ref(props.modelValue)

watch(() => props.modelValue, (v) => { selected.value = v })

const options = computed(() =>
  props.pdvList.map(p => ({
    label: p.nom_pdv,
    value: p.pdv_id,
    detail: `${p.zone || ''} - ${p.secteur || ''}`,
  }))
)
</script>
