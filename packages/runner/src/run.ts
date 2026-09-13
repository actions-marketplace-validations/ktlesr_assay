/**
 * Koşum motoru.
 *
 * Akış: suite → her vaka için N attempt → temiz sandbox → adaptörle koş →
 * kanıt topla → assertion'ları uygula → verdict → kayıt.
 *
 * Motorun tek işi kanıt toplayıp `core`'a vermek. Değerlendirmenin tamamı
 * `core`'da; runner karar vermez. Bu ayrım sayesinde aynı kayıt ileride
 * yeniden değerlendirilebilir.
 */

import { createHash, randomUUID } from 'node:crypto'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  combineVerdicts,
  expectedWinnerOf,
  evaluateAssertions,
  evaluateTrigger,
  redact,
  redactDeep,
  type AgentSession,
  type Attempt,
  type AssertionResult,
  type Environment,
  type Evidence,
  type HostAdapter,
  type Pins,
  type Run,
  type RunLayer,
  type SkippedCase,
  type Suite,
  type SuiteCase,
  type TraceEvent,
  type TriggerObservation,
  type Verdict,
  type VerdictDetail,
} from '@ktlsr/assay-core'
import {
  capture,
  createWorkspace,
  destroyWorkspace,
  directoryHash,
  envDiff,
  resolveFixtures,
  snapshot,
} from './sandbox.js'
import { assembleRun } from './assemble.js'
import { localNames } from './identity.js'
import { RunJournal, type JournalAttempt } from './journal.js'
import { superviseAttempt, workerEntry } from './supervisor.js'
import {
  openContainerRun,
  withContainer,
  type ContainerLayout,
  type ContainerOptions,
} from './container.js'

/** Vakanın beklenen kazananı, normalize (0.4.0). */
const winnerOf = (testCase: SuiteCase) => expectedWinnerOf(testCase.expect)
import { ASSAY_VERSION } from './version.js'
import type { AdapterSpec } from './worker.js'

