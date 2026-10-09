<template>
  <div class="space-y-6">
    <AdminPageHeader description="Le nombre de visites par jour, par semaine ou par mois sur la période choisie." />

    <DashboardFilters
      v-model="dashboard.filters.value"
      :show-area="false"
      @filter="dashboard.fetchVisites()"
    />

    <ChargementContenu v-if="dashboard.loading.value" variante="cartes" :nombre="2" classe-carte="admin-surface" libelle="Chargement des visites…" />

    <template v-else>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard title="Visites" :value="dashboard.totalVisites.value" :subtitle="periodLabel" icon="i-heroicons-clipboard-document-list" color="red" />
        <StatsCard title="Visites faites sur place" :value="gpsOkCount" subtitle="Démarrées dans le rayon de visite" icon="i-heroicons-map-pin" color="green" />
        <StatsCard title="Merchandisers actifs" :value="commerciauxCount" subtitle="Au moins une visite sur la période" icon="i-heroicons-users" />
      </div>

      <div class="flex flex-wrap items-center justify-end gap-2">
        <label for="regroupement-visites" class="text-sm text-slate-700 dark:text-slate-200">Regrouper</label>
        <USelect
          id="regroupement-visites"
          v-model="groupBy"
          :options="[
            { label: 'Par jour', value: 'day' },
            { label: 'Par semaine', value: 'week' },
            { label: 'Par mois', value: 'month' },
          ]"
          option-attribute="label"
          value-attribute="value"
          size="sm"
          class="w-36"
        />
      </div>

      <ClientOnly>
        <ChartsMultiLineChart
          :title="`Visites par ${groupByLabel}`"
          :subtitle="groupBy === 'week' ? 'Semaines du lundi au dimanche.' : 'Sur la période et le périmètre choisis.'"
          :labels="chartLabels"
          :series="[{ label: 'Visites', data: chartValues }]"
          empty-label="Aucune visite sur la période. Élargissez les dates ou retirez des filtres."
        />
      </ClientOnly>

      <section class="admin-surface overflow-hidden">
        <div class="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 class="text-base font-semibold text-slate-900 dark:text-white">Détail par {{ groupByLabel }}</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Période</th>
                <th class="text-right">Visites</th>
                <th class="text-right">Faites sur place</th>
                <th class="text-right">Merchandisers actifs</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in tableData" :key="row.period">
                <td class="font-medium text-slate-900 dark:text-white">{{ row.period }}</td>
                <td class="text-right font-semibold tabular-nums text-slate-900 dark:text-white">{{ row.count.toLocaleString('fr-FR') }}</td>
                <td class="text-right tabular-nums">{{ row.gpsOk.toLocaleString('fr-FR') }}</td>
                <td class="text-right tabular-nums">{{ row.commerciaux.toLocaleString('fr-FR') }}</td>
              </tr>
              <tr v-if="!tableData.length">
                <td colspan="4" class="py-8 text-center text-slate-600 dark:text-slate-300">
                  Aucune visite sur la période. Élargissez les dates ou retirez des filtres.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { agregerParPeriode, clePeriode, type Granularite } from '~/utils/agregation'
import { libellePlage } from '~/utils/periode'
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const dashboard = useDashboardDirection()
const groupBy = ref('day')

const groupByLabel = computed(() => {
  if (groupBy.value === 'week') return 'semaine'
  if (groupBy.value === 'month') return 'mois'
  return 'jour'
})

const gpsOkCount = computed(() =>
  dashboard.visites.value.filter((v: any) => v.geofence_validated).length
)
const commerciauxCount = computed(() =>
  new Set(dashboard.visites.value.map(v => v.commercial).filter(Boolean)).size
)
const periodLabel = computed(() => {
  const f = dashboard.filters.value
  return f.dateFrom || f.dateTo ? `Période : ${libellePlage({ debut: f.dateFrom || '', fin: f.dateTo || '' })}` : 'Depuis le début'
})

// Regroupement par période : utils/agregation.ts (lot 5), même convention de
// semaine ISO que les autres écrans. Les compteurs annexes (GPS, commerciaux)
// sont recalculés par clé de période.
const granularite = computed<Granularite>(() => ({ day: 'jour', week: 'semaine', month: 'mois' } as const)[groupBy.value] || 'jour')

const tableData = computed(() => {
  const visites = dashboard.visites.value as any[]
  const points = agregerParPeriode(visites, v => v.date_visite, granularite.value)
  const gpsOk = new Map(agregerParPeriode(visites, v => v.date_visite, granularite.value, v => !!v.geofence_validated).map(p => [p.cle, p.match]))
  const commerciaux = new Map<string, Set<string>>()
  for (const v of visites) {
    if (!v.date_visite || !v.commercial) continue
    const { cle } = clePeriode(new Date(v.date_visite), granularite.value)
    ;(commerciaux.get(cle) || commerciaux.set(cle, new Set()).get(cle)!).add(v.commercial)
  }
  return points.map(p => ({
    period: p.label,
    count: p.total,
    gpsOk: gpsOk.get(p.cle) || 0,
    commerciaux: commerciaux.get(p.cle)?.size || 0,
  }))
})

// Courbe dans l'ordre chronologique de tableData (le tri par libellé de
// VisitesLineChart mélangeait « S9 » et « S10 », « août » et « juillet »).
const chartLabels = computed(() => tableData.value.map(r => r.period))
const chartValues = computed(() => tableData.value.map(r => r.count))

onMounted(() => {
  Promise.all([dashboard.fetchVisites()])
})
</script>
