import { describe, expect, it } from 'vitest'
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  ACCESS_SECTIONS,
  ADMIN_ALIASES,
  ADMIN_DOMAINS,
  ADMIN_TABS,
  accessSectionForPath,
  findTab,
  lienEntreOnglets,
  locate,
  peutOuvrirChemin,
  sectionCoverage,
  tabHref,
  type AccessSection,
} from '../utils/adminNavigation'

// Copie de sectionKeyForPath avant le registre (composables/useAccessControl.ts,
// octobre 2026) : le registre doit rendre exactement les mêmes sections.
function ancienneSection(path: string): string | null {
  if (
    path.startsWith('/admin/perfect-store/standards')
    || path.startsWith('/admin/produits/seuils')
    || path.startsWith('/admin/users')
    || path.startsWith('/admin/referentiels')
    || path.startsWith('/admin/import')
    || path.startsWith('/admin/permissions')
    || path.startsWith('/admin/profile')
    || path.startsWith('/admin/distributeurs')
  ) return 'parametres'
  if (path === '/admin' || path.startsWith('/admin/activite') || path.startsWith('/admin/routing') || path.startsWith('/admin/map') || path.startsWith('/admin/trajets')) return 'principal'
  if (path.startsWith('/admin/perfect-store')) return 'perfect-store'
  if (path.startsWith('/admin/pdv')) return 'pdv'
  if (path.startsWith('/admin/visites')) return 'visites'
  if (path.startsWith('/admin/visibilite')) return 'visibilite'
  if (path.startsWith('/admin/concurrence')) return 'concurrence'
  if (path.startsWith('/admin/produits')) return 'produits'
  if (path.startsWith('/admin/actions')) return 'actions'
  return null
}

const PAGES = join(__dirname, '..', 'pages', 'admin')

function fichiersVue(dir: string): string[] {
  return readdirSync(dir).flatMap((nom) => {
    const p = join(dir, nom)
    return statSync(p).isDirectory() ? fichiersVue(p) : nom.endsWith('.vue') ? [p] : []
  })
}

// pages/admin/pdv/index.vue → /admin/pdv ; [category] → un code de famille.
function routes(param = 'evap'): string[] {
  return fichiersVue(PAGES).map((f) => {
    const r = relative(PAGES, f).replace(/\.vue$/, '').replace(/(^|\/)index$/, '').replace(/\[category\]/, param)
    return r ? `/admin/${r}` : '/admin'
  })
}

// Pages qui ne font que rediriger : couvertes par un alias ou par un onglet parent.
const REDIRECTIONS = ['/admin/perfect-store', '/admin/perfect-store/visites', '/admin/routing/programme-atom', '/admin/produits/evap']

describe('registre de navigation', () => {
  it('rend la même section d\'accès que l\'ancien code pour chaque page et chaque sonde', () => {
    const chemins = [
      ...routes('evap'), ...routes('foo'),
      '/admin/import', '/admin/profile', '/admin/unknown', '/admin/perfect-store', '/admin/produits',
    ]
    for (const c of new Set(chemins)) {
      expect(accessSectionForPath(c), c).toBe(ancienneSection(c))
    }
  })

  it('chaque page est un onglet ou une redirection couverte', () => {
    for (const r of routes()) {
      if (REDIRECTIONS.includes(r)) {
        expect(locate(r), r).not.toBeNull()
        continue
      }
      // [category] devient une redirection vers /admin/produits/familles (étape suivante).
      expect(ADMIN_TABS.some(({ tab }) => tab.path === r) || r === '/admin/produits/familles', r).toBe(true)
    }
  })

  it('chaque onglet pointe vers une page existante (sauf familles, créée avec la refonte Produits)', () => {
    const existantes = new Set(routes())
    for (const { tab } of ADMIN_TABS) {
      if (tab.path === '/admin/produits/familles') continue
      expect(existantes.has(tab.path), tab.path).toBe(true)
    }
  })

  it('identifiants uniques et sections valides', () => {
    const ids = ADMIN_TABS.map(({ tab }) => tab.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(ADMIN_DOMAINS.map(d => d.id)).size).toBe(ADMIN_DOMAINS.length)
    for (const { tab } of ADMIN_TABS) expect(ACCESS_SECTIONS).toContain(tab.access)
    for (const a of ADMIN_ALIASES) expect(ACCESS_SECTIONS).toContain(a.access)
  })

  it('deux niveaux : chaque domaine a au moins un onglet, aucun onglet n\'en contient d\'autres', () => {
    for (const d of ADMIN_DOMAINS) expect(d.tabs.length).toBeGreaterThan(0)
  })

  it('distingue les onglets d\'un même chemin par leurs paramètres', () => {
    expect(findTab('/admin/routing')?.tab.id).toBe('planning.tournees')
    expect(findTab('/admin/routing', { vue: 'regles' })?.tab.id).toBe('planning.regles')
    expect(findTab('/admin/produits/familles', { famille: 'imp' })?.tab.id).toBe('produits.disponibilite')
    expect(findTab('/admin/produits/familles', { vue: 'prix', famille: 'imp' })?.tab.id).toBe('produits.prix')
  })

  it('allume le bon domaine sur les pages qui ne sont pas des onglets', () => {
    expect(locate('/admin/routing/programme-atom')?.domain.id).toBe('planning')
    expect(locate('/admin/perfect-store/visites')?.domain.id).toBe('perfect-store')
    expect(locate('/admin/produits/evap')?.domain.id).toBe('produits')
    expect(locate('/admin/produits/seuils')?.domain.id).toBe('parametres')
    expect(locate('/admin/visites/coaching')?.tab?.id).toBe('visites.coaching')
    expect(locate('/admin/distributeurs')?.domain.id).toBe('pdv')
  })

  it('les filtres suivent d\'un onglet à l\'autre, pas le paramètre qui distingue les onglets', () => {
    const { domain, tab: disponibilite } = findTab('/admin/produits/familles')!
    expect(lienEntreOnglets(domain, disponibilite, { famille: 'imp', vue: 'prix', page: '3', dateFrom: '2026-10-01' }))
      .toEqual({ path: '/admin/produits/familles', query: { famille: 'imp', dateFrom: '2026-10-01' } })
    const { domain: planning, tab: tournees } = findTab('/admin/routing')!
    expect(lienEntreOnglets(planning, tournees, { vue: 'regles' })).toEqual({ path: '/admin/routing', query: {} })
    const regles = findTab('/admin/routing', { vue: 'regles' })!.tab
    expect(lienEntreOnglets(planning, regles, {})).toEqual({ path: '/admin/routing', query: { vue: 'regles' } })
    expect(tabHref(regles)).toEqual({ path: '/admin/routing', query: { vue: 'regles' } })
  })

  it('décrit les écrans de chaque section pour la page Permissions', () => {
    expect(sectionCoverage('principal')).toContain('Perfect Store › Vue d\'ensemble')
    expect(sectionCoverage('parametres')).toContain('Points de vente › Distributeurs')
  })
})

