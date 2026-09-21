/**
 * 0.4.0 — çakışma vakası uçtan uca: suite → runSuite → kayıt.
 *
 * Değerlendirme core'da sınanıyor (trigger.test.ts); burada sınanan şey
 * bağlantı: runner kazanan iddiasını değerlendirmeye veriyor mu, ve kayıt
 * matrisin kurulabilmesi için `expectedWinner`i taşıyor mu.
 */

import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseSuite, type Suite } from '@ktlsr/assay-core'
import { beforeAll, describe, expect, it } from 'vitest'
import { runSuite } from './run.js'
import { MockAdapter, type MockScenario } from './testing/mock-adapter.js'

const SUITE_SOURCE = `
version: 1
target: { skill: product-marketing, source: local@abc123 }
environment:
  host: mock
  model: test-model-1
  system_prompt_hash: sha256:aaa
  active_skills: [product-marketing, signup, cro, copywriting, copy-editing]
runs: 2
cases:
  - id: collide.signup.registration_form
    prompt: one
    expect: { winner: signup, not_triggered: [cro] }
  - id: contested.copywriting.headline
    prompt: two
    expect: { winner: [copywriting, copy-editing] }
  - id: negative.pricing_decision
    prompt: three
    expect: { winner: none }
`

/** Sahte adaptör vaka sırasıyla bu gözlemleri veriyor (repeat: 1, sıralı). */
const fires = (skills: string[]): MockScenario => ({
  trigger: {
    available: true,
    triggered: skills.includes('product-marketing'),
    skills,
    refused: false,
    refusals: [],
    complete: true,
    via: 'mock',
  },
  trace: [{ seq: 1, kind: 'session_end', outcome: 'completed' }],
})

let suite: Suite
let skillPath: string

beforeAll(async () => {
  const parsed = parseSuite(SUITE_SOURCE)
  if (!parsed.ok) throw new Error(parsed.issues.map((i) => i.message).join('; '))
  suite = parsed.suite
  skillPath = await mkdtemp(join(tmpdir(), 'assay-skill-'))
  await writeFile(join(skillPath, 'SKILL.md'), '# skill\n')
})

const run = (scenarios: MockScenario[]) =>
  runSuite(suite, new MockAdapter({ scenarios }), { source: SUITE_SOURCE, skillPath, repeat: 1 })

describe('çakışma vakası kayıtta', () => {
  it('kayit her vakanin beklenen kazananini tasiyor; none bos liste', async () => {
    const record = await run([fires(['signup']), fires(['copy-editing']), fires([])])
    expect(record.cases.map((c) => [c.caseId, c.expectedWinner])).toEqual([
      ['collide.signup.registration_form', ['signup']],
      ['contested.copywriting.headline', ['copywriting', 'copy-editing']],
      ['negative.pricing_decision', []],
    ])
  })

  it('runner kazanan iddiasini degerlendirmeye veriyor: dogru kazananlar pass', async () => {
    const record = await run([fires(['signup']), fires(['copy-editing']), fires([])])
    expect(record.cases.map((c) => c.passed)).toEqual([1, 1, 1])
    expect(record.verdict).toBe('pass')
  })

  it('hicbiri tetiklenmezse pozitif vakalar FAIL — 100 sahte pass burada kapaniyor', async () => {
    // Pozitif kontrol yukarıda: aynı suite doğru kazananlarla geçiyor.
    const record = await run([fires([]), fires([]), fires([])])
    const byId = new Map(record.cases.map((c) => [c.caseId, c]))
    expect(byId.get('collide.signup.registration_form')?.failed).toBe(1)
    expect(byId.get('contested.copywriting.headline')?.failed).toBe(1)
    // Negatif (winner: none) hiçbir şey tetiklenmediğinde geçer.
    expect(byId.get('negative.pricing_decision')?.passed).toBe(1)
    expect(record.cases[0]?.attempts[0]?.triggerCheck?.reason).toContain(
      'no skill triggered, but this case expects signup to win',
    )
  })

  it('kazanan iddiasi olmayan vakada alan yok', async () => {
    const plain = parseSuite(`
version: 1
target: { skill: widget, source: local@abc123 }
environment: { host: mock, model: m, system_prompt_hash: sha256:aaa }
runs: 2
cases:
  - id: trigger.positive.a
    prompt: one
    expect: { triggered: true }
  - id: trigger.negative.b
    prompt: two
    expect: { triggered: false }
`)
    if (!plain.ok) throw new Error('fixture')
    const record = await runSuite(plain.suite, new MockAdapter({ scenarios: [fires([])] }), {
      source: 'x',
      skillPath,
      repeat: 1,
    })
    expect(record.cases.every((c) => !('expectedWinner' in c))).toBe(true)
  })
})
