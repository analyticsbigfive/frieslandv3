import type { OfflineQueueItem } from '~/types'

const isOnline = ref(true)
const isSyncing = ref(false)
const queue = ref<OfflineQueueItem[]>([])
const lastSyncAt = ref<number | null>(null)
const lastSyncError = ref<string | null>(null)

let offlineSyncInitialized = false
let processQueueRunner: null | (() => Promise<void>) = null
let retryTimer: number | null = null

async function saveQueueToStorage() {
  if (!import.meta.client) return
  const { saveQueue } = useOfflineData()
  await saveQueue(queue.value)
}

async function initializeOfflineQueue() {
  if (!import.meta.client || offlineSyncInitialized) {
    return
  }

  offlineSyncInitialized = true
  isOnline.value = navigator.onLine

  // Load from IndexedDB
  const { loadQueue } = useOfflineData()
  try {
    queue.value = await loadQueue()
  }
  catch {
    queue.value = []
  }

  // One-time migration from localStorage
  try {
    const legacyQueue = localStorage.getItem('offline-queue')
    if (legacyQueue) {
      const legacyItems: OfflineQueueItem[] = JSON.parse(legacyQueue)
      if (legacyItems.length > 0 && queue.value.length === 0) {
        queue.value = legacyItems
        await saveQueueToStorage()
      }
      localStorage.removeItem('offline-queue')
    }
  }
  catch {
    // Ignore localStorage migration errors
  }

  window.addEventListener('online', () => {
    isOnline.value = true
    void processQueueRunner?.()
  })

  window.addEventListener('offline', () => {
    isOnline.value = false
  })

  const resumeSync = () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      void processQueueRunner?.()
    }
  }
  document.addEventListener('visibilitychange', resumeSync)
  window.addEventListener('pageshow', resumeSync)
  if (retryTimer) window.clearInterval(retryTimer)
  retryTimer = window.setInterval(() => {
    if (navigator.onLine && queue.value.some(item => item.status === 'pending' || item.status === 'error')) {
      void processQueueRunner?.()
    }
  }, 30000)
}

export function useOfflineSync() {
  const supabase = useSupabaseClient()

  // initializeOfflineQueue is async but we fire-and-forget on first call
  void initializeOfflineQueue()

  function addToQueue(item: Omit<OfflineQueueItem, 'id' | 'timestamp' | 'retries' | 'status'>) {
    const queueItem: OfflineQueueItem = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retries: 0,
      status: 'pending',
      ...item,
    }

    queue.value.push(queueItem)
    void saveQueueToStorage()

    if (isOnline.value) {
      void processQueue()
    }
  }

  async function processQueue() {
    if (isSyncing.value || !isOnline.value) {
      return
    }

    isSyncing.value = true
    lastSyncError.value = null

    const pendingItems = queue.value.filter(item => item.status === 'pending' || item.status === 'error')

    for (const item of pendingItems) {
      try {
        item.status = 'processing'

        if (item.type === 'visite') {
          const { error } = await supabase
            .from('visites')
            .upsert({ ...item.data, sync_status: 'synced' }, { onConflict: 'visite_id' })

          if (error) {
            throw error
          }
        }
        else if (item.type === 'pdv') {
          const { error } = await supabase
            .from('pdv')
            .upsert(item.data, { onConflict: 'pdv_id' })

          if (error) {
            throw error
          }
        }
        else if (item.type === 'image') {
          const { data: uploaded, error } = await supabase.storage
            .from('visite-images')
            .upload(item.data.path, item.data.file, { contentType: 'image/jpeg', upsert: true })

          if (error) {
            throw error
          }

          const { data: urlData } = supabase.storage
            .from('visite-images')
            .getPublicUrl(uploaded.path)
          const { data: visite, error: visiteError } = await (supabase
            .from('visites') as any)
            .select('image_urls')
            .eq('visite_id', item.data.visiteId)
            .maybeSingle()

          if (visiteError) throw visiteError
          const currentUrls = Array.isArray(visite?.image_urls) ? visite.image_urls : []
          if (!currentUrls.includes(urlData.publicUrl)) {
            const { data: updatedRows, error: updateError } = await (supabase
              .from('visites') as any)
              .update({ image_urls: [...currentUrls, urlData.publicUrl] })
              .eq('visite_id', item.data.visiteId)
              .select('visite_id')
            if (updateError) throw updateError
            if (!updatedRows?.length) {
              // The parent visit may still be in the queue. Keep this image pending
              // without consuming a retry so it is attempted after the parent.
              item.status = 'pending'
              continue
            }
          }
        }
        else if (item.type === 'positions_batch') {
          // Ids générés côté client : le rejeu d'un batch déjà reçu est
          // ignoré (on conflict do nothing), le renvoi est donc sans risque.
          const { error } = await supabase
            .from('position_tournee')
            .upsert(item.data, { onConflict: 'id', ignoreDuplicates: true })

          if (error) {
            throw error
          }
        }

        queue.value = queue.value.filter(queuedItem => queuedItem.id !== item.id)
      }
      catch (err) {
        item.retries += 1
        item.status = item.retries >= 3 ? 'error' : 'pending'
        lastSyncError.value = item.retries >= 3
          ? 'Une donnée n’a pas pu être synchronisée après plusieurs tentatives.'
          : 'La synchronisation sera réessayée automatiquement.'
        console.error(`Erreur sync item ${item.id}:`, err)
      }
    }

    await saveQueueToStorage()
    if (queue.value.length === 0) lastSyncAt.value = Date.now()
    isSyncing.value = false
  }

  function clearQueue() {
    queue.value = []
    void saveQueueToStorage()
  }

  function retryFailed() {
    queue.value
      .filter(item => item.status === 'error')
      .forEach((item) => {
        item.status = 'pending'
        item.retries = 0
      })

    void saveQueueToStorage()
    void processQueue()
  }

  processQueueRunner = processQueue

  const pendingCount = computed(() =>
    queue.value.filter(item => item.status === 'pending').length
  )

  const errorCount = computed(() =>
    queue.value.filter(item => item.status === 'error').length
  )

  const pendingVisitCount = computed(() => queue.value.filter(item => item.type === 'visite' && item.status === 'pending').length)
  const pendingImageCount = computed(() => queue.value.filter(item => item.type === 'image' && item.status === 'pending').length)
  const errorVisitCount = computed(() => queue.value.filter(item => item.type === 'visite' && item.status === 'error').length)
  const errorImageCount = computed(() => queue.value.filter(item => item.type === 'image' && item.status === 'error').length)

  return {
    isOnline,
    isSyncing,
    lastSyncAt,
    lastSyncError,
    queue,
    pendingCount,
    errorCount,
    pendingVisitCount,
    pendingImageCount,
    errorVisitCount,
    errorImageCount,
    addToQueue,
    processQueue,
    clearQueue,
    retryFailed,
  }
}
