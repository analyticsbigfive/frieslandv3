<template>
  <div class="rounded-xl border border-slate-200/70 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
    <div class="flex items-center justify-between">
      <span class="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
        <span class="h-2 w-2 rounded-full" :class="dot" />
        {{ label }}
      </span>
      <span class="text-xs tabular-nums text-slate-400">{{ total }} PDV</span>
    </div>

    <p class="mt-3 text-2xl font-bold tabular-nums" :class="tone.text">{{ gatePassPct }}%</p>
    <p class="text-xs text-slate-400">au gate (100 % requis présents)</p>

    <div class="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
      <div class="h-full rounded-full transition-[width] duration-500 ease-out" :class="tone.bar" :style="{ width: gatePassPct + '%' }" />
    </div>
    <p class="mt-2 text-xs tabular-nums text-slate-500 dark:text-slate-400">
      Taux moyen requis : <span class="font-medium">{{ avgRate }}%</span>
    </p>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  label: string
  gatePassPct: number
  avgRate: number
  total: number
  levelKey?: string
}>()

const dot = computed(() => ({
  flagship: 'bg-fc-red',
  vip: 'bg-amber-500',
  core: 'bg-sky-500',
  basic: 'bg-slate-400',
}[props.levelKey || ''] || 'bg-slate-400'))

const tone = computed(() => {
  if (props.gatePassPct >= 80) return { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' }
  if (props.gatePassPct >= 50) return { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' }
  return { bar: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' }
})
</script>
