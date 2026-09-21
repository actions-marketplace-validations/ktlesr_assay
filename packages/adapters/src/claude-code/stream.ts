/**
 * Claude Code `--output-format stream-json` akışının ayrıştırıcısı.
 *
 * Saf: I/O yok, süreç yok. Girdi ayrıştırılmış JSON satırları, çıktı kanonik
 * `TraceEvent` dizisi ve oturum özeti. Bu ayrım, adaptörü gerçek bir koşum
 * yapmadan test edilebilir kılıyor — akış örnekleri gerçek koşumlardan alındı
 * (`src/__fixtures__`).
 *
 * Akışın şekli docs/host-feasibility.md'de deneyle belgelendi.
 */

import type {
  HookRecord,
  RefusedActivation,
  SessionOutcome,
  TraceEvent,
} from '@ktlsr/assay-core'

/**
 * Hook çıktısının kayda giren en fazla uzunluğu.
 *
 * Hook stdout'u gerçek koşumlarda on binlerce karakter olabiliyor ve kayıt bir
 * CI artefaktı. Kesme sessiz değil: kesilen metnin sonunda toplam uzunluk
 * yazıyor, yani okuyucu neyi görmediğini biliyor.
 */
const HOOK_OUTPUT_LIMIT = 2000

// ---------------------------------------------------------------------------
// Ham akış tipleri — host'un verdiği kadarı
// ---------------------------------------------------------------------------

/** `system/init` — koşumun ilk olayı, aktif kurulumun tamamını taşır. */
export interface InitEvent {
  sessionId: string
  model: string
  cwd: string
  version: string
  permissionMode: string
  outputStyle: string
  tools: readonly string[]
  /** Bu oturumda görünür olan skill'ler. Tetiklenme kümesinin evreni. */
  skills: readonly string[]
  agents: readonly string[]
  plugins: readonly { name: string; version?: string; source?: string }[]
}

/**
 * Host'un reddettiği bir araç çağrısı.
 *
 * `result.permission_denials` alanı bunu zaten bildiriyor; 0.2.0'a kadar
 * ayrıştırıcı okumuyordu ve red, sıradan bir araç hatasından ayırt
 * edilemiyordu.
 */
export interface PermissionDenial {
  tool: string
  /** Reddedilen `tool_use` bloğunun kimliği. Host vermiyorsa yok. */
  toolUseId?: string
}

/** Akışın son olayı. */
export interface ResultEvent {
  subtype: string
  isError: boolean
  numTurns: number
  stopReason?: string
  terminalReason?: string
  durationMs?: number
  costUsd?: number
  inputTokens: number
  outputTokens: number
  /** Ajanın son metni. */
  text?: string
  /** Host'un reddettiği araç çağrıları. Boş dizi "red olmadı" demek. */
  permissionDenials: PermissionDenial[]
}

export interface ParsedStream {
  init?: InitEvent
  result?: ResultEvent
  trace: TraceEvent[]
  /**
   * **Aktive olduğu doğrulanan** skill'ler, sırayla.
   *
   * `Skill` çağrısının varlığı yetmez: eşleşen `tool_result` hatasız olmalı
   * ve skill gövdesini taşımalı. Reddedilen bir çağrı buraya girmez,
   * `refusals`a girer.
   */
  triggeredSkills: string[]
  /** Seçilmiş ama aktivasyonu doğrulanamamış skill çağrıları. */
  refusals: RefusedActivation[]
  /** Ayrıştırılamayan satırlar. Boş değilse sinyal eksik olabilir. */
  malformed: number
}

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const str = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

const num = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []

/** `tool_result` içeriği string ya da blok dizisi olabilir; metne indirger. */
function contentToText(content: unknown): string | undefined {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    const parts = content
      .map((block) => (isRecord(block) ? str(block['text']) : undefined))
      .filter((t): t is string => t !== undefined)
    if (parts.length > 0) return parts.join('\n')
    return JSON.stringify(content)
  }
  if (content === undefined || content === null) return undefined
  return JSON.stringify(content)
}

/** Uzun hook çıktısını keser ve kestiğini söyler. */
function clip(value: string | undefined): string | undefined {
  if (value === undefined || value === '') return undefined
  return value.length <= HOOK_OUTPUT_LIMIT
    ? value
    : `${value.slice(0, HOOK_OUTPUT_LIMIT)}… (truncated, ${value.length} chars total)`
}

