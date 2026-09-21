/**
 * Kanonik kayıt ⇄ veritabanı satırları.
 *
 * Hosted taraf **kendi formatını dayatmaz**: `@ktlsr/assay-core`'daki `Run` tipini
 * alır, satırlara açar, geri okuduğunda aynı `Run`'ı kurar. Bu dosyanın tek
 * işi o iki yönü birbirine sadık tutmak; `mapping.test.ts` gerçek bir
 * Postgres üzerinde gidiş-dönüş yaparak kanıtlıyor.
 *
 * Buradaki tipler Prisma'nın ürettiği istemciye bağlı değil: düz nesneler.
 * Böylece `prisma generate` çalışmadan da derlenir ve test edilir.
 */

import {
  expectedWinnerOf,
  isNegativeCase,
  proportion,
  type Attempt,
  type CaseResult,
  type EnvDiff,
  type Environment,
  type HookRecord,
  type NetworkRequest,
  type PartialRun,
  type RefusedActivation,
  type RunLayer,
  type SkippedCase,
  type Run,
  type Suite,
  type SuiteCase,
  type TraceEvent,
  type Verdict,
} from '@ktlsr/assay-core'

// ---------------------------------------------------------------------------
// Satır biçimleri
// ---------------------------------------------------------------------------

const VERDICT_TO_DB = { pass: 'PASS', fail: 'FAIL', unknown: 'UNKNOWN' } as const
const VERDICT_FROM_DB: Record<string, Verdict> = {
  PASS: 'pass',
  FAIL: 'fail',
  UNKNOWN: 'unknown',
}

const KIND_TO_DB = {
  tool_call: 'TOOL_CALL',
  tool_result: 'TOOL_RESULT',
  assistant_message: 'ASSISTANT_MESSAGE',
  skill_trigger: 'SKILL_TRIGGER',
  session_end: 'SESSION_END',
  hook: 'HOOK',
} as const
const KIND_FROM_DB: Record<string, TraceEvent['kind']> = Object.fromEntries(
  Object.entries(KIND_TO_DB).map(([k, v]) => [v, k as TraceEvent['kind']]),
)

const OUTCOME_TO_DB = {
  completed: 'COMPLETED',
  aborted: 'ABORTED',
  error: 'ERROR',
} as const
const OUTCOME_FROM_DB: Record<string, NonNullable<TraceEvent['outcome']>> = {
  COMPLETED: 'completed',
  ABORTED: 'aborted',
  ERROR: 'error',
}

export interface SuiteRow {
  name: string
  skill: string
  source: string
  version: number
  hash: string
  host: string
  model: string
  systemPromptHash: string
  activeSkills: string[]
}

export interface CaseRow {
  caseId: string
  prompt: string
  expectTriggered: boolean | null
  notTriggered: string[]
  /** Kazanan iddiası var mı; bayrak açık + boş dizi = `winner: none` (0.4.0). */
  expectsWinner: boolean
  expectedWinner: string[]
  assertions: unknown
  nearNeighbour: boolean
}

export interface RunRow {
  id: string
  skill: string
  startedAt: Date
  finishedAt: Date
  host: string
  pinSkillSource: string
  pinSkillHash: string
  pinModel: string
  pinSystemPromptHash: string
  pinSuiteVersion: number
  pinSuiteHash: string
  /**
   * Pin 3'ün denetçisi. Yerel kayıt bunu taşıyordu ama hosted tarafta hiç
   * saklanmıyordu; sonuç, yüklenen her koşumda pin 3'ün "ölçülemedi" kalması
   * ve karşılaştırmanın hep `unknown` üretmesiydi.
   */
  pinEnvironmentHash: string | null
  permissionMode: string | null
  /** Kaydı üreten Assay sürümü; null = 0.3.1 ya da öncesi (0.3.2). */
  assayVersion: string | null
  /**
   * Hash'in girdisi olan ortam kaydı; host bildirmediyse null.
   *
   * Diğer jsonb sütunları gibi `unknown`: Prisma `JsonValue` döndürüyor ve
   * daraltma okuma tarafında yapılıyor.
   */
  environment: unknown
  /**
   * Yarım kalmış koşumun künyesi; normal bitmişse null.
   *
   * Diğer jsonb sütunları gibi `unknown`; daraltma okuma tarafında.
   */
  partial: unknown
  runsPerCase: number
  /**
   * Aynı anda koşan deneme sayısı; 1 ise null.
   *
   * Ortam hash'ine girmiyor (host'un ortamı değil, koşum düzeni) ama kayıtta
   * duruyor: gecikme ve maliyet eş zamanlı koşumda aynı şeyi ölçmüyor.
   */
  concurrency: number | null
  /** Ölçülen katmanlar; boş = hepsi. */
  layers: string[]
  /** Koşulmamış vakalar ve sebepleri; diğer jsonb sütunları gibi `unknown`. */
  skipped: unknown
  verdict: string
  unknownReason: string | null
}

