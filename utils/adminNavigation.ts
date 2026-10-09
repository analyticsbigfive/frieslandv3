// utils/adminNavigation.ts
// Registre unique de la navigation du back-office : domaines (menu latéral)
// et vues (barre d'onglets). Deux niveaux, jamais plus. Le menu latéral, la
// barre d'onglets, le fil d'Ariane, le titre de l'onglet du navigateur et le
// contrôle d'accès (useAccessControl, middleware/admin) lisent tous ce fichier.
//
// L'accès se déclare par onglet : un même domaine mélange plusieurs sections
// de la matrice role_section_access (Perfect Store : principal + perfect-store ;
// Points de vente : pdv + parametres pour Distributeurs). Les clés de section
// sont celles de la base ; ne pas les renommer sans migration.
//
// TypeScript pur, sans import Vue ni alias « ~ » : testé par vitest
// (tests/adminNavigation.spec.ts).

export type AccessSection =
  | 'principal'
  | 'perfect-store'
  | 'pdv'
  | 'visites'
  | 'visibilite'
  | 'concurrence'
  | 'produits'
  | 'actions'
  | 'parametres'

export const ACCESS_SECTIONS: AccessSection[] = [
  'principal', 'perfect-store', 'pdv', 'visites', 'visibilite', 'concurrence', 'produits', 'actions', 'parametres',
]

export type AdminRole = 'admin' | 'superviseur' | 'commercial' | 'merchandiser' | 'agence'

export type AdminGroupId = 'piloter' | 'terrain' | 'marche' | 'reglages'

export interface AdminTab {
  /** Identifiant stable « domaine.vue » (tests, toasts). */
  id: string
  /** Texte de l'onglet et dernier maillon du fil d'Ariane. */
  label: string
  /** Titre de la page (h1) quand il diffère du libellé de l'onglet. */
  title?: string
  /** Chemin de la page, sans paramètres. */
  path: string
  /** Paramètres qui distinguent cet onglet d'un autre sur le même chemin (ajoutés au lien). */
  query?: Record<string, string>
  /** Section de la matrice role_section_access. */
  access: AccessSection
  /** Réservé à ces rôles (l'admin passe toujours). Ne vaut que pour cette page exacte. */
  roles?: AdminRole[]
  /** Ouvert à ces rôles même si leur section est fermée (écrans ouverts « page par page »). */
  ouvertA?: AdminRole[]
  /** Paramètres d'URL conservés en passant d'un onglet à l'autre du domaine. */
  keepQuery?: string[]
  /** Phrase d'aide d'une ligne (sous le titre, dans le guide). */
  aide?: string
}

export interface AdminDomain {
  id: string
  label: string
  /** Icône Heroicons (UIcon). */
  icon: string
  group: AdminGroupId
  tabs: AdminTab[]
}

/** Routes qui existent sans être des onglets (redirections, anciens liens). */
export interface AdminAlias {
  path: string
  access: AccessSection
  /** Domaine allumé dans le menu sur ce chemin. */
  domain?: string
}

export const ADMIN_GROUPS: { id: AdminGroupId, label: string }[] = [
  { id: 'piloter', label: 'Piloter' },
  { id: 'terrain', label: 'Terrain' },
  { id: 'marche', label: 'Marché' },
  { id: 'reglages', label: 'Réglages' },
]

