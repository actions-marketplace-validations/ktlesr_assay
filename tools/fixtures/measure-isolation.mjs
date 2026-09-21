/**
 * İzolasyonun ne kadar koruduğunu ÖLÇER — iddia etmez.
 *
 *   node tools/fixtures/measure-isolation.mjs
 *
 * İki kol, ikisi de gerçek süreçlerle. Her kolda ölçülen taraf bir "dev
 * sunucu" başlatıyor ve bir dış aktör — ölçülen ajanın karşılığı — PID'i bulup
 * öldürüyor. Fark yalnızca denemenin nerede koştuğu:
 *
 *   surec ici : öldürülen PID koşumun kendisi
 *   izole     : öldürülen PID bir denemenin worker'ı
 *
 * Sayılanlar: koşum sağ çıktı mı, kaç deneme kayda girdi, kaçı `unknown`,
 * arkada yetim kaldı mı.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { killTree, findJournals, readJournal } from '@ktlsr/assay-runner'

const here = dirname(fileURLToPath(import.meta.url))
const arm = join(here, 'isolation-arm.mjs')
const repoRoot = join(here, '../..')

const skill = mkdtempSync(join(tmpdir(), 'measure-skill-'))
writeFileSync(join(skill, 'SKILL.md'), '# widget')

async function portBusy(port) {
  const net = await import('node:net')
  return new Promise((done) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' })
    socket.on('connect', () => {
      socket.destroy()
      done(true)
    })
    socket.on('error', () => done(false))
  })
}

async function measure(label, mode) {
  const store = mkdtempSync(join(tmpdir(), 'measure-store-'))
  const pidFile = join(store, 'target.pid')
  const port = 5300 + Math.floor(Math.random() * 60)

  const child = spawn(process.execPath, [arm, mode, store, skill, pidFile, String(port)], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let stdout = ''
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk) => (stdout += chunk))
  let stderr = ''
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk) => (stderr += chunk))

  // Dış aktör: PID dosyası belirir belirmez öldür. İki denemeyi öldürüyoruz.
  let kills = 0
  const killer = setInterval(async () => {
    if (kills >= 2 || !existsSync(pidFile)) return
    const raw = readFileSync(pidFile, 'utf8').trim()
    if (raw === '') return
    rmSync(pidFile, { force: true })
    await killTree(Number(raw))
    kills += 1
  }, 40)

  const exit = await new Promise((done) => {
    const timer = setTimeout(() => done('timeout'), 90_000)
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      done(signal ?? code)
    })
  })
  clearInterval(killer)

  const summary = /result attempts=(\d+) unknown=(\d+)/.exec(stdout)
  const journals = await findJournals(join(store, 'runs'))
  const journalled =
    journals.length === 0 ? null : (await readJournal(journals[0]))?.attempts.length

  await new Promise((r) => setTimeout(r, 600))
  const orphan = (await portBusy(port)) ? 'VAR' : 'yok'

  console.log(
    [
      label.padEnd(12),
      `kosum: ${summary ? 'sag' : `DUSTU (exit ${exit})`}`.padEnd(24),
      `kayitli deneme: ${summary ? summary[1] : (journalled ?? 0)}`.padEnd(20),
      `unknown: ${summary ? summary[2] : '—'}`.padEnd(14),
      `oldurme: ${kills}`.padEnd(12),
      `yetim: ${orphan}`,
    ].join(' | '),
  )
  if (!summary && stderr.trim() !== '') {
    console.log(`  ${stderr.trim().split('\n').slice(-1)[0]}`)
  }
}

await measure('surec ici', 'inproc')
await measure('izole', 'isolated')
rmSync(skill, { recursive: true, force: true })
