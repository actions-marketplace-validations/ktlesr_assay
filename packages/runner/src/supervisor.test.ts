/**
 * 0.3.0-c — deneme öldürülebilir, koşum öldürülemez.
 *
 * Testler gerçek süreçlerle: worker gerçekten `SIGKILL` ediliyor, yetim süreç
 * gerçekten başlatılıyor ve gerçekten sayılıyor. Taklit edilen bir "çökme"
 * bu davranışı göstermez, çünkü ölçülen şey tam olarak haber vermeden ölen
 * bir sürecin arkasında ne bıraktığı.
 *
 * Ölçülen tavan da burada: sevk katmanı öldürülürse koşum durur. Bunu
 * göstermek de testin işi — "korunuyor" demiyoruz, ne kadar koruduğumuzu
 * söylüyoruz.
 */

import { execFileSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseSuite, type Suite } from '@ktlsr/assay-core'
import { beforeAll, describe, expect, it } from 'vitest'
import { runSuite } from './run.js'
import { MockAdapter } from './testing/mock-adapter.js'
import { superviseAttempt, workerEntry } from './supervisor.js'
import { killTree } from './process.js'
import { findJournals, readJournal } from './journal.js'
import type { AdapterSpec } from './worker.js'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../..')
const slowAdapter = join(repoRoot, 'tools/fixtures/slow-adapter.mjs')

const SUITE_SOURCE = `
version: 1
target: { skill: widget, source: local@abc123 }
environment:
  host: mock
  model: test-model-1
  system_prompt_hash: sha256:aaa
runs: 3
cases:
  - id: trigger.positive.explicit
    prompt: Turn this draft into a widget.
    expect: { triggered: true }
  - id: trigger.negative.near_neighbor.readme
    prompt: Turn this draft into a README.
    expect: { triggered: false }
`

let suite: Suite
let skillPath: string

const spec = (env: Record<string, string> = {}): AdapterSpec => {
  // Worker `process.env`i devralıyor; fixture davranışını oradan okuyor.
  for (const [key, value] of Object.entries(env)) process.env[key] = value
  return { module: slowAdapter, export: 'SlowMockAdapter' }
}

beforeAll(async () => {
  const parsed = parseSuite(SUITE_SOURCE)
  if (!parsed.ok) throw new Error(parsed.issues.map((i) => i.message).join('; '))
  suite = parsed.suite
  skillPath = await mkdtemp(join(tmpdir(), 'assay-skill-'))
  await writeFile(join(skillPath, 'SKILL.md'), '# widget\n')

  // Worker derlenmiş `dist`ten koşuyor; her koşumda derleniyor (~100 ms
  // güncelken). "Varsa koş" sessiz geçiş, bayat `dist` ise eski kodu ölçmek.
  execFileSync(process.execPath, [join(repoRoot, 'node_modules/typescript/bin/tsc'), '-b'], {
    cwd: repoRoot,
    stdio: 'inherit',
  })
  expect(existsSync(workerEntry())).toBe(true)
}, 180_000)

// ---------------------------------------------------------------------------
// Gerçek senaryo: worker öldürülüyor
// ---------------------------------------------------------------------------

