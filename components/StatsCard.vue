<template>
  <!-- Indicateur (DESIGN.md) : carte plate bordée, libellé, valeur, évolution.
       La couleur ne teinte que la pastille d'icône. -->
  <div class="admin-surface p-4" :class="cardClass">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-xs font-semibold text-slate-600 dark:text-slate-300">{{ title }}</p>
        <p class="mt-1.5 text-2xl font-bold leading-none tabular-nums" :class="valueClass">
          {{ formattedValue }}
        </p>
        <p v-if="subtitle" class="mt-1.5 text-xs leading-5 text-slate-600 dark:text-slate-300">{{ subtitle }}</p>
      </div>
      <div
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
        :class="iconBgClass"
        aria-hidden="true"
      >
        <UIcon v-if="typeof icon === 'string'" :name="icon" class="h-4 w-4" :class="iconColorClass" />
        <component :is="icon" v-else class="h-4 w-4" :class="iconColorClass" />
      </div>
    </div>

    <!-- Trend -->
    <div v-if="trend !== undefined" class="mt-3 flex items-center gap-1.5">
      <span
        class="flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold"
        :class="trend >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'"
      >
        <svg v-if="trend >= 0" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 17l9.2-9.2M17 17V7H7" />
        </svg>
        <svg v-else class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 7l-9.2 9.2M7 7v10h10" />
        </svg>
        {{ Math.abs(trend) }}%
      </span>
      <span class="text-xs text-slate-600 dark:text-slate-300">par rapport au mois dernier</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  title: string
  value: number | string
  subtitle?: string
  icon: any
  color?: 'blue' | 'red' | 'green' | 'orange' | 'purple'
  format?: 'number' | 'percent' | 'none'
  trend?: number
}>(), {
  color: 'blue',
  format: 'number',
})

const formattedValue = computed(() => {
  if (props.format === 'percent') return `${props.value}%`
  if (props.format === 'number' && typeof props.value === 'number') {
    return new Intl.NumberFormat('fr-FR').format(props.value)
  }
  return props.value
})

// Couleurs de la pastille d'icône seulement. « blue » et « purple » (anciens
// noms) restent neutres : le bleu et le violet ne font pas partie de la charte.
const colorMap = {
  blue: { card: '', value: 'text-slate-900 dark:text-white', iconBg: 'bg-slate-100 dark:bg-slate-700', iconColor: 'text-slate-700 dark:text-slate-200' },
  purple: { card: '', value: 'text-slate-900 dark:text-white', iconBg: 'bg-slate-100 dark:bg-slate-700', iconColor: 'text-slate-700 dark:text-slate-200' },
  red: { card: '', value: 'text-slate-900 dark:text-white', iconBg: 'bg-brand-50 dark:bg-brand-950/40', iconColor: 'text-brand-600 dark:text-brand-300' },
  green: { card: '', value: 'text-slate-900 dark:text-white', iconBg: 'bg-emerald-50 dark:bg-emerald-900/30', iconColor: 'text-emerald-700 dark:text-emerald-300' },
  orange: { card: '', value: 'text-slate-900 dark:text-white', iconBg: 'bg-amber-50 dark:bg-amber-900/30', iconColor: 'text-amber-700 dark:text-amber-300' },
}

const cardClass = computed(() => colorMap[props.color].card)
const valueClass = computed(() => colorMap[props.color].value)
const iconBgClass = computed(() => colorMap[props.color].iconBg)
const iconColorClass = computed(() => colorMap[props.color].iconColor)
</script>
