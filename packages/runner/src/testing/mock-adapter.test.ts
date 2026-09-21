import { evaluateNoSwallowedErrors, evaluateTrigger } from '@ktlsr/assay-core'
import { describe, expect, it } from 'vitest'
import type { RunConfig } from '../adapter.js'
import {
  BLIND_HOST,
  CRASHED_SESSION,
  MockAdapter,
  PARTIAL_TRACE,
  START_FAILS,
  type MockScenario,
} from './mock-adapter.js'

const config = (attempt = 0): RunConfig => ({
  caseId: 'trigger.positive.explicit',
  attempt,
  prompt: 'Turn this draft into a Word document.',
  skill: { name: 'docx', source: 'anthropics/skills@abc123', path: './skills/docx' },
  model: 'claude-opus-5-20260514',
  activeSkills: ['docx', 'pdf'],
  workdir: '/sandbox/run-1',
})

const adapterWith = (...scenarios: MockScenario[]) => new MockAdapter({ scenarios })

describe('MockAdapter — sözleşme', () => {
  it('senaryosuz kurulamaz', () => {
    expect(() => new MockAdapter({ scenarios: [] })).toThrow('at least one scenario')
  })

  it('açılan oturumların yapılandırmasını kaydeder', async () => {
    const adapter = adapterWith(BLIND_HOST)
    await adapter.start(config(0))
    await adapter.start(config(1))
    expect(adapter.started.map((c) => c.attempt)).toEqual([0, 1])
  })

  it('senaryo listesi tükenince başa sarar', async () => {
    const adapter = adapterWith(
      {
        trigger: {
          available: true,
          triggered: true,
          skills: ['docx'],
          refused: false,
          refusals: [],
          complete: true,
          via: 'a',
        },
      },
      BLIND_HOST,
    )
    const first = await adapter.start(config(0))
    const second = await adapter.start(config(1))
    const third = await adapter.start(config(2))
    expect((await adapter.readTriggerSignal(first)).available).toBe(true)
    expect((await adapter.readTriggerSignal(second)).available).toBe(false)
    expect((await adapter.readTriggerSignal(third)).available).toBe(true)
  })

  it('bilinmeyen oturum için sorulursa patlar', async () => {
    const adapter = adapterWith(BLIND_HOST)
    await expect(
      adapter.readTriggerSignal({ id: 'ghost', adapter: 'mock', startedAt: '' }),
    ).rejects.toThrow('no session ghost')
  })
})

describe('MockAdapter — sinyal okunamıyor', () => {
  it('readTriggerSignal hata fırlatmaz, available: false döner', async () => {
    const adapter = adapterWith(BLIND_HOST)
    const session = await adapter.start(config())
    const observation = await adapter.readTriggerSignal(session)
    expect(observation.available).toBe(false)
    expect(observation).toHaveProperty('reason')
  })

  it('okunamayan sinyal tetiklenme değerlendirmesinde unknown üretir', async () => {
    const adapter = adapterWith(BLIND_HOST)
    const session = await adapter.start(config())
    const observation = await adapter.readTriggerSignal(session)
    expect(evaluateTrigger(observation, { triggered: true })?.verdict).toBe('unknown')
    expect(evaluateTrigger(observation, { triggered: false })?.verdict).toBe('unknown')
  })

  it('senaryo sinyal vermediyse varsayılan "okunamadı"dır, "tetiklenmedi" değil', async () => {
    const adapter = adapterWith({})
    const session = await adapter.start(config())
    expect((await adapter.readTriggerSignal(session)).available).toBe(false)
  })
})

describe('MockAdapter — kısmi iz', () => {
  it('iz alınamadığında undefined döner, boş dizi değil', async () => {
    const adapter = adapterWith(BLIND_HOST)
    const session = await adapter.start(config())
    expect(await adapter.readTrace(session)).toBeUndefined()
  })

  it("session_end taşımayan iz no_swallowed_errors'ı unknown yapar", async () => {
    const adapter = adapterWith(PARTIAL_TRACE)
    const session = await adapter.start(config())
    const trace = await adapter.readTrace(session)
    expect(trace).toHaveLength(2)
    expect(evaluateNoSwallowedErrors(trace).verdict).toBe('unknown')
  })

  it('boş iz ile alınamamış iz farklı şeylerdir', async () => {
    const empty = adapterWith({ trace: [] })
    const session = await empty.start(config())
    expect(await empty.readTrace(session)).toEqual([])
    expect(evaluateNoSwallowedErrors(await empty.readTrace(session)).reason).toContain(
      'empty',
    )

    const missing = adapterWith({})
    const other = await missing.start(config())
    expect(evaluateNoSwallowedErrors(await missing.readTrace(other)).reason).toContain(
      'no trace',
    )
  })

  it('readTrace sözleşmeyi ihlal edip patlayabilir — runner bunu yakalamalı', async () => {
    const adapter = adapterWith({ failOnReadTrace: 'the transcript file disappeared' })
    const session = await adapter.start(config())
    await expect(adapter.readTrace(session)).rejects.toThrow(
      'transcript file disappeared',
    )
  })
})

describe('MockAdapter — çöken oturum', () => {
  it('start patlayabilir', async () => {
    const adapter = adapterWith(START_FAILS)
    await expect(adapter.start(config())).rejects.toThrow('host binary is not installed')
    expect(adapter.started).toHaveLength(0)
  })

  it('çöken oturumda sonuç error ve sinyal okunamamış olur', async () => {
    const adapter = adapterWith(CRASHED_SESSION)
    const session = await adapter.start(config())
    const result = await adapter.finalize(session)
    expect(result.outcome).toBe('error')
    expect(result.exitCode).toBe(1)
    expect((await adapter.readTriggerSignal(session)).available).toBe(false)
  })

  it('çöken oturumda hata saklanmış sayılmaz', async () => {
    const adapter = adapterWith(CRASHED_SESSION)
    const session = await adapter.start(config())
    expect(evaluateNoSwallowedErrors(await adapter.readTrace(session)).verdict).toBe(
      'pass',
    )
  })
})

describe('MockAdapter — finalize', () => {
  it('varsayılan sonuç completed', async () => {
    const adapter = adapterWith({})
    const session = await adapter.start(config())
    const result = await adapter.finalize(session)
    expect(result.outcome).toBe('completed')
    expect(result.latencyMs).toBe(0)
  })

  it('senaryo sonucun üzerine yazar', async () => {
    const adapter = adapterWith({
      result: { exitCode: 2, systemPromptHash: 'sha256:xyz' },
    })
    const session = await adapter.start(config())
    const result = await adapter.finalize(session)
    expect(result.exitCode).toBe(2)
    expect(result.systemPromptHash).toBe('sha256:xyz')
  })

  it("sistem promptu hash'i verilmezse yoktur — uydurulmaz", async () => {
    const adapter = adapterWith({})
    const session = await adapter.start(config())
    expect((await adapter.finalize(session)).systemPromptHash).toBeUndefined()
  })
})
