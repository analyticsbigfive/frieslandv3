<template>
  <div class="space-y-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Référentiels</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Distributeurs, territoires, types de PDV, poids et seuils de disponibilité.</p>
      </div>
      <UButton icon="i-heroicons-plus" class="bg-fc-blue" @click="openCreate">Ajouter</UButton>
    </div>

    <!-- Tabs -->
    <div class="border-b border-gray-200 dark:border-gray-600">
      <nav class="flex gap-6 overflow-x-auto">
        <button
          v-for="t in tabs"
          :key="t.key"
          class="pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap"
          :class="tab === t.key ? 'border-fc-red text-fc-red' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700'"
          @click="tab = t.key"
        >
          {{ t.label }} <span class="text-xs text-gray-400">({{ t.count }})</span>
        </button>
      </nav>
    </div>

    <div v-if="error" class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-200">
      Référentiels indisponibles — migrations <code>020</code> / <code>023</code> requises.
    </div>

    <UInput v-model="search" icon="i-heroicons-magnifying-glass" placeholder="Rechercher..." size="sm" class="w-72" />

    <!-- Distributeurs -->
    <div v-if="tab === 'distributeurs'" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-gray-700/50">
          <tr>
            <th class="th-l">Distributeur</th>
            <th class="th-c">Canal</th>
            <th class="th-c w-24">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-for="d in filteredDistributeurs" :key="d.name" class="row">
            <td class="px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100">{{ d.name }}</td>
            <td class="px-4 py-2.5 text-center"><UBadge :color="d.trade_type === 'MT' ? 'purple' : 'blue'" variant="soft" size="xs">{{ d.trade_type }}</UBadge></td>
            <td class="px-4 py-2.5 text-center"><UDropdown :items="rowActions(d)"><UButton variant="ghost" size="xs" icon="i-heroicons-ellipsis-vertical" /></UDropdown></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Territoires -->
    <div v-else-if="tab === 'territoires'" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-gray-700/50">
          <tr>
            <th class="th-l">Code</th>
            <th class="th-l">Territoire</th>
            <th class="th-l">Sous-région</th>
            <th class="th-c">Areas</th>
            <th class="th-c w-24">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-for="t in filteredTerritories" :key="t.code" class="row">
            <td class="px-4 py-2.5 text-xs font-mono text-gray-500 dark:text-gray-400">{{ t.code }}</td>
            <td class="px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100">{{ t.name }}</td>
            <td class="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{{ subRegionName(t.sub_region_code) }}</td>
            <td class="px-4 py-2.5 text-center text-sm text-gray-500 dark:text-gray-400">{{ areaCount(t.code) }}</td>
            <td class="px-4 py-2.5 text-center"><UDropdown :items="rowActions(t)"><UButton variant="ghost" size="xs" icon="i-heroicons-ellipsis-vertical" /></UDropdown></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Areas (assignation distributeur ↔ territoire) -->
    <div v-else-if="tab === 'areas'" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-gray-700/50">
          <tr>
            <th class="th-l">Territoire</th>
            <th class="th-l">Area</th>
            <th class="th-l">Distributeur assigné</th>
            <th class="th-c w-24">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-for="a in filteredAreas" :key="a.territory_code + '|' + a.area_code" class="row">
            <td class="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{{ territoryName(a.territory_code) }} <span class="text-xs font-mono text-gray-400">{{ a.territory_code }}</span></td>
            <td class="px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100">{{ a.area_name || a.area_code }}</td>
            <td class="px-4 py-2.5 text-sm">
              <span v-if="a.distributor_name" class="text-gray-900 dark:text-gray-100">{{ a.distributor_name }}</span>
              <UBadge v-else color="amber" variant="soft" size="xs">À pourvoir</UBadge>
            </td>
            <td class="px-4 py-2.5 text-center"><UDropdown :items="rowActions(a)"><UButton variant="ghost" size="xs" icon="i-heroicons-ellipsis-vertical" /></UDropdown></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Types PDV -->
    <div v-else-if="tab === 'pos'" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-gray-700/50">
          <tr>
            <th class="th-l">Type (Level 4)</th>
            <th class="th-l">Groupe (Level 3)</th>
            <th class="th-c">Canal</th>
            <th class="th-c">Tier</th>
            <th class="th-c w-24">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-for="p in filteredPosTypes" :key="p.level4_type" class="row">
            <td class="px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100">{{ p.level4_type }}</td>
            <td class="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{{ p.level3_group }}</td>
            <td class="px-4 py-2.5 text-center">
              <UBadge v-if="p.canal" :color="p.canal === 'MT' ? 'purple' : 'blue'" variant="soft" size="xs">{{ p.canal }}</UBadge>
              <span v-else class="text-gray-300">—</span>
            </td>
            <td class="px-4 py-2.5 text-center"><UBadge v-if="p.tier" color="gray" variant="soft" size="xs">{{ p.tier }}</UBadge><span v-else class="text-gray-300">—</span></td>
            <td class="px-4 py-2.5 text-center"><UDropdown :items="rowActions(p)"><UButton variant="ghost" size="xs" icon="i-heroicons-ellipsis-vertical" /></UDropdown></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Poids SKU (disponibilité) -->
    <div v-else-if="tab === 'poids'" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-gray-700/50">
          <tr>
            <th class="th-l">Catégorie</th>
            <th class="th-l">SKU</th>
            <th class="th-c">Canal</th>
            <th class="th-c">Base</th>
            <th class="th-c">Poids</th>
            <th class="th-c w-24">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-for="w in filteredWeights" :key="weightKey(w)" class="row">
            <td class="px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100">{{ w.category }}</td>
            <td class="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{{ w.sku }}</td>
            <td class="px-4 py-2.5 text-center"><UBadge :color="w.trade_type === 'MT' ? 'purple' : 'blue'" variant="soft" size="xs">{{ w.trade_type }}</UBadge></td>
            <td class="px-4 py-2.5 text-center text-xs text-gray-500 dark:text-gray-400">{{ w.basis }}</td>
            <td class="px-4 py-2.5 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">{{ (w.weight * 100).toFixed(0) }}%</td>
            <td class="px-4 py-2.5 text-center"><UDropdown :items="rowActions(w)"><UButton variant="ghost" size="xs" icon="i-heroicons-ellipsis-vertical" /></UDropdown></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Seuils de disponibilité -->
    <div v-else class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-gray-700/50">
          <tr>
            <th class="th-l">Catégorie</th>
            <th class="th-l">SKU</th>
            <th class="th-l">Segment</th>
            <th class="th-c">Grade</th>
            <th class="th-c">Qté min</th>
            <th class="th-c w-24">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-for="s in filteredStandards" :key="standardKey(s)" class="row">
            <td class="px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100">{{ s.category }}</td>
            <td class="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{{ s.sku }}</td>
            <td class="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{{ s.standard_group }}</td>
            <td class="px-4 py-2.5 text-center"><UBadge color="gray" variant="soft" size="xs">{{ s.tier }}</UBadge></td>
            <td class="px-4 py-2.5 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">{{ s.min_quantity }}</td>
            <td class="px-4 py-2.5 text-center"><UDropdown :items="rowActions(s)"><UButton variant="ghost" size="xs" icon="i-heroicons-ellipsis-vertical" /></UDropdown></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal CRUD -->
    <UModal v-model="showModal">
      <div class="p-6 space-y-4">
        <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ editing ? 'Modifier' : 'Ajouter' }} — {{ tabLabel }}</h3>

        <template v-if="tab === 'distributeurs'">
          <UFormGroup label="Nom *"><UInput v-model="form.name" :disabled="editing" placeholder="Nom du distributeur" /></UFormGroup>
          <UFormGroup label="Canal"><USelectMenu v-model="form.trade_type" :options="['GT', 'MT']" /></UFormGroup>
        </template>

        <template v-else-if="tab === 'territoires'">
          <UFormGroup label="Code *"><UInput v-model="form.code" :disabled="editing" placeholder="ex. TRE" /></UFormGroup>
          <UFormGroup label="Nom *"><UInput v-model="form.name" placeholder="ex. Treichville" /></UFormGroup>
          <UFormGroup label="Sous-région">
            <USelectMenu v-model="form.sub_region_code" :options="subRegionOptions" option-attribute="label" value-attribute="value" />
          </UFormGroup>
        </template>

        <template v-else-if="tab === 'areas'">
          <UFormGroup label="Territoire *">
            <USelectMenu v-model="form.territory_code" :disabled="editing" :options="territoryOptions" option-attribute="label" value-attribute="value" searchable placeholder="Choisir un territoire" />
          </UFormGroup>
          <UFormGroup label="Code area *"><UInput v-model="form.area_code" :disabled="editing" placeholder="ex. TRE-01" /></UFormGroup>
          <UFormGroup label="Nom area"><UInput v-model="form.area_name" placeholder="Nom (optionnel)" /></UFormGroup>
          <UFormGroup label="Distributeur assigné">
            <USelectMenu v-model="form.distributor_name" :options="distributorOptions" option-attribute="label" value-attribute="value" searchable placeholder="À pourvoir" />
          </UFormGroup>
        </template>

        <template v-else-if="tab === 'pos'">
          <UFormGroup label="Type (Level 4) *"><UInput v-model="form.level4_type" :disabled="editing" placeholder="ex. Boutique A" /></UFormGroup>
          <UFormGroup label="Groupe (Level 3) *"><UInput v-model="form.level3_group" placeholder="ex. Small/Medium Grocery GT" /></UFormGroup>
          <UFormGroup label="Canal"><USelectMenu v-model="form.canal" :options="['', 'GT', 'MT']" /></UFormGroup>
          <UFormGroup label="Tier"><USelectMenu v-model="form.tier" :options="['', 'A', 'B', 'C']" /></UFormGroup>
        </template>

        <template v-else-if="tab === 'poids'">
          <UFormGroup label="Catégorie *"><UInput v-model="form.category" :disabled="editing" placeholder="ex. EVAP" /></UFormGroup>
          <UFormGroup label="SKU *"><UInput v-model="form.sku" :disabled="editing" placeholder="ex. Bonnet Rouge 160g" /></UFormGroup>
          <UFormGroup label="Canal *"><USelectMenu v-model="form.trade_type" :disabled="editing" :options="['GT', 'MT']" /></UFormGroup>
          <UFormGroup label="Base *"><USelectMenu v-model="form.basis" :disabled="editing" :options="['taux_vente', 'taux_revu']" /></UFormGroup>
          <UFormGroup label="Poids (0 à 1) *"><UInput v-model.number="form.weight" type="number" step="0.01" min="0" max="1" placeholder="0.25" /></UFormGroup>
        </template>

        <template v-else>
          <UFormGroup label="Catégorie *"><UInput v-model="form.category" :disabled="editing" placeholder="ex. EVAP" /></UFormGroup>
          <UFormGroup label="SKU *"><UInput v-model="form.sku" :disabled="editing" placeholder="ex. Bonnet Rouge 160g" /></UFormGroup>
          <UFormGroup label="Segment *"><UInput v-model="form.standard_group" :disabled="editing" placeholder="ex. BOUTIQUE, MINI MARKET, SUPERETTE (MT)" /></UFormGroup>
          <UFormGroup label="Grade *"><USelectMenu v-model="form.tier" :disabled="editing" :options="['A', 'B', 'C']" /></UFormGroup>
          <UFormGroup label="Quantité minimale *"><UInput v-model.number="form.min_quantity" type="number" min="0" step="1" placeholder="ex. 3" /></UFormGroup>
        </template>

        <div class="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <UButton variant="ghost" @click="showModal = false">Annuler</UButton>
          <UButton class="bg-fc-blue" :loading="saving" :disabled="!canSave" @click="save">Enregistrer</UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const supabase = useSupabaseClient()