export interface CaseResultRow {
  caseId: string
  passed: number
  failed: number
  unknown: number
  rateSuccesses: number
  rateN: number
  rateValue: number | null
  ciLow: number | null
  ciHigh: number | null
  expectTriggered: boolean | null
  /** Kazanan iddiası var mı; `expectedWinner` boşken `none` ile "iddia yok"u ayırır. */
  expectsWinner: boolean
  expectedWinner: string[]
}

export interface AttemptRow {
  index: number
  startedAt: Date
  finishedAt: Date
  verdict: string
  reason: string
  triggerAvailable: boolean
  triggerTriggered: boolean | null
  triggerComplete: boolean | null
  triggerVia: string | null
  triggerReason: string | null
  triggerSkills: string[]
  triggerRefused: boolean | null
  triggerRefusals: unknown
  latencyMs: number | null
  inputTokens: number | null
  outputTokens: number | null
  /**
   * Postgres NUMERIC sürücüden **string** olarak gelir. Tip bunu kabul ediyor
   * ki geri okuma sessizce string bir maliyet üretmesin; dönüşüm tek yerde.
   */
  costUsd: number | string | null
}

export interface TraceEventRow {
  seq: number
  kind: string
  at: Date | null
  callId: string | null
  callRef: string | null
  tool: string | null
  args: unknown
  isError: boolean | null
  error: string | null
  text: string | null
  acknowledgesError: boolean | null
  skill: string | null
  outcome: string | null
  refusal: string | null
  hook: unknown
}

export interface EnvDiffRow {
  writes: string[]
  deletes: string[]
  network: unknown
  unobserved: string[]
}

// ---------------------------------------------------------------------------
// Kanonik → satır
// ---------------------------------------------------------------------------

/** `near_neighbor` segmenti id konvansiyonundan okunur (docs/decisions.md). */
export const isNearNeighbour = (caseId: string): boolean =>
  caseId.split('.').includes('near_neighbor')

export function toSuiteRow(suite: Suite, hash: string, name?: string): SuiteRow {
  return {
    name: name ?? suite.target.skill,
    skill: suite.target.skill,
    source: suite.target.source,
    version: suite.version,
    hash,
    host: suite.environment.host,
    model: suite.environment.model,
    systemPromptHash: suite.environment.system_prompt_hash,
    activeSkills: [...(suite.environment.active_skills ?? [])],
  }
}

export function toCaseRow(testCase: SuiteCase): CaseRow {
  return {
    caseId: testCase.id,
    prompt: testCase.prompt,
    expectTriggered: testCase.expect.triggered ?? null,
    notTriggered: [...(testCase.expect.not_triggered ?? [])],
    expectsWinner: expectedWinnerOf(testCase.expect) !== undefined,
    expectedWinner: [...(expectedWinnerOf(testCase.expect) ?? [])],
    assertions: testCase.expect.assertions ?? [],
    nearNeighbour: isNearNeighbour(testCase.id),
  }
}

export function toRunRow(run: Run): RunRow {
  return {
    id: run.id,
    skill: run.skill,
    startedAt: new Date(run.startedAt),
    finishedAt: new Date(run.finishedAt),
    host: run.host,
    pinSkillSource: run.pins.skillSource,
    pinSkillHash: run.pins.skillHash,
    pinModel: run.pins.model,
    pinSystemPromptHash: run.pins.systemPromptHash,
    pinSuiteVersion: run.pins.suiteVersion,
    pinSuiteHash: run.pins.suiteHash,
    pinEnvironmentHash: run.pins.environmentHash ?? null,
    permissionMode: run.permissionMode ?? null,
    assayVersion: run.assayVersion ?? null,
    environment: run.environment ?? null,
    partial: run.partial ?? null,
    runsPerCase: run.runs,
    concurrency: run.concurrency ?? null,
    layers: [...(run.layers ?? [])],
    skipped: run.skipped ?? null,
    verdict: VERDICT_TO_DB[run.verdict],
    // Değişmez #1: `unknown` gerekçesiz saklanamaz; kısıt bunu zorluyor,
    // burada gerekçe attempt'lerden toplanıyor.
    unknownReason: run.verdict === 'unknown' ? unknownReasonOf(run) : null,
  }
}

