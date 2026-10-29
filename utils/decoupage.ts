// utils/decoupage.ts
// Page « Découpage » (/admin/decoupage) : rattachement des boutiques au
// découpage sectoriel en vigueur, sans géométrie en base.
//
// Une boutique est rattachée à un TERRITOIRE seulement, par son libellé
// (pdv.zone, ou un ancien libellé via territoire_alias), en attendant le
// reclassement des boutiques par secteur. Le commercial vient du territoire ;
// pour un territoire partagé (Cocody, Port-Bouët 2), il se départage par les
// quartiers du profil, comme pdvInScope() : « quartiers vides = tout le
// territoire ». Fonctions pures, partagées par la route serveur et la page.
import { normaliserNomTerritoire, type TerritoireAlias } from './territoires'

/** Clé de comparaison : sans casse, accents ni ponctuation (« Port bouet » = « PORT-BOUËT »). */
export const cleNom = (s: string | null | undefined) =>
  String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]+/g, ' ').trim()

/** Aucun commercial (territoire sans titulaire, ou libellé hors découpage). */
export const SANS_COMMERCIAL = -1
/** Territoire partagé que les quartiers des profils ne départagent pas. */
export const PARTAGE = -2

export interface TerritoireNom { code: string, nom: string }

/** Libellé de boutique → code du territoire du découpage (nom exact, sinon alias), ou null. */
export function resolveurTerritoire(territoires: TerritoireNom[], aliases: TerritoireAlias[]) {
  const parNom = new Map(territoires.map(t => [normaliserNomTerritoire(t.nom), t.code]))
  const codes = new Set(territoires.map(t => t.code))
  const parAlias = new Map(aliases.filter(a => codes.has(a.territoire_code)).map(a => [normaliserNomTerritoire(a.alias), a.territoire_code]))
  return (libelle: string | null | undefined): string | null => {
    const k = normaliserNomTerritoire(String(libelle || ''))
    if (!k) return null
    return parNom.get(k) ?? parAlias.get(k) ?? null
  }
}

export interface ProfilCommercial {
  id: string
  nom: string | null
  territoires_assignes: string[] | null
  quartiers_assignes: string[] | null
}

export interface PersonneCommerciale {
  nom: string
  ids: string[]
  /** Codes des territoires du découpage portés par le profil (nom exact, jamais par alias). */
  territoires: string[]
  /** Quartiers du profil (clés cleNom) ; vide = tout le territoire. */
  quartiers: Set<string>
}

/**
 * Comptes commerciaux → personnes du découpage. Deux comptes au même nom
 * (Anne Marie, Ophelia) sont une seule personne. Un territoire compte seulement
 * s'il porte le nom exact d'un territoire du découpage : un ancien libellé
 * (« PORT-BOUET ») ou un territoire de l'intérieur ne rattache personne.
 */
export function personnesCommerciales(profils: ProfilCommercial[], territoires: TerritoireNom[]): PersonneCommerciale[] {
  const parNom = new Map(territoires.map(t => [normaliserNomTerritoire(t.nom), t.code]))
  const personnes = new Map<string, PersonneCommerciale>()
  for (const p of profils) {
    const codes = (p.territoires_assignes || []).map(n => parNom.get(normaliserNomTerritoire(n))).filter((c): c is string => !!c)
    if (!codes.length) continue
    const cle = cleNom(p.nom) || p.id
    const personne = personnes.get(cle) ?? { nom: (p.nom || '').trim(), ids: [], territoires: [], quartiers: new Set<string>() }
    personne.ids.push(p.id)
    for (const c of codes) if (!personne.territoires.includes(c)) personne.territoires.push(c)
    for (const q of p.quartiers_assignes || []) if (cleNom(q)) personne.quartiers.add(cleNom(q))
    personnes.set(cle, personne)
  }
  return [...personnes.values()].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
}

/** Code du territoire → indices des personnes qui le portent. */
export function commerciauxParTerritoire(personnes: PersonneCommerciale[]): Map<string, number[]> {
  const out = new Map<string, number[]>()
  personnes.forEach((p, i) => {
    for (const code of p.territoires) out.set(code, [...(out.get(code) || []), i])
  })
  return out
}

/**
 * Commercial d'une boutique de ce territoire : le seul titulaire ; sinon celui
 * dont les quartiers contiennent celui de la boutique ; sinon le seul titulaire
 * sans liste de quartiers (tout le territoire). PARTAGE quand rien ne tranche.
 */
export function commercialDeBoutique(candidats: number[] | undefined, quartier: string | null | undefined, personnes: PersonneCommerciale[]): number {
  if (!candidats?.length) return SANS_COMMERCIAL
  if (candidats.length === 1) return candidats[0]!
  const q = cleNom(quartier)
  const precis = q ? candidats.filter(i => personnes[i]!.quartiers.has(q)) : []
  if (precis.length === 1) return precis[0]!
  const generaux = candidats.filter(i => !personnes[i]!.quartiers.size)
  if (!precis.length && generaux.length === 1) return generaux[0]!
  return PARTAGE
}

/** Point de visite à cheval : ses boutiques relèvent de deux territoires ou de deux commerciaux. */
export function estACheval(territoires: number[], commerciaux: number[]): boolean {
  const t = new Set(territoires.filter(x => x >= 0))
  const c = new Set(commerciaux.filter(x => x >= 0))
  return t.size > 1 || c.size > 1
}

export interface CaseEmprise { lat: number, lng: number, t: number }

