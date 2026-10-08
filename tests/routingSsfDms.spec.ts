import { describe, it, expect } from 'vitest'
// @ts-ignore module JS sans types
import { simulerRoutingSsf } from '../scripts/lib/imports/routing-ssf-dms.mjs'
// @ts-ignore module JS sans types
import { validerOperation, OPERATIONS_PAR_IMPORT } from '../scripts/lib/imports/operations.mjs'

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
  it('opérations valides, et rien d’autre que SSF et routing', () => {
    for (const op of [...ops, ...res.retour]) expect(() => validerOperation(op, OPERATIONS_PAR_IMPORT['routing-ssf-dms'])).not.toThrow()
    expect(() => validerOperation({ type: 'regle.jours', template_id: '11111111-1111-1111-1111-111111111111', days_of_week: [1], is_active: true }, OPERATIONS_PAR_IMPORT['routing-ssf-dms'])).toThrow(/refusé/)
  })
  it('ssf_pdv.remplacer : source « dms- » exigée', () => {
    expect(() => validerOperation({ type: 'ssf_pdv.remplacer', ssf: { id: 1 }, source: 'autre', pdv_ids: [] })).toThrow(/dms/)
  })
})
