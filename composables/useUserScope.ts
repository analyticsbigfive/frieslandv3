import type { PDV, Profile, Visite } from '~/types'
import { isCommercialRole, isPrivilegedProfile, isPrivilegedRole } from '~/utils/roles'
import { etendreTerritoires, partagentUnTerritoire, type TerritoireAlias, type TerritoireRef } from '~/utils/territoires'

// Territoires effectifs d'un profil : liste multi (territoires_assignes),
// fallback mono legacy (zone_assignee) si la liste est vide.
export function profileTerritories(profile?: Profile | null): string[] {
  const multi = (profile?.territoires_assignes || []).filter(Boolean)
  if (multi.length) return multi
  return profile?.zone_assignee ? [profile.zone_assignee] : []
}

// Territoires + alias (libellés hors référentiel rattachés) : c'est cette
// liste qui filtre les PDV, comme pdv_ids_perimetre() côté base.
export function profileTerritoriesEtendus(
  profile: Profile | null | undefined,
  aliases: TerritoireAlias[],
  territoires: TerritoireRef[],
): string[] {
  return etendreTerritoires(profileTerritories(profile), aliases, territoires)
}

// PDV ∈ périmètre d'un user ? (zone ∈ territoires) ET (quartiers vide OU quartier ∈ quartiers).
// Aucun territoire ⇒ pas de contrainte de zone (comportement legacy inchangé).
// Un PDV sans quartier reste visible dès que la zone matche : le filtre quartier
// ne doit pas exclure les PDV non renseignés (même règle côté serveur dans stores/pdv.ts).
export function pdvInScope(
  pdv: Partial<Pick<PDV, 'zone' | 'quartier'>>,
  profile?: Profile | null,
  geo?: { aliases: TerritoireAlias[]; territoires: TerritoireRef[] },
): boolean {
  const terrs = geo ? profileTerritoriesEtendus(profile, geo.aliases, geo.territoires) : profileTerritories(profile)
  if (terrs.length && !terrs.includes(pdv.zone || '')) return false
  const quartiers = (profile?.quartiers_assignes || []).filter(Boolean)
  if (quartiers.length && pdv.quartier && !quartiers.includes(pdv.quartier)) return false
  return true
}

export function useUserScope() {
  const authStore = useAuthStore()
  const user = useSupabaseUser()
  const { territoireAliases, territories } = useReferentiels()
  const geo = () => ({ aliases: territoireAliases.value, territoires: territories.value })

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

    return pdvInScope(pdv, profile, geo())
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

    // Commercial (lot 3.3) : périmètre territorial, comme la RLS. Sans PDV
    // joint, on fait confiance à la ligne que la base a laissée passer.
    if (isCommercialRole(profile.role)) {
      const pdv = (visite as any).pdv
      return pdv && typeof pdv === 'object' ? pdvInScope(pdv, profile, geo()) : true
    }

    return false
  }

  function filterContacts<
    T extends Partial<Profile> & {
      zone_assignee?: string | null
      region?: string | null
      is_active?: boolean | null
      commercial_id?: string | null
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

      if (isPrivilegedRole(contact.role)) {
        return true
      }

      // Merchandiseur assigné à ce commercial : visible quel que soit le territoire.
      if ((contact as any).commercial_id && (contact as any).commercial_id === profile.id) {
        return true
      }

      // Périmètre territorial, alias compris — la comparaison sur le seul
      // zone_assignee historique masquait les collègues des autres territoires
      // d'un profil multi-territoires.
      const miens = profileTerritoriesEtendus(profile, territoireAliases.value, territories.value)
      const siens = (contact.territoires_assignes || []).filter(Boolean)
      const territoiresContact = siens.length ? siens : (contact.zone_assignee ? [contact.zone_assignee] : [])
      if (partagentUnTerritoire(miens, territoiresContact)) {
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
