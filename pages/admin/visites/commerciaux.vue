<template>
  <div class="space-y-6">
    <!-- visites.commercial contient l'auteur de la visite : le merchandiser
         (même libellé que le filtre de l'onglet « Toutes les visites »). -->
    <AdminPageHeader description="Le volume de visites de chaque merchandiser sur la période, du plus actif au moins actif." />

    <!-- Filtre période (réunion 23/07) : suivre les commerciaux jour après jour,
         pas seulement en cumul depuis l'origine. -->
    <div class="admin-toolbar">
      <PeriodFilter v-model="periode" />
    </div>

    <ChargementContenu v-if="loading" variante="cartes" :nombre="2" classe-carte="admin-surface" libelle="Chargement du classement…" />

    <template v-else>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard title="Merchandisers actifs" :value="rows.length" subtitle="Au moins une visite sur la période" icon="i-heroicons-users" />
        <StatsCard title="Visites" :value="totalVisites" :subtitle="periodeLabel" icon="i-heroicons-clipboard-document-list" color="red" />
        <StatsCard title="Visites par jour (moyenne)" :value="moyenneParJour" subtitle="Sur les jours avec au moins une visite" icon="i-heroicons-calendar-days" format="none" />
      </div>

      <section class="admin-surface overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 class="text-base font-semibold text-slate-900 dark:text-white">Classement · {{ periodeLabel }}</h2>
          <div class="flex flex-wrap items-center gap-2">
            <UInput
              v-model="search"
              placeholder="Nom ou e-mail…"
              aria-label="Rechercher un merchandiser dans le classement"
              size="sm"
              icon="i-heroicons-magnifying-glass"
            />
            <UButton size="sm" variant="outline" icon="i-heroicons-arrow-down-tray" :disabled="!filteredRows.length" @click="exportCsv">Exporter (CSV)</UButton>
          </div>
        </div>
        <div v-if="filteredRows.length" class="overflow-x-auto">
          <table class="admin-table">
            <thead>
              <tr>
                <th class="w-14 text-right">Rang</th>
                <th>Merchandiser</th>
                <th class="text-right">Visites sur la période</th>
                <th class="text-right">Points de vente distincts</th>
                <th class="text-right">Visites par jour</th>
                <th class="text-right">Dernière visite</th>
                <th>Part du plus actif</th>
                <th class="text-right"><span class="sr-only">Lien vers ses visites</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(com, idx) in filteredRows" :key="com.commercial">
                <td class="text-right tabular-nums text-slate-600 dark:text-slate-300">{{ rangDe(com, idx) }}</td>
                <td>
                  <div class="flex items-center gap-3">
                    <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200" aria-hidden="true">
                      {{ com.commercial?.substring(0, 2).toUpperCase() }}
                    </div>
                    <div>
                      <p class="font-medium text-slate-900 dark:text-white">{{ com.commercial || '—' }}</p>
                      <p class="text-xs text-slate-500 dark:text-slate-400">{{ com.email }}</p>
                    </div>
                  </div>
                </td>
                <td class="text-right font-semibold tabular-nums text-slate-900 dark:text-white">{{ com.nb_visites.toLocaleString('fr-FR') }}</td>
                <td class="text-right tabular-nums">{{ com.nb_pdv.toLocaleString('fr-FR') }}</td>
                <td class="text-right tabular-nums">{{ com.visites_par_jour ?? '—' }}</td>
                <td class="whitespace-nowrap text-right tabular-nums">{{ formatDate(derniereVisite(com)) }}</td>
                <td>
                  <div class="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700" :title="`${barWidth(com)} du volume du merchandiser le plus actif`" aria-hidden="true">
                    <div class="h-full rounded-full" :style="{ width: barWidth(com), backgroundColor: SERIES[0] }" />
                  </div>
                </td>
                <td class="text-right">
                  <UButton
                    size="xs"
                    color="gray"
                    variant="ghost"
                    trailing-icon="i-heroicons-arrow-right"
                    :to="{ path: '/admin/visites', query: { commercial: com.commercial || com.email } }"
                    :aria-label="`Voir les visites de ${com.commercial || com.email}`"
                  >
                    Voir les visites
                  </UButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="px-6 py-14 text-center">
          <UIcon name="i-heroicons-clipboard-document-list" class="mx-auto h-9 w-9 text-slate-300 dark:text-slate-600" aria-hidden="true" />
          <template v-if="search && rows.length">
            <p class="mt-3 text-sm font-medium text-slate-900 dark:text-white">Aucun merchandiser ne correspond à « {{ search }} »</p>
            <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Vérifiez l’orthographe ou effacez la recherche.</p>
          </template>
          <template v-else>
            <p class="mt-3 text-sm font-medium text-slate-900 dark:text-white">Aucune visite sur cette période</p>
            <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Choisissez une période plus longue, par exemple « 30 jours » ou « Trimestre ».</p>
          </template>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { PeriodeValue } from '~/components/PeriodFilter.vue'
import { plageDePeriode, libellePlage } from '~/utils/periode'
import { SERIES } from '~/utils/chartPalette'

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

// Le rang reste celui du classement complet, même quand la recherche filtre.
function rangDe(com: CommercialRow, idx: number): number {
  const i = rows.value.indexOf(com)
  return (i >= 0 ? i : idx) + 1
}

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
