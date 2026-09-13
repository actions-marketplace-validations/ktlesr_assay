/**
 * Deneme worker'ı — tek bir denemeyi koşan kısa ömürlü süreç.
 *
 * Neden ayrı bir süreç: ölçülen ajan, işini doğrulamak için başlattığı dev
 * sunucuları **porta göre** öldürüyor ve runner aynı makinede sıradan bir
 * `node` süreci. 4.2.2 ölçümünde koşum iki kez bu yüzden öldü
 * (docs/blockers.md). Deneme ayrı bir süreçte koşarsa, öldürülen şey koşumun
 * tamamı değil bir deneme olur: sevk katmanı onu `unknown` yazıp devam eder.
 *
 * İkinci kazanç: worker öldürülürken **hâlâ canlı** olduğu için süreç ağacı
 * bütün olarak kapatılabiliyor. Ajanın başlattığı dev sunucular böylece
 * yetim kalmıyor — portu meşgul eden yetimleri Assay'in kendisi üretiyordu.
 *
 * Protokol kasten aptal: girdi bir JSON dosyası, çıktı bir JSON dosyası.
 * Süreçler arası canlı bir kanal, öldürülmesi beklenen bir süreçte fazladan
 * bir kırılma noktası olurdu.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { HostAdapter, Suite, SuiteCase } from '@ktlsr/assay-core'
import { runAttempt, type RunOptions } from './run.js'

/**
 * Worker'ın kuracağı adaptörün tarifi.
 *
 * Adaptör bir nesne ve nesne süreç sınırından geçmiyor; worker onu kendisi
 * kuruyor. Tarifi **çağıran kod** veriyor (CLI), vaka seti dosyası değil:
 * bir suite dosyasının hangi modülün yükleneceğini söyleyebilmesi, ölçüm
 * girdisine kod çalıştırma yetkisi vermek olurdu.
 */
export interface AdapterSpec {
  /** İçe aktarılacak modül, ör. `@ktlsr/assay-adapters`. */
  module: string
  /** Modülden alınacak sınıf adı, ör. `ClaudeCodeAdapter`. */
  export: string
  /** Yapıcıya geçilecek seçenekler. JSON'a yazılabilir olmalı. */
  options?: Record<string, unknown>
}

/** Worker'a verilen iş. */
export interface WorkerPayload {
  suite: Suite
  testCase: SuiteCase
  index: number
  adapter: AdapterSpec
  /** `RunOptions`ın süreç sınırından geçebilen kısmı. */
  options: Pick<RunOptions, 'source' | 'suitePath' | 'skillPath' | 'layers'>
  /** Sonucun yazılacağı dosya. */
  resultPath: string
}

export async function createAdapter(spec: AdapterSpec): Promise<HostAdapter> {
  /*
   * Paket adı olduğu gibi, dosya yolu `file://` olarak.
   *
   * Windows'ta `import('D:\...')` ESM yükleyicisi tarafından reddediliyor
   * ("Received protocol 'd:'"); mutlak yollar geçerli bir file URL olmak
   * zorunda. Ölçüm makinesi Windows olduğu için bu, teoride değil ilk
   * koşumda çıkan bir kusur.
   */
  const specifier = spec.module.startsWith('file:')
    ? spec.module
    : isPathLike(spec.module)
      ? pathToFileURL(resolve(spec.module)).href
      : spec.module
  const module = (await import(specifier)) as Record<string, unknown>
  const factory = module[spec.export]
  if (typeof factory !== 'function') {
    throw new Error(`${spec.module} has no exported class "${spec.export}"`)
  }
  const Ctor = factory as new (options?: Record<string, unknown>) => HostAdapter
  return new Ctor(spec.options)
}

