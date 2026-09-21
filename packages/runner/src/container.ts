/**
 * Konteyner koşumu — K2 (docs/runner-environment.md).
 *
 * Her deneme kendi konteynerinde, dışarıya kapalı bir iç ağda. Ağın tek dış
 * çıkışı, runner'ın aynı imajdan başlattığı çıkış proxy'si (izin listesi);
 * Anthropic API'si ise kimlik proxy'si konteynerinden geliyor ve deneme
 * konteyneri yalnızca bir yer tutucu anahtar görüyor. Gerçek anahtar bu
 * modülden hiç geçmiyor.
 *
 * **Assay'in kodu ana makineden.** Konteyner runner'ın, core'un ve adaptörün
 * `dist`ini salt okunur bağlıyor; imaj yalnızca Node'u, Claude Code'u,
 * Chromium'u ve üçüncü taraf bağımlılıkları (ajv, yaml, zod) taşıyor. Böylece
 * konteynerdeki kod supervisor'unkiyle yapısı gereği aynı: imaj yeniden
 * derlenmeden geliştirilen bir sürüm, konteynerde eski bir sürümle ölçmüyor.
 *
 * **Kaydın taşıdığı.** İmaj özeti, platform, çıkış proxy'sinin **kendi
 * bildirdiği** izin listesi ve sınırlar `environment.container`a ve ortam
 * hash'ine giriyor. Girmeseydi konteyner kayıtları dizüstü kayıtlarıyla sessizce
 * karşılaştırılırdı.
 *
 * **Tavan.** Ajan konteynerde worker'la aynı kullanıcı (uid 1000): worker'ı
 * öldürebilir ve sonuç dosyasına yazabilir. Öldürme `unknown` üretiyor; sonuç
 * dosyasını değiştirmek ise ana makinede de mümkündü ve burada da gözlenmiyor.
 * Yükseltme yolu ajanı ayrı bir kullanıcıyla başlatmak. Supervisor ölürse deneme
 * konteyneri en geç zaman aşımında (`timeout`) kendini kapatıyor; ağ ve çıkış
 * proxy'si ise bir sonraki elle temizliğe kalıyor.
 */

