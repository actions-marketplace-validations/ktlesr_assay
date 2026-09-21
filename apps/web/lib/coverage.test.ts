import type { Run } from '@ktlsr/assay-core'
import { describe, expect, it } from 'vitest'
import { coverageNotices, coverageTag, unknownBecause } from './coverage'

// Birim testi girdisi (sözleşme 3'ün istisnası): yalnızca kapsam alanları.
const base = { runs: 10, cases: [] } as unknown as Run
const run = (extra: Partial<Run>): Run => ({ ...base, ...extra }) as Run

describe('coverageNotices', () => {
  it('tam bir koşumda hiçbir şey söylemez', () => {
    expect(coverageNotices(base)).toEqual([])
    expect(coverageTag(base)).toBeNull()
  })

  it('hızlı modu manşet olarak söyler, deneme sayısıyla', () => {
    const notices = coverageNotices(run({ layers: ['trigger'], runs: 3 }))
    expect(notices.map((n) => n.key)).toEqual(['fast'])
    expect(notices[0]?.title).toBe('Fast mode — an early warning, not evidence')
    expect(notices[0]?.body.join(' ')).toContain('At 3 attempts per case')
    expect(coverageTag(run({ layers: ['trigger'] }))).toBe('fast mode')
    // Tam kapsam beyanı hızlı mod değildir.
    expect(coverageNotices(run({ layers: ['trigger', 'assertions'] }))).toEqual([])
  })

  it('koşulmayan vakaları sebepleriyle listeler; kesmeyi ayrıca söyler', () => {
    const layerOnly = coverageNotices(
      run({ skipped: [{ caseId: 'a', reason: 'only assertions', cause: 'layer' }] }),
    )
    expect(layerOnly[0]?.title).toBe('1 case was not run')
    expect(layerOnly[0]?.body).toEqual([])
    expect(layerOnly[0]?.items).toEqual([{ caseId: 'a', reason: 'only assertions' }])

    const cut = coverageNotices(
      run({
        skipped: [
          { caseId: 'b', reason: 'budget', cause: 'budget' },
          { caseId: 'c', reason: 'never reached', cause: 'interrupted' },
        ],
      }),
    )
    expect(cut[0]?.title).toBe('2 cases were not run')
    expect(cut[0]?.body.join(' ')).toContain('attempt budget cut 1 of them')
    expect(cut[0]?.body.join(' ')).toContain('interrupted before 1 of them started')
  })

  it('yarım kaydı söyler; dizin notunda yarım kayıt hızlı moddan önce gelir', () => {
    const partial = {
      reason: 'the run was interrupted',
      recoveredAt: '2026-09-10T09:01:17Z',
      droppedLines: 2,
    }
    const notices = coverageNotices(run({ layers: ['trigger'], partial }))
    expect(notices.map((n) => n.key)).toEqual(['fast', 'partial'])
    expect(notices[1]?.body.join(' ')).toContain('cannot pass')
    expect(notices[1]?.body.join(' ')).toContain('2 journal line(s)')
    expect(coverageTag(run({ layers: ['trigger'], partial }))).toBe('incomplete run')
  })
})

describe('unknownBecause', () => {
  it('yarım ya da kesilmiş kaydın unknown sebebini söyler, yoksa susar', () => {
    expect(unknownBecause(base)).toBeNull()
    expect(
      unknownBecause(
        run({ partial: { reason: 'x', recoveredAt: '2026-09-10T09:01:17Z' } }),
      ),
    ).toContain('interrupted before it finished')
    expect(
      unknownBecause(
        run({ skipped: [{ caseId: 'b', reason: 'budget', cause: 'budget' }] }),
      ),
    ).toContain('stopped 1 case before they ran')
    // Katman elemesi kullanıcının beyanı; verdict'i düşürmez, sebep de değildir.
    expect(
      unknownBecause(
        run({ skipped: [{ caseId: 'a', reason: 'layer', cause: 'layer' }] }),
      ),
    ).toBeNull()
  })
})
