<template>
  <div class="admin-surface h-full p-6">
    <div class="mb-5">
      <h3 class="text-base font-semibold text-slate-900 dark:text-white">{{ title }}</h3>
      <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">Composition du parc par format de magasin.</p>
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
import { AXES, AUTRE, SERIES } from '~/utils/chartPalette'
import { Doughnut } from 'vue-chartjs'

const props = defineProps<{
  title: string
  data: { type: string; count: number }[]
}>()

const colors = [...SERIES, AUTRE]

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
        font: { size: AXES.taillePolice },
        padding: 15,
      },
    },
    tooltip: {
      backgroundColor: AXES.infobulleFond,
      padding: 10,
      cornerRadius: 8,
    },
  },
  cutout: '60%',
}
</script>
