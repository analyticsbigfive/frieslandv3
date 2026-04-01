// composables/useUsersCache.ts
// Cache centralisé pour la liste des utilisateurs/profiles
// TTL 5 minutes + déduplication des appels concurrents

import type { Profile } from '~/types'
import { markRaw } from 'vue'

interface UsersCacheState {
  users: Profile[]
  timestamp: number
  promise: Promise<Profile[]> | null
}

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const _state: UsersCacheState = {
  users: [],
  timestamp: 0,
  promise: null,
}

export function useUsersCache() {
  const supabase = markRaw(useSupabaseClient())

  const users = computed(() => _state.users)
  const loading = ref(false)

  // Filtered computed helpers
  const activeUsers = computed(() =>
    _state.users.filter(u => u.is_active !== false)
  )

  const merchandisers = computed(() =>
    activeUsers.value.filter(u => u.role === 'merchandiser' || u.role === 'commercial')
  )

  const merchandiserOptions = computed(() =>
    merchandisers.value.map(u => ({
      value: u.id,
      label: `${u.nom || u.email} (${u.zone_assignee || 'N/A'})`,
    }))
  )

  const userOptions = computed(() => [
    { value: '', label: 'Tous' },
    ...activeUsers.value.map(u => ({
      value: u.id,
      label: u.nom || u.email || u.id,
    })),
  ])

  /**
   * Fetch users with cache + deduplication
   * @param force - Force refresh even if cache is valid
   */
  async function fetchUsers(force = false): Promise<Profile[]> {
    // Return cached if still valid
    if (!force && _state.users.length > 0 && Date.now() - _state.timestamp < CACHE_TTL) {
      return _state.users
    }

    // Deduplicate concurrent calls
    if (_state.promise) {
      return _state.promise
    }

    loading.value = true

    _state.promise = (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, nom, email, role, zone_assignee, secteurs_assignes, region, telephone, is_active, created_at, updated_at')
          .order('nom')

        if (error) throw error

        _state.users = (data || []) as Profile[]
        _state.timestamp = Date.now()
        return _state.users
      } catch (err) {
        console.error('Erreur chargement utilisateurs:', err)
        return _state.users // return stale data
      } finally {
        loading.value = false
        _state.promise = null
      }
    })()

    return _state.promise
  }

  /**
   * Get a user by ID (from cache, no network call)
   */
  function getUserById(id: string): Profile | undefined {
    return _state.users.find(u => u.id === id)
  }

  /**
   * Get user display name by ID
   */
  function getUserName(id: string): string {
    const u = getUserById(id)
    return u?.nom || u?.email || id
  }

  /**
   * Invalidate the cache (force next fetch to reload)
   */
  function invalidate() {
    _state.timestamp = 0
  }

  return {
    users,
    activeUsers,
    merchandisers,
    merchandiserOptions,
    userOptions,
    loading,
    fetchUsers,
    getUserById,
    getUserName,
    invalidate,
  }
}