import { execFile } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { chmod, stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { basename, dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ContainerEnvironment } from '@ktlsr/assay-core'
import type { AttemptResult } from './run.js'
import { resolveFixtures } from './sandbox.js'
import type { AdapterSpec, WorkerPayload } from './worker.js'

export interface ContainerOptions {
  /** Deneme imajı (ad ya da özet); koşum başında özete çözülür ve o özet koşar. */
  image: string
  /**
   * Anthropic API'sini cevaplayan konteyner, `ad:port` — kimlik proxy'si (K3).
   * Koşumun iç ağına bağlanıyor; deneme konteyneri ona yer tutucu anahtarla
   * konuşuyor.
   */
  api: string
  /** Ajanın çıkabileceği adresler. Verilmezse `DEFAULT_EGRESS`. */
  egress?: readonly string[]
  /** Kapanışta çıkış proxy'sinin günlüğü (JSON satırları) — doğrulama için. */
  onEgressLog?: (lines: readonly string[]) => void
}

/** npm registry ve Playwright'ın aynaları (1.63.0, kaynağından). */
export const DEFAULT_EGRESS: readonly string[] = [
  'registry.npmjs.org',
  'cdn.playwright.dev',
  'playwright.download.prss.microsoft.com',
]

// ponytail: sabit sınırlar (K0: deneme başına ≤~1 GB, ~1,4 çekirdek, ~200 süreç);
// kayda giriyorlar, suite başına gerekirse bayrak olur.
const LIMITS = { memory: '2g', cpus: '2', pids: 512 } as const
const LIMITS_TEXT = `memory ${LIMITS.memory}, cpus ${LIMITS.cpus}, pids ${LIMITS.pids}`

/** Deneme konteynerinin gördüğü tek anahtar; gerçeğini kimlik proxy'si tutuyor. */
export const API_KEY_PLACEHOLDER = 'assay-placeholder-the-credential-proxy-holds-the-key'

/** Konteynerin içindeki sabit yollar. */
const IN = {
  io: '/assay/io',
  skill: '/assay/skill',
  fixtures: '/assay/fixtures',
  modules: '/opt/assay/node_modules',
  adapter: '/opt/assay/adapter',
} as const

/** Bir koşumun konteyner düzeni: ağ, çıkış proxy'si, bağlanan kod. */
export interface ContainerLayout {
  environment: ContainerEnvironment
  network: string
  egress: string
  apiHost: string
  apiPort: number
  /** Assay kodunun bağlamaları: [ana makine yolu, konteyner yolu]. */
  code: ReadonlyArray<readonly [string, string]>
  /** Worker giriş noktası, konteynerde. */
  worker: string
  /** Adaptör modülü, konteynerde (file URL). */
  adapterModule: string
}

export interface ContainerLaunch {
  args: string[]
  payload: WorkerPayload
  name: string
}

/** Tek bir denemenin `docker run` argümanları ve konteynerin göreceği payload. */
export async function launchAttempt(
  layout: ContainerLayout,
  input: { io: string; payload: WorkerPayload; suitePath?: string; timeoutMs: number },
): Promise<ContainerLaunch> {
  const name = `assay-attempt-${randomUUID().slice(0, 12)}`
  const { payload } = input
  const mounts: Array<[string, string, boolean]> = [
    [input.io, IN.io, false],
    [payload.options.skillPath, IN.skill, true],
    ...layout.code.map(([from, to]): [string, string, boolean] => [from, to, true]),
  ]

  // Fixture ana makinede çözülüyor ve salt okunur bağlanıyor; worker onu
  // konteynerin yolundan kopyalıyor.
  let fixtures: string | undefined
  const hostFixtures = resolveFixtures(payload.testCase.setup?.fixtures, input.suitePath)
  if (hostFixtures !== undefined) {
    const info = await stat(hostFixtures).catch(() => null)
    fixtures = info?.isFile() === true ? `${IN.fixtures}/${basename(hostFixtures)}` : IN.fixtures
    // Yoksa bağlamıyoruz: worker "fixtures path does not exist" diyerek
    // denemeyi `unknown` yapar — ana makinedeki davranışın aynısı.
    if (info !== null) mounts.push([hostFixtures, fixtures, true])
  }

  // Konteyner uid 1000; POSIX'te mkdtemp dizini 0700 ve başka bir sahibe ait.
  await chmod(input.io, 0o777).catch(() => undefined)

  const inner: WorkerPayload = {
    ...payload,
    testCase:
      fixtures === undefined
        ? payload.testCase
        : { ...payload.testCase, setup: { ...payload.testCase.setup, fixtures } },
    adapter: { ...payload.adapter, module: layout.adapterModule },
    options: {
      source: payload.options.source,
      skillPath: IN.skill,
      ...(payload.options.layers === undefined ? {} : { layers: payload.options.layers }),
    },
    resultPath: `${IN.io}/result.json`,
  }

  const env = {
    HTTPS_PROXY: `http://${layout.egress}:3128`,
    // Şart: host `http://` bir base URL'yi de HTTPS_PROXY'ye gönderiyor (K1'de
    // ölçüldü); kimlik proxy'si listede olmazsa model çağrısı reddedilir.
    NO_PROXY: `${layout.apiHost},localhost,127.0.0.1`,
    ANTHROPIC_BASE_URL: `http://${layout.apiHost}:${layout.apiPort}`,
    ANTHROPIC_API_KEY: API_KEY_PLACEHOLDER,
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
  }

  // Supervisor'un zamanlayıcısı önce davranmalı; bu, supervisor öldüyse bile
  // konteynerin sonsuza kadar yaşamamasının güvencesi.
  const hardStopSeconds = Math.ceil(input.timeoutMs / 1000) + 60

  const args = [
    'run',
    '--rm',
    '--init',
    '--name',
    name,
    '--network',
    layout.network,
    '--user',
    'node',
    '--memory',
    LIMITS.memory,
    '--memory-swap',
    LIMITS.memory,
    '--cpus',
    LIMITS.cpus,
    '--pids-limit',
    String(LIMITS.pids),
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    ...Object.entries(env).flatMap(([key, value]) => ['-e', `${key}=${value}`]),
    ...mounts.flatMap(([from, to, readonly]) => [
      '--mount',
      `type=bind,src=${from},dst=${to}${readonly ? ',readonly' : ''}`,
    ]),
    layout.environment.image,
    'timeout',
    '-s',
    'KILL',
    String(hardStopSeconds),
    'node',
    layout.worker,
    `${IN.io}/payload.json`,
  ]
  return { args, payload: inner, name }
}

/**
 * Konteyner koşulunu denemenin sonucuna işler.
 *
 * Hash adaptörün hash'iyle konteyner kaydından türetiliyor; adaptörün
 * kanonikleştirmesini bilmek zorunda değil. Adaptör ortamı okuyamadıysa
 * (oturum açılamadı) sonuç olduğu gibi kalır: ölçülmemiş bir ortama konteyner
 * koşulu eklemek, pin 3'ü ölçülmüş gibi gösterirdi.
 */
export function withContainer(result: AttemptResult, container: ContainerEnvironment): AttemptResult {
  if (result.environment === undefined || result.environmentHash === undefined) return result
  const digest = createHash('sha256')
    .update(`${result.environmentHash}\n${JSON.stringify(container)}`)
    .digest('hex')
  return {
    ...result,
    environment: { ...result.environment, container },
    environmentHash: `sha256:${digest}`,
  }
}

/**
 * Koşumun konteyner düzenini kurar: imajı özete çözer, iç ağı açar, çıkış
 * proxy'sini başlatır ve API konteynerini ağa bağlar.
 *
 * Kayda giren izin listesi runner'ın verdiği değil, **proxy'nin başlarken
 * bildirdiği** liste; ikisi ayrışırsa koşum başlamıyor.
 */
export async function openContainerRun(
  options: ContainerOptions,
  adapter: AdapterSpec,
  runId: string,
  workerPath: string,
): Promise<{ layout: ContainerLayout; close: () => Promise<void> }> {
  const inspected = await docker([
    'image',
    'inspect',
    '--format',
    '{{.Id}} {{.Os}}/{{.Architecture}}',
    options.image,
  ])
  if (!inspected.ok) {
    throw new Error(
      `the container image "${options.image}" was not found (docker build -t ${options.image} tools/runner-env): ${inspected.stderr.trim()}`,
    )
  }
  const [image = '', platform = ''] = inspected.stdout.trim().split(' ')

  const api = /^([A-Za-z0-9][A-Za-z0-9_.-]*):(\d+)$/.exec(options.api)
  if (api === null) throw new Error(`the API container must be given as name:port, got "${options.api}"`)
  const apiHost = api[1] as string
  const apiPort = Number(api[2])

  const code = codeMounts(workerPath, adapter.module)
  const tag = `${runId.slice(-8)}-${randomUUID().slice(0, 4)}`
  const network = `assay-net-${tag}`
  const egress = `assay-egress-${tag}`
  const allow = [...new Set(options.egress ?? DEFAULT_EGRESS)].sort()

  const close = async (): Promise<void> => {
    if (options.onEgressLog !== undefined) {
      const logs = await docker(['logs', egress])
      options.onEgressLog(logs.stdout.trim().split('\n').filter(Boolean))
    }
    await docker(['rm', '-f', egress])
    await docker(['network', 'disconnect', network, apiHost])
    await docker(['network', 'rm', network])
  }

  try {
    await must(docker(['network', 'create', '--internal', network]), 'create the internal network')
    await must(
      docker([
        'run',
        '-d',
        '--rm',
        '--name',
        egress,
        '--user',
        'node',
        '--cap-drop',
        'ALL',
        '--security-opt',
        'no-new-privileges',
        '--memory',
        '256m',
        '-e',
        `ASSAY_EGRESS_ALLOW=${allow.join(',')}`,
        image,
        'node',
        '/opt/assay/egress.mjs',
      ]),
      'start the egress proxy',
    )
    await must(docker(['network', 'connect', network, egress]), 'attach the egress proxy')
    await must(
      docker(['network', 'connect', network, apiHost]),
      `attach the API container "${apiHost}" (is it running?)`,
    )
    const reported = await egressAllowlist(egress)
    if (reported.join(',') !== allow.join(',')) {
      throw new Error(
        `the egress proxy reported [${reported.join(', ')}] but was given [${allow.join(', ')}]`,
      )
    }
  } catch (cause) {
    await close().catch(() => undefined)
    throw cause
  }

  const environment: ContainerEnvironment = { image, platform, egress: allow, limits: LIMITS_TEXT }
  return {
    layout: {
      environment,
      network,
      egress,
      apiHost,
      apiPort,
      code: code.mounts,
      worker: code.worker,
      adapterModule: code.adapterModule,
    },
    close,
  }
}

/** Proxy başlarken dinlediğini ve izin listesini tek satırla söylüyor. */
async function egressAllowlist(container: string): Promise<string[]> {
  for (let tries = 0; tries < 50; tries += 1) {
    const logs = await docker(['logs', container])
    for (const line of logs.stdout.split('\n')) {
      try {
        const event = JSON.parse(line) as { kind?: string; allow?: string[] }
        if (event.kind === 'listening' && Array.isArray(event.allow)) return [...event.allow].sort()
      } catch {
        // JSON olmayan satır: proxy'nin değil, geç.
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`the egress proxy ${container} did not report that it was listening`)
}

/**
 * Konteynere bağlanacak Assay kodu.
 *
 * Paketlerin `dist`i ve `package.json`ı (exports alanı için) — `node_modules`
 * değil: pnpm'in bağlantıları Linux'ta çözülmüyor ve üçüncü taraf bağımlılıklar
 * zaten imajda.
 */
export function codeMounts(
  workerPath: string,
  adapterModule: string,
): { mounts: Array<readonly [string, string]>; worker: string; adapterModule: string } {
  const runnerRoot = packageRoot(workerPath)
  const coreRoot = packageRoot(createRequire(import.meta.url).resolve('@ktlsr/assay-core'))
  const mounts: Array<readonly [string, string]> = []
  const mounted = new Map<string, string>()
  const mount = (root: string): string => {
    const known = mounted.get(root)
    if (known !== undefined) return known
    const target = `${IN.modules}/${packageName(root)}`
    mounts.push([join(root, 'dist'), `${target}/dist`], [join(root, 'package.json'), `${target}/package.json`])
    mounted.set(root, target)
    return target
  }
  const runnerTarget = mount(runnerRoot)
  mount(coreRoot)

  const adapterPath = adapterModule.startsWith('file:') ? fileURLToPath(adapterModule) : adapterModule
  if (!existsSync(adapterPath)) {
    throw new Error(`the container mode needs the adapter module as a file path; "${adapterModule}" is not one`)
  }
  const adapterRoot = packageRoot(adapterPath)
  let inside: string
  if (relative(adapterRoot, adapterPath).split(sep)[0] === 'dist') {
    inside = `${mount(adapterRoot)}/${posixPath(relative(adapterRoot, adapterPath))}`
  } else {
    // ponytail: paket dışı tek dosyalık adaptör (test fikstürü) dosya olarak
    // bağlanıyor; yalnızca Node yerleşiklerini içe aktarabilir.
    inside = `${IN.adapter}/${basename(adapterPath)}`
    mounts.push([adapterPath, inside])
  }

  return {
    mounts,
    worker: `${runnerTarget}/${posixPath(relative(runnerRoot, workerPath))}`,
    adapterModule: `file://${inside}`,
  }
}

function packageRoot(file: string): string {
  let dir = dirname(file)
  for (;;) {
    if (existsSync(join(dir, 'package.json'))) return dir
    const parent = dirname(dir)
    if (parent === dir) throw new Error(`no package.json above ${file}`)
    dir = parent
  }
}

function packageName(root: string): string {
  return (JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { name: string }).name
}

const posixPath = (path: string) => path.split(sep).join('/')

interface DockerResult {
  ok: boolean
  stdout: string
  stderr: string
}

/** `docker` çağrısı; hata fırlatmıyor, sonucu söylüyor. */
export function docker(args: readonly string[]): Promise<DockerResult> {
  return new Promise((resolve) => {
    execFile('docker', [...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ ok: error === null, stdout, stderr })
    })
  })
}

async function must(result: Promise<DockerResult>, what: string): Promise<void> {
  const done = await result
  if (!done.ok) throw new Error(`could not ${what}: ${done.stderr.trim()}`)
}
