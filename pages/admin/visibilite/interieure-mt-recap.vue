<template>
  <div class="space-y-6">
    <AdminPageHeader
      description="Une ligne par visite de supermarché : présence de chaque élément intérieur prévu pour le type de point de vente."
    />

    <DashboardFilters
      v-model="dashboard.filters.value"
      @filter="dashboard.fetchVisites()"
    />

    <ChargementContenu v-if="dashboard.loading.value" libelle="Chargement des visites…" />
    <template v-else>
      <!-- Indicateurs -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard title="Visites de supermarché (MT)" :value="mtVisites.length" icon="i-heroicons-building-storefront" color="blue" />
        <StatsCard
          title="Visites avec au moins un élément intérieur"
          :value="presCount"
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

      <section class="admin-surface overflow-hidden">
        <div class="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
          <div class="min-w-0">
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Détail par visite</h2>
            <p class="mt-0.5 text-sm tabular-nums text-slate-600 dark:text-slate-300">
              {{ nombre(filteredRows.length) }} visite{{ filteredRows.length > 1 ? 's' : '' }} de supermarché
              <template v-if="nbFiltresActifs"> sur {{ nombre(allRows.length) }}, filtrées par élément</template>
            </p>
          </div>
          <div v-if="intColumns.length" class="flex flex-wrap items-center gap-2">
            <UButton v-if="nbFiltresActifs" color="gray" variant="ghost" size="sm" icon="i-heroicons-x-mark" @click="effacerFiltres">
              Effacer les filtres
            </UButton>
            <UButton
              variant="outline"
              size="sm"
              icon="i-heroicons-funnel"
              :aria-expanded="filtresOuverts"
              aria-controls="filtres-elements"
              @click="filtresOuverts = !filtresOuverts"
            >
              Filtrer par élément<span v-if="nbFiltresActifs" class="tabular-nums">&nbsp;({{ nbFiltresActifs }})</span>
            </UButton>
          </div>
        </div>

        <div
          v-if="filtresOuverts && intColumns.length"
          id="filtres-elements"
          class="border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-900/30"
        >
          <p class="mb-3 text-sm text-slate-600 dark:text-slate-300">
            Gardez seulement les visites où un élément est présent, ou celles où il est absent.
          </p>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <UFormGroup v-for="col in intColumns" :key="col.code" :label="col.label" size="sm">
              <USelectMenu
                v-model="colFilters[col.code]"
                :options="optionsPresence"
                value-attribute="value"
                option-attribute="label"
                placeholder="Tous"
                size="sm"
              />
            </UFormGroup>
          </div>
        </div>

        <ul
          v-if="intColumns.length"
          class="flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-200 px-5 py-2.5 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"
          aria-label="Légende du tableau"
        >
          <li v-for="e in legende" :key="e.libelle" class="inline-flex items-center gap-1.5">
            <UIcon :name="e.icone" class="h-4 w-4" :class="e.classe" aria-hidden="true" />
            {{ e.libelle }}
          </li>
        </ul>

        <div class="overflow-x-auto border-t border-slate-200 dark:border-slate-700">
          <table class="admin-table" data-no-column-tools>
            <thead>
              <tr>
                <th class="sticky left-0 z-10 bg-slate-50 dark:bg-slate-800">Point de vente</th>
                <th>Localisation</th>
                <th v-for="col in intColumns" :key="col.code" class="text-center align-bottom">
                  <span class="mx-auto block w-28 leading-snug">{{ col.label }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!paginatedRows.length">
                <td :colspan="2 + intColumns.length" class="py-8 text-center text-slate-600 dark:text-slate-300">
                  {{ nbFiltresActifs
                    ? 'Aucune visite ne correspond à ces filtres. Effacez les filtres par élément pour tout revoir.'
                    : 'Aucune visite de supermarché (MT) sur la période. Élargissez la période ou changez les filtres.' }}
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
                <td>
                  <p>{{ row.zone || 'Territoire non renseigné' }}</p>
                  <p v-if="row.quartier || row.region" class="text-xs text-slate-500 dark:text-slate-400">
                    {{ [row.quartier, row.region].filter(Boolean).join(' · ') }}
                  </p>
                </td>
                <td v-for="col in intColumns" :key="col.code + idx" class="text-center">
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
            :total="filteredRows.length"
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
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const dashboard = useDashboardDirection()
const { typePdvLabel, fetchTypePdvLabels } = useTypePdvLabels()
const { fetchElements, columns, applicable, standardsOf, hasPresence, elementTotals } = useVisibilityAggregation()
const page = ref(1)

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)

// Nombres à la française (« 9 587 »).
const nombre = (n: number) => n.toLocaleString('fr-FR')

const mtVisites = computed(() => dashboard.visites.value.filter(v => isModernTrade(v.pdv?.canal)))
const presCount = computed(() => mtVisites.value.filter(v => hasPresence(v, 'interieure')).length)
const intTotals = computed(() => elementTotals(mtVisites.value, 'interieure'))

const intColumns = computed(() => columns(mtVisites.value, 'interieure'))
const colFilters = reactive<Record<string, string>>({})

// Filtres par élément : repliés par défaut, valeurs inchangées ('' = tous).
const optionsPresence = [
  { value: '', label: 'Tous' },
  { value: 'Présent', label: 'Présent' },
  { value: 'Absent', label: 'Absent' },
]
const filtresOuverts = ref(false)
const nbFiltresActifs = computed(() => intColumns.value.filter(c => colFilters[c.code]).length)
function effacerFiltres() {
  for (const code of Object.keys(colFilters)) colFilters[code] = ''
}

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

const allRows = computed(() => mtVisites.value.map(v => ({
  nom: v.pdv?.nom_pdv || 'Point de vente sans nom',
  pdv_id: v.pdv?.pdv_id || '',
  image_url: (v.pdv as any)?.image_url || null,
  region: v.pdv?.region || '',
  zone: v.pdv?.zone || '',
  quartier: v.pdv?.quartier || '',
  sousCategorie: typePdvLabel(v.pdv?.sous_categorie_pdv) || '',
  standards: standardsOf(v),
  applicable: applicable(v.pdv?.sous_categorie_pdv, 'interieure'),
})))

const filteredRows = computed(() => allRows.value.filter(row => {
  for (const col of intColumns.value) {
    const cf = colFilters[col.code]
    if (cf === 'Présent' && !row.standards[col.code]) return false
    if (cf === 'Absent' && row.standards[col.code]) return false
  }
  return true
}))

const paginatedRows = computed(() => filteredRows.value.slice((page.value - 1) * 100, page.value * 100))
watch(filteredRows, () => { page.value = 1 })

onMounted(() => {
  Promise.all([dashboard.fetchVisites(), fetchElements(), fetchTypePdvLabels()])
})
</script>
