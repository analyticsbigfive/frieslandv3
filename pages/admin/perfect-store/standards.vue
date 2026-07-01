<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Standards Perfect Store</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Disponibilité, assortiment, visibilité et promotion issus du fichier BIG FIVE KPI.
        </p>
        <p class="mt-1 text-xs text-gray-400">
          {{ canEdit ? 'Votre rôle permet de modifier les paramètres.' : 'Consultation seule : rôle admin ou superviseur requis pour modifier.' }}
        </p>
      </div>
      <UButton
        v-if="canEdit"
        icon="i-heroicons-arrow-path"
        :loading="recalculating"
        color="red"
        @click="recalculateAll"
      >
        Recalculer toutes les visites
      </UButton>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 animate-spin text-fc-red" />
    </div>

    <template v-else>
      <div class="admin-surface overflow-hidden">
        <div class="border-b border-gray-100 px-5 py-3 dark:border-gray-700">
          <h2 class="font-bold text-gray-900 dark:text-gray-100">Seuils des niveaux</h2>
          <p class="mt-1 text-xs text-gray-400">La visibilité parfaite est exigée à 100 %. La promotion est contrôlée uniquement lorsqu’elle est applicable.</p>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th class="th-l">Niveau</th>
                <th class="th-c">Disponibilité min.</th>
                <th class="th-c">Visibilité min.</th>
                <th class="th-c">Promotion min.</th>
                <th v-if="canEdit" class="th-c">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-for="niveau in niveaux" :key="niveau.code">
                <td class="px-4 py-3 text-sm font-bold text-gray-900 dark:text-gray-100">{{ niveau.code }}</td>
                <td class="px-4 py-3 text-center text-sm">
                  <UInput v-if="canEdit" v-model.number="niveau.dispo_rayon_min" type="number" min="0" max="100" size="sm" class="mx-auto w-24" />
                  <span v-else>{{ pct(niveau.dispo_rayon_min) }}</span>
                </td>
                <td class="px-4 py-3 text-center text-sm">
                  <UInput v-if="canEdit" v-model.number="niveau.visibilite_min" type="number" min="0" max="100" size="sm" class="mx-auto w-24" />
                  <span v-else>{{ pct(niveau.visibilite_min) }}</span>
                </td>
                <td class="px-4 py-3 text-center text-sm">
                  <UInput v-if="canEdit" v-model.number="niveau.promotion_min" type="number" min="0" max="100" size="sm" class="mx-auto w-24" />
                  <span v-else>{{ pct(niveau.promotion_min) }} <span class="text-xs text-gray-400">(si active)</span></span>
                </td>
                <td v-if="canEdit" class="px-4 py-3 text-center">
                  <UButton size="xs" :loading="savingKey === `niveau:${niveau.code}`" @click="saveNiveau(niveau)">Enregistrer</UButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="admin-surface overflow-hidden">
        <div class="border-b border-gray-100 px-5 py-3 dark:border-gray-700">
          <h2 class="font-bold text-gray-900 dark:text-gray-100">Standards d’assortiment</h2>
          <p class="mt-1 text-xs text-gray-400">Minimum de SKU présents et contrôle obligatoire des Hero SKU, selon le type et le grade du PDV.</p>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th class="th-l">Segment</th>
                <th class="th-c">Grade</th>
                <th class="th-c">SKU cibles</th>
                <th class="th-c">Minimum présents</th>
                <th class="th-c">Hero SKU</th>
                <th v-if="canEdit" class="th-c">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-for="row in assortiments" :key="`${row.segment}-${row.grade}`">
                <td class="px-4 py-3 text-sm font-medium">{{ row.segment }}</td>
                <td class="px-4 py-3 text-center text-sm">{{ row.grade }}</td>
                <td class="px-4 py-3 text-center text-sm">
                  <UInput v-if="canEdit" v-model.number="row.sku_cibles" type="number" min="1" size="sm" class="mx-auto w-20" />
                  <span v-else>{{ row.sku_cibles }}</span>
                </td>
                <td class="px-4 py-3 text-center text-sm font-semibold">
                  <UInput v-if="canEdit" v-model.number="row.min_sku_presents" type="number" min="1" size="sm" class="mx-auto w-20" />
                  <span v-else>{{ row.min_sku_presents }}</span>
                </td>
                <td class="px-4 py-3 text-center">
                  <input v-if="canEdit" v-model="row.heros_obligatoires" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-fc-red" />
                  <UBadge v-else :color="row.heros_obligatoires ? 'green' : 'gray'" variant="soft" size="xs">
                    {{ row.heros_obligatoires ? 'Obligatoires' : 'Non bloquants' }}
                  </UBadge>
                </td>
                <td v-if="canEdit" class="px-4 py-3 text-center">
                  <UButton size="xs" :loading="savingKey === `assort:${row.segment}:${row.grade}`" @click="saveAssortiment(row)">Enregistrer</UButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="admin-surface overflow-hidden">
        <div class="border-b border-gray-100 px-5 py-3 dark:border-gray-700">
          <h2 class="font-bold text-gray-900 dark:text-gray-100">Taux cibles de disponibilité par variante (taux revu)</h2>
          <p class="mt-1 text-xs text-gray-400">
            Poids de chaque variante dans la disponibilité pondérée, par canal (ligne TAUX REVU du fichier BIG FIVE).
            La somme par famille et par canal doit faire 100 %.
          </p>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th class="th-l">Famille</th>
                <th class="th-l">Variante</th>
                <th class="th-c">Cible GT</th>
                <th class="th-c">Cible MT</th>
                <th v-if="canEdit" class="th-c">Action</th>
              </tr>
            </thead>
            <tbody v-for="famille in tauxCiblesParFamille" :key="famille.code" class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-for="(row, idx) in famille.rows" :key="row.reference_produit_id" class="border-t border-gray-100 dark:border-gray-700">
                <td class="px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100">
                  <span v-if="idx === 0">{{ famille.code }} <span class="text-xs font-normal text-gray-400">({{ famille.nom }})</span></span>
                </td>
                <td class="px-4 py-2.5 text-sm">{{ row.variante }}</td>
                <td class="px-4 py-2.5 text-center text-sm tabular-nums">
                  <UInput v-if="canEdit" v-model.number="row.gt" type="number" min="0" max="100" step="0.1" size="sm" class="mx-auto w-24" />
                  <span v-else>{{ pctFine(row.gt) }}</span>
                </td>
                <td class="px-4 py-2.5 text-center text-sm tabular-nums">
                  <UInput v-if="canEdit" v-model.number="row.mt" type="number" min="0" max="100" step="0.1" size="sm" class="mx-auto w-24" />
                  <span v-else>{{ pctFine(row.mt) }}</span>
                </td>
                <td v-if="canEdit" class="px-4 py-2.5 text-center">
                  <UButton size="xs" :loading="savingKey === `taux:${row.reference_produit_id}`" @click="saveTauxCible(row)">Enregistrer</UButton>
                </td>
              </tr>
              <tr class="bg-gray-50/60 dark:bg-gray-700/30">
                <td class="px-4 py-2 text-xs font-medium uppercase text-gray-400" colspan="2">Total {{ famille.code }}</td>
                <td class="px-4 py-2 text-center">
                  <UBadge size="xs" variant="soft" :color="sumOk(famille.sumGT) ? 'green' : 'red'">{{ famille.sumGT.toFixed(1) }} %</UBadge>
                </td>
                <td class="px-4 py-2 text-center">
                  <UBadge size="xs" variant="soft" :color="sumOk(famille.sumMT) ? 'green' : 'red'">{{ famille.sumMT.toFixed(1) }} %</UBadge>
                </td>
                <td v-if="canEdit" />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="admin-toolbar">
        <div class="grid gap-3 sm:grid-cols-3">
          <UFormGroup label="Segment">
            <USelectMenu v-model="segmentFilter" :options="segmentOptions" option-attribute="label" value-attribute="value" />
          </UFormGroup>
          <UFormGroup label="Niveau">
            <USelectMenu v-model="niveauFilter" :options="niveauFilterOptions" option-attribute="label" value-attribute="value" />
          </UFormGroup>
          <UFormGroup label="Pilier">
            <USelectMenu v-model="pillarFilter" :options="pillarOptions" option-attribute="label" value-attribute="value" />
          </UFormGroup>
        </div>
      </div>

      <div class="admin-surface overflow-hidden">
        <div class="border-b border-gray-100 px-5 py-3 dark:border-gray-700">
          <h2 class="font-bold text-gray-900 dark:text-gray-100">Matrice des standards</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th class="th-l">Segment</th>
                <th class="th-l">Niveau</th>
                <th class="th-l">Emplacement</th>
                <th class="th-l">Élément</th>
                <th class="th-c">Requis</th>
                <th class="th-c">Optionnel</th>
                <th v-if="canEdit" class="th-c">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-for="row in filteredStandards" :key="`${row.segment}-${row.niveau_perfect_store}-${row.code}`">
                <td class="px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100">{{ segmentLabel(row.segment) }}</td>
                <td class="px-4 py-2.5"><UBadge size="xs" variant="soft" color="blue">{{ tierLabel(row.niveau_perfect_store) }}</UBadge></td>
                <td class="px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400">{{ placementLabel(row.emplacement) }}</td>
                <td class="px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100">{{ row.nom }}</td>
                <td class="px-4 py-2.5 text-center">
                  <input v-if="canEdit" v-model="row.requis" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-fc-red" />
                  <UBadge v-else-if="row.requis" size="xs" variant="soft" color="green">Oui</UBadge>
                  <span v-else class="text-gray-300">Non</span>
                </td>
                <td class="px-4 py-2.5 text-center">
                  <input v-if="canEdit" v-model="row.optionnel" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-amber-500" />
                  <UBadge v-else-if="row.optionnel" size="xs" variant="soft" color="amber">Oui</UBadge>
                  <span v-else class="text-gray-300">Non</span>
                </td>
                <td v-if="canEdit" class="px-4 py-2.5 text-center">
                  <UButton size="xs" :loading="savingKey === `standard:${row.segment}:${row.niveau_perfect_store}:${row.code}`" @click="saveStandard(row)">Enregistrer</UButton>
                </td>
              </tr>
              <tr v-if="!filteredStandards.length">
                <td :colspan="canEdit ? 8 : 7" class="px-4 py-8 text-center text-sm text-gray-400">Aucun standard correspondant.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="admin-surface overflow-hidden">
        <div class="border-b border-gray-100 px-5 py-3 dark:border-gray-700">
          <h2 class="font-bold text-gray-900 dark:text-gray-100">Affectation des types de PDV</h2>
          <p class="mt-1 text-xs text-gray-400">
            Un type sans segment de visibilité produit le message « Aucun standard paramétré ». Affectez ici sa matrice et, si disponible, son segment/grade de disponibilité.
          </p>
        </div>
        <div class="max-h-[34rem] overflow-auto">
          <table class="w-full">
            <thead class="sticky top-0 bg-gray-50 dark:bg-gray-700">
              <tr>
                <th class="th-l">Type de PDV</th>
                <th class="th-l">Matrice visibilité</th>
                <th class="th-l">Segment disponibilité</th>
                <th class="th-c">Grade</th>
                <th v-if="canEdit" class="th-c">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-for="row in typeMappings" :key="row.type_pdv_id">
                <td class="px-4 py-2.5 text-sm font-medium">{{ row.nom }}</td>
                <td class="px-4 py-2.5">
                  <USelectMenu
                    v-if="canEdit"
                    v-model="row.visibility_segment"
                    :options="visibilityMappingOptions"
                    value-attribute="value"
                    option-attribute="label"
                    size="sm"
                  />
                  <span v-else class="text-sm">{{ segmentLabel(row.visibility_segment) || 'Non paramétré' }}</span>
                </td>
                <td class="px-4 py-2.5">
                  <USelectMenu
                    v-if="canEdit"
                    v-model="row.availability_segment"
                    :options="availabilitySegmentOptions"
                    value-attribute="value"
                    option-attribute="label"
                    size="sm"
                  />
                  <span v-else class="text-sm">{{ row.availability_segment || 'Non paramétré' }}</span>
                </td>
                <td class="px-4 py-2.5">
                  <USelectMenu
                    v-if="canEdit"
                    v-model="row.grade"
                    :options="gradeOptions"
                    value-attribute="value"
                    option-attribute="label"
                    size="sm"
                  />
                  <span v-else class="text-sm">{{ row.grade || '—' }}</span>
                </td>
                <td v-if="canEdit" class="px-4 py-2.5 text-center">
                  <UButton size="xs" :loading="savingKey === `mapping:${row.type_pdv_id}`" @click="saveTypeMapping(row)">Enregistrer</UButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const supabase = useSupabaseClient()
