/**
 * `assay` komut satırı aracı.
 *
 * Platform olmadan tam çalışır: hiçbir komut ağa çıkmaz, hesap istemez.
 * `push` Faz 2'de gelecek ve isteğe bağlı bir eklenti gibi davranacak.
 *
 * Argüman ayrıştırması `node:util.parseArgs` ile — bağımlılık eklemeye değmez.
 */

import { readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import {
  ClaudeCodeAdapter,
  isPermissionMode,
  PERMISSION_MODES,
  type PermissionMode,
} from '@ktlsr/assay-adapters'
import {
  compareRuns,
  parseSuite,
  redactDeep,
  summarizeRun,
  type Run,
  type Suite,
} from '@ktlsr/assay-core'
import {
  ASSAY_VERSION,
  findJournals,
  recoverJournal,
  localNames,
  RunStore,
  runSuite,
  suiteHash,
} from '@ktlsr/assay-runner'
import { renderHtmlReport } from './html.js'
import { findPersonalData, maskedCount } from './scan.js'
import {
  renderComparison,
  renderIssues,
  renderRun,
  style,
  verdictLabel,
} from './terminal.js'

/** CI'ın okuduğu çıkış kodları. */
export const EXIT = {
  ok: 0,
  /** Ölçüm yapıldı ve bir vaka düştü. */
  failed: 1,
  /** Kullanım hatası: geçersiz suite, eksik dosya, bilinmeyen komut. */
  usage: 2,
  /** Ölçüm yapılamadı. Başarısızlıktan ayrı tutulur (değişmez #1). */
  unknown: 3,
  /**
   * `push`: yükleme gerçekleşmedi — sunucuya ulaşılamadı ya da sunucu reddetti
   * (0.4.1-e). Kullanım hatası değil: komut doğru yazıldı, sorun karşı tarafta
   * ya da kayıtta; CI'ın "komutu düzelt" ile "sunucuya bak"ı ayırabilmesi için.
   */
  upload: 4,
} as const

const USAGE = `assay — a CI test runner for Agent Skills

Usage
  assay init [file]                 write an example suite file
  assay validate <suite.yaml>       check a suite without running it
  assay run <suite.yaml>            run the suite and store the result
  assay report [run-id]             print a stored run, newest by default
  assay compare <run-a> <run-b>     compare two stored runs, pins checked
  assay ci <suite.yaml>             run and exit non-zero on failure
  assay push [run-id]               upload a stored run to a hosted instance
  assay recover                     rebuild records from interrupted runs
  assay scrub [dir]                 mask usernames and secrets in stored records

Options
  --skill <dir>       the skill or plugin directory under test
  --repeat <n>        override the suite's run count (never defaults to 1)
  --html <file>       also write a self-contained HTML report
  --store <dir>       run store root (default: .assay)
  --model <id>        override the suite's model
  --permission-mode <mode>
                      host permission mode (default: acceptEdits). A skill that
                      declares allowed-tools cannot activate under acceptEdits.
                      The mode is part of the measurement: it is written to the
                      run record and to the environment hash, so runs measured
                      under different modes do not compare.
                      modes: ${PERMISSION_MODES.join(', ')}
  --allow-bypass-permissions
                      required to actually use bypassPermissions: that mode
                      removes every boundary the sandbox observes
  --concurrency <n>   attempts to run at once (default 1). Speeding up is a
                      choice, not a default: parallel attempts share CPU, RAM,
                      ports and the host's rate limit. Each worker is given a
                      disjoint port range (PORT, VITE_PORT, ASSAY_PORT_RANGE) —
                      a mitigation, not a guarantee: a server with a hardcoded
                      port ignores them. The value is written to the run record
                      because latency and cost are not comparable across it.
  --fast              early warning, not evidence: 3 attempts per case and the
                      trigger layer only. Cases that only declare assertions
                      are not run; in cases that do run, declared assertions
                      are listed as not evaluated rather than counted as
                      unknown. The record says which layers were measured.
                      Use the full run before a release.
  --max-attempts <n>  cap the total attempts. Cases past the cap are not run
                      and are named in the record with the reason. A run the
                      cap cut short cannot pass: at best it is unknown, since
                      the cut cases may be every negative in the suite.
  --allow-unknown     do not fail CI when attempts could not be measured
  --no-isolation      run attempts in this process instead of one process each.
                      Isolation is on by default: the measured agent can kill
                      processes on this machine, and a killed attempt should
                      cost one attempt, not the run. It is a limit, not a
                      shield — the supervising process is a node process too.
  --container <image> run each attempt in its own container from this image
                      (tools/runner-env). The container has no way out but an
                      egress proxy that admits the npm registry and Playwright's
                      CDNs; Assay's own code is mounted from this machine. The
                      image digest, platform, egress allowlist and limits go into
                      the record and the environment hash, so container runs do
                      not compare with runs on this machine.
  --container-api <name:port>
                      the container that answers the Anthropic API for the
                      attempt containers (the credential proxy). It is attached
                      to the run's network; attempts only ever see a placeholder
                      key. Required with --container.
  --json              print the run record as JSON instead of a summary
  --suite <file>      the case set the run was measured with (push)
  --url <base>        hosted instance base URL (push, or ASSAY_URL)
  --token <token>     API token (push, or ASSAY_TOKEN — prefer the variable)
  --allow-unmasked    upload even though push found your username or a secret
                      left in the record after masking (push)
  --version           print the Assay version
  -h, --help          show this text

Exit codes
  0 ok · 1 a case failed · 2 usage error · 3 nothing could be measured
  4 the upload did not happen (push): the server was unreachable or refused it
`

type Options = Record<string, unknown>

export async function main(argv: readonly string[]): Promise<number> {
  let parsed
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        skill: { type: 'string' },
        repeat: { type: 'string' },
        html: { type: 'string' },
        store: { type: 'string' },
        model: { type: 'string' },
        'permission-mode': { type: 'string' },
        'allow-bypass-permissions': { type: 'boolean' },
        'allow-unknown': { type: 'boolean' },
        'allow-unmasked': { type: 'boolean' },
        'no-isolation': { type: 'boolean' },
        concurrency: { type: 'string' },
        container: { type: 'string' },
        'container-api': { type: 'string' },
        fast: { type: 'boolean' },
        'max-attempts': { type: 'string' },
        json: { type: 'boolean' },
        suite: { type: 'string' },
        url: { type: 'string' },
        token: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean' },
      },
    })
  } catch (cause) {
    process.stderr.write(`${style.red('error')} ${message(cause)}\n\n${USAGE}`)
    return EXIT.usage
  }

  const [command, ...positionals] = parsed.positionals
  // Hangi sürümün koştuğu (0.4.1-h); kayıt da aynı değeri `assayVersion`da taşıyor.
  if (parsed.values.version === true) {
    process.stdout.write(`${ASSAY_VERSION}
`)
    return EXIT.ok
  }
  if (parsed.values.help === true || command === undefined) {
    process.stdout.write(USAGE)
    return command === undefined && parsed.values.help !== true ? EXIT.usage : EXIT.ok
  }

  switch (command) {
    case 'init':
      return init(positionals[0])
    case 'validate':
      return validate(positionals[0])
    case 'run':
      return run(positionals[0], parsed.values, false)
    case 'ci':
      return run(positionals[0], parsed.values, true)
    case 'report':
      return report(positionals[0], parsed.values)
    case 'compare':
      return compare(positionals[0], positionals[1], parsed.values)
    case 'push':
      return push(positionals[0], parsed.values)
    case 'recover':
      return recover(parsed.values)
    case 'scrub':
      return scrub(positionals[0], parsed.values)
    default:
      process.stderr.write(
        `${style.red('error')} unknown command "${command}"\n\n${USAGE}`,
      )
      return EXIT.usage
  }
}

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------

