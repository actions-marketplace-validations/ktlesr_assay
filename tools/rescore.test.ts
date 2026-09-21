/**
 * tools/rescore.mjs — 0.4.0-f'nin kanıtını üreten araç.
 *
 * Araç yanlış çalışırsa marketingskills karşılaştırmasının tamamı boşa düşer:
 * burada küçük, elle kurulmuş bir kayıtla davranışı sabitleniyor. Gerçek kayıt
 * ölçüm deposunda; bu depoda yok.
 */

import { parseSuite, type Attempt, type Run } from '@ktlsr/assay-core'
import { describe, expect, it } from 'vitest'
// @ts-expect-error — .mjs araç, tip bildirimi yok
import { rescore } from './rescore.mjs'

const SUITE = `
version: 1
target: { skill: p:target, source: o/r@1 }
environment: { host: h, model: m, system_prompt_hash: x, active_skills: [p:target, p:x] }
runs: 2
cases:
  - id: collide.x.a
    prompt: p
    expect: { winner: p:x }
  - id: negative.b
    prompt: p
    expect: { winner: none }
`

const attempt = (index: number, skills: string[], assertionVerdict?: 'pass' | 'fail'): Attempt => ({
  index,
  caseId: 'collide.x.a',
  startedAt: '2026-09-10T00:00:00.000Z',
  finishedAt: '2026-09-10T00:00:01.000Z',
  trigger: { available: true, triggered: false, skills, refused: false, refusals: [], complete: true, via: 't' },
  assertions:
    assertionVerdict === undefined
      ? []
      : [{ assertion: { type: 'file_exists', path: 'a' }, verdict: assertionVerdict, reason: 'stored' }],
  // Eski şemayla (yalnız not_triggered) hepsi `pass` puanlanmıştı.
  verdict: 'pass',
  reason: 'old',
  latencyMs: 1,
})

const record = (attempts: Attempt[]): Run => ({
  id: 'run-x',
  startedAt: '2026-09-10T00:00:00.000Z',
  finishedAt: '2026-09-10T00:01:00.000Z',
  host: 'h',
  skill: 'p:target',
  pins: { skillSource: 's', skillHash: 'h', model: 'm', systemPromptHash: 'x', suiteVersion: 1, suiteHash: 'q' },
  runs: 2,
  cases: [{ caseId: 'collide.x.a', attempts, passRate: { successes: 0, n: 0, rate: null, ci: null }, passed: 0, failed: 0, unknown: 0 }],
  verdict: 'pass',
})

const suite = () => {
  const parsed = parseSuite(SUITE)
  if (!parsed.ok) throw new Error('fixture')
  return parsed.suite
}

describe('rescore', () => {
  it('hicbir sey tetiklenmeyen deneme yeni semayla fail, dogru kazanan pass', () => {
    const out = rescore(record([attempt(0, []), attempt(1, ['p:x'])]), suite()) as Run
    expect(out.cases[0]?.attempts.map((a) => a.verdict)).toEqual(['fail', 'pass'])
    expect(out.cases[0]?.expectedWinner).toEqual(['p:x'])
    expect(out.cases[0]?.attempts[0]?.triggerCheck?.reason).toContain('no skill triggered')
  })

  it('sakli assertion sonuclari korunuyor: kazanan dogru ama assertion dusmusse fail', () => {
    const out = rescore(record([attempt(0, ['p:x'], 'fail')]), suite()) as Run
    expect(out.cases[0]?.attempts[0]?.verdict).toBe('fail')
  })

  it('kayittaki vaka suitete yoksa sessizce atlamiyor, reddediyor', () => {
    const bad = record([attempt(0, [])])
    const renamed = { ...bad, cases: bad.cases.map((c) => ({ ...c, caseId: 'collide.missing.z' })) }
    expect(() => rescore(renamed, suite())).toThrow('is in the record but not in the suite')
  })
})
