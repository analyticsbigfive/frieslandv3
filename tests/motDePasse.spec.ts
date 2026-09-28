import { describe, expect, it } from 'vitest'
import { erreurMotDePasse } from '../utils/motDePasse'

describe('erreurMotDePasse', () => {
  it('garde la règle des 8 caractères pour le terrain', () => {
    expect(erreurMotDePasse('abcdefgh', 'merchandiser')).toBeNull()
    expect(erreurMotDePasse('abcdefg', 'commercial')).not.toBeNull()
  })

  it('refuse l\'ancien mot de passe admin', () => {
    expect(erreurMotDePasse('Test1234!', 'admin', 'admin@friesland.ci')).not.toBeNull()
  })

  it('exige 12 caractères et 3 types pour un compte privilégié', () => {
    expect(erreurMotDePasse('Abcdefgh12!', 'admin')).toMatch(/12 caractères/)
    expect(erreurMotDePasse('abcdefghijklmn', 'superviseur')).toMatch(/3 types/)
    expect(erreurMotDePasse('Lagune-Cocody-2026', 'admin', 'admin@friesland.ci')).toBeNull()
  })

  it('refuse les mots courants et l\'identifiant', () => {
    expect(erreurMotDePasse('MonAzerty-2026', 'admin')).toMatch(/mot courant/)
    expect(erreurMotDePasse('Kouassi.jean-2026', 'admin', 'kouassi@friesland.ci')).toMatch(/identifiant/)
  })
})