const TEMPLATE = `# Assay case set. Run with: assay run this-file.yaml --skill ./path/to/skill
#
# A trigger suite without a negative case is rejected: a skill that fires on
# every request would pass every positive case and look perfect.

version: 1

target:
  skill: your-skill
  # Pin 1 — pin the skill version you measured.
  source: owner/repo@commit-sha

environment:
  host: claude-code
  # Pin 2 — the exact model id, never "latest".
  model: claude-haiku-4-5-20251001
  # Pin 3 — Claude Code does not expose this; the run record keeps an
  # environment hash instead.
  system_prompt_hash: not-provided-by-host
  active_skills: [your-skill]

# Never 1: a single attempt is an observation, not a measurement.
runs: 5

cases:
  - id: trigger.positive.explicit
    prompt: A request that should clearly reach this skill.
    expect: { triggered: true }

  # The discriminating signal: a request that looks similar but is out of scope.
  - id: trigger.negative.near_neighbor.example
    prompt: A request that resembles the one above but is not this skill's job.
    expect: { triggered: false }

  - id: trigger.negative.unrelated
    prompt: A request that has nothing to do with this skill.
    expect: { triggered: false }

  - id: complete.produces_artifact
    prompt: A request that should make the skill produce a file.
    expect:
      triggered: true
      assertions:
        - { type: file_exists, path: 'out/*' }
        - { type: trace, rule: no_swallowed_errors }
        - { type: side_effect, writes_within: ['out/'], network: deny }
`

