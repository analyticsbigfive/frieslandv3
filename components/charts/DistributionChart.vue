<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
    <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">{{ title }}</h3>
    <div class="h-64">
      <Doughnut v-if="chartData" :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Doughnut } from 'vue-chartjs'

const props = defineProps<{
  title: string
  data: { type: string; count: number }[]
}>()

const colors = [
  '#003DA5', '#C8102E', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
]

const chartData = computed(() => {
  if (!props.data?.length) return null

  return {
    labels: props.data.map(d => d.type),
    datasets: [{
      data: props.data.map(d => d.count),
      backgroundColor: props.data.map((_, i) => colors[i % colors.length]),
      borderWidth: 2,
      borderColor: '#ffffff',
    }],
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right' as const,
      labels: {
        usePointStyle: true,
        pointStyle: 'circle',
        font: { size: 11 },
        padding: 15,
      },
    },
    tooltip: {
      backgroundColor: '#1f2937',
      padding: 10,
      cornerRadius: 8,
    },
  },
  cutout: '60%',
}
</script>
