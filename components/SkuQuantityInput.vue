<template>
  <div class="flex items-center justify-between gap-3 py-2">
    <div class="flex items-center gap-2 min-w-0">
      <span
        class="w-2.5 h-2.5 rounded-full shrink-0"
        :style="{ backgroundColor: levelMeta.color }"
        :title="levelMeta.label"
      />
      <span class="text-sm text-gray-700 dark:text-gray-300 truncate">{{ label }}</span>
    </div>

    <div class="flex items-center gap-1.5 shrink-0">
      <button
        type="button"
        class="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center active:scale-95 disabled:opacity-40"
        :disabled="qty <= 0"
        @click="setQty(qty - 1)"
      >
        <UIcon name="i-heroicons-minus" class="w-4 h-4" />
      </button>

      <input
        type="number"
        inputmode="numeric"
        min="0"
        :value="qty"
        class="w-14 h-8 text-center rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-fc-blue focus:outline-none"
        @input="onInput"
      />

      <button
        type="button"
        class="w-8 h-8 rounded-lg bg-fc-blue/10 text-fc-blue flex items-center justify-center active:scale-95"
        @click="setQty(qty + 1)"
      >
        <UIcon name="i-heroicons-plus" class="w-4 h-4" />
      </button>

      <!-- Facings : Modern Trade uniquement -->
      <label v-if="showFacings" class="flex items-center gap-1 pl-1" :title="facingsMin ? `Facings requis : ≥ ${facingsMin}` : 'Nombre de facings'">
        <span class="text-[10px] font-semibold uppercase text-gray-400">F</span>
        <input
          type="number"
          inputmode="numeric"
          min="0"
          :value="facingsVal"
          class="w-12 h-8 text-center rounded-lg border text-sm font-medium bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-fc-blue focus:outline-none"
          :class="facingsMin && facingsVal < facingsMin ? 'border-amber-400 dark:border-amber-500' : 'border-gray-200 dark:border-gray-600'"
          @input="onFacingsInput"
        />
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { STOCK_LEVEL_META, type StockLevel } from '~/utils/products'

const props = withDefaults(defineProps<{
  modelValue: number | undefined
  label: string
  seuil?: number
  showFacings?: boolean
  facings?: number
  facingsMin?: number
}>(), {
  seuil: 3,
  showFacings: false,
})

const emit = defineEmits<{ 'update:modelValue': [number]; 'update:facings': [number] }>()

const qty = computed(() => (typeof props.modelValue === 'number' && !Number.isNaN(props.modelValue) ? props.modelValue : 0))
const facingsVal = computed(() => (typeof props.facings === 'number' && !Number.isNaN(props.facings) ? props.facings : 0))

function onFacingsInput(e: Event) {
  const n = parseInt((e.target as HTMLInputElement).value, 10)
  emit('update:facings', Number.isNaN(n) ? 0 : Math.max(0, n))
}

const level = computed<StockLevel>(() => {
  if (qty.value <= 0) return 'oos'
  if (qty.value <= props.seuil) return 'low'
  return 'ok'
})
const levelMeta = computed(() => STOCK_LEVEL_META[level.value])

function setQty(v: number) {
  emit('update:modelValue', Math.max(0, Math.round(v)))
}

function onInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value
  const n = parseInt(raw, 10)
  setQty(Number.isNaN(n) ? 0 : n)
}
</script>
