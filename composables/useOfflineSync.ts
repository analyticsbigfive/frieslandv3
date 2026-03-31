import type { OfflineQueueItem } from '~/types'

const isOnline = ref(true)
const isSyncing = ref(false)
const queue = ref<OfflineQueueItem[]>([])

let offlineSyncInitialized = false
let processQueueRunner: null | (() => Promise<void>) = null

function saveQueueToStorage() {
  if (!import.meta.client) {
    return
  }

  localStorage.setItem('offline-queue', JSON.stringify(queue.value))
}

function initializeOfflineQueue() {
  if (!import.meta.client || offlineSyncInitialized) {
    return
  }

  offlineSyncInitialized = true
  isOnline.value = navigator.onLine

  const savedQueue = localStorage.getItem('offline-queue')
  if (savedQueue) {
    try {
      queue.value = JSON.parse(savedQueue)
    }
    catch {
      queue.value = []
    }
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

  initializeOfflineQueue()

  function addToQueue(item: Omit<OfflineQueueItem, 'id' | 'timestamp' | 'retries' | 'status'>) {
    const queueItem: OfflineQueueItem = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retries: 0,
      status: 'pending',
      ...item,
    }

    queue.value.push(queueItem)
    saveQueueToStorage()

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

    saveQueueToStorage()
    isSyncing.value = false
  }

  function clearQueue() {
    queue.value = []
    saveQueueToStorage()
  }

  function retryFailed() {
    queue.value
      .filter(item => item.status === 'error')
      .forEach((item) => {
        item.status = 'pending'
        item.retries = 0
      })

    saveQueueToStorage()
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
