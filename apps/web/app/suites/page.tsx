import { EmptyState } from '@ktlsr/assay-ui'
import type { Metadata } from 'next'
import { Shell } from '../components/shell'
import { SuiteList } from '../components/suite-list'
import { listSuites } from '../../lib/runs'

export const metadata: Metadata = { title: 'Measured skills' }

/**
 * Yayımlanmış ölçümlerin dizini (0.4.1).
 *
 * Oturumsuz ziyaretçi kökte tanıtım sayfasını görüyor ve o sayfa tek bir
 * suite'i öne çıkarıyor; "Measured skills" listesi yalnızca oturum açmış
 * kullanıcıya açıktı. Üç suite yayımlandığında ziyaretçi yalnızca birine
 * ulaşabildi (ilk gerçek `assay push`, 2026-09-10). Kapsam `listSuites`in
 * varsayılanı: ziyaretçiye yalnızca `public: true` vaka setleri.
 */
export default async function SuitesPage() {
  const suites = await listSuites()
  return (
    <Shell breadcrumbs={[{ label: 'skills' }]}>
      <h1 className="page-title">Measured skills</h1>
      <p className="page-lede">
        One line per skill, showing its most recent run. The bar is the 95% confidence
        interval — a short bar means the number is settled, a long one means it is not.
      </p>
      {suites.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            title="Nothing published yet"
            description="A case set appears here once an administrator publishes it. Until then its runs stay private."
          />
        </div>
      ) : (
        <SuiteList suites={suites} />
      )}
    </Shell>
  )
}
