<template>
  <div class="admin-surface h-full p-6">
    <div class="mb-5">
      <h3 class="font-semibold text-slate-950 dark:text-white">{{ title }}</h3>
      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Volume quotidien sur la période disponible.</p>
    </div>
    <div v-if="chartData" class="h-72">
      <Line v-if="chartData" :data="chartData" :options="chartOptions" />
    </div>
    <div v-else class="flex h-72 items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-400 dark:bg-slate-700/40">
      Aucune visite sur la période
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
      borderColor: '#0F172A',
      backgroundColor: 'rgba(200, 16, 46, 0.08)',
      fill: true,
      tension: 0.4,
      pointRadius: 3,
      pointHoverRadius: 6,
      pointBackgroundColor: '#0F172A',
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
