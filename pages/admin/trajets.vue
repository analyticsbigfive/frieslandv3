<template>
  <div class="space-y-6">
    <AdminPageHeader />

    <!-- Hauteur sur grand écran : en-tête (56 px) + marges du contenu + onglets
         (41 px + 24 px) + titre de page et sa phrase d'aide + espacement ≈ 260 px.
         Sur petit écran, liste puis carte, chacune à sa hauteur. -->
    <div class="flex flex-col gap-4 lg:h-[calc(100dvh-260px)] lg:min-h-[560px] lg:flex-row">
      <!-- Panneau latéral : commerciaux + indicateurs + alertes -->
      <aside class="admin-surface flex max-h-[70dvh] w-full shrink-0 flex-col overflow-hidden lg:max-h-none lg:w-80" aria-labelledby="equipe-heading">
        <div class="flex items-center justify-between gap-2 border-b border-slate-200 p-3 dark:border-slate-700">
          <h2 id="equipe-heading" class="text-base font-semibold text-slate-900 dark:text-white">Équipe</h2>
          <UInput v-model="selectedDate" type="date" size="xs" class="w-36" aria-label="Jour affiché" @update:model-value="loadPositions" />
        </div>

        <!-- Jours réellement tracés : évite de chercher une tournée un jour sans données. -->
        <div v-if="activityDates.length" class="border-b border-slate-200 p-3 dark:border-slate-700">
          <p class="mb-1.5 text-xs text-slate-600 dark:text-slate-300">
            {{ selectedUser ? 'Jours avec des positions pour cette personne' : 'Jours avec des positions (30 derniers jours)' }}
          </p>
          <div class="flex flex-wrap gap-1">
            <button
              v-for="day in activityDates"
              :key="day.date"
              type="button"
              class="rounded px-2 py-0.5 text-xs font-medium transition-colors"
              :class="day.date === selectedDate
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'"
              :aria-pressed="day.date === selectedDate"
              @click="goToDate(day.date)"
            >
              {{ day.label }}
            </button>
          </div>
        </div>

        <div class="border-b border-slate-200 p-3 dark:border-slate-700">
          <USelectMenu
            :model-value="selectedUser"
            :options="repOptions"
            value-attribute="value"
            option-attribute="label"
            searchable
            searchable-placeholder="Rechercher une personne…"
            placeholder="Toute l'équipe"
            size="sm"
            class="w-full"
            aria-label="Personne affichée"
            @update:model-value="selectRep($event || '')"
          >
            <template #option="{ option }">
              <span class="flex w-full items-center gap-2">
                <span class="h-2 w-2 shrink-0 rounded-full" :class="option.dot" aria-hidden="true" />
                <span class="truncate">{{ option.label }}</span>
                <span class="ml-auto shrink-0 text-xs text-slate-600 dark:text-slate-300">{{ option.meta }}</span>
              </span>
            </template>
          </USelectMenu>
          <p class="mt-1.5 text-xs text-slate-600 dark:text-slate-300">{{ reps.filter(r => r.pointCount > 0).length }} avec positions GPS · {{ reps.filter(r => r.live).length }} en tournée</p>
        </div>

        <ChargementContenu v-if="loading" variante="lignes" :nombre="6" libelle="Chargement de l'équipe…" class="p-4" />
        <ul v-else class="flex-1 divide-y divide-slate-200 overflow-auto dark:divide-slate-700">
          <li v-for="rep in repsAffiches" :key="rep.userId">
            <button
              type="button"
              class="w-full p-3 text-left transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 dark:hover:bg-slate-700/50 dark:focus-visible:bg-slate-700/50"
              :class="{ 'bg-brand-50 hover:bg-brand-50 dark:bg-brand-950/30': selectedUser === rep.userId }"
              :aria-pressed="selectedUser === rep.userId"
              @click="selectRep(rep.userId)"
            >
              <span class="flex items-center justify-between gap-2">
                <span class="flex min-w-0 items-center gap-2">
                  <span class="h-2.5 w-2.5 shrink-0 rounded-full" :class="statusDotClass(rep)" aria-hidden="true" />
                  <span class="truncate text-sm font-medium text-slate-900 dark:text-white">{{ rep.nom }}</span>
                </span>
                <span class="shrink-0 text-xs text-slate-600 dark:text-slate-300">{{ rep.statusLabel }}</span>
              </span>

              <span v-if="rep.pointCount > 0" class="mt-1.5 grid grid-cols-3 gap-1 text-center">
                <span><span class="block text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{{ rep.km.toFixed(1) }}</span><span class="block text-xs text-slate-600 dark:text-slate-300">km</span></span>
                <span><span class="block text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{{ rep.durationLabel }}</span><span class="block text-xs text-slate-600 dark:text-slate-300">durée</span></span>
                <span><span class="block text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{{ rep.visitCount }}</span><span class="block text-xs text-slate-600 dark:text-slate-300">visites</span></span>
              </span>

              <span v-if="rep.alerts.length" class="mt-1.5 flex flex-wrap gap-1">
                <span
                  v-for="alert in rep.alerts"
                  :key="alert.kind"
                  class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="alert.class"
                >
                  <UIcon :name="alert.icon" class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{{ alert.label }}
                </span>
              </span>
            </button>
          </li>
          <li v-if="reps.length === 0" class="p-4 text-sm text-slate-600 dark:text-slate-300">
            Aucun commercial, merchandiser ou superviseur actif pour l'instant.
          </li>
        </ul>
      </aside>

      <!-- Carte + rejeu -->
      <section class="admin-surface flex h-[75dvh] min-h-[480px] w-full min-w-0 flex-col overflow-hidden lg:h-auto lg:min-h-0 lg:flex-1" aria-label="Carte des trajets">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-3 dark:border-slate-700">
          <p class="text-sm text-slate-600 dark:text-slate-300" :title="lissageInfo.detail">
            <strong class="font-semibold tabular-nums text-slate-900 dark:text-white">{{ tournees.length }}</strong> tournée(s) ·
            <strong class="font-semibold tabular-nums text-slate-900 dark:text-white">{{ lissageInfo.retenus }}</strong> points GPS gardés sur {{ filteredPoints.length }} reçus
          </p>
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              size="xs"
              color="gray"
              :variant="showRaw ? 'solid' : 'ghost'"
              :icon="showRaw ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
              :aria-pressed="showRaw"
              @click="showRaw = !showRaw; drawTrails()"
            >
              {{ showRaw ? 'Masquer les points reçus' : 'Afficher tous les points reçus' }}
            </UButton>
            <UButton v-if="selectedUser" size="xs" color="gray" variant="ghost" icon="i-heroicons-x-mark" @click="selectRep('')">Toute l'équipe</UButton>
          </div>
        </div>

        <!-- Recherche position à une heure donnée -->
        <div class="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
          <span class="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
            <UIcon name="i-heroicons-magnifying-glass" class="h-4 w-4" aria-hidden="true" />
            Où était
          </span>
          <USelectMenu
            v-model="searchUser"
            :options="searchUserOptions"
            value-attribute="value"
            option-attribute="label"
            placeholder="Personne"
            searchable
            searchable-placeholder="Rechercher…"
            size="xs"
            class="w-full sm:w-44"
            aria-label="Personne à localiser"
          />
          <span class="text-xs text-slate-600 dark:text-slate-300">à</span>
          <UInput v-model="searchTime" type="time" size="xs" class="w-28" aria-label="Heure" />
          <USelect
            v-model.number="searchRadius"
            :options="radiusOptions"
            value-attribute="value"
            option-attribute="label"
            size="xs"
            class="w-32"
            aria-label="Rayon de recherche des points de vente"
          />
          <UButton size="xs" icon="i-heroicons-map-pin" :disabled="!searchUser || !searchTime" @click="locateAtTime">
            Localiser
          </UButton>
          <UButton v-if="searchInfo" size="xs" color="gray" variant="ghost" icon="i-heroicons-x-mark" @click="clearSearch">Effacer</UButton>
          <p v-if="searchInfo" class="w-full text-xs sm:w-auto" :class="searchFound ? 'text-slate-700 dark:text-slate-200' : 'font-medium text-amber-800 dark:text-amber-200'" aria-live="polite">{{ searchInfo }}</p>
        </div>

        <!-- Fiche journée de la personne sélectionnée -->
        <div v-if="dayFiche" class="flex flex-wrap items-stretch gap-2 border-b border-slate-200 p-3 dark:border-slate-700">
          <div class="flex flex-col justify-center pr-2">
            <span class="text-sm font-semibold text-slate-900 dark:text-white">{{ dayFiche.nom }}</span>
            <span class="text-xs text-slate-600 dark:text-slate-300">{{ formatDay(selectedDate) }}</span>
          </div>
          <div v-if="dayFiche.noGps" class="flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            <UIcon name="i-heroicons-signal-slash" class="h-4 w-4 shrink-0" aria-hidden="true" />Suivi GPS non démarré ce jour
          </div>
          <template v-else>
            <div class="rounded-md bg-slate-50 px-2.5 py-1 text-center dark:bg-slate-700/50">
              <p class="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{{ dayFiche.firstLabel }} – {{ dayFiche.lastLabel }}</p>
              <p class="text-xs text-slate-600 dark:text-slate-300">première et dernière position</p>
            </div>
            <div class="rounded-md bg-slate-50 px-2.5 py-1 text-center dark:bg-slate-700/50">
              <p class="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{{ dayFiche.durationLabel }}</p>
              <p class="text-xs text-slate-600 dark:text-slate-300">sur le terrain</p>
            </div>
            <div class="rounded-md bg-slate-50 px-2.5 py-1 text-center dark:bg-slate-700/50">
              <p class="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{{ dayFiche.km }} km</p>
              <p class="text-xs text-slate-600 dark:text-slate-300">distance</p>
            </div>
          </template>
          <div class="rounded-md bg-slate-50 px-2.5 py-1 text-center dark:bg-slate-700/50">
            <p class="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{{ dayFiche.visitCount }}</p>
            <p class="text-xs text-slate-600 dark:text-slate-300">visite(s)</p>
          </div>
          <div v-if="dayFiche.offGeofence" class="flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            <UIcon name="i-heroicons-exclamation-triangle" class="h-4 w-4 shrink-0" aria-hidden="true" />
            {{ dayFiche.offGeofence }} hors du rayon de visite
          </div>
        </div>

        <div class="relative min-h-0 flex-1">
          <ClientOnly>
            <div ref="mapContainer" class="h-full w-full" />
          </ClientOnly>

          <!-- Légende : rend la carte lisible sans deviner les codes couleur. -->
          <div
            v-if="!emptyState"
            class="pointer-events-none absolute right-3 top-3 z-[500] rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          >
            <p class="mb-1 font-semibold text-slate-900 dark:text-white">Légende</p>
            <div class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ background: COULEURS_CARTE.depart }" aria-hidden="true" />Départ</div>
            <div class="mt-1 flex items-center gap-1.5"><span class="h-0.5 w-3.5 shrink-0" :style="{ background: SERIES[0] }" aria-hidden="true" />Trajet (une couleur par personne)</div>
            <div class="mt-1 flex items-center gap-1.5"><span class="h-3 w-3 shrink-0 rounded-full border-2 border-white" :style="{ background: SERIES[0], boxShadow: `0 0 0 2px ${SERIES[0]}` }" aria-hidden="true" />Arrêt de 5 min ou plus</div>
            <div class="mt-1 flex items-center gap-1.5"><span class="h-2.5 w-2.5 shrink-0 rotate-45" :style="{ background: COULEURS_CARTE.visite }" aria-hidden="true" />Visite</div>
            <div class="mt-1 flex items-center gap-1.5"><span class="h-2.5 w-2.5 shrink-0 rotate-45" :style="{ background: COULEURS_CARTE.horsRayon }" aria-hidden="true" />Visite hors du rayon de visite</div>
          </div>

          <!-- Navigation jour précédent / suivant parmi les jours tracés. -->
          <div
            v-if="activityDays.length"
            class="absolute bottom-3 left-1/2 z-[500] flex -translate-x-1/2 items-center gap-1 rounded-md border border-slate-200 bg-white p-1 dark:border-slate-600 dark:bg-slate-800"
          >
            <UButton
              icon="i-heroicons-chevron-left"
              size="xs"
              color="gray"
              variant="ghost"
              :disabled="!hasPrevDay"
              aria-label="Jour précédent avec des positions"
              @click="stepDay(-1)"
            />
            <div class="min-w-[120px] px-1 text-center">
              <p class="text-xs font-semibold tabular-nums text-slate-900 dark:text-white">{{ formatDay(selectedDate) }}</p>
              <p class="text-xs text-slate-600 dark:text-slate-300">
                <template v-if="activityIndex >= 0">jour {{ activityDays.length - activityIndex }} sur {{ activityDays.length }}</template>
                <template v-else>aucune position ce jour</template>
              </p>
            </div>
            <UButton
              icon="i-heroicons-chevron-right"
              size="xs"
              color="gray"
              variant="ghost"
              :disabled="!hasNextDay"
              aria-label="Jour suivant avec des positions"
              @click="stepDay(1)"
            />
          </div>

          <!-- Chargement des positions : la carte seule ne montre rien de l'attente. -->
          <div v-if="loading" class="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center p-4">
            <div class="rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-600 dark:bg-slate-800">
              <ChargementContenu variante="compact" libelle="Chargement des positions GPS…" />
            </div>
          </div>

          <!-- Sans données, la carte reste figée sur la vue précédente : on le dit explicitement. -->
          <div
            v-if="emptyState"
            class="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center p-4"
          >
            <div class="pointer-events-auto max-w-sm rounded-lg border border-slate-200 bg-white p-4 text-center dark:border-slate-600 dark:bg-slate-800">
              <UIcon :name="emptyState.icon" class="mx-auto h-7 w-7 text-slate-400 dark:text-slate-500" aria-hidden="true" />
              <p class="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{{ emptyState.title }}</p>
              <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">{{ emptyState.detail }}</p>
              <UButton
                v-if="emptyState.suggestDate"
                size="xs"
                variant="outline"
                class="mt-3"
                @click="goToDate(emptyState.suggestDate)"
              >
                Voir le {{ formatDay(emptyState.suggestDate) }}
              </UButton>
            </div>
          </div>
        </div>

        <VisitDetailModal v-model="showVisitModal" :visite="visitDetail" />

        <!-- Barre de rejeu temporel -->
        <div v-if="timeRange" class="flex items-center gap-3 border-t border-slate-200 p-3 dark:border-slate-700">
          <UButton
            :icon="playing ? 'i-heroicons-pause' : 'i-heroicons-play'"
            size="xs"
            color="gray"
            variant="outline"
            :aria-label="playing ? 'Mettre le rejeu en pause' : 'Rejouer le trajet de la journée'"
            @click="togglePlay"
          />
          <input
            v-model.number="cursorTime"
            type="range"
            :min="timeRange.min"
            :max="timeRange.max"
            step="1000"
            class="flex-1 accent-fc-red"
            aria-label="Heure du trajet affichée"
            :aria-valuetext="cursorLabel"
            @input="onScrub"
          >
          <span class="w-14 shrink-0 text-right text-xs tabular-nums text-slate-600 dark:text-slate-300">{{ cursorLabel }}</span>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { haversine, lisserTrajet, libelleDuree } from '~/utils/trajets'