export interface RunOptions {
  /** Suite'in ham kaynağı — pin 4'ün denetçisi olan içerik hash'i için. */
  source: string
  /** Suite'in yolu; `setup.fixtures` bunun yanından çözülür. */
  suitePath?: string
  /** Test edilen skill'in (plugin'in) yerel dizini. */
  skillPath: string
  /** `suite.runs` yerine geçer. Kullanıcı açıkça isterse 1 olabilir. */
  repeat?: number
  /**
   * Journal dizini — her deneme bittiğinde tek satır buraya eklenir.
   *
   * Verilmezse journal tutulmaz ve koşum ortasında ölen bir süreç o ana kadar
   * tamamlanmış her denemeyi götürür. CLI her zaman veriyor; alan opsiyonel
   * çünkü kütüphane olarak çağıran biri diske yazmak zorunda değil.
   */
  journalDir?: string
  /**
   * Verildiğinde her deneme ayrı bir süreçte koşar ve o sürecin ağacı deneme
   * sonunda kapatılır.
   *
   * Değer, worker'ın kuracağı adaptörün tarifi: adaptör bir nesne ve nesne
   * süreç sınırından geçmiyor. Tarifi çağıran kod veriyor, vaka seti dosyası
   * değil.
   *
   * Verilmezse deneme bu süreçte koşar — kütüphane olarak çağıran biri kendi
   * adaptör örneğini geçebilsin diye. CLI her zaman veriyor.
   */
  isolate?: AdapterSpec
  /** İzole denemenin duvar saati tavanı; aşılırsa worker ağacıyla kapatılır. */
  attemptTimeoutMs?: number
  /**
   * Aynı anda koşan deneme sayısı. **Varsayılan 1.**
   *
   * Varsayılanın 1 olmasının sebebi ölçümün kendisi: eş zamanlı denemeler
   * CPU'yu, belleği, portları ve host hız sınırını paylaşıyor. Hızlanmak
   * kullanıcının bilerek verdiği bir karar olmalı, sessiz bir varsayılan
   * değil.
   */
  concurrency?: number
  /**
   * Her işçiye ayrılan port aralığının başlangıcı.
   *
   * Eş zamanlı iki denemenin ajanı aynı portu isterse biri diğerinin
   * sunucusunu öldürüyor. İşçi başına ayrık bir aralık veriliyor ve `PORT`,
   * `VITE_PORT`, `ASSAY_PORT_RANGE` olarak ajanın ortamına konuyor.
   *
   * Bu bir **yumuşatma, garanti değil**: ajanın bu değişkenlere uyma
   * zorunluluğu yok, sabit port yazan bir dev sunucu yine çakışır. Gerçek
   * ayrım konteynerle gelir (docs/sandbox-security.md, A1/A3).
   */
  portRangeStart?: number
  /** İşçi başına kaç port. Varsayılan 100. */
  portRangeSize?: number
  /**
   * Verildiğinde her deneme bir konteynerde koşar (K2). `isolate` şart: konteyner
   * worker'ı adaptör tarifinden kuruyor. Konteyner koşulu (imaj özeti, platform,
   * çıkış izin listesi, sınırlar) kayda ve ortam hash'ine giriyor.
   */
  container?: ContainerOptions
  /**
   * Ölçülecek katmanlar. Verilmezse hepsi.
   *
   * `['trigger']` hızlı modun kendisi: yalnızca tetiklenme ölçülür. Beyan
   * edilmiş assertion'lar `unknown`a çevrilmez — hiç değerlendirilmez ve
   * attempt'in `notEvaluated` alanında listelenir. Yalnızca artefakt ölçen
   * vakalar hiç koşulmaz ve `skipped` içinde sebebiyle görünür.
   */
  layers?: readonly RunLayer[]
  /**
   * Toplam deneme tavanı.
   *
   * Aşıldığında kalan vakalar koşulmuyor ve `skipped` içinde "bütçe doldu"
   * sebebiyle yazılıyor. Sessizce kırpmak, kullanıcıya ölçülmemiş bir vakayı
   * ölçülmüş gibi gösterirdi.
   */
  maxAttempts?: number
  /** Vaka ve attempt ilerledikçe çağrılır. */
  onProgress?: (event: ProgressEvent) => void
  /** Zaman kaynağı — testlerde sabitlenebilir. */
  now?: () => Date
}

export interface ProgressEvent {
  caseId: string
  attempt: number
  attempts: number
  verdict: Verdict
  reason: string
}

/** Suite kaynağının içerik hash'i. Beyan edilen sürüm unutulursa bu yakalar. */
export function suiteHash(source: string): string {
  return `sha256:${createHash('sha256').update(source.replace(/\r\n/g, '\n')).digest('hex')}`
}

/**
 * Bir suite'i koşar.
 *
 * Adaptörün her çağrısı ayrı ayrı korunur: bir attempt çökerse koşum devam
 * eder ve o attempt `unknown` olur. Bir adaptör hatası tüm koşumu düşürmez,
 * ama sessizce `pass` da üretmez.
 */