const toast = useToast()
const {
  distributeurs, subRegions, territories, areas, posTypes,
  availabilityWeights, availabilityStandards, error, fetchReferentiels,
} = useReferentiels()

type Tab = 'distributeurs' | 'territoires' | 'areas' | 'pos' | 'poids' | 'seuils'
const tab = ref<Tab>('distributeurs')
const search = ref('')
const showModal = ref(false)
const editing = ref(false)
const saving = ref(false)
const form = ref<any>({})

const tabs = computed(() => [
  { key: 'distributeurs', label: 'Distributeurs', count: distributeurs.value.length },
  { key: 'territoires', label: 'Territoires', count: territories.value.length },
  { key: 'areas', label: 'Areas / Distributeurs', count: areas.value.length },
  { key: 'pos', label: 'Types de PDV', count: posTypes.value.length },
  { key: 'poids', label: 'Poids SKU', count: availabilityWeights.value.length },
  { key: 'seuils', label: 'Seuils', count: availabilityStandards.value.length },
] as const)
const tabLabel = computed(() => tabs.value.find(t => t.key === tab.value)?.label || '')

const q = computed(() => search.value.trim().toLowerCase())
const filteredDistributeurs = computed(() => distributeurs.value.filter(d => !q.value || d.name.toLowerCase().includes(q.value)))
const filteredTerritories = computed(() => territories.value.filter(t => !q.value || t.name.toLowerCase().includes(q.value) || t.code.toLowerCase().includes(q.value)))
const filteredAreas = computed(() => areas.value.filter(a => !q.value || (a.area_name || '').toLowerCase().includes(q.value) || a.area_code.toLowerCase().includes(q.value) || (a.distributor_name || '').toLowerCase().includes(q.value) || a.territory_code.toLowerCase().includes(q.value)))
const filteredPosTypes = computed(() => posTypes.value.filter(p => !q.value || p.level4_type.toLowerCase().includes(q.value) || p.level3_group.toLowerCase().includes(q.value)))
const filteredWeights = computed(() => availabilityWeights.value.filter(w => !q.value || w.category.toLowerCase().includes(q.value) || w.sku.toLowerCase().includes(q.value)))
const filteredStandards = computed(() => availabilityStandards.value.filter(s => !q.value || s.category.toLowerCase().includes(q.value) || s.sku.toLowerCase().includes(q.value) || s.standard_group.toLowerCase().includes(q.value)))

