import type { PDV, Profile, Visite } from '~/types'

function isPrivilegedProfile(profile?: Profile | null) {
  return profile?.role === 'admin' || profile?.role === 'superviseur'
}

export function useUserScope() {
  const authStore = useAuthStore()
  const user = useSupabaseUser()

  function isPrivileged(profile: Profile | null | undefined = authStore.profile) {
    return isPrivilegedProfile(profile)
  }

  function matchesPDVScope(
    pdv: Partial<PDV>,
    profile: Profile | null | undefined = authStore.profile
  ) {
    if (!profile || isPrivilegedProfile(profile)) {
      return true
    }

    if (profile.zone_assignee && pdv.zone !== profile.zone_assignee) {
      return false
    }

    const secteurs = profile.secteurs_assignes?.filter(Boolean) || []
    if (secteurs.length > 0 && !secteurs.includes(pdv.secteur || '')) {
      return false
    }

    return true
  }

  function filterPDVList<T extends Partial<PDV>>(
    list: T[],
    profile: Profile | null | undefined = authStore.profile
  ) {
    return list.filter(item => matchesPDVScope(item, profile))
  }

  function matchesVisiteScope(
    visite: Partial<Visite>,
    profile: Profile | null | undefined = authStore.profile
  ) {
    if (!profile || isPrivilegedProfile(profile)) {
      return true
    }

    if (user.value?.id && visite.user_id === user.value.id) {
      return true
    }

    if (user.value?.email && visite.email === user.value.email) {
      return true
    }

    return false
  }

  function filterContacts<
    T extends Partial<Profile> & {
      zone_assignee?: string | null
      region?: string | null
      is_active?: boolean | null
    }
  >(
    list: T[],
    profile: Profile | null | undefined = authStore.profile
  ) {
    return list.filter((contact) => {
      if (contact.is_active === false) {
        return false
      }

      if (!profile || isPrivilegedProfile(profile)) {
        return true
      }

      if (contact.id === user.value?.id || contact.email === user.value?.email) {
        return true
      }

      if (contact.role === 'admin' || contact.role === 'superviseur') {
        return true
      }

      if (profile.zone_assignee && contact.zone_assignee === profile.zone_assignee) {
        return true
      }

      if (profile.region && contact.region === profile.region) {
        return true
      }

      return false
    })
  }

  return {
    isPrivileged,
    matchesPDVScope,
    filterPDVList,
    matchesVisiteScope,
    filterContacts,
  }
}
