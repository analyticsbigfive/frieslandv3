<template>
  <div class="space-y-6">
    <AdminPageHeader :description="authStore.isAgence ? 'Les points de vente visités ou recensés par les merchandisers de votre agence.' : undefined" />

    <!-- Hauteur : en-tête (56 px) + marges du contenu + onglets (41 px + 24 px)
         + titre de page et sa phrase d'aide + espacement ≈ 260 px. -->
    <section class="admin-surface flex h-[calc(100dvh-260px)] min-h-[420px] flex-col overflow-hidden" aria-label="Carte des points de vente">
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
          <span class="inline-flex items-center gap-1.5">
            <span class="h-3 w-3 shrink-0 rounded-full border-2 border-white ring-1 ring-slate-300 dark:border-slate-800 dark:ring-slate-600" :style="{ backgroundColor: COULEUR_PDV }" aria-hidden="true" />
            <span><strong class="font-semibold tabular-nums text-slate-900 dark:text-white">{{ formatNombre(markers.length) }}</strong> {{ markers.length > 1 ? 'points de vente géolocalisés' : 'point de vente géolocalisé' }}</span>
          </span>
          <span v-if="horsZone.length" class="inline-flex items-center gap-1 text-amber-800 dark:text-amber-300" :title="horsZone.map(p => p.nom_pdv || 'Point de vente sans nom').join(', ')">
            <UIcon name="i-heroicons-exclamation-triangle" class="h-4 w-4 shrink-0" aria-hidden="true" />
            {{ horsZone.length }} hors de la carte (coordonnées à corriger dans la fiche du point de vente)
          </span>
          <span class="hidden sm:inline">Cliquez sur un point pour voir sa fiche.</span>
        </div>
        <div class="flex w-full items-center gap-2 sm:w-auto">
          <label for="carte-territoire" class="shrink-0 text-xs font-medium text-slate-600 dark:text-slate-300">Territoire</label>
          <USelectMenu
            id="carte-territoire"
            v-model="selectedZone"
            :options="zoneOptions"
            placeholder="Tous les territoires"
            searchable
            searchable-placeholder="Rechercher…"
            size="xs"
            class="w-full sm:w-56"
            @update:model-value="filterMarkers"
          />
        </div>
      </div>

      <div class="relative min-h-0 flex-1">
        <ClientOnly>
          <div ref="mapContainer" class="h-full w-full" />
        </ClientOnly>

        <div v-if="!charge" class="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center p-4">
          <div class="rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
            <ChargementContenu variante="compact" libelle="Chargement des points de vente…" />
          </div>
        </div>

        <div v-else-if="erreur" class="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center p-4">
          <div class="max-w-sm rounded-lg border border-amber-200 bg-amber-50 p-4 text-center text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100" role="alert">
            <UIcon name="i-heroicons-exclamation-triangle" class="mx-auto h-6 w-6 text-amber-700 dark:text-amber-300" aria-hidden="true" />
            <p class="mt-2 text-sm font-semibold">Carte indisponible</p>
            <p class="mt-1 text-sm">{{ erreur }}</p>
          </div>
        </div>

        <div v-else-if="!markers.length" class="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center p-4">
          <div class="max-w-sm rounded-lg border border-slate-200 bg-white p-4 text-center dark:border-slate-700 dark:bg-slate-800">
            <UIcon name="i-heroicons-map-pin" class="mx-auto h-7 w-7 text-slate-400 dark:text-slate-500" aria-hidden="true" />
            <p class="mt-2 text-sm font-semibold text-slate-900 dark:text-white">Aucun point de vente géolocalisé</p>
            <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
              <template v-if="zoneActive">Aucun point de vente de ce territoire n'a de position GPS. Choisissez un autre territoire.</template>
              <template v-else-if="authStore.isAgence">Les points de vente apparaîtront ici dès que vos merchandisers les auront visités ou recensés.</template>
              <template v-else>Les points de vente apparaîtront ici dès que leur position GPS sera enregistrée.</template>
            </p>
          </div>
        </div>
      </div>
    </section>

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
import { SERIES } from '~/utils/chartPalette'
import { isModernTrade } from '~/utils/canal'
import { messageUtilisateur } from '~/utils/supabaseErrors'

