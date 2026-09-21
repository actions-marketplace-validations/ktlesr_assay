import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  ancestorExcludes,
  ClaudeCodeAdapter,
  environmentHash,
  memoryEntries,
  writeMemoryProbe,
} from './adapter.js'
import type { ClaudeCodeSession } from './adapter.js'
import type { ParsedStream } from './stream.js'

/**
 * Talimat dosyası sızıntısı — kesim ve ölçüm (0.4.5).
 *
 * Host çalışma dizininden köke kadar her dizinde CLAUDE.md arıyor; Windows'ta
 * `%TEMP%` ev dizininin altında olduğu için kullanıcının `~/.claude/CLAUDE.md`'si
 * her denemede yükleniyordu. Burada sınanan: üst dizinlerin dışlanması, host'un
 * ölçüm kancasının gerçekten çalışan bir betik olması ve günlüğün doğru okunması.
 * Host'un kendisiyle uçtan uca doğrulama `tools/probe-host-memory.mjs`te
 * (ücretsiz: sahte anahtar + yerel yakalayıcı).
 */

const slash = (path: string) => path.split('\\').join('/')
const cleanup: string[] = []
afterEach(async () => {
  for (const dir of cleanup.splice(0)) await rm(dir, { recursive: true, force: true })
})

describe('ancestorExcludes', () => {
  const workdir = resolve(tmpdir(), 'assay-a', 'assay-b', 'work')

  it('calisma dizininin her ust dizinindeki talimat yerlerini dislar', () => {
    const excludes = ancestorExcludes(workdir)
    let dir = dirname(workdir)
    for (;;) {
      const base = slash(dir).replace(/\/$/, '')
      expect(excludes).toContain(`${base}/CLAUDE.md`)
      expect(excludes).toContain(`${base}/.claude/**`)
      expect(excludes).toContain(`${base}/CLAUDE.local.md`)
      if (dirname(dir) === dir) break
      dir = dirname(dir)
    }
  })

  it('calisma dizininin kendisini dislamaz — oradaki CLAUDE.md fixture', () => {
    expect(ancestorExcludes(workdir)).not.toContain(`${slash(workdir)}/CLAUDE.md`)
  })
})

describe('writeMemoryProbe', () => {
  it('dislamayi ve iki kancayi config dizinine yazar; kanca gercekten calisir', async () => {
    const configDir = await mkdtemp(join(tmpdir(), 'assay-cc-test-'))
    const workdir = await mkdtemp(join(tmpdir(), 'assay-work-test-'))
    cleanup.push(configDir, workdir)
    await writeMemoryProbe(configDir, workdir)

    const settings = JSON.parse(await readFile(join(configDir, 'settings.json'), 'utf8')) as {
      claudeMdExcludes: string[]
      hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>
    }
    expect(settings.claudeMdExcludes).toEqual(ancestorExcludes(workdir))
    const command = settings.hooks['InstructionsLoaded']?.[0]?.hooks[0]?.command ?? ''
    expect(settings.hooks['UserPromptSubmit']?.[0]?.hooks[0]?.command).toBe(command)

    // Host'un yapacağı gibi: komutu çalıştır, olayı stdin'den ver.
    const [bin, script, log] = [...command.matchAll(/"([^"]+)"/g)].map((m) => m[1] as string)
    const fire = (event: object) =>
      spawnSync(bin as string, [script as string, log as string], { input: JSON.stringify(event) })
    const leaked = join(workdir, '..', 'CLAUDE.md')
    fire({ hook_event_name: 'InstructionsLoaded', file_path: leaked, memory_type: 'Project', load_reason: 'session_start' })
    const out = fire({ hook_event_name: 'UserPromptSubmit', prompt: 'x' })
    // Kanarya bağlama bir şey eklememeli: UserPromptSubmit stdout'u isteme girer.
    expect(out.stdout.toString()).toBe('')

    const entries = memoryEntries(await readFile(log as string, 'utf8'), workdir, new Map())
    expect(entries).toEqual([`Project ${leaked} unreadable`])
  })
})

