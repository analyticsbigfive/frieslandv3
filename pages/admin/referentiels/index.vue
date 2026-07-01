<template>
  <div class="space-y-6">
    <div class="flex flex-col items-start justify-between gap-4 sm:flex-row">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Référentiels</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Distributeurs, territoires, types de PDV, poids et seuils de disponibilité <span class="text-xs">(Système B)</span>.</p>
      </div>
      <UButton v-if="tab !== 'distrib'" icon="i-heroicons-plus" class="bg-fc-blue" @click="openCreate">Ajouter</UButton>
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
      Référentiels indisponibles — migrations <code>supabase/nouveau</code> requises.
    </div>

    <div class="admin-toolbar">
      <UInput v-model="search" icon="i-heroicons-magnifying-glass" placeholder="Rechercher..." size="sm" class="w-full sm:w-72" />
    </div>

    <!-- Distributeurs -->
    <div v-if="tab === 'distributeurs'" class="admin-surface overflow-x-auto">
      <table class="admin-table">
        <thead class="bg-gray-50 dark:bg-gray-700/50">
          <tr><th class="th-l">Distributeur</th><th class="th-c">Couverture</th><th class="th-c w-24">Actions</th></tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-for="d in filteredDistributeurs" :key="d.name" class="row">
            <td class="px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100">{{ d.name }}</td>
            <td class="px-4 py-2.5 text-center"><UBadge :color="d.national ? 'purple' : 'blue'" variant="soft" size="xs">{{ d.national ? 'National' : 'Local' }}</UBadge></td>
            <td class="px-4 py-2.5 text-center"><UDropdown :items="rowActions(d)"><UButton variant="ghost" size="xs" icon="i-heroicons-ellipsis-vertical" /></UDropdown></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Territoires -->
    <div v-else-if="tab === 'territoires'" class="admin-surface overflow-x-auto">
      <table class="admin-table">
        <thead class="bg-gray-50 dark:bg-gray-700/50">
          <tr><th class="th-l">Code</th><th class="th-l">Territoire</th><th class="th-l">Sous-région</th><th class="th-c w-24">Actions</th></tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-for="t in filteredTerritories" :key="t.code" class="row">
            <td class="px-4 py-2.5 text-xs font-mono text-gray-500 dark:text-gray-400">{{ t.code }}</td>
            <td class="px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100">{{ t.name }}</td>
            <td class="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{{ subRegionName(t.sub_region_code) }}</td>
            <td class="px-4 py-2.5 text-center"><UDropdown :items="rowActions(t)"><UButton variant="ghost" size="xs" icon="i-heroicons-ellipsis-vertical" /></UDropdown></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Distributeurs ↔ Territoires (M2M, lecture seule) -->
    <div v-else-if="tab === 'zones'" class="admin-surface overflow-x-auto">
      <table class="admin-table">
        <thead class="bg-gray-50 dark:bg-gray-700/50">
          <tr><th class="th-l">Code Area</th><th class="th-l">Zone / Area</th><th class="th-l">Territoire</th><th class="th-c w-24">Actions</th></tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-for="a in filteredAreas" :key="`${a.territory_code}-${a.code}-${a.name}`" class="row">
            <td class="px-4 py-2.5 text-xs font-mono text-gray-500 dark:text-gray-400">{{ a.code || '—' }}</td>
            <td class="px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100">{{ a.name }}</td>
            <td class="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{{ territoryName(a.territory_code) }}</td>
            <td class="px-4 py-2.5 text-center"><UDropdown :items="rowActions(a)"><UButton variant="ghost" size="xs" icon="i-heroicons-ellipsis-vertical" /></UDropdown></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Distributeurs ↔ Territoires (M2M, lecture seule) -->
    <div v-else-if="tab === 'distrib'" class="admin-surface overflow-x-auto">
      <table class="admin-table">
        <thead class="bg-gray-50 dark:bg-gray-700/50">
          <tr><th class="th-l">Territoire</th><th class="th-l">Distributeur assigné</th></tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-for="(a, i) in filteredTerrDistrib" :key="i" class="row">
            <td class="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{{ a.territory_name }} <span class="text-xs font-mono text-gray-400">{{ a.territory_code }}</span></td>
            <td class="px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100">{{ a.distributor_name }}</td>
          </tr>
          <tr v-if="!filteredTerrDistrib.length"><td colspan="2" class="px-4 py-6 text-center text-xs text-gray-400">Aucune assignation (table territoire_distributeur).</td></tr>
        </tbody>
      </table>
      <p class="px-5 py-2 text-xs text-gray-400">Lecture seule. Les distributeurs nationaux couvrent tous les territoires en plus de ce mapping.</p>
    </div>

    <!-- Types PDV -->
    <div v-else-if="tab === 'pos'" class="admin-surface overflow-x-auto">
      <table class="admin-table">
        <thead class="bg-gray-50 dark:bg-gray-700/50">
          <tr><th class="th-l">Type (niveau 4)</th><th class="th-l">Catégorie (niveau 3)</th><th class="th-c">Canal</th><th class="th-c w-24">Actions</th></tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-for="p in filteredPosTypes" :key="p.level4_type" class="row">
            <td class="px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100">{{ p.level4_type }}</td>
            <td class="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{{ p.level3_group }}</td>
            <td class="px-4 py-2.5 text-center"><UBadge v-if="p.canal" :color="p.canal === 'MT' ? 'purple' : 'blue'" variant="soft" size="xs">{{ p.canal }}</UBadge><span v-else class="text-gray-300">—</span></td>
            <td class="px-4 py-2.5 text-center"><UDropdown :items="rowActions(p)"><UButton variant="ghost" size="xs" icon="i-heroicons-ellipsis-vertical" /></UDropdown></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Poids SKU (disponibilité) -->
    <div v-else-if="tab === 'poids'" class="admin-surface overflow-x-auto">
      <table class="admin-table">
        <thead class="bg-gray-50 dark:bg-gray-700/50">
          <tr><th class="th-l">Catégorie</th><th class="th-l">Référence</th><th class="th-c">Canal</th><th class="th-c">Base</th><th class="th-c">Poids</th><th class="th-c w-24">Actions</th></tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-for="w in filteredWeights" :key="weightKey(w)" class="row">
            <td class="px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100">{{ w.category }}</td>
            <td class="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{{ w.sku }}</td>
            <td class="px-4 py-2.5 text-center"><UBadge :color="w.trade_type === 'MT' ? 'purple' : 'blue'" variant="soft" size="xs">{{ w.trade_type }}</UBadge></td>
            <td class="px-4 py-2.5 text-center text-xs text-gray-500">{{ w.basis === 'taux_revu' ? 'Taux revu' : 'Taux vente' }}</td>
            <td class="px-4 py-2.5 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">{{ (w.weight * 100).toFixed(1) }}%</td>
            <td class="px-4 py-2.5 text-center"><UDropdown :items="rowActions(w)"><UButton variant="ghost" size="xs" icon="i-heroicons-ellipsis-vertical" /></UDropdown></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Seuils de disponibilité -->
    <div v-else class="admin-surface overflow-x-auto">
      <table class="admin-table">
        <thead class="bg-gray-50 dark:bg-gray-700/50">
          <tr><th class="th-l">Catégorie</th><th class="th-l">Référence</th><th class="th-l">Segment</th><th class="th-c">Grade</th><th class="th-c">Qté min</th><th class="th-c w-24">Actions</th></tr>
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
          <UFormGroup label="Couverture nationale"><USelectMenu v-model="form.national" :options="[{ value: false, label: 'Local' }, { value: true, label: 'National' }]" option-attribute="label" value-attribute="value" /></UFormGroup>
        </template>

        <template v-else-if="tab === 'territoires'">
          <UFormGroup label="Code *"><UInput v-model="form.code" :disabled="editing" placeholder="ex. TRE" /></UFormGroup>
          <UFormGroup label="Nom *"><UInput v-model="form.name" placeholder="ex. Treichville" /></UFormGroup>
          <UFormGroup label="Sous-région *"><USelectMenu v-model="form.sub_region_code" :options="subRegionOptions" option-attribute="label" value-attribute="value" /></UFormGroup>
        </template>

        <template v-else-if="tab === 'zones'">
          <UFormGroup label="Code Area"><UInput v-model="form.code" placeholder="ex. NVEG" /></UFormGroup>
          <UFormGroup label="Nom de la zone *"><UTextarea v-model="form.name" placeholder="Libellé complet de la zone" /></UFormGroup>
          <UFormGroup label="Territoire *"><USelectMenu v-model="form.territory_code" :options="territoryOptions" option-attribute="label" value-attribute="value" searchable /></UFormGroup>
        </template>

        <template v-else-if="tab === 'pos'">
          <UFormGroup label="Type (niveau 4) *"><UInput v-model="form.level4_type" :disabled="editing" placeholder="ex. Boutique A" /></UFormGroup>
          <UFormGroup label="Catégorie (niveau 3) *"><USelectMenu v-model="form.categorie_pdv_id" :options="categorieOptions" option-attribute="label" value-attribute="value" placeholder="Choisir une catégorie" /></UFormGroup>
          <p class="text-xs text-gray-400">Le canal (GT/MT) est porté par la catégorie, pas par le type.</p>
        </template>

        <template v-else-if="tab === 'poids'">
          <UFormGroup label="Référence *"><USelectMenu v-model="form.sku" :disabled="editing" :options="referenceOptions" option-attribute="label" value-attribute="value" searchable placeholder="Choisir une référence" /></UFormGroup>
          <UFormGroup label="Canal *"><USelectMenu v-model="form.trade_type" :disabled="editing" :options="['GT', 'MT']" /></UFormGroup>
          <UFormGroup label="Base de calcul *"><USelectMenu v-model="form.basis" :disabled="editing" :options="[{ value: 'taux_vente', label: 'Taux vente' }, { value: 'taux_revu', label: 'Taux revu' }]" option-attribute="label" value-attribute="value" /></UFormGroup>
          <UFormGroup label="Poids (0 à 1) *"><UInput v-model.number="form.weight" type="number" step="0.0001" min="0" max="1" placeholder="0.25" /></UFormGroup>
        </template>

        <template v-else>
          <UFormGroup label="Référence *"><USelectMenu v-model="form.sku" :disabled="editing" :options="referenceOptions" option-attribute="label" value-attribute="value" searchable placeholder="Choisir une référence" /></UFormGroup>
          <UFormGroup label="Segment *"><USelectMenu v-model="form.standard_group" :disabled="editing" :options="SEGMENTS" /></UFormGroup>
          <UFormGroup label="Grade *"><USelectMenu v-model="form.tier" :disabled="editing" :options="['A', 'B', 'C']" /></UFormGroup>
          <UFormGroup label="Quantité minimale *"><UInput v-model.number="form.min_quantity" type="number" min="0" step="1" placeholder="ex. 24" /></UFormGroup>
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
  availabilityWeights, availabilityStandards,
  references, categoriesPdv, territoireDistributeurs,
  error, fetchReferentiels,
} = useReferentiels()

