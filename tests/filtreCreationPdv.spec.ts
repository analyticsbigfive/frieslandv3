import { describe, expect, it } from 'vitest'
import { filtrerAuteur, filtrerDateCreation, filtreCreationActif, lendemain } from '../utils/filtreCreationPdv'

// Requête factice : enregistre les appels comme le ferait le client Supabase.
function requete() {
  const appels: string[] = []
  const q: any = {
    gte: (c: string, v: string) => { appels.push(`${c}>=${v}`); return q },
    lt: (c: string, v: string) => { appels.push(`${c}<${v}`); return q },
    eq: (c: string, v: string) => { appels.push(`${c}=${v}`); return q },
  }
  return { q, appels }
}

describe('filtre de création des PDV', () => {
  it('passe au lendemain, fin de mois et d\'année comprises', () => {
    expect(lendemain('2026-11-04')).toBe('2026-11-05')
    expect(lendemain('2026-11-30')).toBe('2026-12-01')
    expect(lendemain('2026-12-31')).toBe('2027-01-01')
  })
  it('borne « au » incluse : un PDV créé le 04/11 à 12 h 04 est dans « du 04/11 au 04/11 »', () => {
    const { q, appels } = requete()
    filtrerDateCreation(q, '2026-11-04', '2026-11-04')
    expect(appels).toEqual(['created_at>=2026-11-04', 'created_at<2026-11-05'])
  })
  it('sans borne, aucun filtre', () => {
    const { q, appels } = requete()
    filtrerAuteur(filtrerDateCreation(q, '', ''), '')
    expect(appels).toEqual([])
  })
  it('filtre le compte sur sa valeur exacte', () => {
    const { q, appels } = requete()
    filtrerAuteur(q, 'GUI STEPHANE')
    expect(appels).toEqual(['ajoute_par=GUI STEPHANE'])
  })
  it('signale un filtre de création posé (tri du plus récent)', () => {
    expect(filtreCreationActif({ creeDu: '', creeAu: '', auteur: '' })).toBe(false)
    expect(filtreCreationActif({ creeDu: '2026-11-04' })).toBe(true)
    expect(filtreCreationActif({ auteur: 'GUI STEPHANE' })).toBe(true)
  })
})
