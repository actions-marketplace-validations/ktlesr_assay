/**
 * K2 — konteyner koşumunun saf kısımları: kayda giren koşul, `docker run`
 * argümanları, konteynere giden payload ve bağlanan kod.
 *
 * Docker'la uçtan uca doğrulama `tools/runner-env/verify.mjs`te (imaj 2 GB,
 * CI'da yok); burada Docker gerekmiyor.
 */

import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseSuite, type ContainerEnvironment, type Environment } from '@ktlsr/assay-core'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  API_KEY_PLACEHOLDER,
  codeMounts,
  launchAttempt,
  withContainer,
  type ContainerLayout,
} from './container.js'
import type { AttemptResult } from './run.js'
import type { WorkerPayload } from './worker.js'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../..')
const workerPath = join(repoRoot, 'packages/runner/dist/worker.js')

const container: ContainerEnvironment = {
  image: 'sha256:aaaa',
  platform: 'linux/amd64',
  egress: ['cdn.playwright.dev', 'registry.npmjs.org'],
  limits: 'memory 2g, cpus 2, pids 512',
}

const hostEnvironment: Environment = {
  model: 'm',
  version: '1',
  tools: ['Bash'],
  skills: ['s'],
  agents: [],
  plugins: [],
  memory: [],
}

const measured = (): AttemptResult => ({
  attempt: {
    index: 0,
    caseId: 'c',
    startedAt: '',
    finishedAt: '',
    trigger: { available: false, reason: 'x' },
    assertions: [],
    verdict: 'pass',
    reason: '',
    latencyMs: 1,
  },
  environmentHash: 'sha256:host',
  environment: hostEnvironment,
})

describe('konteyner koşulu kayda ve hash\'e giriyor', () => {
  it('ortama konteyneri ekler ve hash\'i değiştirir', () => {
    const out = withContainer(measured(), container)
    expect(out.environment?.container).toEqual(container)
    expect(out.environmentHash).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(out.environmentHash).not.toBe('sha256:host')
  })

  it('aynı girdide aynı hash, konteynerin her alanı hash\'i kaydırır', () => {
    const base = withContainer(measured(), container).environmentHash
    expect(withContainer(measured(), container).environmentHash).toBe(base)
    for (const changed of [
      { ...container, image: 'sha256:bbbb' },
      { ...container, platform: 'linux/arm64' },
      { ...container, egress: ['registry.npmjs.org'] },
      { ...container, limits: 'memory 4g, cpus 2, pids 512' },
    ]) {
      expect(withContainer(measured(), changed).environmentHash).not.toBe(base)
    }
  })

  it('ortamı okunamamış bir denemeye koşul uydurmaz', () => {
    const unmeasured: AttemptResult = { attempt: measured().attempt }
    expect(withContainer(unmeasured, container)).toEqual(unmeasured)
  })
})

