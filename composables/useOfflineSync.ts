// composables/useOfflineSync.ts
import type { OfflineQueueItem } from '~/types'

export function useOfflineSync() {
  const supabase = useSupabaseClient()
  const isOnline = ref(true)
  const isSyncing = ref(false)
  const queue = ref<OfflineQueueItem[]>([])

  // Monitor online status
  if (import.meta.client) {
    isOnline.value = navigator.onLine

    window.addEventListener('online', () => {
      isOnline.value = true
      processQueue()
    })

    window.addEventListener('offline', () => {
      isOnline.value = false
    })

    // Load queue from localStorage
    const saved = localStorage.getItem('offline-queue')
    if (saved) {
      try {
        queue.value = JSON.parse(saved)
      }
      catch { /* ignore parse errors */ }
    }
  }

  function saveQueue() {
    if (import.meta.client) {
      localStorage.setItem('offline-queue', JSON.stringify(queue.value))
    }
  }

  /**
   * Add item to offline queue
   */
  function addToQueue(item: Omit<OfflineQueueItem, 'id' | 'timestamp' | 'retries' | 'status'>) {
    const queueItem: OfflineQueueItem = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retries: 0,
      status: 'pending',
      ...item,
    }
    queue.value.push(queueItem)
    saveQueue()

    if (isOnline.value) {
      processQueue()
    }
  }

  /**
   * Process all pending items in the queue
   */
  async function processQueue() {
    if (isSyncing.value || !isOnline.value) return
    isSyncing.value = true

    const pendingItems = queue.value.filter(i => i.status === 'pending' || i.status === 'error')

    for (const item of pendingItems) {
      try {
        item.status = 'processing'

        if (item.type === 'visite') {
          const { error } = await supabase
            .from('visites')
            .upsert(item.data, { onConflict: 'visite_id' })

          if (error) throw error
        }
        else if (item.type === 'pdv') {
          const { error } = await supabase
            .from('pdv')
            .upsert(item.data, { onConflict: 'pdv_id' })

          if (error) throw error
        }
        else if (item.type === 'image') {
          const { error } = await supabase.storage
            .from('visite-images')
            .upload(item.data.path, item.data.file)

          if (error) throw error
        }

        // Remove successfully processed item
        queue.value = queue.value.filter(i => i.id !== item.id)
      }
      catch (err) {
        item.retries++
        item.status = item.retries >= 3 ? 'error' : 'pending'
        console.error(`Erreur sync item ${item.id}:`, err)
      }
    }

    saveQueue()
    isSyncing.value = false
  }

  /**
   * Clear all items from queue
   */
  function clearQueue() {
    queue.value = []
    saveQueue()
  }

  /**
   * Retry failed items
   */
  function retryFailed() {
    queue.value
      .filter(i => i.status === 'error')
      .forEach(i => {
        i.status = 'pending'
        i.retries = 0
      })
    saveQueue()
    processQueue()
  }

  const pendingCount = computed(() =>
    queue.value.filter(i => i.status === 'pending').length
  )

  const errorCount = computed(() =>
    queue.value.filter(i => i.status === 'error').length
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
