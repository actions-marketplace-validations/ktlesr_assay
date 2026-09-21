import type { Pins, Run } from '@ktlsr/assay-core'
import { describe, expect, it } from 'vitest'
import { baselineFor } from './baseline'

const pins: Pins = {
  skillSource: 'owner/repo@abc',
  skillHash: 'sha256:skill',
  model: 'model-1',
  systemPromptHash: 'sha256:sp',
  suiteVersion: 1,
  suiteHash: 'sha256:suite1',
}

const item = (slug: string, overrides: Partial<Pins> = {}) => ({
  slug,
  run: {
    id: slug,
    startedAt: `2026-09-0${slug.length}T10:00:00.000Z`,
    finishedAt: '',
    host: 'mock',
    skill: 'widget',
    pins: { ...pins, ...overrides },
    runs: 3,
    cases: [],
    verdict: 'pass',
  } satisfies Run,
})

describe('baselineFor', () => {
  it('hemen onceki kosum ayni kosullardaysa ona gider', () => {
    expect(baselineFor(item('now').run, [item('prev'), item('old')])).toMatchObject({
      kind: 'comparable',
      slug: 'prev',
      adjacent: true,
    })
  })

  it('arada baska kosullarda olculmus kosum varsa onu atlar', () => {
    const baseline = baselineFor(item('now').run, [
      item('prev', { suiteHash: 'sha256:suite2' }),
      item('old'),
    ])
    expect(baseline).toMatchObject({ kind: 'comparable', slug: 'old', adjacent: false })
  })

  it('hicbiri ayni kosullarda degilse hemen oncekine "differs" der', () => {
    const baseline = baselineFor(item('now').run, [
      item('prev', { suiteHash: 'sha256:suite2' }),
      item('old', { model: 'model-2' }),
    ])
    expect(baseline).toEqual({ kind: 'differs', slug: 'prev' })
  })

  it('okunamayan pin de uyusma sayilmaz', () => {
    const blind = { systemPromptHash: 'not-provided-by-host' }
    expect(baselineFor(item('now', blind).run, [item('prev', blind)])).toEqual({
      kind: 'differs',
      slug: 'prev',
    })
  })

  it('onceki kosum yoksa null', () => {
    expect(baselineFor(item('now').run, [])).toBeNull()
  })
})