definePageMeta({
  middleware: ['auth', 'admin'],
  layout: 'admin',
})

const pdvStore = usePDVStore()
const authStore = useAuthStore()
const { typePdvLabel, fetchTypePdvLabels } = useTypePdvLabels()
const route = useRoute()

const mapContainer = ref<HTMLElement | null>(null)
const allPDV = ref<PDV[]>([])
const selectedZone = ref('')
// Faux jusqu'à la fin du premier chargement : l'état vide n'apparaît pas avant.
const charge = ref(false)
const erreur = ref('')
// Couleur des points : série bleue de la palette commune (le rouge reste à l'action).
const COULEUR_PDV = SERIES[1]
const TOUS_TERRITOIRES = 'Tous les territoires'
const zoneActive = computed(() => !!selectedZone.value && selectedZone.value !== TOUS_TERRITOIRES)
const nombreFr = new Intl.NumberFormat('fr-FR')
function formatNombre(n: number) {
  return nombreFr.format(n)
}
const selectedPdvForPhoto = ref<PDV | null>(null)
const mapPhotoModal = ref<any>(null)
let map: any = null
let markerGroup: any = null

// Coordonnées plausibles pour la Côte d'Ivoire (marge comprise). Un seul point
// aberrant (virgule décimale perdue, point de démonstration) faisait cadrer la
// carte sur le monde entier et empêchait le dessin des points.
function coordonneesPlausibles(p: PDV) {
  const lat = Number(p.geolocation_lat)
  const lng = Number(p.geolocation_lng)
  return lat >= 3 && lat <= 12 && lng >= -10 && lng <= 0
}

const avecCoordonnees = computed(() => allPDV.value.filter(p => p.geolocation_lat && p.geolocation_lng))
const horsZone = computed(() => avecCoordonnees.value.filter(p => !coordonneesPlausibles(p)))

const markers = computed(() => {
  let list = avecCoordonnees.value.filter(coordonneesPlausibles)
  if (zoneActive.value) {
    list = list.filter(p => p.zone === selectedZone.value)
  }
  return list
})

const zoneOptions = computed(() => {
  const zones = [...new Set(allPDV.value.map(p => p.zone).filter((z): z is string => !!z))]
    .sort((a, b) => a.localeCompare(b, 'fr'))
  return [TOUS_TERRITOIRES, ...zones]
})

function filterMarkers() {
  if (!map || !markerGroup) return
  markerGroup.clearLayers()
  addMarkers()
}

// Seules les images servies par notre projet Supabase sont injectées dans le
// popup Leaflet (HTML brut) ; le host vient de la config, pas d'une constante.
const supabaseHost = (() => {
  try { return new URL(useRuntimeConfig().public.supabase.url as string).hostname } catch { return '' }
})()

function isSafeImageUrl(u: unknown): u is string {
  if (typeof u !== 'string' || !supabaseHost) return false
  try {
    const url = new URL(u)
    return url.protocol === 'https:' && url.hostname === supabaseHost
  } catch {
    return false
  }
}

// `cadrer` : ajuster la vue à tous les points. Pas quand un point précis est
// demandé (?lat=&lng=) : l'animation de fitBounds écrasait le zoom sur ce point.
function addMarkers(cadrer = true) {
  if (!map || !markerGroup) return

  // @ts-ignore
  const L = window.L
  if (!L) return

  // Tout le parc (~40 000 PDV) : rendu canvas plutôt qu'un nœud SVG par point,
  // et popup construite à l'ouverture seulement.
  const rendu = L.canvas({ padding: 0.5 })

  markers.value.forEach((pdv) => {
    const marker = L.circleMarker([pdv.geolocation_lat, pdv.geolocation_lng], {
      renderer: rendu,
      radius: 6,
      fillColor: COULEUR_PDV,
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8,
    })

    marker.bindPopup(() => popupPdv(pdv))

    markerGroup.addLayer(marker)
  })

  if (markers.value.length > 0) {
    // La hauteur de la carte vient du CSS (calc + flex) : on la remesure avant de cadrer.
    map.invalidateSize()
    const bounds = markerGroup.getBounds()
    if (cadrer && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [30, 30] })
    }
  }
}

