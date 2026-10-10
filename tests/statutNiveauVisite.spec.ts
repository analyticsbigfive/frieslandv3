import { describe, expect, it } from 'vitest'
import { statutNiveauVisite } from '../utils/perfectStore'

describe('statutNiveauVisite', () => {
  it('distingue un relevé incomplet d’une visite sous les seuils', () => {
    expect(statutNiveauVisite({ tierAtteint: 'VIP PERFECT STORE', osaPondere: 0.9 })).toBe('atteint')
    expect(statutNiveauVisite({ tierAtteint: null, osaPondere: 0.4 })).toBe('non_conforme')
    expect(statutNiveauVisite({ tierAtteint: 'NON CONFORME', osaPondere: 0.4 })).toBe('non_conforme')
    expect(statutNiveauVisite({ tierAtteint: null, osaPondere: null })).toBe('non_evalue')
    expect(statutNiveauVisite(null)).toBe('non_evalue')
  })
})
