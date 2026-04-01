import { get, set, del, clear } from 'idb-keyval'
import type { PDV, ZoneSecteur, OfflineQueueItem, Profile } from '~/types'

const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

interface CachedData<T> {
  data: T
  timestamp: number
}

function isValid<T>(cached: CachedData<T> | undefined): cached is CachedData<T> {
  return !!cached && Date.now() - cached.timestamp < CACHE_TTL
}

export function useOfflineData() {
  // --- PDV List ---
  async function cachePDVList(pdvList: PDV[]) {
    await set('offline:pdv-list', { data: pdvList, timestamp: Date.now() } satisfies CachedData<PDV[]>)
  }

  async function getCachedPDVList(): Promise<PDV[] | null> {
    const cached = await get<CachedData<PDV[]>>('offline:pdv-list')
    return isValid(cached) ? cached.data : null
  }

  async function getCachedPDVListFallback(): Promise<PDV[] | null> {
    const cached = await get<CachedData<PDV[]>>('offline:pdv-list')
    return cached?.data ?? null
  }

  // --- Zones ---
  async function cacheZones(zonesList: ZoneSecteur[]) {
    await set('offline:zones', { data: zonesList, timestamp: Date.now() } satisfies CachedData<ZoneSecteur[]>)
  }

  async function getCachedZones(): Promise<ZoneSecteur[] | null> {
    const cached = await get<CachedData<ZoneSecteur[]>>('offline:zones')
    return isValid(cached) ? cached.data : null
  }

  async function getCachedZonesFallback(): Promise<ZoneSecteur[] | null> {
    const cached = await get<CachedData<ZoneSecteur[]>>('offline:zones')
    return cached?.data ?? null
  }

  // --- Queue sync ---
  async function saveQueue(items: OfflineQueueItem[]) {
    await set('offline:queue', items)
  }

  async function loadQueue(): Promise<OfflineQueueItem[]> {
    return (await get<OfflineQueueItem[]>('offline:queue')) ?? []
  }

  // --- Pre-cache ---
  async function preCacheData(profile?: Profile | null) {
    if (!import.meta.client || !profile) return

    try {
      const supabase = useSupabaseClient()

      const [pdvResult, zonesResult] = await Promise.all([
        supabase.from('pdv').select('*').eq('is_active', true).order('nom_pdv'),
        supabase.from('zones_secteurs').select('*').order('zone'),
      ])

      if (pdvResult.data) {
        await cachePDVList(pdvResult.data as PDV[])
      }
      if (zonesResult.data) {
        await cacheZones(zonesResult.data as ZoneSecteur[])
      }
    }
    catch (err) {
      console.warn('Pre-cache offline data failed:', err)
    }
  }

  // --- Cleanup ---
  async function clearOfflineData() {
    await Promise.all([
      del('offline:pdv-list'),
      del('offline:zones'),
      del('offline:queue'),
    ])
  }

  return {
    cachePDVList,
    getCachedPDVList,
    getCachedPDVListFallback,
    cacheZones,
    getCachedZones,
    getCachedZonesFallback,
    saveQueue,
    loadQueue,
    preCacheData,
    clearOfflineData,
  }
}