const subRegionName = (code: string | null) => subRegions.value.find(s => s.code === code)?.name || '—'
const subRegionOptions = computed(() => [{ value: '', label: '—' }, ...subRegions.value.map(s => ({ value: s.code, label: s.name }))])
const territoryName = (code: string) => territories.value.find(t => t.code === code)?.name || code
const territoryOptions = computed(() => territories.value.map(t => ({ value: t.code, label: `${t.name} (${t.code})` })))
const distributorOptions = computed(() => [{ value: '', label: 'À pourvoir' }, ...distributeurs.value.map(d => ({ value: d.name, label: d.name }))])

const areaCountMap = computed(() => {
  const m: Record<string, number> = {}
  for (const a of areas.value) m[a.territory_code] = (m[a.territory_code] || 0) + 1
  return m
})
const areaCount = (code: string) => areaCountMap.value[code] || 0

const weightKey = (w: any) => `${w.category}|${w.trade_type}|${w.basis}|${w.sku}`
const standardKey = (s: any) => `${s.category}|${s.sku}|${s.standard_group}|${s.tier}`

const canSave = computed(() => {
  const f = form.value
  switch (tab.value) {
    case 'distributeurs': return !!f.name
    case 'territoires': return !!f.code && !!f.name
    case 'areas': return !!f.territory_code && !!f.area_code
    case 'pos': return !!f.level4_type && !!f.level3_group
    case 'poids': return !!f.category && !!f.sku && !!f.trade_type && !!f.basis && typeof f.weight === 'number' && f.weight >= 0 && f.weight <= 1
    case 'seuils': return !!f.category && !!f.sku && !!f.standard_group && !!f.tier && typeof f.min_quantity === 'number' && f.min_quantity >= 0
    default: return false
  }
})

