/**
 * Attempt sandbox'ı.
 *
 * Her attempt kendi geçici çalışma dizininde koşar. Dizin öncesi/sonrası
 * anlık görüntüsü alınır ve fark `EnvDiff`'e çevrilir.
 *
 * **Tavan — açıkça söylenmesi gereken:** bu bir *gözlem* katmanı, bir *zorlama*
 * katmanı değil. Çalışma dizini dışına yazmayı işletim sistemi seviyesinde
 * engellemiyoruz; dışarı yazımı izden (araç çağrılarının yollarından) tespit
 * ediyoruz. Ağ da öyle: host'un araç izni mekanizmasıyla reddediliyor ve
 * reddedilenler kayda geçiyor, ama süreç kendi başına soket açarsa görülmez.
 * Kapsam 1.3 güvenlik incelemesinde ölçülecek; oraya kadar hiçbir yerde
 * "engelleniyor" denmez, "gözleniyor" denir.
 */

import { createHash } from 'node:crypto'
import { cp, mkdir, mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { isAbsolute, join, parse, relative, resolve, sep } from 'node:path'
import type { CapturedFile, EnvDiff, NetworkRequest, TraceEvent } from '@ktlsr/assay-core'

/** Yol → içerik hash'i. Anlık görüntü. */
export type Snapshot = ReadonlyMap<string, string>

export interface Workspace {
  /** Attempt'in çalışma dizini. */
  dir: string
  /** Kurulum sırasında alınan anlık görüntü. */
  before: Snapshot
}

/**
 * Çalışma dizinlerinin açılabileceği kökler, tercih sırasıyla (0.4.5).
 *
 * Çalışma dizini ev dizininin altında olmamalı: host oradan köke kadar
 * yürüyüp kullanıcının talimat dosyalarını (`~/.claude/CLAUDE.md`) bir üst
 * projeninki gibi yüklüyor. Windows'ta `%TEMP%` ev dizininin altında, yani
 * bugüne kadar her deneme kullanıcının kişisel talimatlarıyla koştu.
 *
 * - `ASSAY_WORK_ROOT` verildiyse o; kullanıcı bilerek seçti.
 * - geçici dizin ev dışındaysa o (Linux `/tmp`, macOS `/var/folders`).
 * - değilse Windows'ta sürücü kökünde `assay-work`, POSIX'te `/tmp`; son çare
 *   yine geçici dizin.
 *
 * Tavan: ev dışı bir kökün üstünde de talimat dosyası olabilir (`D:\CLAUDE.md`).
 * O yüzden bu tek başına yetmiyor: adaptör üst dizinleri ayrıca dışlıyor ve
 * yüklenen her dosyayı ölçüp kayda yazıyor.
 */
export function workRoots(
  tmp: string = tmpdir(),
  home: string = homedir(),
  override: string | undefined = process.env['ASSAY_WORK_ROOT'],
  platform: NodeJS.Platform = process.platform,
): readonly string[] {
  if (override !== undefined && override.trim() !== '') return [resolve(override)]
  if (!inside(resolve(tmp), resolve(home))) return [tmp]
  const outside = platform === 'win32' ? join(parse(resolve(tmp)).root, 'assay-work') : '/tmp'
  return inside(resolve(outside), resolve(home)) ? [tmp] : [outside, tmp]
}

/** `path` `root`un kendisi ya da altında mı. */
function inside(path: string, root: string): boolean {
  const rel = relative(root, path)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/** İlk oluşturulabilen kök. */
async function workRoot(): Promise<string> {
  const candidates = workRoots()
  for (const candidate of candidates) {
    const ok = await mkdir(candidate, { recursive: true }).then(
      () => true,
      () => false,
    )
    if (ok) return candidate
  }
  return tmpdir()
}

/** Bir attempt için temiz çalışma dizini kurar ve fixture'ları kopyalar. */
export async function createWorkspace(options: {
  /** Kopyalanacak fixture dizini veya dosyası. */
  fixtures?: string | undefined
  prefix?: string
}): Promise<Workspace> {
  const dir = await mkdtemp(join(await workRoot(), options.prefix ?? 'assay-work-'))
  if (options.fixtures !== undefined && options.fixtures !== '') {
    const source = resolve(options.fixtures)
    const info = await stat(source).catch(() => null)
    if (info === null) {
      throw new Error(`fixtures path does not exist: ${options.fixtures}`)
    }
    await cp(source, info.isDirectory() ? dir : join(dir, basename(source)), {
      recursive: true,
    })
  }
  return { dir, before: await snapshot(dir) }
}

export async function destroyWorkspace(workspace: Workspace): Promise<void> {
  await rm(workspace.dir, { recursive: true, force: true }).catch(() => undefined)
}

const basename = (path: string) => path.split(/[\\/]/).pop() ?? path

/** Dizini özyinelemeli tarar; her dosya için içerik hash'i tutar. */
export async function snapshot(dir: string): Promise<Snapshot> {
  const out = new Map<string, string>()
  await walk(dir, dir, out)
  return out
}

async function walk(root: string, dir: string, out: Map<string, string>): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      await walk(root, full, out)
      continue
    }
    if (!entry.isFile()) continue
    const bytes = await readFile(full).catch(() => null)
    if (bytes === null) continue
    out.set(
      toPosix(relative(root, full)),
      createHash('sha256').update(bytes).digest('hex'),
    )
  }
}

