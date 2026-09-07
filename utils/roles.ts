// utils/roles.ts
// Source unique des règles de rôle. Reflète les politiques RLS de
// supabase/nouveau/20260907140100_friesland_lot2_roles_rls_commercial.sql :
// ce que le client affiche doit correspondre à ce que la base autorise.
import type { UserRole } from '~/types'

type RoleLike = { role?: UserRole | string | null } | null | undefined

export const ROLES_PRIVILEGIES: readonly string[] = ['admin', 'superviseur']
export const ROLES_ECRITURE_TERRAIN: readonly string[] = ['admin', 'superviseur', 'merchandiser']

export function isPrivilegedRole(role?: string | null): boolean {
  return !!role && ROLES_PRIVILEGIES.includes(role)
}

export function isPrivilegedProfile(profile: RoleLike): boolean {
  return isPrivilegedRole(profile?.role)
}

export function isCommercialRole(role?: string | null): boolean {
  return role === 'commercial'
}

// Peut créer / modifier pdv, visites et photos (miroir de peut_ecrire_terrain()).
export function canWriteTerrain(role?: string | null): boolean {
  return !!role && ROLES_ECRITURE_TERRAIN.includes(role)
}

// Page d'atterrissage après connexion. Le commercial consulte son équipe ;
// les autres rôles terrain saisissent ; les privilégiés vont au dashboard web.
export function homePathForRole(role?: string | null): string {
  if (isPrivilegedRole(role)) return '/admin'
  if (isCommercialRole(role)) return '/mobile/equipe'
  return '/mobile'
}

export interface MobileNavItem {
  key: 'visites' | 'routing' | 'pdv' | 'equipe' | 'actions' | 'coaching' | 'more'
  label: string
  to: string
  ariaLabel: string
}

const NAV_VISITES: MobileNavItem = { key: 'visites', label: 'Visites', to: '/mobile', ariaLabel: 'Voir les visites' }
const NAV_ROUTING: MobileNavItem = { key: 'routing', label: 'Routing', to: '/mobile/routing', ariaLabel: 'Voir le routing' }
const NAV_PDV: MobileNavItem = { key: 'pdv', label: 'PDV', to: '/mobile/pdv', ariaLabel: 'Voir les points de vente' }
const NAV_MORE: MobileNavItem = { key: 'more', label: 'Plus', to: '/mobile/more', ariaLabel: 'Voir les autres écrans' }
const NAV_EQUIPE: MobileNavItem = { key: 'equipe', label: 'Équipe', to: '/mobile/equipe', ariaLabel: "Voir les visites de l'équipe" }
const NAV_ACTIONS: MobileNavItem = { key: 'actions', label: 'Actions', to: '/mobile/actions', ariaLabel: 'Voir les actions commerciales' }
const NAV_COACHING: MobileNavItem = { key: 'coaching', label: 'Coaching', to: '/mobile/coaching', ariaLabel: 'Remplir un field coaching' }

// Onglets du bas d'écran mobile selon le rôle. Le commercial ne saisit pas de
// visite et n'a pas de tournée : il suit son équipe, ses PDV, ses actions et
// remplit des field coachings (geste quotidien, d'où l'onglet plutôt que le
// menu « Plus »). Les rôles terrain gardent les quatre onglets historiques
// (les actions qui leur sont assignées sont dans « Plus » et sur la fiche PDV).
export function mobileNavItems(role?: string | null): MobileNavItem[] {
  if (isCommercialRole(role)) {
    return [NAV_EQUIPE, NAV_PDV, NAV_ACTIONS, NAV_COACHING, NAV_MORE]
  }
  return [NAV_VISITES, NAV_ROUTING, NAV_PDV, NAV_MORE]
}
