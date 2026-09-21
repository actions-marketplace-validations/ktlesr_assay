/**
 * 0.3.0-d — paralel koşum.
 *
 * Hızlanmanın bedeli sessiz olmamalı: kayıt eş zamanlılığı taşıyor, vaka
 * sırası bitiş sırasına göre değil beyan sırasına göre yazılıyor ve her işçi
 * ayrık bir port aralığı alıyor.
 *
 * Port kirası bir **yumuşatma**: burada sınanan şey, kiranın gerçekten ayrık
 * ve ajanın ortamına ulaşıyor olması — ajanın ona uyacağı değil. Uymayan bir
 * sunucu yine çakışır ve bu belgede yazılı.
 */

import { execFileSync } from 'node:child_process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parseSuite,
  type AgentSession,
  type HostAdapter,
  type RunConfig,
  type SessionResult,
  type Suite,
  type TraceEvent,
  type TriggerObservation,
} from '@ktlsr/assay-core'
import { beforeAll, describe, expect, it } from 'vitest'
import { runSuite } from './run.js'
import { MockAdapter, type MockScenario } from './testing/mock-adapter.js'
import type { AdapterSpec } from './worker.js'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../..')
const envAdapter = join(repoRoot, 'tools/fixtures/env-adapter.mjs')

const SUITE_SOURCE = `
version: 1
target: { skill: widget, source: local@abc123 }
environment:
  host: mock
  model: test-model-1
  system_prompt_hash: sha256:aaa
runs: 3
cases:
  - id: trigger.positive.explicit
    prompt: one
    expect: { triggered: true }
  - id: trigger.negative.near_neighbor.readme
    prompt: two
    expect: { triggered: false }
  - id: trigger.negative.unrelated
    prompt: three
    expect: { triggered: false }
`

