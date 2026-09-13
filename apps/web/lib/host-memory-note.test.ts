import type { Environment } from '@ktlsr/assay-core'
import { describe, expect, it } from 'vitest'
import exposure from './host-memory-exposure.json'
import { hostMemoryNote } from './host-memory-note'

const environment: Environment = {
  model: 'm',
  version: 'v',
  tools: [],
  skills: [],
  agents: [],
  plugins: [],
}
// Yayımlı ve izi olan gerçek kayıt: marketing-skills v3 hızlı koşumu.
const traced = 'run-2026-09-11T14-54-16-671Z-912ad216'
// Yayımlı ve izi olmayan gerçek kayıt: hallmark.
const clean = 'run-2026-09-10T13-54-52-180Z-2dc28f84'

describe('hostMemoryNote', () => {
  it('maruz kalmis kaydin deneme ve iz sayisini verir', () => {
    expect(hostMemoryNote({ id: traced, environment })).toEqual({
      marker: 'graphify',
      attempts: 60,
      traces: 4,
    })
  })

  it('iz yoksa sifir der — bos birakmaz', () => {
    expect(hostMemoryNote({ id: clean, environment })?.traces).toBe(0)
  })

  it('olculmus kayitta not yok: yuklenen dosyalar kunyede yaziyor', () => {
    expect(hostMemoryNote({ id: traced, environment: { ...environment, memory: [] } })).toBeNull()
  })

  it('maruziyeti bilinmeyen kayda not dusulmez', () => {
    expect(hostMemoryNote({ id: 'run-unknown', environment })).toBeNull()
  })

  it('veri dosyasi yalniz uretilmis sayilar tasiyor', () => {
    for (const entry of Object.values(exposure.runs)) {
      expect(entry.traces).toBeLessThanOrEqual(entry.attempts)
      expect(entry.attempts).toBeGreaterThan(0)
    }
  })
})
