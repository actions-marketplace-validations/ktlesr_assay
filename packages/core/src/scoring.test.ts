import { describe, expect, it } from 'vitest'
import { proportion, type Attempt, type CaseResult, type Run } from './records.js'
import {
  collisionMatrix,
  collisionPrefix,
  countVerdicts,
  outsidePrefix,
  decidedRate,
  flakiness,
  summarize,
  summarizeRun,
  totals,
  triggerAccuracy,
} from './scoring.js'

describe('countVerdicts', () => {
  it('üç durumu ayrı sayar', () => {
    expect(countVerdicts(['pass', 'pass', 'fail', 'unknown'])).toEqual({
      pass: 2,
      fail: 1,
      unknown: 1,
      total: 4,
    })
  })
})

describe('decidedRate — unknown paydadan çıkar', () => {
  it('8 pass, 2 fail, 5 unknown → N=10', () => {
    const rate = decidedRate({ pass: 8, fail: 2, unknown: 5, total: 15 })
    expect(rate.n).toBe(10)
    expect(rate.rate).toBeCloseTo(0.8, 10)
  })

  it('hepsi unknown ise oran null — %0 ile karışmaz', () => {
    const rate = decidedRate({ pass: 0, fail: 0, unknown: 7, total: 7 })
    expect(rate.n).toBe(0)
    expect(rate.rate).toBeNull()
    expect(rate.ci).toBeNull()
  })

  it('hiç unknown yokken oran tüm gözlemleri kapsar', () => {
    expect(decidedRate({ pass: 3, fail: 1, unknown: 0, total: 4 }).n).toBe(4)
  })
})

describe('triggerAccuracy', () => {
  const point = (expected: boolean, observed: boolean | null) => ({ expected, observed })

  it('mükemmel ayrım: precision ve recall 1', () => {
    const accuracy = triggerAccuracy([
      point(true, true),
      point(true, true),
      point(false, false),
      point(false, false),
    ])
    expect(accuracy).toMatchObject({ truePositive: 2, trueNegative: 2, falsePositive: 0 })
    expect(accuracy.precision.rate).toBe(1)
    expect(accuracy.recall.rate).toBe(1)
    expect(accuracy.f1).toBe(1)
  })

  it('her istekte tetiklenen skill: recall 1 ama precision düşük', () => {
    // Değişmez #5'in ölçüsü. Negatif vaka olmasa bu skill mükemmel görünürdü.
    const accuracy = triggerAccuracy([
      point(true, true),
      point(false, true),
      point(false, true),
    ])
    expect(accuracy.recall.rate).toBe(1)
    expect(accuracy.precision.rate).toBeCloseTo(1 / 3, 10)
    expect(accuracy.f1).toBeCloseTo(0.5, 10)
  })

  it('hiç tetiklenmeyen skill: precision ölçülemez, recall 0', () => {
    const accuracy = triggerAccuracy([point(true, false), point(false, false)])
    expect(accuracy.precision.rate).toBeNull() // TP+FP = 0
    expect(accuracy.recall.rate).toBe(0)
    expect(accuracy.f1).toBeNull()
  })

  it('okunamayan gözlemler matrise girmez, ayrıca sayılır', () => {
    const accuracy = triggerAccuracy([
      point(true, true),
      point(true, null),
      point(false, null),
    ])
    expect(accuracy.unknown).toBe(2)
    expect(accuracy.truePositive).toBe(1)
    expect(accuracy.precision.n).toBe(1)
  })

  it('hiç gözlem yoksa oranlar null, sıfır değil', () => {
    const accuracy = triggerAccuracy([])
    expect(accuracy.precision.rate).toBeNull()
    expect(accuracy.recall.rate).toBeNull()
    expect(accuracy.f1).toBeNull()
  })

  it('oranlar her zaman N ve aralık taşır', () => {
    const accuracy = triggerAccuracy([point(true, true), point(false, true)])
    expect(accuracy.precision.n).toBe(2)
    expect(accuracy.precision.ci).not.toBeNull()
  })
})

