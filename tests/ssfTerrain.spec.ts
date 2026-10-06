import { describe, it, expect } from 'vitest'
import { ssfDuJour, semaineParJour, pdvDansSousZone, libelleSousZone, type JourSsf, type QuartierSsf } from '../utils/ssfTerrain'

const ligne = (jour: number, ssf: number, template = `t${ssf}`): JourSsf => ({
  jour_semaine: jour, template_id: template, libelle: `SSF — ${ssf}`, ssf_id: ssf, ssf_nom: `SSF ${ssf}`,
  ssf_telephone: null, distributeur: 'BRACODI', zone: 'ADJAME', quartiers: ['220 LGTS'],
})

describe('SSF du terrain', () => {
  it('SSF du jour : celui de la règle de la tournée, sinon le premier', () => {
    const semaine = [ligne(1, 7), ligne(1, 9), ligne(2, 9)]
    expect(ssfDuJour(semaine, 1)?.ssf_id).toBe(7)
    expect(ssfDuJour(semaine, 1, 't9')?.ssf_id).toBe(9)
    expect(ssfDuJour(semaine, 1, 'inconnue')?.ssf_id).toBe(7)
    expect(ssfDuJour(semaine, 3)).toBeNull()
  })

  it('semaine du lundi au samedi, jours sans SSF compris', () => {
    const jours = semaineParJour([ligne(2, 9), ligne(6, 4)])
    expect(jours.map(j => j.libelle)).toEqual(['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'])
    expect(jours.map(j => j.ssf.length)).toEqual([0, 1, 0, 0, 0, 1])
  })

  it('PDV dans la sous-zone : zone et quartier exacts, comme les tournées', () => {
    const quartiers: QuartierSsf[] = [
      { ssf_id: 7, zone: 'ADJAME', quartier: '220 LGTS' },
      { ssf_id: 7, zone: 'ADJAME', quartier: 'BRACODI' },
      { ssf_id: 9, zone: 'KOUMASSI', quartier: 'REMBLAIS' },
    ]
    expect(pdvDansSousZone({ zone: 'ADJAME', quartier: 'BRACODI' }, quartiers, 7)).toBe(true)
    expect(pdvDansSousZone({ zone: 'ADJAME', quartier: ' BRACODI ' }, quartiers, 7)).toBe(true)
    expect(pdvDansSousZone({ zone: 'KOUMASSI', quartier: 'REMBLAIS' }, quartiers, 7)).toBe(false)
    expect(pdvDansSousZone({ zone: 'YOPOUGON 3', quartier: 'BRACODI' }, quartiers, 7)).toBe(false)
    // Impossible à dire : pas d'avertissement.
    expect(pdvDansSousZone({ zone: 'ADJAME', quartier: null }, quartiers, 7)).toBeNull()
    expect(pdvDansSousZone({ zone: 'ADJAME', quartier: 'BRACODI' }, quartiers, 12)).toBeNull()
    expect(pdvDansSousZone({ zone: 'ADJAME', quartier: 'BRACODI' }, quartiers, null)).toBeNull()
    expect(pdvDansSousZone(null, quartiers, 7)).toBeNull()
  })

  it('libellé de la sous-zone, par zone', () => {
    const quartiers: QuartierSsf[] = [
      { ssf_id: 7, zone: 'ADJAME', quartier: '220 LGTS' },
      { ssf_id: 7, zone: 'ADJAME', quartier: 'BRACODI' },
      { ssf_id: 7, zone: 'PLATEAU', quartier: 'CENTRE' },
    ]
    expect(libelleSousZone(quartiers, 7)).toBe('ADJAME : 220 LGTS, BRACODI · PLATEAU : CENTRE')
    expect(libelleSousZone(quartiers, 9)).toBe('')
  })
})
