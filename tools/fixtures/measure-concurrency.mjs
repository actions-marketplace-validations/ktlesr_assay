/**
 * Paralel koşumun süreye etkisini ÖLÇER.
 *
 *   node tools/fixtures/measure-concurrency.mjs [attempts] [perAttemptMs]
 *
 * Ölçülen şey **Assay'in kendi ölçeklenmesi**: iş listesi, worker açılışı,
 * journal yazımı ve ağaç kapatma. Host tarafı sahte bir adaptörle taklit
 * ediliyor ve her deneme sabit bir süre uyuyor — yani buradaki sayılar host
 * hız sınırı hakkında hiçbir şey söylemiyor. O ayrı ve **paralı** bir ölçüm;
 * gerekçesi docs/measurements.md'de.
 *
 * Varsayılan 240 deneme: 4.2.2 ölçümünün büyüklüğü.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseSuite } from '@ktlsr/assay-core'
import { runSuite } from '@ktlsr/assay-runner'

const attempts = Number(process.argv[2] ?? '240')
const perAttemptMs = Number(process.argv[3] ?? '250')

// 240 deneme = 6 vaka × 40 tekrar.
const cases = [
  'trigger.positive.explicit',
  'trigger.positive.implicit',
  'trigger.negative.near_neighbor.readme',
  'trigger.negative.near_neighbor.notes',
  'trigger.negative.unrelated',
  'trigger.negative.chat',
]
const repeat = Math.max(1, Math.round(attempts / cases.length))

const SUITE = `
version: 1
target: { skill: widget, source: local@abc }
environment: { host: mock, model: test-model-1, system_prompt_hash: sha256:a }
runs: ${repeat}
cases:
${cases
  .map((id) => `  - id: ${id}\n    prompt: p\n    expect: { triggered: ${id.includes('positive')} }`)
  .join('\n')}
`

const parsed = parseSuite(SUITE)
if (!parsed.ok) throw new Error(parsed.issues.map((i) => i.message).join('; '))

const skill = mkdtempSync(join(tmpdir(), 'measure-conc-skill-'))
writeFileSync(join(skill, 'SKILL.md'), '# widget')

/** Sabit süreli sahte host: ölçülen şey runner'ın kendi ek yükü. */
class TimedAdapter {
  id = 'mock'
  async start(config) {
    await new Promise((r) => setTimeout(r, perAttemptMs))
    return { id: `t-${config.caseId}-${config.attempt}`, adapter: 'mock', startedAt: new Date().toISOString() }
  }
  async readTriggerSignal() {
    return {
      available: true,
      triggered: true,
      skills: ['widget'],
      refused: false,
      refusals: [],
      complete: true,
      via: 'mock',
    }
  }
  async readTrace() {
    return [{ seq: 1, kind: 'session_end', outcome: 'completed' }]
  }
  async finalize() {
    return {
      outcome: 'completed',
      finishedAt: new Date().toISOString(),
      latencyMs: perAttemptMs,
      files: [],
      env: { writes: [], deletes: [], network: [], unobserved: [] },
    }
  }
}

const ideal = (repeat * cases.length * perAttemptMs) / 1000
console.log(
  `${repeat * cases.length} deneme, deneme basina ${perAttemptMs} ms host suresi ` +
    `(sirali alt sinir ${ideal.toFixed(1)} sn)\n`,
)

// İzole kol, ürünün varsayılan yolu: deneme başına bir süreç. Aynı sahte host
// süresi, fixture adaptörden.
const isolated = {
  module: new URL('./slow-adapter.mjs', import.meta.url).href,
  export: 'SlowMockAdapter',
}
process.env['ASSAY_TEST_SLOW_MS'] = String(perAttemptMs)
delete process.env['ASSAY_TEST_ORPHAN_PORT']
delete process.env['ASSAY_TEST_PID_FILE']

async function arm(label, concurrency, useIsolation) {
  const store = mkdtempSync(join(tmpdir(), 'measure-conc-'))
  const began = Date.now()
  const record = await runSuite(parsed.suite, new TimedAdapter(), {
    source: SUITE,
    skillPath: skill,
    journalDir: join(store, 'runs'),
    concurrency,
    ...(useIsolation ? { isolate: isolated, attemptTimeoutMs: 120_000 } : {}),
  })
  const seconds = (Date.now() - began) / 1000
  const total = record.cases.reduce((sum, c) => sum + c.attempts.length, 0)
  const unknown = record.cases.reduce((sum, c) => sum + c.unknown, 0)
  rmSync(store, { recursive: true, force: true })
  return { label, concurrency, seconds, total, unknown }
}

const rows = []
for (const concurrency of [1, 2, 4]) rows.push(await arm('surec ici', concurrency, false))
for (const concurrency of [1, 2, 4]) rows.push(await arm('izole', concurrency, true))

console.log('| kol | concurrency | sure | hizlanma | deneme | unknown | deneme basina ek yuk |')
console.log('|---|---|---|---|---|---|---|')
for (const r of rows) {
  const base = rows.find((x) => x.label === r.label && x.concurrency === 1).seconds
  const overhead = ((r.seconds * 1000 * r.concurrency) / r.total - perAttemptMs).toFixed(0)
  console.log(
    `| ${r.label} | ${r.concurrency} | ${r.seconds.toFixed(1)} sn | ${(base / r.seconds).toFixed(2)}x | ` +
      `${r.total} | ${r.unknown} | ~${overhead} ms |`,
  )
}
rmSync(skill, { recursive: true, force: true })
