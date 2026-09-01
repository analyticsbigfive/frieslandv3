<template>
  <div class="space-y-6">
    <header class="space-y-1">
      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-fc-red">Stats · Visites</p>
      <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Performance des commerciaux</h1>
      <p class="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
        Volume de visites par commercial, classé du plus actif au moins actif.
      </p>
    </header>

    <!-- Filtre période (réunion 23/07) : suivre les commerciaux jour après jour,
         pas seulement en cumul depuis l'origine. -->
    <div class="admin-surface p-4">
      <PeriodFilter v-model="periode" />
    </div>

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
          <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Visites · {{ periodeLabel }}</p>
          <p class="mt-2 text-3xl font-bold tabular-nums text-fc-red">{{ totalVisites }}</p>
        </div>
        <div class="admin-metric-tile">
          <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Visites / jour (moyenne)</p>
          <p class="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{{ moyenneParJour }}</p>
        </div>
      </div>

      <section class="admin-surface overflow-hidden">
        <div class="flex items-center justify-between px-5 py-4">
          <h2 class="text-base font-semibold text-slate-900 dark:text-white">Classement · {{ periodeLabel }}</h2>
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
                <th class="text-center">Visites</th>
                <th class="text-center">PDV distincts</th>
                <th class="text-center">Visites / jour</th>
                <th class="text-center">Dernière visite</th>
                <th>Volume relatif</th>
                <th class="text-right">Visites</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(com, idx) in filteredRows" :key="com.commercial">
                <td class="text-center text-sm tabular-nums text-slate-400">{{ idx + 1 }}</td>
                <td>
                  <div class="flex items-center gap-3">
                    <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                      {{ com.commercial?.substring(0, 2).toUpperCase() }}
                    </div>
                    <div>
                      <p class="font-medium text-slate-900 dark:text-white">{{ com.commercial }}</p>
                      <p class="text-xs text-slate-400">{{ com.email }}</p>
                    </div>
                  </div>
                </td>
                <td class="text-center font-semibold tabular-nums text-fc-red">{{ com.nb_visites }}</td>
                <td class="text-center font-semibold tabular-nums">{{ com.nb_pdv }}</td>
                <td class="text-center tabular-nums">{{ com.visites_par_jour ?? '—' }}</td>
                <td class="text-center text-sm tabular-nums">{{ formatDate(derniereVisite(com)) }}</td>
                <td>
                  <div class="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div class="h-full rounded-full bg-fc-red transition-all" :style="{ width: barWidth(com) }" />
                  </div>
                </td>
                <td class="text-right">
                  <UButton
                    size="xs"
                    variant="ghost"
                    icon="i-heroicons-arrow-top-right-on-square"
                    :to="{ path: '/admin/visites', query: { commercial: com.commercial || com.email } }"
                  >
                    Voir les visites
                  </UButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="!filteredRows.length" class="px-6 py-14 text-center">
          <UIcon name="i-heroicons-clipboard-document-list" class="mx-auto h-9 w-9 text-slate-300" />
          <p class="mt-3 text-sm font-medium text-slate-500">Aucune activité sur cette période</p>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { PeriodeValue } from '~/components/PeriodFilter.vue'
import { plageDePeriode, libellePlage } from '~/utils/periode'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

interface CommercialRow {
  commercial: string
  email: string
  nb_visites: number
  nb_pdv: number
  nb_jours: number
  visites_par_jour: number | null
  pdv_visites: { pdv_id: string; nom_pdv: string; passages: number; derniere_visite: string | null }[]
}

const { fetchCouvertureParCommercial } = usePerfectStore()
const loading = ref(true)
const search = ref('')
const rows = ref<CommercialRow[]>([])

// Même défaut que l'onglet Visites : le mois courant (demande client).
const periode = ref<PeriodeValue>({ preset: '30j', ...plageDePeriode('30j') })
const periodeLabel = computed(() => libellePlage({ debut: periode.value.debut, fin: periode.value.fin }))

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('fr-FR') : '—'

// La RPC ne remonte pas la dernière visite du commercial en tête de ligne,
// mais elle est dans le détail par PDV : on prend le max.
const derniereVisite = (com: CommercialRow): string | null =>
  (com.pdv_visites || []).reduce<string | null>(
    (max, p) => (p.derniere_visite && (!max || p.derniere_visite > max) ? p.derniere_visite : max),
    null,
  )

const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter(com =>
    (com.commercial || '').toLowerCase().includes(q) || (com.email || '').toLowerCase().includes(q))
})

const totalVisites = computed(() => rows.value.reduce((sum, com) => sum + (com.nb_visites || 0), 0))
const moyenneParJour = computed(() => {
  const avecJours = rows.value.filter(com => com.visites_par_jour != null)
  if (!avecJours.length) return '—'
  return (avecJours.reduce((sum, com) => sum + Number(com.visites_par_jour), 0) / avecJours.length).toFixed(1)
})

const maxVisites = computed(() => rows.value[0]?.nb_visites || 1)
const barWidth = (com: CommercialRow) =>
  `${Math.max(4, Math.round(((com.nb_visites || 0) / maxVisites.value) * 100))}%`

function exportCsv() {
  const header = 'Commercial;Email;Visites;PDV distincts;Visites par jour;Dernière visite\n'
  const body = filteredRows.value
    .map(com => [com.commercial, com.email, com.nb_visites, com.nb_pdv, com.visites_par_jour ?? '', formatDate(derniereVisite(com))].join(';'))
    .join('\n')
  const blob = new Blob([`﻿${header}${body}`], { type: 'text/csv;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = 'performance_commerciaux.csv'
  link.click()
  URL.revokeObjectURL(link.href)
}

async function chargerClassement() {
  loading.value = true
  rows.value = await fetchCouvertureParCommercial({
    dateDebut: periode.value.debut || undefined,
    dateFin: periode.value.fin || undefined,
  }) as unknown as CommercialRow[]
  loading.value = false
}

watch(periode, chargerClassement, { deep: true })
onMounted(chargerClassement)
</script>
