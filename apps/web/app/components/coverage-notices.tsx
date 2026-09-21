import type { Run } from '@ktlsr/assay-core'
import { Callout } from '@ktlsr/assay-ui'
import { coverageNotices } from '../../lib/coverage'

/**
 * Kapsam uyarıları — verdict'in hemen altında, oranların ÜSTÜNDE (0.4.3-b).
 *
 * Aşağıdaki `%100 (N=3)` satırları hızlı modda da, yarım kayıtta da aynı
 * görünüyor; okuyucu neyin ölçülmediğini sayıları okumadan önce bilmeli.
 */
export function CoverageNotices({ run }: { run: Run }) {
  const notices = coverageNotices(run)
  if (notices.length === 0) return null
  return (
    <div className="mb-12 space-y-4">
      {notices.map((notice) => (
        <Callout key={notice.key} tone="warning" title={notice.title}>
          {notice.body.map((line) => (
            <p key={line} className="mt-1">
              {line}
            </p>
          ))}
          {notice.items === undefined ? null : (
            // Vaka kimliklerinde kırılma fırsatı yok (noktalı, alt çizgili); 375px'te
            // kutu en uzun kimlik kadar genişleyip sayfayı taşırıyordu.
            <ul className="mt-3 space-y-1 [overflow-wrap:anywhere]">
              {notice.items.map((item) => (
                <li key={item.caseId}>
                  <span className="code">{item.caseId}</span>{' '}
                  <span className="text-text-muted">— {item.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </Callout>
      ))}
    </div>
  )
}