// Icône « appareil photo » (heroicons, outline 24) : la popup Leaflet est du
// DOM brut, hors des composants Vue.
const ICONE_PHOTO = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true" class="h-4 w-4 shrink-0"><path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" /></svg>'

// Canal en clair : « Boutiques (GT) » / « Supermarchés (MT) » (valeur stockée inchangée).
function libelleCanal(canal: string | null | undefined): string {
  if (!canal) return ''
  return isModernTrade(canal) ? 'Supermarchés (MT)' : 'Boutiques (GT)'
}

function popupPdv(pdv: PDV) {
  const nom = pdv.nom_pdv || 'Point de vente sans nom'
  const el = document.createElement('div')
  el.className = 'text-sm text-slate-700'

  const nameP = document.createElement('p')
  nameP.className = 'font-semibold text-slate-900'
  nameP.textContent = nom
  el.appendChild(nameP)

  const lieu = [pdv.zone, pdv.quartier].filter(Boolean).join(' · ')
  if (lieu) {
    const zoneP = document.createElement('p')
    zoneP.className = 'text-slate-600'
    zoneP.textContent = lieu
    el.appendChild(zoneP)
  }

  const typeTexte = [libelleCanal(pdv.canal), typePdvLabel(pdv.sous_categorie_pdv)].filter(Boolean).join(' · ')
  if (typeTexte) {
    const canalP = document.createElement('p')
    canalP.className = 'text-xs text-slate-600'
    canalP.textContent = typeTexte
    el.appendChild(canalP)
  }

  const photoWrap = document.createElement('div')
  photoWrap.className = 'mt-2'
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.dataset.pdvId = pdv.pdv_id
  if (isSafeImageUrl(pdv.image_url)) {
    btn.className = 'pdv-photo-btn block w-full'
    btn.setAttribute('aria-label', `Voir la photo de ${nom}`)
    const img = document.createElement('img')
    img.src = pdv.image_url
    img.alt = ''
    img.className = 'h-20 w-full cursor-pointer rounded object-cover'
    btn.appendChild(img)
  } else {
    btn.className = 'pdv-photo-btn inline-flex items-center gap-1 text-xs font-semibold text-fc-red hover:underline'
    btn.innerHTML = ICONE_PHOTO
    const label = document.createElement('span')
    label.textContent = 'Voir la photo'
    btn.appendChild(label)
  }
  photoWrap.appendChild(btn)
  el.appendChild(photoWrap)

  return el
}

// Point demandé dans l'URL (« Voir sur la carte » depuis une liste de PDV).
function cible(): [number, number] | null {
  const latitude = Number(route.query.lat)
  const longitude = Number(route.query.lng)
  if (route.query.lat == null || route.query.lng == null) return null
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
  return [latitude, longitude]
}

function focusTarget() {
  const c = cible()
  if (!map || !c) return
  map.setView(c, 17)
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

  // featureGroup (et non layerGroup) : nécessaire pour getBounds() plus haut
  markerGroup = L.featureGroup().addTo(map)

  // Load PDV
  try {
    // Compte agence : les PDV visités ou recensés par ses merchandisers, pas tout
    // ce que la RLS lui ouvre (territoires des fiches, dont l'intérieur).
    const visitesAgence = authStore.isAgence ? await pdvStore.fetchPdvVisitesAgence() : null
    allPDV.value = visitesAgence
      ?? await pdvStore.fetchAllPDV(false, 'pdv_id,nom_pdv,zone,quartier,canal,sous_categorie_pdv,geolocation_lat,geolocation_lng,image_url')
  }
  catch (err) {
    erreur.value = messageUtilisateur(err, 'Les points de vente n\'ont pas pu être chargés. Rechargez la page dans quelques instants.')
  }
  finally {
    charge.value = true
  }
  addMarkers(!cible())
  focusTarget()

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
  void fetchTypePdvLabels()
  await nextTick()
  setTimeout(initMap, 100)
})
</script>
