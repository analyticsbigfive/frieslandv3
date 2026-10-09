<template>
  <div class="space-y-6">
    <AdminPageHeader />

    <AdminListToolbar
      :search="search"
      search-placeholder="Nom, code PDV, zone…"
      :result-count="total"
      result-label="point(s) de vente"
      :chips="filterChips"
      @update:search="updateSearch"
      @reset="resetListFilters"
      @remove-chip="removeFilterChip"
    >
      <template #filters>
        <div>
          <p class="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">Niveau</p>
          <div class="inline-flex flex-wrap rounded-md border border-slate-300 bg-white p-0.5 dark:border-slate-600 dark:bg-slate-800" role="group" aria-label="Niveau">
            <button
              v-for="opt in niveauOptions"
              :key="opt.value"
              type="button"
              class="inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors"
              :class="niveau === opt.value
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700'"
              :aria-pressed="niveau === opt.value"
              @click="setNiveau(opt.value)"
            >
              <span v-if="opt.value !== 'TOUS'" class="h-2 w-2 shrink-0 rounded-full" :style="{ backgroundColor: couleurNiveau(opt.value) }" aria-hidden="true" />
              {{ opt.label }}
            </button>
          </div>
        </div>

        <!-- Filtre période (réunion 23/07) : un PDV Perfect Store cette semaine
             peut ne plus l'être la suivante. -->
        <PeriodFilter v-model="periode" :show-resume="false" />
      </template>
    </AdminListToolbar>

    <div v-if="error" class="flex flex-wrap items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100" role="alert">
      <UIcon name="i-heroicons-exclamation-triangle" class="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
      <p class="min-w-0 flex-1">La liste n'a pas pu être chargée. {{ error }}</p>
      <UButton size="xs" variant="outline" icon="i-heroicons-arrow-path" @click="load">Réessayer</UButton>
    </div>

    <!-- Tableau -->
    <div class="admin-surface overflow-hidden">
      <div class="overflow-x-auto">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Point de vente</th>
              <th>Type</th>
              <th>Zone</th>
              <th>Niveau</th>
              <th class="text-right">Score</th>
              <th class="text-right">Disponibilité</th>
              <th class="text-right">Visibilité</th>
              <th>Dernière visite</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="8" class="py-8">
                <ChargementContenu variante="compact" libelle="Chargement des points de vente…" class="flex justify-center" />
              </td>
            </tr>
            <tr
              v-for="row in items"
              v-else
              :key="row.pdv_id"
              class="cursor-pointer focus-visible:bg-slate-50 dark:focus-visible:bg-slate-700/50"
              tabindex="0"
              :aria-label="`Ouvrir la dernière visite de ${row.nom_pdv || 'ce point de vente'}`"
              @click="openDetail(row)"
              @keydown.enter="openDetail(row)"
            >
              <td class="font-semibold text-slate-900 dark:text-white">{{ row.nom_pdv || 'Point de vente sans nom' }}</td>
              <td>{{ typePdvLabel(row.type_pdv) }}</td>
              <td>{{ row.zone || '—' }}</td>
              <td class="whitespace-nowrap">
                <span class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                  <span class="h-2 w-2 shrink-0 rounded-full" :style="{ backgroundColor: couleurNiveau(row.niveau) }" aria-hidden="true" />
                  {{ niveauCourt(row.niveau) }}
                </span>
              </td>
              <td class="text-right font-semibold tabular-nums text-slate-900 dark:text-white">{{ pct(row.score_global) }}</td>
              <td class="text-right tabular-nums">{{ pct(row.dispo_rayon) }}</td>
              <td class="text-right tabular-nums">{{ pct(row.visibilite) }}</td>
              <td class="whitespace-nowrap">
                {{ formatDate(row.date_visite) }}
                <span v-if="row.commercial" class="block text-xs text-slate-600 dark:text-slate-300">{{ row.commercial }}</span>
              </td>
            </tr>
            <tr v-if="!loading && !items.length && !error">
              <td colspan="8" class="py-10 text-center">
                <p class="text-slate-700 dark:text-slate-200">Aucun point de vente pour ces filtres.</p>
                <p class="mt-1 text-slate-600 dark:text-slate-300">Choisissez un autre niveau, élargissez la période ou effacez la recherche.</p>
                <UButton class="mt-3" size="xs" variant="outline" icon="i-heroicons-arrow-path" @click="resetListFilters">
                  Réinitialiser les filtres
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <AdminPagination
        :total="total"
        :page="page"
        :page-size="perPage"
        :loading="loading"
        item-label="point(s) de vente"
        @update:page="goto"
      />
    </div>

    <VisitDetailModal v-model="showDetail" :visite="selectedVisite" :perfect-store="selectedPerfect" />
  </div>
</template>

