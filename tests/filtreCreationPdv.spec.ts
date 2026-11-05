import { describe, expect, it } from 'vitest'
import { aujourdhuiAbidjan, filtrerAuteur, filtrerDateCreation, filtreCreationActif, lendemain, libelleCreation, plageCreation } from '../utils/filtreCreationPdv'

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

describe('raccourcis « Date de création »', () => {
  it('aujourd\'hui et hier : un seul jour', () => {
    expect(plageCreation('aujourdhui', '2026-11-05')).toEqual({ debut: '2026-11-05', fin: '2026-11-05' })
    expect(plageCreation('hier', '2026-11-05')).toEqual({ debut: '2026-11-04', fin: '2026-11-04' })
  })
  it('hier au 1er du mois : dernier jour du mois précédent', () => {
    expect(plageCreation('hier', '2026-11-01')).toEqual({ debut: '2026-10-31', fin: '2026-10-31' })
    expect(plageCreation('hier', '2027-01-01')).toEqual({ debut: '2026-12-31', fin: '2026-12-31' })
    expect(plageCreation('hier', '2028-03-01')).toEqual({ debut: '2028-02-29', fin: '2028-02-29' })
  })
  it('7 derniers jours : aujourd\'hui compris, à cheval sur deux mois', () => {
    expect(plageCreation('7j', '2026-11-05')).toEqual({ debut: '2026-10-30', fin: '2026-11-05' })
  })
  it('ce mois : du 1er à aujourd\'hui', () => {
    expect(plageCreation('mois', '2026-11-05')).toEqual({ debut: '2026-11-01', fin: '2026-11-05' })
    expect(plageCreation('mois', '2026-11-01')).toEqual({ debut: '2026-11-01', fin: '2026-11-01' })
  })
  it('mois dernier : mois complet, y compris en janvier et en mars', () => {
    expect(plageCreation('mois_dernier', '2026-11-05')).toEqual({ debut: '2026-10-01', fin: '2026-10-31' })
    expect(plageCreation('mois_dernier', '2027-01-15')).toEqual({ debut: '2026-12-01', fin: '2026-12-31' })
    expect(plageCreation('mois_dernier', '2027-03-31')).toEqual({ debut: '2027-02-01', fin: '2027-02-28' })
  })
  it('toutes les dates et période : aucune borne imposée', () => {
    expect(plageCreation('tout', '2026-11-05')).toEqual({ debut: '', fin: '' })
    expect(plageCreation('periode', '2026-11-05')).toEqual({ debut: '', fin: '' })
  })
  it('jour d\'Abidjan = jour UTC, même tard le soir', () => {
    expect(aujourdhuiAbidjan(new Date('2026-11-05T23:59:00Z'))).toBe('2026-11-05')
    expect(aujourdhuiAbidjan(new Date('2026-11-06T00:01:00Z'))).toBe('2026-11-06')
  })
})

describe('pastille « Créé : … »', () => {
  it('rappelle la date pour aujourd\'hui et hier', () => {
    expect(libelleCreation('hier', plageCreation('hier', '2026-11-05'))).toBe('hier (04/11/2026)')
    expect(libelleCreation('aujourdhui', plageCreation('aujourdhui', '2026-11-05'))).toBe('aujourd\'hui (05/11/2026)')
  })
  it('nomme les autres raccourcis', () => {
    expect(libelleCreation('7j', plageCreation('7j', '2026-11-05'))).toBe('7 derniers jours')
    expect(libelleCreation('mois', plageCreation('mois', '2026-11-05'))).toBe('ce mois')
    expect(libelleCreation('mois_dernier', plageCreation('mois_dernier', '2026-11-05'))).toBe('mois dernier')
  })
  it('période : bornes saisies, une seule ou aucune', () => {
    expect(libelleCreation('periode', { debut: '2026-11-01', fin: '2026-11-04' })).toBe('du 01/11/2026 au 04/11/2026')
    expect(libelleCreation('periode', { debut: '2026-11-04', fin: '2026-11-04' })).toBe('le 04/11/2026')
    expect(libelleCreation('periode', { debut: '2026-11-01', fin: '' })).toBe('depuis le 01/11/2026')
    expect(libelleCreation('periode', { debut: '', fin: '2026-11-04' })).toBe('jusqu\'au 04/11/2026')
    expect(libelleCreation('periode', { debut: '', fin: '' })).toBe('')
  })
  it('toutes les dates : pas de pastille', () => {
    expect(libelleCreation('tout', { debut: '', fin: '' })).toBe('')
  })
})
