<template>
  <div class="space-y-6">
    <AdminPageHeader description="Les points de vente créés sur la période choisie, semaine par semaine." />

    <DashboardFilters
      v-model="dashboard.filters.value"
      show-date-from
      show-date-to
      @filter="fetchPDV"
    />

    <ChargementContenu v-if="loading" variante="cartes" :nombre="2" classe-carte="admin-surface" libelle="Chargement des points de vente…" />

    <div v-else-if="erreur" class="admin-surface p-6 text-sm text-slate-700 dark:text-slate-200" role="alert">
      <p class="font-semibold text-slate-900 dark:text-white">Les points de vente n’ont pas pu être chargés.</p>
      <p class="mt-1">{{ erreur }}</p>
    </div>

    <template v-else>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard title="Points de vente créés" :value="addedCount" :subtitle="libellePeriode" icon="i-heroicons-plus-circle" color="red" />
        <StatsCard title="Territoires concernés" :value="zonesCount" icon="i-heroicons-map" />
        <StatsCard title="Canaux" :value="canauxCount" icon="i-heroicons-building-storefront" />
      </div>

      <ClientOnly>
        <ChartsMultiLineChart
          title="Points de vente créés par semaine"
          subtitle="Semaines du lundi au dimanche."
          :labels="evoData.map(p => p.date)"
          :series="[{ label: 'Points de vente créés', data: evoData.map(p => p.count) }]"
          empty-label="Aucun point de vente créé sur la période. Élargissez les dates pour voir les ajouts."
        />
      </ClientOnly>

      <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section class="admin-surface p-5">
          <h2 class="text-base font-semibold text-slate-900 dark:text-white">Par canal</h2>
          <ClientOnly>
            <ChartsPieChart
              v-if="canalBreakdown.labels.length"
              class="mt-4"
              bare
              :labels="canalBreakdown.labels"
              :values="canalBreakdown.values"
              :colors="couleurs(canalBreakdown.labels)"
              height="md"
            />
          </ClientOnly>
          <p v-if="!canalBreakdown.labels.length" class="mt-4 flex h-40 items-center justify-center rounded-md bg-slate-50 px-4 text-center text-sm text-slate-600 dark:bg-slate-700/40 dark:text-slate-300">
            Aucun point de vente créé sur la période.
          </p>
        </section>
        <section class="admin-surface p-5">
          <h2 class="text-base font-semibold text-slate-900 dark:text-white">Par catégorie</h2>
          <ClientOnly>
            <ChartsPieChart
              v-if="categorieBreakdown.labels.length"
              class="mt-4"
              bare
              :labels="categorieBreakdown.labels"
              :values="categorieBreakdown.values"
              :colors="couleurs(categorieBreakdown.labels)"
              height="md"
            />
          </ClientOnly>
          <p v-if="!categorieBreakdown.labels.length" class="mt-4 flex h-40 items-center justify-center rounded-md bg-slate-50 px-4 text-center text-sm text-slate-600 dark:bg-slate-700/40 dark:text-slate-300">
            Aucun point de vente créé sur la période.
          </p>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { agregerParPeriode } from '~/utils/agregation'
import { AUTRE, SERIES } from '~/utils/chartPalette'
import { isModernTrade } from '~/utils/canal'
import { libellePlage } from '~/utils/periode'
import { messageUtilisateur } from '~/utils/supabaseErrors'
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const supabase = useSupabaseClient()
const dashboard = useDashboardDirection()
const { categoriePdvLabel, fetchTypePdvLabels } = useTypePdvLabels()

const loading = ref(false)
const erreur = ref('')
const pdvList = ref<any[]>([])

const libellePeriode = computed(() => {
  const f = dashboard.filters.value
  return f.dateFrom || f.dateTo ? `Période : ${libellePlage({ debut: f.dateFrom || '', fin: f.dateTo || '' })}` : 'Depuis le début'
})

// Couleurs de la palette commune dans l'ordre ; « Non renseigné » en gris.
function couleurs(labels: string[]): string[] {
  let i = 0
  return labels.map(l => (l === 'Non renseigné' ? AUTRE : SERIES[i++] ?? AUTRE))
}

const addedCount = computed(() => pdvList.value.filter(p => p.date_creation).length)
const zonesCount = computed(() => new Set(pdvList.value.map(p => p.zone).filter(Boolean)).size)
const canauxCount = computed(() => new Set(pdvList.value.map(p => p.canal).filter(Boolean)).size)

const canalBreakdown = computed(() => {
  const counts = new Map<string, number>()
  pdvList.value.forEach(p => {
    const c = p.canal ? (isModernTrade(p.canal) ? 'Supermarchés (MT)' : 'Boutiques (GT)') : 'Non renseigné'
    counts.set(c, (counts.get(c) || 0) + 1)
  })
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  return { labels: sorted.map(([k]) => k), values: sorted.map(([, v]) => v) }
})

const categorieBreakdown = computed(() => {
  const counts = new Map<string, number>()
  pdvList.value.forEach(p => {
    const c = p.categorie_pdv ? categoriePdvLabel(p.categorie_pdv) : 'Non renseigné'
    counts.set(c, (counts.get(c) || 0) + 1)
  })
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  return { labels: sorted.map(([k]) => k), values: sorted.map(([, v]) => v) }
})

// Ajouts par semaine ISO : utils/agregation.ts (lot 5).
const evoData = computed(() =>
  agregerParPeriode(pdvList.value, p => p.date_creation, 'semaine').map(p => ({ date: p.label, count: p.total })),
)

async function fetchPDV() {
  loading.value = true
  try {
    let query = supabase
      .from('pdv')
      .select('pdv_id, nom_pdv, canal, categorie_pdv, zone, region, date_creation')
      .order('date_creation', { ascending: false })

    if (dashboard.filters.value.dateFrom) {
      query = query.gte('date_creation', dashboard.filters.value.dateFrom)
    }
    if (dashboard.filters.value.dateTo) {
      query = query.lte('date_creation', dashboard.filters.value.dateTo)
    }

    const { data, error } = await query
    if (error) throw error
    erreur.value = ''
    pdvList.value = data || []
  } catch (err) {
    console.error('Évolution des PDV : chargement impossible', err)
    erreur.value = messageUtilisateur(err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchTypePdvLabels()
  Promise.all([fetchPDV()])
})
</script>
