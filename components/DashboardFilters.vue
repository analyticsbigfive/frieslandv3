<template>
  <div class="admin-toolbar mb-6">
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
      <!-- Date range -->
      <UFormGroup label="Date début" size="sm">
        <UInput v-model="model.dateFrom" type="date" size="sm" />
      </UFormGroup>
      <UFormGroup label="Date fin" size="sm">
        <UInput v-model="model.dateTo" type="date" size="sm" />
      </UFormGroup>

      <!-- Canal -->
      <UFormGroup v-if="showCanal" label="Canal" size="sm">
        <USelectMenu
          v-model="model.canal"
          :options="['', 'General trade', 'Modern trade']"
          placeholder="Tous"
          size="sm"
        />
      </UFormGroup>

      <!-- Catégorie de PDV (référentiel niveau 3) -->
      <UFormGroup v-if="showCategorie" label="Catégorie de PDV" size="sm">
        <USelectMenu
          v-model="model.categorie"
          :options="categorieRefOptions"
          placeholder="Toutes"
          size="sm"
          searchable
        />
      </UFormGroup>

      <!-- Sous-catégorie (référentiel niveau 4 / type de PDV) -->
      <UFormGroup v-if="showSousCategorie" label="Sous-catégorie" size="sm">
        <USelectMenu
          v-model="model.sousCategorie"
          :options="sousCategorieRefOptions"
          placeholder="Toutes"
          size="sm"
          searchable
        />
      </UFormGroup>

      <!-- Commercial -->
      <UFormGroup v-if="showCommercial" label="Commercial" size="sm">
        <USelectMenu
          v-model="model.commercial"
          :options="commercialOptions"
          placeholder="Tous"
          size="sm"
          searchable
          searchable-placeholder="Rechercher..."
          :search-attributes="['label']"
          value-attribute="value"
          option-attribute="label"
        />
      </UFormGroup>

      <!-- Région -->
      <UFormGroup v-if="showRegion" label="Région" size="sm">
        <USelectMenu
          v-model="model.region"
          :options="regionOptions"
          placeholder="Toutes"
          size="sm"
        />
      </UFormGroup>

      <!-- Zone -->
      <UFormGroup v-if="showZone" label="Zone" size="sm">
        <USelectMenu
          v-model="model.zone"
          :options="zoneOptions"
          placeholder="Toutes"
          size="sm"
          searchable
        />
      </UFormGroup>

      <!-- Quartier -->
      <UFormGroup v-if="showQuartier" label="Quartier" size="sm">
        <UInput v-model="model.quartier" placeholder="Quartier..." size="sm" />
      </UFormGroup>

      <!-- Nom du PDV -->
      <UFormGroup v-if="showNomPdv" label="Nom du PDV" size="sm">
        <UInput v-model="model.nomPdv" placeholder="Nom..." size="sm" />
      </UFormGroup>

      <!-- Actions -->
      <div class="flex items-end gap-2">
        <UButton size="sm" @click="$emit('filter')" icon="i-heroicons-magnifying-glass">
          Filtrer
        </UButton>
        <UButton size="sm" variant="ghost" @click="reset">
          Réinitialiser
        </UButton>
      </div>
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
  region: string
  zone: string
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
  showQuartier?: boolean
  showNomPdv?: boolean
  regionOptions?: string[]
  zoneOptions?: string[]
}>(), {
  showCanal: true,
  showCategorie: true,
  showSousCategorie: true,
  showCommercial: true,
  showRegion: true,
  showZone: true,
  showQuartier: true,
  showNomPdv: true,
  regionOptions: () => ['', 'ABIDJAN 1', 'ABIDJAN 2', 'CNE', 'CNO', 'MODERN TRADE'],
  zoneOptions: () => [''],
})

const emit = defineEmits(['update:modelValue', 'filter'])

// Charger les commerciaux pour le dropdown
const { users: cachedUsers, fetchUsers: fetchCachedUsers } = useUsersCache()

// Catégories/sous-catégories depuis le référentiel (pos_types) — plus de liste figée.
const { posTypes, fetchReferentiels } = useReferentiels()
const categorieRefOptions = computed(() => ['', ...new Set(posTypes.value.map(p => p.level3_group).filter(Boolean))].sort())
const sousCategorieRefOptions = computed(() => {
  const filtered = posTypes.value.filter(p => !model.value.categorie || p.level3_group === model.value.categorie)
  return ['', ...new Set(filtered.map(p => p.level4_type).filter(Boolean))]
})

onMounted(() => { fetchCachedUsers(); fetchReferentiels() })

const commercialOptions = computed(() => [
  { value: '', label: 'Tous' },
  ...cachedUsers.value
    .filter(u => u.is_active !== false)
    .map(u => ({ value: u.nom || u.email || '', label: `${u.nom || '—'} (${u.email})` }))
])

const model = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

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
    region: '',
    zone: '',
    quartier: '',
    nomPdv: '',
  })
  emit('filter')
}
</script>
