import type { CaseResult } from '@ktlsr/assay-core'
import {
  Badge,
  Callout,
  IntervalRule,
  RateFigure,
  countSentence,
  intervalGloss,
} from '@ktlsr/assay-ui'
import Link from 'next/link'
import { RunTerminal } from './components/run-terminal'
import { Shell } from './components/shell'
import { compare, listSuites, type RunWithSummary } from '../lib/runs'

/**
 * Tanıtım sayfası.
 *
 * Tek kural: buradaki her sayı bu örneğin veritabanındaki gerçek bir koşumdan
 * okunuyor. Uydurma müşteri sayısı, logo, referans yok; gösterilecek gerçek
 * ölçüm yoksa bölüm hiç çizilmiyor. Boş bir bölüm, süslenmiş bir yalandan
 * iyidir.
 *
 * Ziyaretçi ilk ekranda ürünün tarifini değil çıktısını görüyor: ölçümün
 * kendisi kahraman.
 */
export async function Landing() {
  // Oturumsuz ziyaretçi: yalnızca herkese açık işaretlenmiş vaka setleri.
  const suites = await listSuites({ kind: 'public' })
  const failing = suites.find((s) => s.latest.run.verdict === 'fail') ?? suites[0]
  const worst = failing === undefined ? undefined : worstCase(failing.latest)
  const previous =
    failing === undefined
      ? undefined
      : failing.runs.find((r) => r.run.startedAt < failing.latest.run.startedAt)
  const comparison =
    failing === undefined || previous === undefined
      ? null
      : await compare(previous.slug, failing.latest.slug)

  // Yayın modunda hero'nun birincil eylemi paketi gösteriyor: buraya gelen
  // kişi hesap açmaya değil, aracın ne olduğunu anlamaya geliyor. Giriş
  // bağlantısı başlıkta duruyor, orada aranıyor zaten.
  const publicSite = process.env['ASSAY_PUBLIC_SITE'] === 'true'

  return (
    <Shell>
      <section className="hero">
        <h1 className="hero-title">
          <span>Does your skill</span>
          <span>still fire?</span>
        </h1>

        {/*
          Terminal hero'nun kendisi. Ziyaretçi ürünün tarifini değil, aracın
          çalışırken ne yazdığını görüyor — ve yazdığı şey rahatsız edici: bir
          çarpı ve geniş bir güven aralığı. Bu sayfanın tek argümanı bu.

          Yayımlanmış koşum yoksa terminal çizilmiyor; satır uydurmuyoruz.
        */}
        {failing === undefined ? (
          <p className="hero-lede">
            A skill ships with a README and a promise. Whether it triggers on the request
            it claims, stays quiet on the one next to it, and does the same thing tomorrow
            — nobody measures. Assay runs a case set against a real host, repeats it, and
            reports the rate with its uncertainty attached.
          </p>
        ) : (
          <>
            <RunTerminal run={failing.latest.run} />
            <p className="term-gloss">
              {/* Sayılar koşumdan: öne çıkan suite yayımlananlara göre değişiyor. */}
              A recorded run, replayed: {failing.latest.run.cases.length} cases,{' '}
              {failing.latest.run.runs} attempts each. Assay does not round the failure up,
              and it does not hide how wide the interval still is at{' '}
              {failing.latest.run.runs} attempts.
            </p>
          </>
        )}

        <div className="hero-actions">
          {publicSite ? (
            <a href="https://www.npmjs.com/package/@ktlsr/assay" className="btn">
              Get the CLI
            </a>
          ) : (
            <Link href="/signin" className="btn">
              Sign in
            </Link>
          )}
          {/* Kapsamsız `assay` npm'de ilgisiz bir paket; kapsamlı ad şart. */}
          <code className="code">npx @ktlsr/assay run ./my-skill.suite.yaml</code>
        </div>
      </section>

      {failing === undefined || worst === undefined ? (
        <section className="section-minor">
          <p className="rule-label mb-6">A real measurement</p>
          <Callout tone="info" title="This instance has no published runs yet">
            Every figure on this page is read out of the database, from runs uploaded by
            the CLI. Nothing is written by hand, so until a run is published there is
            nothing to show here.
          </Callout>
        </section>
      ) : (
        <section className="section-major">
          <h2 className="section-title">One case, measured {worst.attempts.length} times</h2>
          <div className="specimen mt-10">
            <div className="specimen-head">
              <Badge verdict={worst.failed > 0 ? 'fail' : 'pass'} size={16} />
              <span className="code">{worst.caseId}</span>
            </div>
            <p className="specimen-count">
              {countSentence(worst.passRate, 'behaved as the case set expects')}
            </p>
            <div className="specimen-figure">
              <span className="measure-pct">
                <RateFigure value={worst.passRate} />
              </span>
              <div className="measure-instrument">
                <IntervalRule value={worst.passRate} showBounds tone="text-fail" />
              </div>
            </div>
            <p className="specimen-gloss">
              {intervalGloss(worst.passRate) ?? 'No attempt produced a readable signal.'}{' '}
              One attempt would have reported either outcome as a fact.
            </p>
            <p className="specimen-meta">
              <span>{failing.skill}</span>
              <span>{failing.latest.run.pins.model}</span>
              <span>{failing.latest.run.startedAt.slice(0, 10)}</span>
            </p>
          </div>
          <p className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
            <Link href={`/runs/${failing.latest.slug}`} className="link text-sm">
              Open the full scorecard
            </Link>
            {/* Tek öne çıkan suite ziyaretçinin ulaşabildiği tek ölçümdü (0.4.1). */}
            <Link href="/suites" className="link text-sm">
              Every published measurement
            </Link>
          </p>
        </section>
      )}

      {comparison === null ? null : (
        <section className="section-major">
          <h2 className="section-title">What it refuses to claim</h2>
          <p className="section-lede">
            Two runs of the same skill are stored. Here is what Assay says when asked
            whether the second is better than the first — not a headline, the actual
            output:
          </p>
          <div className="mt-8">
            <Callout
              tone={comparison.comparison.comparable ? 'info' : 'warning'}
              title={
                comparison.comparison.comparable
                  ? 'Comparison produced'
                  : 'Comparison refused'
              }
            >
              {comparison.comparison.reason}
            </Callout>
          </div>
          <p className="section-note">
            A regression is only called when the two intervals do not overlap, and two
            runs are only compared when the skill, the model, the environment and the case
            set are all identical. A tool that skips these produces confident numbers
            about nothing.
          </p>
        </section>
      )}

      <section className="section-minor">
        <p className="rule-label mb-8">What it measures</p>
        <dl className="layer-grid">
          <Layer
            title="Trigger accuracy"
            body="Does it fire on the request it claims, and stay quiet on the near neighbour? A case set without a negative case is rejected — a skill that fires on everything would pass every positive case."
          />
          <Layer
            title="Task completion"
            body="Does the artefact exist, parse, and match the schema? Deterministic assertions only: file existence, structure, schema, text match."
          />
          <Layer
            title="Tool trace"
            body="Were the expected tools called in the expected order? A right answer reached the wrong way is a skill that breaks tomorrow."
          />
          <Layer
            title="Side effects"
            body="What did it write, delete, or reach for on the network? Where the sandbox cannot see, the run says so instead of reporting a clean slate."
          />
          <Layer
            title="Instability"
            body="Repeat count never defaults to one. A single attempt is an observation; the measurement is the rate across N with its interval."
          />
          <Layer
            title="Regression"
            body="Did the new version get worse? Only claimed when the conditions are identical and the intervals do not overlap."
          />
        </dl>
      </section>

      <section className="section-minor">
        <p className="rule-label mb-8">Three verdicts, not two</p>
        <div className="verdict-grid">
          <VerdictCard
            kind="pass"
            body="The assertion held, and there was enough signal to say so."
          />
          <VerdictCard
            kind="fail"
            body="The assertion did not hold. Something is broken."
          />
          <VerdictCard
            kind="unknown"
            body="The signal could not be read. A first-class result, counted and shown separately — never rounded up to a pass."
          />
        </div>
        <p className="section-note">
          The most dangerous thing a test tool can do is report what it could not measure
          as a success. Everything else here follows from refusing that.
        </p>
      </section>

      <section className="section-minor">
        <p className="rule-label mb-8">Getting started</p>
        <ol className="ruled steps">
          {/* Kapsamsız `assay` npm'de ilgisiz bir paket: `npx assay` onu çalıştırır. */}
          <Step command="npm install -g @ktlsr/assay" note="installs the CLI; the command is assay" />
          <Step
            command="assay init ./my-skill.suite.yaml"
            note="writes an example case set to fill in for your skill"
          />
          <Step
            command="assay run ./my-skill.suite.yaml --skill ./my-skill"
            note="runs it against the host, N times per case, stores the record locally; --concurrency 4 runs attempts in parallel"
          />
          <Step
            command="assay run ./my-skill.suite.yaml --skill ./my-skill --fast"
            note="three attempts per case, trigger layer only — minutes instead of hours. An early warning, not evidence"
          />
          <Step
            command="assay ci ./my-skill.suite.yaml"
            note="the same run, with a CI exit code: 1 for a failure, 3 for nothing measured"
          />
          <Step
            command="assay push --suite ./my-skill.suite.yaml"
            note="optional — keeps the history here so the next run can be compared against it"
          />
        </ol>
        <p className="section-note">
          The SDK is Apache-2.0 and works with no account: runs are stored under{' '}
          <code className="code">.assay/runs/</code> and printed as JSON. The hosted side
          does not measure anything — it remembers.
        </p>
      </section>

      <section className="section-minor section-last">
        <p className="rule-label mb-6">Pricing</p>
        <p className="section-lede">
          Draft, and not yet charged for. The measuring half stays free and open — a
          measurement layer nobody can read is a measurement nobody should trust.
        </p>
        <div className="tier-grid">
          <Tier
            name="SDK"
            price="Free, Apache-2.0"
            body="The CLI, the adapters, the assertion engine, the local store, the GitHub Action. Everything that measures."
          />
          <Tier
            name="Team"
            price="Draft"
            body="Uploaded history, regression comparison across versions, shared visibility. Everything that remembers."
          />
          <Tier
            name="Platform"
            price="Draft"
            body="For catalogues that want a measured quality signal on the skills they distribute — dated, pinned, reproducible."
          />
        </div>
      </section>
    </Shell>
  )
}