const toPosix = (path: string) => path.split(sep).join('/')

/** Tek dosya ve toplam yakalama sınırı. */
export const CAPTURE_LIMITS = {
  /** Bundan büyük dosya yakalanmaz; içeriği değil, aşımı kaydedilir. */
  perFileBytes: 8 * 1024 * 1024,
  /** Tüm dosyaların toplamı. */
  totalBytes: 64 * 1024 * 1024,
} as const

export interface Capture {
  files: CapturedFile[]
  /** Sınır aşıldığı için içeriği alınmayan dosyalar. */
  skipped: string[]
}

/**
 * Çalışma dizininden kanıt dosyalarını yakalar.
 *
 * Sınırlı: koşulan şey ölçülen skill'dir ve bir döngüde gigabaytlarca dosya
 * üretebilir. Sınırsız okuma, ölçüm aracının kendisini bellek tüketimiyle
 * düşürürdü. Atlanan dosyalar sessizce yok sayılmaz; adları kayda geçer, o
 * dosyalara dayanan assertion'lar da böylece `fail` yerine görünür kalır.
 */
export async function capture(dir: string, limits = CAPTURE_LIMITS): Promise<Capture> {
  const paths = [...(await snapshot(dir)).keys()]
  const files: CapturedFile[] = []
  const skipped: string[] = []
  let total = 0

  for (const path of paths) {
    const full = join(dir, path)
    const info = await stat(full).catch(() => null)
    if (info === null) continue
    if (info.size > limits.perFileBytes || total + info.size > limits.totalBytes) {
      skipped.push(path)
      continue
    }
    const bytes = await readFile(full).catch(() => null)
    if (bytes === null) continue
    total += bytes.byteLength
    files.push({ path, bytes: new Uint8Array(bytes) })
  }
  return { files, skipped }
}

/** Geriye dönük kolaylık: yalnızca dosyalar. */
export async function captureFiles(dir: string): Promise<CapturedFile[]> {
  return (await capture(dir)).files
}

/**
 * Bir dizinin içerik hash'i — pin 1'in denetçisi.
 *
 * Dosya yolları ve içerik hash'leri sıralanıp tek bir hash'e indirgenir, yani
 * dosya sırası veya zaman damgası sonucu etkilemez. Dizin okunamıyorsa `null`
 * döner; uydurulmuş bir hash, kaymayı gizlerdi.
 */
