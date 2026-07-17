export type AdminSection = 'visites' | 'perfect-store' | 'pdv' | 'visibilite' | 'concurrence' | 'produits' | 'actions' | 'parametres'

export type AdminSectionTab = {
  label: string
  to: string
  icon?: string
}

export const adminSectionLabels: Record<AdminSection, string> = {
  visites: 'des visites',
  'perfect-store': 'du Perfect Store',
  pdv: 'des points de vente',
  visibilite: 'de la visibilité',
  concurrence: 'de la concurrence',
  produits: 'des produits',
  actions: 'des actions',
  parametres: 'des paramètres',
}

export const adminSectionTabs: Record<AdminSection, AdminSectionTab[]> = {
  visites: [
    { label: 'Toutes les visites', to: '/admin/visites', icon: 'i-heroicons-clipboard-document-list' },
    { label: 'Évolution', to: '/admin/visites/evolution', icon: 'i-heroicons-chart-bar' },
    { label: 'Par catégorie', to: '/admin/visites/categories', icon: 'i-heroicons-squares-2x2' },
    { label: 'Commerciaux', to: '/admin/visites/commerciaux', icon: 'i-heroicons-users' },
  ],
  'perfect-store': [
    { label: 'Tableau de bord', to: '/admin', icon: 'i-heroicons-trophy' },
    { label: 'Liste par niveau', to: '/admin/perfect-store/liste', icon: 'i-heroicons-list-bullet' },
    { label: 'Visites', to: '/admin/perfect-store/visites', icon: 'i-heroicons-clipboard-document-list' },
  ],
  pdv: [
    { label: 'Liste', to: '/admin/pdv', icon: 'i-heroicons-map-pin' },
    { label: 'Répartition', to: '/admin/pdv/repartition', icon: 'i-heroicons-chart-bar' },
    { label: 'Évolution', to: '/admin/pdv/evolution', icon: 'i-heroicons-chart-bar' },
    { label: 'Distributeurs', to: '/admin/distributeurs', icon: 'i-heroicons-truck' },
  ],
  visibilite: [
    { label: 'Extérieure', to: '/admin/visibilite', icon: 'i-heroicons-eye' },
    { label: 'Récap. extérieure', to: '/admin/visibilite/exterieure-recap', icon: 'i-heroicons-clipboard-document-list' },
    { label: 'Intérieure', to: '/admin/visibilite/interieure', icon: 'i-heroicons-eye' },
    { label: 'Évolution intérieure', to: '/admin/visibilite/interieure-evolution', icon: 'i-heroicons-chart-bar' },
    { label: 'Intérieure GT', to: '/admin/visibilite/interieure-gt-recap', icon: 'i-heroicons-building-storefront' },
    { label: 'Intérieure MT', to: '/admin/visibilite/interieure-mt-recap', icon: 'i-heroicons-building-storefront' },
    { label: 'Promotion', to: '/admin/visibilite/promotion-recap', icon: 'i-heroicons-megaphone' },
  ],
  concurrence: [
    { label: 'Évolution', to: '/admin/concurrence', icon: 'i-heroicons-chart-bar' },
    { label: 'Récapitulatif', to: '/admin/concurrence/visibilite-recap', icon: 'i-heroicons-clipboard-document-list' },
    { label: 'Visibilité', to: '/admin/concurrence/visibilite-evolution', icon: 'i-heroicons-eye' },
  ],
  produits: [
    { label: 'Récapitulatif', to: '/admin/produits/recap', icon: 'i-heroicons-clipboard-document-list' },
    { label: 'Inventaire SKU', to: '/admin/produits/inventaire', icon: 'i-heroicons-cube' },
    { label: 'EVAP', to: '/admin/produits/evap', icon: 'i-heroicons-squares-2x2' },
    { label: 'IMP', to: '/admin/produits/imp', icon: 'i-heroicons-squares-2x2' },
    { label: 'SCM', to: '/admin/produits/scm', icon: 'i-heroicons-squares-2x2' },
    { label: 'UHT', to: '/admin/produits/uht', icon: 'i-heroicons-squares-2x2' },
    { label: 'Yaourt', to: '/admin/produits/yaourt', icon: 'i-heroicons-squares-2x2' },
    { label: 'Céréales', to: '/admin/produits/cereales', icon: 'i-heroicons-squares-2x2' },
  ],
  actions: [
    { label: 'Synthèse', to: '/admin/actions', icon: 'i-heroicons-bolt' },
    { label: 'Visites terrain', to: '/admin/visites', icon: 'i-heroicons-clipboard-document-list' },
  ],
  parametres: [
    { label: 'Standards Perfect Store', to: '/admin/perfect-store/standards', icon: 'i-heroicons-adjustments-horizontal' },
    { label: 'Seuils de stock', to: '/admin/produits/seuils', icon: 'i-heroicons-adjustments-horizontal' },
    { label: 'Référentiels', to: '/admin/referentiels', icon: 'i-heroicons-circle-stack' },
    { label: 'Utilisateurs', to: '/admin/users', icon: 'i-heroicons-users' },
    { label: 'Permissions', to: '/admin/permissions', icon: 'i-heroicons-shield-check' },
    { label: 'Import / Export', to: '/admin/import-export', icon: 'i-heroicons-arrow-up-tray' },
  ],
}

export function detectAdminSection(path: string): AdminSection | null {
  if (
    path.startsWith('/admin/perfect-store/standards')
    || path.startsWith('/admin/produits/seuils')
    || path.startsWith('/admin/referentiels')
    || path.startsWith('/admin/users')
    || path.startsWith('/admin/permissions')
    || path.startsWith('/admin/import-export')
  ) return 'parametres'
  if (path === '/admin' || path.startsWith('/admin/perfect-store')) return 'perfect-store'
  if (path.startsWith('/admin/visites')) return 'visites'
  if (path.startsWith('/admin/pdv') || path === '/admin/distributeurs') return 'pdv'
  if (path.startsWith('/admin/visibilite')) return 'visibilite'
  if (path.startsWith('/admin/concurrence')) return 'concurrence'
  if (path.startsWith('/admin/produits')) return 'produits'
  if (path.startsWith('/admin/actions')) return 'actions'
  return null
}