describe('flakiness', () => {
  it('hem pass hem fail görülmüşse kararsız', () => {
    expect(flakiness({ pass: 6, fail: 4, unknown: 0, total: 10 })).toMatchObject({
      flaky: true,
      measured: true,
    })
  })

  it('hepsi aynıysa kararlı', () => {
    expect(flakiness({ pass: 10, fail: 0, unknown: 0, total: 10 }).flaky).toBe(false)
  })

  it('tek kesin gözlemle kararsızlık ölçülemez — N=1 gözlemdir, ölçüm değil', () => {
    const result = flakiness({ pass: 1, fail: 0, unknown: 4, total: 5 })
    expect(result.flaky).toBeNull()
    expect(result.measured).toBe(false)
  })
})

describe('totals', () => {
  const attempt = (overrides: Partial<Attempt>): Attempt => ({
    index: 0,
    caseId: 'c',
    startedAt: '',
    finishedAt: '',
    trigger: { available: false, reason: 'x' },
    assertions: [],
    verdict: 'unknown',
    reason: '',
    ...overrides,
  })

  it('token, süre ve araç çağrısı toplanır', () => {
    const result = totals([
      attempt({
        cost: { inputTokens: 10, outputTokens: 5, usd: 0.01 },
        latencyMs: 100,
        trace: [
          { seq: 1, kind: 'tool_call', tool: 'Write' },
          { seq: 2, kind: 'tool_result', tool: 'Write' },
        ],
      }),
      attempt({ cost: { inputTokens: 20, outputTokens: 7, usd: 0.02 }, latencyMs: 200 }),
    ])
    expect(result).toMatchObject({
      attempts: 2,
      inputTokens: 30,
      outputTokens: 12,
      durationMs: 300,
      toolCalls: 1,
    })
    expect(result.usd).toBeCloseTo(0.03, 10)
  })

  it('host maliyet vermediyse usd null — sıfır değil', () => {
    const result = totals([attempt({ cost: { inputTokens: 1, outputTokens: 1 } })])
    expect(result.usd).toBeNull()
  })

  it('boş liste sıfırlarla döner', () => {
    expect(totals([])).toMatchObject({ attempts: 0, inputTokens: 0, usd: null })
  })
})