async function init(target?: string): Promise<number> {
  const path = target ?? 'assay.suite.yaml'
  // Argüman yazılacak DOSYA. Dizin verilirse `writeFile` EISDIR fırlatır;
  // yakalanmazsa yığın izi basar, oysa kullanım hatası tek satır olmalı.
  const existing = await stat(path).catch(() => null)
  if (existing?.isDirectory() === true) {
    process.stderr.write(
      `${style.red('error')} ${path} is a directory; pass the suite file to write, ` +
        `e.g. ${path}/assay.suite.yaml\n`,
    )
    return EXIT.usage
  }
  if (existing !== null) {
    process.stderr.write(`${style.red('error')} ${path} already exists\n`)
    return EXIT.usage
  }
  await writeFile(path, TEMPLATE, 'utf8')
  process.stdout.write(
    `${style.green('created')} ${path}\n` +
      `${style.grey('Fill in the skill name, source and prompts, then:')}\n` +
      `  assay validate ${path}\n`,
  )
  return EXIT.ok
}

// ---------------------------------------------------------------------------
// validate
// ---------------------------------------------------------------------------

async function loadSuite(
  path: string | undefined,
): Promise<{ suite: Suite; source: string; path: string } | number> {
  if (path === undefined) {
    process.stderr.write(`${style.red('error')} a suite file is required\n\n${USAGE}`)
    return EXIT.usage
  }
  const source = await readFile(path, 'utf8').catch(() => null)
  if (source === null) {
    process.stderr.write(`${style.red('error')} cannot read ${path}\n`)
    return EXIT.usage
  }
  const parsed = parseSuite(source)
  process.stderr.write(renderIssues(parsed.issues))
  if (!parsed.ok) return EXIT.usage
  return { suite: parsed.suite, source, path }
}

async function validate(path: string | undefined): Promise<number> {
  const loaded = await loadSuite(path)
  if (typeof loaded === 'number') return loaded
  const { suite } = loaded
  process.stdout.write(
    `${style.green('valid')} ${loaded.path}\n` +
      style.grey(
        `  ${suite.cases.length} cases · ${suite.runs} runs each · skill ${suite.target.skill}\n`,
      ),
  )
  return EXIT.ok
}

// ---------------------------------------------------------------------------
// run / ci
// ---------------------------------------------------------------------------

