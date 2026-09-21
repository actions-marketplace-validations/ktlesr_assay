/**
 * Koşum journal'ı — öldürülen bir koşum ölçtüğünü kaybetmesin.
 *
 * Sorun ölçüldü (0.3.0-b, docs/blockers.md): `runSuite` bütün vakalar bittikten
 * sonra tek bir `Run` döndürüyor ve kayıt ancak ondan sonra yazılıyordu. Koşum
 * ortasında ölen bir süreç, o ana kadar **tamamlanmış her denemeyi de**
 * götürüyordu. `impeccable` 4.2.2 ölçümünde bu iki kez oldu: beşer deneme
 * ekrana `✓` bastı, hiçbiri diske yazılmadı, ~40 dakika ve ~$4 gitti.
 *
 * Çözüm bir günlük dosyası: her deneme bittiğinde tek satır eklenir. Koşum
 * normal bittiğinde satırlar tek bir kayda katlanır ve journal silinir.
 * Süreç ölürse dosya diskte kalır ve `assay recover` onu kayda çevirir.
 *
 * Neden tam kaydı her denemede yeniden yazmıyoruz: O(n²) yazma demek ve 240
 * denemelik bir kayıt megabaytlarca. Koruma tam da uzun ölçümlerde gerekiyor
 * ve tam da orada pahalılaşırdı.
 *
 * Biçim: JSONL. İlk satır başlık, sonraki her satır bir deneme. Ekleme
 * yapılıyor, hiçbir satır sonradan değişmiyor — süreç bir satırın ortasında
 * ölürse yalnızca o satır bozuk olur ve okuma onu atıp **sayar**.
 */

