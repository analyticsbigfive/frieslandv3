import { describe, it, expect } from 'vitest'
import { construireCatalogue } from '../composables/useCatalogueReleve'
import { PRODUCT_CATALOG, definirCatalogue, getSkus, categoriesProduitsActives, categoryPresent } from '../utils/products'

// Lignes telles que posées par la migration 20261007130000.
const categories = [
  { code: 'evap', libelle: 'EVAP', actif: true, ordre: 1, facings: true },
  { code: 'imp', libelle: 'IMP', actif: true, ordre: 2, facings: true },
  { code: 'scm', libelle: 'SCM', actif: true, ordre: 3, facings: true },
  { code: 'uht', libelle: 'UHT', actif: true, ordre: 4, facings: false },
  { code: 'yaourt', libelle: 'Yaourt', actif: false, ordre: 5, facings: false },
  { code: 'cereales', libelle: 'Céréales', actif: false, ordre: 6, facings: false },
]
const skus = PRODUCT_CATALOG.flatMap(c => c.skus.map((s, i) => ({ category: c.key, sku: s.key, label: s.label, seuil_bas: 3, ordre: i + 1, actif: true })))

describe('catalogue du formulaire', () => {
  it('reproduit exactement les clés du catalogue codé (non-régression des visites)', () => {
    const { catalogue } = construireCatalogue(categories, skus)
    for (const c of PRODUCT_CATALOG) {
      expect(catalogue.find(x => x.key === c.key)!.skus.map(s => s.key)).toEqual(c.skus.map(s => s.key))
    }
  })

  it('ordre, désactivation et nouvelle catégorie', () => {
    const { catalogue, tous } = construireCatalogue(
      [...categories, { code: 'lait', libelle: 'Lait', actif: true, ordre: 0, facings: false }],
      [...skus.map(s => (s.category === 'uht' && s.sku === 'brique_1l' ? { ...s, actif: false } : s)), { category: 'lait', sku: 'lait_1l', label: 'Lait 1L', seuil_bas: 2, ordre: 1, actif: true }],
    )
    definirCatalogue(catalogue, tous)
    expect(categoriesProduitsActives().map(c => c.key)).toEqual(['lait', 'evap', 'imp', 'scm', 'uht'])
    expect(getSkus('uht').map(s => s.key)).toEqual(['demi_ecreme', 'elopack_500ml'])
    expect(getSkus('uht', { inclureInactifs: true }).map(s => s.key)).toContain('brique_1l')
    // Une ancienne visite avec le SKU retiré reste « présente ».
    expect(categoryPresent({ quantites: { brique_1l: 4 } }, 'uht')).toBe(true)
    expect(getSkus('lait')[0]).toMatchObject({ key: 'lait_1l', seuilBasDefaut: 2 })
  })

  it('sans ligne SKU pour une catégorie : repli sur le catalogue codé', () => {
    const { catalogue } = construireCatalogue(categories, [])
    expect(catalogue.find(c => c.key === 'imp')!.skus.length).toBe(9)
  })
})

describe('données de visite par défaut et clé d’un nouveau produit', () => {
  it('garde les mêmes blocs et clés de produits avec le catalogue de la base', async () => {
    const { catalogue, tous } = construireCatalogue(categories, skus)
    definirCatalogue(catalogue, tous)
    const { getDefaultVisiteData } = await import('../types/index')
    const produits = getDefaultVisiteData().produits as Record<string, any>
    expect(Object.keys(produits).sort()).toEqual(PRODUCT_CATALOG.map(c => c.key).sort())
    for (const c of PRODUCT_CATALOG) {
      const cles = Object.keys(produits[c.key]).filter(k => !['present', 'prix_respectes', 'quantites', 'facings'].includes(k))
      expect(cles.sort()).toEqual(c.skus.map(s => s.key).sort())
      for (const s of c.skus) expect(produits[c.key][s.key]).toBe('En rupture')
    }
  })

  it('ajoute le bloc d’une catégorie créée dans l’admin', async () => {
    const { catalogue, tous } = construireCatalogue(
      [...categories, { code: 'beurre', libelle: 'Beurre', actif: true, ordre: 7, facings: false }],
      [...skus, { category: 'beurre', sku: 'beurre_250g', label: 'Beurre 250 g', seuil_bas: 3, ordre: 1, actif: true }],
    )
    definirCatalogue(catalogue, tous)
    const { getDefaultVisiteData } = await import('../types/index')
    expect(getDefaultVisiteData().produits.beurre).toEqual({ present: false, prix_respectes: false, quantites: {}, beurre_250g: 'En rupture' })
  })

  it('génère une clé au format de la base, unique dans la catégorie', async () => {
    const { cleSkuDepuisLibelle } = await import('../utils/catalogueSku')
    expect(cleSkuDepuisLibelle('BR Délice 170 g')).toBe('br_delice_170_g')
    expect(cleSkuDepuisLibelle('BR Gold', ['br_gold'])).toBe('br_gold_2')
    expect(cleSkuDepuisLibelle('BR Gold', ['br_gold', 'br_gold_2'])).toBe('br_gold_3')
    expect(cleSkuDepuisLibelle('Présent')).toBe('sku_present')
    expect(cleSkuDepuisLibelle('  ** ')).toBe('produit')
    expect(cleSkuDepuisLibelle('Facings')).toBe('sku_facings')
    for (const cle of ['br_delice_170_g', 'sku_present', 'produit']) expect(cle).toMatch(/^[a-z0-9_]+$/)
  })
})
