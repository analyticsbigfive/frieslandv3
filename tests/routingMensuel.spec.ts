import { describe, it, expect } from 'vitest'
// @ts-ignore module JS sans types
import {
  approcherLieu, departagerHomonymes, indexerPdv, lireRoutingMensuel, lireRoutingMensuelCsv, lireSemaines, reglesDuRouting, simulerRoutingMensuel, territoireDe,
} from '../scripts/lib/imports/routing-mensuel.mjs'
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

// Fichier du 09/10 avec les colonnes « Commune » et « Quartier » : le lieu se
// cherche dans la commune et le portefeuille, jamais ailleurs (« Kennedy 2 »
// d'Abobo était parti à Daloa).
describe('rattachement par commune', () => {
  const ENTETE_C = ['Zone', 'Commune', 'Quartier', 'Merchandiser', 'Distributeur', 'Sales rep', 'Jour', 'Occurrence', 'Point de visite', 'SSF', 'Type SSF']
  const LIGNES_C = [
    L('Abobo - Anyama', 'Abobo', 'Kennedy 2', 'Tano Venance', 'Niare & Frères', 'M. Rachid', 'Samedi', '2', 'Kennedy 2', 'Yapi Athanase', 'Mini van'),
    L('Abobo - Anyama', 'Anyama', 'Anyama', 'Tano Venance', 'Niare & Frères', 'M. Rachid', 'Vendredi', '2', 'Anyama', 'Aucun SSF', '-'),
    L('Abobo - Anyama', 'Abobo', 'Samaké 2', 'Tano Venance', 'Niare & Frères', 'M. Rachid', 'Lundi', '1', 'Samaké 2', 'Aucun SSF', '-'),
    L('Abobo - Anyama', 'Abobo', 'Samaké et BC', 'Tano Venance', 'Niare & Frères', 'M. Rachid', 'Lundi', '2', 'Samaké et BC', 'Aucun SSF', '-'),
    L('Abobo - Anyama', 'Abobo', 'Château', 'Tano Venance', 'Niare & Frères', 'M. Rachid', 'Samedi', '3', 'Château', 'Aucun SSF', '-'),
    L('Cocody', 'Cocody', 'Anono', 'Bamba Bernadin', 'PRODISMA', 'Mme Tea', 'Mardi', '1', 'Anono', 'Aucun SSF', '-'),
  ]
  const feuillesC = [{ nom: 'Routing', lignes: [ENTETE_C, ...LIGNES_C].map((v, i) => ({ n: i + 1, cellules: ['', ...v] })) }]
  const pdvsC = [
    pdv('P3', 'ABOBO 1', 'SAMAKE'), pdv('P6', 'ABOBO 1', 'BC'), pdv('P7', 'ABOBO 2', 'ANYAMA'), pdv('P8', 'ABOBO 1', 'PLATEAU DOKOUI'),
    pdv('D1', 'DALOA', 'Kennedy 2'), pdv('D2', 'DALOA', 'Kennedy 2'), pdv('Z1', 'ADZOPE', 'CHÂTEAU'),
    ...[1, 2, 3, 4, 5].map(n => pdv(`N${n}`, 'COCODY 2', `ANONO ${n}`)), pdv('P5', 'COCODY 2', 'RIVIERA'),
  ]
  const portefeuille = [{ template_id: T_DMS, pdv_id: 'P3', position_order: 1 }, { template_id: T_DMS, pdv_id: 'P6', position_order: 2 }, { template_id: T_DMS, pdv_id: 'P8', position_order: 3 }]
  const d = donnees({ pdvs: pdvsC, reglesPdv: [{ template_id: T_SSF, pdv_id: 'P3', position_order: 1 }, ...portefeuille], aliasImport: donnees().aliasImport.filter((a: any) => a.type !== 'quartier') })
  const lignesC = lireRoutingMensuel(feuillesC)
  const res = simulerRoutingMensuel(lignesC, d, { fichier: 'routing-communes.csv', debut: '2026-10-12' })
  const ops = res.operations as any[]
  const casesDe = (userId: string) => ops.find(o => o.type === 'routing_mensuel.remplacer' && o.user_id === userId).lignes
  const caseDe = (userId: string, j: number, s: number) => casesDe(userId).find((l: any) => l.jour_semaine === j && l.semaine_du_mois === s)
  const reglesDe = (userId: string) => ops.find(o => o.type === 'regles_mensuelles.remplacer' && o.user_id === userId).regles

  it('lit Commune et Quartier ; le point de visite reste le libellé', () => {
    expect(lignesC[0]).toMatchObject({ secteur: 'Abobo - Anyama', commune: 'Abobo', lieu: 'Kennedy 2', point: 'Kennedy 2' })
  })

  it('territoire : zones de la commune, ou quartier quand la commune n’est pas une zone', () => {
    const index = indexerPdv(pdvsC)
    expect([...territoireDe('Abobo', 'Abobo - Anyama', index).zones].sort()).toEqual(['ABOBO 1', 'ABOBO 2'])
    const anyama = territoireDe('Anyama', 'Abobo - Anyama', index)
    expect(anyama.quartiers.map((q: any) => q.quartier)).toEqual(['ANYAMA'])
    expect([...anyama.zones]).toEqual(['ABOBO 2'])
  })

  it('« Kennedy 2 » d’Abobo n’est jamais rattaché à Daloa : portefeuille dans la commune', () => {
    const c = caseDe(M2, 6, 2)
    expect(c).toMatchObject({ commune: 'Abobo', lieux: [], quartiers: [], zone: null })
    const regle = reglesDe(M2).find((r: any) => r.days_of_week[0] === 6 && r.semaines_du_mois.includes(2))
    expect(regle.pdv_ids.sort()).toEqual(['P3', 'P6', 'P8'])
    expect(regle.label).toBe('Routing mensuel — Samedi S2 — Kennedy 2')
    expect(JSON.stringify(ops)).not.toMatch(/DALOA|ADZOPE/)
  })

  it('« Château » (seulement à Adzopé) : la commune d’Abobo', () => {
    expect(caseDe(M2, 6, 3)).toMatchObject({ lieux: [], commune: 'Abobo' })
    expect(res.rapport).toMatch(/\| Abobo - Anyama \| Abobo \| Château \| commune \(portefeuille\)/)
  })

  it('commune qui est un quartier : Anyama → ABOBO 2 › ANYAMA', () => {
    expect(caseDe(M2, 5, 2).lieux).toEqual(['ABOBO 2›ANYAMA'])
  })

  it('approché dans la commune : numéro retiré, « X et Y » découpé, signalé', () => {
    expect(caseDe(M2, 1, 1).lieux).toEqual(['ABOBO 1›SAMAKE'])
    expect(caseDe(M2, 1, 2).lieux.sort()).toEqual(['ABOBO 1›BC', 'ABOBO 1›SAMAKE'])
    expect(res.resume.lieuxApproches).toBe(2)
    expect(res.rapport).toMatch(/Lieux approchés dans la commune/)
    expect(res.csv['lieux-approches.csv']).toMatch(/Samaké 2/)
  })

  it('plus de 4 quartiers approchés : rien n’est tranché (commune)', () => {
    const index = indexerPdv(pdvsC)
    expect(approcherLieu('Anono', new Set(['COCODY 2']), index)).toHaveLength(5)
    expect(caseDe(M3, 2, 1)).toMatchObject({ lieux: [], commune: 'Cocody' })
    expect(res.rapport).toMatch(/5 quartiers approchés, trop pour trancher/)
  })

  it('les règles se refont à l’identique depuis les cases (correction dans l’admin)', () => {
    const index = indexerPdv(pdvsC)
    const ctx = { index, portefeuille: ['P3', 'P6', 'P8'], territoires: ['ABOBO 1'], zonesPortefeuille: ['ABOBO 1'], debut: '2026-10-12', origine: 'routing-communes.csv' }
    const refaites = reglesDuRouting(casesDe(M2), ctx)
    const resume = (rs: any[]) => rs.map(r => [r.label, r.days_of_week, r.semaines_du_mois, [...r.pdv_ids].sort()])
    expect(resume(refaites)).toEqual(resume(reglesDe(M2)))
  })

  it('opérations valides avec commune et lieux', () => {
    for (const op of [...ops, ...res.retour]) expect(() => validerOperation(op, OPERATIONS_PAR_IMPORT['routing-mensuel'])).not.toThrow()
    const op = { type: 'routing_mensuel.remplacer', user_id: M2, source: 'x', lignes: [{ jour_semaine: 1, semaine_du_mois: 1, lieux: ['SANS SEPARATEUR'] }] }
    expect(() => validerOperation(op, OPERATIONS_PAR_IMPORT['routing-mensuel'])).toThrow(/lieux/)
  })

  it('SSF à créer sans distributeur reconnu : application bloquée', () => {
    const f = [{ nom: 'R', lignes: [ENTETE_C, L('Abobo', 'Abobo', 'Samaké', 'Tano Venance', 'Distrib Fantôme', 'M. Rachid', 'Lundi', '1', 'Samaké', 'Vendeur Sans Maison', 'Moto')].map((v, i) => ({ n: i + 1, cellules: ['', ...v] })) }]
    expect(simulerRoutingMensuel(lireRoutingMensuel(f), d).bloquants.join(' ')).toMatch(/Vendeur Sans Maison.*distributeur introuvable/)
  })
})

