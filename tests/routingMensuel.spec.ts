import { describe, it, expect } from 'vitest'
// @ts-ignore module JS sans types
import { departagerHomonymes, lireRoutingMensuel, lireRoutingMensuelCsv, lireSemaines, simulerRoutingMensuel } from '../scripts/lib/imports/routing-mensuel.mjs'
// @ts-ignore module JS sans types
import { feuillesDepuisCsv, motsProches, trouverPersonne } from '../scripts/lib/commun.mjs'
// @ts-ignore module JS sans types
import { validerOperation, OPERATIONS_PAR_IMPORT } from '../scripts/lib/imports/operations.mjs'

// Extrait anonymisé du fichier de l'agence (Routing_mensuel_merchandisers.xlsx,
// 08/10/2026) : mêmes colonnes, mêmes cas (orthographes, « Aucun SSF »,
// « Non nommé », lieux reconnus ou non).
const ENTETE = ['Zone', 'Merchandiser', 'Distributeur', 'Sales rep', 'Jour', 'Occurrence', 'Point de visite', 'SSF', 'Type SSF']
const L = (...v: string[]) => v
const FICHIER = [
  L('Yopougon 1 & 2', 'Kossa Kevin Stéphane', 'NDA', 'M. Kamy', 'Lundi', '1', 'Maroc', 'Aucun SSF', '-'),
  L('Yopougon 1 & 2', 'Kossa Kevin Stéphane', 'NDA', 'M. Kamy', 'Lundi', '2', 'Maroc', 'Aucun SSF', '-'),
  L('Yopougon 1 & 2', 'Kossa Kevin Stéphane', 'NDA', 'M. Kamy', 'Lundi', '3', 'Zone industrielle', 'Aucun SSF', '-'),
  L('Abobo', 'Tano Venance', 'Niare & Frères', 'M. Rachid', 'Mardi', '1', 'Samaké', 'Diaby Ismaël', 'Mini van'),
  L('Abobo', 'Tano Venance', 'Niare & Frères', 'M. Rachid', 'Mardi', '2', 'Samaké', 'Yapi Athanase', 'Mini van'),
  L('Abobo', 'Tano Venance', 'Niare & Frères', 'M. Rachid', 'Mardi', '3', 'Samaké', 'Yapi Athanase', 'Mini van'),
  L('Abobo', 'Tano Venance', 'Niare & Frères', 'M. Rachid', 'Mercredi', '1', 'Andokoi 1', 'Nouveau Vendeur', 'Moto'),
  L('Cocody', 'Bamba Bernadin', 'PRODISMA', 'Mme Tea', 'Vendredi', '1', 'Riviera', 'Non nommé', 'À préciser'),
  L('Marcory - Treichville', 'Inconnu Stéphane', 'Sidecom', 'Mme Orphelia', 'Lundi', '1', 'Arras', 'Aucun SSF', '-'),
]
const feuilles = [{ nom: 'Routing', lignes: [ENTETE, ...FICHIER].map((v, i) => ({ n: i + 1, cellules: ['', ...v] })) }]

const M1 = '11111111-1111-1111-1111-111111111111'
const M2 = '22222222-2222-2222-2222-222222222222'
const M3 = '33333333-3333-3333-3333-333333333333'
const C_SOUARE = 'cccccccc-0000-0000-0000-000000000001'
const C_KAMI = 'cccccccc-0000-0000-0000-000000000002'
const C_RACHID = 'cccccccc-0000-0000-0000-000000000003'
const C_OPH1 = 'cccccccc-0000-0000-0000-000000000004'
const C_OPH2 = 'cccccccc-0000-0000-0000-000000000005'
const T_DMS = 'aaaaaaaa-0000-0000-0000-000000000001'
const T_SSF = 'aaaaaaaa-0000-0000-0000-000000000002'

