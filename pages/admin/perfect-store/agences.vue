<template>
  <div class="space-y-6">
    <AdminPageHeader />

    <!-- Période + périmètre, comme la vue d'ensemble : PDV distincts, dernière
         visite scorée de la période, prise ici agence par agence. -->
    <div class="admin-toolbar">
      <div class="mb-3 border-b border-slate-200 pb-3 dark:border-slate-700">
        <PeriodFilter v-model="periode" />
      </div>
      <div class="grid grid-cols-1 gap-x-2 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        <UFormGroup label="Direction" size="xs">
          <USelectMenu v-model="fDivision" :options="divisionOptions" placeholder="Toutes" size="xs" searchable searchable-placeholder="Rechercher…" />
        </UFormGroup>
        <UFormGroup label="Distributeur" size="xs">
          <USelectMenu v-model="fDistrib" :options="distribOptions" placeholder="Tous" size="xs" searchable searchable-placeholder="Rechercher…" />
        </UFormGroup>
        <div class="flex items-start sm:pt-5">
          <UButton v-if="fDivision || fDistrib" size="xs" color="gray" variant="ghost" @click="fDivision = ''; fDistrib = ''">Réinitialiser</UButton>
        </div>
      </div>
    </div>

    <div v-if="loading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" role="status" aria-label="Chargement du récap par agence">
      <div v-for="i in 4" :key="i" class="admin-surface h-24 animate-pulse bg-slate-100 dark:bg-slate-800" />
    </div>

    <template v-else>
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard title="Agences avec des visites" :value="String(totaux.agencesActives)" :subtitle="`sur ${agences.length} agences`" icon="i-heroicons-building-office-2" color="blue" />
        <StatsCard title="Points de vente évalués" :value="String(totaux.pdv_evalues)" :subtitle="`${totaux.visites} visites sur la période`" icon="i-heroicons-clipboard-document-check" color="green" />
        <StatsCard title="Perfect Store atteint" :value="fmtPct(totaux.pct)" :subtitle="`${totaux.pdv_perfect_store} points de vente au standard`" icon="i-heroicons-trophy" color="purple" />
        <StatsCard title="Sans seuil de disponibilité" :value="String(totaux.pdv_sans_seuil)" subtitle="type de PDV sans seuil : score impossible" icon="i-heroicons-exclamation-triangle" color="orange" />
      </div>

      <section class="admin-surface overflow-hidden" aria-labelledby="agences-heading">
        <div class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div class="min-w-0">
            <h2 id="agences-heading" class="text-lg font-semibold text-slate-900 dark:text-white">Atteinte du Perfect Store par agence</h2>
            <p class="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
              L'agence est celle du merchandiser qui a fait la visite. Pour chaque point de vente, on garde la dernière visite de la période ; un point de vente vu par deux agences compte dans chacune.
              « Sans seuil » : le type du point de vente n'a pas de seuil de disponibilité (par exemple Superettes C), le niveau ne peut pas être calculé, quel que soit le relevé du merchandiser.
            </p>
          </div>
          <UButton size="xs" variant="outline" icon="i-heroicons-arrow-down-tray" :disabled="!agences.length" @click="exporter">Exporter (CSV)</UButton>
        </div>
        <div class="overflow-x-auto">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Agence</th>
                <th class="text-right" title="Merchandisers ayant fait au moins une visite sur la période">Merchandisers</th>
                <th class="text-right">Visites</th>
                <th class="text-right" title="Points de vente distincts visités sur la période">PDV visités</th>
                <th class="text-right" title="Points de vente dont la dernière visite a un résultat Perfect Store">PDV évalués</th>
                <th class="text-right" title="Part des points de vente évalués qui atteignent un niveau">Perfect Store</th>
                <th>Niveaux</th>
                <th class="text-right" title="Disponibilité en rayon moyenne">Disponibilité</th>
                <th class="text-right" title="Visibilité moyenne">Visibilité</th>
                <th class="text-right" title="Type de PDV sans seuil de disponibilité : niveau impossible à calculer">Sans seuil</th>
                <th class="text-right" title="Visites sans aucun relevé de produits ni de visibilité">Sans relevé</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in agences" :key="a.agence_code" :class="a.visites ? '' : 'text-slate-500 dark:text-slate-400'">
                <td class="font-semibold text-slate-900 dark:text-white">
                  {{ a.agence_nom }}
                  <span v-if="!a.visites" class="block text-xs font-normal text-slate-500 dark:text-slate-400">Aucune visite sur la période</span>
                </td>
                <td class="text-right tabular-nums">{{ a.merchandisers }}</td>
                <td class="text-right tabular-nums">{{ a.visites }}</td>
                <td class="text-right tabular-nums">{{ a.pdv_visites }}</td>
                <td class="text-right tabular-nums">{{ a.pdv_evalues }}</td>
                <td class="whitespace-nowrap text-right tabular-nums">
                  <span class="font-semibold text-slate-900 dark:text-white">{{ fmtPct(a.perfect_store_pct) }}</span>
                  <span class="block text-xs text-slate-600 dark:text-slate-300">{{ a.pdv_perfect_store }} au standard</span>
                </td>
                <td>
                  <div v-if="a.pdv_perfect_store" class="flex flex-wrap gap-1">
                    <span
                      v-for="n in a.par_niveau.filter(x => x.nb_pdv > 0)"
                      :key="n.niveau"
                      class="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-xs dark:border-slate-700"
                    >
                      <span class="h-2 w-2 rounded-full" :style="{ backgroundColor: couleurNiveau(n.niveau) }" aria-hidden="true" />
                      {{ niveauCourt(n.niveau) }} <span class="tabular-nums font-semibold">{{ n.nb_pdv }}</span>
                    </span>
                  </div>
                  <span v-else class="text-xs text-slate-500 dark:text-slate-400">—</span>
                </td>
                <td class="text-right tabular-nums">{{ fmtPct(a.dispo_moyenne_pct) }}</td>
                <td class="text-right tabular-nums">{{ fmtPct(a.visibilite_moyenne_pct) }}</td>
                <td class="text-right tabular-nums">
                  <span
                    v-if="a.pdv_sans_seuil"
                    class="inline-flex min-w-8 items-center justify-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                  >{{ a.pdv_sans_seuil }}</span>
                  <span v-else>0</span>
                </td>
                <td class="text-right tabular-nums">{{ a.visites_sans_releve }}</td>
              </tr>
              <tr v-if="!agences.length">
                <td colspan="11" class="py-10 text-center text-slate-600 dark:text-slate-300">
                  Aucune agence dans ce périmètre. Changez de période, de direction ou de distributeur.
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
// Perfect Store › Agences (05/11/2026) : récap de l'atteinte du Perfect Store
// par agence, demandé en réunion avec Friesland. RPC
// perfect_store_par_agence_filtre (migration 20261105120000).
import { COULEUR_NON_CONFORME, niveauPerfectStore as niveauDe } from '~/utils/chartPalette'
import { plageDePeriode, type PeriodePreset } from '~/utils/periode'
import type { PerfectStoreAgence } from '~/composables/usePerfectStore'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const { fetchPerfectStoreParAgence } = usePerfectStore()
const { regions, distributeurs, fetchReferentiels } = useReferentiels()
const { exportToCsv } = useCsvExport()

