// utils/pluriel.ts
// Accords en nombre pour les libellés du back-office, à la place des « (s) »
// paresseux (« 3 point(s) de vente »). Règle française : 0 et 1 au singulier.

const formatNombre = new Intl.NumberFormat('fr-FR')

/** Forme du mot selon le nombre : `pluriel(2, 'visite')` → « visites ». */
export function pluriel(n: number | null | undefined, singulier: string, formePlurielle = `${singulier}s`): string {
  return Math.abs(Number(n) || 0) >= 2 ? formePlurielle : singulier
}

/** Nombre formaté suivi du mot accordé : `compte(1200, 'visite')` → « 1 200 visites ». */
export function compte(n: number | null | undefined, singulier: string, formePlurielle = `${singulier}s`): string {
  return `${formatNombre.format(Number(n) || 0)} ${pluriel(n, singulier, formePlurielle)}`
}