import { SERIES, STATUT } from '~/utils/chartPalette'
definePageMeta({
  middleware: ['auth', 'admin'],
  layout: 'admin',
})

interface TrajetPoint {
  id: string
  user_id: string
  tournee_id: string
  lat: number
  lng: number
  accuracy: number | null
  captured_at: string
  profiles?: { nom: string | null, email: string | null } | null
}

interface RepSummary {
  userId: string
  nom: string
  pointCount: number
  km: number
  durationLabel: string
  visitCount: number
  lastAtMs: number | null
  statusLabel: string
  live: boolean
  alerts: { kind: string, label: string, icon: string, class: string }[]
}

const supabase = useSupabaseClient()

const mapContainer = ref<HTMLElement | null>(null)
interface VisitMarker {
  visite_id: string
  user_id: string
  pdv_id: string | null
  nom_pdv: string
  lat: number
  lng: number
  date_visite: string
  geofence_validated: boolean | null
}

const allPoints = ref<TrajetPoint[]>([])
const allVisits = ref<VisitMarker[]>([])
const commerciaux = ref<{ id: string, nom: string | null, email: string | null }[]>([])
const visitCountByUser = ref<Record<string, number>>({})
const selectedDate = ref(new Date().toISOString().slice(0, 10))
const selectedUser = ref('')
// true d'emblée : la carte et la liste ne doivent pas annoncer « Aucun
// commercial » / « Aucune tournée » avant la fin du premier chargement.
const loading = ref(true)

