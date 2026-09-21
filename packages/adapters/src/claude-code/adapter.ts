/**
 * Claude Code adaptörü.
 *
 * 0.6 fizibilite raporunun bulgularını uygular:
 *  - Her koşum kendi geçici `CLAUDE_CONFIG_DIR`'ında yürür; kullanıcının global
 *    skill'leri devreye girmez (izole edilmemiş bir probe koşumunda 119 skill
 *    aktifti ve hedef skill hiç tetiklenmedi).
 *  - `CLAUDE_CONFIG_DIR` kullanıcının CLAUDE.md'sini **tek başına kesmiyor**:
 *    host çalışma dizininden köke kadar her dizinde talimat dosyası arıyor ve
 *    Windows'ta `%TEMP%` ev dizininin altında (0.4.5). Üst dizinler
 *    `claudeMdExcludes` ile dışlanıyor ve yüklenen her dosya host'un kendi
 *    `InstructionsLoaded` kancasıyla **ölçülüp** kayda yazılıyor.
 *  - Test edilen skill `--plugin-dir` ile yalnızca o oturuma yüklenir.
 *  - Tetiklenme yalnızca `Skill` araç çağrısından okunur; metinden çıkarım yok.
 *  - `subtype: "success"` tek başına tamamlama kanıtı sayılmaz. Kimliği
 *    olmayan bir koşum `success` + `cost: 0` raporlamıştı; çapraz kontrol şart.
 *  - Sistem promptu hash'i host tarafından verilmiyor. Türetilen hash
 *    `environmentHash` adıyla döner, `systemPromptHash` boş kalır.
 */

