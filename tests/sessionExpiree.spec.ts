import { describe, expect, it } from 'vitest'
import { cheminRetourValide, estErreurSessionExpiree } from '../utils/sessionExpiree'
import { compte, pluriel } from '../utils/pluriel'

describe('estErreurSessionExpiree', () => {
  it('reconnaît un jeton refusé par PostgREST ou GoTrue', () => {
    expect(estErreurSessionExpiree({ code: 'PGRST301', message: 'JWT expired' })).toBe(true)
    expect(estErreurSessionExpiree({ status: 401, message: '' })).toBe(true)
    expect(estErreurSessionExpiree({ message: 'Invalid Refresh Token: Refresh Token Not Found' })).toBe(true)
  })
  it('ne prend pas un refus de droits ni un délai pour une expiration', () => {
    expect(estErreurSessionExpiree({ code: '42501', status: 403, message: 'permission denied for table pdv' })).toBe(false)
    expect(estErreurSessionExpiree({ code: '57014', message: 'canceling statement due to statement timeout' })).toBe(false)
    expect(estErreurSessionExpiree(null)).toBe(false)
    expect(estErreurSessionExpiree('JWT expired')).toBe(false)
  })
})

describe('cheminRetourValide', () => {
  it('accepte un chemin interne du back-office ou de l’application', () => {
    expect(cheminRetourValide('/admin')).toBe('/admin')
    expect(cheminRetourValide('/admin/visites?visite=abc&page=2')).toBe('/admin/visites?visite=abc&page=2')
    expect(cheminRetourValide(['/mobile/pdv'])).toBe('/mobile/pdv')
  })
  it('refuse une adresse externe ou un autre espace', () => {
    expect(cheminRetourValide('https://exemple.com/admin')).toBeNull()
    expect(cheminRetourValide('//exemple.com/admin')).toBeNull()
    expect(cheminRetourValide('/admin//exemple.com')).toBeNull()
    expect(cheminRetourValide('/\\exemple.com')).toBeNull()
    expect(cheminRetourValide('/administrateur')).toBeNull()
    expect(cheminRetourValide('/login')).toBeNull()
    expect(cheminRetourValide(undefined)).toBeNull()
  })
})

describe('pluriel', () => {
  it('garde le singulier pour 0 et 1', () => {
    expect(pluriel(0, 'visite')).toBe('visite')
    expect(pluriel(1, 'visite')).toBe('visite')
    expect(pluriel(2, 'visite')).toBe('visites')
    expect(pluriel(3, 'point de vente', 'points de vente')).toBe('points de vente')
  })
  it('formate le nombre à la française', () => {
    expect(compte(1200, 'visite').replace(/\s/g, ' ')).toBe('1 200 visites')
    expect(compte(null, 'règle')).toBe('0 règle')
  })
})
