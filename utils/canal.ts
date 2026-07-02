// utils/canal.ts
// Source de vérité du canal côté front.
// pdv.canal stocke un libellé ('General trade' | 'Modern trade') ;
// le référentiel (categorie_pdv.canal) stocke un code ('GT' | 'MT').
// Le canal d'un PDV se DÉRIVE de sa catégorie : ne jamais le saisir à la main,
// sinon il diverge du calcul Perfect Store qui lit categorie_pdv.canal.

import type { CanalType } from '~/types'

export const CANAL_GT: CanalType = 'General trade'
export const CANAL_MT: CanalType = 'Modern trade'

// Tolère libellés, codes et casse ('Modern trade', 'MT', 'modern'…).
export function isModernTrade(canal?: string | null): boolean {
  const value = (canal || '').trim().toLowerCase()
  return value === 'mt' || value.includes('modern')
}

// Code référentiel ('GT'/'MT') → libellé stocké sur pdv.canal.
export function canalLabelFromCode(code?: string | null): CanalType {
  return (code || '').trim().toUpperCase() === 'MT' ? CANAL_MT : CANAL_GT
}
