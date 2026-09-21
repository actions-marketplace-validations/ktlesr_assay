import Link from 'next/link'
import { Shell } from './components/shell'

/**
 * 404.
 *
 * Yayın modunda uygulamanın yarısı kapalı (middleware.ts) ve o rotalar buraya
 * düşüyor. Ziyaretçiye "bir şeyler ters gitti" hissi vermemek için sayfa
 * sitenin kendi dilinde: kapalı olan şey bir hata değil, bu dağıtımda
 * bulunmayan bir bölüm.
 */
export default function NotFound() {
  return (
    <Shell>
      <section className="section">
        <p className="rule-label mb-6">404</p>
        <h1 className="page-title">Nothing here</h1>
        <p className="page-lede">
          This page does not exist on this instance. Every measurement published here is
          listed under Measurements.
        </p>
        <div className="hero-actions mt-8">
          <Link href="/suites" className="btn">
            See the measurements
          </Link>
          <Link href="/" className="link text-sm">
            Back to the front page
          </Link>
        </div>
      </section>
    </Shell>
  )
}
