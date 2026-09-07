import { describe, it, expect } from 'vitest'
import {
  canWriteTerrain,
  isCommercialRole,
  isPrivilegedProfile,
  isPrivilegedRole,
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

describe('navigation mobile', () => {
  it('le commercial n\'a pas d\'onglet Routing et démarre sur les PDV', () => {
    const keys = mobileNavItems('commercial').map(i => i.key)
    expect(keys).toEqual(['pdv', 'visites', 'more'])
  })

  it('les autres rôles gardent les quatre onglets historiques', () => {
    for (const role of ['merchandiser', 'superviseur', 'admin', undefined]) {
      expect(mobileNavItems(role).map(i => i.key)).toEqual(['visites', 'routing', 'pdv', 'more'])
    }
  })
})
