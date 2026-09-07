import { describe, it, expect } from 'vitest'
import {
  analysePathForRole,
  canConsulterEquipe,
  canWriteTerrain,
  isCommercialRole,
  isPrivilegedProfile,
  isPrivilegedRole,
  homePathForRole,
  mobileNavItems,
} from '../utils/roles'

// Le commercial consulte en lecture seule (lot 2, 1.0.4). Ces règles doivent
// rester alignées sur peut_ecrire_terrain() et pdv_dans_perimetre_commercial()
// de la migration 20260907140100.
describe('rôles privilégiés', () => {
  it('admin et superviseur sont privilégiés, pas les rôles terrain', () => {
    expect(isPrivilegedRole('admin')).toBe(true)
    expect(isPrivilegedRole('superviseur')).toBe(true)
    expect(isPrivilegedRole('merchandiser')).toBe(false)
    expect(isPrivilegedRole('commercial')).toBe(false)
    expect(isPrivilegedRole(null)).toBe(false)
    expect(isPrivilegedRole(undefined)).toBe(false)
  })

  it('isPrivilegedProfile tolère un profil absent', () => {
    expect(isPrivilegedProfile(null)).toBe(false)
    expect(isPrivilegedProfile(undefined)).toBe(false)
    expect(isPrivilegedProfile({ role: 'admin' })).toBe(true)
    expect(isPrivilegedProfile({ role: 'commercial' })).toBe(false)
  })
})

describe('écriture terrain', () => {
  it('le commercial ne peut pas écrire, le merchandiser oui', () => {
    expect(canWriteTerrain('commercial')).toBe(false)
    expect(canWriteTerrain('merchandiser')).toBe(true)
    expect(canWriteTerrain('superviseur')).toBe(true)
    expect(canWriteTerrain('admin')).toBe(true)
    expect(canWriteTerrain(undefined)).toBe(false)
  })

  it('isCommercialRole', () => {
    expect(isCommercialRole('commercial')).toBe(true)
    expect(isCommercialRole('merchandiser')).toBe(false)
  })
})

// Cloisonnement descendant (demande du 7 sept. 2026) : le merchandiseur voit
// les actions qu'il doit réaliser et ses propres visites, pas celles de tout le
// monde, et aucun field coaching. Ces règles doivent rester alignées sur
// pdv_dans_perimetre() et field_coaching_select de la migration 20260910120000.
describe('consultation du travail des autres', () => {
  it("le merchandiseur est exclu des écrans d'encadrement", () => {
    expect(canConsulterEquipe('merchandiser')).toBe(false)
    expect(canConsulterEquipe('commercial')).toBe(true)
    expect(canConsulterEquipe('superviseur')).toBe(true)
    expect(canConsulterEquipe('admin')).toBe(true)
  })

  it('un rôle absent ou inconnu ne consulte rien', () => {
    expect(canConsulterEquipe(null)).toBe(false)
    expect(canConsulterEquipe(undefined)).toBe(false)
    expect(canConsulterEquipe('')).toBe(false)
    expect(canConsulterEquipe('directeur')).toBe(false)
  })

  it("consultation et écriture terrain sont deux droits disjoints", () => {
    // Le commercial consulte sans écrire ; le merchandiseur écrit sans consulter.
    expect(canConsulterEquipe('commercial')).toBe(true)
    expect(canWriteTerrain('commercial')).toBe(false)
    expect(canConsulterEquipe('merchandiser')).toBe(false)
    expect(canWriteTerrain('merchandiser')).toBe(true)
  })
})

describe('accueil par rôle', () => {
  it('admin et superviseur au dashboard, commercial à son équipe, terrain aux visites', () => {
    expect(homePathForRole('admin')).toBe('/admin')
    expect(homePathForRole('superviseur')).toBe('/admin')
    expect(homePathForRole('commercial')).toBe('/mobile/equipe')
    expect(homePathForRole('merchandiser')).toBe('/mobile')
    expect(homePathForRole(undefined)).toBe('/mobile')
  })
})

describe('navigation mobile', () => {
  it("le commercial n'a ni Routing ni saisie : équipe, PDV, actions, coaching", () => {
    const keys = mobileNavItems('commercial').map(i => i.key)
    expect(keys).toEqual(['equipe', 'pdv', 'actions', 'coaching', 'more'])
  })

  it('les autres rôles gardent les quatre onglets historiques', () => {
    for (const role of ['merchandiser', 'superviseur', 'admin', undefined]) {
      expect(mobileNavItems(role).map(i => i.key)).toEqual(['visites', 'routing', 'pdv', 'more'])
    }
  })
})

// Accès à l'analyse filtrée (demande du 7 sept. 2026). Volontairement distinct
// de homePathForRole : le geste quotidien du commercial reste mobile.
describe('accès à l’analyse', () => {
  it('encadrement et commercial y ont accès, pas le terrain', () => {
    expect(analysePathForRole('admin')).toBe('/admin')
    expect(analysePathForRole('superviseur')).toBe('/admin')
    expect(analysePathForRole('commercial')).toBe('/admin')
    expect(analysePathForRole('merchandiser')).toBeNull()
    expect(analysePathForRole(undefined)).toBeNull()
  })

  it('la page d’accueil du commercial reste son équipe', () => {
    // Non-régression : ouvrir l'analyse ne doit pas déplacer son atterrissage.
    expect(homePathForRole('commercial')).toBe('/mobile/equipe')
  })
})