async function main(): Promise<void> {
  const payloadPath = process.argv[2]
  if (payloadPath === undefined) throw new Error('the worker needs a payload path')
  const payload = JSON.parse(await readFile(payloadPath, 'utf8')) as WorkerPayload

  const adapter = await createAdapter(payload.adapter)
  const result = await runAttempt(
    payload.suite,
    payload.testCase,
    payload.index,
    adapter,
    { ...payload.options },
    () => new Date(),
  )
  await writeFile(payload.resultPath, JSON.stringify(result), 'utf8')

  /*
   * Worker kendi kendine ÇIKMIYOR: sonucu bildirip ölmeyi bekliyor.
   *
   * Sebep süreç ağacı. Windows'ta `taskkill /T` ağacı PID üzerinden yürüyor;
   * worker çıkmışsa yürüyecek ağaç kalmıyor ve ajanın başlattığı dev sunucu
   * yetim kalıyor — düzeltilmek istenen şeyin ta kendisi. Worker canlı
   * kaldığı sürece ağaç duruyor ve sevk katmanı onu bütün olarak kapatıyor.
   *
   * Sonucun kaynağı dosya; bu satır yalnızca "yazdım" demek.
   */
  process.stdout.write(`${DONE}\n`)

  /*
   * Canlı kalmak için AÇIK BİR ZAMANLAYICI şart.
   *
   * İlk hâli yalnızca `await new Promise(() => {})` idi ve yukarıdaki iddiayı
   * yerine getirmiyordu: çözülmeyen bir söz event loop'u açık tutmaz, Node
   * worker'ı `DONE` yazar yazmaz kapatıyordu. Windows'ta görünmedi — PPID alanı
   * ebeveyn ölünce de korunuyor ve ağaç yine yürünüyor. Linux'ta yetim init'e
   * geçiyor, zincir kopuyor ve ağaç kapatma onu hiç görmüyordu. CI yakaladı,
   * konteynerde ölçüldü.
   *
   * Zamanlayıcı ayrıca ebeveyne bakıyor: sevk katmanı öldürülürse (tavan,
   * `taskkill /F /IM node.exe`) worker sonsuza kadar asılı kalmasın.
   */
  const parent = process.ppid
  setInterval(() => {
    if (!parentAlive(parent)) process.exit(0)
  }, 1_000)
  await new Promise(() => {
    // Sevk katmanı kapatacak; yukarıdaki zamanlayıcı süreci ayakta tutuyor.
  })
}

/** Ebeveyn hâlâ orada mı. POSIX'te ölen ebeveynin yerini init alır, PPID değişir. */
function parentAlive(parent: number): boolean {
  if (process.ppid !== parent) return false
  try {
    process.kill(parent, 0)
    return true
  } catch (cause) {
    // EPERM: süreç var ama bizim değil — yaşıyor sayılır.
    return (cause as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/** Sevk katmanının beklediği işaret: sonuç dosyası yazıldı. */
export const DONE = 'assay:attempt-done'

/*
 * Yalnızca doğrudan çalıştırıldığında koşar.
 *
 * İlk hâli `import.meta.url.endsWith('worker.js')` diyordu ve bu YANLIŞTI:
 * derlenmiş modülün url'si her zaman `worker.js` ile biter, içe aktarıldığında
 * bile. Sonuç, `@ktlsr/assay-runner`ı içe aktaran her sürecin worker'ın
 * `main`ini koşturmaya kalkmasıydı — gerçek süreçle koşan test bunu ilk
 * denemede yakaladı (`ENOENT: ... open '<store dizini>'`).
 *
 * Doğru soru "bu modül girdi noktası mı": `process.argv[1]`in çözülmüş file
 * URL'si bu modülün url'sine eşit mi.
 *
 * `process.exit` bilerek: worker'ın açtığı bir dev sunucu event loop'u açık
 * tutabilir ve sevk katmanı boşuna beklerdi.
 */
const entry =
  process.argv[1] === undefined
    ? undefined
    : pathToFileURL(resolve(process.argv[1])).href
if (entry === import.meta.url) {
  main().then(
    () => process.exit(0),
    (cause: unknown) => {
      process.stderr.write(
        `${cause instanceof Error ? cause.stack ?? cause.message : String(cause)}\n`,
      )
      process.exit(1)
    },
  )
}

/** Paket adı mı, dosya yolu mu. */
function isPathLike(specifier: string): boolean {
  return (
    isAbsolute(specifier) ||
    specifier.startsWith('./') ||
    specifier.startsWith('../') ||
    /^[A-Za-z]:[\\/]/.test(specifier)
  )
}