export async function runSuite<S extends AgentSession>(
  suite: Suite,
  adapter: HostAdapter<S>,
  options: RunOptions,
): Promise<Run> {
  const now = options.now ?? (() => new Date())
  const repeat = options.repeat ?? suite.runs
  // Varsayılan 1: hızlanmak kullanıcının bilerek verdiği bir karar olmalı.
  const concurrency = Math.max(1, Math.trunc(options.concurrency ?? 1))
  const startedAt = now().toISOString()
  // Pin 1'in denetçisi: beyan edilen sürüm unutulsa da içerik kayması görülür.
  const skillHash = (await directoryHash(options.skillPath)) ?? ''
  const id = `run-${now().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`
  const basePins = pinsOf(suite, options.source, skillHash)

  /*
   * Journal koşumdan ÖNCE açılıyor.
   *
   * Kimliği ve pinleri baştan yazmak, süreç ilk denemenin ortasında ölse bile
   * elde bir künye bırakıyor. Açılış başarısız olursa koşum yine de yürüyor:
   * journal bir güvence, ön koşul değil — yazılamıyor diye ölçümü iptal etmek
   * kullanıcıya daha pahalıya patlardı. Ama sessiz kalmıyor.
   */
  // Plan journal'dan ÖNCE: kurtarılan bir koşum da neyin bilerek koşulmadığını
  // ve hangi katmanın ölçüldüğünü bilmeli. Başlıkta olmasaydı öldürülüp
  // kurtarılan bir hızlı mod koşumu tam ölçüm gibi okunur, bütçe kesmesi de
  // kaybolurdu.
  const { work, skipped } = planWork(suite, repeat, options)

  // Konteyner düzeni journal'dan ÖNCE: kurulamazsa (imaj yok, API konteyneri
  // yok) koşum hiç başlamamış olur ve arkada boş bir journal kalmaz.
  if (options.container !== undefined && options.isolate === undefined) {
    throw new Error('the container mode runs each attempt through the worker and needs the adapter recipe (isolate)')
  }
  const container =
    options.container === undefined
      ? undefined
      : await openContainerRun(options.container, options.isolate as AdapterSpec, id, workerEntry())

  const journal = await openJournal(options, {
    id,
    startedAt,
    host: adapter.id,
    skill: suite.target.skill,
    runs: repeat,
    pins: basePins,
    ...(concurrency === 1 ? {} : { concurrency }),
    ...(options.layers === undefined ? {} : { layers: options.layers }),
    ...(skipped.length === 0 ? {} : { skipped }),
    // Kurtarma, koşumun hiç ulaşamadığı vakaları buradan adlandırıyor.
    planned: [...new Set(work.map((item) => item.testCase.id))],
    // Kurtarılan kayıt, journal'ı YAZAN sürümü taşısın; kurtaranı değil.
    assayVersion: ASSAY_VERSION,
  })

  // Ajana kullanıcının canlı skill dizini değil, bir kopyası verilir. Aksi
  // hâlde ölçülen skill kendini değiştirip sonraki attempt'leri kirletebilir
  // ve ölçüm, ölçtüğü şey tarafından bozulurdu.
  let skillCopy: string
  try {
    skillCopy = await copySkill(options.skillPath)
  } catch (cause) {
    await container?.close()
    throw cause
  }
  const journalled: JournalAttempt[] = []

  /*
   * İş listesi önce kuruluyor, sonra W işçi aynı listeden çekiyor.
   *
   * Sıra suite sırası: eş zamanlı koşumda denemeler karışık bitiyor ama kayıt
   * karışık olmamalı — aynı suite iki kez koşulduğunda kaydın vaka sırası
   * değişirse iki kaydı yan yana okumak zorlaşır. Bitiş sırası değil, beyan
   * sırası yazılıyor.
   */
  const ordered = new Array<JournalAttempt | undefined>(work.length)

  let cursor = 0
  const workers = Math.max(1, Math.min(concurrency, work.length))

  const drain = async (slot: number): Promise<void> => {
    for (;;) {
      const at = cursor
      cursor += 1
      const item = work[at]
      if (item === undefined) return

      const { attempt, environmentHash, permissionMode, environment } =
        options.isolate === undefined
          ? await runAttempt(
              suite,
              item.testCase,
              item.index,
              adapter,
              { ...options, skillPath: skillCopy },
              now,
            )
          : await isolatedAttempt(
              suite,
              item.testCase,
              item.index,
              options,
              skillCopy,
              now,
              slot,
              container?.layout,
            )

      const entry: JournalAttempt = {
        kind: 'attempt',
        caseId: item.testCase.id,
        ...(item.testCase.expect.triggered === undefined
          ? {}
          : { expectedTrigger: item.testCase.expect.triggered }),
        ...(winnerOf(item.testCase) === undefined
          ? {}
          : { expectedWinner: winnerOf(item.testCase) as readonly string[] }),
        attempt,
        ...(environmentHash === undefined ? {} : { environmentHash }),
        ...(permissionMode === undefined ? {} : { permissionMode }),
        ...(environment === undefined ? {} : { environment }),
      }
      // Önce diske, sonra belleğe: sıra tersine dönerse tam da kaybedilen
      // deneme, kaydedildiği sanılan deneme olur. Journal bitiş sırasında;
      // kurtarma zaten vakaya göre grupluyor.
      journal?.append(entry)
      ordered[at] = entry
      options.onProgress?.({
        caseId: item.testCase.id,
        attempt: item.index,
        attempts: repeat,
        verdict: attempt.verdict,
        reason: attempt.reason,
      })
    }
  }

  try {
    await Promise.all(Array.from({ length: workers }, (_unused, slot) => drain(slot)))
  } finally {
    await rm(skillCopy, { recursive: true, force: true }).catch(() => undefined)
    await container?.close().catch(() => undefined)
  }
  journalled.push(...ordered.filter((entry): entry is JournalAttempt => entry !== undefined))

  const run = assembleRun({
    id,
    startedAt,
    finishedAt: now().toISOString(),
    host: adapter.id,
    skill: suite.target.skill,
    runs: repeat,
    ...(concurrency === 1 ? {} : { concurrency }),
    ...(options.layers === undefined ? {} : { layers: options.layers }),
    ...(skipped.length === 0 ? {} : { skipped }),
    pins: basePins,
    attempts: journalled,
    assayVersion: ASSAY_VERSION,
  })

  // Kayıt kuruldu; journal'ın işi bitti.
  await journal?.finish()
  return run
}