describe('summarize', () => {
  const attempt = (
    caseId: string,
    verdict: Attempt['verdict'],
    triggered: boolean | null,
  ): Attempt => ({
    index: 0,
    caseId,
    startedAt: '',
    finishedAt: '',
    trigger:
      triggered === null
        ? { available: false, reason: 'unreadable' }
        : {
            available: true,
            triggered,
            skills: [],
            refused: false,
            refusals: [],
            complete: true,
            via: 'test',
          },
    assertions: [],
    verdict,
    reason: '',
  })

  const expected = (caseId: string) =>
    caseId.startsWith('trigger.positive')
      ? true
      : caseId.startsWith('trigger.negative')
        ? false
        : undefined

  it('koşum verdicti fail > unknown > pass önceliğinde', () => {
    expect(
      summarize([attempt('a', 'pass', true), attempt('b', 'unknown', null)], expected)
        .verdict,
    ).toBe('unknown')
    expect(
      summarize([attempt('a', 'pass', true), attempt('b', 'fail', false)], expected)
        .verdict,
    ).toBe('fail')
    expect(summarize([attempt('a', 'pass', true)], expected).verdict).toBe('pass')
  })

  it('tetiklenme iddiası olmayan vaka doğruluk matrisine girmez', () => {
    const summary = summarize(
      [
        attempt('complete.creates_file', 'pass', true),
        attempt('trigger.positive.x', 'pass', true),
      ],
      expected,
    )
    expect(summary.trigger.truePositive).toBe(1)
  })

  it('okunamayan tetiklenme unknown olarak sayılır', () => {
    const summary = summarize([attempt('trigger.positive.x', 'unknown', null)], expected)
    expect(summary.trigger.unknown).toBe(1)
    expect(summary.trigger.precision.rate).toBeNull()
  })

  it('passRate unknown"ları paydadan çıkarır', () => {
    const summary = summarize(
      [
        attempt('trigger.positive.x', 'pass', true),
        attempt('trigger.positive.x', 'fail', false),
        attempt('trigger.positive.x', 'unknown', null),
      ],
      expected,
    )
    expect(summary.passRate.n).toBe(2)
    expect(summary.counts.unknown).toBe(1)
  })
  // --- ayrım gücü notu ---------------------------------------------------
  //
  // docs/measurements.md: aynı skill, aynı model ve aynı pinlerle iki set
  // %100 ve %51 precision verdi. Fark yalnızca negatiflerin kurulumundaydı.
  // `untested` o durumu görünür kılıyor; verdict'i DEĞİŞTİRMİYOR.

  it('hiçbir negatif kırılmadıysa ayrım gücü ölçülmemiş sayılır', () => {
    const summary = summarize(
      [
        attempt('trigger.positive.x', 'pass', true),
        attempt('trigger.negative.a', 'pass', false),
        attempt('trigger.negative.b', 'pass', false),
        attempt('trigger.negative.b', 'pass', false),
      ],
      expected,
    )
    expect(summary.discrimination).toEqual({
      cases: 2,
      attempts: 3,
      falsePositives: 0,
      untested: true,
    })
  })

  it('bir negatif sızdıysa ayrım gücü ölçülmüş sayılır', () => {
    const summary = summarize(
      [
        attempt('trigger.negative.a', 'pass', false),
        attempt('trigger.negative.a', 'fail', true),
      ],
      expected,
    )
    expect(summary.discrimination.falsePositives).toBe(1)
    expect(summary.discrimination.untested).toBe(false)
  })

  it('not verdicti değiştirmez', () => {
    // Pozitif kaçtı, negatiflerin hepsi tuttu: verdict fail, not yine de var.
    const summary = summarize(
      [
        attempt('trigger.positive.x', 'fail', false),
        attempt('trigger.negative.a', 'pass', false),
      ],
      expected,
    )
    expect(summary.verdict).toBe('fail')
    expect(summary.discrimination.untested).toBe(true)
  })

  it('negatif yoksa not çıkmaz', () => {
    const summary = summarize([attempt('trigger.positive.x', 'pass', true)], expected)
    expect(summary.discrimination.cases).toBe(0)
    expect(summary.discrimination.untested).toBe(false)
  })

  it('ölçülemeyen negatif ayrım gücü saymaz', () => {
    // Tek negatif okunamadıysa "hiçbiri kırılmadı" demek yanlış olur.
    const summary = summarize(
      [
        attempt('trigger.positive.x', 'pass', true),
        attempt('trigger.negative.a', 'unknown', null),
      ],
      expected,
    )
    expect(summary.discrimination.attempts).toBe(0)
    expect(summary.discrimination.untested).toBe(false)
  })
})

/**
 * 0.2.0 — reddedilen aktivasyon doğruluk matrisine girmez.
 *
 * Impeccable pilotunda dört kayıtlı tetiklenmenin dördü de reddedilmiş
 * aktivasyondu; hiçbiri koşmamıştı. Rapor precision %100 dedi çünkü
 * `trigger.triggered` `true` idi. Sayı gerçek bir ölçümden gelmiyordu.
 */