const cursorTime = ref<number | null>(null)
const playing = ref(false)
let playTimer: ReturnType<typeof setInterval> | null = null

// Recherche « position à une heure »
const searchUser = ref('')
const searchTime = ref('')
const searchRadius = ref(500)
const searchInfo = ref('')
const searchFound = ref(false)
const radiusOptions = [
  { label: '200 m', value: 200 },
  { label: '500 m', value: 500 },
  { label: '1 km', value: 1000 },
  { label: '2 km', value: 2000 },
]
interface PdvGeo { pdv_id: string, nom_pdv: string, lat: number, lng: number }
const allPdv = ref<PdvGeo[]>([])

// Jours ayant au moins un point sur les 30 derniers jours, par commercial.
const activityByUser = ref<Record<string, string[]>>({})
const activityAll = ref<string[]>([])

let map: any = null
let trailGroup: any = null
let searchGroup: any = null

// Couleurs de la carte : palette commune (utils/chartPalette). Un trajet par
// personne en SERIES ; départ et visites en couleurs de statut.
const COULEURS_CARTE = {
  depart: STATUT.bon,
  visite: SERIES[1],
  horsRayon: STATUT.serieux,
} as const
const LIVE_WINDOW_MS = 15 * 60_000
const STALE_MS = 30 * 60_000

