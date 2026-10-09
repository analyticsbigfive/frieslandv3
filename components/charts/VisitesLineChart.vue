<template>
  <div class="admin-surface h-full p-6">
    <div class="mb-5">
      <h3 class="text-base font-semibold text-slate-900 dark:text-white">{{ title }}</h3>
      <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">{{ subtitle }}</p>
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
import { AXES, REMPLISSAGE_PRINCIPAL, SERIES } from '~/utils/chartPalette'
import { Line } from 'vue-chartjs'

const props = withDefaults(defineProps<{
  title: string
  data: { date: string; count: number }[]
  /** Sous-titre de la carte ; par défaut le libellé « volume de visites ». */
  subtitle?: string
  /** Libellé de la série (visible dans le tooltip). */
  seriesLabel?: string
}>(), {
  subtitle: 'Volume quotidien sur la période disponible.',
  seriesLabel: 'Visites',
})

const chartData = computed(() => {
  if (!props.data?.length) return null

  const sorted = [...props.data].sort((a, b) => a.date.localeCompare(b.date))

  return {
    labels: sorted.map(d =>
      // Les libellés déjà formatés ('S28 - 2026', 'juillet 2026') passent tels
      // quels ; seules les dates ISO sont re-formatées. Évite « Invalid Date ».
      isIsoDate(d.date)
        ? formatDateFr(d.date, { day: '2-digit', month: 'short' })
        : d.date,
    ),
    datasets: [{
      label: props.seriesLabel,
      data: sorted.map(d => d.count),
      borderColor: SERIES[0],
      backgroundColor: REMPLISSAGE_PRINCIPAL,
      fill: true,
      tension: 0.4,
      pointRadius: 3,
      pointHoverRadius: 6,
      pointBackgroundColor: SERIES[0],
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
      titleFont: { size: 12 },
      bodyFont: { size: 12 },
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
