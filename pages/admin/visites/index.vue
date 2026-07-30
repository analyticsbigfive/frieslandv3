<template>
  <div class="space-y-6">
    <AdminPageHeader
      title="Visites"
      eyebrow="Domaine visites"
    />

    <AdminListToolbar
      :result-count="total"
      result-label="visite(s)"
      :chips="filterChips"
      @reset="resetFilters"
      @remove-chip="removeFilterChip"
    >
      <template #filters>
        <!-- Jour / semaine / mois : suivre les merchandisers au quotidien
             (réunion du 23 juillet, tâches 2.3 et 6). Le mode « Personnalisé »
             réaffiche les deux bornes libres. -->
        <PeriodFilter v-model="periode" />
        <UFormGroup label="Commercial" class="min-w-64 flex-1">
          <USelectMenu
            v-model="filters.commercial"
            :options="commercialOptions"
            placeholder="Tous"
            size="sm"
            class="w-full"
            searchable
            searchable-placeholder="Rechercher un commercial…"
            :search-attributes="['label']"
            :loading="usersLoading"
            value-attribute="value"
            option-attribute="label"
          />
        </UFormGroup>
      </template>
      <template #actions>
        <UButton size="sm" icon="i-heroicons-magnifying-glass" @click="filterVisites">Filtrer</UButton>
        <UButton size="sm" variant="outline" icon="i-heroicons-arrow-down-tray" @click="handleExport">Export</UButton>
      </template>
    </AdminListToolbar>

    <div class="admin-surface overflow-hidden">
      <div class="border-b border-slate-100 px-5 py-4 dark:border-slate-700">
        <h2 class="font-semibold text-slate-900 dark:text-white">Visites et résultats Perfect Store</h2>
      </div>

      <div class="overflow-x-auto">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Commercial</th>
              <th>Point de vente</th>
              <th>Canal</th>
              <th>Distributeur</th>
              <th class="text-center">Niveau</th>
              <th class="text-center">Score</th>
              <th class="text-center">EVAP</th>
              <th class="text-center">IMP</th>
              <th class="text-center">SCM</th>
              <th class="text-center">UHT</th>
              <th class="text-center">GPS</th>
              <th class="text-center">Photos</th>
              <th class="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="visite in visites"
              :key="visite.id || visite.visite_id"
              class="cursor-pointer"
              tabindex="0"
              @click="viewVisite(visite)"
              @keydown.enter="viewVisite(visite)"
            >
              <td class="whitespace-nowrap">{{ formatDate(visite.date_visite) }}</td>
              <td class="font-medium text-slate-900 dark:text-white">{{ visite.commercial }}</td>
              <td>
                <div class="min-w-40">
                  <p class="font-medium text-slate-900 dark:text-white">{{ visite.pdv?.nom_pdv || visite.pdv_id?.substring(0, 8) }}</p>
                  <p class="mt-0.5 text-xs text-slate-400">{{ typePdvLabel(visite.pdv?.sous_categorie_pdv) || 'Type non renseigné' }}</p>
                </div>
              </td>
              <td>
                <UBadge v-if="visite.pdv?.canal" :color="canalColor(visite.pdv.canal)" variant="soft" size="xs">
                  {{ visite.pdv.canal }}
                </UBadge>
                <span v-else class="text-xs text-slate-400">—</span>
              </td>
              <td class="text-sm text-slate-600 dark:text-slate-300">{{ visite.pdv?.distributor_name || '—' }}</td>
              <td class="text-center">
                <UBadge
                  v-if="scoreFor(visite)?.tierAtteint"
                  :color="tierColor(scoreFor(visite)?.tierAtteint)"
                  variant="soft"
                  size="xs"
                >
                  {{ shortTier(scoreFor(visite)?.tierAtteint) }}
                </UBadge>
                <span v-else class="text-xs text-slate-400">Non conforme</span>
              </td>
              <td class="text-center font-semibold tabular-nums">{{ ratio(scoreFor(visite)?.scoreGlobal) }}</td>
              <td v-for="category in tableProductCategories" :key="category" class="text-center">
                <UIcon
                  :name="productPresent(visite, category) ? 'i-heroicons-check-circle-solid' : 'i-heroicons-minus-circle-solid'"
                  class="h-5 w-5"
                  :class="productPresent(visite, category) ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'"
                />
              </td>
              <td class="text-center">
                <UIcon
                  :name="visite.geofence_validated ? 'i-heroicons-check-circle-solid' : 'i-heroicons-x-circle'"
                  class="h-5 w-5"
                  :class="visite.geofence_validated ? 'text-emerald-500' : 'text-slate-300'"
                />
              </td>
              <td class="text-center">
                <button
                  v-if="visite.image_urls?.length"
                  type="button"
                  class="rounded-lg px-2 py-1 text-xs font-semibold text-cyan-600 transition hover:bg-cyan-50 dark:hover:bg-cyan-950/30"
                  @click.stop="openPhotoGallery(visite)"
                >
                  {{ visite.image_urls.length }} photo(s)
                </button>
                <span v-else class="text-slate-300">—</span>
              </td>
              <td class="text-center">
                <div @click.stop>
                  <UDropdown :items="getVisiteActions(visite)" :popper="{ placement: 'bottom-end' }">
                    <UButton variant="ghost" size="xs" icon="i-heroicons-ellipsis-vertical" />
                  </UDropdown>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="!loading && !visites.length" class="px-6 py-14 text-center">
        <UIcon name="i-heroicons-clipboard-document-list" class="mx-auto h-10 w-10 text-slate-300" />
        <p class="mt-3 text-sm font-medium text-slate-500">Aucune visite trouvée</p>
        <p class="mt-1 text-xs text-slate-400">Modifiez les critères ou réinitialisez les filtres.</p>
        <UButton class="mt-4" size="xs" variant="outline" icon="i-heroicons-arrow-path" @click="resetFilters">
          Réinitialiser
        </UButton>
      </div>

      <div v-if="loading" class="space-y-2 px-5 py-6">
        <div v-for="i in 5" :key="i" class="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-700/50" />
      </div>

      <AdminPagination
        :total="total"
        :page="filters.page"
        :page-size="filters.perPage"
        :loading="loading"
        item-label="visite(s)"
        @previous="filters.page--; loadVisites()"
        @next="filters.page++; loadVisites()"
      />
    </div>

    <VisitDetailModal
      v-model="showDetail"
      :visite="selectedVisite"
      :perfect-store="selectedPerfectStore"
      can-delete
      @delete="handleDelete"
    />

    <UModal v-model="showPhotoGallery" :ui="{ width: 'max-w-2xl' }">
      <div v-if="galleryVisite" class="p-6">
        <div class="mb-4 flex items-center justify-between gap-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-cyan-600">Photos de visite</p>
            <h3 class="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{{ galleryVisite.pdv?.nom_pdv || galleryVisite.commercial }}</h3>
          </div>
          <UButton aria-label="Fermer" variant="ghost" size="xs" icon="i-heroicons-x-mark" @click="showPhotoGallery = false" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <button
            v-for="(url, index) in galleryVisite.image_urls"
            :key="url"
            type="button"
            class="group relative overflow-hidden rounded-xl"
            @click="zoomedPhoto = url"
          >
            <img :src="url" :alt="`Photo ${index + 1}`" class="h-48 w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
          </button>
        </div>
      </div>
    </UModal>

    <UModal v-model="showZoomedPhoto" :ui="{ width: 'max-w-4xl' }">
      <div class="p-2">
        <div class="mb-1 flex justify-end">
          <UButton aria-label="Fermer" variant="ghost" size="xs" icon="i-heroicons-x-mark" @click="showZoomedPhoto = false" />
        </div>
        <img v-if="zoomedPhoto" :src="zoomedPhoto" alt="Photo agrandie" class="max-h-[80vh] w-full rounded-lg object-contain" />
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { PeriodeValue } from '~/components/PeriodFilter.vue'
import type { Visite } from '~/types'
import type { PerfectStoreResultB } from '~/utils/perfectStore'
import { plageDePeriode } from '~/utils/periode'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const visitesStore = useVisitesStore()
const toast = useToast()
const { exportVisitesToExcel } = useCsvExport()
const { users: cachedUsers, fetchUsers: fetchCachedUsers, loading: usersLoading } = useUsersCache()
const { refs, fetchRefs, scoreVisite } = usePerfectStore()
const { typePdvLabel, fetchTypePdvLabels } = useTypePdvLabels()

