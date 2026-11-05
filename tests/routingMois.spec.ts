import { describe, expect, it } from 'vitest'
import {
  bornesMois, dateFr, grouperParMerchandiser, libelleEmployeur, nomFichierRoutingMois, nomsFeuilles,
  resumeMerchandiser, tranchesGeneration, valeurCellule, type LigneRoutingMois,
} from '../utils/routingMois'

const ligne = (extra: Partial<LigneRoutingMois> = {}): LigneRoutingMois => ({
  user_id: 'u1', merchandiser: 'GUI STEPHANE', employeur: 'atom', date_routing: '2026-11-04', jour: 'Mercredi', semaine: 1,
  point_visite: 'Petit marché', commune: 'Marcory', quartiers_plan: null, ssf: null, distributeur_routing: 'SIDECOM',
  type_jour: 'Tournée + pushcarts à trouver', ordre: 1, pdv_id: 'p1', code_client: null, nom_pdv: 'Oumar', type_pdv: 'Superettes C',
  quartier: 'Petit marché', territoire: 'MARCORY', distributeur: 'SIDECOM', latitude: 5.3, longitude: -3.98, adresse: null,
  statut: 'Fait', origine: 'Prévu', ...extra,
})

describe('bornesMois', () => {
  it('donne le premier et le dernier jour, février et décembre compris', () => {
    expect(bornesMois('2026-11')).toEqual({ debut: '2026-11-01', fin: '2026-11-30' })
    expect(bornesMois('2028-02')).toEqual({ debut: '2028-02-01', fin: '2028-02-29' })
    expect(bornesMois('2026-12')).toEqual({ debut: '2026-12-01', fin: '2026-12-31' })
  })
  it('refuse un mois invalide', () => {
    expect(() => bornesMois('2026-13')).toThrow()
  })
})

describe('tranchesGeneration', () => {
  it('mois en cours : d\'aujourd\'hui à la fin du mois, par tranches de 7 jours', () => {
    expect(tranchesGeneration('2026-11-01', '2026-11-30', '2026-11-05')).toEqual([
      { du: '2026-11-05', au: '2026-11-11' },
      { du: '2026-11-12', au: '2026-11-18' },
      { du: '2026-11-19', au: '2026-11-25' },
      { du: '2026-11-26', au: '2026-11-30' },
    ])
  })
  it('mois à venir : depuis le 1er', () => {
    expect(tranchesGeneration('2026-12-01', '2026-12-31', '2026-11-05')[0]).toEqual({ du: '2026-12-01', au: '2026-12-07' })
  })
  it('mois passé : rien à générer', () => {
    expect(tranchesGeneration('2026-10-01', '2026-10-31', '2026-11-05')).toEqual([])
  })
})

describe('nomsFeuilles', () => {
  it('retire les caractères interdits, coupe à 31 et rend les noms uniques', () => {
    const noms = nomsFeuilles(['GUI STEPHANE', 'KOUADIO ATOFFE GUY ANICET / MARCORY', 'GUI STEPHANE', 'Résumé'])
    expect(noms[0]).toBe('GUI STEPHANE')
    expect(noms[1]).toBe('KOUADIO ATOFFE GUY ANICET MARCO')
    expect(noms[1]!.length).toBeLessThanOrEqual(31)
    expect(noms[2]).toBe('GUI STEPHANE (2)')
    expect(noms[3]).toBe('Résumé (2)')
  })
})

describe('regroupement et résumé', () => {
  const lignes = [
    ligne(),
    ligne({ pdv_id: 'p2', nom_pdv: 'Hamed', statut: 'À faire', ordre: 2 }),
    ligne({ date_routing: '2026-11-05', pdv_id: 'p1', statut: 'À faire' }),
    ligne({ date_routing: '2026-11-07', type_jour: 'Visite libre', pdv_id: null, nom_pdv: null, statut: null, distributeur_routing: null }),
    ligne({ user_id: 'u2', merchandiser: 'ABBE FREDERIC', distributeur_routing: 'BOUSSOURA SARL' }),
  ]
  it('regroupe par merchandiser, dans l\'ordre alphabétique', () => {
    expect(grouperParMerchandiser(lignes).map(g => g.nom)).toEqual(['ABBE FREDERIC', 'GUI STEPHANE'])
  })
  it('compte jours, visites libres, PDV distincts, étapes et faites', () => {
    const g = grouperParMerchandiser(lignes).find(x => x.userId === 'u1')!
    expect(resumeMerchandiser(g)).toEqual({
      merchandiser: 'GUI STEPHANE', agence: 'Atom', distributeurs: 'SIDECOM',
      jours: 3, joursVisiteLibre: 1, pdvPrevus: 2, etapes: 3, faites: 1,
    })
  })
})

describe('mise en forme', () => {
  it('date en JJ/MM/AAAA et valeurs des colonnes', () => {
    expect(dateFr('2026-11-04')).toBe('04/11/2026')
    expect(valeurCellule(ligne(), 'date')).toBe('04/11/2026')
    expect(valeurCellule(ligne(), 'nom_pdv')).toBe('Oumar')
    expect(valeurCellule(ligne({ code_client: null }), 'code_client')).toBeNull()
  })
  it('libellé de l\'agence et nom du fichier', () => {
    expect(libelleEmployeur('hello-event')).toBe('Hello Event')
    expect(libelleEmployeur(null)).toBe('')
    expect(nomFichierRoutingMois('2026-11')).toBe('routing-2026-11.xlsx')
    expect(nomFichierRoutingMois('2026-11', 'hello-event')).toBe('routing-2026-11-hello-event.xlsx')
  })
})
