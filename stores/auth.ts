// stores/auth.ts
import { defineStore, skipHydrate } from 'pinia'
import { markRaw } from 'vue'
import type { Profile, UserRole } from '~/types'

export const useAuthStore = defineStore('auth', () => {
  const supabase = skipHydrate(markRaw(useSupabaseClient()))
  const user = useSupabaseUser()

  const profile = ref<Profile | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const profileRequest = ref<Promise<Profile | null> | null>(null)

  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => profile.value?.role === 'admin')
  const isSuperviseur = computed(() => profile.value?.role === 'superviseur' || isAdmin.value)
  const userRole = computed(() => profile.value?.role || 'merchandiser')

  async function fetchProfile(options: { force?: boolean } = {}) {
    const force = options.force ?? false

    if (!user.value) {
      profile.value = null
      return null
    }

    if (!force && profile.value?.id === user.value.id) {
      return profile.value
    }

    if (profileRequest.value) {
      return profileRequest.value
    }

    loading.value = true
    error.value = null

    const requestedUserId = user.value.id

    profileRequest.value = (async () => {
      try {
        const { data, error: err } = await supabase
          .from('profiles')
          .select('id, email, nom, telephone, role, zone_assignee, territoires_assignes, quartiers_assignes, region, avatar_url, is_active, created_at, updated_at')
          .eq('id', requestedUserId)
          .single()

        if (err) throw err

        if (user.value?.id !== requestedUserId) {
          return null
        }

        profile.value = data as Profile
        return profile.value
      }
      catch (err: any) {
        if (user.value?.id === requestedUserId) {
          error.value = err.message
        }
        return null
      }
      finally {
        if (user.value?.id === requestedUserId) {
          loading.value = false
        }
        profileRequest.value = null
      }
    })()

    return profileRequest.value
  }

  async function login(email: string, password: string) {
    loading.value = true
    error.value = null

    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (err) throw err

      await fetchProfile()

      // Pre-cache offline data (non-blocking)
      if (import.meta.client) {
        const { preCacheData } = useOfflineData()
        void preCacheData(profile.value)
      }

      return data
    }
    catch (err: any) {
      error.value = err.message === 'Invalid login credentials'
        ? 'Email ou mot de passe incorrect'
        : err.message
      throw err
    }
    finally {
      loading.value = false
    }
  }

  // Création d'un compte : passe par /api/admin/users (service_role côté serveur).
  // Surtout pas auth.signUp() ici — ça envoie un mail de confirmation (SMTP intégré
  // limité à 2/heure -> 429) et ça remplacerait la session de l'admin connecté.
  async function register(payload: {
    email: string
    password: string
    nom: string
    role?: UserRole
    telephone?: string | null
    zone_assignee?: string | null
    territoires_assignes?: string[]
    quartiers_assignes?: string[]
    region?: string | null
  }) {
    if (!isAdmin.value) {
      throw new Error('Permission refusée : seuls les administrateurs peuvent créer des utilisateurs')
    }

    loading.value = true
    error.value = null

    try {
      return await $fetch<Profile>('/api/admin/users', {
        method: 'POST',
        body: { role: 'merchandiser', ...payload },
      })
    }
    catch (err: any) {
      const message = err?.data?.statusMessage || err?.data?.message || err?.message || 'Création impossible'
      error.value = message
      throw new Error(message)
    }
    finally {
      loading.value = false
    }
  }

  async function deleteUser(id: string) {
    if (!isAdmin.value) {
      throw new Error('Permission refusée : seuls les administrateurs peuvent supprimer des utilisateurs')
    }
    try {
      await $fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    }
    catch (err: any) {
      throw new Error(err?.data?.statusMessage || err?.data?.message || err?.message || 'Suppression impossible')
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    profile.value = null
    profileRequest.value = null

    if (import.meta.client) {
      // Effacer la position géographique
      const { clearPosition } = useUserGeolocation()
      clearPosition()

      // Nettoyer le cache offline
      const { clearOfflineData } = useOfflineData()
      void clearOfflineData()
    }
  }

  async function updateProfile(updates: Partial<Profile>) {
    if (!user.value) return

    // Sanitize string inputs to prevent XSS
    const sanitized: Partial<Profile> = {}
    const allowedFields: (keyof Profile)[] = ['nom', 'telephone', 'avatar_url', 'zone_assignee', 'region']

    for (const [key, value] of Object.entries(updates)) {
      if (!allowedFields.includes(key as keyof Profile)) continue
      sanitized[key as keyof Profile] = typeof value === 'string'
        ? value.trim().substring(0, 255) as any
        : value as any
    }

    // Prevent self-role-escalation: users cannot change their own role
    delete (sanitized as any).role
    delete (sanitized as any).is_active

    const { data, error: err } = await supabase
      .from('profiles')
      .update(sanitized)
      .eq('id', user.value.id)
      .select()
      .single()

    if (err) throw err
    profile.value = data as Profile
  }

  // Watch auth state changes
  watch(user, async (newUser, oldUser) => {
    if (newUser?.id === oldUser?.id) {
      return
    }

    if (newUser) {
      await fetchProfile({ force: true })

      // Pre-cache offline data (non-blocking)
      if (import.meta.client) {
        const { preCacheData } = useOfflineData()
        void preCacheData(profile.value)
      }
    }
    else {
      profile.value = null
      profileRequest.value = null

      // Nettoyer le cache offline
      if (import.meta.client) {
        const { clearOfflineData } = useOfflineData()
        void clearOfflineData()
      }
    }
  }, { immediate: true })

  return {
    user,
    profile,
    loading,
    error,
    isAuthenticated,
    isAdmin,
    isSuperviseur,
    userRole,
    login,
    register,
    deleteUser,
    logout,
    fetchProfile,
    updateProfile,
  }
})