const isToday = computed(() => selectedDate.value === new Date().toISOString().slice(0, 10))

const filteredPoints = computed(() => {
  if (!selectedUser.value) return allPoints.value
  return allPoints.value.filter(p => p.user_id === selectedUser.value)
})

const filteredVisits = computed(() => {
  if (!selectedUser.value) return allVisits.value
  return allVisits.value.filter(v => v.user_id === selectedUser.value)
})

const tournees = computed(() => {
  const grouped = new Map<string, TrajetPoint[]>()
  for (const point of filteredPoints.value) {
    const list = grouped.get(point.tournee_id) ?? []
    list.push(point)
    grouped.set(point.tournee_id, list)
  }
  return [...grouped.entries()].map(([tourneeId, points]) => ({ tourneeId, points }))
})

const timeRange = computed(() => {
  if (filteredPoints.value.length < 2) return null
  const times = filteredPoints.value.map(p => new Date(p.captured_at).getTime())
  return { min: Math.min(...times), max: Math.max(...times) }
})

const cursorLabel = computed(() => {
  const t = cursorTime.value
  if (t === null) return '--:--'
  return new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
})

// Les noms (points de vente, personnes) viennent du terrain : échappés avant
// d'entrer dans le HTML des info-bulles et popups Leaflet.
function echapperHtml(texte: unknown): string {
  return String(texte ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c] as string))
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// Distance sur le tracé LISSÉ : le bruit GPS d'un point immobile ne compte
// plus (retour démo du 7 sept. : déplacements fictifs et km gonflés).
function trailDistance(points: TrajetPoint[]): number {
  return lisserTrajet(points).distanceM
}

const showRaw = ref(false)
const showVisitModal = ref(false)
const visitDetail = ref<any>(null)

const lissageInfo = computed(() => {
  let retenus = 0, precision = 0, vitesse = 0
  for (const { points } of tournees.value) {
    const r = lisserTrajet(points)
    retenus += r.points.length
    precision += r.rejetes.precision
    vitesse += r.rejetes.vitesse
  }
  return { retenus, detail: `${precision} position(s) écartée(s) car trop imprécises (plus de 50 m), ${vitesse} car le déplacement était impossible` }
})

// Options de la combobox : même ordre que la liste (en tournée d'abord).
const repOptions = computed(() => [
  { value: '', label: 'Toute l\'équipe', dot: 'bg-slate-300', meta: `${reps.value.length}` },
  ...reps.value.map(r => ({
    value: r.userId,
    label: r.nom,
    dot: r.live ? 'bg-emerald-600' : r.pointCount > 0 ? 'bg-slate-500' : 'bg-slate-300',
    meta: r.pointCount > 0 ? `${r.km.toFixed(1)} km · ${r.visitCount} PDV` : r.statusLabel,
  })),
])
const repsAffiches = computed(() => (selectedUser.value ? reps.value.filter(r => r.userId === selectedUser.value) : reps.value))

// Ouvre la visite complète (même modale que la page Visites) depuis un losange.
async function openVisit(visiteId: string) {
  const { data } = await supabase
    .from('visites')
    .select('id, visite_id, pdv_id, user_id, commercial, email, date_visite, geofence_validated, data, image_urls, pdv:pdv_id(nom_pdv, canal, sous_categorie_pdv, region, zone, quartier)')
    .eq('visite_id', visiteId)
    .maybeSingle()
  if (!data) return
  visitDetail.value = data
  showVisitModal.value = true
}