import { appendFileSync, closeSync, existsSync, openSync, writeSync } from 'node:fs'
import { mkdir, readdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { Attempt, Environment, Pins, Run, RunLayer, SkippedCase } from '@ktlsr/assay-core'
import { assembleRun } from './assemble.js'

/** Journal dosya biçimi sürümü. Tanınmayan sürüm sessizce yorumlanmaz. */
export const JOURNAL_VERSION = 1

export const JOURNAL_SUFFIX = '.partial.jsonl'

/** Koşum başlarken bilinenler. Ortam pinleri denemelerden toplanıyor. */
export interface JournalHeader {
  journalVersion: number
  kind: 'run'
  id: string
  startedAt: string
  host: string
  skill: string
  /** Suite'te beyan edilen tekrar sayısı. */
  runs: number
  /** Koşum başında bilinen pinler; `environmentHash` denemelerden gelir. */
  pins: Pins
  /*
   * Planlanmış kapsam. Koşum başında biliniyor ve kurtarılan kayıt da taşımalı:
   * yoksa öldürülüp kurtarılan bir hızlı mod koşumu tam ölçüm gibi okunur ve
   * bütçenin kestiği vakalar kaybolup verdict `pass`e dönebilirdi.
   */
  concurrency?: number
  layers?: readonly RunLayer[]
  skipped?: readonly SkippedCase[]
  /**
   * Koşulması planlanan vakalar, suite sırasında (0.3.1-b).
   *
   * Kurtarma, ulaşamadığı vakaları buradan buluyor. Bu liste olmadan koşumun
   * hiç gelmediği vakalar kayıtta ne `cases`'te ne `skipped`'da görünüyordu:
   * negatifleri sonda olan bir suite yarıda kesilince yalnız pozitiflerle
   * kurtarılıyor ve eksiğini söylemiyordu. 0.3.1 öncesi journal'larda yok; o
   * zaman ulaşılamayan vakalar adlandırılamaz ama kayıt yine `pass` veremez.
   */
  planned?: readonly string[]
  /**
   * Journal'ı yazan Assay sürümü (0.3.2). Kurtarılan kayıt bunu taşır, kurtaran
   * sürümü değil: denemeler bu sürümün kurallarıyla yargılandı. Eski
   * journal'larda yok; o zaman kayıt da sürümsüz kalır ve "0.3.1 or earlier"
   * olarak okunur.
   */
  assayVersion?: string
}

/** Tek bir tamamlanmış deneme. */
export interface JournalAttempt {
  kind: 'attempt'
  caseId: string
  expectedTrigger?: boolean
  /** Çakışma vakasının beklenen kazananı; `[]` = none (0.4.0). */
  expectedWinner?: readonly string[]
  attempt: Attempt
  environmentHash?: string
  permissionMode?: string
  environment?: Environment
}

export type JournalLine = JournalHeader | JournalAttempt

/**
 * Açık bir journal.
 *
 * Yazma **senkron**: `appendFileSync` çağrısı döndüğünde satır işletim
 * sistemine teslim edilmiştir. Asenkron bir yazımın kuyrukta beklerken süreç
 * ölürse kaybolması, tam da engellenmek istenen şey olurdu.
 */
export class RunJournal {
  readonly path: string
  #closed = false

  private constructor(path: string) {
    this.path = path
  }

  /** Journal'ı açar ve başlığı yazar. */
  static async open(directory: string, header: Omit<JournalHeader, 'journalVersion' | 'kind'>): Promise<RunJournal> {
    await mkdir(directory, { recursive: true })
    const path = join(directory, `${header.id}${JOURNAL_SUFFIX}`)
    const line: JournalHeader = { journalVersion: JOURNAL_VERSION, kind: 'run', ...header }
    // `wx`: var olan bir journal'ın üstüne yazılmaz. Aynı kimlikle ikinci bir
    // koşum başlarsa bu bir kusurdur ve sessizce ilkini silmek, kurtarılacak
    // veriyi yok etmek olurdu.
    const fd = openSync(path, 'wx')
    try {
      writeSync(fd, `${JSON.stringify(line)}\n`)
    } finally {
      closeSync(fd)
    }
    return new RunJournal(path)
  }

  /** Bir denemeyi ekler. Senkron: dönüş, satırın teslim edildiği an. */
  append(entry: Omit<JournalAttempt, 'kind'>): void {
    if (this.#closed) return
    appendFileSync(this.path, `${JSON.stringify({ kind: 'attempt', ...entry })}\n`)
  }

  /** Koşum normal bitti: journal artık gereksiz. */
  async finish(): Promise<void> {
    this.#closed = true
    await rm(this.path, { force: true })
  }
}

// ---------------------------------------------------------------------------
// Okuma
// ---------------------------------------------------------------------------

export interface JournalContents {
  header: JournalHeader
  attempts: readonly JournalAttempt[]
  /**
   * Ayrıştırılamayan satır sayısı.
   *
   * Süreç bir satırın ortasında öldüyse sonuncusu yarım kalır. Atılıyor ama
   * sayılıyor: kaç denemenin okunamadığını gizlemek, kaydın yarım olduğunu
   * gizlemenin küçük hâli olurdu.
   */
  droppedLines: number
}

/**
 * Bir journal dosyasını okur.
 *
 * Bozuk başlık kurtarılamaz: hangi koşum olduğu bilinmeden denemeler bir
 * kayda ait edilemez. O durumda `null` döner ve çağıran dosyayı olduğu gibi
 * bırakır — silmek, okunamayan ama var olan bir ölçümü yok etmek olurdu.
 */
export async function readJournal(path: string): Promise<JournalContents | null> {
  const raw = await readFile(path, 'utf8')
  const lines = raw.split('\n').filter((line) => line.trim() !== '')
  if (lines.length === 0) return null

  let header: JournalHeader | undefined
  const attempts: JournalAttempt[] = []
  let droppedLines = 0

  for (const line of lines) {
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch {
      droppedLines += 1
      continue
    }
    if (!isRecord(parsed)) {
      droppedLines += 1
      continue
    }
    if (parsed['kind'] === 'run' && header === undefined) {
      if (parsed['journalVersion'] !== JOURNAL_VERSION) {
        throw new Error(
          `${path} was written by journal version ${String(parsed['journalVersion'])}, this build reads version ${JOURNAL_VERSION}`,
        )
      }
      header = parsed as unknown as JournalHeader
      continue
    }
    if (parsed['kind'] === 'attempt' && isRecord(parsed['attempt'])) {
      attempts.push(parsed as unknown as JournalAttempt)
      continue
    }
    droppedLines += 1
  }

  if (header === undefined) return null
  return { header, attempts, droppedLines }
}

/** Bir dizindeki yetim journal'ların yolları. */
export async function findJournals(directory: string): Promise<string[]> {
  if (!existsSync(directory)) return []
  const entries = await readdir(directory).catch(() => [])
  return entries
    .filter((name) => name.endsWith(JOURNAL_SUFFIX))
    .sort()
    .map((name) => join(directory, name))
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

// ---------------------------------------------------------------------------
// Kurtarma
// ---------------------------------------------------------------------------

export interface RecoveredRun {
  /** Journal'ın yolu — çağıran onu silmeden önce kaydı yazabilsin diye. */
  path: string
  /** Kurtarılan kayıt; `partial` alanı dolu. */
  run: Run
}

/**
 * Yarım bir journal'ı kanonik kayda çevirir.
 *
 * Kayıt **yarım olduğunu söyler**: `partial` alanı sebebi, kurtarma anını ve
 * okunamayan satır sayısını taşıyor. Ölçülen kısım gerçek bir ölçüm — vaka
 * başına N doğru ve değişmez #4 gereği aralık zaten geniş çıkıyor — ama
 * `runs` alanı beyan edilen tekrar sayısını taşıdığı için kaydın kendisi de
 * "bu tamamlanmadı" demek zorunda.
 *
 * Hiç deneme yoksa kayıt üretilmiyor: sıfır denemelik bir "koşum" ölçüm değil,
 * yalnızca gürültüdür ve store'a girmemeli.
 */
export async function recoverJournal(
  path: string,
  options: { now?: () => Date; reason?: string } = {},
): Promise<RecoveredRun | null> {
  const contents = await readJournal(path)
  if (contents === null) return null
  if (contents.attempts.length === 0) return null

  const now = options.now ?? (() => new Date())
  const { header, attempts, droppedLines } = contents
  const last = attempts[attempts.length - 1]?.attempt

  // Planlanıp hiç başlamamış vakalar, adıyla. Yarım koşmuş bir vaka burada
  // değil `cases`'te durur: N'i küçüktür ve değişmez #4 onu zaten gösterir.
  const reached = new Set(attempts.map((entry) => entry.caseId))
  const skipped: SkippedCase[] = [
    ...(header.skipped ?? []),
    ...(header.planned ?? [])
      .filter((caseId) => !reached.has(caseId))
      .map((caseId) => ({
        caseId,
        reason: 'the run was interrupted before this case started',
        cause: 'interrupted' as const,
      })),
  ]

  const run = assembleRun({
    id: header.id,
    startedAt: header.startedAt,
    // Koşum "bitmedi", kesildi: en son tamamlanan denemenin bitişi elimizdeki
    // tek gerçek an. Kurtarma anını yazmak, ölçümün o ana kadar sürdüğü
    // izlenimi verirdi.
    finishedAt: last?.finishedAt ?? header.startedAt,
    host: header.host,
    skill: header.skill,
    runs: header.runs,
    pins: header.pins,
    ...(header.concurrency === undefined ? {} : { concurrency: header.concurrency }),
    ...(header.layers === undefined ? {} : { layers: header.layers }),
    ...(skipped.length === 0 ? {} : { skipped }),
    ...(header.assayVersion === undefined ? {} : { assayVersion: header.assayVersion }),
    attempts,
    partial: {
      reason:
        options.reason ??
        'the run was interrupted before it finished; this record holds the attempts that completed',
      recoveredAt: now().toISOString(),
      ...(droppedLines === 0 ? {} : { droppedLines }),
    },
  })

  return { path, run }
}