const SEGMENTS = ['Boutique', 'Minimarket', 'Kiosque', 'Aboki', 'Pushcart', 'TableTop', 'Porridge']

type Tab = 'distributeurs' | 'territoires' | 'zones' | 'distrib' | 'pos' | 'poids' | 'seuils'
const tab = ref<Tab>('distributeurs')
const search = ref('')
const showModal = ref(false)
const editing = ref(false)
const saving = ref(false)
const form = ref<any>({})

const tabs = computed(() => [
  { key: 'distributeurs', label: 'Distributeurs', count: distributeurs.value.length },
  { key: 'territoires', label: 'Territoires', count: territories.value.length },
  { key: 'zones', label: 'Zones / Areas', count: areas.value.length },
  { key: 'distrib', label: 'Distrib ↔ Territoires', count: territoireDistributeurs.value.length },
  { key: 'pos', label: 'Types de PDV', count: posTypes.value.length },
  { key: 'poids', label: 'Poids SKU', count: availabilityWeights.value.length },
  { key: 'seuils', label: 'Seuils', count: availabilityStandards.value.length },
] as const)
const tabLabel = computed(() => tabs.value.find(t => t.key === tab.value)?.label || '')

const q = computed(() => search.value.trim().toLowerCase())
const filteredDistributeurs = computed(() => distributeurs.value.filter(d => !q.value || d.name.toLowerCase().includes(q.value)))
const filteredTerritories = computed(() => territories.value.filter(t => !q.value || t.name.toLowerCase().includes(q.value) || t.code.toLowerCase().includes(q.value)))
const filteredAreas = computed(() => areas.value.filter(a => !q.value || a.name.toLowerCase().includes(q.value) || a.code.toLowerCase().includes(q.value) || a.territory_code.toLowerCase().includes(q.value)))
const filteredTerrDistrib = computed(() => territoireDistributeurs.value.filter(a => !q.value || a.territory_name.toLowerCase().includes(q.value) || a.distributor_name.toLowerCase().includes(q.value) || a.territory_code.toLowerCase().includes(q.value)))
const filteredPosTypes = computed(() => posTypes.value.filter(p => !q.value || p.level4_type.toLowerCase().includes(q.value) || p.level3_group.toLowerCase().includes(q.value)))
const filteredWeights = computed(() => availabilityWeights.value.filter(w => !q.value || w.category.toLowerCase().includes(q.value) || w.sku.toLowerCase().includes(q.value)))
const filteredStandards = computed(() => availabilityStandards.value.filter(s => !q.value || s.category.toLowerCase().includes(q.value) || s.sku.toLowerCase().includes(q.value) || s.standard_group.toLowerCase().includes(q.value)))

