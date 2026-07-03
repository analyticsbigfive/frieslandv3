<template>
  <div class="flex flex-col gap-3 lg:flex-row" style="height: calc(100vh - 180px);">
    <!-- Panneau latéral : commerciaux + KPI + alertes -->
    <aside class="flex w-full shrink-0 flex-col rounded-xl border border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800 lg:w-80">
      <div class="flex items-center justify-between gap-2 border-b border-gray-100 p-3 dark:border-gray-700">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Commerciaux</h3>
        <UInput v-model="selectedDate" type="date" size="xs" class="w-32" @update:model-value="loadPositions" />
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

      <ClientOnly>
        <div ref="mapContainer" class="w-full flex-1" />
      </ClientOnly>

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
const allPoints = ref<TrajetPoint[]>([])
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

let map: any = null
let trailGroup: any = null
let searchGroup: any = null

const PALETTE = ['#0F172A', '#003DA5', '#0E9F6E', '#7C3AED', '#D97706', '#DB2777', '#0891B2', '#4D7C0F']
const LIVE_WINDOW_MS = 15 * 60_000
const STALE_MS = 30 * 60_000

const isToday = computed(() => selectedDate.value === new Date().toISOString().slice(0, 10))

const filteredPoints = computed(() => {
  if (!selectedUser.value) return allPoints.value
  return allPoints.value.filter(p => p.user_id === selectedUser.value)
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

    if (points.length === 0) {
      if (isToday.value) {
        alerts.push({ kind: 'no-tournee', label: 'Pas de tournée', icon: 'i-heroicons-no-symbol', class: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300' })
      }
      return { userId: profile.id, nom, pointCount: 0, km: 0, durationLabel: '—', visitCount: visitCountByUser.value[profile.id] ?? 0, lastAtMs: null, statusLabel: isToday.value ? 'inactif' : '—', live: false, alerts }
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
      visitCount: visitCountByUser.value[profile.id] ?? 0,
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

const searchUserOptions = computed(() =>
  commerciaux.value.map(c => ({ value: c.id, label: c.nom || c.email || c.id.slice(0, 8) })),
)

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

async function loadPositions() {
  loading.value = true
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
        .select('user_id')
        .gte('date_visite', dayStart).lt('date_visite', dayEnd)
        .limit(10000),
    ])

    if (posRes.error) throw posRes.error
    allPoints.value = (posRes.data ?? []) as unknown as TrajetPoint[]

    const counts: Record<string, number> = {}
    for (const row of (visitRes.data ?? []) as { user_id: string }[]) {
      if (row.user_id) counts[row.user_id] = (counts[row.user_id] ?? 0) + 1
    }
    visitCountByUser.value = counts
  }
  catch (err) {
    console.error('Erreur chargement positions:', err)
    allPoints.value = []
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

  const target = new Date(`${selectedDate.value}T${searchTime.value}:00`).getTime()
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
    radius: 9, fillColor: '#0F172A', color: '#fff', weight: 3, fillOpacity: 1,
  }).bindPopup(
    `<b>${nearest.profiles?.nom || 'Commercial'}</b><br>Position à ${formatTime(nearest.captured_at)}<br>${nearest.lat.toFixed(5)}, ${nearest.lng.toFixed(5)}`,
  )
  searchGroup.addLayer(posMarker)
  searchGroup.addLayer(L.circle([nearest.lat, nearest.lng], {
    radius: searchRadius.value, color: '#0F172A', weight: 1, fillOpacity: 0.06,
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

function clearSearch() {
  searchGroup?.clearLayers()
  searchInfo.value = ''
  searchFound.value = false
  searchUser.value = ''
  searchTime.value = ''
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

  const bounds = trailGroup.getBounds?.()
  if (bounds?.isValid?.()) {
    map.fitBounds(bounds, { padding: [30, 30] })
  }
}

function selectRep(userId: string) {
  selectedUser.value = userId
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

  await Promise.all([loadCommerciaux(), loadPdv()])
  await loadPositions()
}

onMounted(async () => {
  await nextTick()
  setTimeout(initMap, 100)
})

onUnmounted(() => stopPlay())
</script>
