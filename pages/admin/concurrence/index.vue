<template>
  <div class="space-y-6">
    <AdminPageHeader
      description="Où la concurrence est relevée, quelles marques, et quels concurrents sont actifs sur le terrain."
    />

    <DashboardFilters
      v-model="dashboard.filters.value"
      @filter="dashboard.fetchVisites()"
    />

    <ChargementContenu v-if="dashboard.loading.value" libelle="Chargement des visites…" />

    <template v-else>
      <!-- Indicateurs -->
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard title="Visites analysées" :value="dashboard.totalVisites.value" icon="i-heroicons-clipboard-document-list" color="blue" />
        <StatsCard
          title="Visites avec concurrence"
          :value="`${concPct.toLocaleString('fr-FR')} %`"
          format="none"
          subtitle="au moins une famille concernée"
          icon="i-heroicons-exclamation-triangle"
          color="red"
        />
        <StatsCard
          title="Visites avec un concurrent actif"
          :value="enActiviteCount"
          subtitle="promotion, fidélité, référencement…"
          icon="i-heroicons-megaphone"
          color="orange"
        />
        <StatsCard
          title="Concurrents signalés"
          :value="concurrentsLibres.length"
          subtitle="noms saisis sur le terrain"
          icon="i-heroicons-user-plus"
          color="blue"
        />
      </div>

      <!-- 1. Présence par famille, puis part de chaque marque -->
      <section class="space-y-3">
        <div>
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Présence de la concurrence par famille de produits</h2>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Part des visites où un concurrent est relevé dans la famille, puis part de chaque marque parmi ces visites.
          </p>
        </div>
        <div v-if="!dashboard.totalVisites.value" class="admin-surface p-8 text-center text-sm text-slate-600 dark:text-slate-300">
          Aucune visite sur la période. Élargissez la période ou changez les filtres.
        </div>
        <div v-else class="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <article v-for="cat in categories" :key="cat.key" class="admin-surface p-5">
            <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 class="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
                <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: couleurFamille(cat.key) }" aria-hidden="true" />
                {{ cat.label }}
              </h3>
              <p class="text-sm tabular-nums text-slate-600 dark:text-slate-300">
                <strong class="text-base font-semibold text-slate-900 dark:text-white">{{ nombre(pctFamille(cat.key)) }} %</strong> des visites
              </p>
            </div>
            <p class="mt-0.5 text-xs tabular-nums text-slate-600 dark:text-slate-300">
              Concurrence relevée dans {{ nombre(catPresent(cat.key)) }} visite{{ catPresent(cat.key) > 1 ? 's' : '' }} sur {{ nombre(dashboard.totalVisites.value) }}.
            </p>

            <ul v-if="catPresent(cat.key)" class="mt-4 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700">
              <li v-for="comp in cat.competitors" :key="comp.key">
                <div class="flex items-baseline justify-between gap-3 text-sm">
                  <span class="min-w-0 text-slate-700 dark:text-slate-200">{{ comp.label }}</span>
                  <span class="shrink-0 font-semibold tabular-nums text-slate-900 dark:text-white">{{ getCompPct(cat.key, comp.key) }} %</span>
                </div>
                <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700" aria-hidden="true">
                  <div class="h-full rounded-full" :style="{ width: `${getCompPct(cat.key, comp.key)}%`, backgroundColor: couleurFamille(cat.key) }" />
                </div>
              </li>
            </ul>
            <p v-else class="mt-4 border-t border-slate-200 pt-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
              Aucun concurrent relevé dans cette famille sur la période.
            </p>
          </article>
        </div>
      </section>

      <!-- 2. Concurrents signalés en texte libre, agrégés par nom normalisé
           (« Cowmilk », « cowmilk » et « Cow Milk » = une seule ligne). -->
      <section class="admin-surface overflow-hidden">
        <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-4">
          <div class="min-w-0">
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Concurrents signalés par les merchandisers</h2>
            <p class="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
              Noms saisis librement pendant les visites, regroupés quand ils s'écrivent différemment.
            </p>
          </div>
          <span class="text-sm tabular-nums text-slate-600 dark:text-slate-300">
            {{ concurrentsLibres.length }} nom{{ concurrentsLibres.length > 1 ? 's' : '' }} distinct{{ concurrentsLibres.length > 1 ? 's' : '' }}
          </span>
        </div>

        <p
          v-if="!concurrentsLibres.length"
          class="border-t border-slate-200 px-5 py-8 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
        >
          Aucun concurrent saisi librement sur la période. Les noms apparaîtront ici quand un merchandiser en signalera un.
        </p>

        <div v-else class="overflow-x-auto border-t border-slate-200 dark:border-slate-700">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Concurrent</th>
                <th class="text-right">Signalements</th>
                <th class="text-right">En activité</th>
                <th>Actions relevées</th>
                <th>Photos</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in concurrentsLibres" :key="c.cle">
                <td>
                  <p class="font-medium text-slate-900 dark:text-white">{{ c.nom }}</p>
                  <p v-if="c.categories.length" class="text-xs text-slate-500 dark:text-slate-400">
                    Famille{{ c.categories.length > 1 ? 's' : '' }} : {{ c.categories.map(libelleFamille).join(', ') }}
                  </p>
                </td>
                <td class="text-right tabular-nums">{{ c.signalements }}</td>
                <td class="text-right tabular-nums" :class="c.en_activite ? 'font-semibold text-amber-700 dark:text-amber-400' : ''">
                  {{ c.en_activite }}
                </td>
                <td>
                  <div v-if="c.actions.length" class="flex flex-wrap gap-1.5">
                    <span
                      v-for="a in c.actions"
                      :key="a"
                      class="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                    >{{ a }}</span>
                  </div>
                  <span v-else class="text-sm text-slate-500 dark:text-slate-400">Aucune</span>
                </td>
                <td>
                  <div v-if="c.photos.length" class="flex gap-1">
                    <a
                      v-for="(p, i) in c.photos.slice(0, 3)"
                      :key="p"
                      :href="p"
                      target="_blank"
                      rel="noopener"
                      class="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                      <img :src="p" :alt="`Photo ${i + 1} de ${c.nom} (s'ouvre dans un nouvel onglet)`" class="h-9 w-9 rounded object-cover" />
                    </a>
                  </div>
                  <span v-else class="text-sm text-slate-500 dark:text-slate-400">Aucune</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- 3. Évolution par semaine -->
      <section class="admin-surface p-5 sm:p-6">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Évolution de la concurrence par semaine</h2>
        <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Nombre de visites où un concurrent est relevé, par famille de produits.
        </p>
        <ClientOnly>
          <div v-if="evolutionChartData" class="mt-4 h-72">
            <Bar :data="evolutionChartData" :options="chartOptions" />
          </div>
          <p v-else class="mt-4 text-sm text-slate-600 dark:text-slate-300">
            Pas assez de visites sur la période pour tracer une évolution. Élargissez la période.
          </p>
        </ClientOnly>
      </section>

      <!-- 4. Présence par référence concurrente : part des visites où la famille
           est présente et où la référence est relevée « Présent ». -->
      <section v-if="skuRows.length" class="space-y-3">
        <div>
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Présence par référence concurrente</h2>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Part des visites où la référence est en rayon, parmi celles où un concurrent est relevé dans la famille.
          </p>
        </div>
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <article v-for="fam in skuRows" :key="fam.key" class="admin-surface p-5">
            <h3 class="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
              <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: couleurFamille(fam.key) }" aria-hidden="true" />
              {{ fam.label }}
            </h3>
            <ul class="mt-4 space-y-3">
              <li v-for="sku in fam.skus" :key="sku.code">
                <div class="flex items-center justify-between gap-3 text-sm">
                  <span class="flex min-w-0 items-center gap-2 text-slate-700 dark:text-slate-200">
                    <img v-if="sku.image_url" :src="sku.image_url" alt="" class="h-6 w-6 shrink-0 rounded object-cover" />
                    <span class="min-w-0">{{ sku.libelle }}</span>
                  </span>
                  <span class="shrink-0 font-semibold tabular-nums text-slate-900 dark:text-white">{{ sku.pct }} %</span>
                </div>
                <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700" aria-hidden="true">
                  <div class="h-full rounded-full" :style="{ width: `${sku.pct}%`, backgroundColor: couleurFamille(fam.key) }" />
                </div>
              </li>
            </ul>
          </article>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Bar } from 'vue-chartjs'