async function run(
  path: string | undefined,
  options: Options,
  ci: boolean,
): Promise<number> {
  const loaded = await loadSuite(path)
  if (typeof loaded === 'number') return loaded
  const { suite, source } = loaded

  const skillPath = typeof options['skill'] === 'string' ? options['skill'] : undefined
  if (skillPath === undefined) {
    process.stderr.write(
      `${style.red('error')} --skill <dir> is required: Assay loads that directory into an isolated session\n`,
    )
    return EXIT.usage
  }

  const repeat = parseRepeat(options['repeat'])
  if (repeat === 'invalid') {
    process.stderr.write(`${style.red('error')} --repeat must be a positive integer\n`)
    return EXIT.usage
  }
  if (repeat === 1) {
    process.stderr.write(
      `${style.yellow('warning')} --repeat 1 measures nothing about stability; the result carries no flakiness signal\n`,
    )
  }

  const model = typeof options['model'] === 'string' ? options['model'] : undefined
  const effective: Suite =
    model === undefined
      ? suite
      : { ...suite, environment: { ...suite.environment, model } }

  // İzin modu ölçümün koşulu: yanlış yazılmış bir mod sessizce varsayılana
  // düşerse kullanıcı ölçtüğünü sandığı şeyi ölçmemiş olur.
  const requestedMode = options['permission-mode']
  if (requestedMode !== undefined && !isPermissionMode(String(requestedMode))) {
    process.stderr.write(
      `${style.red('error')} unknown --permission-mode "${String(requestedMode)}"; expected one of ${PERMISSION_MODES.join(', ')}\n`,
    )
    return EXIT.usage
  }
  const permissionMode = requestedMode as PermissionMode | undefined
  if (permissionMode === 'bypassPermissions' && options['allow-bypass-permissions'] !== true) {
    process.stderr.write(
      `${style.red('error')} --permission-mode bypassPermissions removes every boundary the sandbox observes; ` +
        `pass --allow-bypass-permissions to state that you meant it\n`,
    )
    return EXIT.usage
  }

  const adapter = new ClaudeCodeAdapter({
    ...(permissionMode === undefined ? {} : { permissionMode }),
    ...(options['allow-bypass-permissions'] === true
      ? { allowBypassPermissions: true }
      : {}),
  })

  const store = new RunStore(storeOptions(options))
  // Önceki bir koşum öldüyse journal'ı hâlâ orada. Sessizce üstüne koşmak,
  // kullanıcının kurtarılabilir bir ölçümü olduğunu bilmemesi demek.
  const orphans = await findJournals(store.directory)
  if (orphans.length > 0) {
    process.stderr.write(
      `${style.yellow('warning')} ${orphans.length} interrupted run(s) left a journal in ${store.directory}; ` +
        `run "assay recover" to turn them into records before they are forgotten\n`,
    )
  }

  /*
   * Her deneme kendi sürecinde.
   *
   * Ölçülen ajan işini doğrulamak için başlattığı sunucuları porta göre
   * öldürüyor ve runner aynı makinede sıradan bir `node` süreci; 4.2.2
   * ölçümünde koşum iki kez bu yüzden öldü (docs/blockers.md). Deneme ayrı bir
   * süreçte koşarsa öldürülen şey koşumun tamamı değil bir deneme olur.
   *
   * Bu **koruma değil**, sınırlama: sevk katmanı da aynı makinede bir `node`
   * süreci ve onu da öldürebilecek bir çağrı var. `--no-isolation` kaçış yolu;
   * kütüphane olarak çağıranlar için varsayılan zaten süreç içi.
   */
  const isolate =
    options['no-isolation'] === true
      ? undefined
      : {
          /*
           * Modül burada, ÇAĞIRANDA çözülüyor.
           *
           * Worker `packages/runner` içinde yaşıyor ve `runner` adapters'a
           * bağlanamıyor (docs/stack.md); bare specifier orada çözülmüyor ve
           * her deneme "the attempt process exited with code 1" veriyordu —
           * uçtan uca duman testi bunu ilk koşumda gösterdi. Çözümlemeyi
           * adapters'a gerçekten bağlı olan paket yapıyor.
           */
          module: import.meta.resolve('@ktlsr/assay-adapters'),
          export: 'ClaudeCodeAdapter',
          options: {
            ...(permissionMode === undefined ? {} : { permissionMode }),
            ...(options['allow-bypass-permissions'] === true
              ? { allowBypassPermissions: true }
              : {}),
          },
        }

  /*
   * Hızlı mod: erken uyarı, kanıt değil.
   *
   * İlk deneyimde kimse sekiz saat harcamıyor. N=3 ve yalnız tetiklenme
   * katmanı, dakikalar içinde "bu skill hâlâ ateşliyor mu" sorusuna cevap
   * veriyor. Verdiği cevabın sınırı kayıtta ve raporda yazılı: aralıklar
   * geniş, artefakt iddiaları hiç sınanmadı.
   *
   * `--repeat` ile birlikte verilirse kullanıcının sayısı kazanıyor — hızlı
   * mod bir kısayol, bir kilit değil.
   */
  const fast = options['fast'] === true
  const maxAttempts = parseCount(options['max-attempts'])
  if (maxAttempts === 'invalid') {
    process.stderr.write(`${style.red('error')} --max-attempts must be a positive integer\n`)
    return EXIT.usage
  }
  /*
   * Hızlı modun gizli bir tavanı YOK — yalnızca kullanıcının `--max-attempts`i.
   * İlk hâli 60'lık bir tavan koyuyordu; bütçenin kestiği koşum artık `pass`
   * veremediği için o tavan 20 vakadan büyük her suite'i hızlı modda sessizce
   * `unknown`a mahkûm ederdi. Maliyet tavanı kullanıcının bilerek verdiği bir
   * karar olmalı (decisions.md, 2026-09-10).
   */
  const budget = maxAttempts

  const concurrency = parseConcurrency(options['concurrency'])
  if (concurrency === 'invalid') {
    process.stderr.write(
      `${style.red('error')} --concurrency must be a positive integer\n`,
    )
    return EXIT.usage
  }
  if (concurrency !== undefined && concurrency > 1 && isolate === undefined) {
    // Süreç içi koşumda port kirası verilemiyor (tek ortam, N deneme) ve
    // öldürülen bir deneme koşumun tamamını götürüyor.
    process.stderr.write(
      `${style.yellow('warning')} --concurrency with --no-isolation shares one process and one ` +
        `environment: attempts cannot be given separate port ranges, and one killed attempt ends the run\n`,
    )
  }

  /*
   * Konteyner koşumu (K2). Kimlik bilgisi konteynere hiç verilmiyor: API'yi
   * kimlik proxy'si konteyneri cevaplıyor, deneme yalnızca yer tutucu anahtar
   * görüyor. Proxy olmadan konteyner koşumu model çağıramaz; bu yüzden şart.
   */
  const containerImage = typeof options['container'] === 'string' ? options['container'] : undefined
  const containerApi = typeof options['container-api'] === 'string' ? options['container-api'] : undefined
  if (containerImage !== undefined && containerApi === undefined) {
    process.stderr.write(
      `${style.red('error')} --container needs --container-api <name:port>: the attempt containers reach the model only through a credential proxy container\n`,
    )
    return EXIT.usage
  }
  if (containerImage === undefined && containerApi !== undefined) {
    process.stderr.write(`${style.red('error')} --container-api only applies with --container <image>\n`)
    return EXIT.usage
  }
  if (containerImage !== undefined && isolate === undefined) {
    process.stderr.write(
      `${style.red('error')} --container runs every attempt in its own container; it cannot be combined with --no-isolation\n`,
    )
    return EXIT.usage
  }

  let record
  try {
    record = await runSuite(effective, adapter, {
      source,
      suitePath: loaded.path,
      skillPath: resolve(skillPath),
      journalDir: store.directory,
      ...(isolate === undefined ? {} : { isolate }),
      ...(containerImage === undefined || containerApi === undefined
        ? {}
        : { container: { image: containerImage, api: containerApi } }),
      ...(concurrency === undefined ? {} : { concurrency }),
      ...(fast ? { layers: ['trigger'] as const } : {}),
      ...(budget === undefined ? {} : { maxAttempts: budget }),
      /*
       * Hızlı modun tekrarı 3 — ama kullanıcı `--repeat` yazdıysa onunki
       * kazanıyor. Değişmez #3 sağlanıyor: 3, 1'den büyük.
       */
      ...(repeat === undefined ? (fast ? { repeat: FAST_REPEAT } : {}) : { repeat }),
      onProgress: (event) => {
        if (options['json'] === true) return
        const mark = {
          pass: style.green('✓'),
          fail: style.red('✗'),
          unknown: style.yellow('?'),
        }[event.verdict]
        process.stderr.write(
          `  ${mark} ${event.caseId} ${style.grey(`${event.attempt + 1}/${event.attempts}`)}\n`,
        )
        if (event.verdict !== 'pass') {
          process.stderr.write(`      ${style.grey(event.reason.slice(0, 200))}\n`)
        }
      },
    })
  } catch (cause) {
    // Konteyner düzeni kurulamadı (imaj yok, API konteyneri yok): hiçbir şey koşmadı.
    if (containerImage === undefined) throw cause
    process.stderr.write(`${style.red('error')} ${message(cause)}\n`)
    return EXIT.usage
  }

  const savedTo = await store.save(record)
  await emit(record, options)
  process.stderr.write(style.grey(`  stored ${savedTo}\n`))

  if (!ci) return EXIT.ok
  if (record.verdict === 'fail') return EXIT.failed
  if (record.verdict === 'unknown') {
    return options['allow-unknown'] === true ? EXIT.ok : EXIT.unknown
  }
  return EXIT.ok
}

