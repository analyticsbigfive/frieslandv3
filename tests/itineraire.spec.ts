import { describe, it, expect } from 'vitest'
import { itineraireProbable, lignesMatch, paquetsItineraire, urlMatch } from '../utils/itineraire'

const pts = [
  { lat: 5.4201, lng: -4.0201, t: Date.parse('2026-11-02T08:00:00Z'), precision: 8 },
  { lat: 5.4231, lng: -4.0181, t: Date.parse('2026-11-02T08:02:00Z'), precision: 80 },
  { lat: 5.4252, lng: -4.0161, t: Date.parse('2026-11-02T08:02:00Z'), precision: null },
]

describe('itinéraire probable sur les routes', () => {
  it('paquets qui se chevauchent d’un point', () => {
    const p = paquetsItineraire(Array.from({ length: 250 }, (_, i) => i), 100)
    expect(p.map(x => x.length)).toEqual([100, 100, 52])
    expect(p[1]![0]).toBe(99)
    expect(p[2]![0]).toBe(198)
    expect(paquetsItineraire([1])).toEqual([])
  })

  it('par défaut, 10 points par requête : la limite du serveur public', () => {
    const p = paquetsItineraire(Array.from({ length: 15 }, (_, i) => i))
    expect(p.map(x => x.length)).toEqual([10, 6])
    expect(p[1]![0]).toBe(9)
  })

  it('adresse OSRM : lng,lat, heures croissantes, rayon borné entre 15 et 40 m', () => {
    const url = new URL(urlMatch(pts))
    expect(url.pathname).toContain('-4.020100,5.420100;-4.018100,5.423100')
    const temps = url.searchParams.get('timestamps')!.split(';').map(Number)
    expect(temps[2]).toBeGreaterThan(temps[1]!)
    expect(url.searchParams.get('radiuses')).toBe('15;40;25')
  })

  it('lit les lignes renvoyées, en [lat, lng]', () => {
    const lignes = lignesMatch({ code: 'Ok', matchings: [{ geometry: { coordinates: [[-4.02, 5.42], [-4.01, 5.43]] } }] })
    expect(lignes).toEqual([[[5.42, -4.02], [5.43, -4.01]]])
    expect(lignesMatch({ code: 'NoMatch' })).toEqual([])
  })

  it('un paquet non reconnu reste en ligne droite', async () => {
    const fetcher = (async () => ({ ok: false, status: 400, json: async () => ({ code: 'NoMatch' }) })) as any
    const troncons = await itineraireProbable(pts, fetcher)
    expect(troncons).toEqual([{ surRoute: false, latlngs: pts.map(p => [p.lat, p.lng]) }])
  })

  it('service indisponible : erreur', async () => {
    const fetcher = (async () => ({ ok: false, status: 429, json: async () => ({}) })) as any
    await expect(itineraireProbable(pts, fetcher)).rejects.toThrow('OSRM 429')
  })
})
