<template>
  <UModal v-model="isOpen" :ui="{ width: 'w-full sm:max-w-5xl' }" :aria-label="visite ? `Visite chez ${nomPdv}` : 'Détail de la visite'">
    <div v-if="visite" class="max-h-[88vh] overflow-y-auto p-5 sm:p-6">
      <header class="mb-6 flex items-start justify-between gap-4">
        <div class="min-w-0">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">{{ nomPdv }}</h2>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Visite du {{ dateVisite }}</p>
        </div>
        <UButton aria-label="Fermer le détail de la visite" color="gray" variant="ghost" size="xs" icon="i-heroicons-x-mark" @click="isOpen = false" />
      </header>

      <dl class="mb-6 grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-4">
        <div v-for="info in generalInfo" :key="info.label" class="min-w-0">
          <dt class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ info.label }}</dt>
          <dd
            class="mt-1 flex items-start gap-1.5 break-words text-sm font-semibold"
            :class="info.statut === 'ok'
              ? 'text-emerald-700 dark:text-emerald-400'
              : info.statut === 'alerte'
                ? 'text-amber-700 dark:text-amber-400'
                : 'text-slate-900 dark:text-white'"
          >
            <UIcon
              v-if="info.statut"
              :name="info.statut === 'ok' ? 'i-heroicons-check-circle-solid' : 'i-heroicons-exclamation-triangle'"
              class="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <span>{{ info.value }}</span>
          </dd>
        </div>
      </dl>

      <section class="admin-surface mb-6">
        <div class="flex flex-wrap items-start justify-between gap-3 px-4 py-4 sm:px-5">
          <div>
            <h3 class="text-base font-semibold text-slate-900 dark:text-white">Résultat Perfect Store</h3>
            <p v-if="perfectStore" class="mt-1 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: niveau.couleur }" aria-hidden="true" />
              <span>Niveau atteint : <span class="font-semibold text-slate-900 dark:text-white">{{ niveau.libelle }}</span></span>
            </p>
            <p v-else class="mt-1 max-w-xl text-sm text-slate-600 dark:text-slate-300">
              Le score n'est pas disponible ici. Ouvrez la visite depuis Visites › Toutes les visites pour le voir ; s'il manque encore, rechargez la page.
            </p>
          </div>
          <p v-if="perfectStore" class="text-right">
            <span class="block text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{{ ratio(perfectStore.scoreGlobal) }}</span>
            <span class="text-xs text-slate-600 dark:text-slate-300">Score global</span>
          </p>
        </div>
        <dl
          v-if="perfectStore"
          class="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-200 px-4 py-4 sm:grid-cols-3 sm:px-5 lg:grid-cols-5 dark:border-slate-700"
        >
          <div v-for="metric in perfectStoreMetrics" :key="metric.label">
            <dt class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ metric.label }}</dt>
            <dd class="mt-1 text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{{ metric.value }}</dd>
          </div>
        </dl>
      </section>

      <section v-if="productDetail.length" class="mb-6">
        <h3 class="text-base font-semibold text-slate-900 dark:text-white">Disponibilité en rayon par référence</h3>
        <p class="mb-3 mt-1 text-sm text-slate-600 dark:text-slate-300">
          Quantité relevée pendant la visite, comparée au seuil demandé pour ce type de point de vente.
        </p>
        <div class="space-y-3">
          <div v-for="cat in productDetail" :key="cat.key" class="admin-surface overflow-x-auto">
            <table class="admin-table">
              <thead>
                <tr>
                  <th scope="col">{{ cat.label }}</th>
                  <th scope="col" class="whitespace-nowrap text-right">Quantité relevée</th>
                  <th scope="col" class="whitespace-nowrap text-right">Seuil requis</th>
                  <th scope="col">Disponible</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in cat.items" :key="item.nom">
                  <td class="font-medium text-slate-900 dark:text-white">{{ item.nom }}</td>
                  <td class="text-right tabular-nums">{{ item.qte }}</td>
                  <td class="text-right tabular-nums">{{ item.seuil ?? '—' }}</td>
                  <td class="whitespace-nowrap">
                    <span
                      v-if="item.evaluable"
                      class="inline-flex items-center gap-1.5"
                      :class="item.ok ? 'font-medium text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'"
                    >
                      <UIcon
                        :name="item.ok ? 'i-heroicons-check-circle-solid' : 'i-heroicons-x-circle'"
                        class="h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                      {{ item.ok ? 'Oui' : 'Sous le seuil' }}
                    </span>
                    <span v-else class="text-slate-600 dark:text-slate-300" title="Aucun seuil défini pour cette référence et ce type de point de vente">
                      Non évaluable
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section v-if="visibilityDetail.length" class="mb-6">
        <h3 class="mb-3 text-base font-semibold text-slate-900 dark:text-white">Visibilité et promotion</h3>
        <div class="grid gap-3 sm:grid-cols-2">
          <div v-for="group in visibilityDetail" :key="group.key" class="admin-surface p-4">
            <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h4 class="text-sm font-semibold text-slate-900 dark:text-white">{{ group.label }}</h4>
              <span
                v-if="group.key === 'promotion'"
                class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200"
              >
                {{ promotionApplicable ? 'Applicable' : 'Non applicable' }}
              </span>
            </div>
            <ul class="space-y-2 text-sm">
              <li v-for="item in group.items" :key="item.code" class="flex items-start justify-between gap-3">
                <span class="text-slate-700 dark:text-slate-200">
                  {{ item.nom }}<span v-if="item.optionnel" class="text-slate-500 dark:text-slate-400"> (optionnel)</span>
                </span>
                <span
                  class="inline-flex shrink-0 items-center gap-1"
                  :class="item.observed ? 'font-medium text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'"
                >
                  <UIcon
                    :name="item.observed ? 'i-heroicons-check-circle-solid' : 'i-heroicons-minus-circle'"
                    class="h-4 w-4"
                    aria-hidden="true"
                  />
                  {{ item.observed ? 'Présent' : 'Absent' }}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section v-if="visite.data?.concurrence" class="mb-6">
        <h3 class="mb-3 text-base font-semibold text-slate-900 dark:text-white">Concurrence</h3>
        <div class="admin-surface p-4 text-sm">
          <p class="text-slate-700 dark:text-slate-200">
            Concurrents présents dans le point de vente :
            <span class="font-semibold text-slate-900 dark:text-white">{{ visite.data.concurrence.presence_concurrents ? 'Oui' : 'Non' }}</span>
          </p>
          <ul v-if="visite.data.concurrence.presence_concurrents" class="mt-3 grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            <li v-for="category in competitorCategories" :key="category.key">
              <p class="font-medium text-slate-900 dark:text-white">{{ category.label }}</p>
              <p :class="competitorPresent(category.key) ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'">
                {{ competitorPresent(category.key) ? 'Concurrent présent' : 'Pas de concurrent' }}
              </p>
              <p v-if="competitorActive(category.key)" class="font-medium text-amber-700 dark:text-amber-400">En activité</p>
              <p v-if="competitorAction(category.key)" class="text-slate-600 dark:text-slate-300">
                {{ competitorAction(category.key) }}
              </p>
              <p v-if="competitorSkus(category.key).length" class="text-slate-700 dark:text-slate-200">
                {{ competitorSkus(category.key).join(' · ') }}
              </p>
            </li>
          </ul>

          <!-- Visibilité concurrence (marques du référentiel), formats ancien et nouveau -->
          <div v-if="visibiliteConcurrence.length" class="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
            <h4 class="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Visibilité des marques concurrentes</h4>
            <div class="overflow-x-auto">
              <table class="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Marque</th>
                    <th scope="col">À l'extérieur</th>
                    <th scope="col">À l'intérieur</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="m in visibiliteConcurrence" :key="m.cle">
                    <td class="font-medium text-slate-900 dark:text-white">{{ m.nom }}</td>
                    <td v-for="cote in [{ cle: 'ext', present: m.ext }, { cle: 'int', present: m.int }]" :key="cote.cle" class="whitespace-nowrap">
                      <span
                        class="inline-flex items-center gap-1"
                        :class="cote.present ? 'font-medium text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'"
                      >
                        <UIcon :name="cote.present ? 'i-heroicons-eye' : 'i-heroicons-minus-circle'" class="h-4 w-4 shrink-0" aria-hidden="true" />
                        {{ cote.present ? 'Présente' : 'Absente' }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Concurrents signalés en texte libre, ancien et nouveau format -->
          <div v-if="freeCompetitors.length" class="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
            <h4 class="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Autres concurrents signalés</h4>
            <ul class="grid gap-3 sm:grid-cols-2">
              <li v-for="(c, index) in freeCompetitors" :key="`${c.nom}-${index}`" class="flex items-start gap-3">
                <img v-if="c.photo_url" :src="c.photo_url" :alt="`Photo : ${c.nom}`" class="h-12 w-12 shrink-0 rounded-md border border-slate-200 object-cover dark:border-slate-600" />
                <div>
                  <p class="font-semibold text-slate-900 dark:text-white">{{ c.nom }}</p>
                  <p v-if="c.en_activite" class="font-medium text-amber-700 dark:text-amber-400">En activité</p>
                  <p v-if="c.action_concurrence" class="text-slate-600 dark:text-slate-300">{{ c.action_concurrence }}</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section v-if="visite.data?.actions" class="mb-6">
        <h3 class="mb-3 text-base font-semibold text-slate-900 dark:text-white">Actions réalisées</h3>
        <ul v-if="actionsRealisees.length" class="flex flex-wrap gap-2">
          <li
            v-for="action in actionsRealisees"
            :key="action.key"
            class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-sm font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            <UIcon name="i-heroicons-check" class="h-4 w-4 shrink-0" aria-hidden="true" />
            {{ action.label }}
          </li>
        </ul>
        <p v-else class="text-sm text-slate-600 dark:text-slate-300">Aucune action cochée pendant cette visite.</p>
        <p v-if="actionsRealisees.length && actionsNonRealisees.length" class="mt-3 text-sm text-slate-600 dark:text-slate-300">
          Non réalisées : {{ actionsNonRealisees.map(a => a.label).join(', ') }}.
        </p>
      </section>

      <section v-if="visite.data?.commentaires" class="mb-6">
        <h3 class="mb-2 text-base font-semibold text-slate-900 dark:text-white">Commentaire du merchandiser</h3>
        <p class="whitespace-pre-line rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:bg-slate-700/40 dark:text-slate-200">{{ visite.data.commentaires }}</p>
      </section>

      <section v-if="displayableImages.length" class="mb-6">
        <h3 class="text-base font-semibold text-slate-900 dark:text-white">Photos de la visite ({{ displayableImages.length }})</h3>
        <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Cliquez sur une photo pour l'ouvrir en grand dans un nouvel onglet.</p>
        <ul class="mt-2 flex gap-2 overflow-x-auto p-1">
          <li v-for="(url, index) in displayableImages" :key="url" class="shrink-0">
            <a
              :href="url"
              target="_blank"
              rel="noopener noreferrer"
              class="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:focus-visible:ring-brand-400"
              :aria-label="`Ouvrir la photo ${index + 1} sur ${displayableImages.length} dans un nouvel onglet`"
            >
              <img
                :src="url"
                alt=""
                class="h-24 w-24 rounded-lg border border-slate-200 object-cover dark:border-slate-600"
              />
            </a>
          </li>
        </ul>
      </section>

      <footer class="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
        <UButton
          v-if="canDelete"
          color="red"
          variant="ghost"
          icon="i-heroicons-trash"
          class="text-red-700 hover:text-red-800 dark:text-red-300 dark:hover:text-red-200"
          @click="$emit('delete', visite)"
        >
          Supprimer la visite
        </UButton>
        <UButton variant="outline" class="ml-auto" @click="isOpen = false">Fermer</UButton>
      </footer>
    </div>
  </UModal>
</template>

<script setup lang="ts">
import type { Visite } from '~/types'
import { tradeTypeForCanal, type PerfectStoreResultB } from '~/utils/perfectStore'
import { visibilityElementObserved, visibilitySegmentForPdv, FALLBACK_VISIBILITY_ELEMENTS } from '~/utils/visibilityStandards'
import { photosAffichables } from '~/utils/visitePhotos'
import { catalogueProduits, categoriesProduitsActives, getCategoryDef } from '~/utils/products'
import { visibiliteConcurrencePresente } from '~/utils/concurrence'
import { isModernTrade } from '~/utils/canal'
import { formatDateFr } from '~/utils/dates'
import { niveauPerfectStore, COULEUR_NON_CONFORME } from '~/utils/chartPalette'

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

const displayableImages = computed(() => photosAffichables(props.visite?.image_urls))

const isOpen = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const { refs } = usePerfectStore()
const { typePdvLabel, fetchTypePdvLabels } = useTypePdvLabels()
const { skus: skusConcurrents, marquesVisibilite, charger: chargerMarques } = useMarquesConcurrentes()
onMounted(() => { void fetchTypePdvLabels(); void chargerMarques() })

// Familles en clair, sigle entre parenthèses ; une famille ajoutée dans l'admin
// garde son libellé du catalogue, remis en casse normale (« YAOURT » → « Yaourt »).
const productLabels: Record<string, string> = {
  evap: 'Lait évaporé (EVAP)',
  imp: 'Lait en poudre (IMP)',
  scm: 'Lait concentré sucré (SCM)',
  uht: 'Lait UHT',
}
function libelleFamille(cle: string): string {
  if (productLabels[cle]) return productLabels[cle]
  const brut = getCategoryDef(cle)?.label || cle
  return brut.charAt(0).toUpperCase() + brut.slice(1).toLowerCase()
}
// Catégories notées au Perfect Store (correspondance_reference), dans l'ordre
// du catalogue ; une catégorie ajoutée dans l'admin et notée apparaît aussi.
const categoriesNotees = computed(() => {
  const notees = new Set((refs.value?.correspondance || []).map(c => c.categorie_jsonb))
  const ordre = catalogueProduits().map(c => c.key)
  return [...notees].sort((a, b) => (ordre.indexOf(a) + 1 || 99) - (ordre.indexOf(b) + 1 || 99))
})

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
  return categoriesNotees.value.map(cat => ({
    key: cat,
    label: libelleFamille(cat),
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

// Mêmes libellés que l'écran Actions › Synthèse (pages/admin/actions/index.vue).
const actionItems = [
  { key: 'referencement_produits', label: 'Référencement de produits' },
  { key: 'execution_activites_promotionnelles', label: 'Activités promotionnelles' },
  { key: 'prospection_pdv', label: 'Prospection de points de vente' },
  { key: 'verification_fifo', label: 'Rotation des stocks (premier entré, premier sorti)' },
  { key: 'rangement_produits', label: 'Rangement des produits' },
  { key: 'pose_affiches', label: 'Pose d’affiches' },
  { key: 'pose_materiel_visibilite', label: 'Pose de matériel de visibilité' },
]
const actionsRealisees = computed(() => actionItems.filter(a => actionValue(a.key)))
const actionsNonRealisees = computed(() => actionItems.filter(a => !actionValue(a.key)))

const competitorCategories = ['evap', 'imp', 'scm', 'uht'].map(key => ({ key, label: libelleFamille(key) }))

// SSF de la visite (Atom) : nom depuis la liste des SSF, sinon tel que saisi.
const { listeSsf, chargerListe: chargerListeSsf } = useSsfTerrain()
const ssfVisite = computed(() => {
  const v = props.visite
  if (!v?.ssf_id && !v?.ssf_brut) return ''
  return listeSsf.value.find(s => s.id === v.ssf_id)?.nom || v.ssf_brut || 'Vendeur sans nom'
})
watch(() => props.visite?.ssf_id, (id) => { if (id && !listeSsf.value.length) void chargerListeSsf() }, { immediate: true })

const nomPdv = computed(() => props.visite?.pdv?.nom_pdv || 'Point de vente sans nom')
const dateVisite = computed(() => formatDateFr(props.visite?.date_visite, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}))

// Affichage seulement : la valeur de base reste General trade / Modern trade.
function libelleCanal(value: string | null | undefined): string {
  if (!value) return '—'
  return isModernTrade(value) ? 'Supermarchés (MT)' : 'Boutiques (GT)'
}

type InfoVisite = { label: string; value: string; statut?: 'ok' | 'alerte' }
const generalInfo = computed<InfoVisite[]>(() => [
  { label: 'Merchandiser', value: props.visite?.commercial || '—' },
  { label: 'Canal', value: libelleCanal(props.visite?.pdv?.canal) },
  { label: 'Type de point de vente', value: typePdvLabel(props.visite?.pdv?.sous_categorie_pdv) || '—' },
  { label: 'Région', value: props.visite?.pdv?.region || '—' },
  { label: 'Zone', value: props.visite?.pdv?.zone || '—' },
  { label: 'Quartier', value: props.visite?.pdv?.quartier || '—' },
  ...(ssfVisite.value ? [{ label: 'Vendeur du distributeur (SSF)', value: ssfVisite.value }] : []),
  {
    label: 'Dans le rayon de visite',
    // 1.0.12 : précision insuffisante à l'enregistrement (non bloquant).
    value: props.visite?.geofence_validated
      ? 'Oui'
      : props.visite?.data?.gps?.motif === 'precision'
        ? `Non, position GPS imprécise (${props.visite.data.gps.precision_m ?? '?'} m)`
        : 'Non',
    statut: props.visite?.geofence_validated ? 'ok' : 'alerte',
  },
])

// Niveau Perfect Store en clair (« VIP PERFECT STORE » → « VIP Perfect Store »).
const niveau = computed(() => {
  const code = props.perfectStore?.tierAtteint
  const connu = niveauPerfectStore(code)
  if (connu) return { libelle: connu.long, couleur: connu.couleur }
  if (!code || /^non/i.test(code.trim())) return { libelle: 'Non conforme', couleur: COULEUR_NON_CONFORME }
  const court = code.trim()
  return { libelle: court.charAt(0).toUpperCase() + court.slice(1).toLowerCase(), couleur: COULEUR_NON_CONFORME }
})

const perfectStoreMetrics = computed(() => [
  { label: 'Disponibilité en rayon', value: ratio(props.perfectStore?.osaPondere) },
  { label: 'Assortiment', value: ratio(props.perfectStore?.assortimentTaux) },
  {
    label: 'Références prioritaires (hero SKU)',
    value: props.perfectStore?.herosPresents == null
      ? 'Non évaluées'
      : props.perfectStore.herosPresents ? 'Toutes présentes' : 'Il en manque',
  },
  { label: 'Visibilité', value: ratio(props.perfectStore?.visibiliteTaux) },
  { label: 'Promotion', value: ratio(props.perfectStore?.promotionTaux) },
])

function ratio(value: number | null | undefined): string {
  return value == null ? 'Non évalué' : `${Math.round(value * 100)}%`
}

function competitorPresent(key: string): boolean {
  return !!(props.visite?.data?.concurrence as any)?.[key]?.present
}

function competitorActive(key: string): boolean {
  return !!(props.visite?.data?.concurrence as any)?.[key]?.en_activite
}

function competitorAction(key: string): string {
  return (props.visite?.data?.concurrence as any)?.[key]?.action_concurrence || ''
}

// Ancien format (nom_concurrent à plat) + nouveau format (autres[]) : sans les
// deux, les visites antérieures n'affichent plus leurs concurrents libres.
const freeCompetitors = computed(() => concurrentsDeLaVisite(props.visite?.data?.concurrence as any))

// SKU concurrents relevés « Présent » (lot 6), libellés du référentiel.
function competitorSkus(famille: string): string[] {
  const statuts = (props.visite?.data?.concurrence as any)?.[famille]?.skus || {}
  return skusConcurrents.value
    .filter(s => s.famille === famille && statuts[s.code] === 'Présent')
    .map(s => s.libelle)
}

const visibiliteConcurrence = computed(() => {
  const conc = (props.visite?.data?.visibilite as any)?.concurrence
  if (!conc?.presence_visibilite) return []
  return marquesVisibilite.value.map(m => ({
    ...m,
    ext: visibiliteConcurrencePresente(conc, 'exterieure', m.cle),
    int: visibiliteConcurrencePresente(conc, 'interieure', m.cle),
  }))
})

function actionValue(key: string): boolean {
  return !!(props.visite?.data?.actions as any)?.[key]
}
</script>