const authStore = useAuthStore()
const toast = useToast()
const loading = ref(true)
const recalculating = ref(false)
const savingKey = ref<string | null>(null)
const niveaux = ref<any[]>([])
const assortiments = ref<any[]>([])
const tauxCibles = ref<any[]>([])
const standards = ref<any[]>([])
const typeMappings = ref<any[]>([])
const segmentFilter = ref('all')
const niveauFilter = ref('all')
const pillarFilter = ref('all')
const canEdit = computed(() => authStore.isAdmin || authStore.isSuperviseur)

const segmentOptions = [
  { value: 'all', label: 'Tous les segments' },
  { value: 'boutique', label: 'Boutique' },
  { value: 'superette', label: 'Superette / MT' },
  { value: 'table_top', label: 'Table Top' },
  { value: 'pushcart', label: 'Pushcart' },
  { value: 'porridge', label: 'Porridge' },
  { value: 'kiosque_aboki', label: 'Kiosque / Aboki' },
]
const niveauFilterOptions = [
  { value: 'all', label: 'Tous les niveaux' },
  { value: 'flagship', label: 'FLAGSHIP' },
  { value: 'vip', label: 'VIP' },
  { value: 'core', label: 'CORE' },
  { value: 'basic', label: 'BASIC' },
]
const pillarOptions = [
  { value: 'all', label: 'Tous les piliers' },
  { value: 'visibilite', label: 'Visibilité' },
  { value: 'promotion', label: 'Promotion' },
]
const visibilityMappingOptions = [
  { value: '', label: 'Non paramétré' },
  ...segmentOptions.filter(option => option.value !== 'all'),
]
const availabilitySegmentOptions = [
  { value: '', label: 'Non paramétré' },
  ...['Boutique', 'Minimarket', 'Kiosque', 'Aboki', 'Pushcart', 'TableTop', 'Porridge']
    .map(value => ({ value, label: value })),
]
const gradeOptions = [
  { value: '', label: '—' },
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'C', label: 'C' },
]