const pdv = (id: string, zone: string, quartier: string) => ({ pdv_id: id, zone, quartier, is_active: true, geolocation_lat: 5.3, geolocation_lng: -4 })
const donnees = (extra: any = {}) => ({
  profils: [
    { id: M1, email: 'yop@x.ci', nom: 'KOSSA KEVIN', role: 'merchandiser', employeur: 'atom', is_active: true, territoires_assignes: ['YOPOUGON 1'], quartiers_assignes: [], commercial_id: C_SOUARE },
    { id: M2, email: 'abo@x.ci', nom: 'TANO VENANCE', role: 'merchandiser', employeur: 'atom', is_active: true, territoires_assignes: ['ABOBO 1'], quartiers_assignes: [], commercial_id: C_RACHID },
    { id: M3, email: 'coc@x.ci', nom: 'BAMBA BERNADIN', role: 'merchandiser', employeur: 'atom', is_active: true, territoires_assignes: ['COCODY 2'], quartiers_assignes: [], commercial_id: null },
  ],
  commerciaux: [
    { id: C_SOUARE, nom: 'SOUARE IBRAHIMA', email: 's@x', role: 'commercial', is_active: true },
    { id: C_KAMI, nom: 'GAI KAMI', email: 'k@x', role: 'commercial', is_active: true },
    { id: C_RACHID, nom: 'RACHID ASSIROU', email: 'r@x', role: 'commercial', is_active: true },
    { id: C_OPH1, nom: "N'GUESSAN OPHELIA", email: 'o1@x', role: 'admin', is_active: true },
    { id: C_OPH2, nom: "N'GUESSAN OPHELIA", email: 'o2@x', role: 'commercial', is_active: true },
  ],
  distributeurs: [{ id: 1, nom: 'ETABLISSEMENT NIARE & FRERES' }, { id: 2, nom: 'NOUVEAUX DISTRIBUTEURS ASSOCIES' }, { id: 3, nom: 'PRODISMA' }],
  aliasImport: [
    { type: 'distributeur', motif: 'NIARE', mode: 'contient', cible: 'ETABLISSEMENT NIARE & FRERES' },
    { type: 'quartier', motif: 'ANDOKOI 1', mode: 'exact', cible: 'YOPOUGON 3›ANDOKOI' },
  ],
  ssfs: [
    { id: 10, nom: 'Assi Yapi Athanase', distributeur_id: 1, actif: true, commercial_id: null },
    { id: 11, nom: 'Diaby Ismaila', distributeur_id: 1, actif: true, commercial_id: null },
  ],
  pdvs: [pdv('P1', 'YOPOUGON 3', 'MAROC'), pdv('P2', 'YOPOUGON 4', 'MAROC'), pdv('P3', 'ABOBO 1', 'SAMAKE'), pdv('P4', 'YOPOUGON 3', 'ANDOKOI'), pdv('P5', 'COCODY 2', 'RIVIERA')],
  regles: [
    { id: T_DMS, user_id: M2, label: 'Portefeuille DMS — NIARE', mode: 'quota', days_of_week: [3, 4, 5, 6], is_active: true, ssf_id: null, repli: false },
    { id: T_SSF, user_id: M2, label: 'SSF — Diaby Ismaila', mode: 'quota', days_of_week: [1, 2], is_active: true, ssf_id: 11, territoire: 'ABOBO 1' },
  ],
  reglesPdv: [{ template_id: T_SSF, pdv_id: 'P3', position_order: 1 }],
  routingAvant: [],
  ssfQuartiers: [],
  migrationAppliquee: true,
  ...extra,
})

