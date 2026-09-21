/**
 * Action adımı: suite'i koşar, karneyi dosyaya yazar, check annotation üretir.
 *
 * `assay ci`'ı sarar. Çıkış kodları olduğu gibi taşınır — özellikle 3
 * ("hiçbir şey ölçülemedi") 1 ("bir vaka düştü") ile karıştırılmaz.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { scorecard } from './format.mjs'

const env = process.env
const suite = env['ASSAY_SUITE']
const skill = env['ASSAY_SKILL']

if (suite === undefined || skill === undefined) {
  fail('the suite and skill inputs are both required')
}

const args = ['ci', suite, '--skill', skill, '--html', '.assay/report.html']
if (env['ASSAY_REPEAT']) args.push('--repeat', env['ASSAY_REPEAT'])
if (env['ASSAY_MODEL']) args.push('--model', env['ASSAY_MODEL'])
if (env['ASSAY_FAST'] === 'true') args.push('--fast')
if (env['ASSAY_ALLOW_UNKNOWN'] === 'true') args.push('--allow-unknown')

mkdirSync('.assay', { recursive: true })

// Koşumdan ÖNCEKİ en yeni kayıt. Sonrasında aynıysa bu koşum hiç kayıt
// üretmemiştir ve önceki koşumun sonucu bu koşumunmuş gibi raporlanamaz.
const before = newestRunId('.assay/runs')

const cli = resolveCli()
const result = spawnSync(process.execPath, [cli, ...args], {
  stdio: ['ignore', 'inherit', 'inherit'],
  env,
})

const after = newestRunId('.assay/runs')
const record = after !== null && after !== before ? readRun('.assay/runs', after) : null
if (record === null) {
  // Koşum kaydı yoksa ölçüm hiç yapılmamıştır; başarı diye geçiştirilmez.
  annotate('error', 'Assay produced no run record, so nothing was measured.')
  output('verdict', 'unknown')
  process.exit(result.status === 0 ? 3 : (result.status ?? 3))
}

output('verdict', record.verdict)
output('run-id', record.id)
output('report', '.assay/report.html')
writeFileSync('.assay/current.json', JSON.stringify(record), 'utf8')

for (const caseResult of record.cases) {
  const failing = caseResult.attempts.filter((a) => a.verdict === 'fail')
  const unknown = caseResult.attempts.filter((a) => a.verdict === 'unknown')
  if (failing.length > 0) {
    annotate(
      'error',
      `${caseResult.caseId}: ${failing.length}/${caseResult.attempts.length} attempts failed — ${first(failing)}`,
    )
  } else if (unknown.length > 0) {
    annotate(
      'warning',
      `${caseResult.caseId}: ${unknown.length}/${caseResult.attempts.length} attempts could not be measured — ${first(unknown)}`,
    )
  }
}

summary(record)
process.exit(result.status ?? 1)

// ---------------------------------------------------------------------------

/**
 * CLI'ı bulur.
 *
 * Üç yer, bu sırayla: bu deponun kendi derlemesi (dogfood koşumu), çağıranın
 * workspace'i, ve global kurulum (action'ın kendi kurduğu yer). Sıra önemli:
 * yerel derleme varsa yayımlanmış sürüm yerine o ölçüyor, yani depo kendi
 * değişikliğini ölçebiliyor.
 */
function resolveCli() {
  const candidates = [
    join(process.cwd(), 'packages/cli/dist/bin.js'),
    join(process.cwd(), 'node_modules/@ktlsr/assay/dist/bin.js'),
  ]

  // Global kurulum: `npm root -g` runner'a göre değişiyor, sormak tahmin
  // etmekten güvenli.
  const globalRoot = spawnSync('npm', ['root', '-g'], { encoding: 'utf8', shell: true })
  const root = String(globalRoot.stdout ?? '').trim()
  if (root !== '') candidates.push(join(root, '@ktlsr/assay/dist/bin.js'))

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  fail(
    'cannot find the assay CLI. The action installs @ktlsr/assay itself; if you ' +
      'see this, the install step failed. Checked: ' +
      candidates.join(', '),
  )
  return ''
}

function newestRunId(dir) {
  if (!existsSync(dir)) return null
  const files = readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
  return files.at(-1) ?? null
}

function readRun(dir, file) {
  try {
    return JSON.parse(readFileSync(join(dir, file), 'utf8')).run ?? null
  } catch {
    return null
  }
}

const first = (attempts) => String(attempts[0]?.reason ?? '').slice(0, 200)

/** GitHub check annotation. */
function annotate(level, message) {
  process.stdout.write(`::${level}::${message.replace(/\n/g, ' ')}\n`)
}

function output(name, value) {
  const file = env['GITHUB_OUTPUT']
  if (file === undefined) return
  writeFileSync(file, `${name}=${value}\n`, { flag: 'a' })
}

/** İş özeti sayfası. Karne buraya da düşer, PR yorumu olmasa bile görülür. */
function summary(record) {
  const file = env['GITHUB_STEP_SUMMARY']
  if (file === undefined) return
  const header = `## Assay — ${record.verdict.toUpperCase()}`
  const meta = `\`${record.id}\` · ${record.host} · ${record.pins.model} · ${record.runs} runs per case`
  const note = 'Every rate carries its observation count and 95% confidence interval.'
  const lines = [header, '', meta, '', scorecard(record), '', note, '']
  writeFileSync(file, lines.join('\n'), { flag: 'a' })
}

function fail(message) {
  process.stdout.write(`::error::${message}\n`)
  process.exit(2)
}