/** `system/hook_started` ve `system/hook_response` olaylarını kanonik hâle getirir. */
function hookOf(event: Record<string, unknown>, phase: 'started' | 'response'): HookRecord {
  const exitCode = num(event['exit_code'])
  const outcome = str(event['outcome'])
  const stdout = clip(str(event['stdout']))
  const stderr = clip(str(event['stderr']))
  return {
    name: str(event['hook_name']) ?? '',
    event: str(event['hook_event']) ?? '',
    phase,
    ...(exitCode === undefined ? {} : { exitCode }),
    ...(outcome === undefined ? {} : { outcome }),
    ...(stdout === undefined ? {} : { stdout }),
    ...(stderr === undefined ? {} : { stderr }),
  }
}

/** `result.permission_denials` — alan adları hem snake hem camel gelebiliyor. */
function denialsOf(value: unknown): PermissionDenial[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!isRecord(entry)) return []
    const tool = str(entry['tool_name']) ?? str(entry['toolName']) ?? str(entry['tool'])
    if (tool === undefined) return []
    const toolUseId = str(entry['tool_use_id']) ?? str(entry['toolUseId'])
    return [{ tool, ...(toolUseId === undefined ? {} : { toolUseId }) }]
  })
}

/**
 * `session_end` sonucunu host'un bildirdiği alanlardan türetir.
 *
 * Girdi tam bir `ResultEvent` değil, yalnızca kullandığı üç alan: sonuç bu
 * üçünden başka hiçbir şeye bakmasın diye.
 */
export function outcomeOf(
  result: Pick<ResultEvent, 'isError' | 'subtype' | 'terminalReason'>,
): SessionOutcome {
  if (result.isError) return 'error'
  if (result.terminalReason !== undefined && result.terminalReason !== 'completed') {
    return 'aborted'
  }
  return result.subtype === 'success' ? 'completed' : 'error'
}

// ---------------------------------------------------------------------------
// Ayrıştırma
// ---------------------------------------------------------------------------

/** JSONL metnini satır satır ayrıştırır; bozuk satırları sayar, atmaz. */
export function parseStreamJson(source: string): unknown[] {
  const out: unknown[] = []
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed === '' || !trimmed.startsWith('{')) continue
    try {
      out.push(JSON.parse(trimmed))
    } catch {
      out.push(null) // bozuk satır; sayılacak
    }
  }
  return out
}

/** Bir `Skill` çağrısı ve akışta nereye düştüğü. */
interface SkillCall {
  skill: string
  id: string | undefined
  /** `trace` içinde `tool_call` olayının indeksi; tetiklenme onun ardına girer. */
  at: number
}

/** Bir `Skill` çağrısının sonucu. */
interface SkillOutcome {
  isError: boolean
  /** Sonucun metni. Skill gövdesi buradan gelir. */
  text: string | undefined
}

/**
 * Ham olayları kanonik ize çevirir.
 *
 * **Tetiklenme, çağrının varlığı değil aktivasyonun doğrulanmasıdır.** Bir
 * `Skill` araç çağrısı, ancak eşleşen `tool_result` hatasızsa ve skill
 * gövdesini taşıyorsa `skill_trigger` üretir. Reddedilen, hata dönen ya da
 * sonucu hiç gelmeyen bir çağrı `refusals`a girer ve tetiklenme sayılmaz;
 * ölçüm o attempt için yapılmamıştır (değişmez #1).
 *
 * 0.2.0 öncesi yalnızca çağrıya bakıyordu: reddedilen dört aktivasyon dört
 * tetiklenme olarak raporlandı ve precision %100 çıktı.
 *
 * `seq` numaraları döngü bittikten sonra atanıyor, çünkü bir çağrının
 * tetiklenme sayılıp sayılmadığı ancak `tool_result` ve akışın sonundaki
 * `permission_denials` görüldükten sonra bilinebiliyor.
 */
