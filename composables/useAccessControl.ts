// composables/useAccessControl.ts
// RBAC: contrôle d'accès par rôle aux sections du dashboard admin.
import type { UserRole } from '~/types'
import { accessSectionForPath, peutOuvrirChemin, sectionCoverage, type AccessSection, type AdminRole } from '~/utils/adminNavigation'

export interface DashboardSection {
  key: AccessSection
  title: string
  /** Écrans couverts, en « Domaine › Vue » (lus dans utils/adminNavigation.ts). */
  ecrans: string[]
  /**
   * Par rôle, les écrans de la ligne que la case n'ouvre PAS (onglets réservés
   * à d'autres rôles). Absent quand la case ouvre toute la ligne.
   */
  exclusParRole: Partial<Record<UserRole, string[]>>
}

// Sections de la matrice role_section_access : les clés sont celles de la
// base. Le libellé dit ce que la case ouvre ; la liste des écrans vient du
// registre de navigation, pour rester exacte quand un écran est ajouté.
const SECTIONS: { key: AccessSection, title: string }[] = [
  { key: 'principal', title: 'Accueil et pilotage' },
  { key: 'perfect-store', title: 'Perfect Store (détail)' },
  { key: 'pdv', title: 'Points de vente' },
  { key: 'visites', title: 'Visites' },
  { key: 'visibilite', title: 'Visibilité' },
  { key: 'concurrence', title: 'Concurrence' },
  { key: 'produits', title: 'Produits' },
  { key: 'actions', title: 'Actions' },
  { key: 'parametres', title: 'Paramètres' },
]
export const MANAGED_ROLES: UserRole[] = ['admin', 'superviseur', 'commercial', 'agence', 'merchandiser']

export const DASHBOARD_SECTIONS: DashboardSection[] = SECTIONS.map((s) => {
  const ecrans = sectionCoverage(s.key)
  const exclusParRole: Partial<Record<UserRole, string[]>> = {}
  for (const role of MANAGED_ROLES) {
    const ouverts = new Set(sectionCoverage(s.key, role as AdminRole))
    const exclus = ecrans.filter(e => !ouverts.has(e))
    if (exclus.length) exclusParRole[role] = exclus
  }
  return { ...s, ecrans, exclusParRole }
})

// Section d'un chemin /admin/... : registre de navigation (le chemin d'onglet
// ou d'alias le plus précis). null pour un chemin inconnu.
export function sectionKeyForPath(path: string): string | null {
  return accessSectionForPath(path)
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

  // Accès à une page : l'onglet exact s'il existe (rôles réservés, écrans
  // ouverts « page par page »), sinon la section du chemin. Chemin non déclaré
  // dans le registre : REFUS par défaut (vaut « parametres ») — l'admin garde
  // son court-circuit.
  function canAccessPath(path: string, role?: string, query?: Record<string, unknown>): boolean {
    const r = role || authStore.profile?.role
    return peutOuvrirChemin(path, query, r, section => canAccessSection(section, r))
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