const filteredStandards = computed(() => standards.value.filter(row =>
  (segmentFilter.value === 'all' || row.segment === segmentFilter.value)
  && (niveauFilter.value === 'all' || row.niveau_perfect_store === niveauFilter.value)
  && (pillarFilter.value === 'all' || row.pilier === pillarFilter.value)
  && (canEdit.value || row.requis || row.optionnel),
))

const pct = (value: number | null) => value == null ? '—' : `${Number(value)} %`
const pctFine = (value: number | null) => value == null ? '—' : `${Number(value).toFixed(1).replace(/\.0$/, '')} %`
const sumOk = (sum: number) => Math.abs(sum - 100) < 0.5

const familleOrder = ['EVAP', 'IMP', 'SCM']
const tauxCiblesParFamille = computed(() => familleOrder
  .map((code) => {
    const rows = tauxCibles.value.filter(row => row.famille === code)
    return {
      code,
      nom: rows[0]?.famille_nom || '',
      rows,
      sumGT: rows.reduce((sum, row) => sum + (Number(row.gt) || 0), 0),
      sumMT: rows.reduce((sum, row) => sum + (Number(row.mt) || 0), 0),
    }
  })
  .filter(famille => famille.rows.length))
const segmentLabel = (value: string) => segmentOptions.find(option => option.value === value)?.label || value
const tierLabel = (value: string) => value.toUpperCase()
const placementLabel = (value: string) => ({
  exterieure: 'Extérieure',
  interieure: 'Intérieure',
  promotion: 'Promotion',
}[value] || value)
const one = (value: any) => Array.isArray(value) ? value[0] : value