/**
 * Denemeyi ayrı bir süreçte koşturur ve o süreç ölse de koşumu düşürmez.
 *
 * Worker sonuç yazmadıysa **ölçüm yapılmamıştır**: deneme `unknown` olur ve
 * gerekçe sebebi adıyla söyler (değişmez #1). Öldürülen bir denemeyi `fail`
 * saymak kullanıcıyı kırık olmayan bir skill'i tamir etmeye gönderirdi.
 */
async function isolatedAttempt(
  suite: Suite,
  testCase: SuiteCase,
  index: number,
  options: RunOptions,
  skillCopy: string,
  now: () => Date,
  slot: number,
  container?: ContainerLayout,
): Promise<AttemptResult> {
  const startedAt = now().toISOString()
  const began = Date.now()
  const supervised = await superviseAttempt(suite, testCase, index, {
    ...(container === undefined ? {} : { container }),
    adapter: options.isolate as AdapterSpec,
    source: options.source,
    ...(options.suitePath === undefined ? {} : { suitePath: options.suitePath }),
    skillPath: skillCopy,
    ...(options.layers === undefined ? {} : { layers: options.layers }),
    ...(options.attemptTimeoutMs === undefined
      ? {}
      : { timeoutMs: options.attemptTimeoutMs }),
    env: portLease(slot, options),
  })

  if (supervised.result !== null) {
    return container === undefined
      ? supervised.result
      : withContainer(supervised.result, container.environment)
  }

  return {
    attempt: {
      index,
      caseId: testCase.id,
      startedAt,
      finishedAt: now().toISOString(),
      trigger: {
        available: false,
        reason: supervised.reason ?? 'the attempt process reported nothing',
      },
      assertions: [],
      verdict: 'unknown',
      reason: supervised.reason ?? 'the attempt process reported nothing',
      latencyMs: Date.now() - began,
    },
  }
}