function durationLabel(ms: number): string {
  const total = Math.floor(ms / 60000)
  const h = Math.floor(total / 60)
  const m = total % 60
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`
}

function timeAgo(ms: number): string {
  const min = Math.round((Date.now() - ms) / 60000)
  if (min <= 1) return 'à l\'instant'
  if (min < 60) return `il y a ${min} min`
  return `il y a ${Math.floor(min / 60)}h`
}

// Résumé par commercial (KPI + statut + alertes).
const reps = computed<RepSummary[]>(() => {
  const byUser = new Map<string, TrajetPoint[]>()
  for (const point of allPoints.value) {
    const list = byUser.get(point.user_id) ?? []
    list.push(point)
    byUser.set(point.user_id, list)
  }

  const rows: RepSummary[] = commerciaux.value.map((profile) => {
    const points = (byUser.get(profile.id) ?? []).slice().sort(
      (a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime(),
    )
    const nom = profile.nom || profile.email || 'Compte sans nom'
    const alerts: RepSummary['alerts'] = []

    const visitCount = visitCountByUser.value[profile.id] ?? 0

    if (points.length === 0) {
      // Visites saisies mais zéro point GPS = suivi jamais démarré sur le
      // téléphone (permission « toujours » refusée), pas une absence terrain.
      if (visitCount > 0) {
        alerts.push({ kind: 'no-gps', label: 'GPS non démarré', icon: 'i-heroicons-signal-slash', class: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200' })
      }
      else if (isToday.value) {
        alerts.push({ kind: 'no-tournee', label: 'Pas de tournée', icon: 'i-heroicons-no-symbol', class: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200' })
      }
      return { userId: profile.id, nom, pointCount: 0, km: 0, durationLabel: '—', visitCount, lastAtMs: null, statusLabel: visitCount > 0 ? `${visitCount} visite(s), sans GPS` : (isToday.value ? 'inactif' : '—'), live: false, alerts }
    }

    const first = points[0]
    const last = points[points.length - 1]
    const lastAtMs = new Date(last.captured_at).getTime()
    const durMs = lastAtMs - new Date(first.captured_at).getTime()
    const live = isToday.value && Date.now() - lastAtMs < LIVE_WINDOW_MS

    // Immobile : derniers points regroupés (< 40 m) sur > 30 min.
    const recent = points.filter(p => lastAtMs - new Date(p.captured_at).getTime() < STALE_MS)
    if (live && recent.length >= 3 && trailDistance(recent) < 40) {
      alerts.push({ kind: 'immobile', label: 'Immobile', icon: 'i-heroicons-pause-circle', class: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200' })
    }
    if (isToday.value && !live && Date.now() - lastAtMs > STALE_MS) {
      alerts.push({ kind: 'stale', label: 'Sans signal', icon: 'i-heroicons-signal-slash', class: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-200' })
    }

    return {
      userId: profile.id,
      nom,
      pointCount: points.length,
      km: trailDistance(points) / 1000,
      durationLabel: durationLabel(durMs),
      visitCount,
      lastAtMs,
      statusLabel: live ? 'en tournée' : timeAgo(lastAtMs),
      live,
      alerts,
    }
  })

  // En tournée d'abord, puis actifs récents, puis inactifs.
  return rows.sort((a, b) => {
    if (a.live !== b.live) return a.live ? -1 : 1
    return (b.lastAtMs ?? 0) - (a.lastAtMs ?? 0)
  })
})

// Fiche synthèse de la journée du commercial sélectionné : première/dernière
// position, temps terrain, distance, et qualité des visites (géofence).
const dayFiche = computed(() => {
  if (!selectedUser.value) return null

  const pts = filteredPoints.value
    .slice()
    .sort((a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime())
  const visits = filteredVisits.value
  if (pts.length === 0 && visits.length === 0) return null

  const validated = visits.filter(v => v.geofence_validated !== false).length
  const first = pts[0]
  const last = pts[pts.length - 1]

  return {
    nom: selectedRepName.value,
    firstLabel: first ? formatTime(first.captured_at) : '—',
    lastLabel: last ? formatTime(last.captured_at) : '—',
    durationLabel: first && last
      ? durationLabel(new Date(last.captured_at).getTime() - new Date(first.captured_at).getTime())
      : '—',
    km: pts.length > 1 ? (trailDistance(pts) / 1000).toFixed(1) : '0.0',
    pointCount: pts.length,
    visitCount: visits.length,
    validated,
    offGeofence: visits.length - validated,
    noGps: pts.length === 0 && visits.length > 0,
  }
})

const searchUserOptions = computed(() =>
  commerciaux.value.map(c => ({ value: c.id, label: c.nom || c.email || 'Compte sans nom' })),
)

function formatDay(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

const activityDays = computed<string[]>(() =>
  selectedUser.value
    ? (activityByUser.value[selectedUser.value] ?? [])
    : activityAll.value,
)

const activityDates = computed(() =>
  activityDays.value.map(date => ({ date, label: formatDay(date) })),
)

// Position de la date courante dans les jours tracés (triés du + récent au +
// ancien). -1 si la date sélectionnée n'a aucune donnée.
const activityIndex = computed(() => activityDays.value.indexOf(selectedDate.value))

// Précédent = jour tracé plus ancien, suivant = plus récent.
const hasPrevDay = computed(() => activityIndex.value >= 0 && activityIndex.value < activityDays.value.length - 1)
const hasNextDay = computed(() => activityIndex.value > 0)

function stepDay(dir: -1 | 1) {
  const days = activityDays.value
  if (days.length === 0) return
  const idx = activityIndex.value
  // Hors liste : on entre par l'extrémité la plus proche.
  const target = idx < 0 ? days[0] : days[idx - dir]
  if (target) goToDate(target)
}

const selectedRepName = computed(() => {
  if (!selectedUser.value) return ''
  const rep = commerciaux.value.find(c => c.id === selectedUser.value)
  return rep?.nom || rep?.email || 'cette personne'
})

// Distingue « rien ce jour-là » de « rien du tout » : sans ça, la carte reste
// sur la vue précédente et le trajet manquant passe pour un bug d'affichage.
const emptyState = computed(() => {
  if (loading.value || filteredPoints.value.length > 0) return null

  const days = activityDates.value
  const suggestDate = days.find(d => d.date !== selectedDate.value)?.date

  if (selectedUser.value) {
    return {
      icon: 'i-heroicons-map',
      title: `Aucune position pour ${selectedRepName.value}`,
      detail: days.length
        ? `Rien d'enregistré le ${formatDay(selectedDate.value)} ; jours avec des positions : ${days.map(d => d.label).join(', ')}`
        : 'Aucune position GPS sur les 30 derniers jours : le suivi de tournée n\'a probablement jamais été démarré sur son téléphone.',
      suggestDate,
    }
  }

  return {
    icon: 'i-heroicons-signal-slash',
    title: 'Aucune tournée ce jour',
    detail: days.length
      ? `Aucune position GPS le ${formatDay(selectedDate.value)} ; jours avec des positions : ${days.map(d => d.label).join(', ')}`
      : 'Aucune position GPS sur les 30 derniers jours. Les trajets apparaîtront dès qu\'une personne aura démarré sa tournée dans l\'application.',
    suggestDate,
  }
})

