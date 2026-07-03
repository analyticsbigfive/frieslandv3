// composables/useTournee.ts
import { Capacitor, registerPlugin } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { get, set } from 'idb-keyval'
import type { PositionPoint, TourneeActive } from '~/types'

// Tracking GPS de tournée (APK Android uniquement) : foreground service
// natif via @capacitor-community/background-geolocation, points bufferisés
// dans IndexedDB (survivent au kill de l'app), envoyés par batch via la
// queue offline existante (useOfflineSync).

interface BgLocation {
  latitude: number
  longitude: number
  accuracy?: number | null
  speed?: number | null
  time?: number | null
}

interface BgError {
  code?: string
  message?: string
}

interface BackgroundGeolocationPlugin {
  addWatcher(
    options: {
      backgroundTitle?: string
      backgroundMessage?: string
      requestPermissions?: boolean
      stale?: boolean
      distanceFilter?: number
    },
    callback: (position?: BgLocation, error?: BgError) => void,
  ): Promise<string>
  removeWatcher(options: { id: string }): Promise<void>
  openSettings(): Promise<void>
}

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation')

const BUFFER_KEY = 'offline:positions-buffer'
const ACTIVE_KEY = 'tournee-active'

const isTracking = ref(false)
const tourneeId = ref<string | null>(null)
const startedAt = ref<string | null>(null)
const pointCount = ref(0)
const totalDistanceM = ref(0)
const lastPoint = ref<PositionPoint | null>(null)
const trackingError = ref<string | null>(null)

let watcherId: string | null = null
let flushTimer: ReturnType<typeof setInterval> | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let lastCapturedAt = 0
let lastLat: number | null = null
let lastLng: number | null = null
let bufferChain: Promise<void> = Promise.resolve()

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLng = (lng2 - lng1) * (Math.PI / 180)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Les écritures IndexedDB sont sérialisées pour éviter qu'un flush et une
// capture simultanés se marchent dessus (lecture-modification-écriture).
function withBuffer(task: () => Promise<void>): Promise<void> {
  bufferChain = bufferChain.then(task, task)
  return bufferChain
}

