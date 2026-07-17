<template>
  <div class="flex flex-col gap-3 lg:flex-row" style="height: calc(100vh - 180px);">
    <!-- Panneau latéral : commerciaux + KPI + alertes -->
    <aside class="flex w-full shrink-0 flex-col rounded-xl border border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800 lg:w-80">
      <div class="flex items-center justify-between gap-2 border-b border-gray-100 p-3 dark:border-gray-700">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Commerciaux</h3>
        <UInput v-model="selectedDate" type="date" size="xs" class="w-32" @update:model-value="loadPositions" />
      </div>

      <!-- Jours réellement tracés : évite de chercher une tournée un jour sans données. -->
      <div v-if="activityDates.length" class="border-b border-gray-100 p-3 dark:border-gray-700">
        <p class="mb-1.5 text-[11px] text-gray-400">
          {{ selectedUser ? 'Jours tracés pour ce commercial' : 'Jours tracés (30 derniers jours)' }}
        </p>
        <div class="flex flex-wrap gap-1">
          <button
            v-for="day in activityDates"
            :key="day.date"
            class="rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors"
            :class="day.date === selectedDate
              ? 'bg-fc-red text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'"
            @click="goToDate(day.date)"
          >
            {{ day.label }}
          </button>
        </div>
      </div>

      <div v-if="loading" class="p-4 text-sm text-gray-400">Chargement…</div>
      <ul v-else class="flex-1 divide-y divide-gray-100 overflow-auto dark:divide-gray-700">
        <li
          v-for="rep in reps"
          :key="rep.userId"
          class="cursor-pointer p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
          :class="{ 'bg-red-50 dark:bg-red-900/20': selectedUser === rep.userId }"
          @click="selectRep(rep.userId)"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="flex min-w-0 items-center gap-2">
              <span class="h-2.5 w-2.5 shrink-0 rounded-full" :class="statusDotClass(rep)" />
              <span class="truncate text-sm font-medium text-gray-800 dark:text-gray-100">{{ rep.nom }}</span>
            </div>
            <span class="shrink-0 text-[11px] text-gray-400">{{ rep.statusLabel }}</span>
          </div>

          <div v-if="rep.pointCount > 0" class="mt-1.5 grid grid-cols-3 gap-1 text-center">
            <div><p class="text-sm font-semibold text-gray-800 dark:text-gray-100">{{ rep.km.toFixed(1) }}</p><p class="text-[10px] text-gray-400">km</p></div>
            <div><p class="text-sm font-semibold text-gray-800 dark:text-gray-100">{{ rep.durationLabel }}</p><p class="text-[10px] text-gray-400">durée</p></div>
            <div><p class="text-sm font-semibold text-gray-800 dark:text-gray-100">{{ rep.visitCount }}</p><p class="text-[10px] text-gray-400">PDV</p></div>
          </div>

          <div v-if="rep.alerts.length" class="mt-1.5 flex flex-wrap gap-1">
            <span
              v-for="alert in rep.alerts"
              :key="alert.kind"
              class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
              :class="alert.class"
            >
              <UIcon :name="alert.icon" class="h-3 w-3" />{{ alert.label }}
            </span>
          </div>
        </li>
        <li v-if="reps.length === 0" class="p-4 text-sm text-gray-400">Aucun commercial actif.</li>
      </ul>
    </aside>

    <!-- Carte + rejeu -->
    <div class="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 p-3 dark:border-gray-700">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Suivi commerciaux — déplacements</h3>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-400">{{ tournees.length }} tournée(s) · {{ filteredPoints.length }} pt</span>
          <UButton v-if="selectedUser" size="2xs" variant="ghost" icon="i-heroicons-x-mark" @click="selectRep('')">Tous</UButton>
        </div>
      </div>

      <!-- Recherche position à une heure donnée -->
      <div class="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800/50">
        <UIcon name="i-heroicons-magnifying-glass" class="h-4 w-4 text-gray-400" />
        <USelectMenu
          v-model="searchUser"
          :options="searchUserOptions"
          value-attribute="value"
          option-attribute="label"
          placeholder="Commercial"
          size="xs"
          class="w-44"
        />
        <UInput v-model="searchTime" type="time" size="xs" class="w-28" />
        <USelect
          v-model.number="searchRadius"
          :options="radiusOptions"
          value-attribute="value"
          option-attribute="label"
          size="xs"
          class="w-28"
        />
        <UButton size="xs" color="red" icon="i-heroicons-map-pin" :disabled="!searchUser || !searchTime" @click="locateAtTime">
          Localiser
        </UButton>
        <UButton v-if="searchInfo" size="xs" variant="ghost" icon="i-heroicons-x-mark" @click="clearSearch">Effacer</UButton>
        <span v-if="searchInfo" class="text-xs" :class="searchFound ? 'text-gray-600 dark:text-gray-300' : 'text-amber-600'">{{ searchInfo }}</span>
      </div>

      <!-- Fiche journée du commercial sélectionné -->
      <div v-if="dayFiche" class="flex flex-wrap items-stretch gap-2 border-b border-gray-100 p-2 dark:border-gray-700">
        <div class="flex flex-col justify-center pr-2">
          <span class="text-sm font-semibold text-gray-800 dark:text-gray-100">{{ dayFiche.nom }}</span>
          <span class="text-[11px] text-gray-400">{{ formatDay(selectedDate) }}</span>
        </div>
        <div v-if="dayFiche.noGps" class="flex items-center gap-1.5 rounded-lg bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700 dark:bg-orange-900/20 dark:text-orange-300">
          <UIcon name="i-heroicons-signal-slash" class="h-4 w-4" />Suivi GPS non démarré ce jour
        </div>
        <template v-else>
          <div class="rounded-lg bg-gray-50 px-2.5 py-1 text-center dark:bg-gray-700/50">
            <p class="text-sm font-semibold tabular-nums text-gray-800 dark:text-gray-100">{{ dayFiche.firstLabel }} → {{ dayFiche.lastLabel }}</p>
            <p class="text-[10px] text-gray-400">amplitude</p>
          </div>
          <div class="rounded-lg bg-gray-50 px-2.5 py-1 text-center dark:bg-gray-700/50">
            <p class="text-sm font-semibold tabular-nums text-gray-800 dark:text-gray-100">{{ dayFiche.durationLabel }}</p>
            <p class="text-[10px] text-gray-400">terrain</p>
          </div>
          <div class="rounded-lg bg-gray-50 px-2.5 py-1 text-center dark:bg-gray-700/50">
            <p class="text-sm font-semibold tabular-nums text-gray-800 dark:text-gray-100">{{ dayFiche.km }} km</p>
            <p class="text-[10px] text-gray-400">distance</p>
          </div>
        </template>
        <div class="rounded-lg bg-blue-50 px-2.5 py-1 text-center dark:bg-blue-900/20">
          <p class="text-sm font-semibold tabular-nums text-blue-700 dark:text-blue-300">{{ dayFiche.validated }}<span v-if="dayFiche.offGeofence" class="text-amber-600 dark:text-amber-400">+{{ dayFiche.offGeofence }}</span> / {{ dayFiche.visitCount }}</p>
          <p class="text-[10px] text-gray-400">visites{{ dayFiche.offGeofence ? ' · hors géof.' : '' }}</p>
        </div>
      </div>

      <div class="relative min-h-0 flex-1">
        <ClientOnly>
          <div ref="mapContainer" class="h-full w-full" />
        </ClientOnly>

        <!-- Légende : rend la carte lisible sans deviner les codes couleur. -->
        <div
          v-if="!emptyState"
          class="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-lg border border-gray-200 bg-white/90 px-2.5 py-2 text-[11px] shadow backdrop-blur dark:border-gray-600 dark:bg-gray-800/90"
        >
          <div class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full" style="background:#0E9F6E" />Départ</div>
          <div class="mt-1 flex items-center gap-1.5"><span class="h-0.5 w-3.5" style="background:#C8102E" />Trajet GPS</div>
          <div class="mt-1 flex items-center gap-1.5"><span class="h-2.5 w-2.5" style="background:#003DA5;transform:rotate(45deg)" />Visite PDV</div>
          <div class="mt-1 flex items-center gap-1.5"><span class="h-2.5 w-2.5" style="background:#D97706;transform:rotate(45deg)" />Visite hors géofence</div>
        </div>

        <!-- Navigation jour précédent / suivant + pagination des jours tracés. -->
        <div
          v-if="activityDays.length"
          class="absolute bottom-3 left-1/2 z-[500] flex -translate-x-1/2 items-center gap-1 rounded-full border border-gray-200 bg-white/95 p-1 shadow-lg backdrop-blur dark:border-gray-600 dark:bg-gray-800/95"
        >
          <UButton
            icon="i-heroicons-chevron-left"
            size="xs"
            color="gray"
            variant="ghost"
            :disabled="!hasPrevDay"
            aria-label="Jour précédent"
            @click="stepDay(-1)"
          />
          <div class="min-w-[104px] px-1 text-center">
            <p class="text-xs font-semibold tabular-nums text-gray-800 dark:text-gray-100">{{ formatDay(selectedDate) }}</p>
            <p class="text-[10px] text-gray-400">
              <template v-if="activityIndex >= 0">jour {{ activityDays.length - activityIndex }} / {{ activityDays.length }}</template>
              <template v-else>hors jours tracés</template>
            </p>
          </div>
          <UButton
            icon="i-heroicons-chevron-right"
            size="xs"
            color="gray"
            variant="ghost"
            :disabled="!hasNextDay"
            aria-label="Jour suivant"
            @click="stepDay(1)"
          />
        </div>

        <!-- Sans données, la carte reste figée sur la vue précédente : on le dit explicitement. -->
        <div
          v-if="emptyState"
          class="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center p-4"
        >
          <div class="pointer-events-auto max-w-sm rounded-xl border border-gray-200 bg-white/95 p-4 text-center shadow-lg backdrop-blur dark:border-gray-600 dark:bg-gray-800/95">
            <UIcon :name="emptyState.icon" class="mx-auto h-8 w-8 text-gray-300 dark:text-gray-500" />
            <p class="mt-2 text-sm font-semibold text-gray-700 dark:text-gray-200">{{ emptyState.title }}</p>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ emptyState.detail }}</p>
            <UButton
              v-if="emptyState.suggestDate"
              size="xs"
              color="red"
              variant="soft"
              class="mt-3"
              @click="goToDate(emptyState.suggestDate)"
            >
              Voir le {{ formatDay(emptyState.suggestDate) }}
            </UButton>
          </div>
        </div>
      </div>

      <!-- Barre de rejeu temporel -->
      <div v-if="timeRange" class="flex items-center gap-3 border-t border-gray-100 p-3 dark:border-gray-700">
        <UButton :icon="playing ? 'i-heroicons-pause' : 'i-heroicons-play'" size="xs" color="red" variant="soft" @click="togglePlay" />
        <input
          v-model.number="cursorTime"
          type="range"
          :min="timeRange.min"
          :max="timeRange.max"
          step="1000"
          class="flex-1 accent-fc-red"
          @input="onScrub"
        >
        <span class="w-14 shrink-0 text-right text-xs tabular-nums text-gray-500">{{ cursorLabel }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
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
const loading = ref(false)

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

const PALETTE = ['#C8102E', '#003DA5', '#0E9F6E', '#7C3AED', '#D97706', '#DB2777', '#0891B2', '#4D7C0F']
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

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLng = (lng2 - lng1) * (Math.PI / 180)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function trailDistance(points: TrajetPoint[]): number {
  let d = 0
  for (let i = 1; i < points.length; i++) {
    d += haversine(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng)
  }
  return d
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
    const nom = profile.nom || profile.email || profile.id.slice(0, 8)
    const alerts: RepSummary['alerts'] = []

    const visitCount = visitCountByUser.value[profile.id] ?? 0

    if (points.length === 0) {
      // Visites saisies mais zéro point GPS = suivi jamais démarré sur le
      // téléphone (permission « toujours » refusée), pas une absence terrain.
      if (visitCount > 0) {
        alerts.push({ kind: 'no-gps', label: 'GPS non démarré', icon: 'i-heroicons-signal-slash', class: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' })
      }
      else if (isToday.value) {
        alerts.push({ kind: 'no-tournee', label: 'Pas de tournée', icon: 'i-heroicons-no-symbol', class: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300' })
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
      alerts.push({ kind: 'immobile', label: 'Immobile', icon: 'i-heroicons-pause-circle', class: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' })
    }
    if (isToday.value && !live && Date.now() - lastAtMs > STALE_MS) {
      alerts.push({ kind: 'stale', label: 'Sans signal', icon: 'i-heroicons-signal-slash', class: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' })
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
  commerciaux.value.map(c => ({ value: c.id, label: c.nom || c.email || c.id.slice(0, 8) })),
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
  return rep?.nom || rep?.email || 'ce commercial'
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
        ? `Rien d'enregistré le ${formatDay(selectedDate.value)}. Jours tracés : ${days.map(d => d.label).join(', ')}.`
        : `Aucun point GPS sur les 30 derniers jours — le suivi de tournée n'a probablement jamais démarré sur son téléphone.`,
      suggestDate,
    }
  }

  return {
    icon: 'i-heroicons-signal-slash',
    title: 'Aucune tournée ce jour',
    detail: days.length
      ? `Aucun point GPS le ${formatDay(selectedDate.value)}. Jours tracés : ${days.map(d => d.label).join(', ')}.`
      : 'Aucun point GPS sur les 30 derniers jours.',
    suggestDate,
  }
})

function statusDotClass(rep: RepSummary): string {
  if (rep.live) return 'bg-emerald-500 animate-pulse'
  if (rep.pointCount > 0) return 'bg-gray-400'
  return 'bg-gray-200 dark:bg-gray-600'
}

function statusColorForUser(userId: string): string {
  // Couleur stable indépendante du filtre (index dans la liste commerciaux).
  const idx = commerciaux.value.findIndex(c => c.id === userId)
  return PALETTE[(idx < 0 ? 0 : idx) % PALETTE.length]
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
        .select('user_id, pdv_id, date_visite, geolocation_lat, geolocation_lng, geofence_validated')
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
          user_id: row.user_id,
          pdv_id: row.pdv_id,
          nom_pdv: pdvNameById.get(row.pdv_id) || row.pdv_id || 'PDV',
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
    searchInfo.value = 'Aucune position ce jour pour ce commercial.'
    return
  }

  const nearest = userPoints.reduce((best, p) =>
    Math.abs(p.t - target) < Math.abs(best.t - target) ? p : best,
  )
  const gapMin = Math.round(Math.abs(nearest.t - target) / 60000)

  // Marqueur position + cercle de rayon.
  const posMarker = L.circleMarker([nearest.lat, nearest.lng], {
    radius: 9, fillColor: '#C8102E', color: '#fff', weight: 3, fillOpacity: 1,
  }).bindPopup(
    `<b>${nearest.profiles?.nom || 'Commercial'}</b><br>Position à ${formatTime(nearest.captured_at)}<br>${nearest.lat.toFixed(5)}, ${nearest.lng.toFixed(5)}`,
  )
  searchGroup.addLayer(posMarker)
  searchGroup.addLayer(L.circle([nearest.lat, nearest.lng], {
    radius: searchRadius.value, color: '#C8102E', weight: 1, fillOpacity: 0.06,
  }))

  // PDV dans le rayon.
  let nearby = 0
  for (const pdv of allPdv.value) {
    const d = haversine(nearest.lat, nearest.lng, pdv.lat, pdv.lng)
    if (d <= searchRadius.value) {
      nearby++
      searchGroup.addLayer(
        L.circleMarker([pdv.lat, pdv.lng], {
          radius: 5, fillColor: '#003DA5', color: '#fff', weight: 1, fillOpacity: 0.9,
        }).bindTooltip(`${pdv.nom_pdv} · ${Math.round(d)} m`, { direction: 'top' }),
      )
    }
  }

  searchFound.value = true
  searchInfo.value = `Position à ${formatTime(nearest.captured_at)} (±${gapMin} min) · ${nearby} PDV à ≤ ${searchRadius.value >= 1000 ? searchRadius.value / 1000 + ' km' : searchRadius.value + ' m'}`

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
    const latlngs = points.map(p => [p.lat, p.lng])
    const first = points[0]
    const last = points[points.length - 1]
    const distance = trailDistance(points)

    const el = document.createElement('div')
    el.className = 'text-sm'
    const nameP = document.createElement('p')
    nameP.className = 'font-bold'
    nameP.textContent = first.profiles?.nom || first.profiles?.email || 'Commercial'
    el.appendChild(nameP)
    const infoP = document.createElement('p')
    infoP.className = 'text-gray-500 text-xs'
    infoP.textContent = `${formatTime(first.captured_at)} → ${formatTime(last.captured_at)} · ${points.length} pts · ${(distance / 1000).toFixed(1)} km`
    el.appendChild(infoP)

    if (points.length > 1) {
      const line = L.polyline(latlngs, { color, weight: 3, opacity: 0.85 })
      line.bindPopup(el)
      trailGroup.addLayer(line)
    }

    points.forEach((point, i) => {
      const isStart = i === 0
      const isEnd = i === points.length - 1
      const dot = L.circleMarker([point.lat, point.lng], {
        radius: isStart || isEnd ? 7 : 4,
        fillColor: isStart ? '#0E9F6E' : color,
        color: '#fff',
        weight: isStart || isEnd ? 2 : 1,
        fillOpacity: 1,
      })
      const label = isStart ? 'Départ' : isEnd ? 'Position' : `Point ${i + 1}`
      dot.bindTooltip(
        `${label} · ${formatTime(point.captured_at)}<br>${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`,
        { direction: 'top', offset: [0, -4] },
      )
      dot.bindPopup(el)
      trailGroup.addLayer(dot)
    })
  })

  // Marqueurs de visite PDV : donne le sens métier au trajet (« pourquoi il
  // était là »). Étoile = visite validée par géofence, sinon losange ambre.
  filteredVisits.value
    .filter(v => new Date(v.date_visite).getTime() <= cursor)
    .forEach((visit) => {
      const validated = visit.geofence_validated !== false
      const color = validated ? '#003DA5' : '#D97706'
      const icon = L.divIcon({
        className: 'trajet-visit-marker',
        html: `<div style="width:16px;height:16px;border-radius:4px;transform:rotate(45deg);background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      })
      L.marker([visit.lat, visit.lng], { icon })
        .bindTooltip(
          `<b>${visit.nom_pdv}</b><br>Visite à ${formatTime(visit.date_visite)}${validated ? '' : '<br><span style="color:#D97706">hors géofence</span>'}`,
          { direction: 'top', offset: [0, -6] },
        )
        .addTo(trailGroup)
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
  if (!mapContainer.value || !import.meta.client) return

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

  await Promise.all([loadCommerciaux(), loadPdv(), loadActivityDates()])
  await loadPositions()
}

onMounted(async () => {
  await nextTick()
  setTimeout(initMap, 100)
})

onUnmounted(() => stopPlay())
</script>
