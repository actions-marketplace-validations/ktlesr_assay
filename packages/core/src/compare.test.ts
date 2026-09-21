import { describe, expect, it } from 'vitest'
import { compareRuns } from './compare.js'
import { proportion, type Pins, type Run } from './records.js'

const pins: Pins = {
  skillSource: 'owner/repo@abc',
  skillHash: 'sha256:skill1',
  model: 'model-1',
  systemPromptHash: 'sha256:sp',
  suiteVersion: 1,
  suiteHash: 'sha256:suite1',
}

const run = (
  cases: ReadonlyArray<[string, number, number]>,
  overrides: Partial<Pins> = {},
): Run => ({
  id: 'r',
  startedAt: '',
  finishedAt: '',
  host: 'mock',
  skill: 'widget',
  pins: { ...pins, ...overrides },
  runs: 10,
  cases: cases.map(([caseId, passed, failed]) => ({
    caseId,
    attempts: [],
    passRate: proportion(passed, passed + failed),
    passed,
    failed,
    unknown: 0,
  })),
  verdict: 'pass',
})

describe('compareRuns — dört pin', () => {
  it.each([
    ['skillSource', { skillSource: 'owner/repo@def' }],
    ['skillHash', { skillHash: 'sha256:skill2' }],
    ['model', { model: 'model-2' }],
    ['systemPromptHash', { systemPromptHash: 'sha256:other' }],
    ['suiteVersion', { suiteVersion: 2 }],
    ['suiteHash', { suiteHash: 'sha256:suite2' }],
  ])('%s kayarsa karşılaştırma yapılmaz', (name, drift) => {
    const comparison = compareRuns(run([['a', 10, 0]]), run([['a', 0, 10]], drift))
    expect(comparison.comparable).toBe(false)
    expect(comparison.verdict).toBe('unknown')
    expect(comparison.drifted).toContain(name)
    expect(comparison.cases).toEqual([])
  })

  it('pin kayması regresyonu gizler — bu kasıtlı', () => {
    // %100'den %0'a düşüş var ama model değişmiş; bu regresyon değil, gürültü.
    const comparison = compareRuns(
      run([['a', 10, 0]]),
      run([['a', 0, 10]], { model: 'model-2' }),
    )
    expect(comparison.verdict).not.toBe('fail')
    expect(comparison.reason).toContain('model')
  })
})

describe('compareRuns — regresyon tespiti', () => {
  it('aralıklar ayrık ve düşüş varsa regresyon', () => {
    const comparison = compareRuns(run([['a', 20, 0]]), run([['a', 0, 20]]))
    expect(comparison.cases[0]?.status).toBe('regressed')
    expect(comparison.verdict).toBe('fail')
  })

  it('aralıklar ayrık ve yükseliş varsa iyileşme', () => {
    const comparison = compareRuns(run([['a', 0, 20]]), run([['a', 20, 0]]))
    expect(comparison.cases[0]?.status).toBe('improved')
    expect(comparison.verdict).toBe('pass')
  })

  it('aralıklar kesişiyorsa gürültü — küçük N ile regresyon iddia edilmez', () => {
    const comparison = compareRuns(run([['a', 3, 0]]), run([['a', 0, 3]]))
    expect(comparison.cases[0]?.status).toBe('within_noise')
    expect(comparison.verdict).toBe('pass')
    expect(comparison.cases[0]?.reason).toContain('noise')
  })

  it('değişiklik yoksa unchanged', () => {
    const comparison = compareRuns(run([['a', 10, 0]]), run([['a', 10, 0]]))
    expect(comparison.cases[0]?.reason).toBe('unchanged')
    expect(comparison.cases[0]?.delta).toBe(0)
  })

  it('yeni vaka karşılaştırılamaz', () => {
    const comparison = compareRuns(
      run([['a', 10, 0]]),
      run([
        ['a', 10, 0],
        ['b', 10, 0],
      ]),
    )
    const added = comparison.cases.find((c) => c.caseId === 'b')
    expect(added?.status).toBe('unknown')
    expect(added?.reason).toContain('new')
    expect(comparison.verdict).toBe('unknown')
  })

  it('kaybolan vaka karşılaştırılamaz', () => {
    const comparison = compareRuns(
      run([
        ['a', 10, 0],
        ['b', 10, 0],
      ]),
      run([['a', 10, 0]]),
    )
    expect(comparison.cases.find((c) => c.caseId === 'b')?.reason).toContain('gone')
  })

  it('bir tarafta kesin gözlem yoksa unknown', () => {
    const comparison = compareRuns(run([['a', 10, 0]]), run([['a', 0, 0]]))
    expect(comparison.cases[0]?.status).toBe('unknown')
    expect(comparison.cases[0]?.reason).toContain('no decided attempts')
  })

  it('regresyon varsa gerekçe vakayı adlandırır', () => {
    const comparison = compareRuns(
      run([
        ['a', 20, 0],
        ['b', 20, 0],
      ]),
      run([
        ['a', 0, 20],
        ['b', 20, 0],
      ]),
    )
    expect(comparison.reason).toContain('a')
    expect(comparison.verdict).toBe('fail')
  })
})

