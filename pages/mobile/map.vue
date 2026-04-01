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

  // Get all PDVs and today's routing PDVs
  const allPDV = await pdvStore.fetchScopedPDV(authStore.profile)

  // Routing PDV IDs
  const routingPdvIds = new Set(
    routingStore.routingPDVList.map(rp => rp.pdv_id)
  )

  let rCount = 0
  let nCount = 0

  allPDV.forEach((pdv: any) => {
    if (!pdv.geolocation_lat || !pdv.geolocation_lng) return

    const dist = haversineDistance(
      userPosition!.lat, userPosition!.lng,
      pdv.geolocation_lat, pdv.geolocation_lng
    )

    const isRouting = routingPdvIds.has(pdv.pdv_id)
    const isNearby = dist <= radius.value

    // Show: routing PDVs always, others only if nearby
    if (!isRouting && !isNearby) return

    if (isRouting) rCount++
    else nCount++

    const routingPdvItem = routingStore.routingPDVList.find(rp => rp.pdv_id === pdv.pdv_id)
    const routingStatus = routingPdvItem?.status || ''

    // Marker color
    let fillColor = '#3b82f6' // blue for nearby
    let markerRadius = 6
    if (isRouting) {
      fillColor = routingStatus === 'completed' ? '#22c55e' : routingStatus === 'in_progress' ? '#f59e0b' : '#22c55e'
      markerRadius = 8
    }

    const marker = L.circleMarker([pdv.geolocation_lat, pdv.geolocation_lng], {
      radius: markerRadius,
      fillColor,
      color: '#fff',
      weight: isRouting ? 2 : 1,
      fillOpacity: isRouting ? 1 : 0.7,
    })

    // Popup
    let popupContent = `<strong>${pdv.nom_pdv}</strong><br>${pdv.zone || ''}`
    if (isRouting) {
      const pos = routingPdvItem?.position_order || '?'
      popupContent += `<br><span style="color:#22c55e;font-weight:bold">🗺 Routing #${pos}</span>`
      if (routingStatus) {
        const labels: Record<string, string> = { pending: '⏳ En attente', in_progress: '🔄 En cours', completed: '✅ Fait', skipped: '⏭ Passé' }
        popupContent += `<br>${labels[routingStatus] || routingStatus}`
      }
    }
    popupContent += `<br><small>${Math.round(dist)}m</small>`

    marker.bindPopup(popupContent)
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