describe('summarize — reddedilen aktivasyon ölçüm sayılmaz', () => {
  const expected = (caseId: string) =>
    caseId.startsWith('trigger.positive')
      ? true
      : caseId.startsWith('trigger.negative')
        ? false
        : undefined

  const attempt = (
    caseId: string,
    verdict: Attempt['verdict'],
    triggered: boolean | null,
  ): Attempt => ({
    index: 0,
    caseId,
    startedAt: '',
    finishedAt: '',
    trigger:
      triggered === null
        ? { available: false, reason: 'unreadable' }
        : {
            available: true,
            triggered,
            skills: [],
            refused: false,
            refusals: [],
            complete: true,
            via: 'test',
          },
    assertions: [],
    verdict,
    reason: '',
  })

  const refused = (caseId: string): Attempt => ({
    index: 0,
    caseId,
    startedAt: '',
    finishedAt: '',
    trigger: {
      available: true,
      triggered: false,
      skills: [],
      refused: true,
      refusals: [{ skill: 'docx', reason: 'the host denied permission' }],
      complete: true,
      via: 'test',
    },
    assertions: [],
    verdict: 'unknown',
    reason: '',
  })

  it('reddedilen pozitifler precision üretmez — N=0', () => {
    const summary = summarize(
      [
        refused('trigger.positive.a'),
        refused('trigger.positive.b'),
        refused('trigger.positive.c'),
        refused('trigger.positive.d'),
      ],
      expected,
    )
    expect(summary.trigger.truePositive).toBe(0)
    expect(summary.trigger.unknown).toBe(4)
    expect(summary.trigger.precision.n).toBe(0)
    expect(summary.trigger.precision.rate).toBeNull()
  })

  it('reddedilen negatif "tetiklenmedi" sayılmaz', () => {
    const summary = summarize([refused('trigger.negative.a')], expected)
    expect(summary.trigger.trueNegative).toBe(0)
    expect(summary.trigger.unknown).toBe(1)
  })

  it('reddedilen negatif ayrım gücü ölçüsüne de girmez', () => {
    const summary = summarize(
      [attempt('trigger.positive.a', 'pass', true), refused('trigger.negative.b')],
      expected,
    )
    expect(summary.discrimination.attempts).toBe(0)
    expect(summary.discrimination.untested).toBe(false)
  })

  it('gerçekten aktive olan tetiklenme hâlâ ölçülür', () => {
    const summary = summarize(
      [attempt('trigger.positive.a', 'pass', true), refused('trigger.positive.b')],
      expected,
    )
    expect(summary.trigger.truePositive).toBe(1)
    expect(summary.trigger.precision.n).toBe(1)
  })
})

/**
 * 0.4.0 — çakışma matrisi.
 *
 * Satır beklenen kazanan, sütun ilk tetiklenen; ölçülemeyen deneme matrise
 * girmez. Buradaki koşum elle kurulmuş bir kayıt: matrisin yalnızca kayıttan
 * kurulabildiği iddiası tam olarak bu.
 */
