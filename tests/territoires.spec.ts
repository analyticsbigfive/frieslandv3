import { describe, it, expect } from 'vitest'
import { etendreTerritoires, grouperQuartiersParTerritoire, normaliserNomTerritoire } from '../utils/territoires'

const territoires = [{ code: 'MAR', name: 'Marcory' }, { code: 'YOP 1', name: 'Yopougon 1' }, { code: 'TRE', name: 'Treichville' }]
const aliases = [{ alias: 'MARCORY TREICHVILLE', territoire_code: 'MAR' }, { alias: 'YOPOUGON', territoire_code: 'YOP 1' }]

describe('etendreTerritoires', () => {
  it('ajoute les alias d\'un territoire réel du profil', () => {
    const r = etendreTerritoires(['MARCORY'], aliases, territoires)
    expect(r).toContain('MARCORY')
    expect(r).toContain('MARCORY TREICHVILLE')
    expect(r).toContain('Marcory')
  })

  it('résout un alias porté par le profil vers le territoire réel', () => {
    const r = etendreTerritoires(['YOPOUGON'], aliases, territoires)
    expect(r).toEqual(expect.arrayContaining(['YOPOUGON', 'Yopougon 1', 'YOPOUGON 1']))
  })

  it('sans alias, renvoie la liste telle quelle', () => {
    expect(etendreTerritoires(['TREICHVILLE'], [], territoires)).toEqual(['TREICHVILLE'])
  })

  it('normalise casse et accents', () => {
    expect(normaliserNomTerritoire('Adjamé ')).toBe('ADJAME')
  })
})

describe('grouperQuartiersParTerritoire', () => {
  const areas = [{ id: 1, name: 'Zone 4', territory_code: 'MAR' }, { id: 2, name: 'Niangon', territory_code: 'YOP 1' }]
  const quartiers = [{ id: 1, zone_id: 1, nom: 'BIETRY' }, { id: 2, zone_id: 1, nom: 'ANOUMABO' }, { id: 3, zone_id: 2, nom: 'NIANGON SUD' }]

  it('groupe par territoire, trie, et isole les inconnus dans Autres en dernier', () => {
    const g = grouperQuartiersParTerritoire(['NIANGON SUD', 'BIETRY', 'INCONNU', 'ANOUMABO'], quartiers, areas, territoires)
    expect(g.map(x => x.territoire)).toEqual(['Marcory', 'Yopougon 1', 'Autres'])
    expect(g[0].quartiers).toEqual(['ANOUMABO', 'BIETRY'])
    expect(g[2].quartiers).toEqual(['INCONNU'])
  })
})