function worstCase(item: RunWithSummary): CaseResult | undefined {
  const withFailures = item.run.cases.filter((c) => c.failed > 0)
  if (withFailures.length === 0) return item.run.cases[0]
  return withFailures.reduce((worst, candidate) =>
    (candidate.passRate.rate ?? 1) < (worst.passRate.rate ?? 1) ? candidate : worst,
  )
}

function Layer({ title, body }: { title: string; body: string }) {
  return (
    <div className="layer">
      <dt className="layer-title">{title}</dt>
      <dd className="layer-body">{body}</dd>
    </div>
  )
}

function VerdictCard({
  kind,
  body,
}: {
  kind: 'pass' | 'fail' | 'unknown'
  body: string
}) {
  return (
    <div className="verdict-card">
      <Badge verdict={kind} size={16} />
      <p className="verdict-body">{body}</p>
    </div>
  )
}

function Step({ command, note }: { command: string; note: string }) {
  return (
    <li className="step">
      <p className="step-command">
        <span className="step-prompt">$</span>
        {command}
      </p>
      <p className="step-note">{note}</p>
    </li>
  )
}

function Tier({ name, price, body }: { name: string; price: string; body: string }) {
  return (
    <div className="tier">
      <p className="tier-name">{name}</p>
      <p className="tier-price">{price}</p>
      <p className="tier-body">{body}</p>
    </div>
  )
}
