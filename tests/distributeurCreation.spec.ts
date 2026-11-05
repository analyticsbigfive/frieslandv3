import { describe, it, expect } from 'vitest'
import { distributeursDuRouting, pointsDeVisite, regleDistributeur, zoneDuPointVisite, type LigneRoutingMerch } from '../utils/distributeurCreation'

const ligne = (distributeur: string | null, point_visite = 'Petit marché', commune = 'Marcory', zone: string | null = null): LigneRoutingMerch =>
  ({ distributeur, point_visite, commune, zone, latitude: 5.3, longitude: -3.98 })

const locaux = [{ name: 'SIDECOM', national: false }, { name: 'PRODISMA', national: false }]
const nationaux = [{ name: 'ADIALEA RCI', national: true }, { name: 'DISTRI NATIONAL', national: true }]

describe('regleDistributeur', () => {
  it('compte avec un seul distributeur dans son routing : imposé', () => {
    const r = regleDistributeur({ routing: [ligne('SIDECOM'), ligne('SIDECOM', 'Biétry'), ligne(' SIDECOM ', 'Hibiscus')], locaux, nationaux })
    expect(r.origine).toBe('routing')
    expect(r.options).toEqual([{ value: 'SIDECOM', label: 'SIDECOM' }])
    expect(r.choixOffice).toBe('SIDECOM')
    expect(r.impose).toBe(true)
    expect(r.obligatoire).toBe(true)
  })

  it('compte avec plusieurs distributeurs : seulement ceux du routing, aucun par défaut', () => {
    const r = regleDistributeur({ routing: [ligne('SIDECOM'), ligne('BOUSSOURA SARL', 'Biafra')], locaux, nationaux })
    expect(r.origine).toBe('routing')
    expect(r.options.map(o => o.value)).toEqual(['BOUSSOURA SARL', 'SIDECOM'])
    expect(r.options.map(o => o.value)).not.toContain('ADIALEA RCI')
    expect(r.choixOffice).toBe('')
    expect(r.impose).toBe(false)
    expect(r.obligatoire).toBe(true)
  })

  it('compte sans routing : locaux + nationaux, choisi d\'office seulement s\'il est seul, jamais un national', () => {
    const r = regleDistributeur({ routing: [], locaux, nationaux })
    expect(r.origine).toBe('referentiel')
    expect(r.options.map(o => o.label)).toEqual(['SIDECOM', 'PRODISMA', 'ADIALEA RCI · national', 'DISTRI NATIONAL · national'])
    // Deux distributeurs dans la zone : l'agent choisit.
    expect(r.choixOffice).toBe('')
    expect(r.obligatoire).toBe(true)

    const seul = regleDistributeur({ routing: [], locaux: [locaux[0]!], nationaux })
    expect(seul.choixOffice).toBe('SIDECOM')

    const sansLocal = regleDistributeur({ routing: [], locaux: [], nationaux })
    expect(sansLocal.choixOffice).toBe('')
    expect(sansLocal.options.map(o => o.value)).toEqual(['ADIALEA RCI', 'DISTRI NATIONAL'])
    expect(sansLocal.obligatoire).toBe(true)
  })

  it('hors ligne, routing pas chargé : rien de choisi d\'office', () => {
    const r = regleDistributeur({ routing: null, locaux, nationaux })
    expect(r.origine).toBe('referentiel')
    expect(r.choixOffice).toBe('')
    expect(r.options.length).toBe(4)
    expect(r.obligatoire).toBe(true)
  })

  it('routing sans distributeur renseigné : traité comme un compte sans routing', () => {
    const r = regleDistributeur({ routing: [ligne(null), ligne('  ')], locaux: [locaux[0]!], nationaux })
    expect(r.origine).toBe('referentiel')
    expect(r.choixOffice).toBe('SIDECOM')
  })

  it('rien à proposer (référentiels pas chargés hors ligne) : ne bloque pas la création', () => {
    const r = regleDistributeur({ routing: null, locaux: [], nationaux: [] })
    expect(r.options).toEqual([])
    expect(r.choixOffice).toBe('')
    expect(r.obligatoire).toBe(false)
  })
})