describe('lecture du routing mensuel', () => {
  const lignes = lireRoutingMensuel(feuilles)
  it('reconnaît les colonnes du fichier de l’agence', () => {
    expect(lignes).toHaveLength(9)
    expect(lignes[3]).toMatchObject({ merch: 'Tano Venance', salesRep: 'M. Rachid', jours: [2], semaines: [1], point: 'Samaké', ssf: 'Diaby Ismaël', typeSsf: 'Mini van' })
  })
  it('« Aucun SSF » et « Non nommé » : pas de SSF ; « Non nommé » signalé', () => {
    expect(lignes[0]).toMatchObject({ ssf: null, ssfTexte: null, typeSsf: null, ssfAPreciser: false })
    expect(lignes[7]).toMatchObject({ ssf: null, ssfTexte: 'Non nommé', ssfAPreciser: true })
  })
  it('semaines du mois', () => {
    expect(lireSemaines('2')).toEqual([2])
    expect(lireSemaines('1, 3')).toEqual([1, 3])
    expect(lireSemaines('')).toEqual([1, 2, 3, 4])
    expect(lireSemaines('Toutes')).toEqual([1, 2, 3, 4])
  })
  it('CSV au séparateur « ; » (Excel français)', () => {
    const csv = [ENTETE, FICHIER[3]].map(l => l.map(x => (x.includes(';') ? `"${x}"` : x)).join(';')).join('\r\n')
    expect(lireRoutingMensuelCsv(csv, 'r.csv')[0]).toMatchObject({ merch: 'Tano Venance', semaines: [1], point: 'Samaké' })
  })
  it('sans colonne Occurrence : les 4 semaines', () => {
    const f = feuillesDepuisCsv('Merchandiser;Jour;Point de visite;SSF\nTano Venance;Lundi;Samaké;Yapi Athanase', 'x.csv')
    expect(lireRoutingMensuel(f)[0].semaines).toEqual([1, 2, 3, 4])
  })
})

describe('rapprochement des noms', () => {
  it('orthographes du fichier', () => {
    const ssf = [{ nom: 'Assi Yapi Athanase' }, { nom: 'Atchori Augustin' }, { nom: 'Miss Lydie' }, { nom: 'Dali Romuald Gnakouri' }, { nom: 'Bakayoko Allassane' }]
    expect(trouverPersonne('Yapi Athanase', ssf).trouve.nom).toBe('Assi Yapi Athanase')
    expect(trouverPersonne('Atchory Augustin', ssf).trouve.nom).toBe('Atchori Augustin')
    expect(trouverPersonne('M. Dali', ssf).trouve.nom).toBe('Dali Romuald Gnakouri')
    expect(trouverPersonne('Bakayoko Alassane', ssf).trouve.nom).toBe('Bakayoko Allassane')
    expect(trouverPersonne('Inconnu Total', ssf).trouve).toBeNull()
  })
  it('une faute par mot, ou un mot qui commence l’autre', () => {
    expect(motsProches('ATCHORY', 'ATCHORI')).toBe(true)
    expect(motsProches('MURIELLE', 'MURIEL')).toBe(true)
    expect(motsProches('ISMAEL', 'ISMAILA')).toBe(false)
    expect(motsProches('ABO', 'ABA')).toBe(false)
  })
  it('homonymes : le commercial actuel, sinon le rôle commercial', () => {
    const a = { id: 'a', nom: "N'GUESSAN OPHELIA", role: 'admin' }
    const c = { id: 'c', nom: "N'GUESSAN OPHELIA", role: 'commercial' }
    expect(departagerHomonymes({ trouve: null, candidats: [a, c] }, 'a').trouve.id).toBe('a')
    expect(departagerHomonymes({ trouve: null, candidats: [a, c] }, null).trouve.id).toBe('c')
  })
})

