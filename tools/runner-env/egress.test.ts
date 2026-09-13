import { describe, expect, it } from 'vitest'
import { allows } from './egress.mjs'

describe('egress allowlist', () => {
  it('lets the npm registry and the Playwright CDNs through on 443', () => {
    expect(allows('registry.npmjs.org:443')).toBe(true)
    expect(allows('cdn.playwright.dev:443')).toBe(true)
    expect(allows('playwright.download.prss.microsoft.com:443')).toBe(true)
    expect(allows('Registry.NPMJS.org:443')).toBe(true)
  })

  it('refuses everything else, including look-alikes', () => {
    for (const target of [
      'api.anthropic.com:443',
      'example.com:443',
      'registry.npmjs.org:80',
      'registry.npmjs.org:22',
      'registry.npmjs.org',
      'registry.npmjs.org.evil.com:443',
      'evil-registry.npmjs.org:443',
      'npmjs.org:443',
      'registry.npmjs.org.:443',
      'registry.npmjs.org@evil.com:443',
      '104.16.0.1:443',
      '[::1]:443',
      'host.docker.internal:443',
      '',
    ]) {
      expect(allows(target), target).toBe(false)
    }
  })
})