/**
 * Hangi vakaların koşulacağı ve hangilerinin neden koşulmayacağı.
 *
 * İki eleme var ve ikisi de **kayda yazılıyor**:
 *
 * 1. Katman filtresi. Yalnızca artefakt ölçen bir vaka (`expect.triggered` ve
 *    `not_triggered` yok, yalnız assertion var) hızlı modda koşulmuyor:
 *    koşulsaydı ölçülecek hiçbir şeyi kalmazdı ve boş bir vaka üretirdi.
 * 2. Bütçe tavanı. Tavan dolduğunda kalan vakalar koşulmuyor.
 *
 * Elenen vaka `cases` listesinde sıfır denemeyle görünmüyor: "koşulmadı" ile
 * "koşuldu, karar çıkmadı" karışmasın.
 */
function planWork(
  suite: Suite,
  repeat: number,
  options: RunOptions,
): {
  work: Array<{ testCase: SuiteCase; caseIndex: number; index: number }>
  skipped: SkippedCase[]
} {
  // Kazanan beyanı da bir tetiklenme iddiası (0.4.0). Hızlı mod 0.3.0'dan
  // kalma ve bunu bilmiyordu: yalnızca `winner` taşıyan tartışmalı vaka "only
  // declares assertions" diye atlandı (gerçek çakışma koşumu, 2026-09-11).
  const measuresTrigger = (testCase: SuiteCase): boolean =>
    testCase.expect.triggered !== undefined ||
    (testCase.expect.not_triggered?.length ?? 0) > 0 ||
    testCase.expect.winner !== undefined
  const layers = options.layers
  const triggerOnly = layers !== undefined && !layers.includes('assertions')

  const work: Array<{ testCase: SuiteCase; caseIndex: number; index: number }> = []
  const skipped: SkippedCase[] = []
  const budget = options.maxAttempts ?? Number.POSITIVE_INFINITY

  suite.cases.forEach((testCase, caseIndex) => {
    if (triggerOnly && !measuresTrigger(testCase)) {
      skipped.push({
        caseId: testCase.id,
        reason:
          'the case only declares assertions, and this run measured the trigger layer only',
        cause: 'layer',
      })
      return
    }
    if (work.length + repeat > budget) {
      skipped.push({
        caseId: testCase.id,
        reason: `the attempt budget of ${budget} was reached before this case`,
        cause: 'budget',
      })
      return
    }
    for (let index = 0; index < repeat; index += 1) work.push({ testCase, caseIndex, index })
  })

  return { work, skipped }
}

/**
 * İşçiye ayrılan port aralığı.
 *
 * `PORT` ve `VITE_PORT` yaygın dev sunucuların okuduğu değişkenler;
 * `ASSAY_PORT_RANGE` ise aralığın tamamını söylüyor ki birden çok sunucu
 * başlatan bir ajan da yer bulabilsin.
 *
 * Tekrar: **yumuşatma, garanti değil.** Sabit port yazan bir sunucu bunları
 * okumaz ve eş zamanlı iki deneme yine çakışır. Ölçüm bunu gizlemiyor —
 * çakışma olduğunda deneme `unknown` olur ve gerekçesi görünür.
 */
function portLease(slot: number, options: RunOptions): Record<string, string> {
  const start = options.portRangeStart ?? 5200
  const size = options.portRangeSize ?? 100
  const from = start + slot * size
  return {
    PORT: String(from),
    VITE_PORT: String(from + 1),
    ASSAY_PORT_RANGE: `${from}-${from + size - 1}`,
  }
}

/** Journal açılamazsa koşum durmaz ama sessiz de kalınmaz. */
async function openJournal(
  options: RunOptions,
  header: Parameters<typeof RunJournal.open>[1],
): Promise<RunJournal | undefined> {
  if (options.journalDir === undefined) return undefined
  try {
    return await RunJournal.open(options.journalDir, header)
  } catch (cause) {
    options.onProgress?.({
      caseId: '(journal)',
      attempt: 0,
      attempts: 0,
      verdict: 'unknown',
      reason: `the run journal could not be opened, so an interrupted run will lose its attempts: ${message(cause)}`,
    })
    return undefined
  }
}

