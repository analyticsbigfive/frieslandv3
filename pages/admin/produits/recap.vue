<template>
  <div class="space-y-6">
    <AdminPageHeader
      description="Présence en rayon et respect des prix, par famille de produits, sur les visites de la période."
    />

    <DashboardFilters
      v-model="dashboard.filters.value"
      @filter="dashboard.fetchVisites()"
    />

    <ChargementContenu v-if="dashboard.loading.value" libelle="Chargement des relevés…" />

    <template v-else>
      <div v-if="!dashboard.totalVisites.value" class="admin-surface p-8 text-center text-sm text-slate-600 dark:text-slate-300">
        Aucune visite sur la période. Élargissez la période ou changez les filtres.
      </div>

      <template v-else>
        <!-- Indicateurs : la réponse d'abord -->
        <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatsCard title="Visites analysées" :value="dashboard.totalVisites.value" icon="i-heroicons-clipboard-document-list" color="blue" />
          <StatsCard
            title="Famille la plus présente"
            :value="plusPresente?.label || 'Aucune'"
            format="none"
            :subtitle="plusPresente ? `en rayon dans ${pourcent(plusPresente.pct)} % des visites` : undefined"
            icon="i-heroicons-arrow-trending-up"
            color="green"
          />
          <StatsCard
            title="Famille la moins présente"
            :value="moinsPresente?.label || 'Aucune'"
            format="none"
            :subtitle="moinsPresente ? `en rayon dans ${pourcent(moinsPresente.pct)} % des visites` : undefined"
            icon="i-heroicons-arrow-trending-down"
            color="orange"
          />
          <StatsCard
            title="Prix respectés"
            :value="`${pctPrixGlobal} %`"
            format="none"
            subtitle="des relevés où la famille est en rayon"
            icon="i-heroicons-banknotes"
            color="green"
          />
        </div>

        <!-- Une ligne par famille : présence en rayon puis prix respectés -->
        <section class="admin-surface overflow-hidden">
          <div class="px-5 py-4">
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Présence et prix par famille de produits</h2>
            <p class="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
              Présence : part des visites où la famille est en rayon. Prix respectés : part de ces visites où le prix relevé est conforme.
            </p>
          </div>
          <p
            v-if="!lignes.length"
            class="border-t border-slate-200 px-5 py-8 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
          >
            Aucune famille de produits n'est active dans le formulaire. Ajoutez-en dans Réglages, Produits du formulaire.
          </p>
          <div v-else class="overflow-x-auto border-t border-slate-200 dark:border-slate-700">
            <table class="admin-table" data-no-column-tools>
              <thead>
                <tr>
                  <th>Famille de produits</th>
                  <th class="min-w-[14rem]">Présence en rayon</th>
                  <th class="min-w-[14rem]">Prix respectés</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="l in lignes" :key="l.key">
                  <td>
                    <span class="flex items-center gap-2 font-medium text-slate-900 dark:text-white">
                      <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: couleurFamille(l.key) }" aria-hidden="true" />
                      {{ l.label }}
                    </span>
                  </td>
                  <td>
                    <div class="flex items-baseline justify-between gap-3">
                      <strong class="font-semibold tabular-nums text-slate-900 dark:text-white">{{ pourcent(l.pct) }} %</strong>
                      <span class="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                        {{ nombre(l.present) }} visite{{ l.present > 1 ? 's' : '' }}
                      </span>
                    </div>
                    <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700" aria-hidden="true">
                      <div class="h-full rounded-full" :style="{ width: `${l.pct}%`, backgroundColor: couleurFamille(l.key) }" />
                    </div>
                  </td>
                  <td>
                    <template v-if="l.present">
                      <div class="flex items-baseline justify-between gap-3">
                        <strong class="font-semibold tabular-nums text-slate-900 dark:text-white">{{ l.pctPrix }} %</strong>
                        <span class="text-xs tabular-nums text-slate-500 dark:text-slate-400">{{ nombre(l.prixOui) }} sur {{ nombre(l.present) }}</span>
                      </div>
                      <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700" aria-hidden="true">
                        <div class="h-full rounded-full" :style="{ width: `${l.pctPrix}%`, backgroundColor: STATUT.bon }" />
                      </div>
                    </template>
                    <span v-else class="text-sm text-slate-500 dark:text-slate-400">Pas de relevé de prix</span>
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
import { categoriesProduitsActives } from '~/utils/products'
import { STATUT, couleurFamille } from '~/utils/chartPalette'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const dashboard = useDashboardDirection()

// Pourcentages à la française (virgule décimale).
const pourcent = (n: number) => n.toLocaleString('fr-FR')

// Nombres à la française (« 9 587 »).
const nombre = (n: number) => n.toLocaleString('fr-FR')

// Catégories actives du catalogue (Paramètres › Produits du formulaire).
const { charger: chargerCatalogue } = useCatalogueReleve()
const productCategories = computed(() => categoriesProduitsActives().map(c => ({ key: c.key, label: c.label })))

function catPresent(key: string) {
  return dashboard.countWhere(v => v.data?.produits?.[key]?.present)
}
function catPct(key: string) {
  return dashboard.pctWhere(v => v.data?.produits?.[key]?.present)
}
function prixOui(key: string) {
  return dashboard.countWhere(v =>
    v.data?.produits?.[key]?.present && v.data?.produits?.[key]?.prix_respectes
  )
}

// Une ligne par famille, de la plus présente à la moins présente. Mêmes
// calculs qu'avant (camemberts et tableau), regroupés.
const lignes = computed(() => productCategories.value
  .map((cat) => {
    const present = catPresent(cat.key)
    const oui = prixOui(cat.key)
    return {
      ...cat,
      present,
      pct: catPct(cat.key),
      prixOui: oui,
      pctPrix: present > 0 ? Math.round(oui / present * 100) : 0,
    }
  })
  .sort((a, b) => b.pct - a.pct || a.label.localeCompare(b.label, 'fr')))

const plusPresente = computed(() => lignes.value[0])
const moinsPresente = computed(() => (lignes.value.length > 1 ? lignes.value[lignes.value.length - 1] : undefined))

// Prix respectés, toutes familles : relevés conformes / relevés où la famille est en rayon.
const pctPrixGlobal = computed(() => {
  const present = lignes.value.reduce((s, l) => s + l.present, 0)
  const oui = lignes.value.reduce((s, l) => s + l.prixOui, 0)
  return present ? Math.round(oui / present * 100) : 0
})

onMounted(() => {
  Promise.all([dashboard.fetchVisites(), chargerCatalogue()])
})
</script>
