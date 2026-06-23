<template>
  <div class="space-y-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Référentiels</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Distributeurs, territoires et types de point de vente.</p>
      </div>
      <UButton icon="i-heroicons-plus" class="bg-fc-blue" @click="openCreate">Ajouter</UButton>
    </div>

    <!-- Tabs -->
    <div class="border-b border-gray-200 dark:border-gray-600">
      <nav class="flex gap-6">
        <button
          v-for="t in tabs"
          :key="t.key"
          class="pb-3 text-sm font-medium border-b-2 transition-colors"
          :class="tab === t.key ? 'border-fc-red text-fc-red' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700'"
          @click="tab = t.key"
        >
          {{ t.label }} <span class="text-xs text-gray-400">({{ t.count }})</span>
        </button>
      </nav>
    </div>

    <div v-if="error" class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-200">
      Référentiels indisponibles — migration <code>020</code> requise.
    </div>

    <UInput v-model="search" icon="i-heroicons-magnifying-glass" placeholder="Rechercher..." size="sm" class="w-72" />

    <!-- Distributeurs -->
    <div v-if="tab === 'distributeurs'" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-gray-700/50">
          <tr>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Distributeur</th>
            <th class="px-4 py-2.5 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Canal</th>
            <th class="px-4 py-2.5 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-24">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-for="d in filteredDistributeurs" :key="d.name" class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
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
            <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Code</th>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Territoire</th>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Sous-région</th>
            <th class="px-4 py-2.5 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Areas</th>
            <th class="px-4 py-2.5 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-24">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-for="t in filteredTerritories" :key="t.code" class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <td class="px-4 py-2.5 text-xs font-mono text-gray-500 dark:text-gray-400">{{ t.code }}</td>
            <td class="px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100">{{ t.name }}</td>
            <td class="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{{ subRegionName(t.sub_region_code) }}</td>
            <td class="px-4 py-2.5 text-center text-sm text-gray-500 dark:text-gray-400">{{ areaCount(t.code) }}</td>
            <td class="px-4 py-2.5 text-center"><UDropdown :items="rowActions(t)"><UButton variant="ghost" size="xs" icon="i-heroicons-ellipsis-vertical" /></UDropdown></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Types PDV -->
    <div v-else class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-gray-700/50">
          <tr>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type (Level 4)</th>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Groupe (Level 3)</th>
            <th class="px-4 py-2.5 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tier</th>
            <th class="px-4 py-2.5 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-24">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-for="p in filteredPosTypes" :key="p.level4_type" class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <td class="px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100">{{ p.level4_type }}</td>
            <td class="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{{ p.level3_group }}</td>
            <td class="px-4 py-2.5 text-center"><UBadge v-if="p.tier" color="gray" variant="soft" size="xs">{{ p.tier }}</UBadge><span v-else class="text-gray-300">—</span></td>
            <td class="px-4 py-2.5 text-center"><UDropdown :items="rowActions(p)"><UButton variant="ghost" size="xs" icon="i-heroicons-ellipsis-vertical" /></UDropdown></td>
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

        <template v-else>
          <UFormGroup label="Type (Level 4) *"><UInput v-model="form.level4_type" :disabled="editing" placeholder="ex. Boutique A" /></UFormGroup>
          <UFormGroup label="Groupe (Level 3) *"><UInput v-model="form.level3_group" placeholder="ex. Small/Medium Grocery GT" /></UFormGroup>
          <UFormGroup label="Tier"><USelectMenu v-model="form.tier" :options="['', 'A', 'B', 'C']" /></UFormGroup>
        </template>

        <div class="flex justify-end gap-2 pt-2 border-t">
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
const { distributeurs, subRegions, territories, areas, posTypes, error, fetchReferentiels } = useReferentiels()

const tab = ref<'distributeurs' | 'territoires' | 'pos'>('distributeurs')
const search = ref('')
const showModal = ref(false)
const editing = ref(false)
const saving = ref(false)
const form = ref<any>({})

const tabs = computed(() => [
  { key: 'distributeurs', label: 'Distributeurs', count: distributeurs.value.length },
  { key: 'territoires', label: 'Territoires', count: territories.value.length },
  { key: 'pos', label: 'Types de PDV', count: posTypes.value.length },
])
const tabLabel = computed(() => tabs.value.find(t => t.key === tab.value)?.label || '')

const q = computed(() => search.value.trim().toLowerCase())
const filteredDistributeurs = computed(() => distributeurs.value.filter(d => !q.value || d.name.toLowerCase().includes(q.value)))
const filteredTerritories = computed(() => territories.value.filter(t => !q.value || t.name.toLowerCase().includes(q.value) || t.code.toLowerCase().includes(q.value)))
const filteredPosTypes = computed(() => posTypes.value.filter(p => !q.value || p.level4_type.toLowerCase().includes(q.value) || p.level3_group.toLowerCase().includes(q.value)))

const subRegionName = (code: string | null) => subRegions.value.find(s => s.code === code)?.name || '—'
const subRegionOptions = computed(() => [{ value: '', label: '—' }, ...subRegions.value.map(s => ({ value: s.code, label: s.name }))])
const areaCountMap = computed(() => {
  const m: Record<string, number> = {}
  for (const a of areas.value) m[a.territory_code] = (m[a.territory_code] || 0) + 1
  return m
})
const areaCount = (code: string) => areaCountMap.value[code] || 0

const canSave = computed(() => {
  if (tab.value === 'distributeurs') return !!form.value.name
  if (tab.value === 'territoires') return !!form.value.code && !!form.value.name
  return !!form.value.level4_type && !!form.value.level3_group
})

function openCreate() {
  editing.value = false
  if (tab.value === 'distributeurs') form.value = { name: '', trade_type: 'GT' }
  else if (tab.value === 'territoires') form.value = { code: '', name: '', sub_region_code: '' }
  else form.value = { level4_type: '', level3_group: '', tier: '' }
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
    let res
    if (tab.value === 'distributeurs') {
      res = await supabase.from('distributeurs').upsert({ name: form.value.name, trade_type: form.value.trade_type || 'GT' }, { onConflict: 'name' })
    } else if (tab.value === 'territoires') {
      res = await supabase.from('geo_territories').upsert({ code: form.value.code, name: form.value.name, sub_region_code: form.value.sub_region_code || null }, { onConflict: 'code' })
    } else {
      res = await supabase.from('pos_types').upsert({ level4_type: form.value.level4_type, level3_group: form.value.level3_group, tier: form.value.tier || null }, { onConflict: 'level4_type' })
    }
    if (res.error) throw res.error
    toast.add({ title: 'Enregistré', color: 'green' })
    showModal.value = false
    await fetchReferentiels(true)
  } catch (err: any) {
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
  } finally {
    saving.value = false
  }
}

async function remove(row: any) {
  const label = row.name || row.level4_type || row.code
  if (!confirm(`Supprimer "${label}" ?`)) return
  try {
    let res
    if (tab.value === 'distributeurs') res = await supabase.from('distributeurs').delete().eq('name', row.name)
    else if (tab.value === 'territoires') res = await supabase.from('geo_territories').delete().eq('code', row.code)
    else res = await supabase.from('pos_types').delete().eq('level4_type', row.level4_type)
    if (res.error) throw res.error
    toast.add({ title: 'Supprimé', color: 'green' })
    await fetchReferentiels(true)
  } catch (err: any) {
    toast.add({ title: 'Erreur', description: err.message, color: 'red' })
  }
}

onMounted(() => fetchReferentiels())
</script>
