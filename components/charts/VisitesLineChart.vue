<template>
  <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
    <h3 class="text-sm font-semibold text-gray-700 mb-4">{{ title }}</h3>
    <div class="h-64">
      <Line v-if="chartData" :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Line } from 'vue-chartjs'

const props = defineProps<{
  title: string
  data: { date: string; count: number }[]
}>()

const chartData = computed(() => {
  if (!props.data?.length) return null

  const sorted = [...props.data].sort((a, b) => a.date.localeCompare(b.date))

  return {
    labels: sorted.map(d => {
      const date = new Date(d.date)
      return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
    }),
    datasets: [{
      label: 'Visites',
      data: sorted.map(d => d.count),
      borderColor: '#003DA5',
      backgroundColor: 'rgba(0, 61, 165, 0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: 3,
      pointHoverRadius: 6,
      pointBackgroundColor: '#003DA5',
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
      titleFont: { size: 12 },
      bodyFont: { size: 12 },
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