function openCreate() {
  editing.value = false
  switch (tab.value) {
    case 'distributeurs': form.value = { name: '', trade_type: 'GT' }; break
    case 'territoires': form.value = { code: '', name: '', sub_region_code: '' }; break
    case 'areas': form.value = { territory_code: '', area_code: '', area_name: '', distributor_name: '' }; break
    case 'pos': form.value = { level4_type: '', level3_group: '', canal: '', tier: '' }; break
    case 'poids': form.value = { category: '', sku: '', trade_type: 'GT', basis: 'taux_vente', weight: 0 }; break
    case 'seuils': form.value = { category: '', sku: '', standard_group: '', tier: 'A', min_quantity: 0 }; break
  }
  showModal.value = true
}

function rowActions(row: any) {
  return [[
    { label: 'Modifier', icon: 'i-heroicons-pencil', click: () => openEdit(row) },
    { label: 'Supprimer', icon: 'i-heroicons-trash', click: () => remove(row) },
  ]]
}

function openEdit(row: any) {
  editing.value = true
  form.value = { ...row }
  showModal.value = true
}

async function save() {
  saving.value = true
  try {
    const f = form.value
    let res
    switch (tab.value) {
      case 'distributeurs':
        res = await supabase.from('distributeurs').upsert({ name: f.name, trade_type: f.trade_type || 'GT' }, { onConflict: 'name' })
        break
      case 'territoires':
        res = await supabase.from('geo_territories').upsert({ code: f.code, name: f.name, sub_region_code: f.sub_region_code || null }, { onConflict: 'code' })
        break
      case 'areas':
        res = await supabase.from('geo_areas').upsert({ territory_code: f.territory_code, area_code: f.area_code, area_name: f.area_name || null, distributor_name: f.distributor_name || null }, { onConflict: 'territory_code,area_code' })
        break
      case 'pos':
        res = await supabase.from('pos_types').upsert({ level4_type: f.level4_type, level3_group: f.level3_group, canal: f.canal || null, tier: f.tier || null }, { onConflict: 'level4_type' })
        break
      case 'poids':
        res = await supabase.from('availability_weights').upsert({ category: f.category, trade_type: f.trade_type, basis: f.basis, sku: f.sku, weight: f.weight }, { onConflict: 'category,trade_type,basis,sku' })
        break
      case 'seuils':
        res = await supabase.from('availability_standards').upsert({ category: f.category, sku: f.sku, standard_group: f.standard_group, tier: f.tier, min_quantity: f.min_quantity }, { onConflict: 'category,sku,standard_group,tier' })
        break
    }
    if (res?.error) throw res.error
    toast.add({ title: 'Enregistré', color: 'green' })
    showModal.value = false
    await fetchReferentiels(true)
  }
  catch (err: any) {
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
  }
  finally {
    saving.value = false
  }
}

