<template>
  <div class="h-[calc(100vh-120px)]">
    <div id="mobile-map" class="w-full h-full" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth'], layout: 'mobile' })

const pdvStore = usePDVStore()
const authStore = useAuthStore()

let map: any = null

onMounted(async () => {
  const L = await import('leaflet')
  await import('leaflet/dist/leaflet.css')

  map = L.map('mobile-map').setView([5.345, -4.024], 12)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map)

  if (!authStore.profile) {
    await authStore.fetchProfile()
  }

  const allPDV = await pdvStore.fetchScopedPDV(authStore.profile)

  allPDV.forEach((pdv: any) => {
    if (pdv.geolocation_lat && pdv.geolocation_lng) {
      L.circleMarker([pdv.geolocation_lat, pdv.geolocation_lng], {
        radius: 6,
        fillColor: '#003DA5',
        color: '#fff',
        weight: 1,
        fillOpacity: 0.8,
      })
        .bindPopup(`<strong>${pdv.nom_pdv}</strong><br>${pdv.zone || ''}<br>${pdv.canal || ''}`)
        .addTo(map)
    }
  })

  // Show user location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        L.circleMarker([pos.coords.latitude, pos.coords.longitude], {
          radius: 10,
          fillColor: '#C8102E',
          color: '#fff',
          weight: 2,
          fillOpacity: 1,
        })
          .bindPopup('Ma position')
          .addTo(map)

        map.setView([pos.coords.latitude, pos.coords.longitude], 14)
      },
      () => {},
      { enableHighAccuracy: true }
    )
  }
})

onUnmounted(() => {
  map?.remove()
})
</script>
