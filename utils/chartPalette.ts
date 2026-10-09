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
  texte: '#64748B',
  taillePolice: 12,
  grille: '#F1F5F9',
  bordure: '#E2E8F0',
  infobulleFond: '#0F172A',
  infobulleTexte: '#FFFFFF',
} as const

/** Couples de statut prêts à l'emploi pour les camemberts à deux parts. */
export const COULEURS_PRESENCE = [STATUT.critique, STATUT.bon] as const // [rupture, présent]
export const COULEURS_RESPECT = [STATUT.critique, STATUT.bon] as const // [non respecté, respecté]
