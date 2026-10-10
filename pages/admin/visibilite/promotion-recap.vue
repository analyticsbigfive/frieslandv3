<template>
  <div class="space-y-6">
    <AdminPageHeader
      description="Éléments de promotion relevés en magasin : présence par élément, conformité par niveau et détail par visite."
    />

    <DashboardFilters
      v-model="dashboard.filters.value"
      @filter="dashboard.fetchVisites()"
    />

    <ChargementContenu v-if="dashboard.loading.value" libelle="Chargement des visites…" />
    <template v-else>
      <!-- Indicateurs -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard
          title="Visites où une promotion s'applique"
          :value="promoApplicableCount"
          :subtitle="`sur ${nombre(totalVisites)} visites analysées`"
          icon="i-heroicons-clipboard-document-list"
          color="blue"
        />
        <StatsCard
          title="Visites avec au moins un élément de promotion"
          :value="promoPresenceCount"
          icon="i-heroicons-megaphone"
          color="green"
        />
        <StatsCard
          title="Taux de présence des éléments"
          :value="`${pct(promoTotals.present, promoTotals.applicable)} %`"
          format="none"
          :subtitle="`${nombre(promoTotals.present)} présents sur ${nombre(promoTotals.applicable)} attendus`"
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
          Parmi les visites où une promotion s'applique, part de celles où <strong class="font-semibold text-slate-900 dark:text-white">tous</strong>
          les éléments de promotion requis pour le niveau du point de vente sont présents.
        </p>
        <dl class="mt-5 grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          <div v-for="lvl in promoConformity" :key="lvl.key" class="min-w-0">
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
              Aucune visite d'un point de vente de ce niveau avec une promotion sur la période.
            </dd>
          </div>
        </dl>
      </section>

      <!-- Détail par visite -->
      <section class="admin-surface overflow-hidden">
        <div class="px-5 py-4">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Détail par visite</h2>
          <p class="mt-0.5 text-sm tabular-nums text-slate-600 dark:text-slate-300">
            {{ nombre(tableRows.length) }} visite{{ tableRows.length > 1 ? 's' : '' }}
          </p>
        </div>

        <ul
          v-if="promoColumns.length"
          class="flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-200 px-5 py-2.5 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"
          aria-label="Légende du tableau"
        >
          <li v-for="e in legende" :key="e.libelle" class="inline-flex items-center gap-1.5">
            <UIcon :name="e.icone" class="h-4 w-4" :class="e.classe" aria-hidden="true" />
            {{ e.libelle }}
          </li>
        </ul>

        <div class="overflow-x-auto border-t border-slate-200 dark:border-slate-700">
          <table class="admin-table">
            <thead>
              <tr>
                <th class="sticky left-0 z-10 bg-slate-50 dark:bg-slate-800">Point de vente</th>
                <th>Territoire</th>
                <th class="text-center">Promotion applicable</th>
                <th v-for="col in promoColumns" :key="col.code" class="text-center align-bottom">
                  <span class="mx-auto block w-28 leading-snug">{{ col.label }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!paginatedRows.length">
                <td :colspan="3 + promoColumns.length" class="py-8 text-center text-slate-600 dark:text-slate-300">
                  Aucune visite sur la période. Élargissez la période ou changez les filtres.
                </td>
              </tr>
              <tr v-for="(row, idx) in paginatedRows" :key="idx" class="group">
                <td class="sticky left-0 z-10 bg-white group-hover:bg-slate-50 dark:bg-slate-800 dark:group-hover:bg-slate-700">
                  <div class="flex items-center gap-1.5">
                    <span class="max-w-[200px] truncate font-medium text-slate-900 dark:text-white" :title="row.nom">{{ row.nom }}</span>
                    <PDVPhotoModal :pdv-id="row.pdv_id" :image-url="row.image_url" :pdv-name="row.nom" />
                  </div>
                  <p v-if="row.sousCategorie" class="text-xs text-slate-500 dark:text-slate-400">{{ row.sousCategorie }}</p>
                </td>
                <td>{{ row.zone || 'Non renseigné' }}</td>
                <td class="text-center">
                  <span
                    v-if="row.promoApplicable"
                    class="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800 dark:bg-slate-700 dark:text-slate-100"
                  >Oui</span>
                  <span v-else class="text-sm text-slate-600 dark:text-slate-300">Non</span>
                </td>
                <td v-for="col in promoColumns" :key="col.code + idx" class="text-center">
                  <span class="inline-flex" :title="etat(row, col.code).libelle">
                    <UIcon :name="etat(row, col.code).icone" class="h-5 w-5" :class="etat(row, col.code).classe" aria-hidden="true" />
                    <span class="sr-only">{{ etat(row, col.code).libelle }}</span>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="border-t border-slate-200 px-5 py-3 dark:border-slate-700">
          <AdminPagination
            :total="tableRows.length"
            :page="page"
            :page-size="100"
            item-label="visite(s)"
            @update:page="(p) => page = p"
          />
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { STATUT } from '~/utils/chartPalette'
import { isModernTrade as isCanalModernTrade } from '~/utils/canal'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const dashboard = useDashboardDirection()
const { typePdvLabel, fetchTypePdvLabels } = useTypePdvLabels()
const { fetchElements, aggregate, columns, applicable, standardsOf, hasPresence, elementTotals } = useVisibilityAggregation()
const { fetchConformity, byLevel } = useVisibilityConformity()
const page = ref(1)

const isModernTrade = (v: any) => isCanalModernTrade(v.pdv?.canal)
const promoApplicable = (v: any) => (v?.data?.visibilite?.promotion_applicable) !== false
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)

