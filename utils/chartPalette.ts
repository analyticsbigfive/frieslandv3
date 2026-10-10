// utils/chartPalette.ts
// Palette unique des graphiques du back-office (voir DESIGN.md).
//
// Catégorielle : ordre fixe, jamais recyclé, validé par le script du skill
// dataviz (validate_palette.js, mode clair, surface #FFFFFF, octobre 2026) :
// écart daltonien le plus faible entre voisins 9,1 (≥ 8), vision normale 19,6
// (≥ 15). Le turquoise, le jaune et le rose sont sous 3:1 sur blanc : un
// graphique qui les emploie garde une légende ou des étiquettes visibles.
// Au-delà de huit séries, regrouper en « Autre » plutôt que générer une teinte.
//
// Statuts (présent / rupture, respecté / non respecté…) : couleurs réservées,
// distinctes des séries, toujours accompagnées d'un libellé.

export const SERIES = [
  '#C8102E', // rouge Bonnet Rouge : série principale
  '#2a78d6', // bleu
  '#eb6834', // orange
  '#1baf7a', // turquoise
  '#eda100', // jaune
  '#e87ba4', // rose
  '#008300', // vert
  '#4a3aa7', // violet
] as const

/** Couleur de la n-ième série (0 = rouge de marque) ; au-delà de 8, gris « Autre ». */
export function couleurSerie(index: number): string {
  return SERIES[index] ?? AUTRE
}

/** Remplissage léger sous une courbe de la série principale. */
export const REMPLISSAGE_PRINCIPAL = 'rgba(200, 16, 46, 0.08)'

export const STATUT = {
  bon: '#0ca30c', // présent, prix respecté, au niveau
  alerte: '#fab219', // stock bas
  serieux: '#ec835a',
  critique: '#d03b3b', // rupture, non respecté
  neutre: '#94A3B8', // sans donnée, non renseigné
} as const

/** Gris des regroupements « Autre ». */
export const AUTRE = '#64748B'

// Familles de produits : la couleur suit la famille, jamais son rang dans le
// graphique (un filtre qui retire une famille ne repeint pas les autres).
const FAMILLES: Record<string, string> = {
  evap: SERIES[1],
  imp: SERIES[2],
  scm: SERIES[3],
  uht: SERIES[4],
  yaourt: SERIES[5],
  cereales: SERIES[6],
}

export function couleurFamille(code: string | null | undefined): string {
  return FAMILLES[String(code || '').toLowerCase()] ?? AUTRE
}

/** Axes, grille et info-bulle : discrets, en slate (DESIGN.md). */
export const AXES = {
  texte: '#64748B', // slate-500 : 4,8:1 sur blanc
  taillePolice: 12,
  grille: '#F1F5F9',
  bordure: '#E2E8F0',
  /** Fond de la carte : trait de séparation des parts d'un camembert. */
  surface: '#FFFFFF',
  infobulleFond: '#0F172A',
  infobulleTexte: '#FFFFFF',
} as const

/** Variante sombre, posée sur les cartes slate-800 (#1E293B). */
export const AXES_SOMBRE = {
  texte: '#94A3B8', // slate-400 : 5,7:1 sur slate-800
  taillePolice: 12,
  grille: '#334155',
  bordure: '#475569',
  surface: '#1E293B',
  infobulleFond: '#F1F5F9',
  infobulleTexte: '#0F172A',
} as const

export type AxesGraphique = typeof AXES | typeof AXES_SOMBRE

/** Axes selon le thème : la variante sombre quand `sombre` est vrai. */
export function axesPour(sombre: boolean): AxesGraphique {
  return sombre ? AXES_SOMBRE : AXES
}

/** Couples de statut prêts à l'emploi pour les camemberts à deux parts. */
export const COULEURS_PRESENCE = [STATUT.critique, STATUT.bon] as const // [rupture, présent]
export const COULEURS_RESPECT = [STATUT.critique, STATUT.bon] as const // [non respecté, respecté]

// Niveaux Perfect Store : échelle ORDONNÉE, donc une seule teinte, du plus
// foncé (Flagship) au plus clair (Basic) ; slate pour « Non conforme ».
// Toujours affichés avec le mot, jamais par la couleur seule.
export const NIVEAUX_PS = [
  { cle: 'FLAGSHIP', court: 'Flagship', long: 'Flagship Store', couleur: '#104281' },
  { cle: 'VIP', court: 'VIP', long: 'VIP Perfect Store', couleur: '#256abf' },
  { cle: 'CORE', court: 'Core', long: 'Core Perfect Store', couleur: '#5598e7' },
  { cle: 'BASIC', court: 'Basic', long: 'Basic Perfect Store', couleur: '#9ec5f4' },
] as const
export const COULEUR_NON_CONFORME = '#CBD5E1'

/** Niveau d'un code de base (« VIP PERFECT STORE »…), ou null (non conforme, inconnu). */
export function niveauPerfectStore(code: string | null | undefined) {
  const c = String(code || '').trim().toUpperCase()
  if (!c || c.startsWith('NON')) return null
  return NIVEAUX_PS.find(n => c.startsWith(n.cle)) ?? null
}
