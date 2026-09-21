/**
 * MockAdapter — **yalnızca test aracıdır.**
 *
 * Arayüze, seed'e veya rapora veri beslemek için kullanılamaz (docs/workflow.md,
 * veri gerçekliği sözleşmesi). Bu yüzden `@ktlsr/assay-runner`'ın ana giriş
 * noktasından değil, `@ktlsr/assay-runner/testing` alt yolundan dışa verilir: üretim
 * kodunun kazara içine düşmesi için ayrı bir import yazmak gerekir.
 *
 * Amacı adaptör sözleşmesinin kenar durumlarını canlandırmak: sinyalin hiç
 * okunamaması, izin kısmi gelmesi, oturumun çökmesi.
 */

import type { TraceEvent, TriggerObservation } from '@ktlsr/assay-core'
import type { AgentSession, HostAdapter, RunConfig, SessionResult } from '../adapter.js'

/** Tek bir attempt'te adaptörün ne yapacağı. */
export interface MockScenario {
  /** Okunacak tetiklenme sinyali. Verilmezse "okunamadı". */
  trigger?: TriggerObservation
  /** Okunacak iz. `undefined` bırakılırsa iz alınamamış sayılır. */
  trace?: readonly TraceEvent[]
  /** finalize'ın döndüreceği sonucun üzerine yazılacak alanlar. */
  result?: Partial<SessionResult>
  /** `start` bu hatayla patlasın — çöken oturumu canlandırmak için. */
  failOnStart?: string
  /** `readTrace` bu hatayla patlasın — sözleşmeyi ihlal eden host'u canlandırmak için. */
  failOnReadTrace?: string
}

export interface MockAdapterOptions {
  id?: string
  /**
   * Attempt sırasına göre senaryolar. Liste tükenirse başa sarar; böylece tek
   * senaryo N tekrarın hepsinde kullanılabilir.
   */
  scenarios: readonly MockScenario[]
}

const NOT_READABLE: TriggerObservation = {
  available: false,
  reason: 'MockAdapter was given no trigger signal for this attempt',
}

export class MockAdapter implements HostAdapter {
  readonly id: string
  /** Açılan her oturumun aldığı yapılandırma. Testler burayı denetler. */
  readonly started: RunConfig[] = []

  readonly #scenarios: readonly MockScenario[]
  readonly #bySession = new Map<string, MockScenario>()
  #opened = 0

  constructor(options: MockAdapterOptions) {
    if (options.scenarios.length === 0) {
      throw new Error('MockAdapter needs at least one scenario')
    }
    this.id = options.id ?? 'mock'
    this.#scenarios = options.scenarios
  }

  #scenarioFor(session: AgentSession): MockScenario {
    const scenario = this.#bySession.get(session.id)
    if (scenario === undefined) {
      throw new Error(
        `MockAdapter has no session ${session.id}: start() was never called`,
      )
    }
    return scenario
  }

  // async: senkron fırlatmalar da reddedilen promise'e dönüşsün — sözleşme
  // "adaptör çağrıları promise döner" diyor, runner tek yerde yakalayabilsin.
  async start(config: RunConfig): Promise<AgentSession> {
    const scenario = this.#scenarios[
      this.#opened % this.#scenarios.length
    ] as MockScenario
    this.#opened += 1
    if (scenario.failOnStart !== undefined) throw new Error(scenario.failOnStart)
    this.started.push(config)
    const session: AgentSession = {
      id: `${this.id}-${config.caseId}-${config.attempt}-${this.#opened}`,
      adapter: this.id,
      startedAt: new Date(0).toISOString(),
    }
    this.#bySession.set(session.id, scenario)
    return session
  }

  async readTriggerSignal(session: AgentSession): Promise<TriggerObservation> {
    return this.#scenarioFor(session).trigger ?? NOT_READABLE
  }

  async readTrace(session: AgentSession): Promise<readonly TraceEvent[] | undefined> {
    const scenario = this.#scenarioFor(session)
    if (scenario.failOnReadTrace !== undefined) throw new Error(scenario.failOnReadTrace)
    return scenario.trace
  }

  async finalize(session: AgentSession): Promise<SessionResult> {
    const scenario = this.#scenarioFor(session)
    return {
      outcome: 'completed',
      finishedAt: new Date(0).toISOString(),
      latencyMs: 0,
      ...scenario.result,
    }
  }
}

// ---------------------------------------------------------------------------
// Hazır kenar durumları
// ---------------------------------------------------------------------------

/** Sinyal de iz de okunamıyor: her attempt `unknown` olmalı. */
export const BLIND_HOST: MockScenario = {
  trigger: { available: false, reason: 'this host emits no skill markers' },
}

/** İz geliyor ama `session_end` yok: nasıl bittiği bilinmiyor. */
export const PARTIAL_TRACE: MockScenario = {
  trigger: {
    available: true,
    triggered: true,
    skills: ['docx'],
    refused: false,
    refusals: [],
    complete: true,
    via: 'markers',
  },
  trace: [
    { seq: 1, kind: 'tool_call', tool: 'Write' },
    { seq: 2, kind: 'tool_result', tool: 'Write', isError: true, error: 'EACCES' },
  ],
}

/** Oturum çöktü. */
export const CRASHED_SESSION: MockScenario = {
  trigger: {
    available: false,
    reason: 'the session crashed before any marker was emitted',
  },
  trace: [{ seq: 1, kind: 'session_end', outcome: 'error' }],
  result: { outcome: 'error', exitCode: 1 },
}

/**
 * Model skill'i seçti ama host aktivasyonu reddetti.
 *
 * Ne tetiklenme ne tetiklenmeme: ölçüm yapılmadı. Pozitif de negatif de
 * `unknown` almalı.
 */
export const REFUSED_ACTIVATION: MockScenario = {
  trigger: {
    available: true,
    triggered: false,
    skills: [],
    refused: true,
    refusals: [
      {
        skill: 'docx',
        reason: 'the host denied permission for the Skill call, so the skill never loaded',
      },
    ],
    complete: true,
    via: 'markers',
  },
  trace: [{ seq: 1, kind: 'session_end', outcome: 'completed' }],
}

/** Host `start` sırasında patlıyor. */
export const START_FAILS: MockScenario = {
  failOnStart: 'the host binary is not installed',
}
