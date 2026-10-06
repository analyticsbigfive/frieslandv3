import { describe, it, expect } from 'vitest'
import {
  parseCsvTexte, versIsoJour, estJourIsoValide, parseBool, statutDepuisTexte,
  normaliserLigneTournee, regrouperLignesTournees, lignesExportTournees,
} from '../utils/routingImport'

// Import des tournées : une erreur ici ne lève rien côté écran, elle refuse
// des lignes valides ou en accepte de fausses, en silence.
describe('parseCsvTexte', () => {
  it('lit un CSV à virgules', () => {
    expect(parseCsvTexte('email,date\na@b.ci,2026-10-06\n')).toEqual([{ email: 'a@b.ci', date: '2026-10-06' }])
  })

  it('détecte le point-virgule d\'un Excel français', () => {
    expect(parseCsvTexte('email;date;notes\r\na@b.ci;06/10/2026;Bonjour, merci\r\n'))
      .toEqual([{ email: 'a@b.ci', date: '06/10/2026', notes: 'Bonjour, merci' }])
  })

  it('garde les retours à la ligne et guillemets doublés dans un champ', () => {
    expect(parseCsvTexte('a,notes\n1,"ligne 1\nligne 2 ""citée"""\n2,x'))
      .toEqual([{ a: '1', notes: 'ligne 1\nligne 2 "citée"' }, { a: '2', notes: 'x' }])
  })

  it('ignore le BOM et les lignes vides', () => {
    expect(parseCsvTexte('﻿a,b\n\n1,2\n,\n')).toEqual([{ a: '1', b: '2' }])
  })
})

describe('versIsoJour', () => {
  it('lit jj/mm/aaaa et jj/mm/aa (jour d\'abord)', () => {
    expect(versIsoJour('6/10/2026')).toBe('2026-10-06')
    expect(versIsoJour('06/10/26')).toBe('2026-10-06')
    expect(versIsoJour('06.10.2026')).toBe('2026-10-06')
  })

  it('lit une date ISO, avec ou sans heure', () => {
    expect(versIsoJour('2026-10-06')).toBe('2026-10-06')
    expect(versIsoJour('2026-10-06T08:00:00Z')).toBe('2026-10-06')
    expect(versIsoJour('2026-10-06 00:00:00')).toBe('2026-10-06')
  })

  it('lit un numéro de série Excel (nombre ou texte)', () => {
    expect(versIsoJour(46301)).toBe('2026-10-06')
    expect(versIsoJour('46301')).toBe('2026-10-06')
  })

  it('lit une Date ExcelJS (minuit UTC)', () => {
    expect(versIsoJour(new Date(Date.UTC(2026, 9, 6)))).toBe('2026-10-06')
  })

  it('laisse passer un texte non reconnu, refusé ensuite', () => {
    expect(versIsoJour('demain')).toBe('demain')
  })
})

describe('estJourIsoValide', () => {
  it('refuse les jours qui n\'existent pas', () => {
    expect(estJourIsoValide('2026-02-31')).toBe(false)
    expect(estJourIsoValide('2026-13-01')).toBe(false)
    expect(estJourIsoValide('2026-02-28')).toBe(true)
  })
})

describe('parseBool', () => {
  it('accepte Oui, x, 1, TRUE et VRAI', () => {
    for (const v of ['Oui', 'x', '1', 'TRUE', 'VRAI', 'yes']) expect(parseBool(v)).toBe(true)
    for (const v of ['Non', '', '0', 'FAUX', 'false', undefined]) expect(parseBool(v)).toBe(false)
  })
})

describe('statutDepuisTexte', () => {
  it('lit les codes et les libellés français', () => {
    expect(statutDepuisTexte('in_progress')).toBe('in_progress')
    expect(statutDepuisTexte('En cours')).toBe('in_progress')
    expect(statutDepuisTexte('Terminé')).toBe('completed')
    expect(statutDepuisTexte('')).toBeUndefined()
  })
})

