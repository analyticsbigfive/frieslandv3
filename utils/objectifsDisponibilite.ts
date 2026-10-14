// utils/objectifsDisponibilite.ts
// Objectifs de disponibilité 2026 (fichier client du 14/10/2026) : libellés,
// ordre du fichier, canal d'objectif d'un PDV et état « atteint / proche / en
// retard ». Miroir TS de la migration 20261014130000 (canal_objectif,
// dashboard_objectifs_disponibilite). Module pur, testé par vitest.

export type CanalObjectif = 'GT_ABIDJAN' | 'GT_UPC' | 'MT'
export type ColonneObjectif = CanalObjectif | 'NATIONAL'
export type Indicateur = 'dispo' | 'plv_exterieure' | 'plv_interieure' | 'prix'
export type Famille = 'evap' | 'scm' | 'imp'
export type EtatObjectif = 'atteint' | 'proche' | 'retard' | 'base_faible' | 'sans_objectif' | 'sans_mesure'

/** Ligne renvoyée par la RPC dashboard_objectifs_disponibilite. */
export interface LigneObjectif {
  canal: ColonneObjectif | 'INCONNU'
  indicateur: Indicateur
  reference_produit_id: number | null
  reference_nom: string | null
  categorie: Famille | null
  mesures: number
  atteints: number
  hors_calcul: number
  taux: number | null
  cible: number | null
}

export const CANAUX: { code: CanalObjectif, label: string, long: string }[] = [
  { code: 'GT_ABIDJAN', label: 'GT Abidjan', long: 'Boutiques d’Abidjan (GT)' },
  { code: 'GT_UPC', label: 'GT intérieur', long: 'Boutiques de l’intérieur (GT)' },
  { code: 'MT', label: 'MT', long: 'Supermarchés (MT)' },
]
export const COLONNES: { code: ColonneObjectif, label: string, long: string }[] = [
  ...CANAUX,
  { code: 'NATIONAL', label: 'National', long: 'Ensemble des canaux (objectif : moyenne des canaux)' },
]

export const FAMILLES: { code: Famille, label: string }[] = [
  { code: 'evap', label: 'Lait évaporé (EVAP)' },
  { code: 'scm', label: 'Lait concentré sucré (SCM)' },
  { code: 'imp', label: 'Lait en poudre (IMP)' },
]

/**
 * Produits des objectifs, dans l'ordre du fichier, avec le libellé du client.
 * id = reference_produit.id. BRB = Bonnet Rouge Veg (ex-« Bleu »).
 */
export const PRODUITS: { id: number, famille: Famille, label: string }[] = [
  { id: 4, famille: 'evap', label: 'Bonnet Rouge 380 g' },
  { id: 2, famille: 'evap', label: 'Bonnet Rouge 150 g' },
  { id: 5, famille: 'evap', label: 'Bonnet Rouge Veg 380 g' },
  { id: 3, famille: 'evap', label: 'Bonnet Rouge Veg 150 g' },
  { id: 1, famille: 'evap', label: 'BR Gold 160 g' },
  { id: 6, famille: 'evap', label: 'Pearl 380 g' },
  { id: 14, famille: 'scm', label: 'Bonnet Rouge Veg 1 kg' },
  { id: 15, famille: 'scm', label: 'Pearl Veg 1 kg' },
  { id: 13, famille: 'imp', label: 'Boîte 2,5 kg' },
  { id: 12, famille: 'imp', label: 'Boîte 900 g' },
  { id: 11, famille: 'imp', label: 'Boîte 400 g' },
  { id: 9, famille: 'imp', label: 'Pouch 360 g' },
  { id: 7, famille: 'imp', label: 'Sachet 15 g' },
  { id: 10, famille: 'imp', label: 'Délice 350 g' },
  { id: 8, famille: 'imp', label: 'Délice 15 g' },
]

/** En dessous, le taux d'une cellule est signalé comme fragile. */
export const BASE_FAIBLE = 30
/** Écart toléré (en points) pour l'état « proche ». */
export const ECART_PROCHE = 5

/**
 * Canal d'objectif d'un PDV : Modern trade d'abord, puis la région du PDV
 * (ABIDJAN 1/2, CNO, CNE, C), à défaut la division de son territoire
 * (ABIDJAN / UP COUNTRY). null si rien ne permet de trancher.
 */
export function canalObjectif(canal?: string | null, region?: string | null, division?: string | null): CanalObjectif | null {
  const c = String(canal || '').trim().toLowerCase()
  const r = String(region || '').trim().toUpperCase()
  const d = String(division || '').trim().toUpperCase()
  if (c === 'modern trade') return 'MT'
  if (r.startsWith('ABIDJAN')) return 'GT_ABIDJAN'
  if (['CNO', 'CNE', 'C', 'NORTH 1', 'NORTH 2'].includes(r)) return 'GT_UPC'
  if (d === 'ABIDJAN') return 'GT_ABIDJAN'
  if (d === 'UP COUNTRY') return 'GT_UPC'
  return null
}

