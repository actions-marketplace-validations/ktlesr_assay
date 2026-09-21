import type { CollisionMatrix } from '@ktlsr/assay-core'
import { RateFigure, formatBounds } from '@ktlsr/assay-ui'
import { collisionView } from '../../lib/collision-view'

/**
 * Çakışma matrisi — beklenen kazanan × ilk tetiklenen (0.4.1-1).
 *
 * Birden çok skill'in birlikte kurulu olduğu bir suite'te asıl cevap bu:
 * her vakada model önce hangi skill'e uzandı. Suite'in tek hedefi olduğu için
 * altındaki precision/recall yalnızca o hedefi anlatıyor; matris üstte duruyor.
 * Terminal ve HTML raporuyla aynı tablo, aynı önek kuralı (core).
 *
 * Geniş: bir satır on dört sütuna varabiliyor. Tablo kendi kabında yatay
 * kayıyor, sayfa kaymıyor; beklenen skill sütunu yapışkan.
 */
export function CollisionMatrixSection({ matrix }: { matrix: CollisionMatrix }) {
  const view = collisionView(matrix)
  return (
    <section className="mb-12">
      <p className="rule-label mb-2">Collision matrix</p>
      <p className="mb-6 max-w-[62ch] text-sm text-text-muted">
        Rows are the skill each case expects to win, columns the skill that fired first.
        Winning means firing first; a skill that fired later is counted under “also
        fired”.
        {view.prefix === '' ? null : (
          <>
            {' '}
            Names are shown without their common prefix{' '}
            <code className="code">{view.prefix}</code>
            {view.outside.length === 0 ? null : (
              <>
                ; not under it: <code className="code">{view.outside.join(', ')}</code>
              </>
            )}
            .
          </>
        )}
        {view.unmeasured === 0
          ? null
          : ` ${view.unmeasured} attempt(s) could not be measured and are not in the matrix.`}
      </p>
      <div className="collision-scroll">
        <table className="collision">
          <thead>
            <tr>
              <th scope="col" className="collision-corner">
                expected · fired first
              </th>
              {/* Önce cevap, sonra dağılım: dar ekranda kaydırmadan görülsün. */}
              <th scope="col">won</th>
              {view.columns.map((column) => (
                <th key={column.key} scope="col">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">
                  {row.label}
                  <span className="collision-cases">
                    {row.cases} {row.cases === 1 ? 'case' : 'cases'}
                  </span>
                </th>
                {/* Oran N ve aralığıyla (değişmez #4), iki kırılmaz satırda. */}
                <td className="collision-won">
                  <span className="collision-rate">
                    <RateFigure value={row.won} />{' '}
                    <span className="collision-count">
                      {row.won.successes}/{row.won.n}
                    </span>
                  </span>
                  {formatBounds(row.won) === null ? null : (
                    <span className="collision-ci">95% CI {formatBounds(row.won)}</span>
                  )}
                  {row.alsoFired > 0 || row.unmeasured > 0 ? (
                    <span className="collision-note">
                      {[
                        ...(row.alsoFired > 0 ? [`${row.alsoFired} also fired`] : []),
                        ...(row.unmeasured > 0 ? [`${row.unmeasured} unmeasured`] : []),
                      ].join(', ')}
                    </span>
                  ) : null}
                </td>
                {row.cells.map((cell) => (
                  <td key={cell.column} className={`collision-cell ${cell.kind}`}>
                    {cell.count === 0 ? '·' : cell.count}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