function statusDotClass(rep: RepSummary): string {
  if (rep.live) return 'bg-emerald-600 motion-safe:animate-pulse'
  if (rep.pointCount > 0) return 'bg-slate-500'
  return 'bg-slate-300 dark:bg-slate-600'
}

function statusColorForUser(userId: string): string {
  // Couleur stable indépendante du filtre (index dans la liste commerciaux).
  const idx = commerciaux.value.findIndex(c => c.id === userId)
  return SERIES[(idx < 0 ? 0 : idx) % SERIES.length]
}

// Jours ayant au moins un point sur 30 jours : alimente les raccourcis et
// permet de dire « ce jour est vide » plutôt que de laisser la carte muette.
async function loadActivityDates() {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('position_tournee')
    .select('user_id, captured_at')
    .gte('captured_at', `${since}T00:00:00Z`)
    .limit(50000)

  if (error) return

  const perUser: Record<string, Set<string>> = {}
  const all = new Set<string>()
  for (const row of (data ?? []) as { user_id: string, captured_at: string }[]) {
    const day = row.captured_at.slice(0, 10)
    all.add(day)
    ;(perUser[row.user_id] ??= new Set()).add(day)
  }

  const desc = (a: string, b: string) => (a < b ? 1 : -1)
  activityAll.value = [...all].sort(desc)
  activityByUser.value = Object.fromEntries(
    Object.entries(perUser).map(([id, days]) => [id, [...days].sort(desc)]),
  )
}

async function loadPositions() {
  loading.value = true
  resetSearchLayer()
  const dayStart = `${selectedDate.value}T00:00:00Z`
  const dayEnd = `${selectedDate.value}T23:59:59.999Z`
  try {
    const [posRes, visitRes] = await Promise.all([
      supabase
        .from('position_tournee')
        .select('id, user_id, tournee_id, lat, lng, accuracy, captured_at, profiles(nom, email)')
        .gte('captured_at', dayStart).lt('captured_at', dayEnd)
        .order('captured_at', { ascending: true })
        .limit(10000),
      supabase
        .from('visites')
        .select('visite_id, user_id, pdv_id, date_visite, geolocation_lat, geolocation_lng, geofence_validated')
        .gte('date_visite', dayStart).lt('date_visite', dayEnd)
        .limit(10000),
    ])

    if (posRes.error) throw posRes.error
    allPoints.value = (posRes.data ?? []) as unknown as TrajetPoint[]

    const pdvNameById = new Map(allPdv.value.map(p => [p.pdv_id, p.nom_pdv]))
    const counts: Record<string, number> = {}
    const visits: VisitMarker[] = []
    for (const row of (visitRes.data ?? []) as any[]) {
      if (row.user_id) counts[row.user_id] = (counts[row.user_id] ?? 0) + 1
      if (row.geolocation_lat && row.geolocation_lng) {
        visits.push({
          visite_id: row.visite_id,
          user_id: row.user_id,
          pdv_id: row.pdv_id,
          nom_pdv: pdvNameById.get(row.pdv_id) || 'Point de vente sans nom',
          lat: row.geolocation_lat,
          lng: row.geolocation_lng,
          date_visite: row.date_visite,
          geofence_validated: row.geofence_validated,
        })
      }
    }
    visitCountByUser.value = counts
    allVisits.value = visits
  }
  catch (err) {
    console.error('Erreur chargement positions:', err)
    allPoints.value = []
    allVisits.value = []
    visitCountByUser.value = {}
  }
  finally {
    loading.value = false
    resetCursor()
    drawTrails()
  }
}

async function loadCommerciaux() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nom, email, role, is_active')
    .in('role', ['commercial', 'merchandiser', 'superviseur'])
    .eq('is_active', true)

  if (!error) {
    commerciaux.value = (data ?? []).map((p: any) => ({ id: p.id, nom: p.nom, email: p.email }))
  }
}

async function loadPdv() {
  const { data, error } = await supabase
    .from('pdv')
    .select('pdv_id, nom_pdv, geolocation_lat, geolocation_lng')
    .not('geolocation_lat', 'is', null)
    .not('geolocation_lng', 'is', null)
    .limit(20000)

  if (!error) {
    allPdv.value = (data ?? [])
      .filter((p: any) => p.geolocation_lat && p.geolocation_lng)
      .map((p: any) => ({ pdv_id: p.pdv_id, nom_pdv: p.nom_pdv, lat: p.geolocation_lat, lng: p.geolocation_lng }))
  }
}

