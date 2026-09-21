/**
 * Sevk katmanı — denemeyi ayrı bir süreçte koşturur ve o süreç ölse de ayakta
 * kalır.
 *
 * **Ne kadar koruduğu.** Ölçülen ajan bir denemeyi öldürebilir; koşum devam
 * eder ve o deneme `unknown` olur. Ajanın başlattığı dev sunucular denemenin
 * sonunda ağaçla birlikte kapatılır, yani bir sonraki denemeye yetim
 * kalmazlar.
 *
 * **Ne kadar korumadığı.** Bu süreç de aynı makinede, aynı kullanıcı altında
 * sıradan bir `node` süreci. `taskkill /F /IM node.exe` ya da PID'i bilen
 * herhangi bir çağrı onu da öldürür. Hiçbir yerde "korunuyor" denmiyor;
 * denen şey şu: **kayıp bir denemeyle sınırlanıyor.** Sevk katmanı ölürse
 * journal devreye giriyor (0.3.0-b) ve o ana kadar tamamlanmış denemeler
 * diskte kalıyor. Gerçek izolasyon konteynerle gelir ve Faz 3'te
 * (docs/sandbox-security.md, A1).
 */

import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ChildProcess } from 'node:child_process'
import type { RunLayer, Suite, SuiteCase } from '@ktlsr/assay-core'
import { docker, launchAttempt, type ContainerLayout } from './container.js'
import { killChildTree, type KillTreeResult } from './process.js'
import type { AttemptResult } from './run.js'
import { DONE, type AdapterSpec, type WorkerPayload } from './worker.js'

export interface SupervisorOptions {
  adapter: AdapterSpec
  source: string
  suitePath?: string
  skillPath: string
  /**
   * Ölçülecek katmanlar.
   *
   * Worker'a geçmek ZORUNDA: katman filtresi denemenin içinde uygulanıyor ve
   * hızlı mod izolasyonla birlikte koşuyor. Alan geçmediğinde worker
   * assertion'ları yine değerlendiriyordu — birim testleri süreç sınırını
   * geçmediği için görmedi, uçtan uca duman testi gördü.
   */
  layers?: readonly RunLayer[]
  /** Bir denemenin duvar saati tavanı. Aşılırsa worker ağacıyla kapatılır. */
  timeoutMs?: number
  /**
   * Worker sürecine eklenen ortam değişkenleri — port kirası buradan geçiyor.
   *
   * Ajana ulaşıp ulaşmayacağını adaptörün kendi allowlist'i belirliyor; burası
   * yalnızca worker'ın ortamı.
   */
  env?: Record<string, string>
  /**
   * Verildiğinde deneme bu düzende bir konteynerde koşar (K2); `env` o zaman
   * kullanılmıyor — konteynerin ortamını düzen belirliyor ve her konteynerin
   * kendi ağ yığını olduğu için port kirası gerekmiyor.
   */
  container?: ContainerLayout
}

/** Sevk katmanının bir deneme hakkında öğrendikleri. */
export interface SupervisedAttempt {
  result: AttemptResult | null
  /** Sonuç alınamadıysa neden. */
  reason?: string
  /** Worker'ın çıkış kodu; sinyalle öldüyse `null`. */
  exitCode: number | null
  /** Worker'ı öldüren sinyal, varsa. */
  signal: NodeJS.Signals | null
  /** Ağaç kapatma çağrısı hatasız döndü mü. */
  treeKilled: boolean
}

/**
 * Worker giriş noktasının yolu.
 *
 * Kaynaktan koşarken (`vitest`) bu dosyanın komşusu `worker.ts`; Node onu
 * çalıştıramaz. O yüzden `src` yolu `dist` karşılığına çevriliyor. Hiçbiri
 * yoksa sessizce süreç-içine düşülmüyor — çağıran, izolasyonun olmadığını
 * bilerek karar vermeli.
 */
export function workerEntry(): string {
  const sibling = fileURLToPath(new URL('./worker.js', import.meta.url))
  if (existsSync(sibling)) return sibling
  const built = sibling.replace(`${sep()}src${sep()}`, `${sep()}dist${sep()}`)
  if (existsSync(built)) return built
  throw new Error(
    `the attempt worker was not found at ${sibling} or ${built}; build the runner (tsc -b) before running with process isolation`,
  )
}

const sep = () => (process.platform === 'win32' ? '\\' : '/')

/**
 * Tek bir denemeyi ayrı bir süreçte koşturur.
 *
 * Sonuç dosyası worker'ın sözü: yazıldıysa deneme tamamlanmıştır. Yazılmadıysa
 * — süreç öldürüldü, çöktü ya da hiç başlayamadı — sevk katmanı **ölçüm
 * yapılmadığını** bilir ve bunu uyduramaz (değişmez #1).
 */
