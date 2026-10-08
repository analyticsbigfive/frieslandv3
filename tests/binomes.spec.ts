import { describe, it, expect } from 'vitest'
// @ts-ignore module JS sans types
import { deriverSsf, lireCsvClientSsf } from '../scripts/lib/imports/ssf-sous-zones.mjs'
// @ts-ignore module JS sans types
import { simulerRoutingSsf } from '../scripts/lib/imports/routing-ssf-dms.mjs'
// @ts-ignore module JS sans types
import { validerOperation, OPERATIONS_PAR_IMPORT } from '../scripts/lib/imports/operations.mjs'

// Binômes SSF ↔ merchandiser (réunion client du 08/10/2026) : le fichier de
// l'agence fait foi ; aucun lien hiérarchique entre SSF et merchandiser.
const M1 = '11111111-1111-1111-1111-111111111111'
const M2 = '22222222-2222-2222-2222-222222222222'
const M3 = '33333333-3333-3333-3333-333333333333'
const C1 = 'cccccccc-0000-0000-0000-000000000001'

const pdvs = [
  { pdv_id: 'A1', zone: 'ADJAME', quartier: '220 LGTs', sous_categorie_pdv: 'Boutique C', is_active: true },
  { pdv_id: 'A2', zone: 'ADJAME', quartier: 'BRACODI', sous_categorie_pdv: 'Boutique C', is_active: true },
  { pdv_id: 'A3', zone: 'ADJAME', quartier: 'PAILLET', sous_categorie_pdv: 'Superette', is_active: true },
]
const donnees = () => ({
  visites: [],
  pdvs,
  profils: [
    { id: M1, email: 'm1@x.ci', nom: 'Merch Un', role: 'merchandiser', employeur: 'atom', is_active: true, territoires_assignes: ['ADJAME'], quartiers_assignes: [], commercial_id: C1 },
    { id: M2, email: 'm2@x.ci', nom: 'Merch Deux', role: 'merchandiser', employeur: 'atom', is_active: true, territoires_assignes: ['ADJAME'], quartiers_assignes: [], commercial_id: C1 },
    { id: M3, email: 'm3@x.ci', nom: 'Merch Absent', role: 'merchandiser', employeur: 'atom', is_active: true, territoires_assignes: ['ADJAME'], quartiers_assignes: [], commercial_id: null },
  ],
  ssfs: [{ id: 1, nom: 'Kone Moussa', distributeur_id: 1, actif: true, commercial_id: null }],
  distributeurs: [{ id: 1, nom: 'NDA' }],
  ssfQuartiers: [],
  quotas: [],
  regles: [],
  reglesPdv: [],
  binomes: [{ merchandiser_id: M1, ssf_id: 1, jour_semaine: 5, zone: 'ADJAME', quartiers: ['PAILLET'], source: 'regle-existante', actif: true }],
  binomesDisponibles: true,
})

const CSV = [
  'SSF;Merchandiser;Jours;Zone;Quartiers;Distributeur',
  'Kone Moussa;m1@x.ci;Lundi, Mardi;ADJAME;"220 LGTs, BRACODI";NDA',
  'Yao Paul;Merch Deux;Mercredi;ADJAME;PAILLET;NDA',
  'Kone Moussa;Inconnu;Jeudi;ADJAME;PAILLET;NDA',
].join('\r\n')

describe('lecture du fichier de l’agence (CSV)', () => {
  const lignes = lireCsvClientSsf(CSV, 'agence.csv')
  it('détecte le séparateur « ; », les guillemets et les jours', () => {
    expect(lignes).toHaveLength(3)
    expect(lignes[0]).toMatchObject({ ssf: 'Kone Moussa', merch: 'm1@x.ci', zone: 'ADJAME', quartiers: ['220 LGTs', 'BRACODI'], jours: [1, 2] })
    expect(lignes[1].jours).toEqual([3])
  })
  it('refuse un fichier sans colonne SSF', () => {
    expect(() => lireCsvClientSsf('Nom,Ville\nA,B', 'x.csv')).toThrow(/SSF/)
  })
})

describe('binômes depuis le fichier de l’agence', () => {
  const res = deriverSsf(donnees(), { lignesClient: lireCsvClientSsf(CSV, 'agence.csv'), fichierClient: 'agence.csv', deriverHistorique: false, debut: '2026-10-12' })
  const ops = res.operations as any[]

  it('un binôme par jour × SSF, avec les quartiers de la ligne', () => {
    const b1 = ops.find(o => o.type === 'binomes.remplacer' && o.user_id === M1)
    expect(b1.lignes.map((l: any) => [l.jour_semaine, l.ssf.nom, l.zone, l.quartiers])).toEqual([
      [1, 'Kone Moussa', 'ADJAME', ['220 LGTs', 'BRACODI']],
      [2, 'Kone Moussa', 'ADJAME', ['220 LGTs', 'BRACODI']],
    ])
    expect(b1.source).toBe('client-agence.csv')
  })

  it('SSF inconnu créé, binôme rattaché par son nom', () => {
    expect(ops.some(o => o.type === 'ssf.creer' && o.nom === 'Yao Paul')).toBe(true)
    const b2 = ops.find(o => o.type === 'binomes.remplacer' && o.user_id === M2)
    expect(b2.lignes).toEqual([{ ssf: { nom: 'Yao Paul' }, jour_semaine: 3, zone: 'ADJAME', quartiers: ['PAILLET'] }])
  })

  it('le merchandiser absent du fichier ne change pas', () => {
    expect(ops.some(o => o.user_id === M3)).toBe(false)
  })

  it('ligne au merchandiser inconnu rejetée et signalée', () => {
    expect(res.resume.rejetsClient).toBe(1)
    expect(res.rapport).toMatch(/Inconnu/)
  })

  it('le SSF reçoit le commercial unique de ses merchandisers', () => {
    expect(ops.filter(o => o.type === 'ssf.commercial').map(o => [o.ssf.nom, o.commercial_id])).toEqual([
      ['Kone Moussa', C1], ['Yao Paul', C1],
    ])
  })

  it('retour arrière : les binômes d’avant', () => {
    const r1 = (res.retour as any[]).find(o => o.type === 'binomes.remplacer' && o.user_id === M1)
    expect(r1.lignes).toEqual([{ ssf: { id: 1, nom: 'Kone Moussa' }, jour_semaine: 5, zone: 'ADJAME', quartiers: ['PAILLET'], source: 'regle-existante' }])
  })

  it('toutes les opérations sont valides pour l’import', () => {
    for (const op of [...ops, ...res.retour]) expect(() => validerOperation(op, OPERATIONS_PAR_IMPORT['ssf-sous-zones'])).not.toThrow()
  })

  it('sans la migration des binômes : application bloquée', () => {
    const r = deriverSsf({ ...donnees(), binomesDisponibles: false }, { lignesClient: lireCsvClientSsf(CSV, 'a.csv'), deriverHistorique: false })
    expect(r.bloquants.length).toBe(1)
  })
})

