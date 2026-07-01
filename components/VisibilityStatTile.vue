<template>
  <div class="group rounded-xl border border-slate-200/70 bg-white p-4 transition duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_28px_-24px_rgba(15,23,42,0.55)] dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-slate-600">
    <div class="flex items-start justify-between gap-2">
      <p class="text-sm font-medium leading-tight text-slate-700 dark:text-slate-200">{{ label }}</p>
      <span class="text-lg font-semibold tabular-nums" :class="tone.text">{{ pct }}%</span>
    </div>
    <div class="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
      <div
        class="h-full rounded-full transition-[width] duration-500 ease-out"
        :class="tone.bar"
        :style="{ width: pct + '%' }"
      />
    </div>
    <p class="mt-2 text-xs tabular-nums text-slate-400 dark:text-slate-500">
      {{ present }} / {{ total }} présents
    </p>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ label: string; present: number; total: number }>()

const pct = computed(() => (props.total ? Math.round((props.present / props.total) * 100) : 0))

// Contraste porteur de sens : vert (≥80), ambre (≥50), rouge (<50).
const tone = computed(() => {
  if (pct.value >= 80) return { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' }
  if (pct.value >= 50) return { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' }
  return { bar: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' }
})
</script>
