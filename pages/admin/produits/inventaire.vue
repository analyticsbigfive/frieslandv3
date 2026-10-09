<template>
  <div class="space-y-6">
    <AdminPageHeader
      description="Niveau de stock de chaque référence, d'après la dernière visite de chaque point de vente."
    />

    <DashboardFilters
      v-model="dashboard.filters.value"
      @filter="dashboard.fetchVisites()"
    />

    <ChargementContenu v-if="dashboard.loading.value" variante="lignes" libelle="Chargement des relevés de stock…" />

    <template v-else>
      <div v-if="!dashboard.totalVisites.value" class="admin-surface p-8 text-center text-sm text-slate-600 dark:text-slate-300">
        Aucune visite sur la période. Les niveaux de stock apparaîtront après les premiers relevés terrain ;
        en attendant, élargissez la période ou changez les filtres.
      </div>

      <template v-else>
        <!-- Indicateurs -->
        <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatsCard title="Points de vente couverts" :value="pdvCouverts" icon="i-heroicons-building-storefront" color="blue" />
          <StatsCard
            title="Références en rupture"
            :value="skuEnRupture"
            subtitle="dans au moins un point de vente"
            icon="i-heroicons-x-circle"
            color="red"
          />
          <StatsCard
            title="Stocks bas relevés"
            :value="totalLow"
            subtitle="références sous le seuil, tous points de vente confondus"
            icon="i-heroicons-exclamation-triangle"
            color="orange"
          />
          <StatsCard
            title="Disponibilité moyenne"
            :value="`${nombre(dispoMoyenne)} %`"
            format="none"
            subtitle="moyenne des références relevées"
            icon="i-heroicons-check-circle"
            :color="dispoMoyenne >= 50 ? 'green' : 'orange'"
          />
        </div>

        <!-- Un tableau par famille de produits -->
        <section
          v-for="cat in catalog"
          :key="cat.key"
          class="admin-surface overflow-hidden"
          :aria-labelledby="`famille-${cat.key}`"
        >
          <div class="flex items-center gap-2 px-5 py-4">
            <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: couleurFamille(cat.key) }" aria-hidden="true" />
            <h2 :id="`famille-${cat.key}`" class="text-lg font-semibold text-slate-900 dark:text-white">{{ cat.label }}</h2>
          </div>
          <div class="overflow-x-auto border-t border-slate-200 dark:border-slate-700">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th class="text-right">Quantité totale</th>
                  <th class="text-right">Points de vente</th>
                  <th class="text-right">Disponible</th>
                  <th class="text-right">Stock bas</th>
                  <th class="text-right">Rupture</th>
                  <th class="w-48">Disponibilité</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!rowsByCat[cat.key]?.length">
                  <td colspan="7" class="py-6 text-center text-slate-600 dark:text-slate-300">
                    Aucun relevé de stock pour cette famille sur la période.
                  </td>
                </tr>
                <tr v-for="row in rowsByCat[cat.key] || []" :key="row.sku">
                  <td class="font-medium text-slate-900 dark:text-white">{{ row.label }}</td>
                  <td class="text-right font-semibold tabular-nums text-slate-900 dark:text-white">{{ nombre(row.qtyTotale) }}</td>
                  <td class="text-right tabular-nums">{{ nombre(row.nbPdv) }}</td>
                  <td class="text-right tabular-nums">{{ nombre(row.nbDispo) }}</td>
                  <td class="text-right tabular-nums">{{ nombre(row.nbLow) }}</td>
                  <td class="text-right tabular-nums">{{ nombre(row.nbOos) }}</td>
                  <td>
                    <div class="flex items-center gap-2">
                      <div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700" aria-hidden="true">
                        <div
                          class="h-full rounded-full"
                          :style="{ width: `${row.pctDispo}%`, backgroundColor: couleurDispo(row.pctDispo) }"
                        />
                      </div>
                      <span class="w-14 text-right text-sm tabular-nums text-slate-700 dark:text-slate-200">{{ nombre(row.pctDispo) }} %</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { categoriesProduitsActives, computeSkuInventory, type SkuInventoryRow } from '~/utils/products'
import { STATUT, couleurFamille } from '~/utils/chartPalette'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const dashboard = useDashboardDirection()
const { fetchThresholds, getSeuil } = useSkuThresholds()

// Nombres à la française (« 9 587 »).
const nombre = (n: number) => n.toLocaleString('fr-FR')

// Catégories et SKU actifs du catalogue (Paramètres › Produits du formulaire).
const { charger: chargerCatalogue } = useCatalogueReleve()
const catalog = computed(() => categoriesProduitsActives())

const inventory = computed<SkuInventoryRow[]>(() =>
  computeSkuInventory(dashboard.visites.value as any, getSeuil)
)

const rowsByCat = computed<Record<string, SkuInventoryRow[]>>(() => {
  const map: Record<string, SkuInventoryRow[]> = {}
  for (const row of inventory.value) {
    if (!map[row.category]) map[row.category] = []
    map[row.category].push(row)
  }
  return map
})

// Mêmes seuils qu'avant (≥ 50 %, > 0, 0) ; le pourcentage est toujours écrit à côté.
function couleurDispo(pct: number) {
  if (pct >= 50) return STATUT.bon
  return pct > 0 ? STATUT.alerte : STATUT.critique
}

// KPIs
const pdvCouverts = computed(() => {
  const ids = new Set<string>()
  for (const v of dashboard.visites.value) {
    if (v.pdv?.pdv_id) ids.add(v.pdv.pdv_id)
  }
  return ids.size
})
const skuEnRupture = computed(() => inventory.value.filter(r => r.nbOos > 0).length)
const totalLow = computed(() => inventory.value.reduce((s, r) => s + r.nbLow, 0))
const dispoMoyenne = computed(() => {
  const rows = inventory.value.filter(r => r.nbPdv > 0)
  if (!rows.length) return 0
  return Math.round(rows.reduce((s, r) => s + r.pctDispo, 0) / rows.length * 10) / 10
})

onMounted(() => {
  void chargerCatalogue()
  fetchThresholds()
  dashboard.fetchVisites()
})
</script>
