import { describe, it, expect } from 'vitest'
import { codeTerritoireDuNom, etendreTerritoires, grouperQuartiersParTerritoire, normaliserNomTerritoire, resoudreTerritoirePdv } from '../utils/territoires'

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

describe('codeTerritoireDuNom', () => {
  const refs = [{ code: 'KOU', name: 'koumassi' }, { code: 'ADJ', name: 'Adjame' }, ...territoires]
  it('trouve un territoire écrit dans une autre casse ou avec accents', () => {
    expect(codeTerritoireDuNom('KOUMASSI', refs)).toBe('KOU')
    expect(codeTerritoireDuNom('ADJAMÉ', refs)).toBe('ADJ')
  })
  it('passe par les alias', () => {
    expect(codeTerritoireDuNom('marcory treichville', refs, aliases)).toBe('MAR')
  })
  it('renvoie vide si rien ne correspond', () => {
    expect(codeTerritoireDuNom('PORT-BOUET', refs, aliases)).toBe('')
  })
})

describe('resoudreTerritoirePdv', () => {
  const refs = [{ code: 'KOU', name: 'koumassi' }, { code: 'BIN', name: 'Bingerville' }, ...territoires]
  const areas = [
    { id: 1, name: 'AUTRES KOUMASSI', territory_code: 'KOU' },
    { id: 2, name: 'SICOGI BINGER', territory_code: 'BIN' },
    { id: 3, name: 'Remblais', territory_code: 'MAR' },
  ]
  const quartiers = [
    { id: 10, zone_id: 2, nom: 'SICOGI' },
    { id: 11, zone_id: 1, nom: 'SICOGI' },
    { id: 12, zone_id: 3, nom: 'Remblais' },
  ]
  const base = { quartiers, areas, territoires: refs, aliases }

  it('profil en MAJUSCULES : garde le territoire du profil pour un quartier présent ailleurs', () => {
    expect(resoudreTerritoirePdv({ ...base, zone: 'KOUMASSI', quartier: 'SICOGI', territoiresProfil: ['KOUMASSI'] })).toBe('KOU')
  })
  it('profil multi-territoires : prend le territoire du quartier choisi', () => {
    expect(resoudreTerritoirePdv({ ...base, zone: 'TREICHVILLE', quartier: 'Remblais', territoiresProfil: ['TREICHVILLE', 'Marcory'] })).toBe('MAR')
  })
  it('quartier inconnu : territoire de la zone du profil', () => {
    expect(resoudreTerritoirePdv({ ...base, zone: 'KOUMASSI', quartier: 'Inconnu', territoiresProfil: [] })).toBe('KOU')
  })
})
