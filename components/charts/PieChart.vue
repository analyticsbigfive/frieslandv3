<template>
  <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
    <h3 v-if="title" class="text-sm font-semibold text-gray-700 mb-4 text-center">{{ title }}</h3>
    <div :class="heightClass">
      <Doughnut v-if="chartData" :data="chartData" :options="mergedOptions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Doughnut } from 'vue-chartjs'

const props = withDefaults(defineProps<{
  title?: string
  labels: string[]
  values: number[]
  colors?: string[]
  height?: 'sm' | 'md' | 'lg'
  showLegend?: boolean
  showPercentages?: boolean
  cutout?: string
}>(), {
  height: 'md',
  showLegend: true,
  showPercentages: true,
  cutout: '55%',
})

const defaultColors = ['#F59E0B', '#FB923C', '#3B82F6', '#EF4444', '#10B981', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#6366F1']
// Couleurs Présent/Absent standard
const presenceColors = ['#F59E0B', '#FB923C'] // Jaune/Orange comme dans Looker Studio

const heightClass = computed(() => {
  const map = { sm: 'h-40', md: 'h-56', lg: 'h-72' }
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
        font: { size: 10 },
        padding: 12,
      },
    },
    tooltip: {
      backgroundColor: '#1f2937',
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