export const ADMIN_DOMAINS: AdminDomain[] = [
  // ---- Piloter ----
  {
    id: 'perfect-store',
    label: 'Perfect Store',
    icon: 'i-heroicons-trophy',
    group: 'piloter',
    tabs: [
      { id: 'perfect-store.ensemble', label: 'Vue d\'ensemble', title: 'Perfect Store', path: '/admin', access: 'principal', aide: 'Où en sont les points de vente par rapport au standard, sur la période choisie.' },
      { id: 'perfect-store.liste', label: 'Liste par niveau', path: '/admin/perfect-store/liste', access: 'perfect-store', aide: 'Chaque point de vente visité, son niveau et son score.' },
      { id: 'perfect-store.zones', label: 'Synthèse par zone', path: '/admin/perfect-store/zones', access: 'perfect-store', aide: 'Les niveaux par territoire et par quartier.' },
      { id: 'perfect-store.ecarts', label: 'Écarts au standard', path: '/admin/perfect-store/gaps', access: 'perfect-store', aide: 'Ce qui manque le plus souvent pour atteindre le niveau visé.' },
    ],
  },
  {
    id: 'activite',
    label: 'Activité',
    icon: 'i-heroicons-chart-bar-square',
    group: 'piloter',
    tabs: [
      { id: 'activite.vue', label: 'Activité', title: 'Activité du terrain', path: '/admin/activite', access: 'principal', aide: 'Visites, performance des équipes et points à traiter.' },
    ],
  },
  {
    id: 'carte',
    label: 'Carte et suivi',
    icon: 'i-heroicons-map',
    group: 'piloter',
    tabs: [
      { id: 'carte.pdv', label: 'Carte des PDV', title: 'Carte des points de vente', path: '/admin/map', access: 'principal', aide: 'Tous les points de vente sur la carte.' },
      { id: 'carte.suivi', label: 'Suivi des équipes', path: '/admin/trajets', access: 'principal', aide: 'Le trajet d\'une personne sur une journée et ses visites.' },
    ],
  },
  // ---- Terrain ----
  {
    id: 'planning',
    label: 'Planning',
    icon: 'i-heroicons-calendar-days',
    group: 'terrain',
    tabs: [
      { id: 'planning.tournees', label: 'Tournées', title: 'Tournées planifiées', path: '/admin/routing', access: 'principal', roles: ['admin', 'superviseur', 'agence'], aide: 'Les tournées prévues pour chaque merchandiser.' },
      { id: 'planning.regles', label: 'Règles récurrentes', path: '/admin/routing', query: { vue: 'regles' }, access: 'principal', roles: ['admin', 'superviseur', 'agence'], aide: 'Les règles qui génèrent les tournées chaque semaine ou chaque mois.' },
      { id: 'planning.programme', label: 'Programme merchandiser', path: '/admin/routing/programme-merchandiser', access: 'principal', keepQuery: ['direction'], aide: 'La couverture du mois des merchandisers d\'agence.' },
      { id: 'planning.ecarts', label: 'Écarts de tournée', title: 'Écarts entre merchandisers et vendeurs', path: '/admin/routing/ecarts-ssf', access: 'principal', aide: 'Les jours où le merchandiser et le vendeur du distributeur ne sont pas passés aux mêmes endroits.' },
    ],
  },
  {
    id: 'pdv',
    label: 'Points de vente',
    icon: 'i-heroicons-building-storefront',
    group: 'terrain',
    tabs: [
      { id: 'pdv.liste', label: 'Liste', title: 'Points de vente', path: '/admin/pdv', access: 'pdv', aide: 'Rechercher, créer et corriger les points de vente.' },
      { id: 'pdv.repartition', label: 'Répartition', title: 'Répartition des points de vente', path: '/admin/pdv/repartition', access: 'pdv' },
      { id: 'pdv.evolution', label: 'Évolution', title: 'Évolution des points de vente', path: '/admin/pdv/evolution', access: 'pdv' },
      { id: 'pdv.historique', label: 'Historique', title: 'Historique d\'un point de vente', path: '/admin/pdv/historique', access: 'pdv' },
      { id: 'pdv.distributeurs', label: 'Distributeurs', path: '/admin/distributeurs', access: 'parametres' },
    ],
  },
  {
    id: 'visites',
    label: 'Visites',
    icon: 'i-heroicons-clipboard-document-list',
    group: 'terrain',
    tabs: [
      { id: 'visites.toutes', label: 'Toutes les visites', title: 'Visites', path: '/admin/visites', access: 'visites', aide: 'Chaque visite enregistrée sur le terrain, avec son détail.' },
      { id: 'visites.evolution', label: 'Évolution', title: 'Évolution des visites', path: '/admin/visites/evolution', access: 'visites' },
      { id: 'visites.categories', label: 'Par catégorie', title: 'Visites par catégorie de point de vente', path: '/admin/visites/categories', access: 'visites' },
      { id: 'visites.commerciaux', label: 'Par commercial', title: 'Visites par commercial', path: '/admin/visites/commerciaux', access: 'visites' },
      { id: 'visites.coaching', label: 'Coaching terrain', path: '/admin/visites/coaching', access: 'visites' },
    ],
  },
  {
    id: 'actions',
    label: 'Actions',
    icon: 'i-heroicons-bolt',
    group: 'terrain',
    tabs: [
      { id: 'actions.synthese', label: 'Synthèse', title: 'Actions', path: '/admin/actions', access: 'actions' },
      { id: 'actions.commerciales', label: 'Actions commerciales', path: '/admin/actions/commerciales', access: 'actions' },
    ],
  },
  // ---- Marché ----
  {
    id: 'visibilite',
    label: 'Visibilité',
    icon: 'i-heroicons-eye',
    group: 'marche',
    tabs: [
      { id: 'visibilite.exterieure', label: 'Extérieure', title: 'Visibilité extérieure', path: '/admin/visibilite', access: 'visibilite' },
      { id: 'visibilite.exterieure-detail', label: 'Extérieure : détail', title: 'Visibilité extérieure, détail par point de vente', path: '/admin/visibilite/exterieure-recap', access: 'visibilite' },
      { id: 'visibilite.interieure', label: 'Intérieure', title: 'Visibilité intérieure', path: '/admin/visibilite/interieure', access: 'visibilite' },
      { id: 'visibilite.interieure-evolution', label: 'Intérieure : évolution', title: 'Visibilité intérieure, évolution', path: '/admin/visibilite/interieure-evolution', access: 'visibilite' },
      { id: 'visibilite.interieure-gt', label: 'Intérieure : boutiques', title: 'Visibilité intérieure, boutiques (GT)', path: '/admin/visibilite/interieure-gt-recap', access: 'visibilite' },
      { id: 'visibilite.interieure-mt', label: 'Intérieure : supermarchés', title: 'Visibilité intérieure, supermarchés (MT)', path: '/admin/visibilite/interieure-mt-recap', access: 'visibilite' },
      { id: 'visibilite.promotion', label: 'Promotion', title: 'Promotions en magasin', path: '/admin/visibilite/promotion-recap', access: 'visibilite' },
    ],
  },
  {
    id: 'concurrence',
    label: 'Concurrence',
    icon: 'i-heroicons-scale',
    group: 'marche',
    tabs: [
      { id: 'concurrence.evolution', label: 'Évolution', title: 'Concurrence', path: '/admin/concurrence', access: 'concurrence' },
      { id: 'concurrence.detail', label: 'Détail par point de vente', title: 'Concurrence, détail par point de vente', path: '/admin/concurrence/visibilite-recap', access: 'concurrence' },
      { id: 'concurrence.visibilite', label: 'Visibilité', title: 'Visibilité de la concurrence', path: '/admin/concurrence/visibilite-evolution', access: 'concurrence' },
    ],
  },
  {
    id: 'produits',
    label: 'Produits',
    icon: 'i-heroicons-cube',
    group: 'marche',
    tabs: [
      { id: 'produits.synthese', label: 'Synthèse', title: 'Produits', path: '/admin/produits/recap', access: 'produits' },
      { id: 'produits.disponibilite', label: 'Disponibilité', title: 'Disponibilité des produits', path: '/admin/produits/familles', access: 'produits', keepQuery: ['famille'] },
      { id: 'produits.prix', label: 'Prix', title: 'Prix relevés', path: '/admin/produits/familles', query: { vue: 'prix' }, access: 'produits', keepQuery: ['famille'] },
      { id: 'produits.releves', label: 'Détail par visite', title: 'Relevés produits par visite', path: '/admin/produits/familles', query: { vue: 'releves' }, access: 'produits', keepQuery: ['famille'] },
      { id: 'produits.inventaire', label: 'Inventaire', title: 'Inventaire des références', path: '/admin/produits/inventaire', access: 'produits' },
    ],
  },
  // ---- Réglages ----
  {
    id: 'parametres',
    label: 'Paramètres',
    icon: 'i-heroicons-adjustments-horizontal',
    group: 'reglages',
    tabs: [
      { id: 'parametres.referentiels', label: 'Référentiels', path: '/admin/referentiels', access: 'parametres', ouvertA: ['agence'], aide: 'Les listes de référence : territoires, agences, distributeurs, catégories…' },
      { id: 'parametres.standards', label: 'Standards Perfect Store', path: '/admin/perfect-store/standards', access: 'parametres' },
      { id: 'parametres.produits', label: 'Produits du formulaire', path: '/admin/produits/seuils', access: 'parametres' },
      { id: 'parametres.utilisateurs', label: 'Utilisateurs', path: '/admin/users', access: 'parametres', roles: ['admin'] },
      { id: 'parametres.equipes', label: 'Équipes', path: '/admin/users/equipes', access: 'parametres' },
      { id: 'parametres.permissions', label: 'Permissions', path: '/admin/permissions', access: 'parametres', roles: ['admin'] },
      { id: 'parametres.versions', label: 'Versions de l\'app', path: '/admin/users/versions', access: 'parametres', ouvertA: ['agence'] },
      { id: 'parametres.import-export', label: 'Import / Export', path: '/admin/import-export', access: 'parametres', ouvertA: ['agence'] },
    ],
  },
]

