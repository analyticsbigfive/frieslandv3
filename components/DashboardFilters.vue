<template>
  <div class="admin-toolbar mb-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="text-sm font-semibold text-slate-900 dark:text-white">Filtres</p>
        <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {{ activeFilterCount ? `${activeFilterCount} filtre(s) actif(s)` : 'Aucun filtre supplémentaire' }}
        </p>
      </div>
      <button
        v-if="hasAdvancedFields"
        type="button"
        class="admin-filter-toggle"
        :aria-expanded="advancedOpen"
        @click="advancedOpen = !advancedOpen"
      >
        <UIcon :name="advancedOpen ? 'i-heroicons-chevron-up' : 'i-heroicons-adjustments-horizontal'" class="h-4 w-4" aria-hidden="true" />
        {{ advancedOpen ? 'Masquer les filtres avancés' : 'Plus de filtres' }}
        <span v-if="advancedActiveCount" class="admin-filter-toggle__count">{{ advancedActiveCount }}</span>
      </button>
    </div>

    <div class="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
      <UFormGroup label="Date de début" size="sm">
        <UInput v-model="model.dateFrom" type="date" size="sm" />
      </UFormGroup>
      <UFormGroup label="Date de fin" size="sm">
        <UInput v-model="model.dateTo" type="date" size="sm" />
      </UFormGroup>

      <UFormGroup v-if="showCanal" label="Canal" size="sm">
        <USelectMenu v-model="model.canal" :options="['', 'General trade', 'Modern trade']" placeholder="Tous" size="sm" />
      </UFormGroup>

      <UFormGroup v-if="showCommercial" label="Commercial" size="sm">
        <USelectMenu
          v-model="model.commercial"
          :options="commercialOptions"
          placeholder="Tous"
          size="sm"
          searchable
          searchable-placeholder="Rechercher..."
          :search-attributes="['label']"
          :loading="usersLoading"
          value-attribute="value"
          option-attribute="label"
        />
      </UFormGroup>

      <UFormGroup v-if="showNomPdv" label="Rechercher un PDV" size="sm">
        <PdvNameAutocomplete
          v-model="model.nomPdv"
          placeholder="Nom du PDV…"
          size="sm"
          :scope-zone="model.zone"
          :scope-area-code="model.area"
          :scope-quartier="model.quartier"
          @select="emitFilter"
        />
      </UFormGroup>

      <div class="flex items-end gap-2">
        <UButton size="sm" icon="i-heroicons-magnifying-glass" @click="emitFilter">Filtrer</UButton>
        <UButton size="sm" variant="ghost" @click="reset">Réinitialiser</UButton>
      </div>
    </div>

    <div v-show="advancedOpen" class="mt-3 border-t border-slate-100 pt-3 dark:border-slate-700">
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        <UFormGroup v-if="showCategorie" label="Catégorie de PDV" size="sm">
          <USelectMenu v-model="model.categorie" :options="categorieRefOptions" value-attribute="value" option-attribute="label" placeholder="Toutes" size="sm" searchable searchable-placeholder="Rechercher…" :loading="!refsLoaded" />
        </UFormGroup>

        <UFormGroup v-if="showSousCategorie" label="Sous-catégorie" size="sm">
          <USelectMenu v-model="model.sousCategorie" :options="sousCategorieRefOptions" value-attribute="value" option-attribute="label" placeholder="Toutes" size="sm" searchable searchable-placeholder="Rechercher…" :loading="!refsLoaded" />
        </UFormGroup>

        <!-- Cascade géographique : Division > Sous-région > Territoire > Area > Quartier.
             Chaque niveau restreint les options du suivant. -->
        <UFormGroup v-if="showRegion" label="Division (North/South)" size="sm">
          <USelectMenu v-model="model.division" :options="divisionOptions" placeholder="Toutes" size="sm" :loading="!refsLoaded" />
        </UFormGroup>

        <UFormGroup v-if="showRegion" label="Sous-région" size="sm">
          <USelectMenu v-model="model.region" :options="sousRegionOptions" placeholder="Toutes" size="sm" searchable searchable-placeholder="Rechercher…" :loading="!refsLoaded" />
        </UFormGroup>

        <UFormGroup v-if="showZone" label="Territoire" size="sm">
          <USelectMenu v-model="model.zone" :options="territoireOptions" placeholder="Tous" size="sm" searchable searchable-placeholder="Rechercher…" :loading="!refsLoaded" />
        </UFormGroup>

        <UFormGroup v-if="showArea" label="Area" size="sm">
          <USelectMenu v-model="model.area" :options="areaOptions" value-attribute="value" option-attribute="label" placeholder="Toutes" size="sm" searchable searchable-placeholder="Rechercher…" :loading="!refsLoaded" />
        </UFormGroup>

        <UFormGroup v-if="showQuartier" label="Quartier" size="sm">
          <USelectMenu v-model="model.quartier" :options="quartierOptions" placeholder="Tous" size="sm" searchable searchable-placeholder="Rechercher…" :loading="!refsLoaded" />
        </UFormGroup>
      </div>
    </div>

    <!-- Chips des filtres actifs : clic = retirer ce filtre seul. -->
    <div v-if="filterChips.length" class="admin-list-toolbar__chips">
      <button
        v-for="chip in filterChips"
        :key="chip.key"
        type="button"
        class="admin-list-toolbar__chip"
        :title="`Retirer le filtre ${chip.label}`"
        @click="removeChip(chip.key)"
      >
        <span>{{ chip.label }}</span>
        <UIcon name="i-heroicons-x-mark" class="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface DashboardFilterValues {
  dateFrom: string
  dateTo: string
  canal: string
  categorie: string
  sousCategorie: string
  commercial: string
  division: string
  region: string
  zone: string
  area: string
  quartier: string
  nomPdv: string
}

