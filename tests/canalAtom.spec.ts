import { describe, it, expect } from 'vitest'
import { canalAtom, libelleTypePdv, CANAUX_ATOM } from '../utils/canalAtom'

// canalAtom doit rendre EXACTEMENT ce que rend public.canal_atom(text) en base
// (supabase/nouveau/20261006101000_friesland_routing_quotas_atom.sql) : c'est
// ce canal qui a fait entrer le PDV dans la tournée par quotas. Les cas
// ci-dessous sont les sous-catégories réellement présentes dans la table pdv.
describe('canalAtom (réplique de canal_atom SQL)', () => {
  it.each([
    // Boutiques (dont « Boutiques de station » : BOUTIQUE suffit côté SQL)
    ['Boutique A', 'Boutique'],
    ['Boutique B', 'Boutique'],
    ['Boutique C', 'Boutique'],
    ['Boutiques de station', 'Boutique'],
    // Superettes : référentiel + libellés historiques GT / MT
    ['Superette GT', 'Superette'],
    ['Superette MT', 'Superette'],
    ['Superettes A', 'Superette'],
    ['Superettes C', 'Superette'],
    ['Minimarket', 'Superette'],
    // Aboki & Kiosque : kiosques, aboki, tables, tabliers
    ['Kiosque', 'Aboki & Kiosque'],
    ['Kiosk A', 'Aboki & Kiosque'],
    ['Kiosk B', 'Aboki & Kiosque'],
    ['Aboki', 'Aboki & Kiosque'],
    ['Aboki B', 'Aboki & Kiosque'],
    ['Table Top', 'Aboki & Kiosque'],
    ['Open Market Table Top', 'Aboki & Kiosque'],
    ['Tabliers', 'Aboki & Kiosque'],
    // Pushcart : orthographe du référentiel (« Pushcard ») comprise
    ['Pushcart', 'Pushcart'],
    ['Pushcard A', 'Pushcart'],
    ['Pushcard B', 'Pushcart'],
    ['Porridge', 'Porridge'],
  ])('%s → %s', (sousCategorie, attendu) => {
    expect(canalAtom(sousCategorie)).toBe(attendu)
  })

  it.each([
    'Supermarché', 'Supermarket C', 'Hypermarché', 'Wholesalers', 'Semi-Wholesalers',
    'Cash&Carry', 'Pharmacy C', 'Bakery A', 'Autre PDV détail (GT)', 'Petrol Station',
  ])('%s → hors grille (null)', (sousCategorie) => {
    expect(canalAtom(sousCategorie)).toBeNull()
  })

  it('insensible à la casse, comme upper() côté SQL', () => {
    expect(canalAtom('boutique c')).toBe('Boutique')
    expect(canalAtom('pUsHcArT')).toBe('Pushcart')
  })

  it('premier motif qui gagne, dans l’ordre du CASE SQL', () => {
    // PORRIDGE est testé avant BOUTIQUE, PUSHCAR avant SUPERETTE, etc.
    expect(canalAtom('Boutique Porridge')).toBe('Porridge')
    expect(canalAtom('Superette Pushcart')).toBe('Pushcart')
    expect(canalAtom('Boutique Kiosque')).toBe('Aboki & Kiosque')
    expect(canalAtom('Boutique Superette')).toBe('Superette')
  })

  it('valeurs vides : null (NULL et chaîne vide ne matchent rien en SQL)', () => {
    expect(canalAtom(null)).toBeNull()
    expect(canalAtom(undefined)).toBeNull()
    expect(canalAtom('')).toBeNull()
    expect(canalAtom('   ')).toBeNull()
  })

  it('ne rend que des canaux de la grille', () => {
    for (const s of ['Boutique A', 'Kiosk A', 'Pushcard B', 'Superettes B', 'Porridge']) {
      expect(CANAUX_ATOM).toContain(canalAtom(s))
    }
  })
})

describe('libelleTypePdv', () => {
  it('canal Atom en priorité', () => {
    expect(libelleTypePdv('Pushcard A')).toBe('Pushcart')
  })

  it('sous-catégorie brute hors grille', () => {
    expect(libelleTypePdv('  Wholesalers ')).toBe('Wholesalers')
  })

  it('rien si la sous-catégorie est vide', () => {
    expect(libelleTypePdv(null)).toBeNull()
    expect(libelleTypePdv('  ')).toBeNull()
  })
})
