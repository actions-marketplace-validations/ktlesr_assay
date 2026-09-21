/**
 * Ölçüm kolu — `measure-isolation.mjs` bunu iki kez, iki modda başlatır.
 *
 *   node tools/fixtures/isolation-arm.mjs <inproc|isolated> <store> <skill> <pidFile> <port>
 *
 * İki kol da aynı suite'i koşar ve aynı şeyi ölçer; tek fark denemenin nerede
 * koştuğu. Sürücü, ajanın yaptığını yapar: PID'i bulur ve öldürür.
 *   - `inproc`  : öldürülecek PID bu sürecin kendisi (deneme = koşum)
 *   - `isolated`: öldürülecek PID worker'ın (deneme ≠ koşum)
 */
import { writeFileSync } from 'node:fs'
import { parseSuite } from '@ktlsr/assay-core'
import { runSuite } from '@ktlsr/assay-runner'
import { MockAdapter } from '@ktlsr/assay-runner/testing'

const [mode, store, skill, pidFile, port] = process.argv.slice(2)

const SUITE = `
version: 1
target: { skill: widget, source: local@abc }
environment: { host: mock, model: test-model-1, system_prompt_hash: sha256:a }
runs: 4
cases:
  - id: trigger.positive.explicit
    prompt: Turn this into a widget.
    expect: { triggered: true }
  - id: trigger.negative.near_neighbor.readme
    prompt: Turn this into a README.
    expect: { triggered: false }
`

const parsed = parseSuite(SUITE)
if (!parsed.ok) throw new Error(parsed.issues.map((i) => i.message).join('; '))

const fixture = new URL('./slow-adapter.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

process.env['ASSAY_TEST_SLOW_MS'] = '1200'
process.env['ASSAY_TEST_ORPHAN_PORT'] = port
if (mode === 'isolated') {
  // Worker kendi PID'ini yazacak; sürücü onu öldürecek.
  process.env['ASSAY_TEST_PID_FILE'] = pidFile
} else {
  // Süreç içi kolda öldürülecek olan bu süreç: deneme koşumun kendisi.
  writeFileSync(pidFile, String(process.pid), 'utf8')
  delete process.env['ASSAY_TEST_PID_FILE']
}

const { SlowMockAdapter } = await import(new URL('./slow-adapter.mjs', import.meta.url).href)

const record = await runSuite(
  parsed.suite,
  mode === 'isolated' ? new MockAdapter({ scenarios: [{}] }) : new SlowMockAdapter(),
  {
    source: SUITE,
    skillPath: skill,
    journalDir: `${store}/runs`,
    repeat: 2,
    attemptTimeoutMs: 20_000,
    onProgress: (event) => process.stdout.write(`attempt ${event.caseId} ${event.verdict}\n`),
    ...(mode === 'isolated'
      ? { isolate: { module: fixture, export: 'SlowMockAdapter' } }
      : {}),
  },
)

const attempts = record.cases.flatMap((c) => c.attempts)
process.stdout.write(
  `result attempts=${attempts.length} unknown=${attempts.filter((a) => a.verdict === 'unknown').length}\n`,
)