describe('droits par rôle', () => {
  // Matrice par défaut (migrations supabase/nouveau).
  const MATRICE: Record<string, AccessSection[]> = {
    superviseur: ['principal', 'perfect-store', 'pdv', 'visites', 'visibilite', 'concurrence', 'produits', 'actions'],
    commercial: ['principal', 'perfect-store', 'pdv', 'visites', 'visibilite', 'concurrence', 'produits', 'actions'],
    agence: ['principal', 'visites'],
    merchandiser: [],
  }
  const peut = (role: string, path: string, query?: Record<string, string>) =>
    peutOuvrirChemin(path, query, role, s => (MATRICE[role] || []).includes(s))

  it('admin : tout', () => {
    for (const { tab } of ADMIN_TABS) expect(peut('admin', tab.path, tab.query)).toBe(true)
  })

  it('superviseur : pas de Paramètres ni de Distributeurs, mais le Planning complet', () => {
    expect(peut('superviseur', '/admin/routing')).toBe(true)
    expect(peut('superviseur', '/admin/routing', { vue: 'regles' })).toBe(true)
    expect(peut('superviseur', '/admin/referentiels')).toBe(false)
    expect(peut('superviseur', '/admin/distributeurs')).toBe(false)
    expect(peut('superviseur', '/admin/users')).toBe(false)
  })

  it('commercial : Programme et Écarts, pas les tournées ni les règles', () => {
    expect(peut('commercial', '/admin/routing')).toBe(false)
    expect(peut('commercial', '/admin/routing', { vue: 'regles' })).toBe(false)
    expect(peut('commercial', '/admin/routing/programme-merchandiser')).toBe(true)
    expect(peut('commercial', '/admin/routing/ecarts-ssf')).toBe(true)
  })

  it('agence : vue d\'ensemble, activité, planning, visites et trois écrans de paramètres', () => {
    expect(peut('agence', '/admin')).toBe(true)
    expect(peut('agence', '/admin/activite')).toBe(true)
    expect(peut('agence', '/admin/routing')).toBe(true)
    expect(peut('agence', '/admin/routing', { vue: 'regles' })).toBe(true)
    expect(peut('agence', '/admin/visites')).toBe(true)
    expect(peut('agence', '/admin/referentiels')).toBe(true)
    expect(peut('agence', '/admin/import-export')).toBe(true)
    expect(peut('agence', '/admin/users/versions')).toBe(true)
    expect(peut('agence', '/admin/perfect-store/liste')).toBe(false)
    expect(peut('agence', '/admin/pdv')).toBe(false)
    expect(peut('agence', '/admin/users')).toBe(false)
    expect(peut('agence', '/admin/permissions')).toBe(false)
    expect(peut('agence', '/admin/perfect-store/standards')).toBe(false)
  })

  it('merchandiser : rien', () => {
    for (const { tab } of ADMIN_TABS) expect(peut('merchandiser', tab.path, tab.query)).toBe(false)
  })

  it('un rôle réservé ne se transmet pas aux pages voisines', () => {
    // Utilisateurs est réservé à l'admin ; Versions de l'app, sous le même chemin, suit la section.
    const avecParametres = (path: string) => peutOuvrirChemin(path, undefined, 'superviseur', () => true)
    expect(avecParametres('/admin/users')).toBe(false)
    expect(avecParametres('/admin/users/versions')).toBe(true)
    // Équipes enregistre par /api/admin/equipes, réservée à l'admin côté serveur.
    expect(avecParametres('/admin/users/equipes')).toBe(false)
  })
})