const props = withDefaults(defineProps<{
  modelValue: DashboardFilterValues
  showCanal?: boolean
  showCategorie?: boolean
  showSousCategorie?: boolean
  showCommercial?: boolean
  showRegion?: boolean
  showZone?: boolean
  showArea?: boolean
  showQuartier?: boolean
  showNomPdv?: boolean
}>(), {
  showCanal: true,
  showCategorie: true,
  showSousCategorie: true,
  showCommercial: true,
  showRegion: true,
  showZone: true,
  showArea: true,
  showQuartier: true,
  showNomPdv: true,
})

const emit = defineEmits(['update:modelValue', 'filter'])

const model = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const advancedOpen = ref(false)

const hasAdvancedFields = computed(() => [
  props.showCategorie,
  props.showSousCategorie,
  props.showRegion,
  props.showZone,
  props.showQuartier,
].some(Boolean))

const advancedActiveCount = computed(() => [
  model.value.categorie,
  model.value.sousCategorie,
  model.value.division,
  model.value.region,
  model.value.zone,
  model.value.area,
  model.value.quartier,
].filter(Boolean).length)

const activeFilterCount = computed(() => {
  const period = model.value.dateFrom || model.value.dateTo ? 1 : 0
  return period + [
    model.value.canal,
    model.value.categorie,
    model.value.sousCategorie,
    model.value.commercial,
    model.value.division,
    model.value.region,
    model.value.zone,
    model.value.area,
    model.value.quartier,
    model.value.nomPdv,
  ].filter(Boolean).length
})

// Charger les commerciaux pour le dropdown
const { users: cachedUsers, fetchUsers: fetchCachedUsers, loading: usersLoading } = useUsersCache()

// Référentiels : catégories/sous-catégories + hiérarchie géographique.
const { posTypes, regions, subRegions, territories, areas, quartiers, fetchReferentiels, loaded: refsLoaded } = useReferentiels()