function validPercent(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 && number <= 100
}

async function saveNiveau(row: any) {
  if (!canEdit.value) return
  if (![row.dispo_rayon_min, row.visibilite_min, row.promotion_min].every(validPercent)) {
    toast.add({ title: 'Valeur invalide', description: 'Les seuils doivent être compris entre 0 et 100.', color: 'red' })
    return
  }
  savingKey.value = `niveau:${row.code}`
  try {
    const { error } = await supabase.from('niveau_perfect_store').update({
      dispo_rayon_min: Number(row.dispo_rayon_min),
      visibilite_min: Number(row.visibilite_min),
      promotion_min: Number(row.promotion_min),
    }).eq('code', row.code)
    if (error) throw error
    toast.add({ title: 'Niveau enregistré', description: 'Lancez le recalcul global pour actualiser les visites.', color: 'green' })
  }
  catch (error: any) {
    toast.add({ title: 'Modification refusée', description: error.message, color: 'red' })
  }
  finally {
    savingKey.value = null
  }
}

async function saveAssortiment(row: any) {
  if (!canEdit.value) return
  const target = Number(row.sku_cibles)
  const minimum = Number(row.min_sku_presents)
  if (!Number.isInteger(target) || !Number.isInteger(minimum) || minimum < 1 || target < minimum) {
    toast.add({ title: 'Valeur invalide', description: 'Le minimum doit être positif et inférieur ou égal au nombre de SKU cibles.', color: 'red' })
    return
  }
  savingKey.value = `assort:${row.segment}:${row.grade}`
  try {
    const { error } = await supabase.from('standard_assortiment').update({
      sku_cibles: target,
      min_sku_presents: minimum,
      heros_obligatoires: !!row.heros_obligatoires,
    }).eq('segment', row.segment).eq('grade', row.grade)
    if (error) throw error
    toast.add({ title: 'Assortiment enregistré', description: 'Lancez le recalcul global pour actualiser les visites.', color: 'green' })
  }
  catch (error: any) {
    toast.add({ title: 'Modification refusée', description: error.message, color: 'red' })
  }
  finally {
    savingKey.value = null
  }
}

