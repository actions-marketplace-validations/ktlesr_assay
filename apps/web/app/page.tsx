import { EmptyState } from '@ktlsr/assay-ui'
import { Shell } from './components/shell'
import { SuiteList } from './components/suite-list'
import { Landing } from './landing'
import { auth } from '../lib/auth'
import { listSuites } from '../lib/runs'

/**
 * Kök.
 *
 * Oturum yoksa tanıtım sayfası, varsa ölçülen skill'lerin listesi. Tek adres:
 * gelen kişi neye baktığını bilir, giren kişi işine döner.
 */
export default async function Home() {
  const session = await auth()
  if (session === null) return <Landing />

  const suites = await listSuites()

  return (
    <Shell>
      {suites.length === 0 ? (
        <EmptyState
          title="Nothing measured here yet"
          description="Assay stores every run on your own machine first. Measure a skill with the CLI, then upload the record to keep its history and compare against it later."
          action={<code className="code">assay push --suite ./my-skill.suite.yaml</code>}
        />
      ) : (
        <>
          <h1 className="page-title">Measured skills</h1>
          <p className="page-lede">
            One line per skill, showing its most recent run. The bar is the 95% confidence
            interval — a short bar means the number is settled, a long one means it is
            not.
          </p>

          <SuiteList suites={suites} />
        </>
      )}
    </Shell>
  )
}