describe('collisionMatrix (0.4.0)', () => {
  const attempt = (
    skills: string[],
    opts: { available?: boolean; complete?: boolean; checkUnknown?: boolean } = {},
  ): Attempt => ({
    index: 0,
    caseId: 'c',
    startedAt: '2026-09-10T00:00:00.000Z',
    finishedAt: '2026-09-10T00:00:01.000Z',
    trigger:
      opts.available === false
        ? { available: false, reason: 'unreadable' }
        : {
            available: true,
            triggered: false,
            skills,
            refused: false,
            refusals: [],
            complete: opts.complete ?? true,
            via: 'test',
          },
    ...(opts.checkUnknown === true ? { triggerCheck: { verdict: 'unknown' as const, reason: 'refused' } } : {}),
    assertions: [],
    verdict: 'pass',
    reason: 'test',
    latencyMs: 1,
  })
  const caseOf = (caseId: string, attempts: Attempt[], expectedWinner?: string[]): CaseResult => ({
    caseId,
    ...(expectedWinner === undefined ? {} : { expectedWinner }),
    attempts,
    passRate: proportion(0, 0),
    passed: 0,
    failed: 0,
    unknown: 0,
  })
  const runOf = (cases: CaseResult[]): Run => ({
    id: 'r',
    startedAt: '2026-09-10T00:00:00.000Z',
    finishedAt: '2026-09-10T00:01:00.000Z',
    host: 'test',
    skill: 'p:target',
    pins: { skillSource: 's', skillHash: 'h', model: 'm', systemPromptHash: 'x', suiteVersion: 1, suiteHash: 'q' },
    runs: 3,
    cases,
    verdict: 'fail',
  })

  it('kazanan beklemeyen koşumda matris yok', () => {
    const run = runOf([caseOf('trigger.positive.a', [attempt(['p:target'])])])
    expect(collisionMatrix(run)).toBeUndefined()
    expect(summarizeRun(run).collision).toBeUndefined()
  })

  it('satirlar beklenen, sutunlar ilk tetiklenen; ayni kazanani bekleyen vakalar birlesir', () => {
    const run = runOf([
      caseOf('collide.cro.a', [attempt(['p:cro']), attempt([]), attempt(['p:signup', 'p:cro'])], ['p:cro']),
      caseOf('collide.cro.b', [attempt(['p:cro'])], ['p:cro']),
      caseOf('collide.signup.a', [attempt([]), attempt([])], ['p:signup']),
      caseOf('negative.x', [attempt([]), attempt(['p:pricing'])], []),
    ])
    const matrix = collisionMatrix(run)
    // Sütun sırası: none, köşegen (satır sırasıyla), sonra beklenmeyen gözlenen.
    expect(matrix?.columns).toEqual(['none', 'p:cro', 'p:signup', 'p:pricing'])
    expect(matrix?.rows.map((r) => [r.expected, r.cases, r.cells])).toEqual([
      [['p:cro'], 2, { 'p:cro': 2, none: 1, 'p:signup': 1 }],
      [['p:signup'], 1, { none: 2 }],
      [[], 1, { none: 1, 'p:pricing': 1 }],
    ])
    // Kazanmak = ilk olmak; signup'tan sonra gelen cro kazanmadı, "also fired".
    expect(matrix?.rows[0]?.won.successes).toBe(2)
    expect(matrix?.rows[0]?.won.n).toBe(4)
    expect(matrix?.rows[0]?.alsoFired).toBe(1)
    // none satırı: hiçbir şey tetiklenmediğinde kazandı.
    expect(matrix?.rows[2]?.won.successes).toBe(1)
    // Değişmez #4: oran N ve aralıkla.
    expect(matrix?.rows[1]?.won).toMatchObject({ successes: 0, n: 2 })
    expect(matrix?.rows[1]?.won.ci).not.toBeNull()
    expect(summarizeRun(run).collision).toEqual(matrix)
  })

  it('olculemeyen deneme matrise girmez, ayri sayilir — none sutununa dusmez', () => {
    const run = runOf([
      caseOf(
        'collide.cro.a',
        [
          attempt(['p:cro']),
          attempt([], { available: false }),
          attempt([], { complete: false }),
          attempt([], { checkUnknown: true }),
        ],
        ['p:cro'],
      ),
    ])
    const matrix = collisionMatrix(run)
    expect(matrix?.rows[0]?.cells).toEqual({ 'p:cro': 1 })
    expect(matrix?.rows[0]?.unmeasured).toBe(3)
    expect(matrix?.unmeasured).toBe(3)
    expect(matrix?.rows[0]?.won.n).toBe(1)
  })

  it('collisionPrefix: ortak plugin oneki; biri oneksizse yok', () => {
    const matrix = collisionMatrix(
      runOf([caseOf('c.a', [attempt(['p:cro'])], ['p:cro']), caseOf('c.b', [attempt([])], ['p:signup'])]),
    )
    expect(matrix === undefined ? '' : collisionPrefix(matrix)).toBe('p:')
    // Öneki atmak `p:cro` ile öneksiz `cro`yu çakıştırırdı: önek atılmaz.
    const clash = collisionMatrix(runOf([caseOf('c.a', [attempt(['cro'])], ['p:cro'])]))
    expect(clash === undefined ? 'x' : collisionPrefix(clash)).toBe('')
    // Öneksiz ama çakışmayan bir ad (host'la gelen `run`) öneki engellemez,
    // ve ayrıca söylenir. Gerçek kayıtta ilk hâli 300 karakterlik satır üretti.
    const host = collisionMatrix(runOf([caseOf('c.a', [attempt(['run'])], ['p:cro'])]))
    expect(host === undefined ? '' : collisionPrefix(host)).toBe('p:')
    expect(host === undefined ? [] : outsidePrefix(host, 'p:')).toEqual(['run'])
  })
})
