<template>
  <div class="admin-surface h-full p-6">
    <div v-if="title || subtitle" class="mb-5">
      <h3 class="font-semibold text-slate-950 dark:text-white">{{ title }}</h3>
      <p v-if="subtitle" class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ subtitle }}</p>
    </div>
    <div v-if="chartData" :class="heightClass">
      <Line :data="chartData" :options="chartOptions" />
    </div>
    <div v-else class="flex items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-400 dark:bg-slate-700/40" :class="heightClass">
      {{ emptyLabel }}
    </div>
  </div>
</template>

<script setup lang="ts">
// Courbes multi-séries (lot 5, 1.0.4). VisitesLineChart est mono-série,
// couleur figée, sans légende : impossible de comparer deux périodes ou
// plusieurs PDV dessus. Axe de catégories (pas de TimeScale enregistrée dans
// plugins/chart.client.ts) : les libellés arrivent déjà formatés.
import { Line } from 'vue-chartjs'

export interface MultiLineSerie {
  label: string
  /** Une valeur par libellé d'axe, null = point manquant (ligne coupée). */
  data: (number | null)[]
  color?: string
}

const props = withDefaults(defineProps<{
  labels: string[]
  series: MultiLineSerie[]
  title?: string
  subtitle?: string
  /** Suffixe des valeurs dans l'axe et le tooltip (ex. « % »). */
  unit?: string
  /** Borne haute de l'axe Y ; laissée libre si absente. */
  max?: number
  height?: 'sm' | 'md' | 'lg'
  emptyLabel?: string
}>(), {
  title: '',
  subtitle: '',
  unit: '',
  height: 'md',
  emptyLabel: 'Aucune donnée sur la période',
})

const PALETTE = ['#C8102E', '#2563EB', '#059669', '#D97706', '#7C3AED', '#DB2777', '#0891B2']

const heightClass = computed(() => ({ sm: 'h-56', md: 'h-72', lg: 'h-96' }[props.height]))

const chartData = computed(() => {
  if (!props.labels.length || !props.series.some(s => s.data.some(v => v != null))) return null
  return {
    labels: props.labels,
    datasets: props.series.map((s, i) => {
      const color = s.color || PALETTE[i % PALETTE.length]
      return {
        label: s.label,
        data: s.data,
        borderColor: color,
        backgroundColor: color,
        fill: false,
        tension: 0.3,
        spanGaps: true,
        pointRadius: 3,
        pointHoverRadius: 6,
      }
    }),
  }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  plugins: {
    legend: { display: true, position: 'top' as const, labels: { usePointStyle: true, boxWidth: 8, font: { size: 11 } } },
    tooltip: {
      backgroundColor: '#1f2937',
      titleFont: { size: 12 },
      bodyFont: { size: 12 },
      padding: 10,
      cornerRadius: 8,
      callbacks: {
        label: (ctx: any) => `${ctx.dataset.label} : ${ctx.parsed.y == null ? '—' : ctx.parsed.y}${props.unit}`,
      },
    },
  },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#9ca3af' } },
    y: {
      beginAtZero: true,
      ...(props.max != null ? { max: props.max } : {}),
      grid: { color: '#f3f4f6' },
      ticks: { font: { size: 10 }, color: '#9ca3af', callback: (v: any) => `${v}${props.unit}` },
    },
  },
}))
</script>
