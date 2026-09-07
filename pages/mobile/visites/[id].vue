<template>
  <div class="mobile-page">
    <div v-if="loading" class="flex items-center justify-center py-20">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-fc-red animate-spin" aria-label="Chargement de la visite" />
    </div>

    <div v-else-if="!visite" class="px-4 py-20 text-center text-gray-400">
      <UIcon name="i-heroicons-clipboard-document-list" class="w-12 h-12 mx-auto mb-3 opacity-50" />
      <p>Visite introuvable</p>
    </div>

    <div v-else-if="visite" class="px-4 py-4 space-y-4">
      <!-- Info card -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-xs text-gray-400">#{{ visite.visite_id }}</span>
          <span
            class="text-xs font-medium px-2 py-1 rounded-full"
            :class="visite.geofence_validated ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'"
          >
            {{ visite.geofence_validated ? 'GPS validé' : 'GPS non validé' }}
          </span>
        </div>
        <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ pdvName }}</h2>
        <div class="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span class="text-gray-400 text-xs">Date</span>
            <p class="font-medium">{{ formatDate(visite.date_visite) }}</p>
          </div>
          <div>
            <span class="text-gray-400 text-xs">Commercial</span>
            <p class="font-medium">{{ visite.commercial }}</p>
          </div>
        </div>

        <!-- Complétude du relevé : dire franchement ce qui a été saisi, pour
             qu'une visite sans quantités ne soit pas lue comme un « tout va
             bien ». La quasi-totalité de l'historique est un import sans
             questionnaire. -->
        <div class="mt-3 border-t border-gray-100 pt-3 dark:border-gray-700">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs text-gray-400">Relevé renseigné</span>
            <UBadge
              :color="completude.vide ? 'red' : completude.pct === 100 ? 'green' : 'orange'"
              variant="subtle"
              size="xs"
            >
              {{ completude.pct }} %
            </UBadge>
          </div>
          <p v-if="completude.manquantes.length" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Non renseigné : {{ completude.manquantes.join(', ') }}
          </p>
        </div>
      </div>

      <!-- Produits : quantités relevées par SKU. Le commercial arrive au PDV en
           sachant ce qui est en rayon et ce qui est en rupture, pas seulement
           si la famille est « présente ». -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 space-y-3">
        <h3 class="font-bold text-sm text-gray-900 dark:text-gray-100">Produits en rayon</h3>

        <div v-for="cat in produitsReleves" :key="cat.key" class="space-y-1">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ cat.label }}</span>
            <span v-if="cat.prixRespectes !== null" class="text-[11px]" :class="cat.prixRespectes ? 'text-green-600' : 'text-orange-500'">
              Prix {{ cat.prixRespectes ? 'respectés' : 'non respectés' }}
            </span>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div
              v-for="sku in cat.skus"
              :key="sku.key"
              class="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-700/50"
            >
              <span class="min-w-0 truncate pr-2 text-xs text-gray-700 dark:text-gray-300">{{ sku.label }}</span>
              <span class="shrink-0 text-xs font-bold tabular-nums" :class="sku.quantite === 0 ? 'text-red-500' : 'text-gray-900 dark:text-gray-100'">
                {{ sku.quantite === 0 ? 'Rupture' : sku.quantite }}
              </span>
            </div>
          </div>
        </div>

        <p v-if="!produitsReleves.length" class="text-xs text-gray-500 dark:text-gray-400">
          Aucune quantité saisie sur cette visite.
        </p>
      </div>

      <!-- Concurrence -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 space-y-3">
        <h3 class="font-bold text-sm text-gray-900 dark:text-gray-100">Concurrence</h3>
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-600">Présence de concurrents :</span>
          <span
            :class="visite.data?.concurrence?.presence_concurrents ? 'text-red-500' : 'text-green-500'"
            class="font-bold text-sm"
          >
            {{ visite.data?.concurrence?.presence_concurrents ? 'OUI' : 'NON' }}
          </span>
        </div>
        <div v-if="visite.data?.concurrence?.presence_concurrents" class="grid grid-cols-2 gap-2">
          <div
            v-for="cat in concurrenceCategories"
            :key="cat.key"
            class="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2"
          >
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ cat.label }}</span>
            <p
              :class="visite.data?.concurrence?.[cat.key]?.present ? 'text-red-500' : 'text-green-500'"
              class="text-sm font-bold"
            >
              {{ visite.data?.concurrence?.[cat.key]?.present ? 'Présent' : 'Absent' }}
            </p>
            <p v-if="visite.data?.concurrence?.[cat.key]?.en_activite" class="mt-0.5 text-xs font-medium text-amber-600">
              En activité
            </p>
            <p v-if="visite.data?.concurrence?.[cat.key]?.action_concurrence" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {{ visite.data.concurrence[cat.key].action_concurrence }}
            </p>
            <!-- SKU concurrents présents (lot 6) -->
            <p v-if="skusPresents(cat.key).length" class="mt-1 text-xs text-gray-600 dark:text-gray-300">
              {{ skusPresents(cat.key).join(' · ') }}
            </p>
          </div>
        </div>

        <!-- Visibilité concurrence (étape 9/11), marques du référentiel -->
        <div v-if="visite.data?.visibilite?.concurrence?.presence_visibilite" class="space-y-1 border-t border-gray-100 pt-3 dark:border-gray-700">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Visibilité concurrence</p>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="m in visibiliteMarques"
              :key="m.cle"
              class="rounded-full bg-gray-50 px-2 py-1 text-xs dark:bg-gray-700/50"
            >
              {{ m.nom }} :
              <span :class="m.ext ? 'text-red-500' : 'text-gray-400'">ext.</span>
              <span :class="m.int ? 'text-red-500' : 'text-gray-400'">int.</span>
            </span>
          </div>
        </div>

        <!-- Concurrents signalés hors liste -->
        <div v-if="concurrentsLibres.length" class="space-y-2 border-t border-gray-100 pt-3 dark:border-gray-700">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Autres concurrents signalés</p>
          <div
            v-for="(c, idx) in concurrentsLibres"
            :key="`${c.nom}-${idx}`"
            class="flex items-start gap-3 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-700/50"
          >
            <img v-if="c.photo_url" :src="c.photo_url" alt="" class="h-12 w-12 shrink-0 rounded object-cover" />
            <div class="min-w-0">
              <p class="text-sm font-bold text-gray-900 dark:text-gray-100">{{ c.nom }}</p>
              <p v-if="c.en_activite" class="text-xs font-medium text-amber-600">En activité</p>
              <p v-if="c.action_concurrence" class="text-xs text-gray-500 dark:text-gray-400">{{ c.action_concurrence }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 space-y-3">
        <h3 class="font-bold text-sm text-gray-900 dark:text-gray-100">Actions réalisées</h3>
        <div class="space-y-2">
          <div
            v-for="action in actionsList"
            :key="action.key"
            class="flex items-center gap-2"
          >
            <UIcon
              :name="visite.data?.actions?.[action.key] ? 'i-heroicons-check-circle-solid' : 'i-heroicons-x-circle-solid'"
              :class="visite.data?.actions?.[action.key] ? 'text-green-500' : 'text-gray-300'"
              class="w-5 h-5"
            />
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ action.label }}</span>
          </div>
        </div>
      </div>

      <!-- Commentaire du merchandiseur (lot 3.4) -->
      <div v-if="visite.data?.commentaires" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 space-y-2">
        <h3 class="font-bold text-sm text-gray-900 dark:text-gray-100">Commentaire du merchandiseur</h3>
        <p class="whitespace-pre-line text-sm text-gray-700 dark:text-gray-300">{{ visite.data.commentaires }}</p>
      </div>

      <!-- Actions commerciales (lot 3.5) -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 space-y-3">
        <div class="flex items-center justify-between gap-2">
          <h3 class="font-bold text-sm text-gray-900 dark:text-gray-100">Actions décidées</h3>
          <UButton v-if="peutDeciderAction" size="xs" icon="i-heroicons-plus" class="bg-fc-red" @click="showActionModal = true">Nouvelle action</UButton>
        </div>
        <ActionCommercialeList :actions="actionsCommerciales" empty-text="Aucune action décidée sur cette visite." />
      </div>
      <ActionCommercialeModal
        v-if="peutDeciderAction"
        v-model="showActionModal"
        :pdv-id="visite.pdv_id"
        :pdv-nom="pdvName"
        :pdv-zone="visite.pdv?.zone"
        :visite-id="visite.id"
        @created="onActionCreee"
      />

      <!-- Images -->
      <div v-if="displayableImages.length" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 space-y-3">
        <h3 class="font-bold text-sm text-gray-900 dark:text-gray-100">Photos</h3>
        <div class="grid grid-cols-2 gap-2">
          <img
            v-for="(url, idx) in displayableImages"
            :key="idx"
            :src="url"
            :alt="`Photo ${idx + 1} de la visite`"
            class="w-full h-32 object-cover rounded-lg"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ActionCommerciale } from '~/types'