const visites = computed(() => visitesStore.visites)
const total = computed(() => visitesStore.total)
const loading = computed(() => visitesStore.loading)
const filters = visitesStore.filters

// Période : source de vérité de l'UI, recopiée dans les filtres du store (qui
// ne connaît que dateFrom / dateTo). Défaut au mois en cours — la maille de
// suivi demandée en réunion ; les chips affichent toujours la plage active,
// donc rien n'est masqué en silence.
const periode = ref<PeriodeValue>({ preset: 'mois', ...plageDePeriode('mois') })
watch(periode, (p) => {
  filters.dateFrom = p.debut
  filters.dateTo = p.fin
}, { deep: true, immediate: true })

const showDetail = ref(false)
const selectedVisite = ref<Visite | null>(null)
const showPhotoGallery = ref(false)
const galleryVisite = ref<Visite | null>(null)
const zoomedPhoto = ref<string | null>(null)
const showZoomedPhoto = computed({
  get: () => !!zoomedPhoto.value,
  set: value => { if (!value) zoomedPhoto.value = null },
})

const tableProductCategories = ['evap', 'imp', 'scm', 'uht']

const commercialOptions = computed(() => [
  { value: '', label: 'Tous' },
  ...cachedUsers.value
    .filter(user => user.is_active !== false)
    .map(user => ({ value: user.nom || user.email || '', label: `${user.nom || '—'} (${user.email})` })),
])

