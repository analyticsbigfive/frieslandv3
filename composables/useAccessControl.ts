// composables/useAccessControl.ts
// RBAC: contrôle d'accès par rôle aux sections du dashboard admin.
import type { UserRole } from '~/types'

export interface DashboardSection {
  key: string
  title: string
}

// Sections du dashboard (alignées sur les groupes de la sidebar).
// Statistiques : pdv, visites, perfect-store, visibilite, concurrence, produits.
// Paramétrage : parametres (standards, seuils, référentiels, utilisateurs, permissions, import/export).
export const DASHBOARD_SECTIONS: DashboardSection[] = [
  { key: 'principal', title: 'Principal' },
  { key: 'pdv', title: 'Stats · PDV' },
  { key: 'visites', title: 'Stats · Visites & commerciaux' },
  { key: 'perfect-store', title: 'Stats · Perfect Store' },
  { key: 'visibilite', title: 'Stats · Visibilité' },
  { key: 'concurrence', title: 'Stats · Concurrence' },
  { key: 'produits', title: 'Stats · Produits' },
  { key: 'actions', title: 'Actions' },
  { key: 'parametres', title: 'Paramètres' },
]

export const MANAGED_ROLES: UserRole[] = ['admin', 'superviseur', 'merchandiser', 'commercial']

// Résout un chemin /admin/... vers une clé de section.
// Les chemins de paramétrage priment sur leur section statistique parente
// (ex. /admin/perfect-store/standards est un paramètre, pas une stat).
export function sectionKeyForPath(path: string): string | null {
  if (
    path.startsWith('/admin/perfect-store/standards') ||
    path.startsWith('/admin/produits/seuils') ||
    path.startsWith('/admin/users') ||
    path.startsWith('/admin/referentiels') ||
    path.startsWith('/admin/import') ||
    path.startsWith('/admin/permissions') ||
    path.startsWith('/admin/profile')
  ) return 'parametres'
  if (path === '/admin' || path.startsWith('/admin/routing') || path.startsWith('/admin/map') || path.startsWith('/admin/trajets')) return 'principal'
  if (path.startsWith('/admin/perfect-store')) return 'perfect-store'
  if (path.startsWith('/admin/pdv')) return 'pdv'
  if (path.startsWith('/admin/visites')) return 'visites'
  if (path.startsWith('/admin/visibilite')) return 'visibilite'
  if (path.startsWith('/admin/concurrence')) return 'concurrence'
  if (path.startsWith('/admin/produits')) return 'produits'
  if (path.startsWith('/admin/actions')) return 'actions'
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
      // Compat : les anciennes lignes 'administration' valent pour 'parametres',
      // sans écraser une ligne 'parametres' explicite.
      const section = row.section === 'administration' ? 'parametres' : row.section
      if (!map[row.role]) map[row.role] = {}
      if (row.section !== 'administration' || !(section in map[row.role])) {
        map[row.role][section] = row.can_access
      }
    }
    access.value = map
    loaded.value = true
  }

  function canAccessSection(sectionKey: string, role?: string): boolean {
    const r = role || authStore.profile?.role
    if (!r) return false
    if (r === 'admin') return true // admin: accès total garanti (anti-lockout)
    const roleMap = access.value[r]
    // Matrice absente/incomplète : refus par défaut pour éviter un accès implicite.
    // Le superviseur garde seulement les sections opérationnelles historiques.
    if (!roleMap || Object.keys(roleMap).length === 0) {
      return r === 'superviseur' && sectionKey !== 'parametres'
    }
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