// Nombres à la française (« 9 587 »).
const nombre = (n: number) => n.toLocaleString('fr-FR')

const promoConformity = computed(() => byLevel(dashboard.visites.value.filter(promoApplicable), 'promotion'))

const totalVisites = computed(() => dashboard.visites.value.length)
const promoApplicableCount = computed(() => dashboard.visites.value.filter(promoApplicable).length)
const promoPresenceCount = computed(() => dashboard.visites.value.filter(v => hasPresence(v, 'promotion')).length)
const promoTotals = computed(() => elementTotals(dashboard.visites.value, 'promotion'))

const gtVisites = computed(() => dashboard.visites.value.filter(v => !isModernTrade(v)))
const mtVisites = computed(() => dashboard.visites.value.filter(isModernTrade))
const gtCount = computed(() => gtVisites.value.length)
const mtCount = computed(() => mtVisites.value.length)
const gtElements = computed(() => aggregate(gtVisites.value, 'promotion'))
const mtElements = computed(() => aggregate(mtVisites.value, 'promotion'))

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

const promoColumns = computed(() => columns(dashboard.visites.value, 'promotion'))

// État d'une cellule : icône + libellé (jamais la couleur seule).
const ETATS = {
  present: { icone: 'i-heroicons-check-circle-20-solid', classe: 'text-emerald-700 dark:text-emerald-400', libelle: 'Présent' },
  absent: { icone: 'i-heroicons-x-circle', classe: 'text-red-600 dark:text-red-400', libelle: 'Absent' },
  nonPrevu: { icone: 'i-heroicons-minus-20-solid', classe: 'text-slate-500 dark:text-slate-400', libelle: 'Non prévu pour ce type de point de vente' },
}
const legende = [ETATS.present, ETATS.absent, ETATS.nonPrevu]
function etat(row: { applicable: Record<string, boolean>; standards: Record<string, boolean> }, code: string) {
  if (!row.applicable[code]) return ETATS.nonPrevu
  return row.standards[code] ? ETATS.present : ETATS.absent
}

const tableRows = computed(() => dashboard.visites.value.map(v => ({
  nom: v.pdv?.nom_pdv || 'Point de vente sans nom',
  pdv_id: v.pdv?.pdv_id || '',
  image_url: (v.pdv as any)?.image_url || null,
  zone: v.pdv?.zone || '',
  sousCategorie: typePdvLabel(v.pdv?.sous_categorie_pdv) || '',
  promoApplicable: promoApplicable(v),
  standards: standardsOf(v),
  applicable: applicable(v.pdv?.sous_categorie_pdv, 'promotion'),
})))

const paginatedRows = computed(() => tableRows.value.slice((page.value - 1) * 100, page.value * 100))
watch(tableRows, () => { page.value = 1 })

onMounted(() => {
  Promise.all([dashboard.fetchVisites(), fetchElements(), fetchConformity(), fetchTypePdvLabels()])
})
</script>
