<template>
  <div>
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden" style="height: calc(100vh - 180px);">
      <div class="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Carte des Points de Vente</h3>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-400">{{ markers.length }} PDV</span>
          <USelectMenu
            v-model="selectedZone"
            :options="zoneOptions"
            placeholder="Filtrer par zone"
            size="xs"
            class="w-40"
            @update:model-value="filterMarkers"
          />
        </div>
      </div>

      <ClientOnly>
        <div ref="mapContainer" class="w-full h-full" />
      </ClientOnly>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PDV } from '~/types'

definePageMeta({
  middleware: ['auth', 'admin'],
  layout: 'admin',
})

const pdvStore = usePDVStore()

const mapContainer = ref<HTMLElement | null>(null)
const allPDV = ref<PDV[]>([])
const selectedZone = ref('')
let map: any = null
let markerGroup: any = null

const markers = computed(() => {
  let list = allPDV.value.filter(p => p.geolocation_lat && p.geolocation_lng)
  if (selectedZone.value) {
    list = list.filter(p => p.zone === selectedZone.value)
  }
  return list
})

const zoneOptions = computed(() => {
  const zones = [...new Set(allPDV.value.map(p => p.zone).filter(Boolean))]
  return ['Toutes les zones', ...zones]
})

function filterMarkers() {
  if (!map || !markerGroup) return
  markerGroup.clearLayers()
  addMarkers()
}

function addMarkers() {
  if (!map || !markerGroup) return

  // @ts-ignore
  const L = window.L
  if (!L) return

  markers.value.forEach((pdv) => {
    const marker = L.circleMarker([pdv.geolocation_lat, pdv.geolocation_lng], {
      radius: 6,
      fillColor: '#003DA5',
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8,
    })

    marker.bindPopup(`
      <div class="text-sm">
        <p class="font-bold">${pdv.nom_pdv}</p>
        <p class="text-gray-500 dark:text-gray-400">${pdv.zone || ''} - ${pdv.secteur || ''}</p>
        <p class="text-gray-400 text-xs">${pdv.canal} / ${pdv.sous_categorie_pdv || ''}</p>
        <p class="text-gray-400 text-xs mt-1">${pdv.geolocation_lat?.toFixed(4)}, ${pdv.geolocation_lng?.toFixed(4)}</p>
      </div>
    `)

    markerGroup.addLayer(marker)
  })

  if (markers.value.length > 0) {
    const bounds = markerGroup.getBounds()
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [30, 30] })
    }
  }
}

async function initMap() {
  if (!mapContainer.value || !import.meta.client) return

  // Dynamic import of Leaflet
  const L = await import('leaflet')
  await import('leaflet/dist/leaflet.css')

  // @ts-ignore
  window.L = L

  map = L.map(mapContainer.value).setView([6.8276, -5.2893], 7) // Côte d'Ivoire center

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map)

  markerGroup = L.layerGroup().addTo(map)

  // Load PDV
  allPDV.value = await pdvStore.fetchAllPDV()
  addMarkers()
}

onMounted(async () => {
  await nextTick()
  setTimeout(initMap, 100)
})
</script>