export const ADMIN_ALIASES: AdminAlias[] = [
  { path: '/admin/perfect-store', access: 'perfect-store', domain: 'perfect-store' },
  { path: '/admin/produits', access: 'produits', domain: 'produits' },
  { path: '/admin/import', access: 'parametres', domain: 'parametres' },
  { path: '/admin/profile', access: 'parametres' },
]

export const ADMIN_TABS: { domain: AdminDomain, tab: AdminTab }[] =
  ADMIN_DOMAINS.flatMap(domain => domain.tabs.map(tab => ({ domain, tab })))

/** Le chemin `p` couvre `path` (même chemin, ou parent par segments entiers). « /admin » ne couvre que lui-même. */
function couvre(p: string, path: string) {
  if (p === '/admin') return path === '/admin'
  return path === p || path.startsWith(p + '/')
}

type Query = Record<string, unknown>

function valeurQuery(q: Query | undefined, cle: string): string | undefined {
  const v = q?.[cle]
  if (Array.isArray(v)) return v[0] == null ? undefined : String(v[0])
  return v == null ? undefined : String(v)
}

function queryCorrespond(tab: AdminTab, query?: Query) {
  return Object.entries(tab.query || {}).every(([k, v]) => valeurQuery(query, k) === v)
}

/**
 * Onglet de la page exacte : même chemin, et le plus précis des onglets dont
 * les paramètres correspondent (/admin/routing?vue=regles → Règles récurrentes).
 */