const periode = ref<{ preset: PeriodePreset; debut: string; fin: string }>({ preset: 'mois', ...plageDePeriode('mois') })
const fDivision = ref('')
const fDistrib = ref('')

const uniq = (xs: (string | null | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, 'fr'))
const divisionOptions = computed(() => ['', ...uniq(regions.value.map(r => r.nom_affichage || r.name))])
const distribOptions = computed(() => ['', ...uniq(distributeurs.value.map(d => d.name))])

const loading = ref(true)
const agences = ref<PerfectStoreAgence[]>([])

const filtres = computed(() => ({
  division: fDivision.value,
  distributeur: fDistrib.value,
  dateDebut: periode.value.debut,
  dateFin: periode.value.fin,
}))

const totaux = computed(() => {
  const t = agences.value.reduce((acc, a) => ({
    visites: acc.visites + a.visites,
    pdv_evalues: acc.pdv_evalues + a.pdv_evalues,
    pdv_perfect_store: acc.pdv_perfect_store + a.pdv_perfect_store,
    pdv_sans_seuil: acc.pdv_sans_seuil + a.pdv_sans_seuil,
    agencesActives: acc.agencesActives + (a.visites ? 1 : 0),
  }), { visites: 0, pdv_evalues: 0, pdv_perfect_store: 0, pdv_sans_seuil: 0, agencesActives: 0 })
  return { ...t, pct: t.pdv_evalues ? Math.round(1000 * t.pdv_perfect_store / t.pdv_evalues) / 10 : null }
})

function fmtPct(v: number | null | undefined) {
  if (v == null) return '—'
  // 0,1 % reste lisible : 2 PDV sur 1 538 ne doivent pas s'afficher « 0 % ».
  return Number(v) > 0 && Number(v) < 1 ? `${Number(v).toFixed(1).replace('.', ',')} %` : `${Number(v).toFixed(0)} %`
}
function niveauCourt(code: string | null | undefined): string {
  return niveauDe(code)?.court ?? String(code || '')
}
function couleurNiveau(code: string | null | undefined): string {
  return niveauDe(code)?.couleur ?? COULEUR_NON_CONFORME
}

async function charger() {
  loading.value = true
  try {
    agences.value = await fetchPerfectStoreParAgence(filtres.value)
  }
  finally {
    loading.value = false
  }
}

function exporter() {
  exportToCsv(
    agences.value.map(a => ({
      Agence: a.agence_nom,
      Merchandisers: a.merchandisers,
      Visites: a.visites,
      'PDV visités': a.pdv_visites,
      'PDV évalués': a.pdv_evalues,
      'PDV au standard': a.pdv_perfect_store,
      'Perfect Store %': a.perfect_store_pct ?? '',
      ...Object.fromEntries(a.par_niveau.map(n => [niveauCourt(n.niveau), n.nb_pdv])),
      'Disponibilité moyenne %': a.dispo_moyenne_pct ?? '',
      'Visibilité moyenne %': a.visibilite_moyenne_pct ?? '',
      'PDV sans seuil': a.pdv_sans_seuil,
      'Visites sans relevé': a.visites_sans_releve,
    })),
    `perfect-store-agences-${periode.value.debut || 'tout'}-${periode.value.fin || 'tout'}.csv`,
  )
}

watch(filtres, charger, { deep: true })

onMounted(async () => {
  void fetchReferentiels()
  await charger()
})
</script>