export function parseSession(events: readonly unknown[]): ParsedStream {
  const trace: Omit<TraceEvent, 'seq'>[] = []
  const skillCalls: SkillCall[] = []
  const skillOutcomes = new Map<string, SkillOutcome>()
  /** tool_use id → araç adı; tool_result'ı aracına bağlamak için. */
  const toolById = new Map<string, string>()
  /** tool_use id → `trace` indeksi; red bilgisi sonradan işaretleniyor. */
  const callIndexById = new Map<string, number>()
  const resultIndexByCallId = new Map<string, number>()
  let init: InitEvent | undefined
  let result: ResultEvent | undefined
  let malformed = 0

  for (const event of events) {
    if (!isRecord(event)) {
      malformed += 1
      continue
    }
    const type = str(event['type'])

    if (type === 'system' && str(event['subtype']) === 'init') {
      init = {
        sessionId: str(event['session_id']) ?? '',
        model: str(event['model']) ?? '',
        cwd: str(event['cwd']) ?? '',
        version: str(event['claude_code_version']) ?? '',
        permissionMode: str(event['permissionMode']) ?? '',
        outputStyle: str(event['output_style']) ?? '',
        tools: strings(event['tools']),
        skills: strings(event['skills']),
        agents: strings(event['agents']),
        plugins: Array.isArray(event['plugins'])
          ? event['plugins'].flatMap((p) => {
              if (!isRecord(p)) return []
              const name = str(p['name'])
              if (name === undefined) return []
              const version = str(p['version'])
              const source = str(p['source'])
              return [
                {
                  name,
                  ...(version === undefined ? {} : { version }),
                  ...(source === undefined ? {} : { source }),
                },
              ]
            })
          : [],
      }
      continue
    }

    // Hook'lar ölçümün görünmez değişkeni: sistem promptuna metin enjekte
    // edebilir, araç çağrısını reddedebilirler. Akışta zaten varlar.
    if (type === 'system') {
      const subtype = str(event['subtype'])
      if (subtype === 'hook_started' || subtype === 'hook_response') {
        trace.push({
          kind: 'hook',
          hook: hookOf(event, subtype === 'hook_started' ? 'started' : 'response'),
        })
      }
      continue
    }

    if (type === 'result') {
      const usage = isRecord(event['usage']) ? event['usage'] : {}
      const text = str(event['result'])
      result = {
        subtype: str(event['subtype']) ?? '',
        isError: event['is_error'] === true,
        numTurns: num(event['num_turns']) ?? 0,
        ...(str(event['stop_reason']) === undefined
          ? {}
          : { stopReason: str(event['stop_reason']) as string }),
        ...(str(event['terminal_reason']) === undefined
          ? {}
          : { terminalReason: str(event['terminal_reason']) as string }),
        ...(num(event['duration_ms']) === undefined
          ? {}
          : { durationMs: num(event['duration_ms']) as number }),
        ...(num(event['total_cost_usd']) === undefined
          ? {}
          : { costUsd: num(event['total_cost_usd']) as number }),
        inputTokens: num(usage['input_tokens']) ?? 0,
        outputTokens: num(usage['output_tokens']) ?? 0,
        ...(text === undefined ? {} : { text }),
        permissionDenials: denialsOf(event['permission_denials']),
      }
      continue
    }

    const message = isRecord(event['message']) ? event['message'] : undefined
    const blocks =
      message !== undefined && Array.isArray(message['content'])
        ? message['content']
        : undefined
    if (blocks === undefined) continue

    for (const block of blocks) {
      if (!isRecord(block)) continue
      const kind = str(block['type'])

      if (kind === 'tool_use') {
        const tool = str(block['name']) ?? ''
        const id = str(block['id'])
        if (id !== undefined) toolById.set(id, tool)
        const args = isRecord(block['input']) ? block['input'] : undefined
        const at = trace.length
        trace.push({
          kind: 'tool_call',
          tool,
          ...(id === undefined ? {} : { id }),
          ...(args === undefined ? {} : { args }),
        })
        if (id !== undefined) callIndexById.set(id, at)
        // Aday tetiklenme. Aktivasyonun doğrulanması döngüden sonra.
        if (tool === 'Skill' && args !== undefined) {
          const skill = str(args['skill'])
          if (skill !== undefined) skillCalls.push({ skill, id, at })
        }
        continue
      }

      if (kind === 'tool_result') {
        const id = str(block['tool_use_id'])
        const tool = id === undefined ? undefined : toolById.get(id)
        const isError = block['is_error'] === true
        const text = contentToText(block['content'])
        if (id !== undefined) {
          resultIndexByCallId.set(id, trace.length)
          if (tool === 'Skill') skillOutcomes.set(id, { isError, text })
        }
        trace.push({
          kind: 'tool_result',
          ...(id === undefined ? {} : { callId: id }),
          ...(tool === undefined ? {} : { tool }),
          ...(isError ? { isError: true } : {}),
          ...(isError && text !== undefined ? { error: text } : {}),
        })
        continue
      }

      if (kind === 'text') {
        const text = str(block['text'])
        if (text === undefined || text.trim() === '') continue
        trace.push({ kind: 'assistant_message', text })
      }
    }
  }

  if (result !== undefined) {
    trace.push({ kind: 'session_end', outcome: outcomeOf(result) })
  }

  // -------------------------------------------------------------------------
  // Red: host zaten bildiriyor, 0.2.0'a kadar okunmuyordu
  // -------------------------------------------------------------------------

  const denials = result?.permissionDenials ?? []
  const deniedIds = new Set(
    denials.map((d) => d.toolUseId).filter((id): id is string => id !== undefined),
  )
  for (const denial of denials) {
    if (denial.toolUseId === undefined) continue
    // Red, çağrının SONUCUNA işlenir; sonuç hiç gelmediyse çağrının kendisine.
    const index =
      resultIndexByCallId.get(denial.toolUseId) ?? callIndexById.get(denial.toolUseId)
    if (index === undefined) continue
    const event = trace[index]
    if (event !== undefined) {
      trace[index] = {
        ...event,
        refusal: `the host denied permission to use ${denial.tool}`,
      }
    }
  }

  // -------------------------------------------------------------------------
  // Aktivasyon doğrulaması
  // -------------------------------------------------------------------------

  const triggeredSkills: string[] = []
  const refusals: RefusedActivation[] = []
  const activated: SkillCall[] = []

  // Önce karar, sonra ekleme. İki aşama, çünkü `splice` sonraki indeksleri
  // kaydırıyor ve red işaretleri ekleme öncesi indekslere dayanıyor.
  for (const call of skillCalls) {
    const reason = activationFailure(call, skillOutcomes, deniedIds)
    if (reason === null) {
      triggeredSkills.push(call.skill)
      activated.push(call)
      continue
    }
    refusals.push({ skill: call.skill, reason })
    const index = call.id === undefined ? call.at : (resultIndexByCallId.get(call.id) ?? call.at)
    const event = trace[index]
    if (event !== undefined && event.refusal === undefined) {
      trace[index] = { ...event, refusal: reason }
    }
  }

  // Sondan başa eklemek, henüz işlenmemiş indekslerin kaymasını engelliyor.
  for (const call of [...activated].reverse()) {
    trace.splice(call.at + 1, 0, { kind: 'skill_trigger', skill: call.skill })
  }

  return {
    ...(init === undefined ? {} : { init }),
    ...(result === undefined ? {} : { result }),
    trace: trace.map((event, index) => ({ ...event, seq: index + 1 })),
    triggeredSkills,
    refusals,
    malformed,
  }
}

