// stores/auth.ts
import { defineStore } from 'pinia'
import type { Profile, UserRole } from '~/types'

export const useAuthStore = defineStore('auth', () => {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  const profile = ref<Profile | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => profile.value?.role === 'admin')
  const isSuperviseur = computed(() => profile.value?.role === 'superviseur' || isAdmin.value)
  const userRole = computed(() => profile.value?.role || 'merchandiser')

  async function fetchProfile() {
    if (!user.value) return null
    loading.value = true

    try {
      const { data, error: err } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.value.id)
        .single()

      if (err) throw err
      profile.value = data as Profile
      return data
    }
    catch (err: any) {
      error.value = err.message
      return null
    }
    finally {
      loading.value = false
    }
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
  watch(user, async (newUser) => {
    if (newUser) {
      await fetchProfile()
    }
    else {
      profile.value = null
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
