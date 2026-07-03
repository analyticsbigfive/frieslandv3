<template>
  <section v-if="isNative" class="mobile-card mt-3 overflow-hidden" aria-label="Carte de ma tournée">
    <div class="flex items-center justify-between px-4 pt-3">
      <p class="text-xs uppercase tracking-wide text-gray-400">Mon trajet du jour</p>
      <NuxtLink to="/mobile/map" class="text-xs font-medium text-fc-red">Agrandir</NuxtLink>
    </div>
    <ClientOnly>
      <div ref="mapEl" class="mt-2 h-44 w-full" />
    </ClientOnly>
    <p v-if="empty" class="px-4 pb-3 pt-1 text-xs text-gray-400">
      Aucun point encore — le trajet s'affiche dès les premiers relevés.
    </p>
  </section>
</template>

<script setup lang="ts">
import { Capacitor } from '@capacitor/core'

const isNative = import.meta.client && Capacitor.isNativePlatform()

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const tournee = useTournee()

const mapEl = ref<HTMLElement | null>(null)
const empty = ref(false)
let map: any = null
let trailLayer: any = null
let refreshTimer: ReturnType<typeof setInterval> | null = null

async function loadTrail() {
  if (!map || !user.value?.id) return

  // @ts-ignore
  const L = window.L
  if (!L) return

  const dayStart = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('position_tournee')
    .select('lat, lng, captured_at')
    .eq('user_id', user.value.id)
    .gte('captured_at', `${dayStart}T00:00:00Z`)
    .order('captured_at', { ascending: true })
    .limit(2000)

  const points = data ?? []
  empty.value = points.length === 0

  trailLayer.clearLayers()
  if (points.length === 0) return

  const latlngs = points.map((p: any) => [p.lat, p.lng])
  if (latlngs.length > 1) {
    trailLayer.addLayer(L.polyline(latlngs, { color: '#C8102E', weight: 4, opacity: 0.85 }))
  }

  const last = points[points.length - 1]
  trailLayer.addLayer(L.circleMarker([last.lat, last.lng], {
    radius: 6, fillColor: '#C8102E', color: '#fff', weight: 2, fillOpacity: 1,
  }))

  const bounds = trailLayer.getBounds?.()
  if (bounds?.isValid?.()) {
    map.fitBounds(bounds, { padding: [20, 20], maxZoom: 16 })
  }
  else {
    map.setView([last.lat, last.lng], 15)
  }
}

async function initMap() {
  if (!mapEl.value || !isNative) return

  const L = await import('leaflet')
  await import('leaflet/dist/leaflet.css')
  // @ts-ignore
  window.L = L

  map = L.map(mapEl.value, { zoomControl: false, attributionControl: false })
    .setView([5.345, -4.024], 12) // Abidjan par défaut
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)
  trailLayer = L.layerGroup().addTo(map)

  await loadTrail()
  // Rafraîchit tant que la tournée est active.
  refreshTimer = setInterval(() => {
    if (tournee.isTracking.value) void loadTrail()
  }, 60_000)
}

onMounted(async () => {
  await nextTick()
  setTimeout(initMap, 150)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
  if (map) map.remove()
})
</script>
