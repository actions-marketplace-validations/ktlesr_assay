import { proportion, type CollisionMatrix } from '@ktlsr/assay-core'
import { describe, expect, it } from 'vitest'
import { collisionView } from './collision-view'

// Birim testi girdisi (sözleşme 3'ün istisnası): gerçek kayıttaki biçim —
// ortak önek, host'la gelen öneksiz `run`, tartışmalı bir satır, `none` satırı.
const matrix: CollisionMatrix = {
  columns: ['none', 'p:copy', 'p:edit', 'run'],
  rows: [
    {
      expected: ['p:copy'],
      cases: 2,
      cells: { 'p:copy': 7, 'p:edit': 2, none: 1 },
      alsoFired: 1,
      won: proportion(7, 10),
      unmeasured: 0,
    },
    {
      expected: ['p:copy', 'p:edit'],
      cases: 1,
      cells: { 'p:copy': 4, 'p:edit': 5, run: 1 },
      alsoFired: 0,
      won: proportion(9, 10),
      unmeasured: 0,
    },
    {
      expected: [],
      cases: 1,
      cells: { none: 9, run: 1 },
      alsoFired: 0,
      won: proportion(9, 10),
      unmeasured: 2,
    },
  ],
  unmeasured: 2,
}

describe('collisionView', () => {
  const view = collisionView(matrix)

  it('ortak öneki bir kez söyler, önek dışındaki adı ayrıca adlandırır', () => {
    expect(view.prefix).toBe('p:')
    expect(view.outside).toEqual(['run'])
    expect(view.columns.map((c) => c.label)).toEqual(['none', 'copy', 'edit', 'run'])
    expect(view.rows.map((r) => r.label)).toEqual(['copy', 'copy / edit', 'none'])
  })

  it('hücreyi anlattığıyla sınıflar: beklenen ilk tetiklendi, başkası, hiç', () => {
    const kinds = (index: number) => view.rows[index]?.cells.map((c) => c.kind)
    expect(kinds(0)).toEqual(['miss', 'hit', 'miss', 'zero'])
    // Tartışmalı vaka: iki skill'den biri kazanırsa isabet.
    expect(kinds(1)).toEqual(['zero', 'hit', 'hit', 'miss'])
    // `winner: none`: isabet "none" sütunu.
    expect(kinds(2)).toEqual(['hit', 'zero', 'zero', 'miss'])
  })

  it('kazanma oranını N ve aralıkla taşır, ölçülemeyeni ayrı sayar', () => {
    expect(view.rows[0]?.won.n).toBe(10)
    expect(view.rows[0]?.won.ci).not.toBeNull()
    expect(view.rows[2]?.unmeasured).toBe(2)
    expect(view.unmeasured).toBe(2)
  })
})