function unknownReasonOf(run: Run): string {
  const reasons = run.cases
    .flatMap((c) => c.attempts)
    .filter((a) => a.verdict === 'unknown')
    .map((a) => a.reason)
  // Bütçe kesmesi koşumu `unknown` yapıyor ama hiçbir denemeyi yapmıyor; sebep
  // denemelerde değil `skipped`da. Yedek cümleye düşseydi doğru karar yanlış
  // gerekçeyle yazılırdı ("hiçbir deneme açıklamadı" — oysa açıklama belli).
  const cut = (run.skipped ?? []).filter((s) => s.cause === 'budget').length
  if (cut > 0) {
    reasons.push(`the attempt budget cut ${cut} case(s), so the run cannot pass`)
  }
  // Yarım kayıt da hiçbir denemeyi `unknown` yapmadan `unknown`; sebep künyede.
  const unreached = (run.skipped ?? []).filter((s) => s.cause === 'interrupted').length
  if (unreached > 0) {
    reasons.push(`the run was interrupted before ${unreached} case(s) started`)
  }
  if (run.partial !== undefined) {
    reasons.push(`the record is incomplete, so it cannot pass: ${run.partial.reason}`)
  }
  const unique = [...new Set(reasons)]
  return unique.length > 0
    ? unique.join(' | ').slice(0, 2000)
    : 'the run produced no verdict and no attempt explained why'
}

export function toCaseResultRow(result: CaseResult): CaseResultRow {
  return {
    caseId: result.caseId,
    passed: result.passed,
    failed: result.failed,
    unknown: result.unknown,
    rateSuccesses: result.passRate.successes,
    rateN: result.passRate.n,
    rateValue: result.passRate.rate,
    ciLow: result.passRate.ci?.low ?? null,
    ciHigh: result.passRate.ci?.high ?? null,
    expectTriggered: result.expectedTrigger ?? null,
    expectsWinner: result.expectedWinner !== undefined,
    expectedWinner: [...(result.expectedWinner ?? [])],
  }
}

export function toAttemptRow(attempt: Attempt): AttemptRow {
  const trigger = attempt.trigger
  return {
    index: attempt.index,
    startedAt: new Date(attempt.startedAt),
    finishedAt: new Date(attempt.finishedAt),
    verdict: VERDICT_TO_DB[attempt.verdict],
    reason: attempt.reason,
    triggerAvailable: trigger.available,
    triggerTriggered: trigger.available ? trigger.triggered : null,
    triggerComplete: trigger.available ? trigger.complete : null,
    triggerVia: trigger.available ? trigger.via : null,
    triggerReason: trigger.available ? null : trigger.reason,
    triggerSkills: trigger.available ? [...trigger.skills] : [],
    // 0.2.0 öncesi kayıtta ikisi de yok: NULL "kontrol yapılmadı" demek,
    // `[]` ise "kontrol yapıldı, red yok". Birbirine çevrilmezler (0.4.1-a).
    triggerRefused: trigger.available ? (trigger.refused ?? null) : null,
    triggerRefusals: trigger.available ? [...(trigger.refusals ?? [])] : [],
    latencyMs: attempt.latencyMs ?? null,
    inputTokens: attempt.cost?.inputTokens ?? null,
    outputTokens: attempt.cost?.outputTokens ?? null,
    costUsd: attempt.cost?.usd ?? null,
  }
}

export function toTraceEventRow(event: TraceEvent): TraceEventRow {
  return {
    seq: event.seq,
    kind: KIND_TO_DB[event.kind],
    at: event.at === undefined ? null : new Date(event.at),
    callId: event.id ?? null,
    callRef: event.callId ?? null,
    tool: event.tool ?? null,
    args: event.args ?? null,
    isError: event.isError ?? null,
    error: event.error ?? null,
    text: event.text ?? null,
    acknowledgesError: event.acknowledgesError ?? null,
    skill: event.skill ?? null,
    outcome: event.outcome === undefined ? null : OUTCOME_TO_DB[event.outcome],
    refusal: event.refusal ?? null,
    hook: event.hook ?? null,
  }
}

export function toEnvDiffRow(env: EnvDiff): EnvDiffRow {
  return {
    writes: [...env.writes],
    deletes: [...env.deletes],
    network: env.network,
    unobserved: [...(env.unobserved ?? [])],
  }
}

// ---------------------------------------------------------------------------
// Satır → kanonik
// ---------------------------------------------------------------------------

