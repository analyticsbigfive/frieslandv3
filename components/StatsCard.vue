<template>
  <div
    class="admin-surface group overflow-hidden p-4 transition duration-300 hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-slate-600"
    :class="cardClass"
  >
    <div class="absolute inset-x-0 top-0 h-1" :class="accentClass" />
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <p class="text-xs font-semibold uppercase tracking-normal text-slate-400 dark:text-slate-500">{{ title }}</p>
        <p class="mt-1.5 text-2xl font-semibold leading-none tracking-tight tabular-nums" :class="valueClass">
          {{ formattedValue }}
        </p>
        <p v-if="subtitle" class="mt-1.5 text-xs leading-5 text-slate-400 dark:text-slate-500">{{ subtitle }}</p>
      </div>
      <div
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-105"
        :class="iconBgClass"
      >
        <UIcon v-if="typeof icon === 'string'" :name="icon" class="h-4 w-4" :class="iconColorClass" />
        <component :is="icon" v-else class="h-4 w-4" :class="iconColorClass" />
      </div>
    </div>

    <!-- Trend -->
    <div v-if="trend !== undefined" class="mt-3 flex items-center gap-1.5">
      <span
        class="flex items-center gap-0.5 text-xs font-medium px-2 py-0.5 rounded-full"
        :class="trend >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'"
      >
        <svg v-if="trend >= 0" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 17l9.2-9.2M17 17V7H7" />
        </svg>
        <svg v-else class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 7l-9.2 9.2M7 7v10h10" />
        </svg>
        {{ Math.abs(trend) }}%
      </span>
      <span class="text-xs text-slate-400 dark:text-slate-500">vs mois dernier</span>
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

const colorMap = {
  blue: {
    card: '',
    value: 'text-slate-950 dark:text-white',
    accent: 'bg-slate-500',
    iconBg: 'bg-slate-100 dark:bg-slate-700',
    iconColor: 'text-slate-600 dark:text-slate-200',
  },
  red: {
    card: '',
    value: 'text-slate-950 dark:text-white',
    accent: 'bg-fc-red',
    iconBg: 'bg-fc-red-50 dark:bg-fc-red-900/30',
    iconColor: 'text-fc-red',
  },
  green: {
    card: '',
    value: 'text-slate-950 dark:text-white',
    accent: 'bg-emerald-500',
    iconBg: 'bg-emerald-50 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-600',
  },
  orange: {
    card: '',
    value: 'text-slate-950 dark:text-white',
    accent: 'bg-amber-500',
    iconBg: 'bg-amber-50 dark:bg-amber-900/30',
    iconColor: 'text-amber-600',
  },
  purple: {
    card: '',
    value: 'text-slate-950 dark:text-white',
    accent: 'bg-slate-400',
    iconBg: 'bg-slate-100 dark:bg-slate-700',
    iconColor: 'text-slate-600 dark:text-slate-200',
  },
}

const cardClass = computed(() => colorMap[props.color].card)
const valueClass = computed(() => colorMap[props.color].value)
const accentClass = computed(() => colorMap[props.color].accent)
const iconBgClass = computed(() => colorMap[props.color].iconBg)
const iconColorClass = computed(() => colorMap[props.color].iconColor)
</script>
