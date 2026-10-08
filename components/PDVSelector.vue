<template>
  <USelectMenu
    v-model="selected"
    :options="options"
    :loading="loading"
    :searchable="true"
    :search-attributes="['label', 'detail']"
    searchable-placeholder="Nom du PDV, zone ou quartier…"
    :placeholder="loading ? 'Chargement des PDV…' : 'Sélectionner un PDV'"
    option-attribute="label"
    value-attribute="value"
    size="lg"
    class="w-full"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <!-- Liste ouverte avant l'arrivée des PDV : squelette, pas « vide ». -->
    <template #empty>
      <ChargementContenu
        v-if="loading"
        variante="lignes"
        :nombre="4"
        libelle="Chargement de vos PDV…"
        :progression="progression || null"
        unite="PDV"
        class="px-1 py-1 text-left"
      />
      <span v-else>Aucun PDV dans votre périmètre.</span>
    </template>
    <template #option-empty="{ query }">
      <span v-if="loading">Recherche dans les PDV déjà reçus… la liste continue de se charger.</span>
      <span v-else>Aucun PDV pour « {{ query }} ».</span>
    </template>
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
  /** PDV déjà reçus pendant le chargement. */
  progression?: number
}>()

defineEmits(['update:modelValue'])

const selected = ref(props.modelValue)

watch(() => props.modelValue, (v) => { selected.value = v })

const options = computed(() =>
  props.pdvList.map(p => ({
    label: p.nom_pdv,
    value: p.pdv_id,
    detail: `${p.zone || ''} - ${p.quartier || ''}`,
  }))
)
</script>
