<template>
  <div :class="bare ? '' : 'admin-surface p-6'">
    <h3 v-if="title" class="mb-4 text-center text-base font-semibold text-slate-900 dark:text-white">{{ title }}</h3>
    <div :class="heightClass">
      <Doughnut v-if="chartData" :data="chartData" :options="mergedOptions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { AXES, AUTRE, COULEURS_PRESENCE, SERIES } from '~/utils/chartPalette'
import { Doughnut } from 'vue-chartjs'

const props = withDefaults(defineProps<{
  title?: string
  labels: string[]
  values: number[]
  colors?: string[]
  height?: 'xs' | 'sm' | 'md' | 'lg'
  showLegend?: boolean
  showPercentages?: boolean
  cutout?: string
  bare?: boolean
}>(), {
  height: 'md',
  showLegend: true,
  showPercentages: true,
  cutout: '55%',
})

// Palette commune (utils/chartPalette.ts) : séries dans un ordre fixe, puis « Autre ».
const defaultColors = [...SERIES, AUTRE]
// Couleurs Présent/Absent standard
// Deux parts « absent / présent » : couleurs de statut (rupture, présent).
const presenceColors = [...COULEURS_PRESENCE]

const heightClass = computed(() => {
  const map = { xs: 'h-24', sm: 'h-40', md: 'h-56', lg: 'h-72' }
  return map[props.height]
})

const chartData = computed(() => {
  if (!props.labels?.length || !props.values?.length) return null

  const total = props.values.reduce((a, b) => a + b, 0)
  const labelsWithPct = props.showPercentages && total > 0
    ? props.labels.map((l, i) => `${l} (${Math.round(props.values[i] / total * 100)}%)`)
    : props.labels

  return {
    labels: labelsWithPct,
    datasets: [{
      data: props.values,
      backgroundColor: props.colors || (props.labels.length === 2 ? presenceColors : defaultColors),
      borderWidth: 2,
      borderColor: '#ffffff',
    }],
  }
})

const mergedOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  cutout: props.cutout,
  plugins: {
    legend: {
      display: props.showLegend,
      position: 'bottom' as const,
      labels: {
        usePointStyle: true,
        pointStyle: 'circle',
        font: { size: AXES.taillePolice },
        padding: 12,
      },
    },
    tooltip: {
      backgroundColor: AXES.infobulleFond,
      padding: 10,
      cornerRadius: 8,
      callbacks: {
        label: (ctx: any) => {
          const total = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0)
          const pct = total > 0 ? Math.round(ctx.raw / total * 100) : 0
          return `${ctx.raw} (${pct}%)`
        },
      },
    },
  },
}))
</script>
