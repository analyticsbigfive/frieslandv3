import type { OfflineQueueItem } from '~/types'

const isOnline = ref(true)
const isSyncing = ref(false)
const queue = ref<OfflineQueueItem[]>([])

let offlineSyncInitialized = false
let processQueueRunner: null | (() => Promise<void>) = null

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

    const pendingItems = queue.value.filter(item => item.status === 'pending' || item.status === 'error')

    for (const item of pendingItems) {
      try {
        item.status = 'processing'

        if (item.type === 'visite') {
          const { error } = await supabase
            .from('visites')
            .upsert(item.data, { onConflict: 'visite_id' })

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
          const { error } = await supabase.storage
            .from('visite-images')
            .upload(item.data.path, item.data.file)

          if (error) {
            throw error
          }
        }

        queue.value = queue.value.filter(queuedItem => queuedItem.id !== item.id)
      }
      catch (err) {
        item.retries += 1
        item.status = item.retries >= 3 ? 'error' : 'pending'
        console.error(`Erreur sync item ${item.id}:`, err)
      }
    }

    await saveQueueToStorage()
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

  return {
    isOnline,
    isSyncing,
    queue,
    pendingCount,
    errorCount,
    addToQueue,
    processQueue,
    clearQueue,
    retryFailed,
  }
}