export function fromTraceEventRow(row: TraceEventRow): TraceEvent {
  const kind = KIND_FROM_DB[row.kind]
  if (kind === undefined) throw new Error(`unknown trace event kind: ${row.kind}`)
  return {
    seq: row.seq,
    kind,
    ...(row.at === null ? {} : { at: row.at.toISOString() }),
    ...(row.callId === null ? {} : { id: row.callId }),
    ...(row.callRef === null ? {} : { callId: row.callRef }),
    ...(row.tool === null ? {} : { tool: row.tool }),
    ...(row.args === null || row.args === undefined
      ? {}
      : { args: row.args as Readonly<Record<string, unknown>> }),
    ...(row.isError === null ? {} : { isError: row.isError }),
    ...(row.error === null ? {} : { error: row.error }),
    ...(row.text === null ? {} : { text: row.text }),
    ...(row.acknowledgesError === null
      ? {}
      : { acknowledgesError: row.acknowledgesError }),
    ...(row.skill === null ? {} : { skill: row.skill }),
    ...(row.outcome === null ? {} : { outcome: OUTCOME_FROM_DB[row.outcome] }),
    ...(row.refusal === null || row.refusal === undefined
      ? {}
      : { refusal: row.refusal }),
    ...(row.hook === null || row.hook === undefined
      ? {}
      : { hook: row.hook as HookRecord }),
  }
}

export function fromAttemptRow(
  row: AttemptRow,
  caseId: string,
  events: readonly TraceEventRow[] | undefined,
  env: EnvDiffRow | undefined,
): Attempt {
  const verdict = VERDICT_FROM_DB[row.verdict]
  if (verdict === undefined) throw new Error(`unknown verdict: ${row.verdict}`)

  const usd = toNumber(row.costUsd)
  const cost =
    row.inputTokens === null && row.outputTokens === null && usd === null
      ? undefined
      : {
          inputTokens: row.inputTokens ?? 0,
          outputTokens: row.outputTokens ?? 0,
          ...(usd === null ? {} : { usd }),
        }

  return {
    index: row.index,
    caseId,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt.toISOString(),
    trigger: row.triggerAvailable
      ? {
          available: true,
          triggered: row.triggerTriggered ?? false,
          skills: row.triggerSkills,
          ...(row.triggerRefused === null
            ? {}
            : {
                refused: row.triggerRefused,
                refusals: Array.isArray(row.triggerRefusals)
                  ? (row.triggerRefusals as RefusedActivation[])
                  : [],
              }),
          complete: row.triggerComplete ?? false,
          via: row.triggerVia ?? '',
        }
      : { available: false, reason: row.triggerReason ?? '' },
    assertions: [],
    verdict,
    reason: row.reason,
    ...(row.latencyMs === null ? {} : { latencyMs: row.latencyMs }),
    ...(cost === undefined ? {} : { cost }),
    ...(events === undefined ? {} : { trace: events.map(fromTraceEventRow) }),
    ...(env === undefined
      ? {}
      : {
          env: {
            writes: env.writes,
            deletes: env.deletes,
            network: env.network as readonly NetworkRequest[],
            unobserved: env.unobserved,
          },
        }),
  }
}

/** NUMERIC sütunları sayıya çevirir; çevrilemiyorsa `null`, uydurma değer yok. */
function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function fromCaseResultRow(
  row: CaseResultRow,
  attempts: readonly Attempt[],
): CaseResult {
  return {
    caseId: row.caseId,
    ...(row.expectTriggered === null ? {} : { expectedTrigger: row.expectTriggered }),
    // Bayrak kapalıysa iddia yok; açık ve boşsa `winner: none`.
    ...(row.expectsWinner ? { expectedWinner: row.expectedWinner } : {}),
    attempts,
    // Oran satırdan yeniden hesaplanmıyor, saklanan sayımlardan kuruluyor:
    // aynı `proportion` fonksiyonu, aynı sonuç.
    passRate: proportion(row.rateSuccesses, row.rateN),
    passed: row.passed,
    failed: row.failed,
    unknown: row.unknown,
  }
}