/** Objectif national : moyenne des canaux qui ont un objectif (en %). */
export function cibleNationale(cibles: (number | null | undefined)[]): number | null {
  const v = cibles.filter((x): x is number => typeof x === 'number' && Number.isFinite(x))
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null
}

/**
 * État d'une cellule : réalisé et objectif en %, comparés ARRONDIS (ce que
 * l'écran affiche : « 91 % / objectif 91 % » est atteint). Un objectif à 0
 * n'en est pas un ; sous BASE_FAIBLE points de vente, pas de verdict.
 */
export function etatObjectif(taux: number | null | undefined, cible: number | null | undefined, mesures = BASE_FAIBLE): EtatObjectif {
  if (cible == null || cible <= 0) return 'sans_objectif'
  if (taux == null || !mesures) return 'sans_mesure'
  if (mesures < BASE_FAIBLE) return 'base_faible'
  const ecart = Math.round(taux) - Math.round(cible)
  if (ecart >= 0) return 'atteint'
  if (ecart >= -ECART_PROCHE) return 'proche'
  return 'retard'
}

/** Écart affiché, en points : réalisé arrondi moins objectif arrondi. */
export function ecartPoints(taux: number | null | undefined, cible: number | null | undefined): number | null {
  return taux == null || cible == null ? null : Math.round(taux) - Math.round(cible)
}

export const LIBELLE_ETAT: Record<EtatObjectif, string> = {
  atteint: 'Atteint',
  proche: 'Proche',
  retard: 'En retard',
  base_faible: 'Base faible',
  sans_objectif: 'Pas d’objectif',
  sans_mesure: 'Pas de relevé',
}

/** Trimestre civil d'une date (1 à 4). */
export function trimestreDe(date: Date = new Date()): { annee: number, trimestre: number } {
  return { annee: date.getFullYear(), trimestre: Math.floor(date.getMonth() / 3) + 1 }
}

export interface Periode { annee: number, trimestre: number }
const MOIS_TRIMESTRE = ['janvier à mars', 'avril à juin', 'juillet à septembre', 'octobre à décembre']

/** Trimestre précédent (T1 → T4 de l'année d'avant). */
export function trimestrePrecedent(p: Periode): Periode {
  return p.trimestre > 1 ? { annee: p.annee, trimestre: p.trimestre - 1 } : { annee: p.annee - 1, trimestre: 4 }
}

/** « 2026-T3 » ⇄ période (paramètre d'URL). */
export const cleTrimestre = (p: Periode) => `${p.annee}-T${p.trimestre}`
export function lireCleTrimestre(v: unknown): Periode | null {
  const m = String(v ?? '').match(/^(\d{4})-T([1-4])$/)
  return m ? { annee: Number(m[1]), trimestre: Number(m[2]) } : null
}

/**
 * Trimestres proposés, du plus récent au plus ancien, de T1 2026 (premiers
 * objectifs) au trimestre de `jusqua` ; le trimestre courant est dit « en cours ».
 */
export function trimestresProposes(jusqua: Periode, courant: Periode = trimestreDe()): { value: string, label: string }[] {
  const out: { value: string, label: string }[] = []
  for (let p = jusqua; p.annee > 2026 || (p.annee === 2026 && p.trimestre >= 1); p = trimestrePrecedent(p)) {
    const enCours = p.annee === courant.annee && p.trimestre === courant.trimestre
    out.push({ value: cleTrimestre(p), label: `T${p.trimestre} ${p.annee} (${enCours ? 'en cours' : MOIS_TRIMESTRE[p.trimestre - 1]})` })
    if (p.annee === 2026 && p.trimestre === 1) break
  }
  return out
}

/** Libellé d'un indicateur hors produit. */
export function libelleIndicateur(indicateur: Indicateur, famille?: Famille | null): string {
  if (indicateur === 'plv_exterieure') return 'PLV extérieure'
  if (indicateur === 'plv_interieure') return 'PLV intérieure'
  if (indicateur === 'prix') return `Prix respectés : ${FAMILLES.find(f => f.code === famille)?.label ?? famille ?? ''}`
  return 'Disponibilité'
}

/** Clé d'une ligne du tableau : un produit, une PLV ou les prix d'une famille. */
export function cleLigne(l: Pick<LigneObjectif, 'indicateur' | 'reference_produit_id' | 'categorie'>): string {
  if (l.indicateur === 'dispo') return `dispo:${l.reference_produit_id}`
  if (l.indicateur === 'prix') return `prix:${l.categorie}`
  return l.indicateur
}

/** Lignes de la RPC indexées par ligne du tableau puis par colonne. */
export function indexer(lignes: LigneObjectif[]): Map<string, Partial<Record<ColonneObjectif | 'INCONNU', LigneObjectif>>> {
  const m = new Map<string, Partial<Record<ColonneObjectif | 'INCONNU', LigneObjectif>>>()
  for (const l of lignes) {
    const k = cleLigne(l)
    const parCanal = m.get(k) || {}
    parCanal[l.canal] = l
    m.set(k, parCanal)
  }
  return m
}