describe('simulation du routing mensuel', () => {
  const res = simulerRoutingMensuel(lireRoutingMensuel(feuilles), donnees(), { fichier: 'routing.xlsx', debut: '2026-10-12' })
  const ops = res.operations as any[]
  const opsDe = (type: string, userId?: string) => ops.filter(o => o.type === type && (!userId || o.user_id === userId))

  it('merchandiser au nom différent reconnu ; inconnu laissé en attente', () => {
    expect(opsDe('routing_mensuel.remplacer').map(o => o.user_id).sort()).toEqual([M1, M2, M3].sort())
    expect(res.resume.merchandisersInconnus).toBe(1)
    expect(res.rapport).toMatch(/Inconnu Stéphane/)
  })

  it('une case par jour × semaine, SSF facultatif', () => {
    const rm = opsDe('routing_mensuel.remplacer', M1)[0]
    expect(rm.lignes.map((l: any) => [l.jour_semaine, l.semaine_du_mois, l.point_visite, l.ssf])).toEqual([
      [1, 1, 'Maroc', null], [1, 2, 'Maroc', null], [1, 3, 'Zone industrielle', null],
    ])
  })

  it('lieu identique reconnu dans toutes ses zones ; lieu inconnu laissé au portefeuille', () => {
    const rm = opsDe('routing_mensuel.remplacer', M1)[0]
    expect(rm.lignes[0].quartiers).toEqual(['MAROC'])
    expect(rm.lignes[2].quartiers).toEqual([])
    expect(res.resume.casesSansLieu).toBeGreaterThan(0)
  })

  it('lieu rattaché par un alias « quartier »', () => {
    const rm = opsDe('routing_mensuel.remplacer', M2)[0]
    expect(rm.lignes.find((l: any) => l.jour_semaine === 3)).toMatchObject({ zone: 'YOPOUGON 3', quartiers: ['ANDOKOI'] })
  })

  it('SSF : reconnu dans son distributeur, à relier si proche, à créer sinon', () => {
    const rm = opsDe('routing_mensuel.remplacer', M2)[0]
    expect(rm.lignes.find((l: any) => l.jour_semaine === 2 && l.semaine_du_mois === 2).ssf).toEqual({ id: 10, nom: 'Assi Yapi Athanase' })
    // « Diaby Ismaël » ≠ « Diaby Ismaila » (deux lettres) : à relier, case sans SSF.
    expect(rm.lignes.find((l: any) => l.jour_semaine === 2 && l.semaine_du_mois === 1).ssf).toBeNull()
    expect(res.resume.ssfARelier).toBe(1)
    expect(opsDe('ssf.creer').map(o => o.nom)).toEqual(['Nouveau Vendeur'])
  })

  it('règles : une par (jour, lieu, SSF), semaines explicites', () => {
    const regles = opsDe('regles_mensuelles.remplacer', M2)[0].regles
    const samake = regles.filter((r: any) => r.days_of_week[0] === 2)
    expect(samake.map((r: any) => [r.ssf?.nom ?? null, r.semaines_du_mois])).toEqual([[null, [1]], ['Assi Yapi Athanase', [2, 3]]])
    expect(samake[1].pdv_ids).toEqual(['P3'])
    expect(samake[1].label).toMatch(/^Routing mensuel — Mardi S2\+3 — Samaké/)
  })

  it('la règle de portefeuille passe en repli, tous les jours', () => {
    expect(opsDe('regle.jours')).toEqual([{ type: 'regle.jours', template_id: T_DMS, days_of_week: [1, 2, 3, 4, 5, 6], is_active: true, mode: 'quota', repli: true }])
  })

  it('commercial du fichier ≠ base : signalé, jamais modifié', () => {
    expect(res.rapport).toMatch(/KOSSA KEVIN : fichier M\. Kamy → GAI KAMI ; base : SOUARE IBRAHIMA/)
    expect(res.rapport).toMatch(/Mme Tea \(aucun compte reconnu\)/)
    expect(ops.some(o => o.type === 'profil.commercial')).toBe(false)
  })

  it('le SSF sans commercial reçoit celui de ses cases', () => {
    expect(opsDe('ssf.commercial').find(o => o.ssf.id === 10)?.commercial_id).toBe(C_RACHID)
  })

  it('retour arrière : anciennes règles SSF, ancienne règle de portefeuille', () => {
    const r = (res.retour as any[]).find(o => o.type === 'regles_mensuelles.remplacer' && o.user_id === M2)
    expect(r.regles).toEqual([expect.objectContaining({ label: 'SSF — Diaby Ismaila', ssf: { id: 11, nom: 'Diaby Ismaila' }, pdv_ids: ['P3'] })])
    expect((res.retour as any[]).find(o => o.type === 'regle.jours')).toMatchObject({ days_of_week: [3, 4, 5, 6], repli: false })
  })

  it('opérations valides, SSF créés avant le routing qui les nomme', () => {
    for (const op of [...ops, ...res.retour]) expect(() => validerOperation(op, OPERATIONS_PAR_IMPORT['routing-mensuel'])).not.toThrow()
    expect(ops.findIndex(o => o.type === 'ssf.creer')).toBeLessThan(ops.findIndex(o => o.type === 'routing_mensuel.remplacer'))
  })

  it('sans la migration : application bloquée', () => {
    expect(simulerRoutingMensuel(lireRoutingMensuel(feuilles), donnees({ migrationAppliquee: false })).bloquants).toHaveLength(1)
  })
})