const subRegionName = (code: string | null) => subRegions.value.find(s => s.code === code)?.name || '—'
const territoryName = (code: string) => territories.value.find(t => t.code === code)?.name || code
const subRegionOptions = computed(() => subRegions.value.map(s => ({ value: s.code, label: s.name })))
const territoryOptions = computed(() => territories.value.map(t => ({ value: t.code, label: `${t.name} · ${t.code}` })))
const categorieOptions = computed(() => categoriesPdv.value.map(c => ({ value: c.id, label: `${c.nom}${c.canal ? ' · ' + c.canal : ''}` })))
const referenceOptions = computed(() => references.value.map(r => ({ value: r.nom, label: `${r.nom} (${r.category})` })))

const weightKey = (w: any) => `${w.category}|${w.trade_type}|${w.basis}|${w.sku}`
const standardKey = (s: any) => `${s.category}|${s.sku}|${s.standard_group}|${s.tier}`
const refId = (nom: string) => references.value.find(r => r.nom === nom)?.id ?? null

const canSave = computed(() => {
  const f = form.value
  switch (tab.value) {
    case 'distributeurs': return !!f.name
    case 'territoires': return !!f.code && !!f.name && !!f.sub_region_code
    case 'zones': return !!f.name && !!f.territory_code
    case 'pos': return !!f.level4_type && !!f.categorie_pdv_id
    case 'poids': return !!f.sku && !!f.trade_type && !!f.basis && typeof f.weight === 'number' && f.weight >= 0 && f.weight <= 1
    case 'seuils': return !!f.sku && !!f.standard_group && !!f.tier && typeof f.min_quantity === 'number' && f.min_quantity >= 0
    default: return false
  }
})