/**
 * Koşum pinleri.
 *
 * `environmentHash` adaptörden geliyor: host sistem promptu hash'ini vermediği
 * hostlarda pin 3'ün kaymasını yakalayan tek şey o. Adaptör vermediyse alan
 * hiç yazılmıyor ve `comparePins` pin 3'ü "ölçülemedi" sayıyor — eskiden iki
 * koşumda da aynı yer tutucu bulunduğu için "tuttu" sayılıyordu.
 */
export function pinsOf(
  suite: Suite,
  source: string,
  skillHash = '',
  environmentHash?: string,
): Pins {
  return {
    skillSource: suite.target.source,
    skillHash,
    model: suite.environment.model,
    systemPromptHash: suite.environment.system_prompt_hash,
    suiteVersion: suite.version,
    suiteHash: suiteHash(source),
    ...(environmentHash === undefined || environmentHash === ''
      ? {}
      : { environmentHash }),
  }
}

// ---------------------------------------------------------------------------
// Tek attempt
// ---------------------------------------------------------------------------

/**
 * Bir attempt ve o attempt'in gördüğü ortam hash'i.
 *
 * Hash koşum seviyesinde bir pin ama yalnızca oturum seviyesinde okunabiliyor;
 * `runSuite` attempt'lerden toplayıp hepsi aynıysa pine yazıyor.
 */
export interface AttemptResult {
  attempt: Attempt
  environmentHash?: string
  /** Host'un bu attempt'te bildirdiği izin modu. */
  permissionMode?: string
  /** Hash'in girdisi olan ortam kaydı; hash ile aynı mantıkla toplanır. */
  environment?: Environment
}