async function remove(row: any) {
  const label = row.name || row.level4_type || row.code || row.sku || row.area_code
  if (!confirm(`Supprimer "${label}" ?`)) return
  try {
    let res
    switch (tab.value) {
      case 'distributeurs': res = await supabase.from('distributeurs').delete().eq('name', row.name); break
      case 'territoires': res = await supabase.from('geo_territories').delete().eq('code', row.code); break
      case 'areas': res = await supabase.from('geo_areas').delete().eq('territory_code', row.territory_code).eq('area_code', row.area_code); break
      case 'pos': res = await supabase.from('pos_types').delete().eq('level4_type', row.level4_type); break
      case 'poids': res = await supabase.from('availability_weights').delete().eq('category', row.category).eq('trade_type', row.trade_type).eq('basis', row.basis).eq('sku', row.sku); break
      case 'seuils': res = await supabase.from('availability_standards').delete().eq('category', row.category).eq('sku', row.sku).eq('standard_group', row.standard_group).eq('tier', row.tier); break
    }
    if (res?.error) throw res.error
    toast.add({ title: 'Supprimé', color: 'green' })
    await fetchReferentiels(true)
  }
  catch (err: any) {
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
  }
}

onMounted(() => fetchReferentiels())
</script>

<style scoped>
.th-l { @apply px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase; }
.th-c { @apply px-4 py-2.5 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase; }
.row { @apply hover:bg-gray-50 dark:hover:bg-gray-700/50; }
</style>