function parseRepeat(value: unknown): number | undefined | 'invalid' {
  if (typeof value !== 'string') return undefined
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) return 'invalid'
  return parsed
}

// ---------------------------------------------------------------------------
// report / compare
// ---------------------------------------------------------------------------

async function report(runId: string | undefined, options: Options): Promise<number> {
  const store = new RunStore(storeOptions(options))
  const record =
    runId === undefined ? await store.latest() : await store.load(runId).catch(() => null)
  if (record === null) {
    process.stderr.write(
      `${style.red('error')} ${runId === undefined ? `no runs found in ${store.directory}` : `no run ${runId}`}\n`,
    )
    return EXIT.usage
  }
  await emit(record, options)
  return EXIT.ok
}

async function compare(
  a: string | undefined,
  b: string | undefined,
  options: Options,
): Promise<number> {
  if (a === undefined || b === undefined) {
    process.stderr.write(`${style.red('error')} compare needs two run ids\n\n${USAGE}`)
    return EXIT.usage
  }
  const store = new RunStore(storeOptions(options))
  const before = await store.load(a).catch(() => null)
  const after = await store.load(b).catch(() => null)
  if (before === null || after === null) {
    process.stderr.write(`${style.red('error')} cannot load ${before === null ? a : b}\n`)
    return EXIT.usage
  }

  const comparison = compareRuns(before, after)
  if (options['json'] === true) {
    process.stdout.write(`${JSON.stringify(comparison, null, 2)}\n`)
  } else {
    process.stdout.write(renderComparison(comparison))
  }
  return comparison.verdict === 'fail'
    ? EXIT.failed
    : comparison.verdict === 'unknown'
      ? EXIT.unknown
      : EXIT.ok
}

