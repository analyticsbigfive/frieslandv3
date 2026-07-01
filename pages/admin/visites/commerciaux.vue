<template>
  <div class="space-y-6">
    <header class="space-y-1">
      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-fc-red">Stats · Visites</p>
      <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Performance des commerciaux</h1>
      <p class="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
        Volume de visites par commercial, classé du plus actif au moins actif.
      </p>
    </header>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 animate-spin text-fc-red" />
    </div>

    <template v-else>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div class="admin-metric-tile">
          <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Commerciaux actifs</p>
          <p class="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{{ rows.length }}</p>
        </div>
        <div class="admin-metric-tile">
          <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Visites cumulées</p>
          <p class="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{{ totalVisites }}</p>
        </div>
        <div class="admin-metric-tile">
          <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Visites ce mois</p>
          <p class="mt-2 text-3xl font-bold tabular-nums text-fc-red">{{ totalMois }}</p>
        </div>
      </div>

      <section class="admin-surface overflow-hidden">
        <div class="flex items-center justify-between px-5 py-4">
          <h2 class="text-base font-semibold text-slate-900 dark:text-white">Classement</h2>
          <div class="flex items-center gap-3">
            <UInput v-model="search" placeholder="Rechercher…" size="sm" icon="i-heroicons-magnifying-glass" />
            <UButton size="xs" variant="ghost" icon="i-heroicons-arrow-down-tray" @click="exportCsv">CSV</UButton>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="admin-table w-full">
            <thead>
              <tr>
                <th class="w-10 text-center">#</th>
                <th>Commercial</th>
                <th class="text-center">Total visites</th>
                <th class="text-center">Ce mois</th>
                <th class="text-center">Dernière visite</th>
                <th>Volume relatif</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(com, idx) in filteredRows" :key="com.email">
                <td class="text-center text-sm tabular-nums text-slate-400">{{ idx + 1 }}</td>
                <td>
                  <div class="flex items-center gap-3">
                    <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                      {{ com.nom?.substring(0, 2).toUpperCase() }}
                    </div>
                    <div>
                      <p class="font-medium text-slate-900 dark:text-white">{{ com.nom }}</p>
                      <p class="text-xs text-slate-400">{{ com.email }}</p>
                    </div>
                  </div>
                </td>
                <td class="text-center font-semibold tabular-nums">{{ com.total_visites }}</td>
                <td class="text-center font-semibold tabular-nums text-fc-red">{{ com.visites_mois }}</td>
                <td class="text-center text-sm tabular-nums">{{ formatDate(com.derniere_visite) }}</td>
                <td>
                  <div class="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div class="h-full rounded-full bg-fc-red transition-all" :style="{ width: barWidth(com) }" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="!filteredRows.length" class="px-6 py-14 text-center">
          <UIcon name="i-heroicons-clipboard-document-list" class="mx-auto h-9 w-9 text-slate-300" />
          <p class="mt-3 text-sm font-medium text-slate-500">Aucune activité disponible</p>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

interface CommercialRow {
  nom: string
  email: string
  total_visites: number
  visites_mois: number
  derniere_visite: string | null
}

const supabase = useSupabaseClient()
const toast = useToast()
const loading = ref(true)
const search = ref('')
const rows = ref<CommercialRow[]>([])

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('fr-FR') : '—'

const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter(com =>
    (com.nom || '').toLowerCase().includes(q) || (com.email || '').toLowerCase().includes(q))
})

const totalVisites = computed(() => rows.value.reduce((sum, com) => sum + (com.total_visites || 0), 0))
const totalMois = computed(() => rows.value.reduce((sum, com) => sum + (com.visites_mois || 0), 0))

const maxVisites = computed(() => rows.value[0]?.total_visites || 1)
const barWidth = (com: CommercialRow) =>
  `${Math.max(4, Math.round(((com.total_visites || 0) / maxVisites.value) * 100))}%`

function exportCsv() {
  const header = 'Commercial;Email;Total visites;Visites ce mois;Dernière visite\n'
  const body = filteredRows.value
    .map(com => [com.nom, com.email, com.total_visites, com.visites_mois, formatDate(com.derniere_visite)].join(';'))
    .join('\n')
  const blob = new Blob([`﻿${header}${body}`], { type: 'text/csv;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = 'performance_commerciaux.csv'
  link.click()
  URL.revokeObjectURL(link.href)
}

onMounted(async () => {
  const { data, error } = await supabase
    .from('v_performance_commerciaux')
    .select('*')
    .order('total_visites', { ascending: false })
  if (error) {
    toast.add({ title: 'Chargement impossible', description: error.message, color: 'red' })
  }
  rows.value = (data || []) as CommercialRow[]
  loading.value = false
})
</script>