export async function runAttempt<S extends AgentSession>(
  suite: Suite,
  testCase: SuiteCase,
  index: number,
  adapter: HostAdapter<S>,
  options: RunOptions,
  now: () => Date,
): Promise<AttemptResult> {
  const startedAt = now().toISOString()
  const began = Date.now()
  let environmentHash: string | undefined
  let permissionMode: string | undefined
  let environment: Environment | undefined

  let workspace: Awaited<ReturnType<typeof createWorkspace>> | undefined
  try {
    workspace = await createWorkspace({
      fixtures: resolveFixtures(testCase.setup?.fixtures, options.suitePath),
      prefix: 'assay-attempt-',
    })
  } catch (cause) {
    // Sandbox kurulamadıysa ölçüm yapılmadı; sessiz pass üretilemez.
    return {
      attempt: unknownAttempt(
        testCase,
        index,
        startedAt,
        now,
        began,
        `the sandbox could not be prepared: ${message(cause)}`,
      ),
    }
  }

  let session: S | undefined
  let trigger: TriggerObservation = {
    available: false,
    reason: 'the adapter was never asked for a trigger signal',
  }
  let trace: readonly TraceEvent[] | undefined
  let evidence: Evidence = {}
  let latencyMs: number | undefined
  let cost: Attempt['cost']
  let adapterFailure: string | null = null
  let skippedFiles: readonly string[] = []

  try {
    session = await adapter.start({
      caseId: testCase.id,
      attempt: index,
      prompt: testCase.prompt,
      skill: {
        name: suite.target.skill,
        source: suite.target.source,
        path: options.skillPath,
      },
      model: suite.environment.model,
      activeSkills: suite.environment.active_skills ?? [],
      workdir: workspace.dir,
      ...(testCase.setup?.fixtures === undefined
        ? {}
        : { fixtures: testCase.setup.fixtures }),
    })

    trigger = await safely(
      () => adapter.readTriggerSignal(session as S),
      (reason): TriggerObservation => ({
        available: false,
        reason: `the adapter failed to read the trigger signal: ${reason}`,
      }),
    )
    trace = await safely(
      () => adapter.readTrace(session as S),
      () => undefined,
    )

    const result = await adapter.finalize(session)
    latencyMs = result.latencyMs
    cost = result.cost
    environmentHash = result.environmentHash
    permissionMode = result.permissionMode
    environment = result.environment

    /*
     * Oturum çapraz kontrolden geçmediyse KANIT YOKTUR.
     *
     * Host oturumu hiç açamadığında (iptal edilmiş token, çöken süreç,
     * `terminal_reason` "completed" değil) çalışma dizini dokunulmadan kalıyor
     * ve `capture` boş bir dizi dönüyordu. `evidence.files` "var ama boş"
     * oluyordu; sevk katmanının koruması yalnızca `undefined` denetlediği için
     * `[]` ondan geçiyor ve `file_exists` "no file matches" diyerek **fail**
     * üretiyordu. Aynı sebeple `env` de dolu ve boş geliyor ve `side_effect`
     * hiçbir ihlal görmeyip **pass** diyordu — değişmez #1'in doğrudan
     * yasakladığı sessiz geçiş.
     *
     * Tetiklenme katmanı bunu zaten doğru yapıyordu: adaptörün
     * `readTriggerSignal`'i oturumun durumuna bakıp `unknown` dönüyor. Bu blok
     * aynı bilgiyi assertion katmanına da taşıyor.
     *
     * Yeni bir mekanizma eklenmiyor: alanlar hiç doldurulmuyor ve `REQUIRES`
     * koruması zaten "alan yoksa unknown" diyor.
     *
     * AYRIM KORUNUYOR: gerçekten koşup hiçbir şey yazmayan bir ajan
     * (`outcome: 'completed'`, boş workspace) kanıtını almaya ve `file_exists`
     * üzerinden **fail** vermeye devam ediyor. Orada ölçüm gerçekten var.
     *
     * İz kayda yine yazılıyor (teşhis için), yalnızca assertion'lara kanıt
     * olarak verilmiyor: koşmamış bir oturumun izi üzerinde araç iddiası
     * değerlendirmek de ölçmediğini ölçmektir.
     */
    if (result.outcome === 'error') {
      evidence = {}
    } else {
      const after = await snapshot(workspace.dir)
      const captured = result.files === undefined ? await capture(workspace.dir) : null
      if (captured !== null && captured.skipped.length > 0) {
        skippedFiles = captured.skipped
      }
      evidence = {
        files: result.files ?? captured?.files ?? [],
        ...(trace === undefined ? {} : { trace }),
        ...(result.exitCode === undefined ? {} : { exitCode: result.exitCode }),
        env:
          result.env ??
          envDiff({
            workdir: workspace.dir,
            before: workspace.before,
            after,
            trace,
            ...(deniedTools(adapter) === undefined
              ? {}
              : { deniedTools: deniedTools(adapter) as readonly string[] }),
          }),
      }
    }
  } catch (cause) {
    adapterFailure = message(cause)
  } finally {
    if (workspace !== undefined) await destroyWorkspace(workspace)
  }

  if (adapterFailure !== null) {
    return {
      attempt: unknownAttempt(
        testCase,
        index,
        startedAt,
        now,
        began,
        `the host adapter failed: ${adapterFailure}`,
        trigger,
        trace,
      ),
      ...(environmentHash === undefined ? {} : { environmentHash }),
      ...(permissionMode === undefined ? {} : { permissionMode }),
      ...(environment === undefined ? {} : { environment }),
    }
  }

  /*
   * Katman filtresi: assertion'lar değerlendirilmiyor ama `unknown` da
   * olmuyorlar.
   *
   * `unknown` "ölçmeye çalıştık, sinyal alamadık" demek ve koşumu ölçülemez
   * ilan ediyor (çıkış kodu 3). Burada olan başka: kullanıcı bakılmamasını
   * istedi. Kasıtlı bir kapsam kararını ölçüm başarısızlığı gibi göstermek,
   * kullanıcıya `--allow-unknown` yazmayı öğretirdi — ve o alışkanlık gerçek
   * `unknown`ları da görünmez yapardı.
   */
  const declared = testCase.expect.assertions ?? []
  const evaluatesAssertions =
    options.layers === undefined || options.layers.includes('assertions')
  const assertions: AssertionResult[] = evaluatesAssertions
    ? evaluateAssertions(declared, evidence)
    : []
  const notEvaluated = evaluatesAssertions ? [] : declared
  const triggerVerdict = evaluateTrigger(trigger, {
    triggered: testCase.expect.triggered,
    notTriggered: testCase.expect.not_triggered,
    winner: winnerOf(testCase),
  })

  const parts: VerdictDetail[] = [
    ...(triggerVerdict === null ? [] : [triggerVerdict]),
    ...assertions,
  ]
  // "check", "assertion" değil: `parts` tetiklenme kontrolünü de içeriyor ve o
  // bir assertion değil. Sayı ile `assertions` listesinin uyuşmaması bundandı.
  const combined = combineVerdicts(parts, 'check')

  const reason =
    skippedFiles.length === 0
      ? combined.reason
      : `${combined.reason} | ${skippedFiles.length} file(s) exceeded the capture limit and were not inspected: ${skippedFiles.join(', ')}`

  const attempt: Attempt = {
    index,
    caseId: testCase.id,
    startedAt,
    finishedAt: now().toISOString(),
    trigger,
    // Gözlemin beklentiyle karşılaştırılması kendi alanında: `assertions`
    // yalnızca vaka setinde beyan edilenleri taşır, sentetik üye almaz.
    ...(triggerVerdict === null ? {} : { triggerCheck: triggerVerdict }),
    assertions,
    ...(notEvaluated.length === 0 ? {} : { notEvaluated }),
    verdict: combined.verdict,
    reason: redact(reason),
    latencyMs: latencyMs ?? Date.now() - began,
    ...(cost === undefined ? {} : { cost }),
    // Kayıt CI artefaktı olarak yükleniyor; iz maskelenmeden saklanmaz.
    ...(trace === undefined ? {} : { trace: redactDeep(trace, { names: localNames() }) }),
    ...(evidence.env === undefined ? {} : { env: redactDeep(evidence.env, { names: localNames() }) }),
  }

  return {
    attempt,
    ...(environmentHash === undefined ? {} : { environmentHash }),
    ...(permissionMode === undefined ? {} : { permissionMode }),
    ...(environment === undefined ? {} : { environment }),
  }
}

