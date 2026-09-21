import { describe, expect, it } from 'vitest'
import { closedInPublicMode } from './public-mode'

describe('yayın modu', () => {
  it('karşılaştırma ve yayımlanmış ölçümler açık (0.4.1)', () => {
    expect(closedInPublicMode('/compare')).toBe(false)
    expect(closedInPublicMode('/suites')).toBe(false)
    expect(closedInPublicMode('/runs/run-1')).toBe(false)
  })

  it('bileşen kataloğu ve kurulum ucu kapalı', () => {
    expect(closedInPublicMode('/dev/components')).toBe(true)
    expect(closedInPublicMode('/api/bootstrap')).toBe(true)
  })

  it('önek benzerliği yetmez: /developer kapalı değil', () => {
    expect(closedInPublicMode('/developer')).toBe(false)
  })
})