// Position du commercial à l'heure demandée (point le plus proche dans le
// temps sur la date sélectionnée) + PDV dans le rayon autour.
function locateAtTime() {
  if (!map || !searchGroup || !searchUser.value || !searchTime.value) return
  // @ts-ignore
  const L = window.L
  if (!L) return

  searchGroup.clearLayers()

  // UTC comme la fenêtre de chargement : sinon le fuseau du navigateur admin
  // décale l'heure cherchée par rapport aux points interrogés.
  const target = new Date(`${selectedDate.value}T${searchTime.value}:00Z`).getTime()
  const userPoints = allPoints.value
    .filter(p => p.user_id === searchUser.value)
    .map(p => ({ ...p, t: new Date(p.captured_at).getTime() }))

  if (userPoints.length === 0) {
    searchFound.value = false
    searchInfo.value = 'Aucune position ce jour pour cette personne.'
    return
  }

  const nearest = userPoints.reduce((best, p) =>
    Math.abs(p.t - target) < Math.abs(best.t - target) ? p : best,
  )
  const gapMin = Math.round(Math.abs(nearest.t - target) / 60000)

  // Marqueur position + cercle de rayon.
  const posMarker = L.circleMarker([nearest.lat, nearest.lng], {
    radius: 9, fillColor: SERIES[0], color: '#fff', weight: 3, fillOpacity: 1,
  }).bindPopup(
    `<b>${echapperHtml(nearest.profiles?.nom || 'Commercial')}</b><br>Position à ${formatTime(nearest.captured_at)}<br>Précision ± ${Math.round(nearest.accuracy ?? 0)} m`,
  )
  searchGroup.addLayer(posMarker)
  searchGroup.addLayer(L.circle([nearest.lat, nearest.lng], {
    radius: searchRadius.value, color: SERIES[0], weight: 1, fillOpacity: 0.06,
  }))

  // PDV dans le rayon.
  let nearby = 0
  for (const pdv of allPdv.value) {
    const d = haversine(nearest.lat, nearest.lng, pdv.lat, pdv.lng)
    if (d <= searchRadius.value) {
      nearby++
      searchGroup.addLayer(
        L.circleMarker([pdv.lat, pdv.lng], {
          radius: 5, fillColor: COULEURS_CARTE.visite, color: '#fff', weight: 1, fillOpacity: 0.9,
        }).bindTooltip(`${echapperHtml(pdv.nom_pdv || 'Point de vente sans nom')} · ${Math.round(d)} m`, { direction: 'top' }),
      )
    }
  }

  searchFound.value = true
  searchInfo.value = `Position à ${formatTime(nearest.captured_at)} (à ${gapMin} min près) · ${nearby} point(s) de vente à moins de ${searchRadius.value >= 1000 ? searchRadius.value / 1000 + ' km' : searchRadius.value + ' m'}`

  map.setView([nearest.lat, nearest.lng], searchRadius.value <= 500 ? 16 : 15)
}

// Les repères d'une recherche précédente survivaient à un changement de date
// ou de commercial et se lisaient comme la position du jour affiché.
function resetSearchLayer() {
  searchGroup?.clearLayers()
  searchInfo.value = ''
  searchFound.value = false
}

function clearSearch() {
  resetSearchLayer()
  searchUser.value = ''
  searchTime.value = ''
}

function goToDate(date: string) {
  selectedDate.value = date
  void loadPositions()
}

function resetCursor() {
  stopPlay()
  cursorTime.value = timeRange.value ? timeRange.value.max : null
}