describe('normaliserLigneTournee', () => {
  it('extrait email et code PDV des libellés du modèle', () => {
    expect(normaliserLigneTournee({
      'Merchandiser': 'ABBE FREDERIC — Abbe@Mail.ci',
      'Date': '06/10/2026',
      'Point de vente': 'MME COUL · PDV123',
      'Relevé de stock': 'Oui',
      'Territoire': 'ADJAME',
    }, 5)).toEqual({ __ligne: '5', email: 'abbe@mail.ci', date: '2026-10-06', pdv_id: 'PDV123', releve_stock: 'Oui' })
  })

  it('ignore une ligne sans merchandiser, date ni PDV', () => {
    expect(normaliserLigneTournee({ Notes: 'x', Ordre: '' }, 3)).toBeNull()
  })
})

describe('regrouperLignesTournees', () => {
  const ligne = (n: number, pdv: string, extra: Record<string, string> = {}) =>
    ({ __ligne: String(n), email: 'a@b.ci', date: '2026-10-06', pdv_id: pdv, ...extra })

  it('regroupe par merchandiser et jour, trié par ordre', () => {
    const { groupes, erreurs } = regrouperLignesTournees([
      ligne(2, 'P2', { ordre: '2' }),
      ligne(3, 'P1', { ordre: '1', photos: 'Oui' }),
    ])
    expect(erreurs).toEqual([])
    expect(groupes).toHaveLength(1)
    expect(groupes[0]!.items.map(i => i.pdv_id)).toEqual(['P1', 'P2'])
    expect(groupes[0]!.items[0]!.objectifs.photos).toBe(true)
  })

  it('refuse un PDV en double dans la même tournée (contrainte unique)', () => {
    const { groupes, erreurs } = regrouperLignesTournees([ligne(2, 'P1'), ligne(3, 'P1')])
    expect(groupes[0]!.items).toHaveLength(1)
    expect(erreurs[0]).toMatch(/Ligne 3 .*déjà présent/)
  })

  it('ne fixe ni statut ni notes quand le fichier n\'en donne pas', () => {
    const { groupes } = regrouperLignesTournees([ligne(2, 'P1')])
    expect(groupes[0]!.status).toBeUndefined()
    expect(groupes[0]!.notes).toBeUndefined()
  })

  it('refuse une date impossible avec un message clair', () => {
    const { groupes, erreurs } = regrouperLignesTournees([{ ...ligne(2, 'P1'), date: '2026-02-31' }])
    expect(groupes).toEqual([])
    expect(erreurs[0]).toMatch(/Ligne 2 : date/)
  })
})

describe('export puis réimport', () => {
  it('redonne les mêmes tournées', () => {
    const tournees = [{
      tournee: { date_routing: '2026-10-06', status: 'in_progress' as const, notes: 'RAS', user: { nom: 'ABBE FREDERIC', email: 'abbe@mail.ci' } },
      etapes: [
        { pdv_id: 'P2', position_order: 2, status: 'pending', objectifs: { photos: true }, pdv: { nom_pdv: 'MME COUL', zone: 'ADJAME', quartier: 'WILLIAMSVILLE' } },
        { pdv_id: 'P1', position_order: 1, status: 'completed', objectifs: { releve_stock: true }, pdv: { nom_pdv: 'mohamed ali', zone: 'ADJAME', quartier: null } },
      ],
    }]
    const lignes = lignesExportTournees(tournees)
    expect(lignes).toHaveLength(2)
    expect(lignes[0]!['Point de vente']).toBe('mohamed ali · P1')

    const relues = lignes.map((l, i) => normaliserLigneTournee(l, i + 2)!)
    const { groupes, erreurs } = regrouperLignesTournees(relues)
    expect(erreurs).toEqual([])
    expect(groupes).toEqual([{
      email: 'abbe@mail.ci',
      date: '2026-10-06',
      notes: 'RAS',
      status: 'in_progress',
      items: [
        { pdv_id: 'P1', ordre: 1, objectifs: { releve_stock: true, encaissement: false, photos: false, merchandising: false, prospection: false } },
        { pdv_id: 'P2', ordre: 2, objectifs: { releve_stock: false, encaissement: false, photos: true, merchandising: false, prospection: false } },
      ],
    }])
  })
})