const perfectStoreScores = computed(() => {
  const scores = new Map<string, PerfectStoreResultB | null>()
  for (const visite of visites.value) {
    const key = visite.id || visite.visite_id
    scores.set(key, refs.value ? scoreVisite(visite.data, visite.pdv || {}) : null)
  }
  return scores
})

const selectedPerfectStore = computed(() => {
  if (!selectedVisite.value || !refs.value) return null
  return scoreVisite(selectedVisite.value.data, selectedVisite.value.pdv || {})
})

function scoreFor(visite: Visite): PerfectStoreResultB | null {
  return perfectStoreScores.value.get(visite.id || visite.visite_id) || null
}

function productPresent(visite: Visite, category: string): boolean {
  return !!(visite.data?.produits as any)?.[category]?.present
}

function ratio(value: number | null | undefined): string {
  return value == null ? '—' : `${Math.round(value * 100)}%`
}

function shortTier(value: string | null | undefined): string {
  if (!value) return '—'
  return value.replace(' PERFECT STORE', '').replace(' STORE', '')
}

function tierColor(value: string | null | undefined): any {
  if (value?.startsWith('FLAGSHIP')) return 'purple'
  if (value?.startsWith('VIP')) return 'green'
  if (value?.startsWith('CORE')) return 'blue'
  return 'orange'
}

function canalColor(value: string | null | undefined): any {
  const v = value?.toUpperCase() || ''
  if (v.startsWith('MT') || v.includes('MODERN')) return 'violet'
  return 'sky'
}

function formatDate(value: string): string {
  return formatDateFr(value, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function viewVisite(visite: Visite) {
  selectedVisite.value = visite
  showDetail.value = true
}

function openPhotoGallery(visite: Visite) {
  galleryVisite.value = visite
  showPhotoGallery.value = true
}

function getVisiteActions(visite: Visite) {
  return [[
    { label: 'Voir le détail', icon: 'i-heroicons-eye', click: () => viewVisite(visite) },
    { label: 'Supprimer', icon: 'i-heroicons-trash', click: () => handleDelete(visite) },
  ]]
}

async function handleDelete(visite: Visite) {
  if (!confirm('Supprimer cette visite ?')) return
  await visitesStore.deleteVisite(visite.visite_id)
  showDetail.value = false
  await loadVisites()
}

async function handleExport() {
  // Toutes les visites de la période filtrée, pas seulement la page affichée.
  const { rows, tronque } = await visitesStore.fetchVisitesForExport()
  await exportVisitesToExcel(rows)
  toast.add({
    title: `${rows.length} visite(s) exportée(s)`,
    description: tronque ? 'Plafond de 5000 lignes atteint : réduisez la période pour tout obtenir.' : undefined,
    color: tronque ? 'amber' : 'green',
  })
}

function resetFilters() {
  // Le watch sur `periode` réécrit dateFrom / dateTo.
  periode.value = { preset: 'mois', ...plageDePeriode('mois') }
  filters.commercial = ''
  filters.email = ''
  filters.page = 1
  loadVisites()
}

// Chips des filtres actifs (sous la barre) — clic = retirer ce filtre seul.
// Les bornes de date n'y figurent pas : elles sont pilotées par PeriodFilter,
// qui affiche déjà la plage. Un chip « retirer » les désynchroniserait.
const filterChips = computed(() => {
  const chips: { key: string; label: string }[] = []
  if (filters.commercial) {
    const opt = commercialOptions.value.find(o => o.value === filters.commercial)
    chips.push({ key: 'commercial', label: `Commercial : ${opt?.label || filters.commercial}` })
  }
  return chips
})
function removeFilterChip(key: string) {
  ;(filters as any)[key] = ''
  filters.page = 1
  loadVisites()
}

async function loadVisites() {
  await visitesStore.fetchVisites()
}

function filterVisites() {
  filters.page = 1
  loadVisites()
}

// Filtrage dynamique : les changements de filtres relancent la liste sans
// passer par le bouton « Filtrer » (debounce court).
let autoFilterTimer: ReturnType<typeof setTimeout> | null = null
watch(() => [filters.dateFrom, filters.dateTo, filters.commercial], () => {
  if (autoFilterTimer) clearTimeout(autoFilterTimer)
  autoFilterTimer = setTimeout(() => { filters.page = 1; loadVisites() }, 400)
})

onMounted(() => {
  // Le champ Email a été retiré de l'UI : purge d'un éventuel filtre persistant.
  filters.email = ''
  // Deep-link depuis le classement des commerciaux : /admin/visites?commercial=X
  const qCommercial = useRoute().query.commercial
  if (typeof qCommercial === 'string' && qCommercial) filters.commercial = qCommercial
  fetchCachedUsers()
  fetchRefs()
  fetchTypePdvLabels()
  loadVisites()
})
</script>