// ---------------------------------------------------------------------------
// Ortak
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// recover
// ---------------------------------------------------------------------------

/**
 * Yarım kalmış koşumları journal'dan kayda çevirir.
 *
 * Ölçülen ajan runner'ı öldürebiliyor (bkz. docs/blockers.md) ve koşum
 * ortasında ölen bir süreç eskiden o ana kadar tamamlanmış her denemeyi de
 * götürüyordu. Journal o denemeleri diskte tutuyor; bu komut onları kayda
 * çeviriyor.
 *
 * Kurtarılan kayıt **yarım olduğunu söylüyor**: `partial` alanı sebebi,
 * kurtarma anını ve okunamayan satır sayısını taşıyor.
 */
async function recover(options: Options): Promise<number> {
  const store = new RunStore(storeOptions(options))
  const journals = await findJournals(store.directory)

  if (journals.length === 0) {
    process.stderr.write(
      `${style.grey('nothing to recover')} no interrupted run left a journal in ${store.directory}\n`,
    )
    return EXIT.ok
  }

  let recovered = 0
  let skipped = 0
  for (const path of journals) {
    let result
    try {
      result = await recoverJournal(path)
    } catch (cause) {
      process.stderr.write(`${style.red('error')} ${path}: ${message(cause)}\n`)
      skipped += 1
      continue
    }
    if (result === null) {
      // Denemesiz ya da başlıksız bir journal kayda çevrilmiyor — ve
      // SİLİNMİYOR: okunamayan ama var olan bir dosyayı yok etmek, ölçüm
      // aracının yapmaması gereken şey.
      process.stderr.write(
        `${style.yellow('skipped')} ${path} carries no completed attempt; left in place\n`,
      )
      skipped += 1
      continue
    }
    const savedTo = await store.save(result.run)
    await rm(path, { force: true })
    recovered += 1
    const attempts = result.run.cases.reduce((sum, c) => sum + c.attempts.length, 0)
    process.stderr.write(
      `${style.green('recovered')} ${result.run.id} — ${attempts} attempt(s) across ` +
        `${result.run.cases.length} case(s)` +
        (result.run.partial?.droppedLines === undefined
          ? ''
          : `, ${result.run.partial.droppedLines} unreadable line(s) dropped`) +
        `\n  stored ${savedTo}\n`,
    )
  }

  // Kurtarma bir ölçüm değil, bir onarım: kurtarılan koşumun verdict'i buranın
  // çıkış koduna karışmıyor. Kullanıcı sonucu `assay report` ile okuyor.
  return skipped > 0 && recovered === 0 ? EXIT.usage : EXIT.ok
}

// ---------------------------------------------------------------------------

function storeOptions(options: Options): { root?: string } {
  const root = options['store']
  return typeof root === 'string' ? { root } : {}
}