describe('öldürülen worker', () => {
  it('sevk katmani ayakta kalir, deneme unknown olur, kosum devam eder', async () => {
    const store = await mkdtemp(join(tmpdir(), 'assay-store-'))
    const pidFile = join(store, 'worker.pid')

    // İlk denemenin worker'ı yavaş; test onu bulup öldürecek. Sonrakiler hızlı
    // koşup ölçüm üretecek — "koşum devam ediyor" iddiası ancak böyle sınanır.
    const adapter = spec({
      ASSAY_TEST_SLOW_MS: '4000',
      ASSAY_TEST_PID_FILE: pidFile,
    })

    let killed = false
    const killWhenReady = async () => {
      for (let i = 0; i < 200; i += 1) {
        const raw = await readFile(pidFile, 'utf8').catch(() => null)
        if (raw !== null && raw.trim() !== '') {
          // Ajanın yaptığı şey: PID'i bul, öldür. Haber yok, temizlik yok.
          await killTree(Number(raw.trim()))
          killed = true
          return
        }
        await new Promise((r) => setTimeout(r, 50))
      }
    }

    const [record] = await Promise.all([
      runSuite(suite, new MockAdapter({ scenarios: [{}] }), {
        source: SUITE_SOURCE,
        skillPath,
        journalDir: join(store, 'runs'),
        isolate: adapter,
        repeat: 2,
        attemptTimeoutMs: 30_000,
      }),
      killWhenReady(),
    ])

    expect(killed).toBe(true)

    const attempts = record.cases.flatMap((c) => c.attempts)
    const unknowns = attempts.filter((a) => a.verdict === 'unknown')
    const decided = attempts.filter((a) => a.verdict !== 'unknown')

    // 1. Öldürülen deneme `unknown` — `fail` değil. Ölçüm yapılmadı;
    //    kullanıcıyı kırık olmayan bir skill'i tamir etmeye göndermeyiz.
    expect(unknowns.length).toBeGreaterThanOrEqual(1)
    expect(unknowns[0]?.reason).toMatch(/attempt process (was killed|exited)/)

    // 2. Koşum devam etti: kalan denemeler ölçüldü.
    expect(decided.length).toBeGreaterThanOrEqual(2)

    // 3. Sevk katmanı ayakta: dört deneme de kayda girdi (2 vaka × 2).
    expect(attempts).toHaveLength(4)
  }, 120_000)

  it('sonuc yazmadan cikan worker unknown uretir, uydurulmaz', async () => {
    const failing: AdapterSpec = {
      module: slowAdapter,
      export: 'NoSuchAdapter',
    }
    const supervised = await superviseAttempt(suite, suite.cases[0] as never, 0, {
      adapter: failing,
      source: SUITE_SOURCE,
      skillPath,
    })
    expect(supervised.result).toBeNull()
    expect(supervised.reason).toContain('exited with code 1')
  }, 60_000)
})

// ---------------------------------------------------------------------------
// Yetim süreçler
// ---------------------------------------------------------------------------

describe('süreç ağacı', () => {
  /*
   * Bu testin ilk hâli porta bakıyordu ve YANLIŞ SEBEPLE geçiyordu: sunucu
   * dinlemeye başlamadan port zaten boş görünüyordu, ağaç öldürme kaldırılınca
   * bile yeşil kaldı (ters çevirme yakaladı). Şimdi yetimin PID'i ölçülüyor —
   * "öldü mü" sorusunun tek doğrudan cevabı.
   */
  it('ajanin baslattigi cocuk deneme sonunda gercekten oluyor', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'assay-orphan-'))
    const orphanPidFile = join(dir, 'orphan.pid')
    const port = 5390 + Math.floor(Math.random() * 40)
    delete process.env['ASSAY_TEST_SLOW_MS']
    delete process.env['ASSAY_TEST_PID_FILE']
    const adapter = spec({
      ASSAY_TEST_ORPHAN_PORT: String(port),
      ASSAY_TEST_ORPHAN_PID_FILE: orphanPidFile,
    })

    const supervised = await superviseAttempt(suite, suite.cases[0] as never, 0, {
      adapter,
      source: SUITE_SOURCE,
      skillPath,
    })
    expect(supervised.result).not.toBeNull()
    expect(supervised.treeKilled).toBe(true)

    // Pozitif kontrol: yetim gerçekten başladı. Bu satır olmadan test,
    // hiç başlamamış bir süreci "öldürüldü" sayabilirdi.
    const orphanPid = Number((await readFile(orphanPidFile, 'utf8')).trim())
    expect(Number.isInteger(orphanPid)).toBe(true)

    // Ve gerçekten öldü. Ölüm anlıksa değil; kısa bir pencere tanınıyor.
    expect(await goneWithin(orphanPid, 5_000)).toBe(true)
  }, 60_000)

  /*
   * Yukarıdaki test worker'ın canlı kalmasına YARIŞLA bağlı: worker `DONE`
   * yazıp kendiliğinden çıkarsa Linux'ta ağaç kopuyor, ama `ps` fotoğrafı ondan
   * önce çekilirse test yine geçiyor. Konteynerde aynı kod bir kez kırmızı, bir
   * kez yeşil çıktı. Canlı kalma burada doğrudan ve yarışsız ölçülüyor.
   */
  it('worker DONE dedikten sonra kendi kendine cikmiyor', async () => {
    const worker = await startWorker(process.execPath, [workerEntry()])
    await new Promise((r) => setTimeout(r, 1_500))
    expect(alive(worker.pid)).toBe(true)
    await killTree(worker.pid)
  }, 60_000)

  it('ebeveyni olen worker asili kalmiyor', async () => {
    // Ara süreç worker'ı başlatıp PID'ini basıyor ve ölüyor — sevk katmanının
    // `taskkill /F /IM node.exe` ile öldürüldüğü tavan durumu.
    const launcher = `
      const { spawn } = require('node:child_process')
      const w = spawn(process.execPath, process.argv.slice(1), { stdio: ['ignore', 'pipe', 'ignore'], detached: true })
      w.stdout.on('data', (d) => { if (String(d).includes('assay:attempt-done')) { console.log(w.pid); process.exit(0) } })
    `
    const worker = await startWorker(process.execPath, ['-e', launcher, workerEntry()], true)
    // Pozitif kontrol yukarıdaki testte: ebeveyni yaşarken worker ölmüyor.
    const gone = await goneWithin(worker.pid, 5_000)
    // Test düşerse worker sonsuza kadar yaşar — ters çevirme koşumu makinede
    // saatlerce bir yetim bıraktı. Sonuç ne olursa olsun kapatılıyor.
    if (!gone) await killTree(worker.pid)
    expect(gone).toBe(true)
  }, 60_000)
})