const triggered = (): MockScenario => ({
  trigger: {
    available: true,
    triggered: true,
    skills: ['widget'],
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
  await writeFile(join(skillPath, 'SKILL.md'), '# widget\n')
  execFileSync(process.execPath, [join(repoRoot, 'node_modules/typescript/bin/tsc'), '-b'], {
    cwd: repoRoot,
    stdio: 'inherit',
  })
}, 180_000)

describe('eş zamanlılık kayda giriyor', () => {
  it('varsayilan 1 ve alan yazilmiyor', async () => {
    const record = await runSuite(suite, new MockAdapter({ scenarios: [triggered()] }), {
      source: SUITE_SOURCE,
      skillPath,
      repeat: 1,
    })
    // 1 varsayılan; alanı yazmak her kayda gürültü eklerdi.
    expect(record.concurrency).toBeUndefined()
  })

  it('1den buyukse kayda yaziliyor', async () => {
    const record = await runSuite(suite, new MockAdapter({ scenarios: [triggered()] }), {
      source: SUITE_SOURCE,
      skillPath,
      repeat: 2,
      concurrency: 3,
    })
    expect(record.concurrency).toBe(3)
  })

  it('es zamanlilik ortam hash ine girmiyor', async () => {
    // Host'un bildirdiği ortamın değil, koşum düzeninin özelliği. Hash'e
    // girseydi farklı hızda koşulmuş iki ölçüm tetiklenme oranı bakımından da
    // karşılaştırılamaz olurdu.
    const one = await runSuite(suite, new MockAdapter({ scenarios: [envScenario()] }), {
      source: SUITE_SOURCE,
      skillPath,
      repeat: 1,
    })
    const many = await runSuite(suite, new MockAdapter({ scenarios: [envScenario()] }), {
      source: SUITE_SOURCE,
      skillPath,
      repeat: 1,
      concurrency: 4,
    })
    expect(many.pins.environmentHash).toBe(one.pins.environmentHash)
  })
})

describe('sıra ve bütünlük', () => {
  it('vaka sirasi bitis sirasina gore degil beyan sirasina gore', async () => {
    /*
     * Bitiş sırası kasten TERSİNE çevriliyor: ilk vaka en yavaş, son vaka en
     * hızlı. Bu olmadan test hiçbir şey ölçmüyordu — hızlı bir sahte adaptörle
     * denemeler zaten sırayla bitiyor ve sıralama kodu kaldırıldığında bile
     * test yeşil kalıyordu (ters çevirme yakaladı).
     */
    const record = await runSuite(suite, new SkewedAdapter(), {
      source: SUITE_SOURCE,
      skillPath,
      repeat: 3,
      concurrency: 4,
    })
    expect(record.cases.map((c) => c.caseId)).toEqual([
      'trigger.positive.explicit',
      'trigger.negative.near_neighbor.readme',
      'trigger.negative.unrelated',
    ])
    // Vaka içindeki denemeler de sırada.
    for (const result of record.cases) {
      expect(result.attempts.map((a) => a.index)).toEqual([0, 1, 2])
    }
  })

  it('hicbir deneme kaybolmuyor ve tekrarlanmiyor', async () => {
    const record = await runSuite(suite, new MockAdapter({ scenarios: [triggered()] }), {
      source: SUITE_SOURCE,
      skillPath,
      repeat: 4,
      concurrency: 3,
    })
    const attempts = record.cases.flatMap((c) => c.attempts)
    expect(attempts).toHaveLength(12)
    const keys = attempts.map((a) => `${a.caseId}#${a.index}`)
    expect(new Set(keys).size).toBe(12)
  })
})

describe('port kirası', () => {
  it('her isciye ayrik bir aralik veriliyor ve ajanin ortamina ulasiyor', async () => {
    const record = await runSuite(suite, new MockAdapter({ scenarios: [triggered()] }), {
      source: SUITE_SOURCE,
      skillPath,
      repeat: 2,
      concurrency: 3,
      portRangeStart: 5600,
      portRangeSize: 10,
      // Fixture adaptör, gördüğü PORT/ASSAY_PORT_RANGE'i gerekçeye yazıyor.
      isolate: { module: envAdapter, export: 'EnvReportingAdapter' } satisfies AdapterSpec,
    })

    const ranges = new Set<string>()
    for (const attempt of record.cases.flatMap((c) => c.attempts)) {
      // Kira gözlemin `via` alanında: fixture adaptör onu oraya yazıyor.
      const via = attempt.trigger.available ? attempt.trigger.via : ''
      const found = /ASSAY_PORT_RANGE=(\S+)/.exec(via)
      expect(found, `via: ${via}`).not.toBeNull()
      ranges.add(found?.[1] ?? '')
    }

    // Üç işçi, üç ayrı aralık; hiçbiri diğerinin portunu istemiyor.
    expect(ranges.size).toBeGreaterThan(1)
    for (const range of ranges) expect(range).toMatch(/^56\d0-56\d9$/)
    const starts = [...ranges].map((r) => Number(r.split('-')[0]))
    expect(new Set(starts).size).toBe(starts.length)
  }, 120_000)
})

/** Ortam hash'i bildiren senaryo — hash karşılaştırması için. */
function envScenario(): MockScenario {
  return { ...triggered(), result: { environmentHash: 'sha256:fixed' } }
}

/**
 * Bitişi beyan sırasının TERSİNE çeviren adaptör.
 *
 * İlk vaka en yavaş, son vaka en hızlı. Böylece paralel koşumda denemeler
 * beyan sırasının tersine bitiyor ve "kayıt beyan sırasında" iddiası gerçekten
 * sınanıyor.
 */
class SkewedAdapter implements HostAdapter {
  readonly id = 'mock'
  #delayOf(caseId: string): number {
    const order = ['trigger.positive.explicit', 'trigger.negative.near_neighbor.readme']
    const position = order.indexOf(caseId)
    return position === -1 ? 5 : (order.length - position) * 120
  }

  async start(config: RunConfig): Promise<AgentSession> {
    await new Promise((r) => setTimeout(r, this.#delayOf(config.caseId)))
    return {
      id: `skew-${config.caseId}-${config.attempt}`,
      adapter: 'mock',
      startedAt: new Date().toISOString(),
    }
  }

  async readTriggerSignal(): Promise<TriggerObservation> {
    return {
      available: true,
      triggered: true,
      skills: ['widget'],
      refused: false,
      refusals: [],
      complete: true,
      via: 'mock',
    }
  }

  async readTrace(): Promise<readonly TraceEvent[]> {
    return [{ seq: 1, kind: 'session_end', outcome: 'completed' }]
  }

  async finalize(): Promise<SessionResult> {
    return {
      outcome: 'completed',
      finishedAt: new Date().toISOString(),
      latencyMs: 1,
      files: [],
      env: { writes: [], deletes: [], network: [], unobserved: [] },
    }
  }
}
