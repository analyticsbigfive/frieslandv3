<template>
  <div class="admin-surface h-full p-6">
    <div class="mb-5">
      <h3 class="font-semibold text-slate-950 dark:text-white">{{ title }}</h3>
      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Composition du parc par format de magasin.</p>
    </div>
    <div v-if="chartData" class="h-72">
      <Doughnut v-if="chartData" :data="chartData" :options="chartOptions" />
    </div>
    <div v-else class="flex h-72 items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-400 dark:bg-slate-700/40">
      Aucune donnée de répartition
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
  '#C8102E', '#334155', '#64748B', '#94A3B8', '#CBD5E1',
  '#9B0D23', '#475569', '#7F1D1D', '#A8A29E', '#D6D3D1',
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