// Point GPS par case (09/10) : la tournée prend les PDV du portefeuille du
// merchandiser dans le rayon, quel que soit le quartier écrit.
describe('point GPS et rayon', () => {
  const ENTETE_P = ['Zone', 'Commune', 'Merchandiser', 'Distributeur', 'Sales rep', 'Jour', 'Occurrence', 'Point de visite', 'SSF', 'Type SSF', 'Latitude', 'Longitude', 'Rayon']
  const pdvG = (id: string, zone: string, quartier: string, lat: number, lng: number) => ({ pdv_id: id, zone, quartier, is_active: true, geolocation_lat: lat, geolocation_lng: lng })
  // Point Kennedy 2 (Abobo) : 5.4195, -4.0084. 0,001° ≈ 111 m.
  const pdvsP = [
    pdvG('K1', 'ABOBO 1', 'SAMAKE', 5.4196, -4.0084), // portefeuille, ~11 m
    pdvG('K2', 'ABOBO 1', 'ABOBO CENTRE', 5.4220, -4.0084), // portefeuille, ~280 m
    pdvG('K3', 'ABOBO 1', 'SAMAKE', 5.4260, -4.0084), // portefeuille, ~720 m : hors rayon 500 m
    pdvG('X1', 'ABOBO 1', 'SAMAKE', 5.4197, -4.0085), // pas dans le portefeuille
    pdvG('D1', 'DALOA', 'Kennedy 2', 6.8800, -6.4500),
  ]
  const L_ = (...v: string[]) => v
  const lignesP = [
    L_('Abobo - Anyama', 'Abobo', 'Tano Venance', 'Niare & Frères', 'M. Rachid', 'Samedi', '2', 'Kennedy 2', 'Aucun SSF', '-', '5,4195', '-4.0084', ''),
    L_('Abobo - Anyama', 'Abobo', 'Tano Venance', 'Niare & Frères', 'M. Rachid', 'Samedi', '3', 'Kennedy 2', 'Aucun SSF', '-', '5.4195', '-4.0084', '1000'),
    L_('Abobo - Anyama', 'Abobo', 'Tano Venance', 'Niare & Frères', 'M. Rachid', 'Lundi', '1', 'Désert', 'Aucun SSF', '-', '5.3000', '-3.9000', ''),
  ]
  const feuillesP = [{ nom: 'R', lignes: [ENTETE_P, ...lignesP].map((v, i) => ({ n: i + 1, cellules: ['', ...v] })) }]
  const dP = donnees({
    pdvs: pdvsP, aliasImport: [],
    reglesPdv: [{ template_id: T_SSF, pdv_id: 'P3', position_order: 1 }, ...['K1', 'K2', 'K3'].map((id, i) => ({ template_id: T_DMS, pdv_id: id, position_order: i + 1 }))],
  })
  const lus = lireRoutingMensuel(feuillesP)
  const res = simulerRoutingMensuel(lus, dP, { fichier: 'gps.csv', debut: '2026-10-12' })
  const ops = res.operations as any[]
  const cases = ops.find(o => o.type === 'routing_mensuel.remplacer' && o.user_id === M2).lignes
  const regles = ops.find(o => o.type === 'regles_mensuelles.remplacer' && o.user_id === M2).regles

  it('lit Latitude, Longitude (virgule décimale) et Rayon ; 500 m par défaut', () => {
    expect(lus[0]).toMatchObject({ latitude: 5.4195, longitude: -4.0084, rayon: 500 })
    expect(lus[1].rayon).toBe(1000)
    expect(cases.find((c: any) => c.jour_semaine === 6 && c.semaine_du_mois === 2)).toMatchObject({ latitude: 5.4195, longitude: -4.0084, rayon_m: 500 })
  })

  it('PDV du portefeuille dans le rayon seulement (ni hors portefeuille, ni hors rayon, jamais Daloa)', () => {
    const s2 = regles.find((r: any) => r.days_of_week[0] === 6 && r.semaines_du_mois.includes(2))
    expect([...s2.pdv_ids].sort()).toEqual(['K1', 'K2'])
    const s3 = regles.find((r: any) => r.days_of_week[0] === 6 && r.semaines_du_mois.includes(3))
    expect([...s3.pdv_ids].sort()).toEqual(['K1', 'K2', 'K3'])
    expect(JSON.stringify(regles)).not.toMatch(/D1|X1/)
    expect(res.resume.casesPoint).toBe(2)
  })

  it('point sans PDV du portefeuille dans le rayon : on retombe sur la commune, et c’est signalé', () => {
    const lundi = regles.find((r: any) => r.days_of_week[0] === 1)
    expect([...lundi.pdv_ids].sort()).toEqual(['K1', 'K2', 'K3'])
    expect(lundi.notes).toMatch(/portefeuille dans la commune/)
  })

  it('les règles se refont à l’identique depuis les cases (correction dans l’admin)', () => {
    const ctx = { index: indexerPdv(pdvsP), portefeuille: ['K1', 'K2', 'K3'], territoires: ['ABOBO 1'], zonesPortefeuille: ['ABOBO 1'], debut: '2026-10-12', origine: 'gps.csv' }
    const resume = (rs: any[]) => rs.map(r => [r.label, r.semaines_du_mois, [...r.pdv_ids].sort()])
    expect(resume(reglesDuRouting(cases, ctx))).toEqual(resume(regles))
  })

  it('validation : point et rayon contrôlés', () => {
    for (const op of [...ops, ...res.retour]) expect(() => validerOperation(op, OPERATIONS_PAR_IMPORT['routing-mensuel'])).not.toThrow()
    const op = (l: any) => ({ type: 'routing_mensuel.remplacer', user_id: M2, source: 'x', lignes: [{ jour_semaine: 1, semaine_du_mois: 1, ...l }] })
    expect(() => validerOperation(op({ latitude: 5.4, longitude: null }), OPERATIONS_PAR_IMPORT['routing-mensuel'])).toThrow(/point GPS/)
    expect(() => validerOperation(op({ latitude: 95, longitude: -4 }), OPERATIONS_PAR_IMPORT['routing-mensuel'])).toThrow(/point GPS/)
    expect(() => validerOperation(op({ latitude: 5.4, longitude: -4, rayon_m: 50 }), OPERATIONS_PAR_IMPORT['routing-mensuel'])).toThrow(/rayon/)
  })
})