async function saveTauxCible(row: any) {
  if (!canEdit.value) return
  if (![row.gt, row.mt].every(validPercent)) {
    toast.add({ title: 'Valeur invalide', description: 'Les cibles doivent être comprises entre 0 et 100.', color: 'red' })
    return
  }
  savingKey.value = `taux:${row.reference_produit_id}`
  try {
    const [gtResult, mtResult] = await Promise.all([
      supabase.from('poids_reference')
        .update({ poids: Number(row.gt) / 100 })
        .eq('reference_produit_id', row.reference_produit_id)
        .eq('canal', 'GT')
        .eq('base_calcul', 'taux_revu'),
      supabase.from('poids_reference')
        .update({ poids: Number(row.mt) / 100 })
        .eq('reference_produit_id', row.reference_produit_id)
        .eq('canal', 'MT')
        .eq('base_calcul', 'taux_revu'),
    ])
    if (gtResult.error) throw gtResult.error
    if (mtResult.error) throw mtResult.error
    toast.add({ title: 'Cibles enregistrées', description: 'Lancez le recalcul global pour actualiser les visites.', color: 'green' })
  }
  catch (error: any) {
    toast.add({ title: 'Modification refusée', description: error.message, color: 'red' })
  }
  finally {
    savingKey.value = null
  }
}

