// utils/doublonPdv.ts
// Création d'un PDV sur le terrain sans doublon (demande de Jean Luc du
// 29/10/2026 : « vérifier qu'il n'enregistre pas un doublon (gps + photo
// devanture) »). 167 paires de PDV ATOM portaient le même nom à moins de 15 m.
// Avant de créer, l'app montre les PDV à moins de « Rayon des doublons »
// (30 m) avec leur photo de devanture ; l'agent choisit « C'est ce PDV » ou
// « C'est un nouveau PDV ». Un nom presque identique à moins de « Rayon des
// doublons de nom » (15 m) demande une confirmation explicite. La base garde
// la trace (pdv_doublon_possible) pour le superviseur. Fonctions pures,
// testées dans tests/doublonPdv.spec.ts.
import { haversine } from './trajets'

/** Au-delà, deux noms sont « presque identiques » (même échelle que pg_trgm). */
export const SEUIL_NOM_PROCHE = 0.8

// Mots qui ne distinguent pas deux boutiques (« Boutique chez Awa » = « Chez Awa »).
const MOTS_GENERIQUES = new Set([
  'boutique', 'btq', 'superette', 'supermarche', 'kiosque', 'kiosk', 'magasin', 'alimentation', 'alim',
  'ets', 'etablissement', 'etablissements', 'commerce', 'cave', 'depot', 'pushcart', 'tabletop', 'table', 'top',
  'chez', 'le', 'la', 'les', 'de', 'du', 'des', 'et', 'l', 'd',
])

/** Nom comparable : sans accents, casse, ponctuation ni mots génériques. */
export function normaliserNomPdv(nom: string | null | undefined): string {
  const mots = (nom || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
  const utiles = mots.filter(m => !MOTS_GENERIQUES.has(m))
  return (utiles.length ? utiles : mots).join(' ')
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prec = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cour = [i]
    for (let j = 1; j <= b.length; j++) {
      cour[j] = Math.min(prec[j] + 1, cour[j - 1] + 1, prec[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prec = cour
  }
  return prec[b.length]
}

/**
 * Ressemblance de deux noms de PDV, de 0 à 1. Un nom contenu dans l'autre
 * (« Awa » / « Awa Cosmetique ») compte comme presque identique.
 */
export function similariteNomsPdv(a: string | null | undefined, b: string | null | undefined): number {
  const na = normaliserNomPdv(a)
  const nb = normaliserNomPdv(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  const [court, long] = na.length <= nb.length ? [na, nb] : [nb, na]
  if (court.length >= 3 && (` ${long} `).includes(` ${court} `)) return 0.9
  return Math.round((1 - levenshtein(na, nb) / long.length) * 100) / 100
}

export type VoisinPdv = {
  pdv_id: string
  nom_pdv?: string | null
  quartier?: string | null
  image_url?: string | null
  distance_m: number
  /** Faux : le PDV existe mais n'est pas dans la liste de l'agent. */
  dans_perimetre?: boolean
}

/**
 * PDV à moins de `rayon_m` de la position, du plus proche au plus loin. Sert
 * hors ligne, sur la liste déjà chargée (en ligne : fonction pdv_voisins).
 */
export function voisinsDansRayon(
  position: { lat: number, lng: number },
  pdvs: { pdv_id: string, nom_pdv?: string | null, quartier?: string | null, image_url?: string | null, geolocation_lat?: number | null, geolocation_lng?: number | null }[],
  rayon_m: number,
): VoisinPdv[] {
  const out: VoisinPdv[] = []
  for (const p of pdvs) {
    if (p.geolocation_lat == null || p.geolocation_lng == null) continue
    const d = haversine(position.lat, position.lng, Number(p.geolocation_lat), Number(p.geolocation_lng))
    if (d <= rayon_m) out.push({ pdv_id: p.pdv_id, nom_pdv: p.nom_pdv, quartier: p.quartier, image_url: p.image_url, distance_m: Math.round(d), dans_perimetre: true })
  }
  return out.sort((a, b) => a.distance_m - b.distance_m)
}

/**
 * Le voisin qui exige une confirmation explicite : nom presque identique et
 * à moins de `rayon_nom_m`. Null si aucun.
 */
export function voisinNomProche(nom: string, voisins: VoisinPdv[], rayon_nom_m: number): VoisinPdv | null {
  let meilleur: { v: VoisinPdv, s: number } | null = null
  for (const v of voisins) {
    if (v.distance_m > rayon_nom_m) continue
    const s = similariteNomsPdv(nom, v.nom_pdv)
    if (s >= SEUIL_NOM_PROCHE && (!meilleur || s > meilleur.s)) meilleur = { v, s }
  }
  return meilleur?.v ?? null
}