export async function directoryHash(dir: string): Promise<string | null> {
  const files = await snapshot(dir)
  if (files.size === 0) return null
  const canonical = [...files.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([path, hash]) => `${path}:${hash}`)
    .join('\n')
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`
}

// ---------------------------------------------------------------------------
// Ortam farkı
// ---------------------------------------------------------------------------

/** Dosya yazan araçlar. İz üzerinden çalışma dizini dışına yazımı yakalar. */
const WRITING_TOOLS = new Set(['Write', 'Edit', 'NotebookEdit', 'MultiEdit'])
/** Ağa çıkan araçlar. */
const NETWORK_TOOLS = new Set(['WebFetch', 'WebSearch'])
/**
 * Yan etkisi gözlenemeyen araçlar.
 *
 * Bir kabuk komutu dosya da yazabilir, ağa da çıkabilir; ne yaptığını
 * argümanından güvenilir biçimde okumak mümkün değil. Bu araçlar
 * çağrıldığında yan etki iddiaları ölçülemez hâle gelir — `unobserved`
 * alanı bunu taşır ve `side_effect` assertion'ı `unknown` üretir.
 */
const OPAQUE_TOOLS = new Set(['Bash', 'PowerShell', 'Shell', 'Terminal', 'Execute'])

/**
 * Ortam farkını üretir.
 *
 * İki kaynak birleştirilir:
 *  1. Çalışma dizini anlık görüntü farkı — gerçekten diske ne yazıldı.
 *  2. İzdeki araç çağrılarının yolları — çalışma dizini *dışına* yazma
 *     girişimleri yalnızca burada görülür.
 *
 * `deniedTools` host tarafından reddedilen araçları taşır; bunlar
 * `blocked: true` olarak kaydedilir.
 */
export function envDiff(options: {
  workdir: string
  before: Snapshot
  after: Snapshot
  trace: readonly TraceEvent[] | undefined
  /** Host'un reddettiği araç adları (Claude Code: `permission_denials`). */
  deniedTools?: readonly string[]
}): EnvDiff {
  const writes = new Set<string>()
  const deletes = new Set<string>()

  for (const [path, hash] of options.after) {
    const previous = options.before.get(path)
    if (previous === undefined || previous !== hash) writes.add(path)
  }
  for (const path of options.before.keys()) {
    if (!options.after.has(path)) deletes.add(path)
  }

  const denied = new Set(options.deniedTools ?? [])
  const network: NetworkRequest[] = []
  const unobserved = new Set<string>()
  const failedCalls = failedCallIds(options.trace)

  for (const event of options.trace ?? []) {
    if (event.kind !== 'tool_call' || event.tool === undefined) continue
    // Reddedilen veya hata veren çağrı gerçekleşmemiştir; yan etki sayılmaz.
    const rejected = event.id !== undefined && failedCalls.has(event.id)

    if (WRITING_TOOLS.has(event.tool) && !rejected) {
      const path = pathArgument(event.args)
      if (path !== undefined) writes.add(outsideAware(options.workdir, path))
    }

    if (OPAQUE_TOOLS.has(event.tool) && !rejected) unobserved.add(event.tool)

    if (NETWORK_TOOLS.has(event.tool)) {
      const host = hostArgument(event.args)
      network.push({
        host: host ?? event.tool,
        blocked: rejected || denied.has(event.tool),
      })
    }
  }

  return {
    writes: [...writes].sort(),
    deletes: [...deletes].sort(),
    network,
    unobserved: [...unobserved].sort(),
  }
}

/** Hata veya izin reddiyle sonuçlanan çağrıların kimlikleri. */
function failedCallIds(trace: readonly TraceEvent[] | undefined): Set<string> {
  const failed = new Set<string>()
  for (const event of trace ?? []) {
    if (
      event.kind === 'tool_result' &&
      event.isError === true &&
      event.callId !== undefined
    ) {
      failed.add(event.callId)
    }
  }
  return failed
}

/** Çalışma dizini içindeyse göreli, dışındaysa mutlak yol döner. */
function outsideAware(workdir: string, path: string): string {
  if (!isAbsolute(path)) return toPosix(path)
  const rel = relative(resolve(workdir), resolve(path))
  if (rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)) return toPosix(rel)
  return toPosix(path)
}

function pathArgument(
  args: Readonly<Record<string, unknown>> | undefined,
): string | undefined {
  if (args === undefined) return undefined
  for (const key of ['file_path', 'path', 'notebook_path', 'filePath']) {
    const value = args[key]
    if (typeof value === 'string' && value !== '') return value
  }
  return undefined
}

function hostArgument(
  args: Readonly<Record<string, unknown>> | undefined,
): string | undefined {
  if (args === undefined) return undefined
  const url = args['url']
  if (typeof url === 'string') {
    try {
      return new URL(url).host
    } catch {
      return url
    }
  }
  const query = args['query']
  return typeof query === 'string' ? 'search' : undefined
}
