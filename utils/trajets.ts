// utils/trajets.ts
// Géométrie et lissage des trajets GPS (suivi commerciaux). Un point brut de
// position_tournee porte le bruit du capteur : un merchandiser immobile
// produit un nuage de points sur 20 à 50 m qui, tracé tel quel, dessine des
// déplacements imaginaires et gonfle les kilomètres. Ce module ne garde que
// les points signifiants et regroupe les arrêts.

export interface PointGps {
  lat: number
  lng: number
  accuracy?: number | null
  captured_at: string
}

export interface PointRetenu<T extends PointGps = PointGps> {
  point: T
  // Fin de l'arrêt si plusieurs points bruts ont été absorbés ici.
  finArret: string
  absorbes: number
}

export interface Arret<T extends PointGps = PointGps> {
  point: T
  debut: string
  fin: string
  dureeMs: number
}

export interface OptionsLissage {
  // Au-delà : point rejeté (précision insuffisante).
  precisionMaxM?: number
  // Vitesse impossible entre deux points retenus : point rejeté.
  vitesseMaxKmh?: number
  // Rayon d'absorption minimal (le rayon réel = max(rayon, précision du point).
  rayonStationnaireM?: number
  // Un point absorbant d'autres points sur au moins cette durée = arrêt.
  arretMinMs?: number
  // Tolérance Douglas-Peucker (0 = pas de simplification).
  toleranceSimplificationM?: number
}

const DEFAUTS: Required<OptionsLissage> = {
  precisionMaxM: 50,
  vitesseMaxKmh: 100,
  rayonStationnaireM: 25,
  arretMinMs: 5 * 60_000,
  toleranceSimplificationM: 10,
}

export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLng = (lng2 - lng1) * (Math.PI / 180)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function distanceTrajet(points: { lat: number; lng: number }[]): number {
  let d = 0
  for (let i = 1; i < points.length; i++) {
    d += haversine(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng)
  }
  return d
}

function ms(iso: string) {
  return new Date(iso).getTime()
}

// Distance d'un point à un segment, en mètres (projection locale suffisante
// aux échelles urbaines).
function distanceAuSegment(p: PointGps, a: PointGps, b: PointGps): number {
  const kx = 111_320 * Math.cos((a.lat * Math.PI) / 180)
  const ky = 110_574
  const ax = 0, ay = 0
  const bx = (b.lng - a.lng) * kx, by = (b.lat - a.lat) * ky
  const px = (p.lng - a.lng) * kx, py = (p.lat - a.lat) * ky
  const l2 = bx * bx + by * by
  if (l2 === 0) return Math.hypot(px - ax, py - ay)
  const t = Math.max(0, Math.min(1, ((px - ax) * bx + (py - ay) * by) / l2))
  return Math.hypot(px - (ax + t * bx), py - (ay + t * by))
}

function douglasPeucker<T extends PointGps>(pts: PointRetenu<T>[], tol: number): PointRetenu<T>[] {
  if (pts.length <= 2 || tol <= 0) return pts
  let maxD = 0, idx = 0
  for (let i = 1; i < pts.length - 1; i++) {
    // Les arrêts sont toujours conservés : ils portent le sens métier.
    if (pts[i].absorbes > 0) { maxD = Infinity; idx = i; break }
    const d = distanceAuSegment(pts[i].point, pts[0].point, pts[pts.length - 1].point)
    if (d > maxD) { maxD = d; idx = i }
  }
  if (maxD > tol) {
    const gauche = douglasPeucker(pts.slice(0, idx + 1), tol)
    const droite = douglasPeucker(pts.slice(idx), tol)
    return [...gauche.slice(0, -1), ...droite]
  }
  return [pts[0], pts[pts.length - 1]]
}

export interface ResultatLissage<T extends PointGps = PointGps> {
  points: PointRetenu<T>[]
  arrets: Arret<T>[]
  distanceM: number
  bruts: number
  rejetes: { precision: number; vitesse: number }
}

// Lisse une série de points (triée par heure) en trois passes : filtre de
// précision, absorption des points stationnaires (avec rejet des sauts
// impossibles), simplification géométrique.
export function lisserTrajet<T extends PointGps>(bruts: T[], options: OptionsLissage = {}): ResultatLissage<T> {
  const o = { ...DEFAUTS, ...options }
  const tries = bruts.slice().sort((a, b) => ms(a.captured_at) - ms(b.captured_at))
  const rejetes = { precision: 0, vitesse: 0 }
  const retenus: PointRetenu<T>[] = []

  for (const p of tries) {
    if (p.accuracy != null && p.accuracy > o.precisionMaxM) { rejetes.precision++; continue }
    const dernier = retenus[retenus.length - 1]
    if (!dernier) { retenus.push({ point: p, finArret: p.captured_at, absorbes: 0 }); continue }

    const d = haversine(dernier.point.lat, dernier.point.lng, p.lat, p.lng)
    const rayon = Math.max(o.rayonStationnaireM, p.accuracy ?? 0, dernier.point.accuracy ?? 0)
    if (d <= rayon) {
      dernier.finArret = p.captured_at
      dernier.absorbes++
      continue
    }
    const dt = (ms(p.captured_at) - ms(dernier.finArret)) / 1000
    const kmh = dt > 0 ? (d / dt) * 3.6 : Infinity
    if (kmh > o.vitesseMaxKmh) { rejetes.vitesse++; continue }
    retenus.push({ point: p, finArret: p.captured_at, absorbes: 0 })
  }

  const simplifies = douglasPeucker(retenus, o.toleranceSimplificationM)
  const arrets: Arret<T>[] = simplifies
    .filter(r => ms(r.finArret) - ms(r.point.captured_at) >= o.arretMinMs)
    .map(r => ({ point: r.point, debut: r.point.captured_at, fin: r.finArret, dureeMs: ms(r.finArret) - ms(r.point.captured_at) }))

  return {
    points: simplifies,
    arrets,
    distanceM: distanceTrajet(simplifies.map(r => r.point)),
    bruts: tries.length,
    rejetes,
  }
}

export function libelleDuree(msTotal: number): string {
  const total = Math.floor(msTotal / 60000)
  const h = Math.floor(total / 60)
  const m = total % 60
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`
}
