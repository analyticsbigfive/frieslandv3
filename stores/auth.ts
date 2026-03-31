// stores/auth.ts
import { defineStore } from 'pinia'
import type { Profile, UserRole } from '~/types'

export const useAuthStore = defineStore('auth', () => {
  const supabase = useSupabaseClient()
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
          .select('id, email, nom, telephone, role, zone_assignee, secteurs_assignes, region, avatar_url, is_active, created_at, updated_at')
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

  async function register(email: string, password: string, nom: string, role: UserRole = 'merchandiser') {
    loading.value = true
    error.value = null

    try {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nom, role },
        },
      })
      if (err) throw err
      return data
    }
    catch (err: any) {
      error.value = err.message
      throw err
    }
    finally {
      loading.value = false
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    profile.value = null
    profileRequest.value = null

    // Effacer la position géographique
    if (import.meta.client) {
      const { clearPosition } = useUserGeolocation()
      clearPosition()
    }
  }

  async function updateProfile(updates: Partial<Profile>) {
    if (!user.value) return

    const { data, error: err } = await supabase
      .from('profiles')
      .update(updates)
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
    }
    else {
      profile.value = null
      profileRequest.value = null
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
    logout,
    fetchProfile,
    updateProfile,
  }
})