import { AXES, couleurFamille } from '~/utils/chartPalette'
import { getCategoryDef } from '~/utils/products'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const dashboard = useDashboardDirection()

// Nombres à la française (« 9 587 »).
const nombre = (n: number) => n.toLocaleString('fr-FR')

const concPct = computed(() =>
  dashboard.pctWhere(v => v.data?.concurrence?.presence_concurrents)
)

// Familles + marques depuis le référentiel marque_concurrente (réunion 23/07) :
// une marque ajoutée dans les Référentiels apparaît ici sans redéploiement.
const { categories, skus: skusConcurrents, charger: chargerMarques } = useMarquesConcurrentes()

// Taux de présence par SKU, sur les visites où la famille est présente (même
// dénominateur que getCompPct pour rester comparable à la marque).
const skuRows = computed(() =>
  categories.value
    .map((cat) => {
      const withConc = dashboard.visites.value.filter(v => v.data?.concurrence?.[cat.key]?.present)
      const skus = skusConcurrents.value
        .filter(s => s.famille === cat.key)
        .map(s => ({
          code: s.code,
          libelle: s.libelle,
          image_url: s.image_url,
          pct: withConc.length
            ? Math.round(withConc.filter(v => v.data?.concurrence?.[cat.key]?.skus?.[s.code] === 'Présent').length / withConc.length * 100)
            : 0,
        }))
      return { key: cat.key, label: cat.label, skus }
    })
    .filter(fam => fam.skus.length > 0),
)