export function useTournee() {
  const config = useRuntimeConfig()
  const user = useSupabaseUser()
  const { addToQueue } = useOfflineSync()
  const geo = useGeoProvider()

  const minIntervalMs = Number(config.public.trackingIntervalMs) || 30_000
  const distanceM = Number(config.public.trackingDistanceM) || 15
  const flushMs = Number(config.public.trackingFlushMs) || 5 * 60_000
  const batchMax = Number(config.public.trackingBatchMax) || 200

  const isNative = import.meta.client && Capacitor.isNativePlatform()

  async function appendPoint(point: PositionPoint) {
    await withBuffer(async () => {
      const buffer = (await get<PositionPoint[]>(BUFFER_KEY)) ?? []
      buffer.push(point)
      await set(BUFFER_KEY, buffer)
    })

    pointCount.value += 1
    lastPoint.value = point
  }

  // Déplace le buffer vers la queue offline par batchs bornés ; la queue
  // gère ensuite retry et reprise réseau.
  async function flushBuffer() {
    await withBuffer(async () => {
      const buffer = (await get<PositionPoint[]>(BUFFER_KEY)) ?? []
      if (buffer.length === 0) {
        return
      }

      for (let start = 0; start < buffer.length; start += batchMax) {
        addToQueue({
          type: 'positions_batch',
          data: buffer.slice(start, start + batchMax),
        })
      }

      await set(BUFFER_KEY, [])
    })
  }

  // Enregistre un point si le mouvement dépasse le filtre distance (ou si
  // c'est le premier), avec un intervalle minimal pour ne pas saturer.
  // Alimenté à la fois par le watcher background et le polling GPS fusionné.
  function recordPoint(lat: number, lng: number, accuracy: number | null, speed: number | null, force = false) {
    const active = tourneeId.value
    const userId = user.value?.id
    if (!active || !userId) {
      return
    }

    const now = Date.now()
    const step = lastLat === null ? Infinity : haversine(lastLat, lastLng!, lat, lng)
    const movedEnough = step >= distanceM
    if (!force && (!movedEnough || now - lastCapturedAt < minIntervalMs)) {
      return
    }

    // Cumule la distance parcourue (ignore le tout premier point).
    if (lastLat !== null && Number.isFinite(step)) {
      totalDistanceM.value += step
    }

    lastCapturedAt = now
    lastLat = lat
    lastLng = lng

    void appendPoint({
      id: crypto.randomUUID(),
      user_id: userId,
      tournee_id: active,
      lat,
      lng,
      accuracy,
      speed,
      captured_at: new Date(now).toISOString(),
    })
  }

  function handleLocation(location: BgLocation) {
    recordPoint(location.latitude, location.longitude, location.accuracy ?? null, location.speed ?? null)
  }

  // Polling GPS fusionné (fiable même quand le provider du plugin background
  // ne délivre rien). Premier point forcé, puis échantillonnage régulier.
  async function pollOnce(force = false) {
    if (!tourneeId.value || !user.value?.id) {
      return
    }

    try {
      const position = await geo.getCurrentPosition({ timeout: 20000, maximumAge: 0 })
      recordPoint(
        position.coords.latitude,
        position.coords.longitude,
        position.coords.accuracy ?? null,
        position.coords.speed ?? null,
        force,
      )
      await flushBuffer()
    }
    catch {
      // Fix pas encore disponible : nouvelle tentative au prochain tick.
    }
  }

  // Premier point garanti : plusieurs tentatives le temps du warm-up GPS.
  async function captureInitialPoint() {
    for (let attempt = 0; attempt < 4; attempt++) {
      const before = pointCount.value
      await pollOnce(true)
      if (pointCount.value > before) {
        return
      }
      await new Promise(resolve => setTimeout(resolve, 5000))
    }
  }

  async function startWatcher() {
    watcherId = await BackgroundGeolocation.addWatcher(
      {
        backgroundTitle: 'Tournée en cours',
        backgroundMessage: 'Suivi GPS de votre tournée actif',
        requestPermissions: true,
        stale: false,
        distanceFilter: distanceM,
      },
      (location, error) => {
        if (error) {
          if (error.code === 'NOT_AUTHORIZED') {
            trackingError.value = 'Localisation refusée. Autorisez la localisation "Tout le temps" dans les réglages.'
          }
          else {
            trackingError.value = error.message ?? 'Erreur du service de localisation'
          }
          return
        }
        if (location) {
          trackingError.value = null
          handleLocation(location)
        }
      },
    )

    flushTimer = setInterval(() => {
      void flushBuffer()
    }, flushMs)

    // Échantillonnage GPS fusionné régulier, indépendant du provider du
    // plugin background (fiable en avant-plan et service au premier plan).
    pollTimer = setInterval(() => {
      void pollOnce()
    }, minIntervalMs)

    isTracking.value = true

    void captureInitialPoint()
  }

  async function startTournee() {
    if (!isNative) {
      trackingError.value = 'Le suivi de tournée nécessite l\'application Android.'
      return
    }
    if (isTracking.value) {
      return
    }

    const userId = user.value?.id
    if (!userId) {
      trackingError.value = 'Utilisateur non connecté.'
      return
    }

    // Demande la permission localisation avant toute capture : évite le
    // « permission denied » du premier getCurrentPosition au tout premier
    // lancement.
    await geo.requestPermission()

    trackingError.value = null
    tourneeId.value = crypto.randomUUID()
    startedAt.value = new Date().toISOString()
    pointCount.value = 0
    totalDistanceM.value = 0
    lastCapturedAt = 0
    lastLat = null
    lastLng = null

    await Preferences.set({
      key: ACTIVE_KEY,
      value: JSON.stringify({
        tourneeId: tourneeId.value,
        userId,
        startedAt: startedAt.value,
      } satisfies TourneeActive),
    })

    await startWatcher()
  }

  async function stopTournee() {
    if (flushTimer) {
      clearInterval(flushTimer)
      flushTimer = null
    }

    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }

    if (watcherId) {
      await BackgroundGeolocation.removeWatcher({ id: watcherId }).catch(() => {})
      watcherId = null
    }

    await flushBuffer()
    await Preferences.remove({ key: ACTIVE_KEY }).catch(() => {})

    isTracking.value = false
    tourneeId.value = null
    startedAt.value = null
  }

  // Au démarrage de l'app : reprend la tournée du jour si le process a été
  // tué en cours de route ; sinon vide le buffer résiduel vers la queue.
  async function resumeIfActive() {
    if (!isNative || isTracking.value) {
      return
    }

    await flushBuffer()

    const { value } = await Preferences.get({ key: ACTIVE_KEY })
    if (!value) {
      return
    }

    try {
      const active = JSON.parse(value) as TourneeActive
      const sameDay = new Date(active.startedAt).toDateString() === new Date().toDateString()

      if (!sameDay || active.userId !== user.value?.id) {
        await Preferences.remove({ key: ACTIVE_KEY })
        return
      }

      tourneeId.value = active.tourneeId
      startedAt.value = active.startedAt
      await startWatcher()
    }
    catch {
      await Preferences.remove({ key: ACTIVE_KEY }).catch(() => {})
    }
  }

  // Démarrage automatique au lancement de l'app (demande client) :
  // reprend la tournée du jour si elle existe, sinon en démarre une
  // nouvelle. La permission localisation est demandée au premier
  // lancement par le service lui-même.
  async function autoStart() {
    if (!isNative || isTracking.value) {
      return
    }

    await resumeIfActive()

    if (isTracking.value || !user.value?.id) {
      return
    }

    await startTournee()
  }

  function openLocationSettings() {
    if (isNative) {
      void BackgroundGeolocation.openSettings()
    }
  }

  return {
    isNative,
    isTracking: readonly(isTracking),
    tourneeId: readonly(tourneeId),
    startedAt: readonly(startedAt),
    pointCount: readonly(pointCount),
    distanceKm: computed(() => totalDistanceM.value / 1000),
    lastPoint: readonly(lastPoint),
    trackingError: readonly(trackingError),
    startTournee,
    stopTournee,
    resumeIfActive,
    autoStart,
    flushBuffer,
    openLocationSettings,
  }
}
