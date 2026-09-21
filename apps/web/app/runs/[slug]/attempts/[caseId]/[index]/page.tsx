import { redactDeep, type Attempt } from '@ktlsr/assay-core'
import { Badge, Callout, Determination, TraceViewer } from '@ktlsr/assay-ui'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Shell } from '../../../../../components/shell'
import { getRun } from '../../../../../../lib/runs'

/**
 * Attempt detayı — tek bir tekrarın tamamı.
 *
 * Ölçümün en alt katmanı: ne gözlendi, ne iddia edildi, ne yapıldı, neye
 * dokunuldu. Yutulan hata uyarısı izin altında duruyor çünkü ancak iz
 * okunduktan sonra anlam kazanıyor.
 */
export default async function AttemptPage({
  params,
}: {
  params: Promise<{ slug: string; caseId: string; index: string }>
}) {
  const { slug, caseId, index } = await params
  const item = await getRun(slug)
  if (item === null) notFound()

  const decodedCase = decodeURIComponent(caseId)
  const caseResult = item.run.cases.find((c) => c.caseId === decodedCase)
  const attempt = caseResult?.attempts.find((a) => a.index === Number(index))
  if (caseResult === undefined || attempt === undefined) notFound()

  const isSwallowed = (a: (typeof attempt.assertions)[number]) =>
    a.assertion.type === 'trace' && a.assertion.rule === 'no_swallowed_errors'
  const swallowed = attempt.assertions.find(isSwallowed)
  const others = attempt.assertions.filter((a) => !isSwallowed(a))

  return (
    <Shell
      breadcrumbs={[
        { label: 'measurements', href: '/suites' },
        { label: item.run.skill, href: `/suites/${encodeURIComponent(item.run.skill)}` },
        { label: 'run', href: `/runs/${slug}` },
        { label: `attempt ${attempt.index + 1}` },
      ]}
    >
      <Determination
        verdict={attempt.verdict}
        subject={`Attempt ${attempt.index + 1} of ${caseResult.attempts.length}`}
        sentence={attempt.reason}
        meta={
          <>
            <span>{decodedCase}</span>
            <span>
              {attempt.latencyMs === undefined
                ? 'latency not reported'
                : `${(attempt.latencyMs / 1000).toFixed(1)} s`}
            </span>
            {attempt.cost === undefined ? null : (
              <span>
                {attempt.cost.inputTokens}/{attempt.cost.outputTokens} tokens
              </span>
            )}
          </>
        }
      />

      <section className="mb-12 mt-12">
        <p className="rule-label mb-6">Did the skill fire?</p>
        {attempt.trigger.available ? (
          <>
            <p className="text-lg">
              {attempt.trigger.triggered
                ? 'Yes — the skill fired.'
                : 'No — the skill never fired.'}
            </p>
            <p className="mt-3 text-sm text-text-muted">
              Observed {attempt.trigger.via}.{' '}
              {attempt.trigger.skills.length === 0
                ? 'No skill was invoked in this attempt.'
                : `Skills invoked: ${attempt.trigger.skills.join(', ')}.`}
            </p>
            {attempt.trigger.complete ? null : (
              <p className="mt-3 text-sm text-unknown">
                The host reported only the target skill, so &ldquo;nothing else
                fired&rdquo; cannot be claimed from this observation.
              </p>
            )}
            {/*
              Gözlem ile beklenti ayrı iki şey: yukarısı ne olduğunu söylüyor,
              bu satır beklenenin olup olmadığını. Kayıtta da öyle duruyor
              (`trigger` ve `triggerCheck`), ekranda da öyle dursun.
            */}
            {attempt.triggerCheck === undefined ? null : (
              <div className="note mt-6">
                <span className="note-mark">
                  <Badge verdict={attempt.triggerCheck.verdict} showLabel={false} />
                </span>
                <div className="note-body">
                  <p className="mark text-text-muted">did that match the case?</p>
                  <p className="note-text">{attempt.triggerCheck.reason}</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <Callout tone="warning" title="Trigger signal unavailable">
            {attempt.trigger.reason}
          </Callout>
        )}
      </section>

      {others.length === 0 ? null : (
        <section className="mb-12">
          <p className="rule-label mb-2">What was checked</p>
          <ul className="ruled">
            {others.map((result, i) => (
              <li
                key={`${result.assertion.type}-${i}`}
                className="grid grid-cols-[1.5rem_1fr] gap-4 py-4"
              >
                <span className="case-mark">
                  <Badge verdict={result.verdict} showLabel={false} size={15} />
                </span>
                <div className="min-w-0">
                  <p className="case-id">{label(result.assertion)}</p>
                  <p className="case-count max-w-[70ch] [overflow-wrap:anywhere]">{result.reason}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-12">
        <p className="rule-label mb-6">What the agent did</p>
        <TraceViewer
          /*
           * Gösterim anında da maskeleniyor. Kayıt yazılırken maskeleme var
           * ama yüklenen eski kayıtlar maskeleme eklenmeden önce yazıldı ve
           * bu sayfa herkese açık bir vaka setinde oturumsuz ziyaretçiye de
           * açılabiliyor. Sızıntının son çıkış kapısı burası.
           */
          steps={redactDeep(attempt.trace ?? []).map((event) => ({
            seq: event.seq,
            kind: event.kind,
            tool: event.tool,
            skill: event.skill,
            text: event.text,
            error: event.error,
            isError: event.isError,
            outcome: event.outcome,
            args: event.args as Record<string, unknown> | undefined,
            refusal: event.refusal,
            // Hook adımında satırın adı kancanın adı: `SessionStart:startup`
            // bir araçtan da bir skill'den de daha çok şey söylüyor.
            hook: event.hook === undefined ? undefined : `${event.hook.name}`,
            ...(event.hook === undefined
              ? {}
              : {
                  text: [
                    event.hook.phase,
                    event.hook.outcome,
                    event.hook.exitCode === undefined
                      ? undefined
                      : `exit ${event.hook.exitCode}`,
                  ]
                    .filter((part) => part !== undefined)
                    .join(' · '),
                }),
          }))}
          {...(swallowed === undefined
            ? {}
            : { swallowed: { verdict: swallowed.verdict, reason: swallowed.reason } })}
        />
      </section>

      <section className="mb-12">
        <p className="rule-label mb-6">What it touched</p>
        <EnvSection attempt={attempt} />
      </section>

      <p>
        <Link href={`/runs/${slug}`} className="link text-sm">
          Back to the scorecard
        </Link>
      </p>
    </Shell>
  )
}

function label(assertion: Attempt['assertions'][number]['assertion']): string {
  return assertion.type === 'trace' ? `trace.${assertion.rule}` : assertion.type
}

function EnvSection({ attempt }: { attempt: Attempt }) {
  const env = attempt.env
  if (env === undefined) {
    return (
      <Callout tone="warning" title="No environment diff was captured">
        Side-effect claims cannot be evaluated for this attempt.
      </Callout>
    )
  }
  const unobserved = env.unobserved ?? []
  return (
    <div className="space-y-6">
      {unobserved.length === 0 ? null : (
        <Callout tone="warning" title="Part of the environment was not observable">
          These calls can reach the file system or the network through a path Assay does
          not read, so the lists below may be incomplete:{' '}
          <span className="font-mono text-xs">{unobserved.join(', ')}</span>
        </Callout>
      )}
      <EnvList label="Writes" items={env.writes} />
      <EnvList label="Deletes" items={env.deletes} />
      <EnvList
        label="Network"
        items={env.network.map(
          (request) =>
            `${request.method ?? 'GET'} ${request.host}${request.blocked ? ' — blocked' : ''}`,
        )}
      />
    </div>
  )
}

function EnvList({ label, items }: { label: string; items: readonly string[] }) {
  return (
    <div>
      <p className="col-label mb-3">{label}</p>
      {items.length === 0 ? (
        <p className="text-sm text-text-faint">nothing observed</p>
      ) : (
        <ul className="ruled font-mono text-xs">
          {items.map((entry) => (
            <li key={entry} className="py-1.5 break-all">
              {entry}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