async function emit(record: Run, options: Options): Promise<void> {
  // Beklentiler kaydın içinde; rapor suite dosyasına ihtiyaç duymuyor.
  const summary = summarizeRun(record)

  if (options['json'] === true) {
    process.stdout.write(`${JSON.stringify({ run: record, summary }, null, 2)}\n`)
  } else {
    process.stdout.write(renderRun(record, summary))
  }

  const html = options['html']
  if (typeof html === 'string') {
    await writeFile(html, renderHtmlReport(record, summary), 'utf8')
    process.stderr.write(
      style.grey(`  report ${resolve(dirname(html), basename(html))}\n`),
    )
  }
}

const message = (cause: unknown) =>
  cause instanceof Error ? cause.message : String(cause)

export { verdictLabel }

// ---------------------------------------------------------------------------
// push
// ---------------------------------------------------------------------------

/**
 * Kayıtlı bir koşumu hosted örneğe yükler.
 *
 * Ölçüm burada yapılmaz ve tekrarlanmaz: yerel kayıt olduğu gibi gönderilir.
 * Vaka seti kaynağı da gider, çünkü hosted taraf vakaların metnini kayıttan
 * türetemez.
 *
 * Token argümanla verilebilir ama `ASSAY_TOKEN` tercih edilir: argüman kabuk
 * geçmişine ve süreç listesine düşer.
 */
async function push(runId: string | undefined, options: Options): Promise<number> {
  const base = (options['url'] as string | undefined) ?? process.env['ASSAY_URL']
  const token = (options['token'] as string | undefined) ?? process.env['ASSAY_TOKEN']
  const suitePath = options['suite'] as string | undefined

  if (base === undefined || base === '') {
    process.stderr.write(
      `${style.red('error')} push needs --url or ASSAY_URL, the base URL of a hosted instance
`,
    )
    return EXIT.usage
  }
  if (token === undefined || token === '') {
    process.stderr.write(
      `${style.red('error')} push needs ASSAY_TOKEN (or --token), created under Settings → API tokens
`,
    )
    return EXIT.usage
  }
  if (suitePath === undefined) {
    process.stderr.write(
      `${style.red('error')} push needs --suite: the hosted side stores the case set alongside the run
`,
    )
    return EXIT.usage
  }

  const store = new RunStore(storeOptions(options))
  const record =
    runId === undefined ? await store.latest() : await store.load(runId).catch(() => null)
  if (record === null) {
    process.stderr.write(
      `${style.red('error')} ${runId === undefined ? `no runs found in ${store.directory}` : `no run ${runId}`}
`,
    )
    return EXIT.usage
  }

  let suiteSource: string
  try {
    suiteSource = await readFile(resolve(suitePath), 'utf8')
  } catch {
    process.stderr.write(`${style.red('error')} cannot read ${suitePath}
`)
    return EXIT.usage
  }

  // Pin 4'ün denetçisi: gönderilen vaka seti, ölçümde kullanılandan farklıysa
  // yükleme yapılmaz. Aksi hâlde hosted tarafta koşumla eşleşmeyen bir vaka
  // seti dururdu ve sonraki karşılaştırmalar sessizce yanlış olurdu.
  const localHash = suiteHash(suiteSource)
  if (localHash !== record.pins.suiteHash) {
    process.stderr.write(
      `${style.red('error')} ${suitePath} is not the case set this run was measured with
` +
        `  run:  ${record.pins.suiteHash}
  file: ${localHash}
`,
    )
    return EXIT.usage
  }

  // Yükleme public bir siteye gidebilir ve orada yayımlanan bir sayfa geri
  // alınamaz; maskenin bıraktığı kişisel veri varsa gönderilmez (0.4.1-c).
  const findings = findPersonalData(record, localNames())
  if (findings.length > 0 && options['allow-unmasked'] !== true) {
    process.stderr.write(
      `${style.red('error')} the record still carries personal data in ${findings.length} place(s); nothing was uploaded\n` +
        findings
          .slice(0, 5)
          .map((finding) => `  ${finding.kind.padEnd(9)}  ${finding.path}\n`)
          .join('') +
        (findings.length > 5 ? `  … and ${findings.length - 5} more\n` : '') +
        `  Check those places. If they are not personal, pass --allow-unmasked.\n`,
    )
    return EXIT.usage
  }
  const onDisk = await readFile(join(store.directory, `${record.id}.json`), 'utf8')
    .then((text) => (JSON.parse(text) as { run?: unknown }).run)
    .catch(() => undefined)
  const masked = onDisk === undefined ? 0 : maskedCount(onDisk, record)

  let response: Response
  try {
    response = await fetch(new URL('/api/runs', base), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ suiteSource, run: record }),
    })
  } catch (cause) {
    process.stderr.write(`${style.red('error')} cannot reach ${base}: ${message(cause)}
`)
    return EXIT.upload
  }

  const body = (await response.json().catch(() => ({}))) as {
    error?: string
    runId?: string
    /** Koşumun vaka seti herkese açık mı (0.4.1-f); eski sunucular göndermez. */
    public?: boolean
  }

  if (response.status === 201) {
    process.stdout.write(
      `${style.green('uploaded')} ${record.id}
  ${new URL(`/runs/${record.id}`, base).href}
`,
    )
    if (masked > 0) {
      process.stdout.write(
        `  ${style.yellow('masked')} ${masked} username(s) or secret(s) in the uploaded copy; the file on disk still has them — assay scrub masks it\n`,
      )
    }
    // Yeni bir vaka seti gizli başlar; bağlantı başkasına 404 verir (0.4.1-f).
    if (body.public === false) {
      process.stdout.write(
        `  ${style.yellow('private')} only you can open this link until an administrator publishes its case set (admin → case sets)\n`,
      )
    }
    return EXIT.ok
  }
  if (response.status === 409) {
    process.stdout.write(`${style.yellow('already stored')} ${record.id}
`)
    return EXIT.ok
  }
  process.stderr.write(
    `${style.red('error')} ${response.status} ${body.error ?? 'the upload was rejected'}
`,
  )
  return EXIT.upload
}

