import { describe, expect, it } from 'vitest'
import { cibleOperation, HorsAgence, IMPORTS_AGENCE, verifierPorteeAgence } from '../scripts/lib/imports/portee-agence.mjs'

// Client Supabase réduit : select / eq / in / order / limit sur des tables en mémoire.
function faux(tables: Record<string, any[]>) {
  return {
    from(table: string) {
      let lignes = [...(tables[table] || [])]
      const q: any = {
        select: () => q,
        eq: (col: string, v: any) => { lignes = lignes.filter(l => l[col] === v); return q },
        in: (col: string, vs: any[]) => { lignes = lignes.filter(l => vs.includes(l[col])); return q },
        order: () => q,
        limit: (n: number) => { lignes = lignes.slice(0, n); return q },
        then: (ok: any, ko: any) => Promise.resolve({ data: lignes, error: null }).then(ok, ko),
      }
      return q
    },
  }
}

const A1 = '00000000-0000-0000-0000-0000000000a1'
const F1 = '00000000-0000-0000-0000-0000000000f1'
const base = () => faux({
  profiles: [
    { id: A1, role: 'merchandiser', employeur: 'atom' },
    { id: F1, role: 'merchandiser', employeur: 'friesland' },
  ],
  routing_templates: [{ id: 'T-A1', user_id: A1 }, { id: 'T-F1', user_id: F1 }],
  ssf: [
    { id: 1, nom: 'SSF ATOM', commercial_id: null },
    { id: 2, nom: 'SSF FC', commercial_id: 'C1' },
    { id: 3, nom: 'SSF ATOM AVEC COMMERCIAL', commercial_id: 'C1' },
  ],
  routing_mensuel: [{ merchandiser_id: A1, ssf_id: 1 }, { merchandiser_id: F1, ssf_id: 2 }, { merchandiser_id: A1, ssf_id: 3 }],
})

describe('portée d’un compte agence', () => {
  it('n’ouvre que le routing mensuel', () => {
    expect(IMPORTS_AGENCE).toEqual(['routing-mensuel'])
    expect(cibleOperation({ type: 'pdv.creer' })).toBeNull()
    expect(cibleOperation({ type: 'regle_dms.remplacer' })).toBeNull()
  })

  it('accepte les opérations sur ses merchandisers, ses règles et ses SSF', async () => {
    const sb = base()
    for (const op of [
      { type: 'routing_mensuel.remplacer', user_id: A1 },
      { type: 'regles_mensuelles.remplacer', user_id: A1 },
      { type: 'profil.perimetre', user_id: A1 },
      { type: 'tournees.recalculer', user_id: A1 },
      { type: 'regle.jours', template_id: 'T-A1' },
      { type: 'ssf_quartier.remplacer', ssf: { nom: 'SSF ATOM' } },
      { type: 'ssf.commercial', ssf: { id: 1 }, commercial_id: 'C9' },
      { type: 'ssf.commercial', ssf: { id: 3 }, commercial_id: 'C1' },
      { type: 'ssf.creer', nom: 'Nouveau' },
    ]) await expect(verifierPorteeAgence(sb, op, 'atom')).resolves.toBeUndefined()
  })

  it('refuse tout ce qui sort de son agence', async () => {
    const sb = base()
    for (const op of [
      { type: 'routing_mensuel.remplacer', user_id: F1 },
      { type: 'tournees.recalculer', user_id: F1 },
      { type: 'regle.jours', template_id: 'T-F1' },
      { type: 'regle.jours', template_id: 'inconnue' },
      { type: 'ssf_quartier.remplacer', ssf: { id: 2 } },
      { type: 'ssf_quartier.remplacer', ssf: { nom: 'SSF INCONNU' } },
      { type: 'ssf.commercial', ssf: { id: 3 }, commercial_id: 'C9' },
      { type: 'pdv.creer', lignes: [] },
    ]) await expect(verifierPorteeAgence(sb, op, 'atom')).rejects.toBeInstanceOf(HorsAgence)
    await expect(verifierPorteeAgence(sb, { type: 'tournees.recalculer', user_id: A1 }, '')).rejects.toBeInstanceOf(HorsAgence)
  })
})
