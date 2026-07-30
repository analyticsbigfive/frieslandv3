import { describe, it, expect } from 'vitest'
import {
  normaliserNomConcurrent,
  concurrentsDeLaVisite,
  agregerConcurrents,
  grouperMarquesParFamille,
  MARQUES_CONCURRENTES_DEFAUT,
} from '../utils/concurrence'

// Le client a exigé la saisie libre du nom d'un nouveau concurrent ET une
// agrégation fiable dans le dashboard. Sans normalisation, les deux exigences
// se contredisent : trois graphies = trois lignes, et le classement ment.
describe('normaliserNomConcurrent', () => {
  it('regroupe casse, espaces et accents', () => {
    const cles = ['Cowmilk', 'cowmilk ', ' COW MILK', 'Cow-Milk'].map(normaliserNomConcurrent)
    expect(new Set(cles).size).toBe(1)
  })

  it('ignore les accents', () => {
    expect(normaliserNomConcurrent('Crèmerie')).toBe(normaliserNomConcurrent('Cremerie'))
  })

  it('renvoie une chaîne vide pour une saisie sans contenu', () => {
    expect(normaliserNomConcurrent('   ')).toBe('')
    expect(normaliserNomConcurrent('!!!')).toBe('')
  })
})

describe('concurrentsDeLaVisite', () => {
  it('lit le nouveau format (autres[])', () => {
    const res = concurrentsDeLaVisite({
      autres: [{ nom: 'Laitier X', en_activite: true, action_concurrence: 'Promo -20%' }],
    } as any)
    expect(res).toHaveLength(1)
    expect(res[0].nom).toBe('Laitier X')
  })

  it('lit encore l’ancien format à plat (autre = Présent + nom_concurrent)', () => {
    // Les visites d’avant juillet 2026 n’ont pas de tableau `autres`.
    // Si le lecteur ne gère que le nouveau format, tout l’historique
    // disparaît du dashboard le jour du déploiement.
    const res = concurrentsDeLaVisite({
      evap: { present: true, autre: 'Présent', nom_concurrent: 'Vieux Concurrent' },
    } as any)
    expect(res).toHaveLength(1)
    expect(res[0]).toMatchObject({ nom: 'Vieux Concurrent', categorie: 'evap' })
  })

  it('ignore un ancien bloc sans nom saisi', () => {
    const res = concurrentsDeLaVisite({ evap: { present: true, autre: 'Présent' } } as any)
    expect(res).toEqual([])
  })

  it('renvoie un tableau vide si la visite n’a pas de bloc concurrence', () => {
    expect(concurrentsDeLaVisite(null)).toEqual([])
    expect(concurrentsDeLaVisite(undefined)).toEqual([])
  })
})

describe('agregerConcurrents', () => {
  const visites = [
    { data: { concurrence: { autres: [{ nom: 'Cowmilk', en_activite: true, action_concurrence: 'Promo' }] } } },
    { data: { concurrence: { autres: [{ nom: 'cowmilk', en_activite: false }] } } },
    { data: { concurrence: { evap: { present: true, autre: 'Présent', nom_concurrent: 'COW MILK' } } } },
    { data: { concurrence: { autres: [{ nom: 'Top Saho', en_activite: true, action_concurrence: 'Promo' }] } } },
  ] as any[]

  it('regroupe les trois graphies en une seule entrée', () => {
    const agrege = agregerConcurrents(visites)
    expect(agrege).toHaveLength(2)
    const cowmilk = agrege.find(c => c.cle === 'cowmilk')!
    expect(cowmilk.signalements).toBe(3)
    expect(cowmilk.en_activite).toBe(1)
  })

  it('affiche la première graphie rencontrée, pas la clé normalisée', () => {
    expect(agregerConcurrents(visites)[0].nom).toBe('Cowmilk')
  })

  it('dédoublonne les actions relevées', () => {
    const agrege = agregerConcurrents([
      { data: { concurrence: { autres: [{ nom: 'X', action_concurrence: 'Promo' }] } } },
      { data: { concurrence: { autres: [{ nom: 'X', action_concurrence: 'Promo' }] } } },
      { data: { concurrence: { autres: [{ nom: 'X', action_concurrence: 'Fidélité' }] } } },
    ] as any[])
    expect(agrege[0].actions).toEqual(['Promo', 'Fidélité'])
  })

  it('trie par nombre de signalements décroissant', () => {
    const agrege = agregerConcurrents(visites)
    expect(agrege.map(c => c.nom)).toEqual(['Cowmilk', 'Top Saho'])
  })

  it('ignore les noms vides plutôt que de créer une entrée fantôme', () => {
    expect(agregerConcurrents([{ data: { concurrence: { autres: [{ nom: '  ' }] } } }] as any[])).toEqual([])
  })
})

// Les marques suivies viennent désormais du référentiel marque_concurrente ;
// ce regroupement alimente le formulaire mobile ET le dashboard concurrence.
describe('grouperMarquesParFamille', () => {
  it('regroupe par famille et trie par ordre puis nom', () => {
    const par = grouperMarquesParFamille([
      { famille: 'imp', code: 'top_lait', nom: 'Top Lait', ordre: 3 },
      { famille: 'imp', code: 'nido', nom: 'Nido', ordre: 1 },
      { famille: 'imp', code: 'laity', nom: 'Laity', ordre: 2 },
      { famille: 'evap', code: 'cowmilk', nom: 'Cowmilk', ordre: 1 },
    ])
    expect(par.imp.map(m => m.code)).toEqual(['nido', 'laity', 'top_lait'])
    expect(par.evap.map(m => m.code)).toEqual(['cowmilk'])
  })

  it('départage un ordre identique (ou absent) par le nom', () => {
    const par = grouperMarquesParFamille([
      { famille: 'uht', code: 'zeta', nom: 'Zeta' },
      { famille: 'uht', code: 'alpha', nom: 'Alpha' },
    ])
    expect(par.uht.map(m => m.nom)).toEqual(['Alpha', 'Zeta'])
  })

  it('ignore les lignes sans famille ou sans code', () => {
    const par = grouperMarquesParFamille([
      { famille: '', code: 'x', nom: 'X' },
      { famille: 'evap', code: '', nom: 'Y' },
    ] as any[])
    expect(Object.keys(par)).toEqual([])
  })

  it('le repli hors-ligne couvre les 4 familles du formulaire', () => {
    const par = grouperMarquesParFamille(MARQUES_CONCURRENTES_DEFAUT)
    expect(Object.keys(par).sort()).toEqual(['evap', 'imp', 'scm', 'uht'])
  })
})