import { completudeReleve } from '~/utils/visiteCompletude'
import { getSkus, skuQuantity } from '~/utils/products'

definePageMeta({
  middleware: ['auth'],
  layout: 'mobile',
})

const route = useRoute()
const supabase = useSupabaseClient()
const authStore = useAuthStore()
const user = useSupabaseUser()
const { isPrivileged, matchesVisiteScope } = useUserScope()

const visite = ref<any>(null)
const displayableImages = computed(() => photosAffichables(visite.value?.image_urls))
const loading = ref(true)
const pdvName = ref('')

// Catégories actives (lot 6) : une catégorie fermée dans l'admin n'est plus
// affichée, même si la visite historique la porte.
const { actives: categoriesReleveActives, charger: chargerCategoriesReleve } = useCategoriesReleve()
const productCategories = computed(() =>
  categoriesReleveActives.value.map(c => ({ key: c.code, label: c.libelle.toUpperCase() })),
)

// Ne réclamer que les catégories encore actives : sinon une visite récente ne
// pourrait jamais atteindre 100 % à cause de yaourt et céréales, fermés au lot 6.
const completude = computed(() =>
  completudeReleve(visite.value?.data, categoriesReleveActives.value.map(c => c.code)),
)

// Quantités par SKU, lues dans `data.produits.<cat>.quantites`.
// On ne lit JAMAIS le miroir `data.produits.<cat>.present` ni les statuts par
// SKU : ce sont des champs dérivés, écrits à la soumission, qui peuvent
// diverger sur les visites antérieures à juillet 2026.
// Seules les catégories réellement renseignées sont affichées : une famille
// sans quantité n'est pas « absente du rayon », elle n'a pas été relevée — les
// confondre ferait lire une rupture là où il n'y a qu'un relevé incomplet.
const produitsReleves = computed(() => {
  const produits = visite.value?.data?.produits || {}
  return productCategories.value
    .map((cat) => {
      const bloc = produits[cat.key]
      const skus = getSkus(cat.key)
        .map(s => ({ key: s.key, label: s.label, quantite: skuQuantity(bloc, s.key) }))
        .filter((s): s is { key: string; label: string; quantite: number } => s.quantite !== null)
      return {
        key: cat.key,
        label: cat.label,
        prixRespectes: typeof bloc?.prix_respectes === 'boolean' ? bloc.prix_respectes : null,
        skus,
      }
    })
    .filter(c => c.skus.length > 0)
})

