// composables/useAccessControl.ts
// RBAC: contrôle d'accès par rôle aux sections du dashboard admin.
import type { UserRole } from '~/types'

export interface DashboardSection {
  key: string
  title: string
}

// Sections du dashboard (alignées sur les groupes de la sidebar).
export const DASHBOARD_SECTIONS: DashboardSection[] = [
  { key: 'principal', title: 'Principal' },
  { key: 'perfect-store', title: 'Perfect Store' },
  { key: 'pdv', title: 'PDV' },
  { key: 'visites', title: 'Visites' },
  { key: 'visibilite', title: 'Visibilité' },
  { key: 'concurrence', title: 'Concurrence' },
  { key: 'produits', title: 'Produits' },
  { key: 'actions', title: 'Actions' },
  { key: 'administration', title: 'Administration' },
]

export const MANAGED_ROLES: UserRole[] = ['admin', 'superviseur', 'merchandiser', 'commercial']

// Résout un chemin /admin/... vers une clé de section.
export function sectionKeyForPath(path: string): string | null {
  if (path === '/admin' || path.startsWith('/admin/routing')) return 'principal'
  if (path.startsWith('/admin/perfect-store')) return 'perfect-store'
  if (path.startsWith('/admin/pdv')) return 'pdv'
  if (path.startsWith('/admin/visites')) return 'visites'
  if (path.startsWith('/admin/visibilite')) return 'visibilite'
  if (path.startsWith('/admin/concurrence')) return 'concurrence'
  if (path.startsWith('/admin/produits')) return 'produits'
  if (path.startsWith('/admin/actions')) return 'actions'
  if (
    path.startsWith('/admin/users') ||
    path.startsWith('/admin/referentiels') ||
    path.startsWith('/admin/import') ||
    path.startsWith('/admin/map') ||
    path.startsWith('/admin/permissions') ||
    path.startsWith('/admin/profile')
  ) return 'administration'
  return null
}

export function useAccessControl() {
  const supabase = useSupabaseClient()
  const authStore = useAuthStore()

  // Singleton SSR-friendly: matrice role -> section -> bool
  const access = useState<Record<string, Record<string, boolean>>>('rbac-access', () => ({}))
  const loaded = useState<boolean>('rbac-loaded', () => false)

  async function fetchAccess(force = false) {
    if (loaded.value && !force) return
    const { data, error } = await supabase
      .from('role_section_access')
      .select('role, section, can_access')
    if (error) {
      console.error('useAccessControl: échec chargement matrice', error)
      return
    }
    const map: Record<string, Record<string, boolean>> = {}
    for (const row of (data || []) as any[]) {
      if (!map[row.role]) map[row.role] = {}
      map[row.role][row.section] = row.can_access
    }
    access.value = map
    loaded.value = true
  }

  function canAccessSection(sectionKey: string, role?: string): boolean {
    const r = role || authStore.profile?.role
    if (!r) return false
    if (r === 'admin') return true // admin: accès total garanti (anti-lockout)
    const roleMap = access.value[r]
    // Matrice non configurée (migration 011 pas encore lancée) → comportement hérité (accès)
    if (!roleMap || Object.keys(roleMap).length === 0) return true
    return !!roleMap[sectionKey]
  }

  function canAccessPath(path: string, role?: string): boolean {
    const key = sectionKeyForPath(path)
    if (!key) return true // chemin non mappé: ne pas bloquer
    return canAccessSection(key, role)
  }

  async function updateAccess(role: string, sectionKey: string, value: boolean) {
    const { error } = await supabase
      .from('role_section_access')
      .upsert({ role, section: sectionKey, can_access: value, updated_at: new Date().toISOString() }, { onConflict: 'role,section' })
    if (error) throw error
    if (!access.value[role]) access.value[role] = {}
    access.value[role] = { ...access.value[role], [sectionKey]: value }
  }

  return {
    access,
    loaded,
    fetchAccess,
    canAccessSection,
    canAccessPath,
    updateAccess,
    DASHBOARD_SECTIONS,
    MANAGED_ROLES,
  }
}