async function saveStandard(row: any) {
  if (!canEdit.value) return
  savingKey.value = `standard:${row.segment}:${row.niveau_perfect_store}:${row.code}`
  try {
    const [standardResult, elementResult] = await Promise.all([
      supabase.from('standard_visibilite')
        .update({ requis: !!row.requis })
        .eq('segment', row.segment)
        .eq('niveau_perfect_store', row.niveau_perfect_store)
        .eq('element_visibilite_id', row.element_id),
      supabase.from('element_visibilite')
        .update({ optionnel: !!row.optionnel })
        .eq('id', row.element_id),
    ])
    if (standardResult.error) throw standardResult.error
    if (elementResult.error) throw elementResult.error
    standards.value.forEach(item => {
      if (item.element_id === row.element_id) item.optionnel = !!row.optionnel
    })
    toast.add({ title: 'Standard enregistré', description: 'Lancez le recalcul global pour actualiser les visites.', color: 'green' })
  }
  catch (error: any) {
    toast.add({ title: 'Modification refusée', description: error.message, color: 'red' })
  }
  finally {
    savingKey.value = null
  }
}

async function saveTypeMapping(row: any) {
  if (!canEdit.value) return
  if ((row.availability_segment && !row.grade) || (!row.availability_segment && row.grade)) {
    toast.add({ title: 'Mapping incomplet', description: 'Choisissez ensemble le segment de disponibilité et le grade.', color: 'red' })
    return
  }
  savingKey.value = `mapping:${row.type_pdv_id}`
  try {
    const visibilityResult = row.visibility_segment
      ? await supabase.from('segment_visibilite_type_pdv').upsert({
          type_pdv_id: row.type_pdv_id,
          segment: row.visibility_segment,
        }, { onConflict: 'type_pdv_id' })
      : await supabase.from('segment_visibilite_type_pdv').delete().eq('type_pdv_id', row.type_pdv_id)
    if (visibilityResult.error) throw visibilityResult.error

    const availabilityResult = row.availability_segment && row.grade
      ? await supabase.from('segment_grade_type_pdv').upsert({
          type_pdv_id: row.type_pdv_id,
          segment: row.availability_segment,
          grade: row.grade,
        }, { onConflict: 'type_pdv_id' })
      : await supabase.from('segment_grade_type_pdv').delete().eq('type_pdv_id', row.type_pdv_id)
    if (availabilityResult.error) throw availabilityResult.error

    toast.add({ title: 'Type de PDV paramétré', description: 'Le formulaire terrain utilisera cette matrice lors de son prochain chargement.', color: 'green' })
  }
  catch (error: any) {
    toast.add({ title: 'Modification refusée', description: error.message, color: 'red' })
  }
  finally {
    savingKey.value = null
  }
}

async function recalculateAll() {
  if (!canEdit.value) return
  recalculating.value = true
  try {
    const { data, error } = await supabase.rpc('recalculer_tous_perfect_store', { p_base_calcul: 'taux_vente' })
    if (error) throw error
    toast.add({ title: 'Recalcul terminé', description: `${Number(data || 0)} visite(s) recalculée(s).`, color: 'green' })
  }
  catch (error: any) {
    toast.add({ title: 'Recalcul impossible', description: error.message, color: 'red' })
  }
  finally {
    recalculating.value = false
  }
}