<script setup lang="ts">
import { NIVEAUX_PS as NIVEAUX, COULEUR_NON_CONFORME, niveauPerfectStore as niveauDe } from '~/utils/chartPalette'
import type { PerfectStoreListItem } from '~/composables/usePerfectStore'
import type { PeriodeValue } from '~/components/PeriodFilter.vue'
import type { Visite } from '~/types'
import type { PerfectStoreResultB } from '~/utils/perfectStore'
import { messageUtilisateur } from '~/utils/supabaseErrors'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const { refs, fetchRefs, scoreVisite, fetchPerfectStoreListe } = usePerfectStore()
const { typePdvLabel, fetchTypePdvLabels } = useTypePdvLabels()
const visitesStore = useVisitesStore()

const items = ref<PerfectStoreListItem[]>([])
const total = ref(0)
const page = ref(1)
const perPage = 20
const loading = ref(true)
const error = ref('')
const search = ref('')
const niveau = ref('TOUS')
// Toute la période par défaut : cette page est un catalogue, la borne est un
// filtre optionnel — contrairement au dashboard qui démarre sur le mois.
const periode = ref<PeriodeValue>({ preset: 'tout', debut: '', fin: '' })

const showDetail = ref(false)
const selectedVisite = ref<Visite | null>(null)
const selectedPerfect = ref<PerfectStoreResultB | null>(null)

// Les valeurs doivent matcher resultat_perfect_store.niveau tel qu'exposé par
// v_perfect_store_liste_full (eq strict côté requête).
const niveauOptions = [
  { value: 'TOUS', label: 'Tous' },
  { value: 'FLAGSHIP STORE', label: 'Flagship' },
  { value: 'VIP PERFECT STORE', label: 'VIP' },
  { value: 'CORE PERFECT STORE', label: 'Core' },
  { value: 'BASIC PERFECT STORE', label: 'Basic' },
  { value: 'NON CONFORME', label: 'Non conforme' },
]

const pct = (v: number | null | undefined) => v == null ? '—' : `${Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`
const formatDate = (v: string) => formatDateFr(v, { day: '2-digit', month: 'short', year: 'numeric' })

function niveauCourt(code: string | null | undefined): string {
  const c = String(code || '').trim()
  if (!c || c.toUpperCase().startsWith('NON')) return 'Non conforme'
  return niveauDe(c)?.court ?? c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()
}
function couleurNiveau(code: string | null | undefined): string {
  return niveauDe(code)?.couleur ?? COULEUR_NON_CONFORME
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
async function load() {
  loading.value = true
  try {
    const res = await fetchPerfectStoreListe({
      niveau: niveau.value,
      search: search.value,
      page: page.value,
      perPage,
      // Toujours par la RPC filtrée : elle gère période ET recherche, et compte
      // sur la même base (dernière visite par PDV) que le dashboard.
      filters: {
        dateDebut: periode.value.debut || undefined,
        dateFin: periode.value.fin || undefined,
      },
    })
    items.value = res.items
    total.value = res.total
    error.value = ''
  }
  catch (err) {
    error.value = messageUtilisateur(err)
    items.value = []
    total.value = 0
  }
  finally {
    loading.value = false
  }
}

function onFilterChange() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1; load() }, 350)
}

function updateSearch(value: string) {
  search.value = value
  onFilterChange()
}

function resetListFilters() {
  search.value = ''
  niveau.value = 'TOUS'
  periode.value = { preset: 'tout', debut: '', fin: '' }
  page.value = 1
  load()
}

watch(periode, () => { page.value = 1; load() }, { deep: true })

// Chips des filtres actifs — clic = retirer ce filtre seul.
const filterChips = computed(() => {
  const chips: { key: string; label: string }[] = []
  if (niveau.value !== 'TOUS') {
    const opt = niveauOptions.find(o => o.value === niveau.value)
    chips.push({ key: 'niveau', label: `Niveau : ${opt?.label || niveau.value}` })
  }
  if (search.value.trim()) chips.push({ key: 'search', label: `Recherche : ${search.value.trim()}` })
  return chips
})
function removeFilterChip(key: string) {
  if (key === 'niveau') { setNiveau('TOUS'); return }
  if (key === 'search') { search.value = ''; page.value = 1; load() }
}
function setNiveau(v: string) {
  niveau.value = v
  page.value = 1
  load()
}
function goto(p: number) {
  page.value = p
  load()
}

async function openDetail(row: PerfectStoreListItem) {
  try {
    const visite = await visitesStore.fetchVisiteByDatabaseId(row.visite_id)
    selectedVisite.value = visite
    selectedPerfect.value = refs.value ? scoreVisite(visite.data, visite.pdv || {}) : null
    showDetail.value = true
  }
  catch {
    selectedVisite.value = null
    selectedPerfect.value = null
  }
}

onMounted(async () => {
  void fetchTypePdvLabels()
  await fetchRefs()
  await load()
})
</script>
