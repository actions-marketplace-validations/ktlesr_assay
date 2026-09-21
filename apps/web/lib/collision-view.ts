import {
  NO_SKILL,
  collisionPrefix,
  outsidePrefix,
  type CollisionMatrix,
  type Proportion,
} from '@ktlsr/assay-core'

/**
 * Çakışma matrisinin ekran modeli (0.4.1-1).
 *
 * Matrisin kendisi core'da (`collisionMatrix`); terminal ve HTML raporu aynı
 * tabloyu çiziyor. Burada yalnızca gösterim: ortak `plugin:` öneki başlıkta bir
 * kez söylenip hücrelerden atılıyor, önek altında olmayan adlar (host'la gelen
 * `run`) ayrıca adlandırılıyor, ve her hücre ne anlattığıyla sınıflanıyor:
 * beklenen skill ilk tetiklendiyse `hit`, başkası ilk tetiklendiyse `miss`,
 * hiç deneme yoksa `zero`. Renk yalnızca ölçüm taşıdığı için bu ayrım sayfada
 * rengin kendisi.
 */
export type CellKind = 'hit' | 'miss' | 'zero'

export interface CollisionView {
  prefix: string
  outside: string[]
  columns: ReadonlyArray<{ key: string; label: string }>
  rows: ReadonlyArray<{
    key: string
    label: string
    cases: number
    cells: ReadonlyArray<{ column: string; count: number; kind: CellKind }>
    won: Proportion
    alsoFired: number
    unmeasured: number
  }>
  unmeasured: number
}

export function collisionView(matrix: CollisionMatrix): CollisionView {
  const prefix = collisionPrefix(matrix)
  const short = (name: string) =>
    prefix !== '' && name.startsWith(prefix) ? name.slice(prefix.length) : name
  return {
    prefix,
    outside: outsidePrefix(matrix, prefix),
    columns: matrix.columns.map((key) => ({ key, label: short(key) })),
    rows: matrix.rows.map((row) => {
      const label =
        row.expected.length === 0 ? NO_SKILL : row.expected.map(short).join(' / ')
      return {
        key: label,
        label,
        cases: row.cases,
        cells: matrix.columns.map((column) => {
          const count = row.cells[column] ?? 0
          const expected =
            row.expected.length === 0
              ? column === NO_SKILL
              : row.expected.includes(column)
          const kind: CellKind = count === 0 ? 'zero' : expected ? 'hit' : 'miss'
          return { column, count, kind }
        }),
        won: row.won,
        alsoFired: row.alsoFired,
        unmeasured: row.unmeasured,
      }
    }),
    unmeasured: matrix.unmeasured,
  }
}