/**
 * Saklanan kayıtları yerinde maskeler.
 *
 * Maskeleme üç yerde zaten yapılıyor: kayıt yazılırken, okunurken ve raporda
 * basılırken. Üçü de bir *gösterim* yüzeyini kapatıyor. Ama `.assay/runs`
 * bir gösterim yüzeyi değil, bir **dosya kümesi**: CI onu artefakt olarak
 * yüklüyor, insanlar zip'liyor, hata raporuna ekliyor. Baytlar makineden
 * çıkarken maskelenmiş olmaları gerekiyor, gösterildiklerinde değil.
 *
 * Ölçüm verisi değişmez: yalnızca ev dizini yollarındaki kullanıcı adı ve
 * tanınan sır biçimleri silinir. Değişen her dosyanın adı yazılır — bir ölçüm
 * aracının sessizce dosya değiştirmesi kabul edilemez.
 */
async function scrub(dir: string | undefined, options: Options): Promise<number> {
  const target = dir ?? join(String(options['store'] ?? '.assay'), 'runs')
  let names: string[]
  try {
    names = (await readdir(target)).filter((name) => name.endsWith('.json'))
  } catch {
    process.stderr.write(`${style.red('error')} no run store at ${target}\n`)
    return EXIT.usage
  }

  // Bu makinenin hesap adı: desenlerin tahmin edemediği biçimleri de kapatıyor.
  const accounts = localNames()
  let changed = 0
  for (const name of names) {
    const path = join(target, name)
    const raw = await readFile(path, 'utf8')
    const clean = `${JSON.stringify(redactDeep(JSON.parse(raw) as unknown, { names: accounts }), null, 2)}\n`
    if (clean === raw) continue
    await writeFile(path, clean, 'utf8')
    changed += 1
    process.stdout.write(`  ${style.grey('scrubbed')} ${name}\n`)
  }

  process.stdout.write(
    `${names.length} record(s) checked, ${changed} rewritten in ${target}\n`,
  )
  return EXIT.ok
}

/**
 * Hızlı modun tekrar sayısı.
 *
 * Üç: değişmez #3'ün altına inmiyor ama dakikalarla ölçülüyor. Üç denemede
 * aralık %29–100 kadar geniş çıkıyor ve rapor bunu manşette söylüyor —
 * gizlenirse hızlı mod bir kanıt gibi okunur.
 */
const FAST_REPEAT = 3

/** Pozitif tam sayı ya da kullanım hatası. */
function parseCount(value: unknown): number | undefined | 'invalid' {
  if (value === undefined) return undefined
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) return 'invalid'
  return parsed
}

/** `--concurrency` — pozitif tam sayı ya da kullanım hatası. */
function parseConcurrency(value: unknown): number | undefined | 'invalid' {
  if (value === undefined) return undefined
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) return 'invalid'
  return parsed
}
