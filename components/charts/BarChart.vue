<template>
  <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
    <h3 class="text-sm font-semibold text-gray-700 mb-4">{{ title }}</h3>
    <div class="h-64">
      <Bar v-if="chartData" :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>

<script setup lang="ts">
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
      backgroundColor: props.color || '#003DA5',
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
      backgroundColor: '#1f2937',
      padding: 10,
      cornerRadius: 8,
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { font: { size: 10 }, color: '#9ca3af' },
    },
    y: {
      beginAtZero: true,
      grid: { color: '#f3f4f6' },
      ticks: { font: { size: 10 }, color: '#9ca3af' },
    },
  },
}
</script>
