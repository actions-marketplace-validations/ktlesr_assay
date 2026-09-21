import { describe, expect, it } from 'vitest'
import { visibleTrail } from './trail'

describe('visibleTrail', () => {
  it('gidilecek bir üst yer varsa izi olduğu gibi verir', () => {
    const crumbs = [
      { label: 'measurements', href: '/suites' },
      { label: 'hallmark:hallmark' },
    ]
    expect(visibleTrail(crumbs)).toEqual(crumbs)
  })

  it('bağlantısız iz başlığı tekrarlar, çizilmez', () => {
    expect(visibleTrail([{ label: 'skills' }])).toBeNull()
    expect(visibleTrail([{ label: 'admin' }, { label: 'users' }])).toBeNull()
    expect(visibleTrail([])).toBeNull()
  })
})