import { createHash } from 'node:crypto'
import { execFile, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { delimiter, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import type {
  AgentSession,
  Environment,
  HostAdapter,
  RunConfig,
  SessionResult,
  TraceEvent,
  TriggerObservation,
} from '@ktlsr/assay-core'
import { parseSession, parseStreamJson, type ParsedStream } from './stream.js'

export interface ClaudeCodeSession extends AgentSession {
  /** Suite'teki `target.skill` — tetiklenme bununla eşleştirilir. */
  readonly targetSkill: string
  readonly parsed: ParsedStream
  readonly exitCode: number | null
  readonly latencyMs: number
  readonly stderr: string
  /** Koşum hiç başlayamadıysa nedeni. */
  readonly spawnError?: string
  readonly configDir: string
  /**
   * Host'un yüklediği talimat dosyaları — ölçülmüşse. `undefined` "ölçülmedi"
   * demek, "yüklenmedi" değil (bkz. `Environment.memory`).
   */
  readonly memory?: readonly string[]
}

/** Claude Code'un kabul ettiği izin modları. */
export const PERMISSION_MODES = [
  'acceptEdits',
  'default',
  'dontAsk',
  'plan',
  'bypassPermissions',
] as const

export type PermissionMode = (typeof PERMISSION_MODES)[number]

export const isPermissionMode = (value: string): value is PermissionMode =>
  (PERMISSION_MODES as readonly string[]).includes(value)

export interface ClaudeCodeAdapterOptions {
  /** `claude` çalıştırılabiliri. Varsayılan: PATH'teki `claude`. */
  binary?: string
  /**
   * Kimlik bilgisi. Verilmezse `process.env`'deki
   * `CLAUDE_CODE_OAUTH_TOKEN` / `ANTHROPIC_API_KEY` kullanılır.
   * İzole config dizini OAuth oturumunu devralmaz, bu yüzden biri şart.
   */
  credentials?: { oauthToken?: string; apiKey?: string }
  /**
   * Host izin modu. Varsayılan `acceptEdits` — 0.2.0'da değişmedi: ajan
   * sandbox çalışma dizininde dosya yazabilsin. `dontAsk` Write ve Bash'i
   * reddediyor ve tamamlama vakalarını ölçülemez kılıyor (canlı koşumda
   * görüldü).
   *
   * 0.2.0'da yalnızca **dışarı açıldı**: `allowed-tools` beyan eden bir skill
   * `acceptEdits` altında aktive olamıyor ve ölçüm o skill için yapılamıyordu.
   * Seçimi kullanıcının yapabilmesi gerekiyor; ama mod ölçümün koşulu olduğu
   * için kayda ve ortam hash'ine giriyor.
   */
  permissionMode?: PermissionMode
  /**
   * `bypassPermissions` ölçülen skill'e makinenin tamamını açar ve sandbox
   * iddiasını tamamen boşaltır. Bilerek istenmediği sürece reddedilir.
   */
  allowBypassPermissions?: boolean
  /**
   * Reddedilecek araçlar. Varsayılan olarak ağ araçları kapalı; `side_effect`
   * assertion'ının `network: deny` iddiası ancak böyle dürüst olur.
   */
  deniedTools?: readonly string[]
  /** Varsayılan attempt zaman aşımı. */
  timeoutMs?: number
  /** Geçici config dizinleri koşumdan sonra silinsin mi. Hata ayıklarken false. */
  cleanup?: boolean
}

/**
 * Ajan sürecine geçirilen ortam değişkenleri.
 *
 * Süreç yönetimi için gerekenler ve host'un kendi ayarları. Kimlik bilgisi
 * ayrıca ekleniyor. Bunun dışındaki hiçbir değişken geçmez.
 */
const ENV_PASSTHROUGH = [
  'PATH',
  'Path',
  'HOME',
  'USERPROFILE',
  'HOMEDRIVE',
  'HOMEPATH',
  'TMPDIR',
  'TEMP',
  'TMP',
  'SystemRoot',
  'SystemDrive',
  'windir',
  'COMSPEC',
  'PATHEXT',
  'LANG',
  'LC_ALL',
  'TZ',
  'NODE_OPTIONS',
  'ANTHROPIC_BASE_URL',
  'HTTPS_PROXY',
  'HTTP_PROXY',
  'NO_PROXY',
  /*
   * Host'un zorunlu olmayan trafiği (telemetri, güncelleme denetimi). Konteyner
   * koşumunda runner `1` veriyor; K0'da açıkken host `api.anthropic.com`'a beş
   * bağlantı açıyordu ve iç ağda çıkış proxy'si hepsini reddediyordu. Değer bir
   * ayar, sır değil. Model davranışını değiştirmiyor; hash'e girmiyor.
   */
  'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
  /*
   * Port kirası (0.3.0-d).
   *
   * Eş zamanlı denemelerin ajanları aynı portu istemesin diye işçi başına
   * ayrık bir aralık veriliyor. Bu üçünü Assay yazıyor, kullanıcının
   * ortamından gelmiyorlar; allowlist'in sır hijyeni gerekçesi (H1) burada
   * zedelenmiyor.
   *
   * Yumuşatma, garanti değil: sabit port yazan bir dev sunucu bunları okumaz.
   */
  'PORT',
  'VITE_PORT',
  'ASSAY_PORT_RANGE',
] as const

export function passthroughEnv(): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {}
  for (const key of ENV_PASSTHROUGH) {
    const value = process.env[key]
    if (value !== undefined) out[key] = value
  }
  return out
}

/**
 * Ağ araçları varsayılan olarak kapalı.
 *
 * Sandbox işletim sistemi seviyesinde ağı engellemiyor; host'un araç izni
 * mekanizmasıyla engelliyor. `side_effect: { network: deny }` iddiasının
 * dayandığı tek gerçek bu — ve tavanı: süreç kendi başına soket açarsa
 * görülmez (1.3 güvenlik incelemesi).
 */
const DEFAULT_DENIED_TOOLS: readonly string[] = ['WebFetch', 'WebSearch']

/**
 * `claude` çalıştırılabilirini PATH üzerinde çözer.
 *
 * Neden: Windows'ta Node 22 `.cmd` dosyalarını kabuk olmadan spawn etmiyor
 * (CVE-2024-27980), kabuk kullanınca da çok satırlı argümanlar bozuluyor.
 * Claude Code yerel bir `.exe` dağıttığı için tam yolu bulup doğrudan spawn
 * etmek her iki sorunu da ortadan kaldırıyor. `.exe` bulunamazsa kabuğa
 * düşülür ve bu durum `shell` bayrağıyla bildirilir.
 */
export function resolveBinary(binary: string): { command: string; shell: boolean } {
  if (process.platform !== 'win32') return { command: binary, shell: false }
  if (isAbsolute(binary) && existsSync(binary)) return { command: binary, shell: false }

  const dirs = (process.env['PATH'] ?? '').split(delimiter).filter(Boolean)
  for (const dir of dirs) {
    for (const extension of ['.exe', '.com']) {
      const candidate = join(dir, `${binary}${extension}`)
      if (existsSync(candidate)) return { command: candidate, shell: false }
    }
  }
  // Yalnızca .cmd/.bat varsa kabuk şart; çok satırlı istem stdin'den gider.
  return { command: binary, shell: true }
}

export class ClaudeCodeAdapter implements HostAdapter<ClaudeCodeSession> {
  readonly id = 'claude-code'

  readonly #binary: string
  readonly #credentials: { oauthToken?: string; apiKey?: string } | undefined
  readonly #timeoutMs: number
  readonly #cleanup: boolean
  readonly #permissionMode: string
  readonly #deniedTools: readonly string[]

  constructor(options: ClaudeCodeAdapterOptions = {}) {
    this.#binary = options.binary ?? 'claude'
    this.#credentials = options.credentials
    this.#timeoutMs = options.timeoutMs ?? 600_000
    this.#cleanup = options.cleanup ?? true
    if (
      options.permissionMode === 'bypassPermissions' &&
      options.allowBypassPermissions !== true
    ) {
      throw new Error(
        'permissionMode "bypassPermissions" removes every boundary the sandbox observes; ' +
          'pass allowBypassPermissions: true to state that you meant it',
      )
    }
    this.#permissionMode = options.permissionMode ?? 'acceptEdits'
    this.#deniedTools = options.deniedTools ?? DEFAULT_DENIED_TOOLS
  }

  /** Reddedilen araçlar — runner ağ iddiasını buna göre işaretler. */
  get deniedTools(): readonly string[] {
    return this.#deniedTools
  }

  /**
   * İstenen izin modu.
   *
   * Kayda host'un bildirdiği mod yazılır; bu, adaptörün ne istediği. İkisi
   * ayrışırsa fark gerçek bir bulgudur.
   */
  get permissionMode(): string {
    return this.#permissionMode
  }

  async start(config: RunConfig): Promise<ClaudeCodeSession> {
    const configDir = await mkdtemp(join(tmpdir(), 'assay-cc-'))
    await writeMemoryProbe(configDir, config.workdir)
    const startedAt = new Date().toISOString()
    const began = Date.now()

    // İstem argüman olarak değil stdin'den gider: uzun istemler ARG_MAX'e
    // takılmasın, çok satırlı istemler kabuk tarafından bozulmasın.
    const args = [
      '-p',
      '--output-format',
      'stream-json',
      '--verbose',
      '--model',
      config.model,
      '--permission-mode',
      this.#permissionMode,
      '--plugin-dir',
      config.skill.path,
      ...(this.#deniedTools.length === 0
        ? []
        : ['--disallowed-tools', this.#deniedTools.join(' ')]),
    ]

    // Ajan süreci tüm ortamı DEVRALMAZ. Devralsaydı ölçülen skill,
    // GITHUB_TOKEN'dan veritabanı şifresine kadar her şeyi okuyabilirdi ve
    // izine yazabilirdi. Yalnızca çalışması için gereken değişkenler geçer.
    const env: NodeJS.ProcessEnv = {
      ...passthroughEnv(),
      // İzolasyon: kullanıcının skill'leri ve plugin'leri devrede olmasın.
      // CLAUDE.md'yi bu tek başına kesmiyor — üst dizin taraması ayrıca
      // dışlanıyor ve ölçülüyor (writeMemoryProbe).
      CLAUDE_CONFIG_DIR: configDir,
    }
    const oauth = this.#credentials?.oauthToken ?? process.env['CLAUDE_CODE_OAUTH_TOKEN']
    const apiKey = this.#credentials?.apiKey ?? process.env['ANTHROPIC_API_KEY']
    if (oauth !== undefined && oauth !== '') env['CLAUDE_CODE_OAUTH_TOKEN'] = oauth
    if (apiKey !== undefined && apiKey !== '') env['ANTHROPIC_API_KEY'] = apiKey

    const spawned = await run(this.#binary, args, {
      cwd: config.workdir,
      env,
      timeoutMs: config.timeoutMs ?? this.#timeoutMs,
      stdin: config.prompt,
    })

    const parsed = parseSession(parseStreamJson(spawned.stdout))
    // Config dizini finalize'da siliniyor; ölçüm ondan önce okunmalı.
    const memory = await readMemoryProbe(configDir, config.workdir)

    return {
      id: `${this.id}-${config.caseId}-${config.attempt}-${parsed.init?.sessionId ?? began}`,
      adapter: this.id,
      startedAt,
      targetSkill: config.skill.name,
      parsed,
      exitCode: spawned.exitCode,
      latencyMs: Date.now() - began,
      stderr: spawned.stderr,
      ...(spawned.error === undefined ? {} : { spawnError: spawned.error }),
      configDir,
      ...(memory === undefined ? {} : { memory }),
    }
  }

  /**
   * Tetiklenme sinyali.
   *
   * Okunabilir olması için oturumun *gerçekten koştuğunu* bilmek gerekiyor:
   * kimliği olmayan bir koşum `Skill` çağrısı üretmez ve bu, "tetiklenmedi"
   * ile karıştırılamaz. Bu yüzden çapraz kontrol düşerse sinyal okunamamış
   * sayılır.
   */
  async readTriggerSignal(session: ClaudeCodeSession): Promise<TriggerObservation> {
    const problem = sessionProblem(session)
    if (problem !== null) return { available: false, reason: problem }

    const { init, triggeredSkills, refusals } = session.parsed
    if (init === undefined) {
      return {
        available: false,
        reason:
          'the stream carried no system/init event, so the active skill set is unknown',
      }
    }

    const triggered = triggeredSkills.some((skill) =>
      skillMatches(skill, session.targetSkill),
    )

    return {
      available: true,
      triggered,
      skills: [...new Set(triggeredSkills)],
      // Hedef skill seçildi ama gövdesi oturuma girmedi. Aynı skill başka bir
      // çağrıda aktive olduysa red bir şey değiştirmiyor: ölçüm yapılmıştır.
      refused:
        !triggered && refusals.some((r) => skillMatches(r.skill, session.targetSkill)),
      refusals,
      // Model tarafından seçilen her skill çağrısı Skill aracından geçer, ve
      // init aktif skill setinin tamamını verir; liste eksik değil.
      complete: true,
      via: 'confirmed Skill activation in stream-json',
    }
  }

  async readTrace(
    session: ClaudeCodeSession,
  ): Promise<readonly TraceEvent[] | undefined> {
    if (session.spawnError !== undefined) return undefined
    if (session.parsed.trace.length === 0 && session.parsed.result === undefined) {
      return undefined // akış hiç gelmedi; boş iz "araç çağrılmadı" demek olurdu
    }
    return session.parsed.trace
  }

  async finalize(session: ClaudeCodeSession): Promise<SessionResult> {
    if (this.#cleanup) {
      await rm(session.configDir, { recursive: true, force: true }).catch(() => undefined)
    }

    const { result, init } = session.parsed
    const problem = sessionProblem(session)

    const base: SessionResult = {
      outcome: problem !== null ? 'error' : 'completed',
      finishedAt: new Date().toISOString(),
      latencyMs: session.latencyMs,
      ...(session.exitCode === null ? {} : { exitCode: session.exitCode }),
      ...(init === undefined ? {} : { activeSkills: init.skills }),
      ...(init === undefined ? {} : { environmentHash: environmentHash(init, session.memory) }),
      ...(init === undefined ? {} : { environment: environmentOf(init, session.memory) }),
      // Host'un BİLDİRDİĞİ mod; adaptörün istediği değil. İkisi ayrışırsa
      // ölçümün koşulu host'un söylediğidir.
      // Host'un BİLDİRDİĞİ mod; adaptörün istediği değil. İkisi ayrışırsa
      // ölçümün koşulu host'un söylediğidir.
      ...(init === undefined || init.permissionMode === ''
        ? {}
        : { permissionMode: init.permissionMode }),
    }

    if (result === undefined) return base

    const cost =
      result.inputTokens > 0 || result.outputTokens > 0 || result.costUsd !== undefined
        ? {
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            ...(result.costUsd === undefined ? {} : { usd: result.costUsd }),
          }
        : undefined

    return {
      ...base,
      outcome:
        problem !== null
          ? 'error'
          : result.isError
            ? 'error'
            : result.terminalReason !== undefined && result.terminalReason !== 'completed'
              ? 'aborted'
              : 'completed',
      ...(result.durationMs === undefined ? {} : { latencyMs: result.durationMs }),
      ...(cost === undefined ? {} : { cost }),
    }
    // systemPromptHash bilerek yok: host vermiyor, uydurulmaz.
  }
}

// ---------------------------------------------------------------------------
// Çapraz kontrol
// ---------------------------------------------------------------------------

/**
 * Oturum gerçekten koştu mu?
 *
 * Host iyimser davranıyor: kimliği olmayan bir koşum `subtype: "success"`,
 * `is_error: false`, `cost: 0` raporladı ve hiç gerçekleşmemişti. Bu kontrol
 * o yalanı yakalar. `null` dönerse oturum sağlam.
 */
function sessionProblem(session: ClaudeCodeSession): string | null {
  if (session.spawnError !== undefined) {
    return `the host process could not be started: ${session.spawnError}`
  }
  const { result } = session.parsed
  if (result === undefined) {
    return 'the stream carried no result event, so it is unknown how the session ended'
  }
  if (result.isError) {
    return `the host reported an error: ${(result.text ?? '').slice(0, 200) || result.subtype}`
  }
  if (result.numTurns === 0) {
    return 'the session reported zero turns: nothing was actually run'
  }
  if (result.outputTokens === 0) {
    return `the session produced no output tokens, so it did not really run (${(result.text ?? '').slice(0, 200)})`
  }
  if (result.terminalReason !== undefined && result.terminalReason !== 'completed') {
    return `the session ended as "${result.terminalReason}"`
  }
  return null
}

/**
 * Gözlenen skill adı hedefle eşleşiyor mu?
 *
 * Claude Code plugin'den gelen skill'leri `plugin:skill` biçiminde de
 * raporlayabiliyor (gerçek transkriptlerde `impeccable:impeccable` görüldü).
 * Karşılaştırma bu ad alanını hesaba katar; başka hiçbir gevşetme yapılmaz.
 */
export function skillMatches(observed: string, target: string): boolean {
  if (observed === target) return true
  const colon = observed.lastIndexOf(':')
  return colon !== -1 && observed.slice(colon + 1) === target
}

/**
 * `init` alanlarından deterministik ortam hash'i.
 *
 * Bu **sistem promptu hash'i değildir** — iki farklı sistem promptu aynı init
 * alanlarını üretebilir. Yine de gerçek bir kayma detektörü: model, sürüm,
 * araç seti, skill seti, izin modu veya output style değişirse hash değişir.
 *
 * İzin modu 0.2.0'da eklendi. Mod dışarı açıldığı andan itibaren ölçümün bir
 * koşulu: araçları kısıtlanmış bir skill ile kısıtlanmamış olan aynı skill
 * değil. Hash'te olmasaydı iki farklı ölçüm karşılaştırılabilir görünürdü.
 * Bedeli: 0.2.0 öncesi kayıtlar yeni kayıtlarla "ortam kaydı" olarak
 * karşılaştırılır ve `unknown` üretir.
 */
export function environmentHash(
  init: NonNullable<ParsedStream['init']>,
  memory?: readonly string[],
): string {
  const canonical = JSON.stringify(environmentOf(init, memory))
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`
}

/**
 * Hash'in girdisi olan nesnenin kendisi.
 *
 * Eskiden yalnızca hash hesaplanıp nesne atılıyordu; karşılaştırma da bu
 * yüzden "bir şey değişti" diyebiliyor, "ne değişti" diyemiyordu. İkisi
 * ayrışmasın diye hash bu fonksiyondan besleniyor: alan eklenirse hash de
 * kayıt da aynı anda öğrenir.
 */
export function environmentOf(
  init: NonNullable<ParsedStream['init']>,
  memory?: readonly string[],
): Environment {
  return {
    model: init.model,
    version: init.version,
    outputStyle: init.outputStyle,
    permissionMode: init.permissionMode,
    tools: [...init.tools].sort(),
    skills: [...init.skills].sort(),
    agents: [...init.agents].sort(),
    plugins: init.plugins.map((p) => `${p.name}@${p.version ?? ''}`).sort(),
    // Yalnızca ölçüldüyse: ölçülmemiş bir oturumun hash'i 0.4.5 öncesiyle
    // aynı kalır, ölçülmüş ve ölçülmemiş iki kayıt ise ayrışır.
    ...(memory === undefined ? {} : { memory: [...memory].sort() }),
  }
}

// ---------------------------------------------------------------------------
// Talimat dosyaları (CLAUDE.md) — kesim ve ölçüm (0.4.5)
// ---------------------------------------------------------------------------

/**
 * Ölçüm kancasının yazdığı günlük, config dizininde.
 *
 * Neden gerekiyor: host çalışma dizininden köke kadar her dizinde
 * `CLAUDE.md`, `.claude/CLAUDE.md`, `.claude/rules/` ve `CLAUDE.local.md`
 * arıyor. Windows'ta `%TEMP%` ev dizininin altında, dolayısıyla her denemede
 * kullanıcının `~/.claude/CLAUDE.md`'si "üst dizindeki bir projenin" talimatı
 * olarak bağlama giriyordu. `CLAUDE_CONFIG_DIR` bunu kesmiyor. Ölçüm deposundaki
 * kayıtlarda model o dosyadaki aracın adını ürünün adı sandı.
 */
const MEMORY_LOG = 'assay-instructions.jsonl'
const MEMORY_HOOK = 'assay-instructions-hook.mjs'

/**
 * Çalışma dizininin üstündeki her dizinde host'un talimat aradığı yerler.
 *
 * `claudeMdExcludes` mutlak yol ve glob kabul ediyor; yollar `/` ile yazılıyor,
 * host Windows yollarını da böyle eşleştiriyor (ücretsiz sondayla ölçüldü:
 * dışlanan dosya isteğe girmedi). Çalışma dizininin kendisi dışlanmaz — oradaki
 * CLAUDE.md suite'in fixture'ı ve ölçümün bir parçası.
 */
export function ancestorExcludes(workdir: string): string[] {
  const out: string[] = []
  let dir = dirname(resolve(workdir))
  for (;;) {
    const base = toSlash(dir).replace(/\/$/, '')
    out.push(`${base}/CLAUDE.md`, `${base}/CLAUDE.local.md`, `${base}/.claude/**`)
    const parent = dirname(dir)
    if (parent === dir) return out
    dir = parent
  }
}

/**
 * Config dizinine kesimi ve ölçüm kancasını yazar.
 *
 * - `claudeMdExcludes`: üst dizinlerdeki talimat dosyaları yüklenmesin.
 *   Yönetilen (policy) dosyalar host tarafından dışlanamıyor — onları ölçüm
 *   yakalıyor.
 * - `InstructionsLoaded`: host yüklediği her dosyayı (yol, tür, sebep) bu
 *   kancaya bildiriyor. Bu bir tahmin değil, host'un kendi raporu.
 * - `UserPromptSubmit`: kanarya. Temiz bir oturumda `InstructionsLoaded` hiç
 *   çağrılmaz; kanarya yoksa "hiçbir şey yüklenmedi" ile "kanca koşmadı"
 *   ayırt edilemezdi. Akışa girmiyor ve stdout'u boş, yani bağlama bir şey
 *   eklemiyor (ölçüldü).
 */
export async function writeMemoryProbe(configDir: string, workdir: string): Promise<void> {
  const script = join(configDir, MEMORY_HOOK)
  await writeFile(
    script,
    [
      "import { appendFileSync } from 'node:fs'",
      "let input = ''",
      "process.stdin.on('data', (chunk) => (input += chunk))",
      "process.stdin.on('end', () => appendFileSync(process.argv[2], input.trim() + String.fromCharCode(10)))",
      '',
    ].join('\n'),
  )
  const command = [process.execPath, script, join(configDir, MEMORY_LOG)]
    .map((part) => `"${toSlash(part)}"`)
    .join(' ')
  const hook = [{ hooks: [{ type: 'command', command }] }]
  await writeFile(
    join(configDir, 'settings.json'),
    JSON.stringify(
      {
        claudeMdExcludes: ancestorExcludes(workdir),
        hooks: { InstructionsLoaded: hook, UserPromptSubmit: hook },
      },
      null,
      2,
    ),
  )
}

async function readMemoryProbe(
  configDir: string,
  workdir: string,
): Promise<readonly string[] | undefined> {
  const text = await readFile(join(configDir, MEMORY_LOG), 'utf8').catch(() => undefined)
  if (text === undefined) return undefined
  const hashes = new Map<string, string>()
  for (const line of text.split('\n')) {
    const path = (safeJson(line) as { file_path?: unknown } | undefined)?.file_path
    if (typeof path !== 'string' || hashes.has(path)) continue
    const bytes = await readFile(path).catch(() => undefined)
    hashes.set(
      path,
      bytes === undefined ? 'unreadable' : `sha256:${createHash('sha256').update(bytes).digest('hex').slice(0, 16)}`,
    )
  }
  return memoryEntries(text, workdir, hashes)
}

/**
 * Kanca günlüğünden kayıt girişleri.
 *
 * `undefined` → ölçülmedi: kanarya yok (oturum isteme hiç ulaşmadı ya da
 * kanca koşmadı). Kalan her durumda liste — boşsa "ölçüldü, yüklenmedi".
 *
 * Çalışma dizini dışından yüklenen her dosya giriyor, sebebi ne olursa olsun:
 * o bir sızıntı. İçeriden yalnızca oturum başında yüklenenler: ajan fixture'ın
 * alt dizinlerinde gezinirken yüklenenler denemeden denemeye değişir ve ortam
 * kaydını gereksiz yere böler.
 *
 * Tavan: kanarya bir yükleme hatasından sonra gelmezse o denemede yüklenen
 * dosyalar da kaybolur. Oturum isteme ulaşmadıysa deneme zaten ölçülmemiştir.
 */
export function memoryEntries(
  log: string,
  workdir: string,
  hashes: ReadonlyMap<string, string>,
): readonly string[] | undefined {
  const events = log
    .split('\n')
    .map((line) => safeJson(line) as Record<string, unknown> | undefined)
    .filter((event): event is Record<string, unknown> => event !== undefined)
  if (!events.some((event) => event['hook_event_name'] === 'UserPromptSubmit')) return undefined

  const root = resolve(workdir)
  const entries = new Set<string>()
  for (const event of events) {
    if (event['hook_event_name'] !== 'InstructionsLoaded') continue
    const path = event['file_path']
    if (typeof path !== 'string') continue
    const type = typeof event['memory_type'] === 'string' ? event['memory_type'] : 'Unknown'
    const inside = within(root, path)
    if (inside && event['load_reason'] !== 'session_start' && event['load_reason'] !== 'include') {
      continue
    }
    const label = inside ? `./${toSlash(relative(root, path))}` : path
    entries.add(`${type} ${label} ${hashes.get(path) ?? 'unreadable'}`)
  }
  return [...entries].sort()
}

const toSlash = (path: string) => path.split('\\').join('/')

function within(root: string, path: string): boolean {
  const rel = relative(root, resolve(path))
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

function safeJson(line: string): unknown {
  if (line.trim() === '') return undefined
  try {
    return JSON.parse(line) as unknown
  } catch {
    return undefined
  }
}

// ---------------------------------------------------------------------------
// Süreç
// ---------------------------------------------------------------------------

/** Kabuğa düşüldüğünde argümanları korur. İstem zaten stdin'den gidiyor. */
const shellQuote = (value: string) =>
  /[\s"]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value

interface SpawnResult {
  stdout: string
  stderr: string
  exitCode: number | null
  error?: string
}

/**
 * Süreci ve altındaki her şeyi kapatmayı ister.
 *
 * `packages/runner/src/process.ts` içinde ikizi var ve bu bilerek bir kopya:
 * `adapters` yalnızca `core`'a bağlanabiliyor (docs/stack.md) ve `core` Node
 * yerleşiklerini kullanamıyor. Kuralı gevşetmek yerine yirmi satır iki yerde
 * duruyor; ikisi de aynı şeyi yapıyor ve ikisi de "en iyi çaba".
 *
 * Neden gerekiyor: yalnızca doğrudan çocuğu öldürmek, ajanın başlattığı dev
 * sunucuları yetim bırakıyordu — portu meşgul eden yetimleri Assay üretiyordu
 * (docs/blockers.md).
 */
function killProcessTree(child: ReturnType<typeof spawn>): void {
  const pid = child.pid
  if (pid === undefined) return
  if (process.platform === 'win32') {
    // Ateşle ve unut: zaman aşımı yolunda cevabı bekleyecek kimse yok.
    execFile('taskkill', ['/PID', String(pid), '/T', '/F'], () => undefined)
    return
  }
  try {
    // Negatif pid = süreç grubu; `detached: true` ile başlatıldığı için var.
    process.kill(-pid, 'SIGKILL')
  } catch {
    child.kill('SIGKILL')
  }
}

function run(
  binary: string,
  args: readonly string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; timeoutMs: number; stdin: string },
): Promise<SpawnResult> {
  return new Promise((resolve) => {
    const { command, shell } = resolveBinary(binary)
    const child = spawn(command, shell ? args.map(shellQuote) : [...args], {
      cwd: options.cwd,
      env: options.env,
      shell,
      windowsHide: true,
      /*
       * POSIX'te kendi süreç grubunda başlıyor: ağaç kapatma `kill(-pid)` ile
       * gruba gidiyor ve ajanın başlattığı dev sunucular da kapanıyor.
       * Windows'ta `taskkill /T` zaten PID ağacını yürüdüğü için gerekmiyor;
       * kabuk üzerinden koşarken de bilerek verilmiyor.
       */
      ...(process.platform === 'win32' || shell ? {} : { detached: true }),
    })

    child.stdin?.on('error', () => undefined) // süreç erken ölürse EPIPE
    child.stdin?.end(options.stdin)

    let stdout = ''
    let stderr = ''
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      /*
       * Ağaç bütün olarak kapatılıyor, yalnızca doğrudan çocuk değil.
       *
       * claude
in başlattığı dev sunucular eskiden hayatta kalıyordu, yani
       * portu meşgul eden yetimleri Assay üretiyordu: bir sonraki denemenin
       * ajanı portu dolu buluyor ve porta göre öldürmeye girişiyor — aynı
       * makinedeki runner da bir `node` süreci (docs/blockers.md).
       */
      killProcessTree(child)
      child.kill('SIGKILL')
      resolve({
        stdout,
        stderr,
        exitCode: null,
        error: `timed out after ${options.timeoutMs}ms`,
      })
    }, options.timeoutMs)

    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => (stdout += chunk))
    child.stderr?.on('data', (chunk: string) => (stderr += chunk))

    child.on('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ stdout, stderr, exitCode: null, error: error.message })
    })

    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ stdout, stderr, exitCode: code })
    })
  })
}
