<template>
  <div class="space-y-6">
    <AdminPageHeader />

    <!-- Période + périmètre, mêmes axes que la synthèse par zone : tout passe
         par la RPC, qui compte des PDV distincts et non des visites. -->
    <div class="admin-toolbar">
      <div class="mb-3 border-b border-slate-200 pb-3 dark:border-slate-700">
        <PeriodFilter v-model="periode" />
      </div>
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <UFormGroup label="Direction" size="xs">
          <USelectMenu v-model="fDivision" :options="divisionOptions" placeholder="Toutes" size="xs" searchable searchable-placeholder="Rechercher…" />
        </UFormGroup>
        <UFormGroup label="Territoire" size="xs">
          <USelectMenu v-model="fTerritoire" :options="territoireOptions" placeholder="Tous" size="xs" searchable searchable-placeholder="Rechercher…" />
        </UFormGroup>
        <UFormGroup label="Quartier" size="xs">
          <USelectMenu v-model="fArea" :options="quartierOptions" placeholder="Tous" size="xs" searchable searchable-placeholder="Rechercher…" />
        </UFormGroup>
        <UFormGroup label="Distributeur" size="xs">
          <USelectMenu v-model="fDistrib" :options="distribOptions" placeholder="Tous" size="xs" searchable searchable-placeholder="Rechercher…" />
        </UFormGroup>
        <div class="flex items-end">
          <UButton v-if="aDesFiltres" size="xs" color="gray" variant="ghost" @click="reinitialiser">Réinitialiser</UButton>
        </div>
      </div>
    </div>

    <div v-if="loading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" role="status" aria-label="Chargement des écarts au standard">
      <div v-for="i in 4" :key="i" class="admin-surface h-24 animate-pulse bg-slate-100 dark:bg-slate-800" />
    </div>

    <template v-else>
      <!-- Ce qui bloque le passage au niveau supérieur. Compté sur les PDV
           chargés (les moins conformes d'abord), pas sur tout le parc : le
           sous-titre le dit, pour qu'aucun chiffre ne soit lu de travers. -->
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard
          title="Points de vente analysés"
          :value="String(manques.length)"
          :subtitle="`les moins conformes${tronque ? ` (${LIMITE} au plus)` : ''}`"
          icon="i-heroicons-building-storefront"
          color="blue"
        />
        <StatsCard
          title="Disponibilité insuffisante"
          :value="String(compte.dispo)"
          subtitle="sous le seuil du niveau visé"
          icon="i-heroicons-cube"
          color="red"
        />
        <StatsCard
          title="Assortiment incomplet"
          :value="String(compte.assortiment)"
          subtitle="références attendues manquantes"
          icon="i-heroicons-squares-2x2"
          color="orange"
        />
        <StatsCard
          title="Visibilité ou promotion"
          :value="String(compte.visibilitePromo)"
          subtitle="au moins un élément manquant"
          icon="i-heroicons-eye"
          color="blue"
        />
      </div>

      <!-- Éléments de visibilité et de promotion les plus souvent manquants :
           ce sur quoi une action de terrain rapporte le plus. -->
      <section v-if="topManques.length" class="admin-surface p-5" aria-labelledby="top-manques-heading">
        <h2 id="top-manques-heading" class="text-lg font-semibold text-slate-900 dark:text-white">Ce qui manque le plus souvent</h2>
        <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Éléments à corriger en priorité, tous points de vente analysés confondus, avec le nombre de points de vente concernés.
        </p>
        <ul class="mt-3 flex flex-wrap gap-2">
          <li
            v-for="m in topManques"
            :key="m.libelle"
            class="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200"
          >
            {{ m.libelle }}
            <span class="font-bold tabular-nums text-slate-900 dark:text-white">{{ m.nb }}</span>
          </li>
        </ul>
      </section>

      <section class="admin-surface overflow-hidden" aria-labelledby="ecarts-heading">
        <div class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div>
            <h2 id="ecarts-heading" class="text-lg font-semibold text-slate-900 dark:text-white">Écart au niveau supérieur</h2>
            <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Dernière visite de chaque point de vente, les moins conformes d'abord.
            </p>
          </div>
          <UButton size="xs" variant="outline" icon="i-heroicons-arrow-down-tray" :disabled="!manques.length" @click="exporter">
            Exporter (CSV)
          </UButton>
        </div>

        <div v-if="!manques.length" class="px-5 py-14 text-center">
          <p class="font-semibold text-slate-700 dark:text-slate-200">Aucun écart sur ce périmètre</p>
          <p class="mx-auto mt-1 max-w-md text-sm text-slate-600 dark:text-slate-300">
            Soit tous les points de vente visités atteignent leur niveau visé, soit aucune visite n'a été
            enregistrée sur la période choisie. Élargissez la période ou retirez un filtre pour vérifier.
          </p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Point de vente</th>
                <th>Territoire</th>
                <th>Type</th>
                <th>Niveau</th>
                <th class="text-right">Disponibilité</th>
                <th>Assortiment</th>
                <th>Éléments manquants</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in pageCourante" :key="m.visite_id">
                <td>
                  <NuxtLink
                    :to="`/admin/pdv/historique?pdv_id=${m.pdv_id}`"
                    class="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4 hover:text-fc-red hover:decoration-current dark:text-white dark:decoration-slate-600"
                  >
                    {{ m.nom_pdv || 'Point de vente sans nom' }}
                  </NuxtLink>
                  <span v-if="m.distributor_name" class="block text-xs text-slate-600 dark:text-slate-300">{{ m.distributor_name }}</span>
                </td>
                <td>
                  {{ m.zone || '—' }}
                  <span v-if="m.quartier" class="block text-xs text-slate-600 dark:text-slate-300">{{ m.quartier }}</span>
                </td>
                <td>{{ m.type_pdv || '—' }}</td>
                <td class="whitespace-nowrap">
                  <span class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    <span class="h-2 w-2 shrink-0 rounded-full" :style="{ backgroundColor: couleurNiveau(m.niveau_actuel) }" aria-hidden="true" />
                    {{ niveauCourt(m.niveau_actuel) }}
                  </span>
                  <span class="mt-1 block text-xs text-slate-600 dark:text-slate-300">vise {{ niveauCourt(m.niveau_cible) }}</span>
                </td>
                <td class="whitespace-nowrap text-right tabular-nums">
                  <span v-if="m.dispo_rayon == null" class="text-slate-600 dark:text-slate-300">Non relevée</span>
                  <template v-else>
                    <span
                      class="inline-flex items-center justify-end gap-1"
                      :class="m.dispo_manque ? 'font-semibold text-red-700 dark:text-red-300' : 'text-slate-700 dark:text-slate-200'"
                    >
                      <UIcon v-if="m.dispo_manque" name="i-heroicons-exclamation-circle" class="h-4 w-4 shrink-0" aria-hidden="true" />
                      {{ Number(m.dispo_rayon).toFixed(0) }} %
                      <span v-if="m.dispo_manque" class="sr-only">, insuffisante</span>
                    </span>
                    <span class="block text-xs text-slate-600 dark:text-slate-300">minimum {{ m.dispo_rayon_min }} %</span>
                  </template>
                </td>
                <td class="whitespace-nowrap">
                  <!-- Sans relevé produit (disponibilité inconnue), « complet » serait trompeur. -->
                  <span v-if="m.dispo_rayon == null && !m.assortiment_manque" class="text-slate-600 dark:text-slate-300">Non relevé</span>
                  <span
                    v-else
                    class="inline-flex items-center gap-1.5"
                    :class="m.assortiment_manque ? 'font-semibold text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'"
                  >
                    <UIcon
                      :name="m.assortiment_manque ? 'i-heroicons-x-circle' : 'i-heroicons-check-circle'"
                      class="h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    {{ m.assortiment_manque ? 'Incomplet' : 'Complet' }}
                  </span>
                </td>
                <td class="min-w-56 text-sm">
                  <template v-if="(m.visibilite_manques || []).length || (m.promotion_manques || []).length">
                    <p v-if="(m.visibilite_manques || []).length">
                      <span class="text-slate-600 dark:text-slate-300">Visibilité :</span> {{ m.visibilite_manques.join(', ') }}
                    </p>
                    <p v-if="(m.promotion_manques || []).length" :class="(m.visibilite_manques || []).length ? 'mt-1' : ''">
                      <span class="text-slate-600 dark:text-slate-300">Promotion :</span> {{ m.promotion_manques.join(', ') }}
                    </p>
                  </template>
                  <span v-else class="text-slate-600 dark:text-slate-300">Aucun</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="manques.length > PAR_PAGE" class="border-t border-slate-200 px-5 py-3 dark:border-slate-700">
          <AdminPagination
            :total="manques.length"
            :page="pageNo"
            :page-size="PAR_PAGE"
            item-label="point(s) de vente"
            @update:page="pageNo = $event"
          />
        </div>
      </section>

      <p v-if="tronque" class="text-sm text-slate-600 dark:text-slate-300">
        Affichage limité aux {{ LIMITE }} points de vente les moins conformes. Resserrez le périmètre
        (territoire, quartier, distributeur) pour une analyse complète.
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { NIVEAUX_PS as NIVEAUX, COULEUR_NON_CONFORME, niveauPerfectStore as niveauDe } from '~/utils/chartPalette'
// Écarts au standard (« analyse des gaps ») — identification demandée pour les commerciaux.
//
// Le moteur existe depuis juillet et n'était exposé que dans un encart de
// pages/admin/index.vue : la vue `v_perfect_store_manques` (en-tête « gap to
// next level ») calcule, pour la DERNIÈRE visite de chaque PDV, ce qui manque
// pour atteindre le niveau Perfect Store suivant — disponibilité, assortiment,
// éléments de visibilité et de promotion. Cette page lui donne un écran à part
// entière, avec le périmètre géographique complet.
//
// Contrainte d'architecture (composables/usePerfectStore.ts) : /admin agrège
// exclusivement par RPC. Les compteurs ci-dessous ne sont donc pas des agrégats
// serveur mais un décompte de ce qui est affiché — d'où les sous-titres qui le
// disent explicitement.
import { plageDePeriode, type PeriodePreset } from '~/utils/periode'
import type { PerfectStoreManqueItem } from '~/composables/usePerfectStore'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const { fetchPerfectStoreManques } = usePerfectStore()
const { regions, territories, quartiers, distributeurs, fetchReferentiels } = useReferentiels()
const { exportToCsv } = useCsvExport()

function niveauCourt(code: string | null | undefined): string {
  const c = String(code || '').trim()
  if (!c || c.toUpperCase().startsWith('NON')) return 'Non conforme'
  return niveauDe(c)?.court ?? c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()
}
function couleurNiveau(code: string | null | undefined): string {
  return niveauDe(code)?.couleur ?? COULEUR_NON_CONFORME
}

// Les moins conformes d'abord (tri fait en SQL) : au-delà, on n'apprend plus
// rien, et la RPC rendrait des milliers de lignes à un navigateur.
const LIMITE = 500
const PAR_PAGE = 50

const periode = ref<{ preset: PeriodePreset; debut: string; fin: string }>({ preset: '30j', ...plageDePeriode('30j') })
const fDivision = ref('')
const fTerritoire = ref('')
const fArea = ref('')
const fDistrib = ref('')

const uniq = (xs: (string | null | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, 'fr'))
const divisionOptions = computed(() => ['', ...uniq(regions.value.map(r => r.nom_affichage || r.name))])
const territoireOptions = computed(() => ['', ...uniq(territories.value.map(t => t.name))])
const quartierOptions = computed(() => ['', ...uniq(quartiers.value.map(q => q.nom))])
const distribOptions = computed(() => ['', ...uniq(distributeurs.value.map(d => d.name))])

const aDesFiltres = computed(() => !!(fDivision.value || fTerritoire.value || fArea.value || fDistrib.value))
function reinitialiser() {
  fDivision.value = ''
  fTerritoire.value = ''
  fArea.value = ''
  fDistrib.value = ''
}

const loading = ref(true)
const manques = ref<PerfectStoreManqueItem[]>([])
const pageNo = ref(1)
const tronque = computed(() => manques.value.length >= LIMITE)
const pageCourante = computed(() => manques.value.slice((pageNo.value - 1) * PAR_PAGE, pageNo.value * PAR_PAGE))

const filtres = computed(() => ({
  division: fDivision.value,
  territoire: fTerritoire.value,
  area: fArea.value,
  distributeur: fDistrib.value,
  dateDebut: periode.value.debut,
  dateFin: periode.value.fin,
}))

const compte = computed(() => ({
  dispo: manques.value.filter(m => m.dispo_manque).length,
  assortiment: manques.value.filter(m => m.assortiment_manque).length,
  visibilitePromo: manques.value.filter(m =>
    (m.visibilite_manques?.length || 0) + (m.promotion_manques?.length || 0) > 0,
  ).length,
}))

// Les dix éléments les plus souvent manquants : la liste des gestes qui
// rapportent le plus s'ils sont corrigés en tournée.
const topManques = computed(() => {
  const compteur = new Map<string, number>()
  for (const m of manques.value) {
    for (const e of [...(m.visibilite_manques || []), ...(m.promotion_manques || [])]) {
      compteur.set(e, (compteur.get(e) || 0) + 1)
    }
  }
  return [...compteur.entries()]
    .map(([libelle, nb]) => ({ libelle, nb }))
    .sort((a, b) => b.nb - a.nb)
    .slice(0, 10)
})

async function charger() {
  loading.value = true
  pageNo.value = 1
  try {
    manques.value = await fetchPerfectStoreManques(filtres.value, LIMITE)
  }
  finally {
    loading.value = false
  }
}

function exporter() {
  exportToCsv(
    manques.value.map(m => ({
      PDV: m.nom_pdv,
      'ID PDV': m.pdv_id,
      Territoire: m.zone ?? '',
      Quartier: m.quartier ?? '',
      Distributeur: m.distributor_name ?? '',
      Type: m.type_pdv ?? '',
      'Niveau actuel': niveauCourt(m.niveau_actuel),
      'Niveau visé': niveauCourt(m.niveau_cible),
      'Disponibilité %': m.dispo_rayon ?? '',
      'Disponibilité minimum %': m.dispo_rayon_min ?? '',
      'Disponibilité insuffisante': m.dispo_manque ? 'oui' : 'non',
      'Assortiment incomplet': m.assortiment_manque ? 'oui' : 'non',
      'Visibilité manquante': (m.visibilite_manques || []).join(' / '),
      'Promotion manquante': (m.promotion_manques || []).join(' / '),
    })),
    `ecarts-au-standard-${periode.value.debut || 'tout'}-${periode.value.fin || 'tout'}.csv`,
  )
}

watch(filtres, () => { void charger() }, { deep: true })

onMounted(async () => {
  void fetchReferentiels()
  await charger()
})
</script>
