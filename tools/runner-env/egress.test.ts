import { describe, expect, it } from 'vitest'
import { DEFAULT_EGRESS } from '@ktlsr/assay-runner'
import { allows, parseAllow } from './egress.mjs'

const ALLOW = parseAllow(DEFAULT_EGRESS.join(','))

describe('egress allowlist', () => {
  it('lets the npm registry and the Playwright CDNs through on 443', () => {
    expect(allows('registry.npmjs.org:443', ALLOW)).toBe(true)
    expect(allows('cdn.playwright.dev:443', ALLOW)).toBe(true)
    expect(allows('playwright.download.prss.microsoft.com:443', ALLOW)).toBe(true)
    expect(allows('Registry.NPMJS.org:443', ALLOW)).toBe(true)
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
      expect(allows(target, ALLOW), target).toBe(false)
    }
  })

  it('reads the list the runner gives it: sorted, lower-case, no blanks or repeats', () => {
    expect(parseAllow(' B.example ,a.example,,b.example ')).toEqual(['a.example', 'b.example'])
    expect(parseAllow(undefined)).toEqual([])
    expect(allows('a.example:443', parseAllow('a.example'))).toBe(true)
    expect(allows('registry.npmjs.org:443', parseAllow('a.example'))).toBe(false)
  })
})
