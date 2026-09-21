import { type Attempt, type CaseResult, type Run, type RunSummary } from '@ktlsr/assay-core'
import {
  Badge,
  Callout,
  Determination,
  IntervalRule,
  MeasurementBlock,
  RateFigure,
  countSentence,
} from '@ktlsr/assay-ui'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CollisionMatrixSection } from '../../components/collision-matrix'
import { CoverageNotices } from '../../components/coverage-notices'
import { HostMemoryNote } from '../../components/host-memory-note'
import { Pins } from '../../components/run-meta'
import { Shell } from '../../components/shell'
import { baselineFor } from '../../../lib/baseline'
import { unknownBecause } from '../../../lib/coverage'
import { getRun, getSuite } from '../../../lib/runs'

/**
 * Koşum detayı — skill karnesi. Ürünün ana ekranı.
 *
 * Okuma sırası bilerek şu: önce **hüküm** (bir cümlelik düz cevap), sonra iki
 * ölçüm (sayım cümlesi → yüzde → aralık), sonra vakalar, en sonda künye. Bir
 * kullanıcı sayfadan tek bir şey anlayacaksa hükmü anlar; istatistiği okumak
 * isteyen aşağı iner.
 */
export default async function RunPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const item = await getRun(slug)
  if (item === null) notFound()

  const { run, summary } = item
  const suite = await getSuite(run.skill)
  // Bağlantı yalnızca aynı koşullarda ölçülmüş bir koşuma "compare" der.
  const baseline = baselineFor(
    run,
    (suite?.runs ?? []).filter((r) => r.run.startedAt < run.startedAt),
  )

  const flaky = run.cases.filter((c) => c.passed > 0 && c.failed > 0)
  const unmeasured = [
    ...new Map(
      run.cases
        .flatMap((c) => c.attempts.map((a) => ({ caseId: c.caseId, attempt: a })))
        .filter(({ attempt }) => attempt.verdict === 'unknown')
        .map((entry) => [`${entry.caseId}:${entry.attempt.reason}`, entry]),
    ).values(),
  ]
  const unmeasuredCount = run.cases.reduce((total, c) => total + c.unknown, 0)
  // Çakışma suite'inde bu iki oran yalnızca suite'in hedef skill'ini anlatıyor.
  const targetOnly = summary.collision === undefined ? '' : ' · target skill only'
  // Kesinliğin paydası boş ama sinyal okundu: skill hiç tetiklenmedi (0.4.1-l).
  const neverFired =
    summary.trigger.precision.n === 0 &&
    run.cases.some((c) => c.attempts.some((a) => a.trigger.available))

  return (
    <Shell
      breadcrumbs={[
        { label: 'measurements', href: '/suites' },
        { label: run.skill, href: `/suites/${encodeURIComponent(run.skill)}` },
        { label: 'run' },
      ]}
    >
      <Determination
        verdict={run.verdict}
        subject={run.skill}
        sentence={verdictSentence(run.verdict, summary, run)}
        meta={
          <>
            <span>{run.startedAt.slice(0, 10)}</span>
            <span>{run.pins.model}</span>
            <span>{run.runs} attempts per case</span>
            <span>{run.host}</span>
            <span>{run.id}</span>
          </>
        }
      />

      {/* Kapsam: hızlı mod, koşulmayan vakalar, yarım kayıt — sayılardan önce (0.4.3-b). */}
      <CoverageNotices run={run} />

      {/* Çakışma suite'inde asıl cevap matris; altındaki iki oran yalnızca hedef skill (0.4.1-1). */}
      {summary.collision === undefined ? null : (
        <CollisionMatrixSection matrix={summary.collision} />
      )}

      <MeasurementBlock
        label={`Fired when it should have${targetOnly}`}
        value={summary.trigger.recall}
        verb="fired"
        tone={summary.trigger.recall.rate === 1 ? 'text-pass' : 'text-fail'}
      />

      <div className="border-t border-rule">
        <MeasurementBlock
          label={`Was right when it fired${targetOnly}`}
          value={summary.trigger.precision}
          verb="was right"
          delayMs={70}
          {...(neverFired
            ? {
                empty: {
                  count: 'never fired',
                  reason:
                    'The skill did not fire in any attempt that was read, so there is nothing it could have been right or wrong about.',
                },
              }
            : {})}
          tone={summary.trigger.precision.rate === 1 ? 'text-pass' : 'text-fail'}
        />
      </div>

      {summary.trigger.unknown > 0 ? (
        <div className="mb-12">
          <Callout
            tone="warning"
            title={`${summary.trigger.unknown} observations could not be read`}
          >
            They are excluded from both rates above rather than counted as successes.
          </Callout>
        </div>
      ) : null}

      <section className="mt-10 mb-12">
        <p className="rule-label mb-2">Every case</p>
        <div className="ruled">
          {run.cases.map((caseResult, index) => (
            <CaseRow
              key={caseResult.caseId}
              slug={slug}
              caseResult={caseResult}
              delayMs={Math.min(index * 45, 270)}
            />
          ))}
        </div>
      </section>

      {flaky.length > 0 ? (
        <section className="mb-12">
          <p className="rule-label mb-4">Instability</p>
          <Callout
            tone="warning"
            title={`${flaky.length} case${flaky.length === 1 ? '' : 's'} produced both outcomes`}
          >
            The same prompt, the same model, different results. A single run of any of
            these would have been a coin flip reported as a fact.
            <ul className="mt-3 space-y-1">
              {flaky.map((c) => (
                <li key={c.caseId} className="code">
                  {c.caseId} — {c.passed} passed, {c.failed} failed
                </li>
              ))}
            </ul>
          </Callout>
        </section>
      ) : null}

      {unmeasuredCount > 0 ? (
        <section className="mb-12">
          <p className="rule-label mb-4">Not measured</p>
          <Callout
            tone="warning"
            title={`${unmeasuredCount} attempt${unmeasuredCount === 1 ? '' : 's'} produced no verdict`}
          >
            An unmeasured attempt is not a passing one. These are excluded from every rate
            on this page and counted here instead.
          </Callout>
          <ul className="ruled mt-6">
            {unmeasured.map(({ caseId, attempt }) => (
              <li key={`${caseId}-${attempt.index}`} className="py-3">
                <p className="code">{caseId}</p>
                <p className="mt-1 text-sm text-text-muted">{attempt.reason}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mb-12">
        <p className="rule-label mb-4">Conditions</p>
        <p className="mb-6 max-w-[62ch] text-sm text-text-muted">
          Two runs are comparable only when all of these are identical. A score that
          moved because the model changed is not a regression in the skill.
        </p>
        <Pins run={run} />
        <HostMemoryNote run={run} />
        {baseline === null ? null : (
          <p className="mt-8 text-sm">
            {baseline.kind === 'differs' ? (
              <>
                <span className="text-text-muted">
                  No earlier run was measured under the same conditions.{' '}
                </span>
                <Link href={`/compare?a=${baseline.slug}&b=${slug}`} className="link">
                  See what changed since the previous run
                </Link>
              </>
            ) : (
              <Link href={`/compare?a=${baseline.slug}&b=${slug}`} className="link">
                {baseline.adjacent
                  ? 'Compare with the previous run'
                  : `Compare with the last run under the same conditions (${baseline.startedAt.slice(0, 16).replace('T', ' ')})`}
              </Link>
            )}
          </p>
        )}
      </section>

      <section>
        <p className="rule-label mb-6">What it cost</p>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
          <Stat label="Attempts" value={String(summary.totals.attempts)} />
          <Stat
            label="Tokens in / out"
            value={`${summary.totals.inputTokens.toLocaleString('en')} / ${summary.totals.outputTokens.toLocaleString('en')}`}
          />
          <Stat
            label="Cost"
            value={
              summary.totals.usd === null
                ? 'not reported'
                : `$${summary.totals.usd.toFixed(2)}`
            }
          />
          <Stat
            label="Agent time"
            value={`${Math.round(summary.totals.durationMs / 60000)} min`}
          />
        </dl>
        <p className="mt-6 max-w-[62ch] text-sm text-text-muted">
          Combined trigger score (F1){' '}
          {summary.trigger.f1 === null ? 'not measurable' : summary.trigger.f1.toFixed(2)}
          {' · '}
          {summary.trigger.truePositive + summary.trigger.trueNegative} of{' '}
          {summary.trigger.truePositive +
            summary.trigger.trueNegative +
            summary.trigger.falsePositive +
            summary.trigger.falseNegative}{' '}
          trigger decisions were correct.
        </p>
      </section>
    </Shell>
  )
}

/** Hükmün düz cümlesi. Sayfadan tek bir şey okunacaksa bu okunur. */
function verdictSentence(verdict: string, summary: RunSummary, run: Run): string {
  const t = summary.trigger
  if (verdict === 'unknown') {
    const because = unknownBecause(run)
    if (because !== null && summary.counts.unknown === 0) return because
    return `${summary.counts.unknown} of ${summary.counts.pass + summary.counts.fail + summary.counts.unknown} attempts produced no readable signal, so this run measured nothing conclusive.`
  }
  if (verdict === 'pass') {
    return 'It fired on every request it was supposed to, and stayed quiet on every request it was not.'
  }
  const missed = t.falseNegative
  const overreached = t.falsePositive
  if (missed > 0 && overreached > 0) {
    return `It missed ${missed} request${missed === 1 ? '' : 's'} it should have handled and fired on ${overreached} it should have left alone.`
  }
  if (missed > 0) {
    return `It missed ${missed} of ${missed + t.truePositive} requests it should have handled — the skill stayed silent and the model answered on its own.`
  }
  if (overreached > 0) {
    return `It fired on ${overreached} request${overreached === 1 ? '' : 's'} it should have left to another skill.`
  }
  return 'A case failed on something other than triggering — open the cases below.'
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="col-label">{label}</dt>
      <dd className="mt-2 font-mono text-base text-text">{value}</dd>
    </div>
  )
}

function CaseRow({
  slug,
  caseResult,
  delayMs,
}: {
  slug: string
  caseResult: CaseResult
  delayMs: number
}) {
  const verdict =
    caseResult.failed > 0 ? 'fail' : caseResult.unknown > 0 ? 'unknown' : 'pass'
  const target: Attempt | undefined =
    caseResult.attempts.find((a) => a.verdict !== 'pass') ?? caseResult.attempts[0]
  const expectation =
    caseResult.expectedTrigger === undefined
      ? null
      : caseResult.expectedTrigger
        ? 'should fire'
        : 'should stay quiet'

  return (
    <Link
      href={
        target === undefined
          ? '#'
          : `/runs/${slug}/attempts/${encodeURIComponent(caseResult.caseId)}/${target.index}`
      }
      className="row-link case-row"
    >
      <span className="case-mark">
        <Badge verdict={verdict} showLabel={false} size={15} />
      </span>
      <span className="case-body">
        <span className="case-id">{caseResult.caseId}</span>
        <span className="case-count">
          {countSentence(caseResult.passRate, expectation === null ? 'held' : 'behaved')}
          {expectation === null ? null : (
            <span className="case-expect">{expectation}</span>
          )}
        </span>
      </span>
      <span className="case-instrument">
        <IntervalRule
          value={caseResult.passRate}
          delayMs={delayMs}
          tone={
            verdict === 'pass'
              ? 'text-pass'
              : verdict === 'fail'
                ? 'text-fail'
                : 'text-unknown'
          }
        />
      </span>
      <span className="case-figure">
        <RateFigure value={caseResult.passRate} />
      </span>
    </Link>
  )
}
