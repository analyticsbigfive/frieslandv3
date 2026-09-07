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

// ---------------------------------------------------------------------------
// Lot 6 (1.0.4) : concurrence par SKU et visibilité concurrence pilotée par le
// référentiel. Deux formats JSONB coexistent : les tests verrouillent la
// lecture des anciennes visites autant que le nouveau relevé.
// ---------------------------------------------------------------------------
import {
  SKUS_CONCURRENTS_DEFAUT,
  grouperSkusParMarque,
  statutMarqueDerive,
  cleVisibiliteMarque,
  marquesPourVisibilite,
  visibiliteConcurrencePresente,
} from '../utils/concurrence'

describe('SKUS_CONCURRENTS_DEFAUT', () => {
  it('reprend les 19 SKU de la liste Présence du client, codes uniques', () => {
    expect(SKUS_CONCURRENTS_DEFAUT).toHaveLength(19)
    expect(new Set(SKUS_CONCURRENTS_DEFAUT.map(s => s.code)).size).toBe(19)
  })

  it('rattache chaque SKU à une marque du repli marques', () => {
    const marques = new Set(MARQUES_CONCURRENTES_DEFAUT.map(m => `${m.famille}:${m.code}`))
    // Les marques ajoutées par le lot 6 (laity/soleil EVAP, biblos/captain IMP)
    // sont seedées en base ; le repli hors ligne les porte via le SKU lui-même.
    const attendues = new Set([...marques, 'evap:laity', 'evap:soleil', 'imp:biblos', 'imp:captain'])
    for (const s of SKUS_CONCURRENTS_DEFAUT) expect(attendues.has(`${s.famille}:${s.marque_code}`)).toBe(true)
  })
})

describe('grouperSkusParMarque', () => {
  it('groupe par famille:marque et trie par ordre puis grammage', () => {
    const groupes = grouperSkusParMarque(SKUS_CONCURRENTS_DEFAUT)
    expect(groupes['imp:nido'].map(s => s.grammage_g)).toEqual([15, 350, 400, 800, 2500])
    expect(groupes['evap:cowmilk']).toHaveLength(1)
  })
})

describe('statutMarqueDerive', () => {
  it('passe la marque à Présent dès qu’un SKU est Présent', () => {
    expect(statutMarqueDerive({ nido_400g: 'Présent', nido_15g: 'En rupture' }, ['nido_15g', 'nido_400g'], 'En rupture')).toBe('Présent')
  })

  it('conserve le statut marque saisi quand aucun SKU n’est Présent', () => {
    expect(statutMarqueDerive({ nido_400g: 'En rupture' }, ['nido_400g'], 'Présent')).toBe('Présent')
    expect(statutMarqueDerive({}, ['nido_400g'], 'En rupture')).toBe('En rupture')
    expect(statutMarqueDerive(undefined, ['nido_400g'], undefined)).toBe('En rupture')
  })
})

describe('cleVisibiliteMarque / marquesPourVisibilite', () => {
  it('retire le grammage terminal pour retrouver les clés historiques', () => {
    expect(cleVisibiliteMarque('NIDO 150g')).toBe('nido')
    expect(cleVisibiliteMarque('Nido')).toBe('nido')
    expect(cleVisibiliteMarque('Top Lait')).toBe('toplait')
  })

  it('dédoublonne les marques présentes dans plusieurs familles', () => {
    const marques = marquesPourVisibilite([
      { famille: 'evap', code: 'nido_150g', nom: 'NIDO 150g' },
      { famille: 'imp', code: 'nido', nom: 'Nido' },
      { famille: 'imp', code: 'laity', nom: 'Laity' },
      { famille: 'evap', code: 'laity', nom: 'Laity' },
    ])
    expect(marques.map(m => m.cle)).toEqual(['nido', 'laity'])
    expect(marques[0].nom).toBe('NIDO')
  })
})

describe('visibiliteConcurrencePresente', () => {
  it('lit le nouveau format imbriqué', () => {
    const conc = { presence_visibilite: true, exterieure: { nido: true }, interieure: {} }
    expect(visibiliteConcurrencePresente(conc, 'exterieure', 'nido')).toBe(true)
    expect(visibiliteConcurrencePresente(conc, 'interieure', 'nido')).toBe(false)
  })

  it('lit les clés plates des visites d’avant septembre 2026', () => {
    const conc = { presence_visibilite: true, nido_exterieur: true, laity_interieur: true }
    expect(visibiliteConcurrencePresente(conc, 'exterieure', 'nido')).toBe(true)
    expect(visibiliteConcurrencePresente(conc, 'interieure', 'laity')).toBe(true)
    expect(visibiliteConcurrencePresente(conc, 'interieure', 'nido')).toBe(false)
  })

  it('renvoie false sans bloc concurrence', () => {
    expect(visibiliteConcurrencePresente(undefined, 'exterieure', 'nido')).toBe(false)
  })
})
