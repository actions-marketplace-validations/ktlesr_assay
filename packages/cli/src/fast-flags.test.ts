/**
 * `--fast` ve `--max-attempts` runner'a ne veriyor?
 *
 * Hızlı modun ilk hâli gizli bir 60 denemelik tavan koyuyordu. Bütçenin kestiği
 * koşum artık `pass` veremediği için o tavan, 20 vakadan büyük her suite'i hızlı
 * modda sessizce `unknown`a mahkûm ederdi (decisions.md, 2026-09-10). Tavan
 * yalnızca kullanıcının `--max-attempts`inden gelmeli — burada ölçülen o.
 *
 * `runSuite` sahte: soru CLI'ın ona hangi seçenekleri verdiği, host'un ne
 * yaptığı değil. Ayrı dosyada, çünkü `vi.mock` dosyanın tamamını etkiliyor.
 */

import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { RunOptions } from '@ktlsr/assay-runner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { main } from './cli.js'

const seen = vi.hoisted(() => [] as RunOptions[])

vi.mock('@ktlsr/assay-runner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ktlsr/assay-runner')>()
  return {
    ...actual,
    runSuite: vi.fn(async (suite: { target: { skill: string }; runs: number }, _adapter: unknown, options: RunOptions) => {
      seen.push(options)
      return actual.assembleRun({
        id: `run-flags-${seen.length}-${Date.now()}`,
        startedAt: '2026-09-10T00:00:00.000Z',
        finishedAt: '2026-09-10T00:00:01.000Z',
        host: 'mock',
        skill: suite.target.skill,
        runs: options.repeat ?? suite.runs,
        pins: {
          skillSource: 'local',
          skillHash: 'sha256:s',
          model: 'm',
          systemPromptHash: 'not-provided-by-host',
          suiteVersion: 1,
          suiteHash: 'sha256:q',
        },
        attempts: [],
      })
    }),
  }
})

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const suitePath = join(repoRoot, 'examples/widget-manifest.suite.yaml')

async function runCli(...flags: string[]): Promise<RunOptions> {
  const skill = await mkdtemp(join(tmpdir(), 'assay-flags-skill-'))
  await writeFile(join(skill, 'SKILL.md'), '# widget\n')
  const store = await mkdtemp(join(tmpdir(), 'assay-flags-store-'))
  const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  try {
    await main(['run', suitePath, '--skill', skill, '--store', store, '--no-isolation', ...flags])
  } finally {
    write.mockRestore()
  }
  const options = seen.at(-1)
  if (options === undefined) throw new Error('runSuite was never called')
  return options
}

beforeEach(() => {
  seen.length = 0
})

describe('--fast', () => {
  it('uc tekrar ve yalniz tetiklenme katmani veriyor, GIZLI TAVAN VERMIYOR', async () => {
    const options = await runCli('--fast')
    // Pozitif kontrol: hızlı mod gerçekten devrede.
    expect(options.layers).toEqual(['trigger'])
    expect(options.repeat).toBe(3)
    expect(options.maxAttempts).toBeUndefined()
  })

  it('tavani yalnizca --max-attempts koyuyor', async () => {
    expect((await runCli('--fast', '--max-attempts', '5')).maxAttempts).toBe(5)
    expect((await runCli('--max-attempts', '4')).maxAttempts).toBe(4)
  })

  it('tam kosumda katman ve tavan yok', async () => {
    const options = await runCli()
    expect(options.layers).toBeUndefined()
    expect(options.maxAttempts).toBeUndefined()
  })
})