/**
 * 0.3.0-a — gerekçe doğru adresi göstersin.
 *
 * Gerçek koşumda görülen kusur: çapraz izin modu karşılaştırması doğru şekilde
 * reddedildi (exit 3) ama "systemPromptHash changed" dedi. O alan iki kayıtta
 * da `not-provided-by-host` idi; kayan şey `environmentHash` ve içinde
 * `permissionMode` idi.
 */
describe('compareRuns — kayan alanın adı', () => {
  const blind: Pins = { ...pins, systemPromptHash: 'not-provided-by-host' }

  const withEnvironment = (
    hash: string,
    permissionMode: string,
    cases: ReadonlyArray<[string, number, number]> = [['a', 10, 0]],
  ): Run => ({
    ...run(cases, { ...blind, environmentHash: hash }),
    environment: {
      model: 'claude-haiku-4-5-20251001',
      version: '2.1.263',
      permissionMode,
      tools: ['Bash', 'Read', 'Write'],
      skills: ['impeccable'],
      agents: [],
      plugins: ['impeccable@4.2.2'],
    },
  })

  it('ortam kayınca gerekçe systemPromptHash i suçlamaz', () => {
    const comparison = compareRuns(
      withEnvironment('sha256:env-a', 'acceptEdits'),
      withEnvironment('sha256:env-b', 'bypassPermissions'),
    )
    expect(comparison.comparable).toBe(false)
    expect(comparison.reason).not.toContain('systemPromptHash')
    expect(comparison.reason).toContain('environmentHash')
  })

  it('hash in icinde kayan alani adiyla soyler', () => {
    const comparison = compareRuns(
      withEnvironment('sha256:env-a', 'acceptEdits'),
      withEnvironment('sha256:env-b', 'bypassPermissions'),
    )
    expect(comparison.environmentChanges).toEqual([
      { field: 'permissionMode', before: 'acceptEdits', after: 'bypassPermissions' },
    ])
    expect(comparison.reason).toContain('permissionMode: acceptEdits → bypassPermissions')
  })

  /**
   * 0.3.0-a öncesi kayıtlarda ortam bileşenleri yok. O zaman hash düzeyinde
   * konuşulur — uydurulmaz, susulur.
   */
  it('bir tarafta ortam kaydi yoksa hash duzeyinde konusur', () => {
    const before = run([['a', 10, 0]], { ...blind, environmentHash: 'sha256:env-a' })
    const comparison = compareRuns(before, withEnvironment('sha256:env-b', 'acceptEdits'))
    expect(comparison.comparable).toBe(false)
    expect(comparison.environmentChanges).toEqual([])
    expect(comparison.reason).toContain('environmentHash changed between them')
    expect(comparison.reason).not.toContain('permissionMode')
  })

  it('liste alanlari eklenen ve cikarilan olarak yazilir', () => {
    const a = withEnvironment('sha256:env-a', 'acceptEdits')
    const b = withEnvironment('sha256:env-b', 'acceptEdits')
    const comparison = compareRuns(a, {
      ...b,
      environment: { ...b.environment!, skills: ['impeccable', 'pdf'] },
    })
    expect(comparison.environmentChanges).toEqual([
      { field: 'skills', before: '1 entry', after: '+pdf' },
    ])
  })

  it('ortam esitse karsilastirma acilir ve degisiklik listesi bos', () => {
    const comparison = compareRuns(
      withEnvironment('sha256:env-a', 'acceptEdits'),
      withEnvironment('sha256:env-a', 'acceptEdits', [['a', 9, 1]]),
    )
    expect(comparison.comparable).toBe(true)
    expect(comparison.environmentChanges).toEqual([])
  })
})

/**
 * Durduran sebep önde, okunamayan pin ayrı notta. Üretimdeki cümle ikisini
 * aynı cümlede veriyordu ("suiteHash changed; systemPromptHash could not be
 * read") ve hangisinin karşılaştırmayı durdurduğu okunmuyordu.
 */
describe('compareRuns — durduran sebep ve not', () => {
  const blind: Partial<Pins> = { systemPromptHash: 'not-provided-by-host' }

  it('kayma varken okunamayan pin gerekceye degil nota gider', () => {
    const comparison = compareRuns(
      run([['a', 10, 0]], blind),
      run([['a', 10, 0]], { ...blind, suiteHash: 'sha256:suite2' }),
    )
    expect(comparison.reason).toBe('the runs are not comparable: suiteHash changed between them')
    expect(comparison.note).toContain('systemPromptHash could not be read')
    expect(comparison.unavailable).toEqual(['systemPromptHash'])
  })

  it('kayma yoksa okunamayan pin durduran sebeptir, not yok', () => {
    const comparison = compareRuns(run([['a', 10, 0]], blind), run([['a', 10, 0]], blind))
    expect(comparison.comparable).toBe(false)
    expect(comparison.reason).toContain('systemPromptHash could not be read')
    expect(comparison.note).toBeUndefined()
  })

  it('yalnizca kayma varsa not yok', () => {
    const comparison = compareRuns(run([['a', 10, 0]]), run([['a', 10, 0]], { model: 'model-2' }))
    expect(comparison.note).toBeUndefined()
  })
})
