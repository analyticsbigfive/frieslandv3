<template>
  <div class="admin-surface p-6">
    <h3 class="mb-4 text-base font-semibold text-slate-900 dark:text-white">{{ title }}</h3>
    <div v-if="chartData" class="h-64">
      <Bar :data="chartData" :options="chartOptions" />
    </div>
    <div v-else class="flex h-64 items-center justify-center rounded-lg bg-slate-50 px-4 text-center text-sm text-slate-600 dark:bg-slate-700/40 dark:text-slate-300">
      {{ emptyLabel }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { SERIES } from '~/utils/chartPalette'
import { Bar } from 'vue-chartjs'

const props = withDefaults(defineProps<{
  title: string
  labels: string[]
  values: number[]
  color?: string
  emptyLabel?: string
}>(), {
  emptyLabel: 'Aucune donnée sur la période. Élargissez les dates ou retirez un filtre.',
})

const axes = useAxesGraphique()

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

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: axes.value.infobulleFond,
      titleColor: axes.value.infobulleTexte,
      bodyColor: axes.value.infobulleTexte,
      padding: 10,
      cornerRadius: 8,
    },
  },
  scales: {
    x: {
      grid: { display: false },
      border: { color: axes.value.bordure },
      ticks: { font: { size: axes.value.taillePolice }, color: axes.value.texte },
    },
    y: {
      beginAtZero: true,
      grid: { color: axes.value.grille },
      border: { color: axes.value.bordure },
      ticks: { font: { size: axes.value.taillePolice }, color: axes.value.texte },
    },
  },
}))
</script>