/**
 * Bir `Skill` çağrısı neden aktivasyon sayılmadı — sayıldıysa `null`.
 *
 * Dört engel, hepsi yapısal (metin eşleştirmesi yok):
 *  1. Host çağrıyı açıkça reddetti (`permission_denials`).
 *  2. Eşleşen `tool_result` hata döndü.
 *  3. Sonuç geldi ama gövde boş — skill'in içeriği oturuma girmedi.
 *  4. Sonuç hiç gelmedi — aktivasyon doğrulanamadı.
 *
 * Tavan açık: 3 numara, host'un başarılı bir `Skill` sonucunu her zaman
 * gövdeyle döndürdüğü varsayımına dayanıyor. Varsayım bozulursa her aktivasyon
 * reddedilmiş görünür ve her vaka `unknown` olur — gürültülü ama sessiz geçiş
 * değil (docs/adapters.md).
 */
function activationFailure(
  call: SkillCall,
  outcomes: ReadonlyMap<string, SkillOutcome>,
  deniedIds: ReadonlySet<string>,
): string | null {
  if (call.id === undefined) {
    return 'the Skill call carried no id, so its result could not be matched'
  }
  if (deniedIds.has(call.id)) {
    return 'the host denied permission for the Skill call, so the skill never loaded'
  }
  const outcome = outcomes.get(call.id)
  if (outcome === undefined) {
    return 'the Skill call has no matching tool_result, so the activation was never confirmed'
  }
  if (outcome.isError) {
    const detail = (outcome.text ?? '').trim().slice(0, 160)
    return `the Skill call failed${detail === '' ? '' : `: ${detail}`}`
  }
  if ((outcome.text ?? '').trim() === '') {
    return 'the Skill call succeeded but carried no skill body, so nothing was injected'
  }
  return null
}
