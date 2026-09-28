import { describe, expect, it } from 'vitest'
import { describeSupabaseError, isMissingObjectError, isTimeoutError } from '../utils/supabaseErrors'

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
    expect(describeSupabaseError({ code: '42P01', message: 'x does not exist' })).toMatch(/migrations/)
    expect(describeSupabaseError({ message: 'permission denied' })).toBe('permission denied')
  })
})
