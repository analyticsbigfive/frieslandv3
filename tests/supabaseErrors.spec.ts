import { describe, expect, it } from 'vitest'
import { describeSupabaseError, isMissingObjectError, isTimeoutError, messageUtilisateur } from '../utils/supabaseErrors'

describe('isTimeoutError', () => {
  it('reconnaît le 504 PostgREST « upstream request timeout » (prod, 24 sept. 2026)', () => {
    expect(isTimeoutError({ message: 'upstream request timeout' })).toBe(true)
    expect(isTimeoutError({ message: '', status: 504 })).toBe(true)
  })
  it('reconnaît le statement_timeout Postgres (57014)', () => {
    expect(isTimeoutError({ code: '57014', message: 'canceling statement due to statement timeout' })).toBe(true)
  })
  it('ne confond pas une vue manquante avec un délai dépassé', () => {
    expect(isTimeoutError({ code: '42P01', message: 'relation "public.v_stats_visites" does not exist' })).toBe(false)
    expect(isTimeoutError(null)).toBe(false)
    expect(isTimeoutError('view missing')).toBe(false)
  })
})

describe('isMissingObjectError', () => {
  it('reconnaît une relation ou une RPC absente', () => {
    expect(isMissingObjectError({ code: '42P01', message: 'relation does not exist' })).toBe(true)
    expect(isMissingObjectError({ code: 'PGRST202', message: 'Could not find the function' })).toBe(true)
    expect(isMissingObjectError({ message: 'upstream request timeout' })).toBe(false)
  })
})

describe('describeSupabaseError', () => {
  it('oriente vers un nouvel essai en cas de délai dépassé, vers les migrations sinon', () => {
    expect(describeSupabaseError({ message: 'upstream request timeout' })).toMatch(/délai dépassé/)
    expect(describeSupabaseError({ code: '42P01', message: 'x does not exist' })).toMatch(/administrateur technique/)
    expect(describeSupabaseError({ message: 'permission denied' })).toBe('permission denied')
  })
})

describe('messageUtilisateur', () => {
  it('ne montre jamais de SQL ni de consigne de migration', () => {
    expect(messageUtilisateur({ code: '42P01', message: 'relation "public.v_x" does not exist' })).not.toMatch(/relation|migration|SQL/i)
    expect(messageUtilisateur({ code: '23505', message: 'duplicate key value violates unique constraint "pdv_pkey"' })).toBe('Cet élément existe déjà.')
    expect(messageUtilisateur({ code: '23503', message: 'update or delete violates foreign key constraint' })).toMatch(/utilisé ailleurs/)
    expect(messageUtilisateur({ code: 'XX000', message: 'syntax error at or near "select" in function bar()' })).toMatch(/n'a pas abouti/)
  })
  it('reprend le message français de nos routes /api', () => {
    expect(messageUtilisateur({ statusCode: 400, data: { message: 'Un compte agence doit être rattaché à son agence (Employeur)' } }))
      .toBe('Un compte agence doit être rattaché à son agence (Employeur)')
  })
  it('distingue réseau, délai, session et droits', () => {
    expect(messageUtilisateur({ message: 'Failed to fetch' })).toMatch(/connexion/)
    expect(messageUtilisateur({ code: '57014', message: 'canceling statement due to statement timeout' })).toMatch(/trop de temps/)
    expect(messageUtilisateur({ code: 'PGRST301', message: 'JWT expired' })).toMatch(/session a expiré/)
    expect(messageUtilisateur({ code: '42501', message: 'permission denied for table pdv' })).toMatch(/droits/)
  })
})