/**
 * Worker'ı sevk katmanının kurduğu yükle başlatır, `DONE` görene kadar bekler.
 * `viaLauncher` iken stdout'taki ilk sayı worker'ın PID'i (ara süreç basıyor).
 */
async function startWorker(
  command: string,
  args: string[],
  viaLauncher = false,
): Promise<{ pid: number }> {
  // Önceki testin yetim ayarları `process.env`de kalıyor; worker devralırsa
  // kendi yetimini doğurur ve ölçülen şey değişir.
  delete process.env['ASSAY_TEST_ORPHAN_PORT']
  delete process.env['ASSAY_TEST_ORPHAN_PID_FILE']
  const dir = await mkdtemp(join(tmpdir(), 'assay-worker-test-'))
  const payloadPath = join(dir, 'payload.json')
  await writeFile(
    payloadPath,
    JSON.stringify({
      suite,
      testCase: suite.cases[0],
      index: 0,
      adapter: spec(),
      options: { source: SUITE_SOURCE, skillPath },
      resultPath: join(dir, 'result.json'),
    }),
    'utf8',
  )
  const child = spawn(command, [...args, payloadPath], { stdio: ['ignore', 'pipe', 'inherit'] })
  let out = ''
  child.stdout.setEncoding('utf8')
  await new Promise<void>((resolve, reject) => {
    child.stdout.on('data', (chunk: string) => {
      out += chunk
      if (viaLauncher ? /^\d+\s/m.test(out) : out.includes('assay:attempt-done')) resolve()
    })
    child.on('error', reject)
  })
  return { pid: viaLauncher ? Number(out.trim().split(/\s+/)[0]) : (child.pid as number) }
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// TAVAN — sevk katmanı da öldürülebilir
// ---------------------------------------------------------------------------

describe('tavan: sevk katmani da bir node sureci', () => {
  it('sevk katmani oldurulurse kosum durur; journal o ana kadarini tutar', async () => {
    const store = await mkdtemp(join(tmpdir(), 'assay-store-'))
    const journalDir = join(store, 'runs')
    const harness = join(repoRoot, 'tools/fixtures/killable-run.mjs')

    const child = spawn(process.execPath, [harness, journalDir, skillPath], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    await new Promise<void>((done, fail) => {
      let seen = 0
      const timer = setTimeout(() => fail(new Error('no attempt reported')), 60_000)
      child.stdout.setEncoding('utf8')
      child.stdout.on('data', (chunk: string) => {
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('attempt ')) continue
          seen += 1
          if (seen === 2) {
            clearTimeout(timer)
            child.kill('SIGKILL')
            child.on('close', () => done())
          }
        }
      })
    })

    // Koşum durdu: kayıt yok. Bu, kapatılmayan sınırın kendisi.
    const journals = await findJournals(journalDir)
    expect(journals).toHaveLength(1)
    // Ama ölçülen kısım duruyor (0.3.0-b).
    const contents = await readJournal(journals[0] as string)
    expect(contents?.attempts.length).toBeGreaterThanOrEqual(2)
  }, 120_000)
})

/** Süreç verilen süre içinde gerçekten öldü mü. Sinyal 0 yalnızca sorar. */
async function goneWithin(pid: number, ms: number): Promise<boolean> {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0)
    } catch {
      return true
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  return false
}