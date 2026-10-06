import { describe, it, expect } from 'vitest'
import { fetchAllRows } from '../utils/fetchAll'

// Simule PostgREST : `total` lignes, pages de 1 000 au plus.
function source(total: number) {
  return (from: number, to: number) => Promise.resolve({
    data: Array.from({ length: Math.max(0, Math.min(to, total - 1) - from + 1) }, (_, i) => from + i),
    error: null,
  })
}

describe('fetchAllRows', () => {
  it('lit toutes les lignes au-delà du plafond de 1 000', async () => {
    expect(await fetchAllRows(source(13_500))).toHaveLength(13_500)
  })

  it('signale une progression croissante qui finit sur le total', async () => {
    const progres: number[] = []
    const rows = await fetchAllRows(source(13_500), n => progres.push(n))
    expect(progres).toEqual([6_000, 12_000, 13_500])
    expect(progres.at(-1)).toBe(rows.length)
  })

  it('signale une seule fois un petit résultat', async () => {
    const progres: number[] = []
    await fetchAllRows(source(42), n => progres.push(n))
    expect(progres).toEqual([42])
  })

  it('propage une erreur de page', async () => {
    await expect(fetchAllRows(() => Promise.resolve({ data: null, error: new Error('boom') }))).rejects.toThrow('boom')
  })
})