function openCreate() {
  editing.value = false
  switch (tab.value) {
    case 'distributeurs': form.value = { name: '', national: false }; break
    case 'territoires': form.value = { code: '', name: '', sub_region_code: '' }; break
    case 'zones': form.value = { code: '', name: '', territory_code: '' }; break
    case 'pos': form.value = { level4_type: '', categorie_pdv_id: null }; break
    case 'poids': form.value = { sku: '', trade_type: 'GT', basis: 'taux_vente', weight: 0 }; break
    case 'seuils': form.value = { sku: '', standard_group: 'Boutique', tier: 'A', min_quantity: 0 }; break
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
  if (tab.value === 'pos') {
    const cat = categoriesPdv.value.find(c => c.nom === row.level3_group)
    form.value = { level4_type: row.level4_type, categorie_pdv_id: cat?.id ?? null }
  }
  else { form.value = { ...row } }
  showModal.value = true
}

async function save() {
  saving.value = true
  try {
    const f = form.value
    let res
    switch (tab.value) {
      case 'distributeurs':
        res = await supabase.from('distributeur').upsert({ nom: f.name, national: !!f.national }, { onConflict: 'nom' })
        break
      case 'territoires':
        res = await supabase.from('territoire').upsert({ code: f.code, nom: f.name, sous_region_code: f.sub_region_code }, { onConflict: 'code' })
        break
      case 'zones':
        if (editing.value && f.id) {
          res = await supabase.from('zone').update({ code: f.code || null, nom: f.name, territoire_code: f.territory_code }).eq('id', f.id)
        }
        else {
          res = await supabase.from('zone').insert({ code: f.code || null, nom: f.name, territoire_code: f.territory_code })
        }
        break
      case 'pos':
        res = await supabase.from('type_pdv').upsert({ nom: f.level4_type, categorie_pdv_id: f.categorie_pdv_id }, { onConflict: 'nom' })
        break
      case 'poids': {
        const id = refId(f.sku)
        if (!id) throw new Error('Référence introuvable')
        res = await supabase.from('poids_reference').upsert(
          { reference_produit_id: id, canal: f.trade_type, base_calcul: f.basis, poids: f.weight },
          { onConflict: 'reference_produit_id,canal,base_calcul' },
        )
        break
      }
      case 'seuils': {
        const id = refId(f.sku)
        if (!id) throw new Error('Référence introuvable')
        res = await supabase.from('seuil_disponibilite').upsert({ reference_produit_id: id, segment: f.standard_group, grade: f.tier, quantite_min: f.min_quantity }, { onConflict: 'reference_produit_id,segment,grade' })
        break
      }
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
  const label = row.name || row.level4_type || row.code || row.sku
  if (!confirm(`Supprimer "${label}" ?`)) return
  try {
    let res
    switch (tab.value) {
      case 'distributeurs': res = await supabase.from('distributeur').delete().eq('nom', row.name); break
      case 'territoires': res = await supabase.from('territoire').delete().eq('code', row.code); break
      case 'zones':
        res = await supabase.from('zone').delete().eq('territoire_code', row.territory_code).eq('code', row.code).eq('nom', row.name)
        break
      case 'pos': res = await supabase.from('type_pdv').delete().eq('nom', row.level4_type); break
      case 'poids': {
        const id = refId(row.sku); if (!id) break
        res = await supabase.from('poids_reference').delete()
          .eq('reference_produit_id', id).eq('canal', row.trade_type).eq('base_calcul', row.basis); break
      }
      case 'seuils': {
        const id = refId(row.sku); if (!id) break
        res = await supabase.from('seuil_disponibilite').delete().eq('reference_produit_id', id).eq('segment', row.standard_group).eq('grade', row.tier); break
      }
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