async function loadData() {
  loading.value = true
  try {
    const [
      niveauResult,
      assortimentResult,
      standardResult,
      typeResult,
      visibilityMappingResult,
      availabilityMappingResult,
      tauxRevuResult,
    ] = await Promise.all([
      supabase.from('niveau_perfect_store')
        .select('code, rang, dispo_rayon_min, visibilite_min, promotion_min')
        .order('rang', { ascending: false }),
      supabase.from('standard_assortiment')
        .select('segment, grade, sku_cibles, min_sku_presents, heros_obligatoires')
        .order('segment')
        .order('grade'),
      supabase.from('standard_visibilite')
        .select('segment, niveau_perfect_store, element_visibilite_id, requis, element_visibilite(id, code, nom, pilier, emplacement, optionnel)')
        .order('segment')
        .order('niveau_perfect_store'),
      supabase.from('type_pdv').select('id, nom').order('nom'),
      supabase.from('segment_visibilite_type_pdv').select('type_pdv_id, segment'),
      supabase.from('segment_grade_type_pdv').select('type_pdv_id, segment, grade'),
      supabase.from('poids_reference')
        .select('reference_produit_id, canal, poids, reference_produit(id, nom, categorie_produit(code, nom))')
        .eq('base_calcul', 'taux_revu'),
    ])
    if (niveauResult.error) throw niveauResult.error
    if (assortimentResult.error) throw assortimentResult.error
    if (standardResult.error) throw standardResult.error
    if (typeResult.error) throw typeResult.error
    if (visibilityMappingResult.error) throw visibilityMappingResult.error
    if (availabilityMappingResult.error) throw availabilityMappingResult.error
    if (tauxRevuResult.error) throw tauxRevuResult.error
    niveaux.value = niveauResult.data || []
    assortiments.value = assortimentResult.data || []
    standards.value = (standardResult.data || []).map((row: any) => ({
      ...row,
      ...one(row.element_visibilite),
      element_id: row.element_visibilite_id || one(row.element_visibilite)?.id,
    }))
    const tauxByRef = new Map<number, any>()
    for (const row of (tauxRevuResult.data || []) as any[]) {
      const ref = one(row.reference_produit)
      if (!ref) continue
      const cat = one(ref.categorie_produit)
      const entry = tauxByRef.get(row.reference_produit_id) || {
        reference_produit_id: row.reference_produit_id,
        variante: ref.nom,
        famille: cat?.code || '',
        famille_nom: cat?.nom || '',
        gt: null,
        mt: null,
      }
      entry[row.canal === 'MT' ? 'mt' : 'gt'] = Math.round(Number(row.poids) * 1000) / 10
      tauxByRef.set(row.reference_produit_id, entry)
    }
    tauxCibles.value = [...tauxByRef.values()].sort((a, b) =>
      familleOrder.indexOf(a.famille) - familleOrder.indexOf(b.famille)
      || (Number(b.gt) || 0) - (Number(a.gt) || 0))
    const visibilityByType = new Map((visibilityMappingResult.data || []).map((row: any) => [row.type_pdv_id, row.segment]))
    const availabilityByType = new Map((availabilityMappingResult.data || []).map((row: any) => [row.type_pdv_id, row]))
    typeMappings.value = (typeResult.data || []).map((row: any) => ({
      type_pdv_id: row.id,
      nom: row.nom,
      visibility_segment: visibilityByType.get(row.id) || '',
      availability_segment: availabilityByType.get(row.id)?.segment || '',
      grade: availabilityByType.get(row.id)?.grade || '',
    }))
  }
  catch (error: any) {
    toast.add({ title: 'Chargement impossible', description: error.message, color: 'red' })
  }
  finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.th-l { @apply px-4 py-2.5 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400; }
.th-c { @apply px-4 py-2.5 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400; }
</style>
