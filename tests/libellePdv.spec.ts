import { describe, it, expect } from 'vitest'
import { estImport, libelleAuteur, libellePdv, origineAjout } from '../utils/libellePdv'

describe('libellePdv', () => {
  it('affiche le nom du PDV quand il est lisible', () => {
    expect(libellePdv({ pdv: { nom_pdv: 'Boutique Awa' }, pdv_id: 'AB12' })).toBe('Boutique Awa')
  })
  it('signale un PDV hors secteur au lieu du code seul', () => {
    expect(libellePdv({ pdv: null, pdv_id: 'AB12' })).toBe('PDV hors secteur · AB12')
  })
  it('tolère une ligne vide', () => {
    expect(libellePdv(undefined)).toBe('PDV hors secteur')
  })
})

describe('libelleAuteur / origineAjout', () => {
  it('rend lisibles les étiquettes d\'import avec leur date', () => {
    expect(libelleAuteur('import-dms-2026-09-29')).toBe('Import DMS du 29/09/2026')
    expect(libelleAuteur('import-pdv-atom-2026-10-20')).toBe('Import Atom du 20/10/2026')
    expect(libelleAuteur('import-atom-2026-10-06')).toBe('Import Atom du 06/10/2026')
    expect(libelleAuteur('import-liste-pdv-202610141514')).toBe('Import liste PDV du 14/10/2026')
  })
  it('garde le nom ou l\'e-mail du compte', () => {
    expect(libelleAuteur('GUI STEPHANE')).toBe('GUI STEPHANE')
    expect(origineAjout('GUI STEPHANE')).toBe('par GUI STEPHANE')
    expect(origineAjout('agent@exemple.ci')).toBe('par agent@exemple.ci')
    expect(origineAjout('import-dms-2026-09-29')).toBe('Import DMS du 29/09/2026')
  })
  it('vide quand l\'origine est inconnue', () => {
    expect(origineAjout(null)).toBe('')
    expect(origineAjout('  ')).toBe('')
    expect(estImport(undefined)).toBe(false)
  })
})
