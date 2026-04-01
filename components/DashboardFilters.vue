<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 mb-6">
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

      <!-- Catégorie de PDV -->
      <UFormGroup v-if="showCategorie" label="Catégorie de PDV" size="sm">
        <USelectMenu
          v-model="model.categorie"
          :options="['', 'Point de vente détail', 'Point de consommation']"
          placeholder="Toutes"
          size="sm"
        />
      </UFormGroup>

      <!-- Sous-catégorie -->
      <UFormGroup v-if="showSousCategorie" label="Sous-catégorie" size="sm">
        <USelectMenu
          v-model="model.sousCategorie"
          :options="['', 'Boutique A', 'Boutique B', 'Boutique C', 'Superette GT', 'Superette MT', 'Kiosque', 'Pushcart', 'Tabliers', 'Supermarché', 'Hypermarché']"
          placeholder="Toutes"
          size="sm"
        />
      </UFormGroup>

      <!-- Commercial -->
      <UFormGroup v-if="showCommercial" label="Commercial" size="sm">
        <UInput v-model="model.commercial" placeholder="Nom..." size="sm" />
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

      <!-- Secteur -->
      <UFormGroup v-if="showSecteur" label="Secteur" size="sm">
        <UInput v-model="model.secteur" placeholder="Secteur..." size="sm" />
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
          Reset
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
  secteur: string
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
  showSecteur?: boolean
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
  showSecteur: true,
  showNomPdv: true,
  regionOptions: () => ['', 'ABIDJAN 1', 'ABIDJAN 2', 'CNE', 'CNO', 'MODERN TRADE'],
  zoneOptions: () => [''],
})

const emit = defineEmits(['update:modelValue', 'filter'])

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
    secteur: '',
    nomPdv: '',
  })
  emit('filter')
}
</script>