describe('validation des opérations', () => {
  it('binomes.remplacer : jour hors bornes refusé', () => {
    expect(() => validerOperation({ type: 'binomes.remplacer', user_id: M1, lignes: [{ ssf: { id: 1 }, jour_semaine: 9, quartiers: [] }] })).toThrow(/jour/)
  })
  it('ssf_pdv.remplacer : source « dms- » exigée', () => {
    expect(() => validerOperation({ type: 'ssf_pdv.remplacer', ssf: { id: 1 }, source: 'autre', pdv_ids: [] })).toThrow(/dms/)
    expect(() => validerOperation({ type: 'ssf_pdv.remplacer', ssf: { id: 1 }, source: 'dms-x.xlsx', pdv_ids: ['A1'] })).not.toThrow()
  })
  it('l’import du routing SSF n’écrit rien d’autre', () => {
    expect(() => validerOperation({ type: 'binomes.remplacer', user_id: M1, lignes: [] }, OPERATIONS_PAR_IMPORT['routing-ssf-dms'])).toThrow(/refusé/)
  })
})

// Classeur ExcelJS minimal (lireDmsClasseur lit worksheets[0]).
function classeur(entetes: string[], lignes: string[][]) {
  const rangee = (vals: string[]) => ({
    eachCell: (_o: any, f: (c: any, i: number) => void) => vals.forEach((v, i) => f({ value: v }, i + 1)),
    getCell: (i: number) => ({ value: vals[i - 1] ?? '' }),
  })
  const toutes = [entetes, ...lignes]
  return { worksheets: [{ getRow: (n: number) => rangee(toutes[n - 1]), eachRow: (f: (r: any, n: number) => void) => toutes.forEach((v, i) => f(rangee(v), i + 1)) }] }
}

describe('routing des SSF depuis l’export DMS', () => {
  const E = ['distributor_region', 'distributor_code', 'distributor_name', 'salesman_code', 'salesman_name', 'customer_code', 'customer_name', 'address1', 'address2', 'address3', 'latitude', 'longitude', 'contact_person', 'local_sub_channel_name']
  const ligne = (vendeur: string, client: string) => ['SOUTH', 'D1', 'NDA', 'S1', vendeur, client, `Client ${client}`, '', '', '', '5.3', '-4.0', '', 'BOUTIQUE']
  const wb = classeur(E, [ligne('KONE MOUSSA', 'C100'), ligne('KONE MOUSSA', 'C101'), ligne('NOUVEAU VENDEUR', 'C102'), ligne('KONE MOUSSA', 'C999')])
  const d = {
    pdvs: [{ pdv_id: 'A1', mdm: 'C100' }, { pdv_id: 'A2', mdm: 'C101' }, { pdv_id: 'A3', mdm: 'C102' }],
    ssfs: [{ id: 1, nom: 'Kone Moussa', nom_brut: null, distributeur_id: 1, actif: true }],
    distributeurs: [{ id: 1, nom: 'NDA' }],
    aliasImport: [],
    existants: [{ ssf_id: 1, pdv_id: 'A1', jour_semaine: 0, source: 'dms-ancien.xlsx' }],
    migrationAppliquee: true,
  }
  const res = simulerRoutingSsf(wb, d, { nomFichier: 'dms.xlsx' })
  const ops = res.operations as any[]

  it('vendeur reconnu (ordre des mots indifférent) : ses PDV reliés', () => {
    const op = ops.find(o => o.type === 'ssf_pdv.remplacer' && o.ssf.id === 1)
    expect(op.pdv_ids).toEqual(['A1', 'A2'])
    expect(op.jour_semaine).toBe(0)
  })
  it('vendeur inconnu : SSF créé avec son distributeur', () => {
    expect(ops.find(o => o.type === 'ssf.creer')).toMatchObject({ nom: 'NOUVEAU VENDEUR', distributeur: 'NDA' })
  })
  it('client sans PDV relié compté', () => {
    expect(res.resume.clientsSansPdv).toBe(1)
  })
  it('retour arrière : routing d’avant', () => {
    expect((res.retour as any[]).find(o => o.ssf.id === 1).pdv_ids).toEqual(['A1'])
  })
  it('opérations valides', () => {
    for (const op of [...ops, ...res.retour]) expect(() => validerOperation(op, OPERATIONS_PAR_IMPORT['routing-ssf-dms'])).not.toThrow()
  })
})
