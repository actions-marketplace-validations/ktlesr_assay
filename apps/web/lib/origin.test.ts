import { describe, expect, it } from 'vitest'
import { originFrom } from './origin'

describe('originFrom', () => {
  it('ters vekil arkasında gerçek alan adını ve şemayı verir', () => {
    const headers = new Headers({
      host: 'web:3000',
      'x-forwarded-host': 'assayctl.dev',
      'x-forwarded-proto': 'https',
    })
    expect(originFrom(headers)).toBe('https://assayctl.dev')
  })

  it('vekil yokken isteğin kendi host başlığını kullanır', () => {
    expect(originFrom(new Headers({ host: '127.0.0.1:3100' }))).toBe(
      'http://127.0.0.1:3100',
    )
  })

  it('zincirlenmiş şema başlığında ilkini alır', () => {
    const headers = new Headers({
      host: 'assayctl.dev',
      'x-forwarded-proto': 'https, http',
    })
    expect(originFrom(headers)).toBe('https://assayctl.dev')
  })
})