describe('docker run', () => {
  let io: string
  let skill: string
  let fixturesDir: string
  let suitePath: string
  let payload: WorkerPayload
  const layout: ContainerLayout = {
    environment: container,
    network: 'assay-net-x',
    egress: 'assay-egress-x',
    apiHost: 'assay-api',
    apiPort: 8080,
    code: [['/host/runner/dist', '/opt/assay/node_modules/@ktlsr/assay-runner/dist']],
    worker: '/opt/assay/node_modules/@ktlsr/assay-runner/dist/worker.js',
    adapterModule: 'file:///opt/assay/node_modules/@ktlsr/assay-adapters/dist/index.js',
  }

  beforeAll(async () => {
    const root = await mkdtemp(join(tmpdir(), 'assay-container-test-'))
    io = join(root, 'io')
    skill = join(root, 'skill')
    fixturesDir = join(root, 'fixtures', 'app')
    await mkdir(io)
    await mkdir(skill)
    await mkdir(fixturesDir, { recursive: true })
    await mkdir(join(root, 'suites'))
    suitePath = join(root, 'suites', 'x.suite.yaml')
    const parsed = parseSuite(`
version: 1
target: { skill: s, source: local }
environment: { host: claude-code, model: m, system_prompt_hash: h }
runs: 2
cases:
  - id: trigger.positive.a
    prompt: build it
    setup: { fixtures: ../fixtures/app }
    expect: { triggered: true }
  - id: trigger.negative.unrelated.b
    prompt: no
    expect: { triggered: false }
`)
    if (!parsed.ok) throw new Error('suite')
    payload = {
      suite: parsed.suite,
      testCase: parsed.suite.cases[0] as (typeof parsed.suite.cases)[number],
      index: 0,
      adapter: { module: 'file:///host/adapters/dist/index.js', export: 'ClaudeCodeAdapter' },
      options: { source: 'src', suitePath, skillPath: skill, layers: ['trigger'] },
      resultPath: join(io, 'result.json'),
    }
  })

  it('iç ağda, kök olmayan kullanıcıyla, yetkisiz ve sınırlarla koşar', async () => {
    const { args } = await launchAttempt(layout, { io, payload, suitePath, timeoutMs: 20_000 })
    const pair = (flag: string) => args[args.indexOf(flag) + 1]
    expect(pair('--network')).toBe('assay-net-x')
    expect(pair('--user')).toBe('node')
    expect(pair('--cap-drop')).toBe('ALL')
    expect(pair('--security-opt')).toBe('no-new-privileges')
    expect(pair('--memory')).toBe('2g')
    expect(pair('--memory-swap')).toBe('2g')
    expect(pair('--pids-limit')).toBe('512')
    expect(args).toContain('--rm')
    expect(args).toContain('--init')
    // İmaj özetiyle koşuyor, adıyla değil: kayda giren özet koşan imaj.
    expect(args).toContain('sha256:aaaa')
    // Supervisor ölürse bile konteyner kendini kapatıyor.
    expect(args.slice(args.indexOf('timeout'), args.indexOf('timeout') + 4)).toEqual(['timeout', '-s', 'KILL', '80'])
  })

  it('model çağrısı proxy dışında, çıkış proxy\'den; yalnızca yer tutucu anahtar', async () => {
    process.env['CLAUDE_CODE_OAUTH_TOKEN'] = 'real-token-must-not-leak'
    process.env['ANTHROPIC_API_KEY'] = 'sk-real-must-not-leak'
    try {
      const { args } = await launchAttempt(layout, { io, payload, suitePath, timeoutMs: 1000 })
      const env = args.flatMap((arg, i) => (args[i - 1] === '-e' ? [arg] : []))
      expect(env).toContain('HTTPS_PROXY=http://assay-egress-x:3128')
      expect(env).toContain('NO_PROXY=assay-api,localhost,127.0.0.1')
      expect(env).toContain('ANTHROPIC_BASE_URL=http://assay-api:8080')
      expect(env).toContain(`ANTHROPIC_API_KEY=${API_KEY_PLACEHOLDER}`)
      expect(env).toContain('CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1')
      expect(args.join(' ')).not.toMatch(/real-token-must-not-leak|sk-real-must-not-leak|CLAUDE_CODE_OAUTH_TOKEN/)
    } finally {
      delete process.env['CLAUDE_CODE_OAUTH_TOKEN']
      delete process.env['ANTHROPIC_API_KEY']
    }
  })

  it('yalnızca giriş/çıkış dizini yazılabilir; skill, fixture ve kod salt okunur', async () => {
    const { args } = await launchAttempt(layout, { io, payload, suitePath, timeoutMs: 1000 })
    const mounts = args.flatMap((arg, i) => (args[i - 1] === '--mount' ? [arg] : []))
    expect(mounts).toContain(`type=bind,src=${io},dst=/assay/io`)
    expect(mounts).toContain(`type=bind,src=${skill},dst=/assay/skill,readonly`)
    expect(mounts).toContain(`type=bind,src=${fixturesDir},dst=/assay/fixtures,readonly`)
    expect(mounts).toContain('type=bind,src=/host/runner/dist,dst=/opt/assay/node_modules/@ktlsr/assay-runner/dist,readonly')
    expect(mounts.filter((m) => !m.endsWith(',readonly'))).toEqual([`type=bind,src=${io},dst=/assay/io`])
  })

  it('konteynerin payload\'ı konteynerin yollarını taşıyor', async () => {
    const { payload: inner } = await launchAttempt(layout, { io, payload, suitePath, timeoutMs: 1000 })
    expect(inner.resultPath).toBe('/assay/io/result.json')
    expect(inner.options).toEqual({ source: 'src', skillPath: '/assay/skill', layers: ['trigger'] })
    expect(inner.testCase.setup?.fixtures).toBe('/assay/fixtures')
    expect(inner.adapter.module).toBe(layout.adapterModule)
    expect(inner.adapter.export).toBe('ClaudeCodeAdapter')
  })

  it('tek dosyalık fixture dosya olarak bağlanır', async () => {
    const file = join(dirname(fixturesDir), 'data.csv')
    await writeFile(file, 'a,b\n')
    const withFile = {
      ...payload,
      testCase: { ...payload.testCase, setup: { fixtures: '../fixtures/data.csv' } },
    }
    const { args, payload: inner } = await launchAttempt(layout, {
      io,
      payload: withFile,
      suitePath,
      timeoutMs: 1000,
    })
    expect(inner.testCase.setup?.fixtures).toBe('/assay/fixtures/data.csv')
    expect(args).toContain(`type=bind,src=${file},dst=/assay/fixtures/data.csv,readonly`)
  })
})

describe('bağlanan kod', () => {
  it('runner, core ve adaptör paketi dist ve package.json olarak', () => {
    const adapters = pathToFileURL(join(repoRoot, 'packages/adapters/dist/index.js')).href
    const code = codeMounts(workerPath, adapters)
    const targets = code.mounts.map(([, to]) => to)
    for (const name of ['assay-runner', 'assay-core', 'assay-adapters']) {
      expect(targets).toContain(`/opt/assay/node_modules/@ktlsr/${name}/dist`)
      expect(targets).toContain(`/opt/assay/node_modules/@ktlsr/${name}/package.json`)
    }
    expect(code.mounts).toHaveLength(6)
    expect(code.worker).toBe('/opt/assay/node_modules/@ktlsr/assay-runner/dist/worker.js')
    expect(code.adapterModule).toBe('file:///opt/assay/node_modules/@ktlsr/assay-adapters/dist/index.js')
  })

  it('paket dışı tek dosyalık adaptör dosya olarak bağlanır', () => {
    const fixture = join(repoRoot, 'tools/fixtures/slow-adapter.mjs')
    const code = codeMounts(workerPath, pathToFileURL(fixture).href)
    expect(code.mounts).toContainEqual([fixture, '/opt/assay/adapter/slow-adapter.mjs'])
    expect(code.adapterModule).toBe('file:///opt/assay/adapter/slow-adapter.mjs')
  })

  it('dosya olmayan bir adaptör tarifini reddeder', () => {
    expect(() => codeMounts(workerPath, '@ktlsr/assay-adapters')).toThrow(/file path/)
  })
})