describe('point GPS : PDV du distributeur de la ligne (décision du 10/10)', () => {
  const ENTETE_P = ['Zone', 'Commune', 'Merchandiser', 'Distributeur', 'Sales rep', 'Jour', 'Occurrence', 'Point de visite', 'SSF', 'Type SSF', 'Latitude', 'Longitude', 'Rayon']
  const NIARE = 'ETABLISSEMENT NIARE & FRERES'
  const pdvD = (id: string, lat: number, lng: number, distributor_name: string | null) =>
    ({ pdv_id: id, zone: 'ABOBO 1', quartier: 'SAMAKE', is_active: true, geolocation_lat: lat, geolocation_lng: lng, distributor_name })
  // Point A : 5.4195, -4.0084. Point B : 5.3000, -3.9000. 0,001° ≈ 111 m.
  const pdvsD = [
    pdvD('N1', 5.4196, -4.0084, NIARE), // ~11 m de A
    pdvD('N2', 5.4220, -4.0084, NIARE), // ~280 m de A
    pdvD('O1', 5.4196, -4.0085, 'PRODISMA'), // autre distributeur, ~16 m de A
    pdvD('K1', 5.4197, -4.0084, null), // portefeuille DMS, sans distributeur, ~22 m de A
    pdvD('N3', 5.3117, -3.9000, NIARE), // ~1 300 m de B, seul
  ]
  const L_ = (...v: string[]) => v
  const lignesD = [
    L_('Abobo - Anyama', 'Abobo', 'Tano Venance', 'Niare & Frères', 'M. Rachid', 'Samedi', '2', 'Kennedy 2', 'Aucun SSF', '-', '5.4195', '-4.0084', ''),
    L_('Abobo - Anyama', 'Abobo', 'Tano Venance', 'Niare & Frères', 'M. Rachid', 'Lundi', '1', 'Djibi village', 'Aucun SSF', '-', '5.3000', '-3.9000', ''),
    L_('Abobo - Anyama', 'Abobo', 'Tano Venance', '', 'M. Rachid', 'Mardi', '1', 'Kennedy', 'Aucun SSF', '-', '5.4195', '-4.0084', ''),
  ]
  const feuillesD = [{ nom: 'R', lignes: [ENTETE_P, ...lignesD].map((v, i) => ({ n: i + 1, cellules: ['', ...v] })) }]
  const dD = donnees({
    pdvs: pdvsD, aliasImport: [{ type: 'distributeur', motif: 'NIARE', mode: 'contient', cible: NIARE }],
    reglesPdv: [{ template_id: T_SSF, pdv_id: 'P3', position_order: 1 }, { template_id: T_DMS, pdv_id: 'K1', position_order: 1 }],
  })
  const res = simulerRoutingMensuel(lireRoutingMensuel(feuillesD), dD, { fichier: 'distributeur.csv', debut: '2026-10-12' })
  const regles = (res.operations as any[]).find(o => o.type === 'regles_mensuelles.remplacer' && o.user_id === M2).regles
  const regleDu = (jour: number) => regles.find((r: any) => r.days_of_week[0] === jour)

  it('prend les PDV du distributeur dans le rayon, ni ceux d’un autre distributeur, ni le portefeuille', () => {
    expect([...regleDu(6).pdv_ids].sort()).toEqual(['N1', 'N2'])
    expect(regleDu(6).notes).toMatch(/PDV de ETABLISSEMENT NIARE & FRERES à moins de 500 m/)
  })

  it('aucun PDV du distributeur à 500 m : rayon élargi jusqu’à 1 500 m, et c’est signalé', () => {
    expect(regleDu(1).pdv_ids).toEqual(['N3'])
    expect(regleDu(1).notes).toMatch(/1500 m .*rayon élargi/)
    expect(res.rapport).toMatch(/rayon élargi/)
    expect(res.rapport).toMatch(/Djibi village : 1 PDV de ETABLISSEMENT NIARE & FRERES à 1500 m/)
  })

  it('sans distributeur sur la ligne : le portefeuille dans le rayon, comme avant', () => {
    expect(regleDu(2).pdv_ids).toEqual(['K1'])
    expect(regleDu(2).notes).toMatch(/portefeuille à moins de 500 m/)
  })
})
