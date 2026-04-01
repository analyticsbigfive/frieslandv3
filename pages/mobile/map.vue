<template>
  <div class="h-[calc(100vh-120px)] relative">
    <!-- Map -->
    <div id="mobile-map" class="w-full h-full" />

    <!-- Controls overlay -->
    <div class="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
      <!-- Radius filter -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 space-y-2 min-w-[180px]">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-gray-600">Rayon</span>
          <span class="text-xs font-bold text-fc-red">{{ radiusKm }} km</span>
        </div>
        <input
          v-model.number="radius"
          type="range"
          min="200"
          max="10000"
          step="200"
          class="w-full accent-fc-red"
          @change="updateMarkers"
        />
      </div>

      <!-- Legend -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 space-y-1.5">
        <p class="text-[10px] font-medium text-gray-400 uppercase">Légende</p>
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full bg-[#C8102E]" />
          <span class="text-xs text-gray-600">Ma position</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full bg-[#22c55e]" />
          <span class="text-xs text-gray-600">Routing du jour</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full bg-[#3b82f6]" />
          <span class="text-xs text-gray-600">PDV à proximité</span>
        </div>
      </div>
    </div>

    <!-- Stats overlay bottom -->
    <div class="absolute bottom-3 left-3 right-3 z-[1000]">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 flex items-center justify-around">
        <div class="text-center">
          <p class="text-lg font-bold text-fc-red">{{ routingPdvCount }}</p>
          <p class="text-[10px] text-gray-400">Routing</p>
        </div>
        <div class="w-px h-8 bg-gray-200" />
        <div class="text-center">
          <p class="text-lg font-bold text-blue-500">{{ nearbyPdvCount }}</p>
          <p class="text-[10px] text-gray-400">À proximité</p>
        </div>
        <div class="w-px h-8 bg-gray-200" />
        <div class="text-center">
          <p class="text-lg font-bold text-gray-700 dark:text-gray-300">{{ radiusKm }} km</p>
          <p class="text-[10px] text-gray-400">Rayon</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RoutingPDV } from '~/types'

definePageMeta({ middleware: ['auth'], layout: 'mobile' })

const pdvStore = usePDVStore()
const authStore = useAuthStore()
const routingStore = useRoutingStore()
const user = useSupabaseUser()
const { haversineDistance } = useGeofencing()

let map: any = null
let L: any = null
let markersLayer: any = null
let radiusCircle: any = null
let userPosition: { lat: number; lng: number } | null = null

const radius = ref(2000) // default 2km
const radiusKm = computed(() => (radius.value / 1000).toFixed(1))
const routingPdvCount = ref(0)
const nearbyPdvCount = ref(0)

async function updateMarkers() {
  if (!map || !L || !userPosition) return

  // Clear previous markers
  if (markersLayer) markersLayer.clearLayers()
  else markersLayer = L.layerGroup().addTo(map)

  // Update radius circle
  if (radiusCircle) map.removeLayer(radiusCircle)
  radiusCircle = L.circle([userPosition.lat, userPosition.lng], {
    radius: radius.value,
    color: '#C8102E',
    fillColor: '#C8102E',
    fillOpacity: 0.05,
    weight: 1,
    dashArray: '5 5',
  }).addTo(map)

  // Fetch scoped PDVs for nearby display
  const allPDV = await pdvStore.fetchScopedPDV(authStore.profile)
  const allPDVMap = new Map(allPDV.map((p: any) => [p.pdv_id, p]))

  let rCount = 0
  let nCount = 0
  const routingPdvIds = new Set<string>()

  // 1. Routing PDVs — always shown, using embedded pdv data from routingStore
  routingStore.routingPDVList.forEach((rp: any) => {
    // Use embedded pdv join data, fallback to scoped PDV list
    const pdv = rp.pdv || allPDVMap.get(rp.pdv_id)
    if (!pdv || !pdv.geolocation_lat || !pdv.geolocation_lng) return

    routingPdvIds.add(rp.pdv_id)
    rCount++

    const dist = haversineDistance(
      userPosition!.lat, userPosition!.lng,
      pdv.geolocation_lat, pdv.geolocation_lng
    )

    // Marker color based on routing status
    let fillColor = '#22c55e' // green default
    if (rp.status === 'in_progress') fillColor = '#f59e0b'
    else if (rp.status === 'completed') fillColor = '#22c55e'

    const marker = L.circleMarker([pdv.geolocation_lat, pdv.geolocation_lng], {
      radius: 8,
      fillColor,
      color: '#fff',
      weight: 2,
      fillOpacity: 1,
    })

    // Popup
    const pos = rp.position_order || '?'
    const statusLabels: Record<string, string> = { pending: '⏳ En attente', in_progress: '🔄 En cours', completed: '✅ Fait', skipped: '⏭ Passé' }
    let popupContent = `<strong>${pdv.nom_pdv}</strong><br>${pdv.zone || ''}`
    popupContent += `<br><span style="color:#22c55e;font-weight:bold">🗺 Routing #${pos}</span>`
    if (rp.status) popupContent += `<br>${statusLabels[rp.status] || rp.status}`
    popupContent += `<br><small>${Math.round(dist)}m</small>`

    marker.bindPopup(popupContent)
    markersLayer.addLayer(marker)
  })

  // 2. Nearby non-routing PDVs — shown if within radius
  allPDV.forEach((pdv: any) => {
    if (!pdv.geolocation_lat || !pdv.geolocation_lng) return
    if (routingPdvIds.has(pdv.pdv_id)) return // already shown as routing

    const dist = haversineDistance(
      userPosition!.lat, userPosition!.lng,
      pdv.geolocation_lat, pdv.geolocation_lng
    )
    if (dist > radius.value) return

    nCount++

    const marker = L.circleMarker([pdv.geolocation_lat, pdv.geolocation_lng], {
      radius: 6,
      fillColor: '#3b82f6',
      color: '#fff',
      weight: 1,
      fillOpacity: 0.7,
    })

    marker.bindPopup(`<strong>${pdv.nom_pdv}</strong><br>${pdv.zone || ''}<br><small>${Math.round(dist)}m</small>`)
    markersLayer.addLayer(marker)
  })

  routingPdvCount.value = rCount
  nearbyPdvCount.value = nCount
}

onMounted(async () => {
  L = await import('leaflet')
  await import('leaflet/dist/leaflet.css')

  map = L.map('mobile-map').setView([5.345, -4.024], 13)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OSM',
    maxZoom: 19,
  }).addTo(map)

  if (!authStore.profile) await authStore.fetchProfile()

  // Load routing for today
  if (user.value?.id) {
    await routingStore.fetchTodayRouting(user.value.id)
  }

  // Get user position
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        userPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude }

        // User marker
        L.circleMarker([userPosition.lat, userPosition.lng], {
          radius: 10,
          fillColor: '#C8102E',
          color: '#fff',
          weight: 3,
          fillOpacity: 1,
        })
          .bindPopup('<strong>Ma position</strong>')
          .addTo(map)

        map.setView([userPosition.lat, userPosition.lng], 14)
        await updateMarkers()
      },
      async () => {
        // No GPS - show all PDVs without radius filter
        userPosition = { lat: 5.345, lng: -4.024 }
        radius.value = 50000
        await updateMarkers()
      },
      { enableHighAccuracy: true }
    )
  }
})

onUnmounted(() => {
  map?.remove()
})
</script>
