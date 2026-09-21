import {
  Badge,
  BreakableName,
  EmptyState,
  IntervalRule,
  MeasurementBlock,
  RateFigure,
  countSentence,
} from '@ktlsr/assay-ui'
import Link from 'next/link'
import { baselineFor, type Baseline } from '../../../lib/baseline'
import { coverageTag } from '../../../lib/coverage'
import { notFound } from 'next/navigation'
import { Shell } from '../../components/shell'
import { getSuite } from '../../../lib/runs'

/**
 * Suite detayı — bir skill'in bütün geçmişi.
 *
 * Trend bir grafik değil, koşum başına çizilmiş aralıklar: iki aralık
 * kesişiyorsa gözle görülüyor ve "düzeldi" demek için kesişmemeleri gerekiyor.
 * Çizgi grafiği bu farkı gizler; üst üste duran aralıklar gizleyemez.
 */
export default async function SuitePage({
  params,
}: {
  params: Promise<{ skill: string }>
}) {
  const { skill } = await params
  const suite = await getSuite(skill)
  if (suite === null) notFound()

  const { latest, runs } = suite

  return (
    <Shell breadcrumbs={[{ label: 'measurements', href: '/suites' }, { label: suite.skill }]}>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <h1 className="page-title">
            <BreakableName name={suite.skill} />
          </h1>
          <p className="page-lede">
            {runs.length} {runs.length === 1 ? 'run' : 'runs'} stored, most recent on{' '}
            {latest.run.startedAt.slice(0, 10)}.
          </p>
        </div>
        <Badge verdict={latest.run.verdict} size={16} />
      </div>

      {/* Son koşum hızlı mod ya da yarım kayıtsa oran kanıt değil (0.4.3-b). */}
      {coverageTag(latest.run) === null ? null : (
        <p className="mt-8 text-sm text-unknown">
          The latest run is marked “{coverageTag(latest.run)}”: its numbers are not a full
          measurement. Open it for what was and was not measured.
        </p>
      )}

      <div className="mt-12 border-t border-rule-strong">
        <MeasurementBlock
          label="Latest run · fired when it should have"
          value={latest.summary.trigger.recall}
          verb="fired"
          tone={latest.summary.trigger.recall.rate === 1 ? 'text-pass' : 'text-fail'}
        />
      </div>
      <p>
        <Link href={`/runs/${latest.slug}`} className="link text-sm">
          Open the full scorecard
        </Link>
      </p>

      <section className="mt-14">
        <p className="rule-label mb-2">Cases in the latest run</p>
        <div className="ruled">
          {latest.run.cases.map((caseResult, index) => (
            <div key={caseResult.caseId} className="case-row">
              <span className="case-mark">
                <Badge
                  verdict={
                    caseResult.failed > 0
                      ? 'fail'
                      : caseResult.unknown > 0
                        ? 'unknown'
                        : 'pass'
                  }
                  showLabel={false}
                  size={15}
                />
              </span>
              <span className="case-body">
                <span className="case-id">{caseResult.caseId}</span>
                <span className="case-count">
                  {countSentence(caseResult.passRate, 'behaved')}
                  <span className="case-expect">
                    {caseResult.expectedTrigger === undefined
                      ? 'no trigger claim'
                      : caseResult.expectedTrigger
                        ? 'should fire'
                        : 'should stay quiet'}
                  </span>
                </span>
              </span>
              <span className="case-instrument">
                <IntervalRule
                  value={caseResult.passRate}
                  delayMs={Math.min(index * 45, 270)}
                  tone={caseResult.failed > 0 ? 'text-fail' : 'text-pass'}
                />
              </span>
              <span className="case-figure">
                <RateFigure value={caseResult.passRate} />
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <p className="rule-label mb-2">History</p>
        {runs.length === 1 ? (
          <div className="mt-6">
            <EmptyState
              title="Only one run so far"
              description="A trend needs a second measurement. Run the case set again and the comparison appears here — including a refusal if any of the six conditions drifted."
              action={<code className="code">assay run {suite.skill}.suite.yaml</code>}
            />
          </div>
        ) : (
          <div className="ruled">
            {runs.map((item, index) => {
              // ponytail: her satır için daha eski koşumları tarıyor (O(n²)); bir
              // skill'in koşum sayısı küçük, büyürse pin anahtarıyla gruplanır.
              const baseline = baselineFor(item.run, runs.slice(index + 1))
              return (
                <div key={item.slug} className="history-row">
                  <span className="case-mark">
                    <Badge verdict={item.run.verdict} showLabel={false} size={15} />
                  </span>
                  <span className="min-w-0">
                    <Link href={`/runs/${item.slug}`} className="case-id link">
                      {item.run.startedAt.slice(0, 16).replace('T', ' ')}
                    </Link>
                    <span className="case-count">
                      {countSentence(item.summary.passRate, 'passed')}
                    </span>
                  </span>
                  <span className="case-instrument">
                    <IntervalRule
                      value={item.summary.passRate}
                      delayMs={Math.min(index * 45, 270)}
                      tone={item.run.verdict === 'fail' ? 'text-fail' : 'text-pass'}
                    />
                  </span>
                  <span className="case-figure">
                    <RateFigure value={item.summary.passRate} />
                  </span>
                  <span className="history-action">
                    <BaselineLink baseline={baseline} slug={item.slug} />
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </Shell>
  )
}

/**
 * Geçmiş satırındaki karşılaştırma bağlantısı. Yalnızca aynı koşullarda
 * ölçülmüş bir koşuma "vs" der; aradakileri atladıysa hangi koşuma gittiğini
 * tarihiyle söyler. Aynı koşullarda önceki koşum yoksa karşılaştırma
 * vaat etmez: neyin değiştiğini gösteren sayfaya "conditions differ" diye gider.
 */
function BaselineLink({ baseline, slug }: { baseline: Baseline; slug: string }) {
  if (baseline === null) return null
  const href = `/compare?a=${baseline.slug}&b=${slug}`
  if (baseline.kind === 'differs') {
    return (
      <Link href={href} className="link link-quiet text-xs">
        conditions differ
      </Link>
    )
  }
  const when = baseline.startedAt.slice(0, 16).replace('T', ' ')
  return (
    <Link
      href={href}
      className="link text-xs"
      aria-label={`Compare with the run of ${when}, the last one under the same conditions`}
    >
      {baseline.adjacent ? 'vs previous' : `vs ${when.slice(5)}`}
    </Link>
  )
}
