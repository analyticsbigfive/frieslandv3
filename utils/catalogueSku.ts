// utils/catalogueSku.ts
// Clé d'un nouveau produit du formulaire, tirée de son libellé. La clé est
// figée après création (elle range les quantités dans visites.data) : elle
// respecte le format imposé en base (minuscules, chiffres, _) et n'est jamais
// un nom réservé du bloc de catégorie.

const RESERVES = new Set(['present', 'prix_respectes', 'quantites', 'facings'])

export function cleSkuDepuisLibelle(libelle: string, existantes: string[] = []): string {
  let base = libelle
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
    .replace(/_+$/g, '')
  if (!base) base = 'produit'
  if (RESERVES.has(base)) base = `sku_${base}`
  const prises = new Set(existantes)
  if (!prises.has(base)) return base
  for (let i = 2; ; i++) {
    const cle = `${base}_${i}`
    if (!prises.has(cle)) return cle
  }
}