/**
 * Emprise des territoires sans polygone : grille de `pas` degrés (0,004° ≈ 450 m),
 * chaque case prend le territoire le plus représenté parmi ses boutiques
 * (à égalité, le plus petit indice). Les boutiques sans territoire (t < 0) ne
 * comptent pas. (lat, lng) = coin sud-ouest de la case.
 */
export function grilleEmprise(lat: ArrayLike<number>, lng: ArrayLike<number>, t: ArrayLike<number>, pas = 0.004): CaseEmprise[] {
  const cases = new Map<string, Map<number, number>>()
  for (let i = 0; i < t.length; i++) {
    if (t[i]! < 0) continue
    const k = `${Math.floor(lat[i]! / pas)},${Math.floor(lng[i]! / pas)}`
    const c = cases.get(k) ?? new Map<number, number>()
    c.set(t[i]!, (c.get(t[i]!) || 0) + 1)
    cases.set(k, c)
  }
  const out: CaseEmprise[] = []
  for (const [k, comptes] of cases) {
    const [la, lo] = k.split(',').map(Number)
    let meilleur = -1, n = 0
    for (const [ti, c] of comptes) if (c > n || (c === n && ti < meilleur)) { meilleur = ti; n = c }
    out.push({ lat: la! * pas, lng: lo! * pas, t: meilleur })
  }
  return out
}

/** Nom affiché d'un profil : « GAI KAMI » → « Gai Kami ». */
export function nomAffiche(nom: string | null | undefined): string {
  return String(nom || '').trim().toLowerCase()
    .replace(/(^|[\s'’-])(\p{L})/gu, (_m, a: string, l: string) => a + l.toUpperCase())
}

/** Calques de la carte du découpage. */
export interface CouchesDecoupage { friesland: boolean, atom: boolean, emprises: boolean, points: boolean, noms: boolean }

// --- Réponse de GET /api/admin/decoupage ---------------------------------------------

export interface DecoupageZone { code: string, nom: string, secteurs: string[] }
export interface DecoupageTerritoire {
  code: string
  nom: string
  sousRegion: string
  /** Indices des commerciaux titulaires. */
  coms: number[]
  zones: DecoupageZone[]
  /** Boutiques rattachées, dont Atom. */
  n: number
  na: number
}
export interface DecoupageMerch {
  id: string
  nom: string
  /** Indice du commercial binôme, SANS_COMMERCIAL si hors découpage. */
  binome: number
  total: number
  /** Boutiques de sa liste dont le commercial n'est pas son binôme. */
  hors: number
  parCom: [number, number][]
}
export interface DecoupagePoint {
  lat: number
  lng: number
  nom: string
  merch: number
  nb: number
  t: number[]
  c: number[]
  cheval: boolean
}
export interface DecoupageDonnees {
  maj: string
  commerciaux: { nom: string, ids: string[] }[]
  territoires: DecoupageTerritoire[]
  /** Colonnes parallèles, une entrée par boutique géolocalisée rattachée. */
  boutiques: {
    id: string[]
    nom: string[]
    quartier: string[]
    lat: number[]
    lng: number[]
    t: number[]
    c: number[]
    a: number[]
    m: number[]
    d: number[]
  }
  distributeurs: string[]
  merchs: DecoupageMerch[]
  points: DecoupagePoint[]
  /** Emprise des territoires (grille), calculée sur toutes les boutiques : aucune donnée de boutique. */
  emprise: CaseEmprise[]
  /** Centre de chaque territoire (moyenne de ses boutiques), null s'il n'en a pas. */
  centres: ([number, number] | null)[]
}

/**
 * Ce qu'un commercial reçoit : tout le découpage (hiérarchie, commerciaux,
 * compteurs, emprise), mais le détail des boutiques limité à son périmètre,
 * comme la RLS de pdv (pdv_ids_perimetre) : ses boutiques, et celles d'un
 * territoire partagé sans quartier saisi. Merchandisers et points de visite :
 * ceux de ses binômes seulement (RLS de routing_mensuel). Les indices de
 * merchandiser sont renumérotés.
 */
export function restreindreAuCommercial(D: DecoupageDonnees, moi: number): DecoupageDonnees {
  const B = D.boutiques
  const garder = (i: number) => moi >= 0 && (B.c[i] === moi
    || (B.c[i] === PARTAGE && !B.quartier[i] && !!D.territoires[B.t[i]!]?.coms.includes(moi)))
  const nouveauMerch = new Map<number, number>()
  const merchs = D.merchs.filter((m, i) => {
    if (moi < 0 || m.binome !== moi) return false
    nouveauMerch.set(i, nouveauMerch.size)
    return true
  })
  const b: DecoupageDonnees['boutiques'] = { id: [], nom: [], quartier: [], lat: [], lng: [], t: [], c: [], a: [], m: [], d: [] }
  for (let i = 0; i < B.id.length; i++) {
    if (!garder(i)) continue
    b.id.push(B.id[i]!); b.nom.push(B.nom[i]!); b.quartier.push(B.quartier[i]!)
    b.lat.push(B.lat[i]!); b.lng.push(B.lng[i]!); b.t.push(B.t[i]!); b.c.push(B.c[i]!)
    b.a.push(B.a[i]!); b.m.push(nouveauMerch.get(B.m[i]!) ?? -1); b.d.push(B.d[i]!)
  }
  const points = D.points.filter(p => nouveauMerch.has(p.merch)).map(p => ({ ...p, merch: nouveauMerch.get(p.merch)! }))
  return { ...D, boutiques: b, merchs, points }
}
