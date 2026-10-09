<template>
  <div class="admin-surface p-6">
    <h3 class="mb-4 text-base font-semibold text-slate-900 dark:text-white">{{ title }}</h3>
    <div class="h-64">
      <Bar v-if="chartData" :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { AXES, SERIES } from '~/utils/chartPalette'
import { Bar } from 'vue-chartjs'

const props = defineProps<{
  title: string
  labels: string[]
  values: number[]
  color?: string
}>()

const chartData = computed(() => {
  if (!props.labels?.length) return null

  return {
    labels: props.labels,
    datasets: [{
      label: props.title,
      data: props.values,
      backgroundColor: props.color || SERIES[0],
      borderRadius: 6,
      maxBarThickness: 40,
    }],
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: AXES.infobulleFond,
      padding: 10,
      cornerRadius: 8,
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { font: { size: AXES.taillePolice }, color: AXES.texte },
    },
    y: {
      beginAtZero: true,
      grid: { color: AXES.grille },
      ticks: { font: { size: AXES.taillePolice }, color: AXES.texte },
    },
  },
}
</script>
