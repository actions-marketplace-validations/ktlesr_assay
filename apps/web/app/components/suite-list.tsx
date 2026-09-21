import { Badge, IntervalRule, RateFigure, countSentence } from '@ktlsr/assay-ui'
import { activationUnverified } from '@ktlsr/assay-core'
import Link from 'next/link'
import { coverageTag } from '../../lib/coverage'
import type { SuiteView } from '../../lib/runs'

/**
 * Ölçülen skill'ler — skill başına bir satır, en son koşumuyla.
 *
 * Oturum açmış kullanıcının ana sayfası ve `/suites` dizini aynı listeyi
 * gösteriyor; hangi satırların görüneceğine çağıranın görünürlük kapsamı
 * karar veriyor (RunScope), bileşen değil.
 */
export function SuiteList({ suites }: { suites: readonly SuiteView[] }) {
  return (
    <div className="ruled mt-12">
      {suites.map(({ skill, runs, latest }, index) => (
        <Link
          key={skill}
          href={`/suites/${encodeURIComponent(skill)}`}
          className="row-link suite-row"
        >
          <span className="case-mark">
            <Badge verdict={latest.run.verdict} showLabel={false} size={16} />
          </span>
          <span className="min-w-0">
            <span className="suite-name">{skill}</span>
            <span className="case-count">
              {countSentence(latest.summary.trigger.recall, 'fired')} it should have
              {latest.summary.counts.unknown > 0 ? (
                <span className="ml-3 text-unknown">
                  {latest.summary.counts.unknown} not measured
                </span>
              ) : null}
              {/* 0.2.0 öncesi kayıt: oran doğrulanmamış aktivasyonlardan (0.4.1-a). */}
              {activationUnverified(latest.run) ? (
                <span className="ml-3 text-unknown">activation not verified</span>
              ) : null}
              {/* Hızlı mod ya da yarım kayıt: oran kanıt değil (0.4.3-b). */}
              {coverageTag(latest.run) === null ? null : (
                <span className="ml-3 text-unknown">{coverageTag(latest.run)}</span>
              )}
            </span>
            <span className="suite-meta">
              {runs.length} {runs.length === 1 ? 'run' : 'runs'} ·{' '}
              {latest.run.pins.model} · {latest.run.startedAt.slice(0, 10)}
            </span>
          </span>
          <span className="case-instrument">
            <IntervalRule
              value={latest.summary.trigger.recall}
              delayMs={Math.min(index * 45, 270)}
              tone={
                latest.run.verdict === 'pass'
                  ? 'text-pass'
                  : latest.run.verdict === 'fail'
                    ? 'text-fail'
                    : 'text-unknown'
              }
            />
          </span>
          <span className="case-figure">
            <RateFigure value={latest.summary.trigger.recall} />
          </span>
        </Link>
      ))}
    </div>
  )
}
