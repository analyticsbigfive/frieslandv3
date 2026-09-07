<template>
  <div class="space-y-6">
    <AdminPageHeader
      title="Analyse des gaps"
      eyebrow="Aide à la décision"
    />

    <!-- Période + périmètre, mêmes axes que la synthèse par zone : tout passe
         par la RPC, qui compte des PDV distincts et non des visites. -->
    <div class="admin-toolbar">
      <div class="mb-3 border-b border-slate-100 pb-3 dark:border-slate-700">
        <PeriodFilter v-model="periode" />
      </div>
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <UFormGroup label="Division (North/South)" size="xs">
          <USelectMenu v-model="fDivision" :options="divisionOptions" placeholder="Toutes" size="xs" searchable />
        </UFormGroup>
        <UFormGroup label="Territoire" size="xs">
          <USelectMenu v-model="fTerritoire" :options="territoireOptions" placeholder="Tous" size="xs" searchable />
        </UFormGroup>
        <UFormGroup label="Quartier" size="xs">
          <USelectMenu v-model="fArea" :options="quartierOptions" placeholder="Tous" size="xs" searchable />
        </UFormGroup>
        <UFormGroup label="Distributeur" size="xs">
          <USelectMenu v-model="fDistrib" :options="distribOptions" placeholder="Tous" size="xs" searchable />
        </UFormGroup>
        <div class="flex items-end">
          <UButton v-if="aDesFiltres" size="xs" variant="ghost" @click="reinitialiser">Réinitialiser</UButton>
        </div>
      </div>
    </div>

    <div v-if="loading" class="grid gap-4 sm:grid-cols-4">
      <div v-for="i in 4" :key="i" class="admin-surface h-24 animate-pulse bg-slate-100 dark:bg-slate-800" />
    </div>

    <template v-else>
      <!-- Ce qui bloque le passage au niveau supérieur. Compté sur les PDV
           chargés (les moins conformes d'abord), pas sur tout le parc : le
           sous-titre le dit, pour qu'aucun chiffre ne soit lu de travers. -->
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard
          title="PDV analysés"
          :value="String(manques.length)"
          :subtitle="`les moins conformes${tronque ? ` (${LIMITE} max)` : ''}`"
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
          subtitle="nombre de SKU sous la cible"
          icon="i-heroicons-squares-2x2"
          color="orange"
        />
        <StatsCard
          title="Visibilité ou promotion"
          :value="String(compte.visibilitePromo)"
          subtitle="au moins un élément manquant"
          icon="i-heroicons-eye"
          color="purple"
        />
      </div>

      <!-- Éléments de visibilité et de promotion les plus souvent manquants :
           ce sur quoi une action de terrain rapporte le plus. -->
      <div v-if="topManques.length" class="admin-surface p-5">
        <h2 class="font-bold text-slate-900 dark:text-white">Ce qui manque le plus souvent</h2>
        <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Éléments à corriger en priorité, tous PDV analysés confondus.
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <span
            v-for="m in topManques"
            :key="m.libelle"
            class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {{ m.libelle }}
            <span class="rounded-full bg-fc-red px-1.5 text-[10px] text-white">{{ m.nb }}</span>
          </span>
        </div>
      </div>

      <div class="admin-surface overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 dark:border-slate-700">
          <div>
            <h2 class="font-bold text-slate-900 dark:text-white">Écart au niveau supérieur</h2>
            <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Dernière visite de chaque PDV. Les moins conformes d'abord.
            </p>
          </div>
          <UButton size="xs" variant="outline" icon="i-heroicons-arrow-down-tray" :disabled="!manques.length" @click="exporter">
            Exporter CSV
          </UButton>
        </div>

        <div v-if="!manques.length" class="px-5 py-14 text-center">
          <p class="font-semibold text-slate-700 dark:text-slate-200">Aucun écart sur ce périmètre</p>
          <p class="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
            Soit tous les PDV visités atteignent leur niveau cible, soit aucune visite n'a été
            enregistrée sur la période choisie.
          </p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="admin-table w-full">
            <thead>
              <tr>
                <th>PDV</th>
                <th>Territoire</th>
                <th>Type</th>
                <th>Niveau actuel</th>
                <th>Niveau visé</th>
                <th class="th-c">Dispo</th>
                <th class="th-c">Assortiment</th>
                <th>Visibilité manquante</th>
                <th>Promotion manquante</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in pageCourante" :key="m.visite_id">
                <td>
                  <NuxtLink :to="`/admin/pdv/historique?pdv=${m.pdv_id}`" class="font-semibold text-fc-blue hover:underline">
                    {{ m.nom_pdv }}
                  </NuxtLink>
                  <span v-if="m.distributor_name" class="block text-xs text-slate-400">{{ m.distributor_name }}</span>
                </td>
                <td class="text-sm">
                  {{ m.zone || '—' }}
                  <span v-if="m.quartier" class="block text-xs text-slate-400">{{ m.quartier }}</span>
                </td>
                <td class="text-sm">{{ m.type_pdv || '—' }}</td>
                <td>
                  <UBadge :color="m.niveau_actuel ? 'blue' : 'red'" variant="subtle" size="xs">
                    {{ m.niveau_actuel || 'Non conforme' }}
                  </UBadge>
                </td>
                <td class="text-sm">{{ m.niveau_cible }}</td>
                <td class="px-4 py-2 text-center text-sm tabular-nums">
                  <span v-if="m.dispo_rayon == null" class="text-slate-400">—</span>
                  <span v-else :class="m.dispo_manque ? 'font-semibold text-fc-red' : 'text-slate-500'">
                    {{ Number(m.dispo_rayon).toFixed(0) }} / {{ m.dispo_rayon_min }} %
                  </span>
                </td>
                <td class="px-4 py-2 text-center">
                  <UIcon
                    :name="m.assortiment_manque ? 'i-heroicons-x-circle' : 'i-heroicons-check-circle'"
                    class="h-4 w-4"
                    :class="m.assortiment_manque ? 'text-fc-red' : 'text-emerald-500'"
                  />
                </td>
                <td class="text-xs">{{ (m.visibilite_manques || []).join(', ') || '—' }}</td>
                <td class="text-xs">{{ (m.promotion_manques || []).join(', ') || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <AdminPagination
          v-if="manques.length > PAR_PAGE"
          :total="manques.length"
          :page="pageNo"
          :page-size="PAR_PAGE"
          item-label="PDV"
          @update:page="pageNo = $event"
        />
      </div>

      <p v-if="tronque" class="text-xs text-slate-500 dark:text-slate-400">
        Affichage limité aux {{ LIMITE }} PDV les moins conformes. Resserrez le périmètre
        (territoire, quartier, distributeur) pour une analyse exhaustive.
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
// Analyse des gaps — « identification des gaps » demandée pour les commerciaux.
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
      'Niveau actuel': m.niveau_actuel || 'Non conforme',
      'Niveau visé': m.niveau_cible,
      'Dispo %': m.dispo_rayon ?? '',
      'Dispo minimum %': m.dispo_rayon_min ?? '',
      'Dispo insuffisante': m.dispo_manque ? 'oui' : 'non',
      'Assortiment incomplet': m.assortiment_manque ? 'oui' : 'non',
      'Visibilité manquante': (m.visibilite_manques || []).join(' / '),
      'Promotion manquante': (m.promotion_manques || []).join(' / '),
    })),
    `gaps-${periode.value.debut || 'tout'}-${periode.value.fin || 'tout'}.csv`,
  )
}

watch(filtres, () => { void charger() }, { deep: true })

onMounted(async () => {
  void fetchReferentiels()
  await charger()
})
</script>