function drawTrails() {
  if (!map || !trailGroup) return
  // @ts-ignore
  const L = window.L
  if (!L) return

  trailGroup.clearLayers()
  const cursor = cursorTime.value ?? Infinity

  tournees.value.forEach(({ points: allPts }) => {
    const points = allPts.filter(p => new Date(p.captured_at).getTime() <= cursor)
    if (points.length === 0) return

    const color = statusColorForUser(points[0].user_id)
    const lisse = lisserTrajet(points)
    const retenus = lisse.points.map(r => r.point)
    const latlngs = retenus.map(p => [p.lat, p.lng])
    const first = retenus[0]
    const last = retenus[retenus.length - 1]
    const distance = lisse.distanceM

    const el = document.createElement('div')
    el.className = 'text-sm'
    const nameP = document.createElement('p')
    nameP.className = 'font-semibold text-slate-900'
    nameP.textContent = first.profiles?.nom || first.profiles?.email || 'Commercial'
    el.appendChild(nameP)
    const infoP = document.createElement('p')
    infoP.className = 'text-xs text-slate-600'
    infoP.textContent = `${formatTime(first.captured_at)} – ${formatTime(last.captured_at)} · ${(distance / 1000).toFixed(1)} km · ${lisse.arrets.length} arrêt(s) · ${retenus.length} points GPS gardés sur ${points.length} reçus`
    el.appendChild(infoP)

    if (retenus.length > 1) {
      const line = L.polyline(latlngs, { color, weight: 3, opacity: 0.85 })
      line.bindPopup(el)
      trailGroup.addLayer(line)
    }

    // Points bruts (optionnel) : petits, translucides, pour audit du lissage.
    if (showRaw.value) {
      points.forEach((point) => {
        trailGroup.addLayer(L.circleMarker([point.lat, point.lng], {
          radius: 2.5, fillColor: color, color: color, weight: 0, fillOpacity: 0.35,
        }).bindTooltip(`Position reçue · ${formatTime(point.captured_at)} · précision ± ${Math.round(point.accuracy ?? 0)} m`, { direction: 'top' }))
      })
    }

    lisse.points.forEach((r, i) => {
      const point = r.point
      const isStart = i === 0
      const isEnd = i === lisse.points.length - 1
      const dureeMs = new Date(r.finArret).getTime() - new Date(point.captured_at).getTime()
      const isArret = lisse.arrets.some(a => a.point === point)
      const dot = L.circleMarker([point.lat, point.lng], {
        radius: isArret ? 8 : isStart || isEnd ? 7 : 4,
        fillColor: isStart ? COULEURS_CARTE.depart : color,
        color: '#fff',
        weight: isStart || isEnd || isArret ? 2 : 1,
        fillOpacity: 1,
      })
      const label = isStart ? 'Départ' : isEnd ? 'Dernière position' : isArret ? 'Arrêt' : `Position ${i + 1}`
      const heure = dureeMs > 60_000
        ? `de ${formatTime(point.captured_at)} à ${formatTime(r.finArret)} (${libelleDuree(dureeMs)})`
        : formatTime(point.captured_at)
      dot.bindTooltip(
        `<b>${label}</b> · ${formatDay(selectedDate.value)}<br>${heure}<br>précision ± ${Math.round(point.accuracy ?? 0)} m · ${r.absorbes} position(s) regroupée(s)`,
        { direction: 'top', offset: [0, -4] },
      )
      dot.bindPopup(el)
      trailGroup.addLayer(dot)
    })
  })

  // Marqueurs de visite PDV : donne le sens métier au trajet (« pourquoi il
  // était là »). Losange bleu = visite dans le rayon de visite, orange = hors du rayon.
  filteredVisits.value
    .filter(v => new Date(v.date_visite).getTime() <= cursor)
    .forEach((visit) => {
      const validated = visit.geofence_validated !== false
      const color = validated ? COULEURS_CARTE.visite : COULEURS_CARTE.horsRayon
      const icon = L.divIcon({
        className: 'trajet-visit-marker',
        html: `<div style="width:16px;height:16px;transform:rotate(45deg);background:${color};border:2px solid #fff"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      })
      const dateLabel = new Date(visit.date_visite).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
      const marker = L.marker([visit.lat, visit.lng], { icon })
        .bindTooltip(
          `<b>${echapperHtml(visit.nom_pdv)}</b><br>Visite le ${dateLabel} à ${formatTime(visit.date_visite)}${validated ? '' : '<br><span class="font-semibold text-amber-800">Hors du rayon de visite</span>'}`,
          { direction: 'top', offset: [0, -6] },
        )
      const pop = document.createElement('div')
      pop.className = 'text-sm'
      pop.innerHTML = `<p class="font-semibold text-slate-900">${echapperHtml(visit.nom_pdv)}</p><p class="text-xs text-slate-600">${dateLabel} · ${formatTime(visit.date_visite)}${validated ? '' : ' · <span class="font-semibold text-amber-800">hors du rayon de visite</span>'}</p>`
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'mt-2 rounded-md bg-fc-red px-2.5 py-1 text-xs font-semibold text-white'
      btn.textContent = 'Ouvrir la visite'
      btn.addEventListener('click', () => void openVisit(visit.visite_id))
      pop.appendChild(btn)
      marker.bindPopup(pop)
      marker.addTo(trailGroup)
    })

  const bounds = trailGroup.getBounds?.()
  if (bounds?.isValid?.()) {
    map.fitBounds(bounds, { padding: [30, 30] })
  }
}

function selectRep(userId: string) {
  selectedUser.value = userId
  resetSearchLayer()
  resetCursor()
  drawTrails()
}

function onScrub() {
  stopPlay()
  drawTrails()
}

function togglePlay() {
  playing.value ? stopPlay() : startPlay()
}

function startPlay() {
  if (!timeRange.value) return
  // Redémarre du début si on est à la fin.
  if (cursorTime.value === null || cursorTime.value >= timeRange.value.max) {
    cursorTime.value = timeRange.value.min
  }
  playing.value = true
  const span = timeRange.value.max - timeRange.value.min
  const step = Math.max(1000, Math.round(span / 60)) // ~60 pas
  playTimer = setInterval(() => {
    if (!timeRange.value || cursorTime.value === null) return stopPlay()
    cursorTime.value = Math.min(timeRange.value.max, cursorTime.value + step)
    drawTrails()
    if (cursorTime.value >= timeRange.value.max) stopPlay()
  }, 250)
}

function stopPlay() {
  playing.value = false
  if (playTimer) {
    clearInterval(playTimer)
    playTimer = null
  }
}

async function initMap() {
  if (!mapContainer.value || !import.meta.client) {
    loading.value = false
    return
  }

  const L = await import('leaflet')
  await import('leaflet/dist/leaflet.css')
  // @ts-ignore
  window.L = L

  map = L.map(mapContainer.value).setView([6.8276, -5.2893], 7) // Côte d'Ivoire center
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map)
  trailGroup = L.featureGroup().addTo(map)
  searchGroup = L.layerGroup().addTo(map)

  try {
    await Promise.all([loadCommerciaux(), loadPdv(), loadActivityDates()])
  }
  catch (err) {
    console.error('Trajets : chargement initial incomplet', err)
  }
  // loadPositions remet loading à false, même en cas d'erreur.
  await loadPositions()
}

onMounted(async () => {
  await nextTick()
  setTimeout(initMap, 100)
})

onUnmounted(() => stopPlay())
</script>
