import { get, set, del, clear } from 'idb-keyval'
import type { PDV, ZoneSecteur, OfflineQueueItem, Profile, Visite } from '~/types'

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

  // --- Visites ---
  async function cacheVisites(visitesList: Visite[]) {
    await set('offline:visites', { data: visitesList, timestamp: Date.now() } satisfies CachedData<Visite[]>)
  }

  async function getCachedVisites(): Promise<Visite[] | null> {
    const cached = await get<CachedData<Visite[]>>('offline:visites')
    return isValid(cached) ? cached.data : null
  }

  async function getCachedVisitesFallback(): Promise<Visite[] | null> {
    const cached = await get<CachedData<Visite[]>>('offline:visites')
    return cached?.data ?? null
  }

  // --- Contacts ---
  async function cacheContacts(contactsList: any[]) {
    await set('offline:contacts', { data: contactsList, timestamp: Date.now() } satisfies CachedData<any[]>)
  }

  async function getCachedContacts(): Promise<any[] | null> {
    const cached = await get<CachedData<any[]>>('offline:contacts')
    return isValid(cached) ? cached.data : null
  }

  async function getCachedContactsFallback(): Promise<any[] | null> {
    const cached = await get<CachedData<any[]>>('offline:contacts')
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

      const [pdvResult, zonesResult, visitesResult, contactsResult] = await Promise.all([
        supabase.from('pdv').select('*').eq('is_active', true).order('nom_pdv'),
        supabase.from('zones_secteurs').select('*').order('zone'),
        supabase.from('visites')
          .select('visite_id, pdv_id, user_id, commercial, email, date_visite, geofence_validated, sync_status, data, pdv:pdv_id(nom_pdv)')
          .eq('user_id', profile.id)
          .order('date_visite', { ascending: false })
          .limit(200),
        supabase.from('profiles')
          .select('id, nom, email, role, zone_assignee, telephone, region, is_active')
          .eq('is_active', true)
          .order('nom'),
      ])

      if (pdvResult.data) {
        await cachePDVList(pdvResult.data as PDV[])
      }
      if (zonesResult.data) {
        await cacheZones(zonesResult.data as ZoneSecteur[])
      }
      if (visitesResult.data) {
        await cacheVisites(visitesResult.data as Visite[])
      }
      if (contactsResult.data) {
        await cacheContacts(contactsResult.data)
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
      del('offline:visites'),
      del('offline:contacts'),
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
    cacheVisites,
    getCachedVisites,
    getCachedVisitesFallback,
    cacheContacts,
    getCachedContacts,
    getCachedContactsFallback,
    saveQueue,
    loadQueue,
    preCacheData,
    clearOfflineData,
  }
}
