// utils/itineraire.ts
// Itinéraire probable sur les routes (décision de Jean Luc, 02/11/2026) : les
// points GPS gardés d'une tournée sont rattachés aux rues par le service
// « match » d'OSRM (OpenStreetMap), au moment où la carte l'affiche. La tablette
// ne change pas : un point toutes les 2 minutes, donc un trajet probable, pas
// exact. Serveur public gratuit mais limité ; il ne reçoit que des coordonnées
// et des heures, ni nom ni identifiant.

export interface PointItineraire { lat: number, lng: number, t: number, precision?: number | null }

/** Morceau de trajet : sur les rues, ou en ligne droite quand OSRM n'a rien reconnu. */
export interface TronconItineraire { surRoute: boolean, latlngs: [number, number][] }

const SERVEUR = 'https://router.project-osrm.org/match/v1/driving/'
// Limites du serveur public, mesurées le 02/11/2026 : 10 points par requête
// (« TooBig : Too many trace coordinates » au-delà) et un rayon de recherche
// sous 50 m (« Radius search size is too large » à 50 m).
const MAX_POINTS = 10
const RAYON_MIN_M = 15
const RAYON_MAX_M = 40

/** Paquets d'au plus `max` points, qui se chevauchent d'un point pour ne pas couper le trajet. */
export function paquetsItineraire<T>(points: T[], max = MAX_POINTS): T[][] {
  if (points.length < 2) return []
  const paquets: T[][] = []
  for (let debut = 0; debut < points.length - 1; debut += max - 1) {
    paquets.push(points.slice(debut, debut + max))
  }
  return paquets
}

/** Adresse de la requête « match » pour un paquet de points. */
export function urlMatch(points: PointItineraire[]): string {
  const coords = points.map(p => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';')
  // Horodatages strictement croissants, en secondes.
  let precedent = -Infinity
  const temps = points.map((p) => {
    const s = Math.max(Math.round(p.t / 1000), precedent + 1)
    precedent = s
    return s
  })
  // Rayon de recherche de la rue : la précision du GPS, bornée par le serveur.
  const rayons = points.map(p => Math.round(Math.min(RAYON_MAX_M, Math.max(RAYON_MIN_M, p.precision ?? 25))))
  const params = new URLSearchParams({
    geometries: 'geojson',
    overview: 'full',
    gaps: 'ignore',
    tidy: 'true',
    timestamps: temps.join(';'),
    radiuses: rayons.join(';'),
  })
  return `${SERVEUR}${coords}?${params.toString()}`
}

/** Lignes renvoyées par OSRM (une par correspondance), en [lat, lng]. */
export function lignesMatch(reponse: any): [number, number][][] {
  if (reponse?.code !== 'Ok' || !Array.isArray(reponse.matchings)) return []
  return reponse.matchings
    .map((m: any) => (m?.geometry?.coordinates || []).map((c: [number, number]) => [c[1], c[0]] as [number, number]))
    .filter((l: [number, number][]) => l.length > 1)
}

/**
 * Itinéraire probable d'une tournée : un tronçon sur les rues par paquet
 * reconnu, une ligne droite sinon. Lève une erreur si le service ne répond pas.
 */
export async function itineraireProbable(points: PointItineraire[], fetcher: typeof fetch = fetch): Promise<TronconItineraire[]> {
  const troncons: TronconItineraire[] = []
  for (const paquet of paquetsItineraire(points)) {
    const res = await fetcher(urlMatch(paquet))
    if (!res.ok && res.status !== 400) throw new Error(`OSRM ${res.status}`)
    const lignes = lignesMatch(await res.json().catch(() => null))
    if (lignes.length) lignes.forEach(latlngs => troncons.push({ surRoute: true, latlngs }))
    else troncons.push({ surRoute: false, latlngs: paquet.map(p => [p.lat, p.lng]) })
  }
  return troncons
}
