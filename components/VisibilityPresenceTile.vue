<template>
  <div class="admin-metric-tile flex items-center gap-4">
    <ChartsPieChart
      :labels="['Présent', 'Absent']"
      :values="[present, absent]"
      :colors="['#10B981', '#E2E8F0']"
      bare
      height="xs"
      :show-legend="false"
      cutout="72%"
      class="w-24 shrink-0"
    />
    <div class="min-w-0">
      <p class="text-xs font-medium uppercase tracking-wide text-slate-400">{{ label }}</p>
      <p class="mt-1 text-2xl font-bold tabular-nums" :class="pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-rose-600'">
        {{ pct }}%
      </p>
      <p class="mt-0.5 truncate text-xs tabular-nums text-slate-400">
        {{ present }} présent{{ present > 1 ? 's' : '' }} · {{ absent }} absent{{ absent > 1 ? 's' : '' }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  label?: string
  present: number
  total: number
}>(), {
  label: 'Taux de présence',
})

const absent = computed(() => Math.max(props.total - props.present, 0))
const pct = computed(() => (props.total ? Math.round((props.present / props.total) * 100) : 0))
</script>
