import { describe, it, expect } from 'vitest'
import { compterEtats, correspondEtat, filtrerPdvAgence, lienGoogleMaps, lireEtat, merchandiserDe, type PdvAgence } from '../utils/pdvAgence'

const MAINTENANT = new Date('2026-10-10T12:00:00Z')
const pdv = (id: string, extra: Partial<PdvAgence> = {}): PdvAgence => ({
  pdv_id: id, nom_pdv: `Boutique ${id}`, zone: 'ABOBO 1', quartier: 'SAMAKE', canal: 'General trade', sous_categorie_pdv: 'Boutique C',
  distributor_name: 'ETABLISSEMENT NIARE & FRERES', adressage: null, geolocation_lat: 5.42, geolocation_lng: -4.01,
  recense_par: null, nb_visites: 2, derniere_visite: '2026-09-30T09:00:00Z', dernier_merchandiser: 'YAO VENANCE', ...extra,
})

const LIGNES = [
  pdv('A'), // visité deux fois, récemment
  pdv('B', { geolocation_lat: null, geolocation_lng: null }), // sans GPS
  pdv('C', { nb_visites: 0, derniere_visite: null, dernier_merchandiser: null, recense_par: 'SEREGONE SCHADRACK' }), // recensé, jamais visité
  pdv('D', { nb_visites: 1, derniere_visite: '2026-07-01T09:00:00Z' }), // une visite, il y a plus de 60 jours
  pdv('E', { nom_pdv: 'Chez Adama', quartier: 'Anador', adressage: '+225 07 12 34 56', zone: 'ABOBO 2' }),
]

describe('PDV de l’agence : états', () => {
  it('compte chaque état (un PDV peut en cumuler plusieurs)', () => {
    expect(compterEtats(LIGNES, MAINTENANT)).toEqual({ 'tous': 5, 'sans-gps': 1, 'jamais-visite': 1, 'plus-60-jours': 1, 'une-visite': 1 })
  })

  it('un PDV jamais visité n’est pas « pas vu depuis 60 jours »', () => {
    expect(correspondEtat(LIGNES[2], 'plus-60-jours', MAINTENANT)).toBe(false)
    expect(correspondEtat(LIGNES[3], 'plus-60-jours', MAINTENANT)).toBe(true)
  })

  it('lit l’état de l’URL, « tous » sinon', () => {
    expect(lireEtat('sans-gps')).toBe('sans-gps')
    expect(lireEtat(['jamais-visite'])).toBe('jamais-visite')
    expect(lireEtat('n-importe-quoi')).toBe('tous')
    expect(lireEtat(undefined)).toBe('tous')
  })
})

describe('PDV de l’agence : filtres', () => {
  it('recherche sans accents ni casse, sur le nom, le quartier ou le téléphone', () => {
    expect(filtrerPdvAgence(LIGNES, { etat: 'tous', recherche: 'chez adama' }, MAINTENANT).map(p => p.pdv_id)).toEqual(['E'])
    expect(filtrerPdvAgence(LIGNES, { etat: 'tous', recherche: 'ANADOR' }, MAINTENANT).map(p => p.pdv_id)).toEqual(['E'])
    expect(filtrerPdvAgence(LIGNES, { etat: 'tous', recherche: '07123456' }, MAINTENANT).map(p => p.pdv_id)).toEqual(['E'])
  })

  it('combine état, zone et merchandiser', () => {
    expect(filtrerPdvAgence(LIGNES, { etat: 'tous', zone: 'ABOBO 2' }, MAINTENANT).map(p => p.pdv_id)).toEqual(['E'])
    expect(filtrerPdvAgence(LIGNES, { etat: 'jamais-visite', merchandiser: 'SEREGONE SCHADRACK' }, MAINTENANT).map(p => p.pdv_id)).toEqual(['C'])
    expect(filtrerPdvAgence(LIGNES, { etat: 'sans-gps', zone: 'ABOBO 2' }, MAINTENANT)).toEqual([])
  })

  it('merchandiser : celui de la dernière visite, sinon celui qui l’a recensé', () => {
    expect(merchandiserDe(LIGNES[0])).toBe('YAO VENANCE')
    expect(merchandiserDe(LIGNES[2])).toBe('SEREGONE SCHADRACK')
  })

  it('lien Google Maps seulement avec un GPS', () => {
    expect(lienGoogleMaps(LIGNES[0])).toBe('https://www.google.com/maps/search/?api=1&query=5.42,-4.01')
    expect(lienGoogleMaps(LIGNES[1])).toBe('')
  })
})
