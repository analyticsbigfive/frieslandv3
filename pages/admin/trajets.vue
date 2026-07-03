<template>
  <div>
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden" style="height: calc(100vh - 180px);">
      <div class="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Contrôle commerciaux — déplacements</h3>
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs text-gray-400">
            {{ tournees.length }} tournée(s) · {{ filteredPoints.length }} point(s)
          </span>
          <UInput
            v-model="selectedDate"
            type="date"
            size="xs"
            class="w-36"
            @update:model-value="loadPositions"
          />
          <USelectMenu
            v-model="selectedUser"
            :options="userOptions"
            value-attribute="value"
            option-attribute="label"
            placeholder="Tous les commerciaux"
            size="xs"
            class="w-48"
          />
        </div>
      </div>

      <div v-if="loading" class="flex items-center justify-center h-24 text-sm text-gray-400">
        Chargement des positions…
      </div>
      <div v-else-if="allPoints.length === 0" class="flex items-center justify-center h-24 text-sm text-gray-400">
        Aucune position enregistrée pour cette date.
      </div>

      <ClientOnly>
        <div ref="mapContainer" class="w-full h-full" />
      </ClientOnly>
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

const supabase = useSupabaseClient()

const mapContainer = ref<HTMLElement | null>(null)
const allPoints = ref<TrajetPoint[]>([])
const selectedDate = ref(new Date().toISOString().slice(0, 10))
const selectedUser = ref('')
const loading = ref(false)

let map: any = null
let trailGroup: any = null

// Une couleur stable par tournée (palette cyclique).
const PALETTE = ['#C8102E', '#003DA5', '#0E9F6E', '#7C3AED', '#D97706', '#DB2777', '#0891B2', '#4D7C0F']

const filteredPoints = computed(() => {
  if (!selectedUser.value) return allPoints.value
  return allPoints.value.filter(p => p.user_id === selectedUser.value)
})

const tournees = computed(() => {
  const map = new Map<string, TrajetPoint[]>()
  for (const point of filteredPoints.value) {
    const list = map.get(point.tournee_id) ?? []
    list.push(point)
    map.set(point.tournee_id, list)
  }
  return [...map.entries()].map(([tourneeId, points]) => ({ tourneeId, points }))
})

const userOptions = computed(() => {
  const seen = new Map<string, string>()
  for (const point of allPoints.value) {
    if (!seen.has(point.user_id)) {
      seen.set(point.user_id, point.profiles?.nom || point.profiles?.email || point.user_id.slice(0, 8))
    }
  }
  return [
    { label: 'Tous les commerciaux', value: '' },
    ...[...seen.entries()].map(([value, label]) => ({ label, value })),
  ]
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

async function loadPositions() {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('position_tournee')
      .select('id, user_id, tournee_id, lat, lng, accuracy, captured_at, profiles(nom, email)')
      .gte('captured_at', `${selectedDate.value}T00:00:00Z`)
      .lt('captured_at', `${selectedDate.value}T23:59:59.999Z`)
      .order('captured_at', { ascending: true })
      .limit(10000)

    if (error) throw error
    allPoints.value = (data ?? []) as unknown as TrajetPoint[]
  }
  catch (err) {
    console.error('Erreur chargement positions:', err)
    allPoints.value = []
  }
  finally {
    loading.value = false
    drawTrails()
  }
}

function drawTrails() {
  if (!map || !trailGroup) return

  // @ts-ignore
  const L = window.L
  if (!L) return

  trailGroup.clearLayers()

  tournees.value.forEach(({ points }, index) => {
    if (points.length === 0) return

    const color = PALETTE[index % PALETTE.length]
    const latlngs = points.map(p => [p.lat, p.lng])
    const first = points[0]
    const last = points[points.length - 1]

    let distance = 0
    for (let i = 1; i < points.length; i++) {
      distance += haversine(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng)
    }

    const el = document.createElement('div')
    el.className = 'text-sm'
    const nameP = document.createElement('p')
    nameP.className = 'font-bold'
    nameP.textContent = first.profiles?.nom || first.profiles?.email || 'Commercial'
    el.appendChild(nameP)
    const infoP = document.createElement('p')
    infoP.className = 'text-gray-500 text-xs'
    infoP.textContent = `${formatTime(first.captured_at)} → ${formatTime(last.captured_at)} · ${points.length} points · ${(distance / 1000).toFixed(1)} km`
    el.appendChild(infoP)

    if (points.length > 1) {
      const line = L.polyline(latlngs, { color, weight: 3, opacity: 0.85 })
      line.bindPopup(el)
      trailGroup.addLayer(line)
    }

    // Départ (vert) et arrivée (couleur de la tournée).
    const startMarker = L.circleMarker([first.lat, first.lng], {
      radius: 7, fillColor: '#0E9F6E', color: '#fff', weight: 2, fillOpacity: 1,
    }).bindPopup(el)
    trailGroup.addLayer(startMarker)

    const endMarker = L.circleMarker([last.lat, last.lng], {
      radius: 7, fillColor: color, color: '#fff', weight: 2, fillOpacity: 1,
    }).bindPopup(el)
    trailGroup.addLayer(endMarker)
  })

  const bounds = trailGroup.getBounds?.()
  if (bounds?.isValid?.()) {
    map.fitBounds(bounds, { padding: [30, 30] })
  }
}

watch(selectedUser, () => drawTrails())

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

  await loadPositions()
}

onMounted(async () => {
  await nextTick()
  setTimeout(initMap, 100)
})
</script>