describe('memoryEntries', () => {
  const workdir = resolve(tmpdir(), 'assay-work-x')
  const line = (event: object) => JSON.stringify(event)
  const canary = line({ hook_event_name: 'UserPromptSubmit' })
  const loaded = (file_path: string, load_reason = 'session_start') =>
    line({ hook_event_name: 'InstructionsLoaded', file_path, memory_type: 'Project', load_reason })

  it('kanarya yoksa olculmedi — "yuklenmedi" degil', () => {
    expect(memoryEntries('', workdir, new Map())).toBeUndefined()
    expect(memoryEntries(loaded(join(workdir, 'CLAUDE.md')), workdir, new Map())).toBeUndefined()
  })

  it('kanarya var, yukleme yok: olculdu ve temiz', () => {
    expect(memoryEntries(canary, workdir, new Map())).toEqual([])
  })

  it('disaridan yuklenen her dosya sebebi ne olursa olsun girer', () => {
    const outside = resolve(tmpdir(), 'CLAUDE.md')
    const hashes = new Map([[outside, 'sha256:aaaa']])
    expect(memoryEntries([canary, loaded(outside, 'nested_traversal')].join('\n'), workdir, hashes)).toEqual([
      `Project ${outside} sha256:aaaa`,
    ])
  })

  it('iceriden yalniz oturum basinda yuklenenler, goreli yolla', () => {
    const inside = join(workdir, 'CLAUDE.md')
    const nested = join(workdir, 'sub', 'CLAUDE.md')
    const log = [canary, loaded(inside), loaded(nested, 'nested_traversal')].join('\n')
    expect(memoryEntries(log, workdir, new Map([[inside, 'sha256:bbbb']]))).toEqual([
      'Project ./CLAUDE.md sha256:bbbb',
    ])
  })

  it('bozuk satir atlanir, olcum dusmez', () => {
    expect(memoryEntries(`${canary}\n{yarım`, workdir, new Map())).toEqual([])
  })
})

describe('finalize — memory ortam kaydinda ve hash te', () => {
  const init: NonNullable<ParsedStream['init']> = {
    sessionId: 's1',
    model: 'claude-haiku-4-5-20251001',
    cwd: '/w',
    version: '2.1.270',
    permissionMode: 'acceptEdits',
    outputStyle: 'default',
    tools: ['Read'],
    skills: ['s'],
    agents: [],
    plugins: [],
  }
  const session = (memory?: readonly string[]): ClaudeCodeSession => ({
    id: 'x',
    adapter: 'claude-code',
    startedAt: new Date(0).toISOString(),
    targetSkill: 's',
    exitCode: 0,
    latencyMs: 1,
    stderr: '',
    configDir: '/nonexistent',
    ...(memory === undefined ? {} : { memory }),
    parsed: {
      init,
      result: {
        subtype: 'success',
        isError: false,
        numTurns: 1,
        terminalReason: 'completed',
        inputTokens: 1,
        outputTokens: 1,
        permissionDenials: [],
      },
      trace: [],
      triggeredSkills: [],
      refusals: [],
      malformed: 0,
    },
  })
  const adapter = new ClaudeCodeAdapter({ cleanup: false })

  it('olculmus bellek kayda girer ve hash i degistirir', async () => {
    const leaked = await adapter.finalize(session(['Project C:/Users/u/.claude/CLAUDE.md sha256:aa']))
    const clean = await adapter.finalize(session([]))
    expect(leaked.environment?.memory).toEqual(['Project C:/Users/u/.claude/CLAUDE.md sha256:aa'])
    expect(clean.environment?.memory).toEqual([])
    expect(leaked.environmentHash).not.toBe(clean.environmentHash)
  })

  it('olculmemis oturumda alan yazilmaz ve hash 0.4.5 oncesiyle ayni kalir', async () => {
    const unmeasured = await adapter.finalize(session())
    expect(unmeasured.environment?.memory).toBeUndefined()
    expect(unmeasured.environmentHash).toBe(environmentHash(init))
  })
})
