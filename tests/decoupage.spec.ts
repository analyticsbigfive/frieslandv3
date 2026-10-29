import { describe, it, expect } from 'vitest'
import {
  PARTAGE, SANS_COMMERCIAL, commercialDeBoutique, commerciauxParTerritoire, estACheval, grilleEmprise,
  nomAffiche, personnesCommerciales, resolveurTerritoire,
} from '../utils/decoupage'

const territoires = [
  { code: 'COC', nom: 'COCODY' },
  { code: 'PRB 2', nom: 'PORT-BOUËT 2' },
  { code: 'ADJ', nom: 'ADJAMÉ' },
  { code: 'BNA', nom: 'BONOUA' },
]
const aliases = [
  { alias: 'COCODY 1', territoire_code: 'COC' },
  { alias: 'PORT-BOUET', territoire_code: 'PRB 2' },
  { alias: 'Bouaké', territoire_code: 'BKE' }, // territoire hors découpage : ignoré
]

describe('rattachement d’une boutique à son territoire', () => {
  const territoireDe = resolveurTerritoire(territoires, aliases)

  it('par le nom exact, sans casse ni accent', () => {
    expect(territoireDe('Adjame')).toBe('ADJ')
    expect(territoireDe('COCODY')).toBe('COC')
  })

  it('par un ancien libellé (alias)', () => {
    expect(territoireDe('Cocody 1')).toBe('COC')
    expect(territoireDe('PORT-BOUET')).toBe('PRB 2')
  })

  it('libellé hors découpage, vide ou alias vers un territoire absent : aucun', () => {
    expect(territoireDe('MAN')).toBeNull()
    expect(territoireDe('')).toBeNull()
    expect(territoireDe(null)).toBeNull()
    expect(territoireDe('Bouaké')).toBeNull()
  })
})

describe('commerciaux du découpage', () => {
  const profils = [
    { id: 'm', nom: 'Muriel Siotene', territoires_assignes: ['COCODY'], quartiers_assignes: ['Mahou', 'Djibi'] },
    { id: 'am1', nom: 'NGUESSAN AKUNDAH ANNE MARIE', territoires_assignes: ['COCODY', 'PORT-BOUËT 2', 'BONOUA'], quartiers_assignes: ['Riviera 2', 'GONZAGUEVILLE'] },
    { id: 'am2', nom: 'NGUESSAN AKUNDAH ANNE MARIE', territoires_assignes: ['COCODY', 'PORT-BOUËT 2', 'BONOUA'], quartiers_assignes: ['Riviera 2', 'GONZAGUEVILLE'] },
    { id: 'k', nom: 'Azoumi Kena', territoires_assignes: ['PORT-BOUËT 2'], quartiers_assignes: ['ADJOUFFOU'] },
    { id: 'a', nom: 'ARMANDE KOUAKOUSSUI', territoires_assignes: ['ADJAMÉ'], quartiers_assignes: [] },
    { id: 's', nom: 'SONIA AKON', territoires_assignes: ['PORT-BOUET'], quartiers_assignes: [] }, // ancien libellé seulement
    { id: 'g', nom: 'KACOU LEONARD', territoires_assignes: ['GAGNOA'], quartiers_assignes: [] }, // intérieur
  ]
  const personnes = personnesCommerciales(profils, territoires)
  const parTerritoire = commerciauxParTerritoire(personnes)
  const indice = (nom: string) => personnes.findIndex(p => p.nom.includes(nom))

  it('deux comptes au même nom forment une personne ; anciens libellés et intérieur écartés', () => {
    expect(personnes.map(p => p.nom)).toEqual(['ARMANDE KOUAKOUSSUI', 'Azoumi Kena', 'Muriel Siotene', 'NGUESSAN AKUNDAH ANNE MARIE'])
    expect(personnes[indice('ANNE MARIE')]!.ids).toEqual(['am1', 'am2'])
  })

  it('territoire à un seul titulaire : lui, quel que soit le quartier', () => {
    expect(commercialDeBoutique(parTerritoire.get('ADJ'), 'n’importe où', personnes)).toBe(indice('ARMANDE'))
    expect(commercialDeBoutique(parTerritoire.get('BNA'), null, personnes)).toBe(indice('ANNE MARIE'))
  })

  it('territoire partagé : départagé par les quartiers des profils', () => {
    expect(commercialDeBoutique(parTerritoire.get('COC'), 'DJIBI', personnes)).toBe(indice('Muriel'))
    expect(commercialDeBoutique(parTerritoire.get('COC'), 'riviera-2', personnes)).toBe(indice('ANNE MARIE'))
    expect(commercialDeBoutique(parTerritoire.get('PRB 2'), 'Adjouffou', personnes)).toBe(indice('Kena'))
  })

  it('territoire partagé sans quartier qui tranche : partagé', () => {
    expect(commercialDeBoutique(parTerritoire.get('COC'), 'ANGRÉ', personnes)).toBe(PARTAGE)
    expect(commercialDeBoutique(parTerritoire.get('COC'), null, personnes)).toBe(PARTAGE)
  })

  it('un titulaire sans liste de quartiers couvre ce que les autres listes laissent', () => {
    const p = personnesCommerciales([
      { id: 'x', nom: 'X', territoires_assignes: ['ADJAMÉ'], quartiers_assignes: [] },
      { id: 'y', nom: 'Y', territoires_assignes: ['ADJAMÉ'], quartiers_assignes: ['DALLAS'] },
    ], territoires)
    const c = commerciauxParTerritoire(p).get('ADJ')
    expect(commercialDeBoutique(c, 'DALLAS', p)).toBe(1)
    expect(commercialDeBoutique(c, 'BRACODI', p)).toBe(0)
  })

  it('territoire sans titulaire : aucun commercial', () => {
    expect(commercialDeBoutique(undefined, 'X', personnes)).toBe(SANS_COMMERCIAL)
  })
})

describe('points de visite à cheval', () => {
  it('deux territoires ou deux commerciaux', () => {
    expect(estACheval([1, 1, 1], [0, 0])).toBe(false)
    expect(estACheval([1, 2], [0, 0])).toBe(true)
    expect(estACheval([1, 1], [0, 3])).toBe(true)
  })

  it('les boutiques sans territoire ni commercial ne comptent pas', () => {
    expect(estACheval([1, -1], [0, PARTAGE, SANS_COMMERCIAL])).toBe(false)
  })
})

describe('emprise des territoires (grille)', () => {
  it('chaque case prend le territoire majoritaire de ses boutiques', () => {
    // Trois boutiques dans la même case (0,004°), une dans la case voisine, une sans territoire.
    const lat = [5.3001, 5.3002, 5.3003, 5.3051, 5.3004]
    const lng = [-4.0001, -4.0002, -4.0003, -4.0001, -4.0004]
    const t = [2, 2, 5, 5, -1]
    const cases = grilleEmprise(lat, lng, t).sort((a, b) => a.lat - b.lat)
    expect(cases).toHaveLength(2)
    expect(cases[0]!.t).toBe(2)
    expect(cases[1]!.t).toBe(5)
    expect(cases[0]!.lat).toBeCloseTo(5.3, 3)
  })

  it('égalité : le plus petit indice', () => {
    expect(grilleEmprise([5.3001, 5.3002], [-4.0001, -4.0002], [7, 3])[0]!.t).toBe(3)
  })
})

describe('nom affiché', () => {
  it('casse des noms propres', () => {
    expect(nomAffiche('GAI KAMI')).toBe('Gai Kami')
    expect(nomAffiche("N'GUESSAN OPHELIA")).toBe("N'Guessan Ophelia")
  })
})
