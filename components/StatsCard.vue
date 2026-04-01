<template>
  <div
    class="rounded-xl bg-white dark:bg-gray-800 p-5 shadow-sm border border-gray-100 dark:border-gray-700 card-hover"
    :class="cardClass"
  >
    <div class="flex items-start justify-between">
      <div>
        <p class="text-sm text-gray-500 dark:text-gray-400 font-medium">{{ title }}</p>
        <p class="text-2xl font-bold mt-1" :class="valueClass">
          {{ formattedValue }}
        </p>
        <p v-if="subtitle" class="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-1">{{ subtitle }}</p>
      </div>
      <div
        class="w-12 h-12 rounded-xl flex items-center justify-center"
        :class="iconBgClass"
      >
        <component :is="icon" class="w-6 h-6" :class="iconColorClass" />
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
      <span class="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400">vs mois dernier</span>
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
    value: 'text-gray-900 dark:text-gray-100',
    iconBg: 'bg-fc-blue-50 dark:bg-fc-blue-900/30',
    iconColor: 'text-fc-blue',
  },
  red: {
    card: '',
    value: 'text-gray-900 dark:text-gray-100',
    iconBg: 'bg-fc-red-50 dark:bg-fc-red-900/30',
    iconColor: 'text-fc-red',
  },
  green: {
    card: '',
    value: 'text-gray-900 dark:text-gray-100',
    iconBg: 'bg-emerald-50 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-600',
  },
  orange: {
    card: '',
    value: 'text-gray-900 dark:text-gray-100',
    iconBg: 'bg-amber-50 dark:bg-amber-900/30',
    iconColor: 'text-amber-600',
  },
  purple: {
    card: '',
    value: 'text-gray-900 dark:text-gray-100',
    iconBg: 'bg-purple-50 dark:bg-purple-900/30',
    iconColor: 'text-purple-600',
  },
}

const cardClass = computed(() => colorMap[props.color].card)
const valueClass = computed(() => colorMap[props.color].value)
const iconBgClass = computed(() => colorMap[props.color].iconBg)
const iconColorClass = computed(() => colorMap[props.color].iconColor)
</script>
