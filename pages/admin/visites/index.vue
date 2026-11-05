<template>
  <div class="space-y-6">
    <AdminPageHeader />

    <AdminListToolbar
      :result-count="loading && !total ? undefined : total"
      :result-label="pluriel(total, 'visite')"
      :chips="filterChips"
      @reset="resetFilters"
      @remove-chip="removeFilterChip"
    >
      <template #filters>
        <!-- Jour / semaine / mois : suivre les merchandisers au quotidien
             (réunion du 23 juillet, tâches 2.3 et 6). Le mode « Personnalisé »
             réaffiche les deux bornes libres. La liste se met à jour seule. -->
        <PeriodFilter v-model="periode" />
        <!-- visites.commercial contient l'auteur de la visite : le merchandiser. -->
        <UFormGroup label="Merchandiser" class="w-full min-w-56 flex-1 sm:max-w-sm">
          <USelectMenu
            v-model="filters.commercial"
            :options="commercialOptions"
            placeholder="Tous"
            size="sm"
            class="w-full"
            searchable
            searchable-placeholder="Rechercher un merchandiser…"
            :search-attributes="['label']"
            :loading="usersLoading"
            value-attribute="value"
            option-attribute="label"
          />
        </UFormGroup>
        <!-- Agence employeur (Atom BTL, Hello Event…) et direction (South, North,
             MT) de l'auteur. Un compte agence ne voit déjà que les siens. -->
        <template v-if="!authStore.isAgence">
          <UFormGroup label="Agence" class="w-full sm:w-56">
            <USelectMenu
              v-model="filters.agence"
              :options="agenceOptions"
              placeholder="Toutes"
              size="sm"
              class="w-full"
              value-attribute="value"
              option-attribute="label"
            />
          </UFormGroup>
          <UFormGroup label="Direction" class="w-full sm:w-48">
            <USelectMenu
              v-model="filters.direction"
              :options="directionOptions"
              placeholder="Toutes"
              size="sm"
              class="w-full"
              value-attribute="value"
              option-attribute="label"
            />
          </UFormGroup>
        </template>
        <!-- Situation dans la tournée du jour : indication seulement, la visite compte toujours. -->
        <UFormGroup v-if="visitesStore.situationDisponible" label="Tournée" class="w-full sm:w-64">
          <USelectMenu
            v-model="filters.situation"
            :options="OPTIONS_FILTRE_SITUATION"
            placeholder="Toutes"
            size="sm"
            class="w-full"
            value-attribute="value"
            option-attribute="label"
          />
        </UFormGroup>
      </template>
      <template #actions>
        <UButton v-if="peutGererAgences" size="sm" color="gray" variant="ghost" icon="i-heroicons-building-office-2" :to="{ path: '/admin/referentiels', query: { liste: 'agence' } }">Gérer les agences</UButton>
        <UButton size="sm" color="gray" variant="ghost" icon="i-heroicons-arrow-path" :loading="visitesStore.loading" @click="filterVisites">Actualiser</UButton>
        <UButton size="sm" variant="outline" icon="i-heroicons-arrow-down-tray" @click="handleExport">Exporter</UButton>
      </template>
    </AdminListToolbar>

    <!-- Récap par merchandiser sur la période (recap_situation_tournee). -->
    <details
      v-if="visitesStore.situationDisponible && recapLignes.length"
      class="admin-surface group overflow-hidden"
      :open="recapOuvert"
      @toggle="recapOuvert = ($event.target as HTMLDetailsElement).open"
    >
      <summary class="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <div>
          <h2 class="text-base font-semibold text-slate-900 dark:text-white">Visites hors tournée, par merchandiser</h2>
          <p class="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
            Indication seulement : toutes ces visites comptent. Le jour de la visite est compté à l’heure d’Abidjan.
            <template v-if="totalHorsTournee"> {{ compte(totalHorsTournee, 'visite') }} hors tournée sur la période, dont {{ totalPdvCrees }} sur un PDV créé sur place.</template>
          </p>
        </div>
        <UIcon name="i-heroicons-chevron-down" class="mt-1 h-5 w-5 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div class="overflow-x-auto border-t border-slate-200 dark:border-slate-700">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Merchandiser</th>
              <th class="text-right">Visites</th>
              <th class="text-right" title="Le PDV était une étape de la tournée du jour">Prévues</th>
              <th class="text-right" title="PDV ajouté à la tournée un jour de visite libre">Visite libre</th>
              <th class="text-right" title="Pushcart ajouté à la tournée un jour avec point de visite">Pushcarts à trouver</th>
              <th class="text-right" title="PDV absent de la tournée du jour, PDV créés sur place compris">Hors tournée</th>
              <th class="text-right" title="Visites hors tournée sur un PDV créé par le merchandiser lui-même">dont PDV créé</th>
              <th class="text-right" title="PDV créés sur place, visités sur la période, encore à vérifier dans Points de vente › Doublons possibles">Doublons à vérifier</th>
              <th v-if="recapAvecSansTournee" class="text-right" title="Visites un jour sans tournée">Jour sans tournée</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in recapLignes" :key="r.user_id">
              <td class="font-medium text-slate-900 dark:text-white">
                {{ r.merchandiser || r.email || '—' }}
                <p v-if="r.employeur" class="mt-0.5 text-xs font-normal text-slate-500 dark:text-slate-400">{{ nomAgence(r.employeur) }}</p>
              </td>
              <td class="text-right tabular-nums">{{ r.visites }}</td>
              <td class="text-right tabular-nums">{{ r.prevues }}</td>
              <td class="text-right tabular-nums">{{ r.ajoutees_visite_libre }}</td>
              <td class="text-right tabular-nums">{{ r.pushcarts_a_trouver }}</td>
              <td class="text-right tabular-nums">
                <UButton
                  v-if="r.hors_tournee"
                  size="xs"
                  color="amber"
                  variant="soft"
                  :aria-label="`Voir les ${compte(r.hors_tournee, 'visite')} hors tournée de ${r.merchandiser || r.email}`"
                  @click="voirHorsTournee(r)"
                >
                  <span class="tabular-nums">{{ r.hors_tournee }}</span>
                </UButton>
                <span v-else class="text-slate-500">0</span>
              </td>
              <td class="text-right tabular-nums">{{ r.dont_pdv_cree }}</td>
              <td class="text-right tabular-nums">
                <span v-if="r.pdv_doublons_a_verifier == null" class="text-slate-500" title="Réservé à l’administrateur et au superviseur">—</span>
                <span v-else :class="r.pdv_doublons_a_verifier ? 'font-semibold text-amber-700 dark:text-amber-300' : ''">{{ r.pdv_doublons_a_verifier }}</span>
              </td>
              <td v-if="recapAvecSansTournee" class="text-right tabular-nums">{{ r.sans_tournee }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="peutVoirDoublons && totalDoublons" class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-sm dark:border-slate-700">
        <p class="text-slate-600 dark:text-slate-300">
          {{ totalDoublons }} {{ pluriel(totalDoublons, 'PDV créé sur place', 'PDV créés sur place') }} {{ pluriel(totalDoublons, 'ressemble', 'ressemblent') }} à un PDV existant tout proche, encore à vérifier.
        </p>
        <UButton size="xs" variant="outline" icon="i-heroicons-document-duplicate" to="/admin/pdv/doublons">
          Points de vente › Doublons possibles
        </UButton>
      </div>
    </details>

    <div class="admin-surface overflow-hidden">
      <div class="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
        <h2 class="text-base font-semibold text-slate-900 dark:text-white">Visites et résultats Perfect Store</h2>
        <p class="mt-0.5 text-xs text-slate-600 dark:text-slate-300">Cliquez sur une ligne pour voir le détail : produits, prix, visibilité et photos.</p>
      </div>

      <div v-if="visites.length" class="overflow-x-auto">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Merchandiser</th>
              <th>Point de vente</th>
              <th>Distributeur</th>
              <th class="whitespace-nowrap">Perfect Store</th>
              <th class="whitespace-nowrap text-right" title="Familles de produits présentes en rayon, sur les familles suivies">Familles présentes</th>
              <th class="whitespace-nowrap" title="Visite démarrée dans le rayon de visite du point de vente">Sur place</th>
              <th class="text-right">Photos</th>
              <th class="text-right"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="visite in visites"
              :key="visite.id || visite.visite_id"
              class="cursor-pointer"
              tabindex="0"
              @click="viewVisite(visite)"
              @keydown.enter="viewVisite(visite)"
            >
              <td class="whitespace-nowrap tabular-nums">{{ formatDate(visite.date_visite) }}</td>
              <td class="font-medium text-slate-900 dark:text-white">
                {{ visite.commercial || '—' }}
                <p v-if="agenceDe(visite)" class="mt-0.5 text-xs font-normal text-slate-500 dark:text-slate-400">{{ agenceDe(visite) }}</p>
              </td>
              <td>
                <div class="min-w-40">
                  <p class="font-medium text-slate-900 dark:text-white">{{ nomPdv(visite) }}</p>
                  <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {{ [typePdvLabel(visite.pdv?.sous_categorie_pdv) || 'Type non renseigné', libelleCanal(visite.pdv?.canal)].filter(Boolean).join(' · ') }}
                  </p>
                  <span v-if="badgeSituation(visite.situation_tournee)" class="mt-1 inline-flex" :title="badgeSituation(visite.situation_tournee)?.aide">
                    <UBadge :color="badgeSituation(visite.situation_tournee)?.couleur" variant="soft" size="xs">
                      {{ badgeSituation(visite.situation_tournee)?.libelle }}
                    </UBadge>
                  </span>
                </div>
              </td>
              <td>{{ visite.pdv?.distributor_name || '—' }}</td>
              <td class="whitespace-nowrap">
                <div class="flex items-center gap-2">
                  <span v-if="!scoreFor(visite)" class="text-slate-600 dark:text-slate-300">—</span>
                  <UBadge v-else-if="statutNiveauVisite(scoreFor(visite)) === 'atteint'" color="green" variant="soft" size="xs">
                    {{ libelleNiveau(scoreFor(visite)?.tierAtteint) }}
                  </UBadge>
                  <!-- Disponibilité nulle = pas de seuil pour ce type de PDV dans le
                       référentiel (une visite sans relevé vaut 0 %, pas null). -->
                  <span
                    v-else-if="statutNiveauVisite(scoreFor(visite)) === 'non_evalue'"
                    class="block max-w-52 whitespace-normal text-xs text-slate-600 dark:text-slate-300"
                    title="Le niveau ne peut pas être calculé, quoi que le merchandiser relève : le seuil manque dans le référentiel."
                  >{{ libelleSansSeuil(typePdvLabel(visite.pdv?.sous_categorie_pdv) || visite.pdv?.sous_categorie_pdv) }}</span>
                  <span v-else class="text-slate-600 dark:text-slate-300">Non conforme</span>
                  <span class="font-semibold tabular-nums text-slate-900 dark:text-white">{{ ratio(scoreFor(visite)?.scoreGlobal) }}</span>
                </div>
              </td>
              <td class="text-right tabular-nums" :title="detailFamilles(visite)">
                {{ famillesPresentes(visite) }} / {{ tableProductCategories.length }}<span class="sr-only"> familles ({{ detailFamilles(visite) }})</span>
              </td>
              <td class="whitespace-nowrap">
                <span class="inline-flex items-center gap-1">
                  <UIcon
                    :name="visite.geofence_validated ? 'i-heroicons-check-circle-solid' : 'i-heroicons-x-circle'"
                    class="h-4 w-4"
                    :class="visite.geofence_validated ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'"
                    aria-hidden="true"
                  />
                  {{ visite.geofence_validated ? 'Oui' : 'Non' }}
                </span>
              </td>
              <td class="text-right">
                <UButton
                  v-if="photosAffichables(visite.image_urls).length"
                  size="xs"
                  color="gray"
                  variant="ghost"
                  icon="i-heroicons-photo"
                  :aria-label="`Voir ${compte(photosAffichables(visite.image_urls).length, 'photo')} de la visite chez ${nomPdv(visite)}`"
                  @click.stop="openPhotoGallery(visite)"
                >
                  <span class="tabular-nums">{{ photosAffichables(visite.image_urls).length }}</span>
                </UButton>
                <span v-else class="text-slate-500">—</span>
              </td>
              <td class="text-right">
                <div @click.stop>
                  <UDropdown :items="getVisiteActions(visite)" :popper="{ placement: 'bottom-end' }">
                    <UButton
                      color="gray"
                      variant="ghost"
                      size="xs"
                      icon="i-heroicons-ellipsis-vertical"
                      :aria-label="`Actions pour la visite du ${formatDate(visite.date_visite)} chez ${nomPdv(visite)}`"
                    />
                  </UDropdown>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <ChargementContenu v-if="loading" variante="lignes" :nombre="6" libelle="Chargement des visites…" class="p-5" />

      <div v-else-if="!visites.length" class="px-6 py-14 text-center">
        <UIcon name="i-heroicons-clipboard-document-list" class="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" aria-hidden="true" />
        <p class="mt-3 text-sm font-medium text-slate-900 dark:text-white">Aucune visite sur cette période</p>
        <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {{ filters.commercial ? 'Élargissez la période ou retirez le filtre Merchandiser.' : 'Élargissez la période pour voir plus de visites.' }}
        </p>
        <UButton class="mt-4" size="xs" variant="outline" icon="i-heroicons-arrow-path" @click="resetFilters">
          Réinitialiser les filtres
        </UButton>
      </div>

      <AdminPagination
        v-if="total || !loading"
        :total="total"
        :page="filters.page"
        :page-size="filters.perPage"
        :loading="loading"
        :item-label="pluriel(total, 'visite')"
        @update:page="(p) => { filters.page = p; loadVisites() }"
      />
    </div>

    <AdminConfirmation v-bind="confirmation" @confirmer="confirmer" @annuler="annuler" />

    <VisitDetailModal
      v-model="showDetail"
      :visite="selectedVisite"
      :perfect-store="selectedPerfectStore"
      :can-delete="peutSupprimer"
      @delete="handleDelete"
    />

    <UModal v-model="showPhotoGallery" :ui="{ width: 'max-w-2xl' }">
      <div v-if="galleryVisite" class="p-6">
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Photos de la visite</h2>
            <p class="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
              {{ nomPdv(galleryVisite) }} · {{ formatDate(galleryVisite.date_visite) }}<template v-if="galleryVisite.commercial"> · {{ galleryVisite.commercial }}</template>
            </p>
          </div>
          <UButton aria-label="Fermer" color="gray" variant="ghost" size="xs" icon="i-heroicons-x-mark" @click="showPhotoGallery = false" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <button
            v-for="(url, index) in galleryPhotos"
            :key="url"
            type="button"
            class="overflow-hidden rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            :aria-label="`Agrandir la photo ${index + 1}`"
            @click="zoomedPhoto = url"
          >
            <img :src="url" :alt="`Photo ${index + 1} de la visite chez ${nomPdv(galleryVisite)}`" class="h-48 w-full object-cover" />
          </button>
        </div>
      </div>
    </UModal>

    <UModal v-model="showZoomedPhoto" :ui="{ width: 'max-w-4xl' }">
      <div class="p-2">
        <div class="mb-1 flex justify-end">
          <UButton aria-label="Fermer" color="gray" variant="ghost" size="xs" icon="i-heroicons-x-mark" @click="showZoomedPhoto = false" />
        </div>
        <img v-if="zoomedPhoto" :src="zoomedPhoto" alt="Photo agrandie" class="max-h-[80vh] w-full rounded-lg object-contain" />
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { PeriodeValue } from '~/components/PeriodFilter.vue'
import type { Profile, Visite } from '~/types'
import type { PerfectStoreResultB } from '~/utils/perfectStore'
import { plageDePeriode } from '~/utils/periode'
import { photosAffichables } from '~/utils/visitePhotos'
import { catalogueProduits, categoriesProduitsActives, getCategoryDef } from '~/utils/products'
import { isModernTrade } from '~/utils/canal'
import { messageUtilisateur } from '~/utils/supabaseErrors'
import { libelleSansSeuil, statutNiveauVisite } from '~/utils/perfectStore'
import { OPTIONS_FILTRE_SITUATION, badgeSituation, type RecapSituationTournee } from '~/utils/situationTournee'
import { compte, pluriel } from '~/utils/pluriel'
import { DIRECTIONS, libelleDirection } from '~/utils/agences'

definePageMeta({ middleware: ['auth', 'admin'], layout: 'admin' })

const visitesStore = useVisitesStore()
const authStore = useAuthStore()
// La suppression d'une visite est définitive (delete en base) : réservée à
// l'administrateur et au superviseur.
// Suppression réservée à l'admin par la RLS (visites_delete_admin).
const peutSupprimer = computed(() => authStore.isAdmin)
const toast = useToast()
const { confirmation, demanderConfirmation, confirmer, annuler } = useConfirmation()
const { exportVisitesToExcel } = useCsvExport()
const { fetchUsers: fetchCachedUsers, loading: usersLoading } = useUsersCache()
// Le cache des comptes n'est pas réactif : `users` lu avant son chargement
// restait vide. Copie locale, remplie quand le chargement aboutit.
const comptes = shallowRef<Profile[]>([])
async function chargerComptes() {
  comptes.value = [...await fetchCachedUsers()]
  return comptes.value
}
const { refs, fetchRefs, scoreVisite } = usePerfectStore()
const { typePdvLabel, fetchTypePdvLabels } = useTypePdvLabels()
const { options: optionsAgences, nom: nomAgence, charger: chargerAgences } = useAgences()
const { peutOuvrir } = useAdminNavigation()
const peutGererAgences = computed(() => peutOuvrir('/admin/referentiels', { liste: 'agence' }))
const peutVoirDoublons = computed(() => peutOuvrir('/admin/pdv/doublons'))

const visites = computed(() => visitesStore.visites)
const total = computed(() => visitesStore.total)
// Le drapeau du store vaut false avant le premier fetch : sans
// premierChargement, l'état vide s'affichait pendant le chargement initial.
const premierChargement = ref(true)
const loading = computed(() => visitesStore.loading || premierChargement.value)
watch(() => visitesStore.loading, (enCours, avant) => {
  if (avant && !enCours) premierChargement.value = false
})
const filters = visitesStore.filters

// Période : source de vérité de l'UI, recopiée dans les filtres du store (qui
// ne connaît que dateFrom / dateTo). Défaut : 30 derniers jours glissants — le
// « mois en cours » donnait un écran vide chaque début de mois ; le preset
// « Mois » reste à un clic et les chips affichent toujours la plage active.
const periode = ref<PeriodeValue>({ preset: '30j', ...plageDePeriode('30j') })
watch(periode, (p) => {
  filters.dateFrom = p.debut
  filters.dateTo = p.fin
}, { deep: true, immediate: true })

const showDetail = ref(false)
const selectedVisite = ref<Visite | null>(null)
const showPhotoGallery = ref(false)
const galleryVisite = ref<Visite | null>(null)
const galleryPhotos = computed(() => photosAffichables(galleryVisite.value?.image_urls))
const zoomedPhoto = ref<string | null>(null)
const showZoomedPhoto = computed({
  get: () => !!zoomedPhoto.value,
  set: value => { if (!value) zoomedPhoto.value = null },
})

// Une colonne par catégorie active du catalogue (Paramètres › Produits du formulaire).
const tableProductCategories = computed(() => categoriesProduitsActives().map(c => ({ key: c.key, label: c.label })))

// Comptes de l'agence et de la direction choisies, inactifs compris : leurs
// visites passées restent dans la liste.
function comptesChoisis() {
  return comptes.value.filter(u =>
    (!filters.agence || u.employeur === filters.agence)
    && (!filters.direction || u.direction === filters.direction))
}

const commercialOptions = computed(() => [
  { value: '', label: 'Tous' },
  ...(filters.agence || filters.direction ? comptesChoisis() : comptes.value)
    .filter(user => user.is_active !== false)
    .map(user => ({ value: user.nom || user.email || '', label: `${user.nom || '—'} (${user.email})` })),
])

const agenceOptions = computed(() => [{ value: '', label: 'Toutes' }, ...optionsAgences.value])
const directionOptions = [{ value: '', label: 'Toutes' }, ...DIRECTIONS.map(d => ({ value: d.value, label: d.label }))]

// Agence et direction de l'auteur, sous son nom (« Atom BTL · South »).
const comptesParId = computed(() => new Map(comptes.value.map(u => [u.id, u])))
const comptesParEmail = computed(() => new Map(comptes.value.map(u => [u.email, u])))
function agenceDe(visite: Visite): string {
  const u = (visite.user_id && comptesParId.value.get(visite.user_id)) || comptesParEmail.value.get(visite.email)
  if (!u?.employeur) return ''
  return [nomAgence(u.employeur), u.direction ? libelleDirection(u.direction, true) : ''].filter(Boolean).join(' · ')
}

// Récap par merchandiser : la fonction rend toute la période visible ; les
// filtres Agence, Direction et Merchandiser s'appliquent ici.
const recapOuvert = ref(true)
const recapLignes = computed<RecapSituationTournee[]>(() => {
  let lignes = visitesStore.recapSituation || []
  if (filters.agence || filters.direction) {
    const ids = new Set(comptesChoisis().map(u => u.id))
    lignes = lignes.filter(r => ids.has(r.user_id))
  }
  if (filters.commercial) {
    const q = filters.commercial.toLowerCase()
    lignes = lignes.filter(r => `${r.merchandiser || ''} ${r.email || ''}`.toLowerCase().includes(q))
  }
  return lignes
})
const somme = (cle: 'hors_tournee' | 'dont_pdv_cree' | 'pdv_doublons_a_verifier') =>
  recapLignes.value.reduce((t, r) => t + (Number(r[cle]) || 0), 0)
const totalHorsTournee = computed(() => somme('hors_tournee'))
const totalPdvCrees = computed(() => somme('dont_pdv_cree'))
const totalDoublons = computed(() => somme('pdv_doublons_a_verifier'))
const recapAvecSansTournee = computed(() => recapLignes.value.some(r => r.sans_tournee > 0))

function voirHorsTournee(r: RecapSituationTournee) {
  filters.commercial = r.merchandiser || r.email || ''
  filters.situation = 'hors'
}

let periodeRecap = ''
async function chargerRecap() {
  const cle = `${filters.dateFrom}|${filters.dateTo}`
  if (cle === periodeRecap) return
  periodeRecap = cle
  try {
    await visitesStore.fetchRecapSituation(filters.dateFrom, filters.dateTo)
  }
  catch (err) {
    periodeRecap = ''
    console.error('Récap des visites hors tournée indisponible', err)
  }
}

const perfectStoreScores = computed(() => {
  const scores = new Map<string, PerfectStoreResultB | null>()
  for (const visite of visites.value) {
    const key = visite.id || visite.visite_id
    scores.set(key, refs.value ? scoreVisite(visite.data, visite.pdv || {}) : null)
  }
  return scores
})

const selectedPerfectStore = computed(() => {
  if (!selectedVisite.value || !refs.value) return null
  return scoreVisite(selectedVisite.value.data, selectedVisite.value.pdv || {})
})

function scoreFor(visite: Visite): PerfectStoreResultB | null {
  return perfectStoreScores.value.get(visite.id || visite.visite_id) || null
}

function productPresent(visite: Visite, category: string): boolean {
  return !!(visite.data?.produits as any)?.[category]?.present
}

// Familles de produits : une seule colonne (présentes / suivies), le détail
// en info-bulle et dans la fiche de la visite.
function famillesPresentes(visite: Visite): number {
  return tableProductCategories.value.filter(c => productPresent(visite, c.key)).length
}

function detailFamilles(visite: Visite): string {
  const presentes = tableProductCategories.value.filter(c => productPresent(visite, c.key)).map(c => c.label)
  const absentes = tableProductCategories.value.filter(c => !productPresent(visite, c.key)).map(c => c.label)
  return [
    `Présentes : ${presentes.length ? presentes.join(', ') : 'aucune'}`,
    absentes.length ? `Absentes : ${absentes.join(', ')}` : '',
  ].filter(Boolean).join('. ')
}

function ratio(value: number | null | undefined): string {
  return value == null ? '—' : `${Math.round(value * 100)} %`
}

// Niveau Perfect Store en casse normale (« VIP », « Flagship »…).
function libelleNiveau(value: string | null | undefined): string {
  const court = String(value || '').replace(/\s*PERFECT STORE\s*$/i, '').replace(/\s*STORE\s*$/i, '').trim()
  if (!court) return '—'
  if (court.toUpperCase() === 'VIP') return 'VIP'
  return court.charAt(0).toUpperCase() + court.slice(1).toLowerCase()
}

// Affichage seulement : la valeur de base reste General trade / Modern trade.
function libelleCanal(value: string | null | undefined): string {
  if (!value) return ''
  return isModernTrade(value) ? 'Supermarchés (MT)' : 'Boutiques (GT)'
}

function nomPdv(visite: Visite): string {
  return visite.pdv?.nom_pdv || 'Point de vente sans nom'
}

function formatDate(value: string): string {
  return formatDateFr(value, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function viewVisite(visite: Visite) {
  selectedVisite.value = visite
  showDetail.value = true
}

async function ouvrirVisiteParId(id: string) {
  try {
    viewVisite(await visitesStore.fetchVisiteByDatabaseId(id))
  }
  catch (err) {
    toast.add({ title: 'Visite introuvable', description: (err as any)?.code === 'PGRST116'
      ? 'Cette visite n’existe plus ou n’est pas dans votre périmètre.'
      : messageUtilisateur(err), color: 'amber' })
  }
}

function openPhotoGallery(visite: Visite) {
  galleryVisite.value = visite
  showPhotoGallery.value = true
}

function getVisiteActions(visite: Visite) {
  const groupes: { label: string; icon: string; click: () => void }[][] = [[
    { label: 'Voir le détail', icon: 'i-heroicons-eye', click: () => viewVisite(visite) },
  ]]
  if (peutSupprimer.value) {
    groupes.push([{ label: 'Supprimer la visite', icon: 'i-heroicons-trash', click: () => handleDelete(visite) }])
  }
  return groupes
}

async function handleDelete(visite: Visite) {
  if (!peutSupprimer.value) return
  const quand = formatDateFr(visite.date_visite, { day: '2-digit', month: 'long', year: 'numeric' })
  const ok = await demanderConfirmation({
    titre: `Supprimer la visite du ${quand} chez « ${nomPdv(visite)} » ?`,
    message: 'La visite, ses relevés et ses photos disparaissent des listes, des indicateurs et des exports. Cette suppression ne peut pas être annulée.',
    libelleAction: 'Supprimer la visite',
  })
  if (!ok) return
  try {
    await visitesStore.deleteVisite(visite.visite_id)
    showDetail.value = false
    toast.add({ title: 'Visite supprimée', description: `Visite du ${quand} chez « ${nomPdv(visite)} ».`, color: 'green' })
    await loadVisites()
  }
  catch (err) {
    console.error('Suppression de la visite impossible', err)
    toast.add({ title: 'Suppression impossible', description: messageUtilisateur(err), color: 'red' })
  }
}

async function handleExport() {
  try {
    // Toutes les visites de la période filtrée, pas seulement la page affichée.
    const { rows, tronque } = await visitesStore.fetchVisitesForExport()
    await exportVisitesToExcel(rows)
    toast.add({
      title: `${compte(rows.length, 'visite')} ${pluriel(rows.length, 'exportée')}`,
      description: tronque ? 'Plafond de 5 000 lignes atteint : réduisez la période pour tout obtenir.' : undefined,
      color: tronque ? 'amber' : 'green',
    })
  }
  catch (err) {
    console.error('Export des visites impossible', err)
    toast.add({ title: 'Export impossible', description: messageUtilisateur(err), color: 'red' })
  }
}

function resetFilters() {
  // Le watch sur `periode` réécrit dateFrom / dateTo.
  periode.value = { preset: '30j', ...plageDePeriode('30j') }
  filters.commercial = ''
  filters.email = ''
  filters.agence = ''
  filters.direction = ''
  filters.situation = ''
  filters.page = 1
  loadVisites()
}

// Chips des filtres actifs (sous la barre) — clic = retirer ce filtre seul.
// Les bornes de date n'y figurent pas : elles sont pilotées par PeriodFilter,
// qui affiche déjà la plage. Un chip « retirer » les désynchroniserait.
const filterChips = computed(() => {
  const chips: { key: string; label: string }[] = []
  if (filters.commercial) {
    const opt = commercialOptions.value.find(o => o.value === filters.commercial)
    chips.push({ key: 'commercial', label: `Merchandiser : ${opt?.label || filters.commercial}` })
  }
  if (filters.agence) chips.push({ key: 'agence', label: `Agence : ${nomAgence(filters.agence)}` })
  if (filters.direction) chips.push({ key: 'direction', label: `Direction : ${libelleDirection(filters.direction, true)}` })
  if (filters.situation) {
    const opt = OPTIONS_FILTRE_SITUATION.find(o => o.value === filters.situation)
    chips.push({ key: 'situation', label: `Tournée : ${opt?.label || filters.situation}` })
  }
  return chips
})
function removeFilterChip(key: string) {
  ;(filters as any)[key] = ''
  filters.page = 1
  loadVisites()
}

async function loadVisites() {
  if (filters.agence || filters.direction) {
    await chargerComptes()
    const choisis = comptesChoisis()
    filters.auteurs = { ids: choisis.map(u => u.id), emails: choisis.map(u => u.email).filter(Boolean) }
  }
  else {
    filters.auteurs = null
  }
  await Promise.all([visitesStore.fetchVisites(), chargerRecap()])
}

function filterVisites() {
  filters.page = 1
  periodeRecap = ''
  loadVisites()
}

// Filtrage dynamique : les changements de filtres relancent la liste sans
// passer par le bouton « Filtrer » (debounce court).
let autoFilterTimer: ReturnType<typeof setTimeout> | null = null
watch(() => [filters.dateFrom, filters.dateTo, filters.commercial, filters.agence, filters.direction, filters.situation], () => {
  if (autoFilterTimer) clearTimeout(autoFilterTimer)
  autoFilterTimer = setTimeout(() => { filters.page = 1; loadVisites() }, 400)
})

onMounted(() => {
  // Le champ Email a été retiré de l'UI : purge d'un éventuel filtre persistant.
  filters.email = ''
  // Deep-link depuis le classement des commerciaux : /admin/visites?commercial=X
  const route = useRoute()
  const qCommercial = route.query.commercial
  if (typeof qCommercial === 'string' && qCommercial) filters.commercial = qCommercial
  // /admin/visites?situation=hors : visites hors tournée (récap, liens).
  const qSituation = route.query.situation
  filters.situation = typeof qSituation === 'string' && OPTIONS_FILTRE_SITUATION.some(o => o.value === qSituation)
    ? qSituation as typeof filters.situation
    : ''
  // /admin/visites?agence=atom&direction=south
  if (!authStore.isAgence) {
    if (typeof route.query.agence === 'string') filters.agence = route.query.agence
    if (typeof route.query.direction === 'string') filters.direction = route.query.direction
  }
  else {
    filters.agence = ''
    filters.direction = ''
  }
  // Lien direct vers une visite (Activité › Dernières visites) : /admin/visites?visite=<id>
  const qVisite = route.query.visite
  if (typeof qVisite === 'string' && qVisite) void ouvrirVisiteParId(qVisite)
  chargerComptes()
  chargerAgences()
  fetchRefs()
  fetchTypePdvLabels()
  loadVisites()
})
</script>
