<template>
  <UModal v-model="isOpen" :ui="{ width: 'w-full sm:max-w-5xl' }">
    <div v-if="visite" class="max-h-[88vh] overflow-y-auto p-5 sm:p-6">
      <header class="mb-6 flex items-start justify-between gap-4">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.14em] text-fc-red">Visite terrain</p>
          <h3 class="mt-1 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Détail de la visite</h3>
        </div>
        <UButton aria-label="Fermer" variant="ghost" size="xs" icon="i-heroicons-x-mark" @click="isOpen = false" />
      </header>

      <section class="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div v-for="info in generalInfo" :key="info.label" class="rounded-xl bg-slate-50 p-3 dark:bg-slate-700/40">
          <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{{ info.label }}</p>
          <p class="mt-1 text-sm font-semibold text-slate-900 dark:text-white" :class="info.className">{{ info.value }}</p>
        </div>
      </section>

      <section class="mb-7 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
        <div class="flex flex-col gap-3 bg-slate-950 px-4 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-xs font-medium text-slate-400">Résultat Perfect Store</p>
            <p class="mt-1 text-lg font-semibold">{{ perfectStore?.tierAtteint || 'Non conforme' }}</p>
          </div>
          <p class="text-3xl font-semibold tabular-nums">{{ ratio(perfectStore?.scoreGlobal) }}</p>
        </div>
        <div v-if="perfectStore" class="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-5 sm:divide-y-0 dark:divide-slate-700">
          <div v-for="metric in perfectStoreMetrics" :key="metric.label" class="px-4 py-3">
            <p class="text-xs text-slate-400">{{ metric.label }}</p>
            <p class="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{{ metric.value }}</p>
          </div>
        </div>
        <p v-else class="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
          Le résultat sera disponible lorsque les standards Perfect Store seront chargés.
        </p>
      </section>

      <section v-if="productDetail.length" class="mb-7">
        <h4 class="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <span class="h-2 w-2 rounded-full bg-fc-red" />
          Produits (disponibilité rayon)
        </h4>
        <div v-for="cat in productDetail" :key="cat.key" class="mb-3 overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700">
          <table class="admin-table">
            <thead>
              <tr>
                <th>{{ cat.label }}</th>
                <th class="text-center">Quantité relevée</th>
                <th class="text-center">Seuil requis</th>
                <th class="text-center">Disponible</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in cat.items" :key="item.nom">
                <td class="font-medium text-slate-900 dark:text-white">{{ item.nom }}</td>
                <td class="text-center tabular-nums">{{ item.qte }}</td>
                <td class="text-center tabular-nums">{{ item.seuil ?? '—' }}</td>
                <td class="text-center">
                  <UIcon
                    v-if="item.evaluable"
                    :name="item.ok ? 'i-heroicons-check-circle-solid' : 'i-heroicons-minus-circle-solid'"
                    class="h-5 w-5"
                    :class="item.ok ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'"
                  />
                  <span v-else class="text-xs text-slate-400">Non évaluable</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="visibilityDetail.length" class="mb-7">
        <h4 class="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <span class="h-2 w-2 rounded-full bg-amber-500" />
          Visibilité &amp; promotion
        </h4>
        <div class="grid gap-3 sm:grid-cols-2">
          <div v-for="group in visibilityDetail" :key="group.label" class="rounded-xl bg-slate-50 p-4 dark:bg-slate-700/40">
            <p class="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-400">
              <span>{{ group.label }}</span>
              <span v-if="group.key === 'promotion'">{{ promotionApplicable ? 'Applicable' : 'Non applicable' }}</span>
            </p>
            <div class="space-y-1.5 text-xs">
              <div v-for="item in group.items" :key="item.code" class="flex justify-between gap-3">
                <span class="text-slate-600 dark:text-slate-300">{{ item.nom }}<span v-if="item.optionnel" class="text-slate-400"> (optionnel)</span></span>
                <span :class="item.observed ? 'font-medium text-emerald-600' : 'text-slate-400'">
                  {{ item.observed ? 'Présent' : 'Absent' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section v-if="visite.data?.concurrence" class="mb-7">
        <h4 class="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <span class="h-2 w-2 rounded-full bg-slate-400" />
          Concurrence
        </h4>
        <div class="rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-700/40">
          Concurrents présents :
          <strong :class="visite.data.concurrence.presence_concurrents ? 'text-fc-red' : 'text-emerald-600'">
            {{ visite.data.concurrence.presence_concurrents ? 'Oui' : 'Non' }}
          </strong>
          <div v-if="visite.data.concurrence.presence_concurrents" class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div v-for="category in competitorCategories" :key="category.key" class="text-xs">
              <span class="font-medium text-slate-600 dark:text-slate-300">{{ category.label }}</span>
              <span :class="competitorPresent(category.key) ? 'ml-1 font-semibold text-fc-red' : 'ml-1 text-slate-400'">
                {{ competitorPresent(category.key) ? 'Présent' : 'Absent' }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section v-if="visite.data?.actions" class="mb-7">
        <h4 class="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <span class="h-2 w-2 rounded-full bg-slate-400" />
          Actions réalisées
        </h4>
        <div class="flex flex-wrap gap-2">
          <UBadge
            v-for="action in actionItems"
            :key="action.key"
            :color="actionValue(action.key) ? 'green' : 'gray'"
            variant="soft"
            size="sm"
          >
            {{ actionValue(action.key) ? '✓' : '—' }} {{ action.label }}
          </UBadge>
        </div>
      </section>

      <section v-if="visite.image_urls?.length" class="mb-7">
        <h4 class="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Photos ({{ visite.image_urls.length }})</h4>
        <div class="flex gap-2 overflow-x-auto pb-1">
          <img
            v-for="(url, index) in visite.image_urls"
            :key="url"
            :src="url"
            :alt="`Photo de visite ${index + 1}`"
            class="h-24 w-24 shrink-0 rounded-xl border border-slate-200 object-cover dark:border-slate-600"
          />
        </div>
      </section>

      <footer class="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-700">
        <UButton variant="ghost" @click="isOpen = false">Fermer</UButton>
        <UButton v-if="canDelete" color="red" variant="soft" @click="$emit('delete', visite)">Supprimer</UButton>
      </footer>
    </div>
  </UModal>
</template>

<script setup lang="ts">
import type { Visite } from '~/types'
import { tradeTypeForCanal, type PerfectStoreResultB } from '~/utils/perfectStore'
import { visibilityElementObserved, visibilitySegmentForPdv, FALLBACK_VISIBILITY_ELEMENTS } from '~/utils/visibilityStandards'

const props = withDefaults(defineProps<{
  modelValue: boolean
  visite: Visite | null
  perfectStore?: PerfectStoreResultB | null
  canDelete?: boolean
}>(), {
  perfectStore: null,
  canDelete: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  delete: [visite: Visite]
}>()

const isOpen = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const { refs } = usePerfectStore()

const productLabels: Record<string, string> = { evap: 'Lait évaporé (EVAP)', imp: 'Lait en poudre (IMP)', scm: 'Lait concentré sucré (SCM)' }

const dispoSegmentGrade = computed(() => {
  const sousCategorie = props.visite?.pdv?.sous_categorie_pdv || ''
  return refs.value?.segmentGrade.find(s => s.type_pdv_nom === sousCategorie) || null
})

const productDetail = computed(() => {
  if (!refs.value) return []
  const canal = dispoSegmentGrade.value?.canal ?? tradeTypeForCanal(props.visite?.pdv?.canal)
  const segment = dispoSegmentGrade.value?.segment
  const grade = dispoSegmentGrade.value?.grade
  const produits: any = props.visite?.data?.produits || {}
  return (['evap', 'imp', 'scm'] as const).map(cat => ({
    key: cat,
    label: productLabels[cat],
    items: refs.value!.correspondance
      .filter(c => c.categorie_jsonb === cat)
      .map((c) => {
        const poidsRow = refs.value!.poids.find(p => p.reference_nom === c.reference_nom && p.canal === canal && p.base_calcul === 'taux_vente')
        const seuilRow = segment && grade ? refs.value!.seuils.find(s => s.reference_nom === c.reference_nom && s.segment === segment && s.grade === grade) : undefined
        const qte = Number(produits?.[cat]?.quantites?.[c.sku_key]) || 0
        const evaluable = !!(poidsRow && seuilRow)
        return { nom: c.reference_nom, qte, seuil: seuilRow?.quantite_min ?? null, evaluable, ok: evaluable && qte >= seuilRow!.quantite_min }
      }),
  })).filter(cat => cat.items.length)
})

const promotionApplicable = computed(() => (props.visite?.data as any)?.visibilite?.promotion_applicable === true)

const visibilitySegment = computed(() => {
  const sousCategorie = props.visite?.pdv?.sous_categorie_pdv || ''
  return refs.value?.visibilitySegmentMap.find(m => m.type_pdv_nom === sousCategorie)?.segment
    ?? visibilitySegmentForPdv(sousCategorie)
})

const visibilityDetail = computed(() => {
  const segment = visibilitySegment.value
  if (!segment) return []
  const elements = (refs.value?.visibilityElements.length ? refs.value.visibilityElements : FALLBACK_VISIBILITY_ELEMENTS)
    .filter(e => e.segment === segment)
  const groups = [
    { key: 'visibilite', label: 'Visibilité', pilier: 'visibilite' as const },
    { key: 'promotion', label: 'Promotion', pilier: 'promotion' as const },
  ]
  return groups
    .map(group => ({
      key: group.key,
      label: group.label,
      items: elements
        .filter(e => e.pilier === group.pilier)
        .map(e => ({ code: e.code, nom: e.nom, optionnel: e.optionnel, observed: visibilityElementObserved(props.visite?.data, e.code) })),
    }))
    .filter(group => group.items.length)
})

const actionItems = [
  { key: 'referencement_produits', label: 'Référencement produits' },
  { key: 'execution_activites_promotionnelles', label: 'Activités promotionnelles' },
  { key: 'prospection_pdv', label: 'Prospection PDV' },
  { key: 'verification_fifo', label: 'Vérification FIFO' },
  { key: 'rangement_produits', label: 'Rangement produits' },
  { key: 'pose_affiches', label: 'Pose affiches' },
  { key: 'pose_materiel_visibilite', label: 'Pose matériel visibilité' },
]

const competitorCategories = [
  { key: 'evap', label: 'EVAP' },
  { key: 'imp', label: 'IMP' },
  { key: 'scm', label: 'SCM' },
  { key: 'uht', label: 'UHT' },
]

const generalInfo = computed(() => [
  { label: 'Commercial', value: props.visite?.commercial || '—' },
  { label: 'Date', value: formatDate(props.visite?.date_visite) },
  { label: 'Point de vente', value: props.visite?.pdv?.nom_pdv || props.visite?.pdv_id?.substring(0, 8) || '—' },
  { label: 'Canal', value: props.visite?.pdv?.canal || '—' },
  { label: 'Type PDV', value: props.visite?.pdv?.sous_categorie_pdv || '—' },
  { label: 'Région', value: props.visite?.pdv?.region || '—' },
  { label: 'Zone', value: props.visite?.pdv?.zone || '—' },
  { label: 'Quartier', value: props.visite?.pdv?.quartier || '—' },
  {
    label: 'GPS validé',
    value: props.visite?.geofence_validated ? 'Oui' : 'Non',
    className: props.visite?.geofence_validated ? 'text-emerald-600' : 'text-fc-red',
  },
])

const perfectStoreMetrics = computed(() => [
  { label: 'Disponibilité', value: ratio(props.perfectStore?.osaPondere) },
  { label: 'Assortiment', value: ratio(props.perfectStore?.assortimentTaux) },
  {
    label: 'Hero SKU',
    value: props.perfectStore?.herosPresents == null
      ? 'Non évalué'
      : props.perfectStore.herosPresents ? 'Présents' : 'Manquants',
  },
  { label: 'Visibilité', value: ratio(props.perfectStore?.visibiliteTaux) },
  { label: 'Promotion', value: ratio(props.perfectStore?.promotionTaux) },
])

function ratio(value: number | null | undefined): string {
  return value == null ? 'Non évalué' : `${Math.round(value * 100)}%`
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function competitorPresent(key: string): boolean {
  return !!(props.visite?.data?.concurrence as any)?.[key]?.present
}

function actionValue(key: string): boolean {
  return !!(props.visite?.data?.actions as any)?.[key]
}
</script>
