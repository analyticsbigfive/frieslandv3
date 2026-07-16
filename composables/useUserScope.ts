import type { PDV, Profile, Visite } from '~/types'

function isPrivilegedProfile(profile?: Profile | null) {
  return profile?.role === 'admin' || profile?.role === 'superviseur'
}

// Territoires effectifs d'un profil : liste multi (territoires_assignes),
// fallback mono legacy (zone_assignee) si la liste est vide.
export function profileTerritories(profile?: Profile | null): string[] {
  const multi = (profile?.territoires_assignes || []).filter(Boolean)
  if (multi.length) return multi
  return profile?.zone_assignee ? [profile.zone_assignee] : []
}

// PDV ∈ périmètre d'un user ? (zone ∈ territoires) ET (quartiers vide OU quartier ∈ quartiers).
// Aucun territoire ⇒ pas de contrainte de zone (comportement legacy inchangé).
export function pdvInScope(
  pdv: Partial<Pick<PDV, 'zone' | 'quartier'>>,
  profile?: Profile | null
): boolean {
  const terrs = profileTerritories(profile)
  if (terrs.length && !terrs.includes(pdv.zone || '')) return false
  const quartiers = (profile?.quartiers_assignes || []).filter(Boolean)
  if (quartiers.length && !quartiers.includes(pdv.quartier || '')) return false
  return true
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

    return pdvInScope(pdv, profile)
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
