<template>
  <div class="space-y-6">
    <AdminPageHeader
      description="Éléments de visibilité relevés à l'intérieur des points de vente visités, en boutiques (GT) et en supermarchés (MT)."
    />

    <DashboardFilters
      v-model="dashboard.filters.value"
      @filter="dashboard.fetchVisites()"
    />

    <ChargementContenu v-if="dashboard.loading.value" libelle="Chargement des visites…" />
    <template v-else>
      <!-- Indicateurs -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard title="Visites analysées" :value="totalVisites" icon="i-heroicons-clipboard-document-list" color="blue" />
        <StatsCard
          title="Visites avec au moins un élément intérieur"
          :value="visIntCount"
          icon="i-heroicons-eye"
          color="green"
        />
        <StatsCard
          title="Taux de présence des éléments"
          :value="`${pct(intTotals.present, intTotals.applicable)} %`"
          format="none"
          :subtitle="`${nombre(intTotals.present)} présents sur ${nombre(intTotals.applicable)} attendus`"
          icon="i-heroicons-chart-bar"
          color="green"
        />
      </div>

      <!-- Présence par élément, par canal -->
      <div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section v-for="canal in canaux" :key="canal.cle" class="admin-surface p-5 sm:p-6">
          <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">{{ canal.titre }}</h2>
            <span class="text-sm tabular-nums text-slate-600 dark:text-slate-300">
              {{ nombre(canal.visites) }} visite{{ canal.visites > 1 ? 's' : '' }}
            </span>
          </div>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Part des visites où l'élément est présent, parmi celles où il est prévu.
          </p>
          <ul v-if="canal.elements.length" class="mt-5 space-y-4">
            <li v-for="el in canal.elements" :key="`${canal.cle}-${el.code}`">
              <div class="flex items-baseline justify-between gap-3 text-sm">
                <span class="min-w-0 text-slate-700 dark:text-slate-200">{{ el.label }}</span>
                <span class="shrink-0 tabular-nums text-slate-600 dark:text-slate-300">
                  <strong class="font-semibold text-slate-900 dark:text-white">{{ pct(el.present, el.applicable) }} %</strong>
                  · {{ nombre(el.present) }} sur {{ nombre(el.applicable) }}
                </span>
              </div>
              <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700" aria-hidden="true">
                <div class="h-full rounded-full" :style="{ width: `${pct(el.present, el.applicable)}%`, backgroundColor: STATUT.bon }" />
              </div>
            </li>
          </ul>
          <p v-else class="mt-5 text-sm text-slate-600 dark:text-slate-300">{{ canal.vide }}</p>
        </section>
      </div>

      <!-- Conformité par niveau (éléments requis, aligné sur le score Perfect Store) -->
      <section class="admin-surface p-5 sm:p-6">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Conformité par niveau de point de vente</h2>
        <p class="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
          Part des visites où <strong class="font-semibold text-slate-900 dark:text-white">tous</strong> les éléments intérieurs requis
          pour le niveau du point de vente sont présents. Le score Perfect Store combine l'extérieur et l'intérieur : ce bloc en montre la part intérieure.
        </p>
        <dl class="mt-5 grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          <div v-for="lvl in intConformity" :key="lvl.key" class="min-w-0">
            <dt class="text-sm font-semibold text-slate-700 dark:text-slate-200">{{ lvl.label }}</dt>
            <dd v-if="lvl.total" class="mt-1">
              <p class="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{{ lvl.gatePassPct }} %</p>
              <p class="text-xs text-slate-600 dark:text-slate-300">
                des {{ nombre(lvl.total) }} visite{{ lvl.total > 1 ? 's' : '' }} ont tous les éléments requis
              </p>
              <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700" aria-hidden="true">
                <div class="h-full rounded-full" :style="{ width: `${lvl.gatePassPct}%`, backgroundColor: STATUT.bon }" />
              </div>
              <p class="mt-2 text-xs tabular-nums text-slate-600 dark:text-slate-300">
                En moyenne, {{ lvl.avgRate }} % des éléments requis sont présents.
              </p>
            </dd>
            <dd v-else class="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Aucune visite d'un point de vente de ce niveau sur la période.
            </dd>
          </div>
        </dl>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { STATUT } from '~/utils/chartPalette'
import { isModernTrade as isCanalModernTrade } from '~/utils/canal'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const dashboard = useDashboardDirection()
const { fetchElements, aggregate, hasPresence, elementTotals } = useVisibilityAggregation()
const { fetchConformity, byLevel } = useVisibilityConformity()

const isModernTrade = (v: any) => isCanalModernTrade(v.pdv?.canal)
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)

// Nombres à la française (« 9 587 »).
const nombre = (n: number) => n.toLocaleString('fr-FR')

const intConformity = computed(() => byLevel(dashboard.visites.value, 'visibilite', 'interieure'))

const totalVisites = computed(() => dashboard.visites.value.length)
const visIntCount = computed(() => dashboard.visites.value.filter(v => hasPresence(v, 'interieure')).length)
const intTotals = computed(() => elementTotals(dashboard.visites.value, 'interieure'))

const gtVisites = computed(() => dashboard.visites.value.filter(v => !isModernTrade(v)))
const mtVisites = computed(() => dashboard.visites.value.filter(isModernTrade))
const gtCount = computed(() => gtVisites.value.length)
const mtCount = computed(() => mtVisites.value.length)

const gtElements = computed(() => aggregate(gtVisites.value, 'interieure'))
const mtElements = computed(() => aggregate(mtVisites.value, 'interieure'))

// Les deux canaux côte à côte (valeurs de base inchangées : seul l'affichage
// dit « boutiques (GT) » et « supermarchés (MT) »).
const canaux = computed(() => [
  {
    cle: 'gt',
    titre: 'Boutiques (GT)',
    visites: gtCount.value,
    elements: gtElements.value,
    vide: 'Aucune visite de boutique (GT) sur la période et les filtres choisis.',
  },
  {
    cle: 'mt',
    titre: 'Supermarchés (MT)',
    visites: mtCount.value,
    elements: mtElements.value,
    vide: 'Aucune visite de supermarché (MT) sur la période et les filtres choisis.',
  },
])

onMounted(() => {
  Promise.all([dashboard.fetchVisites(), fetchElements(), fetchConformity()])
})
</script>