export function findTab(path: string, query?: Query): { domain: AdminDomain, tab: AdminTab } | null {
  const candidats = ADMIN_TABS.filter(({ tab }) => tab.path === path && queryCorrespond(tab, query))
  if (!candidats.length) return null
  return candidats.reduce((a, b) =>
    Object.keys(b.tab.query || {}).length > Object.keys(a.tab.query || {}).length ? b : a)
}

/**
 * Domaine (et onglet le plus proche) d'un chemin, y compris pour une page qui
 * n'est pas un onglet (anciens liens, redirections) : onglet exact d'abord,
 * puis le parent le plus long parmi les onglets et les alias.
 */
export function locate(path: string, query?: Query): { domain: AdminDomain, tab: AdminTab | null } | null {
  const exact = findTab(path, query)
  if (exact) return exact
  let meilleur: { domain: AdminDomain, tab: AdminTab | null, longueur: number } | null = null
  for (const { domain, tab } of ADMIN_TABS) {
    if (tab.query) continue
    if (couvre(tab.path, path) && (!meilleur || tab.path.length > meilleur.longueur)) {
      meilleur = { domain, tab, longueur: tab.path.length }
    }
  }
  for (const alias of ADMIN_ALIASES) {
    const domain = ADMIN_DOMAINS.find(d => d.id === alias.domain)
    if (domain && couvre(alias.path, path) && (!meilleur || alias.path.length > meilleur.longueur)) {
      meilleur = { domain, tab: null, longueur: alias.path.length }
    }
  }
  return meilleur ? { domain: meilleur.domain, tab: meilleur.tab } : null
}