// Un concurrent présent mais inactif n'appelle pas la même réaction qu'un
// concurrent qui pousse une promo : on compte les visites où au moins une
// famille est déclarée « en activité ».
const enActiviteCount = computed(() =>
  dashboard.countWhere(v => categories.value.some(cat => v.data?.concurrence?.[cat.key]?.en_activite))
)

// Agrégation sur nom normalisé, ancien et nouveau format confondus.
const concurrentsLibres = computed(() => agregerConcurrents(dashboard.visites.value))

// Code de famille (« evap ») → libellé du catalogue (« EVAP »).
const libelleFamille = (code: string) => getCategoryDef(code)?.label || code.toUpperCase()

function catPresent(catKey: string) {
  return dashboard.countWhere(v => v.data?.concurrence?.[catKey]?.present)
}

// Part des visites où la famille est concernée (ce qu'affichait le camembert
// présent / absent).
function pctFamille(catKey: string) {
  const total = dashboard.totalVisites.value
  return total ? Math.round(catPresent(catKey) / total * 1000) / 10 : 0
}

function getCompPct(catKey: string, compKey: string) {
  const withConc = dashboard.visites.value.filter(v => v.data?.concurrence?.[catKey]?.present)
  if (withConc.length === 0) return 0
  const count = withConc.filter(v => v.data?.concurrence?.[catKey]?.[compKey] === 'Présent').length
  return Math.round(count / withConc.length * 100)
}

const evolutionChartData = computed(() => {
  if (!dashboard.visites.value.length) return null

  const weeks = new Map<string, Record<string, number>>()
  const catKeys = categories.value.map(c => c.key)

  dashboard.visites.value.forEach(v => {
    const d = new Date(v.date_visite)
    const weekStart = new Date(d)
    weekStart.setDate(d.getDate() - d.getDay())
    const key = weekStart.toISOString().slice(0, 10)

    if (!weeks.has(key)) {
      weeks.set(key, Object.fromEntries(catKeys.map(k => [k, 0])))
    }
    const w = weeks.get(key)!
    for (const k of catKeys) {
      if (v.data?.concurrence?.[k]?.present) w[k]++
    }
  })

  const sorted = [...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0]))

  return {
    labels: sorted.map(([k]) => new Date(k).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })),
    // La couleur suit la famille, comme dans les cartes au-dessus.
    datasets: categories.value.map(cat => ({
      label: cat.label,
      data: sorted.map(([, v]) => v[cat.key]),
      backgroundColor: couleurFamille(cat.key),
      maxBarThickness: 40,
    })),
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
      labels: { usePointStyle: true, pointStyle: 'circle', font: { size: AXES.taillePolice }, color: AXES.texte, padding: 12 },
    },
    tooltip: { backgroundColor: AXES.infobulleFond, titleColor: AXES.infobulleTexte, bodyColor: AXES.infobulleTexte, padding: 10, cornerRadius: 8 },
  },
  scales: {
    x: { stacked: true, grid: { display: false }, ticks: { font: { size: AXES.taillePolice }, color: AXES.texte } },
    y: { stacked: true, beginAtZero: true, grid: { color: AXES.grille }, ticks: { font: { size: AXES.taillePolice }, color: AXES.texte, precision: 0 } },
  },
}

onMounted(() => {
  Promise.all([dashboard.fetchVisites(), chargerMarques()])
})
</script>
