import type { CaseComparison } from '@ktlsr/assay-core'
import {
  Badge,
  Determination,
  EmptyState,
  IntervalRule,
  RateFigure,
  countSentence,
} from '@ktlsr/assay-ui'
import Link from 'next/link'
import { Pins } from '../components/run-meta'
import { Shell } from '../components/shell'
import { compare } from '../../lib/runs'

/**
 * Regresyon karşılaştırması.
 *
 * Kararı `@ktlsr/assay-core` veriyor: koşulların biri kaymışsa hiçbir vaka
 * karşılaştırılmaz. Bu ekran o kararı yeniden yorumlamaz — reddi hükmün
 * yerine koyar ve neyin kaydığını söyler.
 */
export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>
}) {
  const { a, b } = await searchParams
  if (a === undefined || b === undefined) {
    return (
      <Shell breadcrumbs={[{ label: 'compare' }]}>
        <EmptyState
          title="Pick two runs"
          description="A comparison needs a baseline and a candidate. Open a skill and choose “vs previous” on any run in its history."
          action={
            <Link href="/" className="link text-sm">
              Browse measured skills
            </Link>
          }
        />
      </Shell>
    )
  }

  const result = await compare(a, b)
  if (result === null) {
    return (
      <Shell breadcrumbs={[{ label: 'compare' }]}>
        <EmptyState
          title="One of those runs is missing"
          description="A comparison against a run that is no longer stored reports a missing baseline rather than quietly passing."
          action={
            <Link href="/" className="link text-sm">
              Browse measured skills
            </Link>
          }
        />
      </Shell>
    )
  }

  const { before, after, comparison } = result
  const regressed = comparison.cases.filter((c) => c.status === 'regressed').length
  const improved = comparison.cases.filter((c) => c.status === 'improved').length

  return (
    <Shell
      breadcrumbs={[
        { label: 'measurements', href: '/suites' },
        {
          label: after.run.skill,
          href: `/suites/${encodeURIComponent(after.run.skill)}`,
        },
        { label: 'compare' },
      ]}
    >
      <Determination
        verdict={comparison.verdict}
        subject={comparison.comparable ? headline(regressed, improved) : 'Not comparable'}
        sentence={comparison.reason}
        meta={
          <>
            <span>{before.run.startedAt.slice(0, 16).replace('T', ' ')}</span>
            <span>{after.run.startedAt.slice(0, 16).replace('T', ' ')}</span>
            <span>{after.run.skill}</span>
          </>
        }
      />

      {comparison.comparable ? (
        <section className="mt-12">
          <p className="rule-label mb-2">Case by case</p>
          <p className="mb-8 mt-4 max-w-[62ch] text-sm text-text-muted">
            A move is only called a regression when the two intervals do not overlap.
            Overlapping intervals mean the difference cannot be told apart from run-to-run
            noise, however large the gap between the two percentages looks.
          </p>
          <div className="ruled">
            {comparison.cases.map((row, index) => (
              <CaseDelta key={row.caseId} row={row} delayMs={Math.min(index * 45, 270)} />
            ))}
          </div>
        </section>
      ) : (
        <section className="mt-12">
          {/*
            Durduran sebep önce: kayan pin varsa o; okunamayan pin ayrı bir
            not olarak altında. Kayma yoksa okunamayan pin sebebin kendisi.
          */}
          {comparison.drifted.length === 0 ? null : (
            <>
              <p className="rule-label mb-6">What changed</p>
              <ul className="ruled">
                {comparison.drifted.map((pin) => (
                  <li key={pin} className="py-4 font-mono text-sm text-unknown">
                    {pin}
                  </li>
                ))}
              </ul>
              <p className="mt-8 max-w-[62ch] text-sm text-text-muted">
                Any difference between these two runs could come from the condition that
                moved. A score that dropped because the model changed is not a regression
                in the skill, and reporting it as one would send you to fix the wrong
                thing.
              </p>
            </>
          )}
          {comparison.unavailable.length === 0 ? null : (
            <div className={comparison.drifted.length === 0 ? undefined : 'mt-12'}>
              <p className="rule-label mb-6">
                {comparison.drifted.length === 0 ? 'What could not be read' : 'Also not readable'}
              </p>
              <ul className="ruled">
                {comparison.unavailable.map((pin) => (
                  <li key={pin} className="py-4 font-mono text-sm text-text-muted">
                    {pin}
                  </li>
                ))}
              </ul>
              <p className="mt-8 max-w-[62ch] text-sm text-text-muted">
                {comparison.note === undefined
                  ? 'The host did not report this condition in one or both runs. Without it the two runs cannot be shown to share their conditions, so no case is compared.'
                  : `Not what stopped this comparison: ${comparison.note}.`}
              </p>
            </div>
          )}
        </section>
      )}

      <section className="mt-14 grid gap-12 sm:grid-cols-2">
        <div>
          <p className="rule-label mb-6">Baseline conditions</p>
          <Pins run={before.run} drifted={comparison.drifted} />
        </div>
        <div>
          <p className="rule-label mb-6">Candidate conditions</p>
          <Pins run={after.run} drifted={comparison.drifted} />
        </div>
      </section>
    </Shell>
  )
}

function headline(regressed: number, improved: number): string {
  if (regressed > 0) return `${regressed} case${regressed === 1 ? '' : 's'} regressed`
  if (improved > 0) return `${improved} case${improved === 1 ? '' : 's'} improved`
  return 'No change beyond noise'
}

const STATUS: Record<CaseComparison['status'], { label: string; tone: string }> = {
  regressed: { label: 'regressed', tone: 'text-fail' },
  improved: { label: 'improved', tone: 'text-pass' },
  within_noise: { label: 'within noise', tone: 'text-text-faint' },
  unknown: { label: 'not comparable', tone: 'text-unknown' },
}

function CaseDelta({ row, delayMs }: { row: CaseComparison; delayMs: number }) {
  const status = STATUS[row.status]
  return (
    <div className="delta">
      <div className="delta-head">
        <span className="case-id">{row.caseId}</span>
        <span className={`mark ${status.tone}`}>
          {row.status === 'regressed' ? (
            <Badge verdict="fail" showLabel={false} size={13} />
          ) : null}
          {status.label}
        </span>
      </div>

      <div className="delta-row">
        <span className="col-label">Before</span>
        {row.before === null ? (
          <span className="text-xs text-text-faint">not measured</span>
        ) : (
          <IntervalRule value={row.before} delayMs={delayMs} />
        )}
        <span className="delta-figure">
          {row.before === null ? (
            '—'
          ) : (
            <>
              <RateFigure value={row.before} /> · {countSentence(row.before, 'passed')}
            </>
          )}
        </span>
      </div>

      <div className="delta-row">
        <span className="col-label">After</span>
        {row.after === null ? (
          <span className="text-xs text-text-faint">not measured</span>
        ) : (
          <IntervalRule value={row.after} delayMs={delayMs + 60} tone={status.tone} />
        )}
        <span className="delta-figure">
          {row.after === null ? (
            '—'
          ) : (
            <>
              <RateFigure value={row.after} /> · {countSentence(row.after, 'passed')}
            </>
          )}
        </span>
      </div>

      <p className="delta-reason">{row.reason}</p>
    </div>
  )
}