describe('distributeursDuRouting', () => {
  it('dédoublonne, ignore les vides, trie', () => {
    expect(distributeursDuRouting([ligne('SIDECOM'), ligne(null), ligne('ABC'), ligne('SIDECOM')])).toEqual(['ABC', 'SIDECOM'])
    expect(distributeursDuRouting(null)).toEqual([])
  })
})

describe('pointsDeVisite', () => {
  it('un point par nom, libellé « point · commune », trié', () => {
    const r = pointsDeVisite([
      ligne('SIDECOM', 'Petit marché', 'Marcory'),
      ligne('SIDECOM', 'Biafra', 'Treichville'),
      ligne('SIDECOM', 'petit marche ', 'Marcory'),
      ligne('SIDECOM', null, 'Marcory'),
    ])
    expect(r.map(p => p.label)).toEqual(['Biafra · Treichville', 'Petit marché · Marcory'])
    expect(r.map(p => p.value)).toEqual(['Biafra', 'Petit marché'])
    expect(r[1].commune).toBe('Marcory')
  })

  it('sans routing : aucun point', () => {
    expect(pointsDeVisite(null)).toEqual([])
    expect(pointsDeVisite([])).toEqual([])
  })
})

describe('zoneDuPointVisite', () => {
  const territoires = [
    { code: 'MAR', name: 'MARCORY' },
    { code: 'TRE', name: 'TREICHVILLE' },
    { code: 'ABO 1', name: 'ABOBO 1' },
    { code: 'ABO 2', name: 'ABOBO 2' },
    { code: 'YOP 1', name: 'YOPOUGON 1' },
  ]
  const aliases = [{ alias: 'Marcory', territoire_code: 'MAR' }, { alias: 'MARCORY TREICHVILLE', territoire_code: 'TRE' }]
  const areas = [{ id: 1, name: 'BIETRY', territory_code: 'MAR' }, { id: 2, name: 'SIDECI', territory_code: 'YOP 1' }, { id: 3, name: 'AVOCATIER', territory_code: 'ABO 2' }]
  const quartiers = [{ id: 10, zone_id: 1, nom: 'Biétry' }, { id: 11, zone_id: 2, nom: 'Mairie' }, { id: 12, zone_id: 3, nom: 'Avocatier' }]
  const refs = { territoiresProfil: ['KOUMASSI', 'MARCORY', 'TREICHVILLE'], quartiers, areas, territoires, aliases }

  it('commune résolue en territoire (alias ou casse)', () => {
    expect(zoneDuPointVisite(ligne('SIDECOM', 'Petit marché', 'Marcory'), refs)).toBe('MARCORY')
    expect(zoneDuPointVisite(ligne('SIDECOM', 'Biafra', 'Treichville'), refs)).toBe('TREICHVILLE')
  })

  it('commune sans territoire unique : zone de la ligne, sinon la commune telle quelle', () => {
    const profilAbobo = { ...refs, territoiresProfil: ['ABOBO 1', 'ABOBO 2'] }
    expect(zoneDuPointVisite(ligne('NIARE', 'Akeikoi', 'Abobo', 'ABOBO 1'), profilAbobo)).toBe('ABOBO 1')
    expect(zoneDuPointVisite(ligne('NIARE', 'Château', 'Abobo'), profilAbobo)).toBe('Abobo')
    // Le point porte le nom d'un quartier du référentiel, dans un territoire du profil.
    expect(zoneDuPointVisite(ligne('NIARE', 'Avocatier', 'Abobo'), profilAbobo)).toBe('ABOBO 2')
  })

  it('un quartier homonyme hors du secteur ne l\'emporte pas', () => {
    // « Mairie » existe à Yopougon 1, territoire absent du profil et de la ligne.
    expect(zoneDuPointVisite(ligne('NIARE', 'Mairie', 'Abobo'), { ...refs, territoiresProfil: ['ABOBO 1', 'ABOBO 2'] })).toBe('Abobo')
  })
})
