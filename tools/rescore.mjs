/**
 * Bir koşum kaydını bir suite'e göre yeniden puanlar — koşum yapmadan.
 *
 * Kanıt modeli bunu mümkün kılıyor: kayıt her denemenin tetiklenme gözlemini
 * taşıyor ve aynı kanıt her zaman aynı verdict'i verir (decisions.md,
 * 2026-08-31). Tetiklenme kontrolü BUGÜNKÜ core ile yeniden değerlendirilir,
 * saklı assertion sonuçları olduğu gibi kalır, kayıt runner'ın kendi
 * `assembleRun`'ıyla yeniden kurulur — üretimdeki kodun aynısı.
 *
 * İlk kullanımı 0.4.0-f: marketingskills çakışma koşumunu `expect.winner`lı
 * suite'le yeniden puanlamak ve matrisi elle yazılmış analizciyle
 * karşılaştırmak.
 *
 *   node tools/rescore.mjs <run.json> <suite.yaml> [--json]
 *
 * Önce `pnpm build` ya da `npx tsc -b`: araç derlenmiş paketleri kullanıyor.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  combineVerdicts,
  countVerdicts,
  evaluateTrigger,
  expectedWinnerOf,
  parseSuite,
  summarizeRun,
} from '../packages/core/dist/index.js'
import { assembleRun } from '../packages/runner/dist/index.js'

/** Kaydı suite'e göre yeniden puanlar; saf fonksiyon, testte doğrudan çağrılıyor. */
export function rescore(run, suite) {
  const byId = new Map(suite.cases.map((c) => [c.id, c]))
  const entries = []
  for (const caseResult of run.cases) {
    const testCase = byId.get(caseResult.caseId)
    if (testCase === undefined) {
      throw new Error(`case "${caseResult.caseId}" is in the record but not in the suite`)
    }
    const winner = expectedWinnerOf(testCase.expect)
    for (const attempt of caseResult.attempts) {
      const triggerCheck = evaluateTrigger(attempt.trigger, {
        triggered: testCase.expect.triggered,
        notTriggered: testCase.expect.not_triggered,
        winner,
      })
      const parts = [...(triggerCheck === null ? [] : [triggerCheck]), ...attempt.assertions]
      const combined = combineVerdicts(parts, 'check')
      // Eski tetiklenme kontrolü atılıyor; yenisi yukarıda hesaplandı.
      const rest = { ...attempt }
      delete rest.triggerCheck
      entries.push({
        caseId: caseResult.caseId,
        ...(testCase.expect.triggered === undefined ? {} : { expectedTrigger: testCase.expect.triggered }),
        ...(winner === undefined ? {} : { expectedWinner: winner }),
        attempt: {
          ...rest,
          ...(triggerCheck === null ? {} : { triggerCheck }),
          verdict: combined.verdict,
          reason: combined.reason,
        },
      })
    }
  }
  return assembleRun({
    id: run.id,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    host: run.host,
    skill: run.skill,
    runs: run.runs,
    pins: run.pins,
    attempts: entries,
    ...(run.concurrency === undefined ? {} : { concurrency: run.concurrency }),
    ...(run.layers === undefined ? {} : { layers: run.layers }),
    ...(run.skipped === undefined ? {} : { skipped: run.skipped }),
    ...(run.partial === undefined ? {} : { partial: run.partial }),
    ...(run.assayVersion === undefined ? {} : { assayVersion: run.assayVersion }),
  })
}

const verdictsOf = (run) => countVerdicts(run.cases.flatMap((c) => c.attempts.map((a) => a.verdict)))

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [recordPath, suitePath, flag] = process.argv.slice(2)
  if (recordPath === undefined || suitePath === undefined) {
    console.error('usage: node tools/rescore.mjs <run.json> <suite.yaml> [--json]')
    process.exit(2)
  }
  const { run } = JSON.parse(readFileSync(recordPath, 'utf8'))
  const parsed = parseSuite(readFileSync(suitePath, 'utf8'))
  if (!parsed.ok) {
    console.error(parsed.issues.map((i) => `${i.path}: ${i.message}`).join('\n'))
    process.exit(2)
  }
  const rescored = rescore(run, parsed.suite)
  const summary = summarizeRun(rescored)
  const result = {
    run: run.id,
    before: { verdict: run.verdict, counts: verdictsOf(run) },
    after: { verdict: rescored.verdict, counts: verdictsOf(rescored) },
    cases: rescored.cases.map((c) => ({ caseId: c.caseId, passed: c.passed, failed: c.failed, unknown: c.unknown })),
    collision: summary.collision ?? null,
  }
  if (flag === '--json') {
    console.log(JSON.stringify(result, null, 2))
  } else {
    const { renderCollision } = await import('../packages/cli/dist/terminal.js')
    console.log(`run ${run.id}`)
    console.log(`before  ${run.verdict}  ${JSON.stringify(result.before.counts)}`)
    console.log(`after   ${rescored.verdict}  ${JSON.stringify(result.after.counts)}`)
    if (summary.collision !== undefined) console.log(renderCollision(summary.collision).join('\n'))
  }
}