// SKU concurrents et marques de visibilité, depuis le référentiel.
const { skus: skusConcurrents, marquesVisibilite, charger: chargerMarques } = useMarquesConcurrentes()
function skusPresents(famille: string): string[] {
  const statuts = visite.value?.data?.concurrence?.[famille]?.skus || {}
  return skusConcurrents.value
    .filter(s => s.famille === famille && statuts[s.code] === 'Présent')
    .map(s => s.libelle)
}
const visibiliteMarques = computed(() => {
  const conc = visite.value?.data?.visibilite?.concurrence
  return marquesVisibilite.value.map(m => ({
    ...m,
    ext: visibiliteConcurrencePresente(conc, 'exterieure', m.cle),
    int: visibiliteConcurrencePresente(conc, 'interieure', m.cle),
  }))
})

const concurrenceCategories = [
  { key: 'evap', label: 'EVAP' },
  { key: 'imp', label: 'IMP' },
  { key: 'scm', label: 'SCM' },
  { key: 'uht', label: 'UHT' },
]

// Lit les deux formats : `autres[]` (depuis juillet 2026) et l'ancien
// `<cat>.autre = 'Présent'` + `nom_concurrent`, pour que les visites déjà
// enregistrées continuent d'afficher leurs concurrents.
const concurrentsLibres = computed(() => concurrentsDeLaVisite(visite.value?.data?.concurrence))

const actionsList = [
  { key: 'referencement_produits', label: 'Référencement produits' },
  { key: 'execution_activites_promotionnelles', label: 'Exécution activités promo.' },
  { key: 'prospection_pdv', label: 'Prospection PDV' },
  { key: 'verification_fifo', label: 'Vérification FIFO' },
  { key: 'rangement_produits', label: 'Rangement produits' },
  { key: 'pose_affiches', label: 'Pose d\'affiches' },
  { key: 'pose_materiel_visibilite', label: 'Pose matériel visibilité' },
]

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

onMounted(async () => {
  void chargerCategoriesReleve()
  void chargerMarques()
  if (!authStore.profile) {
    await authStore.fetchProfile()
  }

  const id = route.params.id as string
  let query = supabase
    .from('visites')
    .select('id, visite_id, pdv_id, user_id, commercial, email, date_visite, geofence_validated, data, image_urls, pdv:pdv_id(nom_pdv, zone, quartier)')
    .eq('visite_id', id)
 
  // Le commercial lit les visites de son périmètre (lot 3.3) : la RLS filtre,
  // on ne force plus user_id que pour les rôles terrain.
  if (!isPrivileged() && !authStore.isCommercial) {
    query = query.eq('user_id', user.value?.id)
  }

  const { data } = await query.single()

  if (data && matchesVisiteScope(data)) {
    visite.value = data
    pdvName.value = data.pdv?.nom_pdv || data.pdv_id
    void chargerActions()
  }
  else {
    visite.value = null
  }
  loading.value = false
})

// Actions commerciales de cette visite ET actions encore ouvertes sur le même
// PDV : décidées depuis la fiche PDV, elles n'ont pas de `visite_id` et
// n'apparaissaient dans aucune visite.
const { listerPourVisiteEtPdv } = useActionsCommerciales()
const actionsCommerciales = ref<ActionCommerciale[]>([])
const showActionModal = ref(false)
const peutDeciderAction = computed(() => authStore.isCommercial || isPrivileged())
async function chargerActions() {
  if (!visite.value?.id || !visite.value?.pdv_id) return
  try {
    actionsCommerciales.value = await listerPourVisiteEtPdv(visite.value.id, visite.value.pdv_id)
  }
  catch {
    actionsCommerciales.value = []
  }
}
function onActionCreee(a: ActionCommerciale) {
  actionsCommerciales.value = [a, ...actionsCommerciales.value]
}
</script>