export function fromRunRow(row: RunRow, cases: readonly CaseResult[]): Run {
  const verdict = VERDICT_FROM_DB[row.verdict]
  if (verdict === undefined) throw new Error(`unknown verdict: ${row.verdict}`)
  return {
    id: row.id,
    skill: row.skill,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt.toISOString(),
    host: row.host,
    pins: {
      skillSource: row.pinSkillSource,
      skillHash: row.pinSkillHash,
      model: row.pinModel,
      systemPromptHash: row.pinSystemPromptHash,
      suiteVersion: row.pinSuiteVersion,
      suiteHash: row.pinSuiteHash,
      ...(row.pinEnvironmentHash === null ? {} : { environmentHash: row.pinEnvironmentHash }),
    },
    ...(row.permissionMode === null ? {} : { permissionMode: row.permissionMode }),
    // Null alan olarak geri gelmez; okuma `assayVersionLabel` ile "0.3.1 or
    // earlier" der. Migration öncesi satırlarda sütun hiç olmayabilir.
    ...(row.assayVersion === null || row.assayVersion === undefined
      ? {}
      : { assayVersion: row.assayVersion }),
    ...(isEnvironment(row.environment) ? { environment: row.environment } : {}),
    ...(isPartial(row.partial) ? { partial: row.partial } : {}),
    ...(row.concurrency === null ? {} : { concurrency: row.concurrency }),
    // Elle kurulmuş ve migration öncesi satırlarda alan hiç olmayabilir.
    ...((row.layers ?? []).length === 0 ? {} : { layers: row.layers as RunLayer[] }),
    ...(isSkipped(row.skipped) ? { skipped: row.skipped } : {}),
    runs: row.runsPerCase,
    cases,
    verdict,
  }
}

// ---------------------------------------------------------------------------
// Uygulama katmanı kuralı
// ---------------------------------------------------------------------------

export class SuiteNotStorableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SuiteNotStorableError'
  }
}

/**
 * Değişmez #5'in kayıt tarafındaki karşılığı.
 *
 * Şema seviyesinde zorlanamaz: kısıt tek satıra bakar, bu kural suite'in
 * *tamamına* bakıyor. Bu yüzden kaydetmeden önce burada kontrol edilir.
 */
export function assertSuiteStorable(suite: Suite): void {
  // Tanım core'da tek yerde: `triggered: false` ya da `winner: none` (0.4.0).
  const negatives = suite.cases.filter(isNegativeCase)
  if (negatives.length === 0) {
    throw new SuiteNotStorableError(
      'a trigger suite without a negative case cannot be stored: a skill that fires on ' +
        'every request would pass every positive case and look perfect',
    )
  }
}

/** Uyarı düzeyinde: yakın komşu yoksa suite kaydedilir ama işaretlenir. */
export function suiteWarnings(suite: Suite): string[] {
  const warnings: string[] = []
  const negatives = suite.cases.filter(isNegativeCase)
  if (negatives.length > 0 && !negatives.some((c) => isNearNeighbour(c.id))) {
    warnings.push(
      'no near-neighbour case: an unrelated negative is easy to pass, the discriminating ' +
        "signal comes from requests that resemble the skill's scope",
    )
  }
  return warnings
}

/**
 * Ortam kaydinin sekli yerinde mi.
 *
 * Sutun jsonb; oraya ne yazildigi calisma zamaninda bilinmiyor. Sekli
 * tutmayan bir degeri Environment diye gecirmek, karsilastirmanin kayan alani
 * yanlis okumasi demek olurdu — duzeltilen kusurun aynisi, bir katman
 * asagida. Tutmuyorsa alan hic yazilmiyor ve karsilastirma hash duzeyinde
 * konusuyor.
 */
function isEnvironment(value: unknown): value is Environment {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate['model'] === 'string' &&
    typeof candidate['version'] === 'string' &&
    Array.isArray(candidate['tools']) &&
    Array.isArray(candidate['skills']) &&
    Array.isArray(candidate['agents']) &&
    Array.isArray(candidate['plugins'])
  )
}

/**
 * Yarim kalmis kosum kunyesinin sekli yerinde mi.
 *
 * Sebepsiz bir yarim kayit, bir durumu bildirip gerekcesini bildirmemek olurdu.
 * Veritabani kisiti da ayni sarti zorluyor; burasi okuma tarafindaki karsiligi.
 */
function isPartial(value: unknown): value is PartialRun {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate['reason'] === 'string' &&
    candidate['reason'].length > 0 &&
    typeof candidate['recoveredAt'] === 'string'
  )
}

/**
 * Atlanan vaka listesinin sekli yerinde mi.
 *
 * Sebepsiz bir atlama, eksigi bildirip gerekcesini bildirmemek olurdu.
 * Veritabani kisiti da ayni sarti zorluyor; burasi okuma tarafi.
 */
function isSkipped(value: unknown): value is SkippedCase[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Record<string, unknown>)['caseId'] === 'string' &&
        typeof (item as Record<string, unknown>)['reason'] === 'string' &&
        ((item as Record<string, unknown>)['reason'] as string).length > 0 &&
        // `cause` verdict'in dayandığı alan: eksikse kayıt "neden koşulmadı"yı
        // biliyor ama "bu verdict'i etkiler mi"yi bilmiyor.
        ['layer', 'budget', 'interrupted'].includes(
          (item as Record<string, unknown>)['cause'] as string,
        ),
    )
  )
}
