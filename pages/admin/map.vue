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

    <!-- Photo modal triggered from map popups -->
    <PDVPhotoModal
      v-if="selectedPdvForPhoto"
      ref="mapPhotoModal"
      :pdv-id="selectedPdvForPhoto.pdv_id"
      :image-url="selectedPdvForPhoto.image_url"
      :pdv-name="selectedPdvForPhoto.nom_pdv"
    />
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
const selectedPdvForPhoto = ref<PDV | null>(null)
const mapPhotoModal = ref<any>(null)
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

function isSafeImageUrl(u: unknown): u is string {
  if (typeof u !== 'string') return false
  try {
    const url = new URL(u)
    return url.protocol === 'https:' && url.hostname === 'iirgolfjwdnnesamzcbd.supabase.co'
  } catch {
    return false
  }
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

    const el = document.createElement('div')
    el.className = 'text-sm'

    const nameP = document.createElement('p')
    nameP.className = 'font-bold'
    nameP.textContent = pdv.nom_pdv
    el.appendChild(nameP)

    const zoneP = document.createElement('p')
    zoneP.className = 'text-gray-500'
    zoneP.textContent = `${pdv.zone || ''} - ${pdv.quartier || ''}`
    el.appendChild(zoneP)

    const canalP = document.createElement('p')
    canalP.className = 'text-gray-400 text-xs'
    canalP.textContent = `${pdv.canal} / ${pdv.sous_categorie_pdv || ''}`
    el.appendChild(canalP)

    const coordP = document.createElement('p')
    coordP.className = 'text-gray-400 text-xs mt-1'
    coordP.textContent = `${pdv.geolocation_lat?.toFixed(4)}, ${pdv.geolocation_lng?.toFixed(4)}`
    el.appendChild(coordP)

    const photoWrap = document.createElement('div')
    photoWrap.className = 'mt-2'
    if (isSafeImageUrl(pdv.image_url)) {
      const img = document.createElement('img')
      img.src = pdv.image_url
      img.alt = pdv.nom_pdv
      img.className = 'w-full h-20 object-cover rounded cursor-pointer pdv-photo-btn'
      img.dataset.pdvId = pdv.pdv_id
      photoWrap.appendChild(img)
    } else {
      const btn = document.createElement('button')
      btn.className = 'text-[10px] text-fc-red underline pdv-photo-btn'
      btn.textContent = '📷 Voir photo'
      btn.dataset.pdvId = pdv.pdv_id
      photoWrap.appendChild(btn)
    }
    el.appendChild(photoWrap)

    marker.bindPopup(el)

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

  // Listen for photo button clicks inside Leaflet popups
  map.on('popupopen', () => {
    nextTick(() => {
      document.querySelectorAll('.pdv-photo-btn').forEach(el => {
        el.addEventListener('click', (e) => {
          const pdvId = (e.currentTarget as HTMLElement).dataset.pdvId
          if (pdvId) {
            const pdv = allPDV.value.find(p => p.pdv_id === pdvId)
            if (pdv) {
              selectedPdvForPhoto.value = pdv
              nextTick(() => {
                mapPhotoModal.value?.openModal?.()
              })
            }
          }
        })
      })
    })
  })
}

onMounted(async () => {
  await nextTick()
  setTimeout(initMap, 100)
})
</script>