const categorieRefOptions = computed(() => {
  const byNom = new Map(posTypes.value.filter(p => p.level3_group).map(p => [p.level3_group, p.level3_fr]))
  const opts = [...byNom.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'))
  return [{ value: '', label: 'Toutes' }, ...opts]
})
const sousCategorieRefOptions = computed(() => {
  const filtered = posTypes.value.filter(p => !model.value.categorie || p.level3_group === model.value.categorie)
  const byNom = new Map(filtered.filter(p => p.level4_type).map(p => [p.level4_type, p.level4_fr]))
  return [{ value: '', label: 'Toutes' }, ...[...byNom.entries()].map(([value, label]) => ({ value, label }))]
})

// ---- Cascade géo : chaque niveau restreint le suivant. ----
const regionLabel = (r: { name: string; nom_affichage: string | null }) => r.nom_affichage || r.name

const divisionOptions = computed(() => ['', ...[...new Set(regions.value.map(regionLabel).filter(Boolean))].sort()])

const allowedRegionCodes = computed(() => regions.value
  .filter(r => !model.value.division || regionLabel(r) === model.value.division)
  .map(r => r.code))

const sousRegionOptions = computed(() => ['', ...subRegions.value
  .filter(sr => allowedRegionCodes.value.includes(sr.region_code || ''))
  .map(regionLabel)
  .filter(Boolean)
  .sort()])

const allowedSrCodes = computed(() => subRegions.value
  .filter(sr => allowedRegionCodes.value.includes(sr.region_code || ''))
  .filter(sr => !model.value.region || regionLabel(sr) === model.value.region)
  .map(sr => sr.code))

const territoireOptions = computed(() => ['', ...territories.value
  .filter(t => allowedSrCodes.value.includes(t.sub_region_code || ''))
  .map(t => t.name)
  .sort()])

const allowedTerrCodes = computed(() => territories.value
  .filter(t => allowedSrCodes.value.includes(t.sub_region_code || ''))
  .filter(t => !model.value.zone || t.name === model.value.zone)
  .map(t => t.code))

const scopedAreas = computed(() => areas.value
  .filter(a => allowedTerrCodes.value.includes(a.territory_code)))

const areaOptions = computed(() => [
  { value: '', label: 'Toutes' },
  ...scopedAreas.value.map(a => ({ value: a.code || a.name, label: a.name })).sort((a, b) => a.label.localeCompare(b.label, 'fr')),
])

const quartierOptions = computed(() => {
  const areaIds = scopedAreas.value
    .filter(a => !model.value.area || (a.code || a.name) === model.value.area)
    .map(a => a.id)
  return ['', ...[...new Set(quartiers.value
    .filter(q => areaIds.includes(q.zone_id))
    .map(q => q.nom)
    .filter(Boolean))].sort()]
})

// Cascade descendante : un niveau qui change invalide les enfants hors périmètre.
watch(() => model.value.division, () => { if (model.value.region && !sousRegionOptions.value.includes(model.value.region)) model.value.region = '' })
watch(() => model.value.region, () => { if (model.value.zone && !territoireOptions.value.includes(model.value.zone)) model.value.zone = '' })
watch(() => model.value.zone, () => { if (model.value.area && !areaOptions.value.some(o => o.value === model.value.area)) model.value.area = '' })
watch(() => model.value.area, () => { if (model.value.quartier && !quartierOptions.value.includes(model.value.quartier)) model.value.quartier = '' })

onMounted(() => { fetchCachedUsers(); fetchReferentiels() })

watch(advancedActiveCount, (count) => {
  if (count > 0) advancedOpen.value = true
}, { immediate: true })

const commercialOptions = computed(() => [
  { value: '', label: 'Tous' },
  ...cachedUsers.value
    .filter(u => u.is_active !== false)
    .map(u => ({ value: u.nom || u.email || '', label: `${u.nom || '—'} (${u.email})` }))
])

// ---- Chips + filtrage automatique (sans clic sur « Filtrer ») ----
const areaLabelOf = (code: string) => areas.value.find(a => (a.code || a.name) === code)?.name || code
const filterChips = computed(() => {
  const chips: { key: string; label: string }[] = []
  const m = model.value
  if (m.dateFrom) chips.push({ key: 'dateFrom', label: `Début : ${m.dateFrom}` })
  if (m.dateTo) chips.push({ key: 'dateTo', label: `Fin : ${m.dateTo}` })
  if (m.canal) chips.push({ key: 'canal', label: `Canal : ${m.canal}` })
  if (m.commercial) chips.push({ key: 'commercial', label: `Commercial : ${m.commercial}` })
  if (m.categorie) chips.push({ key: 'categorie', label: `Catégorie : ${categorieRefOptions.value.find(o => o.value === m.categorie)?.label || m.categorie}` })
  if (m.sousCategorie) chips.push({ key: 'sousCategorie', label: `Sous-catégorie : ${sousCategorieRefOptions.value.find(o => o.value === m.sousCategorie)?.label || m.sousCategorie}` })
  if (m.division) chips.push({ key: 'division', label: `Division : ${m.division}` })
  if (m.region) chips.push({ key: 'region', label: `Sous-région : ${m.region}` })
  if (m.zone) chips.push({ key: 'zone', label: `Territoire : ${m.zone}` })
  if (m.area && props.showArea) chips.push({ key: 'area', label: `Area : ${areaLabelOf(m.area)}` })
  if (m.quartier && props.showQuartier) chips.push({ key: 'quartier', label: `Quartier : ${m.quartier}` })
  if (m.nomPdv) chips.push({ key: 'nomPdv', label: `PDV : ${m.nomPdv}` })
  return chips
})
function removeChip(key: string) {
  ;(model.value as any)[key] = ''
}

function emitFilter() { emit('filter') }

// Filtrage dynamique : tout changement relance la recherche (debounce),
// le bouton « Filtrer » reste pour relancer manuellement.
let autoTimer: ReturnType<typeof setTimeout> | null = null
watch(() => ({ ...model.value }), (next, prev) => {
  if (JSON.stringify(next) === JSON.stringify(prev)) return
  if (autoTimer) clearTimeout(autoTimer)
  autoTimer = setTimeout(() => emit('filter'), 400)
}, { deep: true })

function reset() {
  const now = new Date()
  const threeMonthsAgo = new Date(now)
  threeMonthsAgo.setMonth(now.getMonth() - 3)

  emit('update:modelValue', {
    dateFrom: threeMonthsAgo.toISOString().slice(0, 10),
    dateTo: now.toISOString().slice(0, 10),
    canal: '',
    categorie: '',
    sousCategorie: '',
    commercial: '',
    division: '',
    region: '',
    zone: '',
    area: '',
    quartier: '',
    nomPdv: '',
  })
  emit('filter')
}
</script>