/**
 * Section d'accès d'un chemin : le chemin d'onglet ou d'alias le plus long qui
 * le couvre. null pour un chemin inconnu (traité comme « parametres » par
 * useAccessControl).
 */
export function accessSectionForPath(path: string): AccessSection | null {
  let meilleur: { access: AccessSection, longueur: number } | null = null
  const candidats = [
    ...ADMIN_TABS.map(({ tab }) => ({ path: tab.path, access: tab.access })),
    ...ADMIN_ALIASES.map(a => ({ path: a.path, access: a.access })),
  ]
  for (const c of candidats) {
    if (couvre(c.path, path) && (!meilleur || c.path.length > meilleur.longueur)) {
      meilleur = { access: c.access, longueur: c.path.length }
    }
  }
  return meilleur?.access ?? null
}

/**
 * Un rôle peut-il ouvrir cet onglet ? L'admin passe toujours. `roles` restreint,
 * `ouvertA` ouvre au-delà de la matrice, sinon la section décide.
 */
export function peutOuvrirOnglet(
  tab: AdminTab,
  role: string | null | undefined,
  canAccessSection: (section: AccessSection) => boolean,
): boolean {
  if (!role) return false
  if (role === 'admin') return true
  if (tab.roles && !tab.roles.includes(role as AdminRole)) return false
  if (tab.ouvertA?.includes(role as AdminRole)) return true
  return canAccessSection(tab.access)
}

/**
 * Accès à une page : l'onglet exact s'il existe (avec ses restrictions de
 * rôle), sinon la section du chemin ; un chemin inconnu vaut « parametres ».
 */
export function peutOuvrirChemin(
  path: string,
  query: Query | undefined,
  role: string | null | undefined,
  canAccessSection: (section: AccessSection) => boolean,
): boolean {
  if (!role) return false
  if (role === 'admin') return true
  const exact = findTab(path, query)
  if (exact) return peutOuvrirOnglet(exact.tab, role, canAccessSection)
  return canAccessSection(accessSectionForPath(path) ?? 'parametres')
}

/** Lien d'un onglet : ses propres paramètres plus ceux de `keepQuery` déjà présents dans l'URL. */
export function tabHref(tab: AdminTab, currentQuery?: Query): { path: string, query: Record<string, string> } {
  const query: Record<string, string> = {}
  for (const cle of tab.keepQuery || []) {
    const v = valeurQuery(currentQuery, cle)
    if (v != null && v !== '') query[cle] = v
  }
  Object.assign(query, tab.query || {})
  return { path: tab.path, query }
}

/** Écrans couverts par une section, en « Domaine › Vue » (page Permissions). */
export function sectionCoverage(section: AccessSection): string[] {
  return ADMIN_TABS
    .filter(({ tab }) => tab.access === section)
    .map(({ domain, tab }) => (domain.tabs.length > 1 ? `${domain.label} › ${tab.label}` : domain.label))
}

/** Écrans ouverts à un rôle hors de la matrice (`ouvertA`), en « Domaine › Vue ». */
export function ecransOuvertsA(role: AdminRole): string[] {
  return ADMIN_TABS
    .filter(({ tab }) => tab.ouvertA?.includes(role))
    .map(({ domain, tab }) => `${domain.label} › ${tab.label}`)
}
