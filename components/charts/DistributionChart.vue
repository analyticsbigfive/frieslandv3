<template>
  <div class="admin-surface h-full p-6">
    <div class="mb-5">
      <h3 class="text-base font-semibold text-slate-900 dark:text-white">{{ title }}</h3>
      <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">Composition du parc par format de magasin.</p>
    </div>
    <div v-if="chartData" class="h-72">
      <Doughnut :data="chartData" :options="chartOptions" />
    </div>
    <div v-else class="flex h-72 items-center justify-center rounded-lg bg-slate-50 px-4 text-center text-sm text-slate-600 dark:bg-slate-700/40 dark:text-slate-300">
      Aucun point de vente pour ces filtres. Élargissez la zone ou retirez un filtre.
    </div>
  </div>
</template>

<script setup lang="ts">
import { AUTRE, SERIES } from '~/utils/chartPalette'
import { Doughnut } from 'vue-chartjs'

const props = defineProps<{
  title: string
  data: { type: string; count: number }[]
}>()

const colors = [...SERIES, AUTRE]
const axes = useAxesGraphique()

const chartData = computed(() => {
  if (!props.data?.length) return null

  return {
    labels: props.data.map(d => d.type),
    datasets: [{
      data: props.data.map(d => d.count),
      backgroundColor: props.data.map((_, i) => colors[i % colors.length]),
      borderWidth: 2,
      borderColor: axes.value.surface,
    }],
  }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right' as const,
      labels: {
        usePointStyle: true,
        pointStyle: 'circle',
        font: { size: axes.value.taillePolice },
        color: axes.value.texte,
        padding: 15,
      },
    },
    tooltip: {
      backgroundColor: axes.value.infobulleFond,
      titleColor: axes.value.infobulleTexte,
      bodyColor: axes.value.infobulleTexte,
      padding: 10,
      cornerRadius: 8,
    },
  },
  cutout: '60%',
}))
</script>