function unknownAttempt(
  testCase: SuiteCase,
  index: number,
  startedAt: string,
  now: () => Date,
  began: number,
  reason: string,
  trigger?: TriggerObservation,
  trace?: readonly TraceEvent[],
): Attempt {
  return {
    index,
    caseId: testCase.id,
    startedAt,
    finishedAt: now().toISOString(),
    trigger: trigger ?? { available: false, reason },
    assertions: [],
    verdict: 'unknown',
    reason,
    latencyMs: Date.now() - began,
    ...(trace === undefined ? {} : { trace }),
  }
}

/** Skill dizinini geçici bir kopyaya alır. Ölçülen şey kaynağa dokunamaz. */
async function copySkill(source: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'assay-skill-'))
  await cp(source, dir, { recursive: true })
  return dir
}

async function safely<T>(
  operation: () => Promise<T>,
  onFailure: (reason: string) => T,
): Promise<T> {
  try {
    return await operation()
  } catch (cause) {
    return onFailure(message(cause))
  }
}

/** Adaptör reddettiği araçları bildiriyorsa ağ iddiası buna göre işaretlenir. */
function deniedTools(adapter: unknown): readonly string[] | undefined {
  const value = (adapter as { deniedTools?: unknown }).deniedTools
  return Array.isArray(value) ? (value as readonly string[]) : undefined
}

const message = (cause: unknown) =>
  cause instanceof Error ? cause.message : String(cause)