export async function superviseAttempt(
  suite: Suite,
  testCase: SuiteCase,
  index: number,
  options: SupervisorOptions,
): Promise<SupervisedAttempt> {
  const dir = await mkdtemp(join(tmpdir(), 'assay-worker-'))
  const payloadPath = join(dir, 'payload.json')
  const resultPath = join(dir, 'result.json')

  const payload: WorkerPayload = {
    suite,
    testCase,
    index,
    adapter: options.adapter,
    options: {
      source: options.source,
      ...(options.suitePath === undefined ? {} : { suitePath: options.suitePath }),
      skillPath: options.skillPath,
      ...(options.layers === undefined ? {} : { layers: options.layers }),
    },
    resultPath,
  }

  const timeoutMs = options.timeoutMs ?? 900_000

  try {
    const launch =
      options.container === undefined
        ? undefined
        : await launchAttempt(options.container, {
            io: dir,
            payload,
            ...(options.suitePath === undefined ? {} : { suitePath: options.suitePath }),
            timeoutMs,
          })
    await writeFile(payloadPath, JSON.stringify(launch?.payload ?? payload), 'utf8')

    const child =
      launch === undefined
        ? spawn(process.execPath, [workerEntry(), payloadPath], {
            stdio: ['ignore', 'pipe', 'pipe'],
            ...(options.env === undefined ? {} : { env: { ...process.env, ...options.env } }),
            // POSIX'te kendi süreç grubunda: ağaç kapatma yürüyüşe ek olarak grubun
            // tamamına da sinyal gönderiyor (process.ts). Windows'ta PPID yürünüyor.
            ...(process.platform === 'win32' ? {} : { detached: true }),
          })
        : spawn('docker', launch.args, { stdio: ['ignore', 'pipe', 'pipe'] })

    // Konteynerde ağaç yürümeye gerek yok: `docker rm -f` konteynerin bütün
    // süreçlerini (cgroup) birlikte kapatıyor, yetim bırakacak bir dışarısı yok.
    const stop = (): Promise<KillTreeResult> =>
      launch === undefined ? killChildTree(child) : removeContainer(launch.name, child)

    let stderr = ''
    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk.length > 4000 ? chunk.slice(0, 4000) : chunk
    })

    let timedOut = false
    let reportedDone = false

    /*
     * Üç yoldan biriyle bitiyor: worker "yazdım" der, worker ölür, ya da süre
     * dolar. Üçünde de ağacı BİZ kapatıyoruz ve worker o an hâlâ canlı —
     * Windows'ta `taskkill /T` ancak böyle yürüyecek bir ağaç buluyor. Worker
     * kendi kendine çıksaydı ajanın başlattığı sunucu yetim kalırdı.
     */
    const closed = await new Promise<{
      code: number | null
      signal: NodeJS.Signals | null
    }>((resolve) => {
      const timer = setTimeout(() => {
        timedOut = true
        void stop()
      }, timeoutMs)

      let buffered = ''
      child.stdout?.setEncoding('utf8')
      child.stdout?.on('data', (chunk: string) => {
        buffered += chunk
        if (!buffered.includes(DONE)) return
        reportedDone = true
        clearTimeout(timer)
        resolve({ code: null, signal: null })
      })
      child.on('error', () => {
        clearTimeout(timer)
        resolve({ code: null, signal: null })
      })
      child.on('close', (code, signal) => {
        clearTimeout(timer)
        resolve({ code, signal })
      })
    })

    const tree = await stop()

    const raw = await readFile(resultPath, 'utf8').catch(() => null)
    if (raw === null) {
      return {
        result: null,
        reason: reasonFor(closed, timedOut, reportedDone, stderr, launch !== undefined),
        exitCode: closed.code,
        signal: closed.signal,
        treeKilled: tree.ok,
      }
    }

    return {
      result: JSON.parse(raw) as AttemptResult,
      exitCode: closed.code,
      signal: closed.signal,
      treeKilled: tree.ok,
    }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}

/** Konteyneri bütün süreçleriyle kaldırır; `docker` istemcisi de kapanır. */
async function removeContainer(name: string, client: ChildProcess): Promise<KillTreeResult> {
  const removed = await docker(['rm', '-f', name])
  if (client.exitCode === null) client.kill('SIGKILL')
  // İçerideki süreç öldüyse `--rm` konteyneri çoktan kaldırdı: geride bir şey yok.
  if (removed.ok || /no such container/i.test(removed.stderr)) return { ok: true }
  return { ok: false, reason: removed.stderr.trim() }
}

/**
 * Sonuç yoksa neden yok.
 *
 * Cümle kullanıcıya ne yapacağını söylüyor: öldürülen bir worker, ölçülen
 * ajanın bu makinedeki süreçlere dokunabildiği anlamına geliyor.
 */
function reasonFor(
  closed: { code: number | null; signal: NodeJS.Signals | null },
  timedOut: boolean,
  reportedDone: boolean,
  stderr: string,
  container = false,
): string {
  const tail = stderr.trim() === '' ? '' : `: ${stderr.trim().split('\n').slice(-3).join(' ')}`
  if (container && !reportedDone && !timedOut) {
    // `docker run` çıkış kodunu içerideki süreçten alıyor; 125 docker'ın kendisi.
    if (closed.code === 125) return `the attempt container could not be started${tail}`
    if (closed.code === 137) {
      return `the attempt process was killed by SIGKILL inside its container before it reported a result; the measured agent runs as the same user as the attempt process there${tail}`
    }
  }
  if (reportedDone) {
    // Worker yazdığını söyledi ama dosya okunamadı: disk ya da izin sorunu,
    // ölçümün kendisi değil. Ayrı cümle, çünkü ayrı bir iş.
    return `the attempt process reported a result that could not be read back${tail}`
  }
  if (timedOut) {
    return `the attempt process was still running at the timeout and was closed with its process tree${tail}`
  }
  if (closed.signal !== null) {
    return `the attempt process was killed by ${closed.signal} before it reported a result; the measured agent can reach processes on this machine${tail}`
  }
  if (closed.code === null) {
    return `the attempt process could not be started${tail}`
  }
  if (closed.code !== 0) {
    return `the attempt process exited with code ${closed.code} before it reported a result${tail}`
  }
  return `the attempt process exited without writing a result${tail}`
}
