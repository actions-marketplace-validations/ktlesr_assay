/**
 * Terminal çıktısı.
 *
 * İki kural burada zorlanıyor:
 *  - Hiçbir oran N ve güven aralığı olmadan basılmaz (değişmez #4). Tek yol
 *    `formatProportion`; başka bir yerde `%` yazdırılmıyor.
 *  - `unknown` ayrı ve dikkat çekici. Hata kovasına düşmüyor, kendi sütunu var.
 */

import {
  assayVersionLabel,
  hostMemoryLabel,
  containerLabel,
  memoryFromOutside,
  collisionPrefix,
  formatProportion,
  NO_SKILL,
  outsidePrefix,
  type CaseComparison,
  type CollisionMatrix,
  type Proportion,
  type Run,
  type RunComparison,
  type RunSummary,
  type SuiteIssue,
  type Verdict,
} from '@ktlsr/assay-core'

// ---------------------------------------------------------------------------
// Renk
// ---------------------------------------------------------------------------

const enabled =
  process.env['NO_COLOR'] === undefined &&
  process.env['TERM'] !== 'dumb' &&
  process.stdout.isTTY === true

const wrap = (code: string) => (text: string) => (enabled ? `[${code}m${text}[0m` : text)

export const style = {
  bold: wrap('1'),
  dim: wrap('2'),
  red: wrap('31'),
  green: wrap('32'),
  yellow: wrap('33'),
  blue: wrap('34'),
  grey: wrap('90'),
}

const VERDICT_STYLE: Record<Verdict, (text: string) => string> = {
  pass: style.green,
  fail: style.red,
  unknown: style.yellow,
}

const MARK: Record<Verdict, string> = { pass: '✓', fail: '✗', unknown: '?' }

export const verdictLabel = (verdict: Verdict): string =>
  VERDICT_STYLE[verdict](verdict.toUpperCase())

export const verdictMark = (verdict: Verdict): string =>
  VERDICT_STYLE[verdict](MARK[verdict])

/** Oranı N ve aralığıyla basar. Çıplak yüzde basmanın başka yolu yok. */
export const rate = (value: Proportion): string => formatProportion(value)

// ---------------------------------------------------------------------------
// Bloklar
// ---------------------------------------------------------------------------

const pad = (text: string, width: number) => text.padEnd(width)

export function renderIssues(issues: readonly SuiteIssue[]): string {
  if (issues.length === 0) return ''
  const lines = issues.map((issue) => {
    const tag = issue.level === 'error' ? style.red('error') : style.yellow('warning')
    const where = issue.path === '' ? '' : style.grey(` ${issue.path}`)
    return `  ${tag}${where}\n    ${issue.message}`
  })
  return `${lines.join('\n')}\n`
}

/**
 * Çakışma matrisi, terminal için.
 *
 * Satır beklenen kazanan, sütun ilk tetiklenen. Sıfır hücre "·" — boşluk
 * hizayı bozar, "0" ise gözü asıl sayılardan uzaklaştırır. Her satırın sonunda
 * "kazandı" oranı N ve aralığıyla (değişmez #4).
 */
export function renderCollision(matrix: CollisionMatrix): string[] {
  const prefix = collisionPrefix(matrix)
  const short = (name: string) => (prefix !== '' && name.startsWith(prefix) ? name.slice(prefix.length) : name)
  const label = (expected: readonly string[]) =>
    expected.length === 0 ? NO_SKILL : expected.map(short).join(' / ')
  const rowWidth = Math.max(18, ...matrix.rows.map((r) => label(r.expected).length))
  const widths = matrix.columns.map((c) => Math.max(short(c).length, 3))
  const cell = (text: string, i: number) => text.padStart(widths[i] ?? 3)

  const out: string[] = ['']
  out.push(style.bold('  collision matrix') + style.grey('  rows: expected winner · columns: first skill to fire'))
  if (prefix !== '') {
    const outside = outsidePrefix(matrix, prefix)
    out.push(
      style.grey(
        `  names shown without the common prefix "${prefix}"` +
          (outside.length === 0 ? '' : `; not under it: ${outside.join(', ')}`),
      ),
    )
  }
  out.push(
    `    ${pad('expected \\ fired', rowWidth)}  ${matrix.columns.map((c, i) => cell(short(c), i)).join('  ')}  won`,
  )
  for (const row of matrix.rows) {
    const cells = matrix.columns.map((c, i) => {
      const count = row.cells[c] ?? 0
      const hit = row.expected.length === 0 ? c === NO_SKILL : row.expected.includes(c)
      const text = cell(count === 0 ? '·' : String(count), i)
      return count === 0 ? style.grey(text) : hit ? style.green(text) : style.red(text)
    })
    const notes = [
      ...(row.alsoFired > 0 ? [`${row.alsoFired} also fired`] : []),
      ...(row.unmeasured > 0 ? [`${row.unmeasured} unmeasured`] : []),
    ]
    out.push(
      `    ${pad(label(row.expected), rowWidth)}  ${cells.join('  ')}  ${rate(row.won)}` +
        (notes.length === 0 ? '' : style.grey(`  ${notes.join(', ')}`)),
    )
  }
  if (matrix.unmeasured > 0) {
    out.push(style.yellow(`    ${matrix.unmeasured} attempt(s) could not be measured and are not in the matrix`))
  }
  return out
}

export function renderRun(run: Run, summary: RunSummary): string {
  const width = Math.max(...run.cases.map((c) => c.caseId.length), 20)
  const out: string[] = []

  out.push('')
  out.push(`${style.bold('run')} ${run.id}  ${verdictLabel(run.verdict)}`)
  out.push(
    style.grey(
      `${run.host} · ${run.pins.model} · suite v${run.pins.suiteVersion} · ${run.runs} runs per case`,
    ),
  )
  // İzin modu ölçümün koşulu: araçları kısıtlanmış bir skill ile
  // kısıtlanmamış olan iki farklı ölçümdür (docs/decisions.md).
  out.push(
    style.grey(
      `permission mode ${run.permissionMode ?? 'not reported by the host'}`,
    ),
  )
  // Kaydı hangi Assay sürümü yargıladı (0.3.2). Alan yoksa boş basılmıyor.
  out.push(style.grey(`assay ${assayVersionLabel(run)}`))
  // Host'un bağlama yüklediği talimat dosyaları (0.4.5). Çalışma dizini
  // dışından gelen bir dosya ölçülen bağlama sızmış demek: sarı.
  const leaked = memoryFromOutside(run)
  out.push(
    leaked.length > 0
      ? style.yellow(`host memory loaded from outside the working directory: ${leaked.join('; ')}`)
      : style.grey(`host memory ${hostMemoryLabel(run)}`),
  )
  // Denemeler bir konteynerde koştuysa koşulları (K2); ana makinede koşan
  // koşumda satır yok, her dizüstü raporuna bir "none" satırı eklenmesin diye.
  if (run.environment?.container !== undefined) {
    out.push(style.grey(`container ${containerLabel(run)}`))
  }
  /*
   * Eş zamanlılık gecikmenin koşulu.
   *
   * Paralel denemeler CPU'yu, belleği ve host hız sınırını paylaşıyor; aynı
   * suite'in seri ve paralel koşumlarının süreleri aynı şeyi ölçmüyor.
   * Tetiklenme oranları karşılaştırılabilir kalıyor — bu yüzden alan ortam
   * hash'ine girmiyor — ama süre okuyan biri bunu bilmeli.
   */
  if (run.concurrency !== undefined && run.concurrency > 1) {
    out.push(
      style.grey(
        `${run.concurrency} attempts at a time — latency and cost are not comparable with a serial run`,
      ),
    )
  }
  /*
   * Yarım kayıt manşette söylenir.
   *
   * `${run.runs} runs per case` satırı beyan edilen tekrar sayısını gösteriyor
   * ve koşum yarım kaldıysa o sayı koşulmadı. Uyarı aşağıda bir yerde kalsaydı
   * okuyucu üstteki satıra bakıp ölçümü olduğundan büyük sanardı.
   */
  /*
   * Hızlı mod manşette, oranların ÜSTÜNDE.
   *
   * Aşağıdaki `%100 (N=3)` satırları hızlı modda da aynı görünüyor; okuyucu
   * neyin ölçülmediğini sayıları okumadan önce bilmeli. Aşağıda bir dipnot
   * olsaydı ölçüm olduğundan geniş görünürdü.
   */
  if (run.layers !== undefined && !run.layers.includes('assertions')) {
    out.push('')
    out.push(style.yellow(style.bold('  fast mode — an early warning, not evidence')))
    out.push(
      style.grey(
        `  Only the ${run.layers.join(' and ')} layer was measured. Declared assertions were\n` +
          '  not evaluated — they are listed per case below, not counted as unknown.\n' +
          `  At ${run.runs} attempts per case the intervals are wide by construction.\n` +
          '  Run without --fast before trusting a green result.',
      ),
    )
  }
  if (run.skipped !== undefined && run.skipped.length > 0) {
    out.push('')
    out.push(style.yellow(`  ${run.skipped.length} case(s) were not run`))
    // Bütçe kesmesinde verdict `unknown` ama tek bir `unknown` deneme yok;
    // okuyucu sebebi başka yerde aramasın.
    const budgetCut = run.skipped.filter((item) => item.cause === 'budget').length
    if (budgetCut > 0) {
      out.push(
        style.grey(
          `  The attempt budget cut ${budgetCut} of them, so this run cannot pass: a cut case\n` +
            '  was never measured and may be every negative in the set.',
        ),
      )
    }
    const unreached = run.skipped.filter((item) => item.cause === 'interrupted').length
    if (unreached > 0) {
      out.push(
        style.grey(
          `  The run was interrupted before ${unreached} of them started, so this record\n` +
            '  cannot pass: a case it never reached may be every negative in the set.',
        ),
      )
    }
    for (const item of run.skipped) {
      out.push(`    ${pad(item.caseId, width)} ${style.grey(item.reason)}`)
    }
  }
  if (run.partial !== undefined) {
    out.push('')
    out.push(style.yellow(style.bold('  incomplete run')))
    out.push(`  ${run.partial.reason}`)
    out.push(
      style.grey(
        `  Recovered ${run.partial.recoveredAt}. The counts below are the attempts that\n` +
          '  completed, not the declared repeat count — read N on each case.\n' +
          '  An incomplete record cannot pass; at best it is unknown.' +
          (run.partial.droppedLines === undefined
            ? ''
            : `\n  ${run.partial.droppedLines} journal line(s) were unreadable and were dropped.`),
      ),
    )
  }
  out.push('')

  for (const caseResult of run.cases) {
    const caseVerdict: Verdict =
      caseResult.failed > 0 ? 'fail' : caseResult.unknown > 0 ? 'unknown' : 'pass'
    const unknownNote =
      caseResult.unknown > 0 ? style.yellow(`  ${caseResult.unknown} unknown`) : ''
    out.push(
      `  ${verdictMark(caseVerdict)} ${pad(caseResult.caseId, width)}  ${rate(caseResult.passRate)}${unknownNote}`,
    )
    /*
     * Değerlendirilmemiş assertion'lar vakanın altında, adlarıyla.
     *
     * Yalnızca manşette "assertion'lara bakılmadı" demek yetmez: okuyucu
     * hangi iddianın sınanmadığını görmeli. `unknown` olarak sayılmıyorlar —
     * sayılsalardı kasıtlı bir kapsam kararı ölçüm başarısızlığı gibi
     * görünürdü.
     */
    const notEvaluated = caseResult.attempts[0]?.notEvaluated ?? []
    for (const assertion of notEvaluated) {
      out.push(style.grey(`      ${assertion.type}  not evaluated in this mode`))
    }
  }

  /*
   * Çakışma matrisi (0.4.0), hedef-yalnız doğruluğun ÜSTÜNDE.
   *
   * marketingskills koşumunda rapor "precision: no observations, recall 0%"
   * dedi; ikisi de yalnızca hedef skill'i anlatıyordu ve çakışma suite'inde en
   * az ilginç satır oydu. Asıl cevap matriste.
   */
  if (summary.collision !== undefined) out.push(...renderCollision(summary.collision))

  out.push('')
  out.push(
    style.bold('  trigger accuracy') +
      (summary.collision === undefined ? '' : style.grey(`  target only: ${run.skill}`)),
  )
  out.push(`    precision  ${rate(summary.trigger.precision)}`)
  out.push(`    recall     ${rate(summary.trigger.recall)}`)
  out.push(
    `    f1         ${summary.trigger.f1 === null ? style.grey('not measurable') : summary.trigger.f1.toFixed(2)}`,
  )
  if (summary.trigger.unknown > 0) {
    out.push(`    ${style.yellow(`unreadable  ${summary.trigger.unknown}`)}`)
  }

  out.push('')
  out.push(
    style.bold('  verdicts  ') +
      `${style.green(`${summary.counts.pass} pass`)}  ` +
      `${style.red(`${summary.counts.fail} fail`)}  ` +
      `${style.yellow(`${summary.counts.unknown} unknown`)}`,
  )
  out.push(
    style.grey(
      `  totals    ${summary.totals.attempts} attempts · ${summary.totals.toolCalls} tool calls · ` +
        `${summary.totals.inputTokens}/${summary.totals.outputTokens} tokens · ` +
        `${summary.totals.usd === null ? 'cost not reported' : `$${summary.totals.usd.toFixed(4)}`} · ` +
        `${(summary.totals.durationMs / 1000).toFixed(1)}s`,
    ),
  )

  // Not, verdict değil: hiçbir negatif kırılmadıysa ölçülen şey yanlış
  // tetiklenme oranıdır, setin ayrım gücünün nerede bittiği değil.
  if (summary.discrimination.untested) {
    const { cases, attempts } = summary.discrimination
    out.push('')
    out.push(style.bold('  note      no negative case broke'))
    out.push(
      style.grey(
        `    ${cases} negative case(s), ${attempts} measured attempt(s), 0 false positives.`,
      ),
    )
    out.push(
      style.grey("    That bounds the false-positive rate, not the set's discriminating"),
    )
    out.push(
      style.grey('    power: the negatives may differ from the positives on some axis'),
    )
    out.push(
      style.grey('    other than the one under test. Tighten the near neighbours before'),
    )
    out.push(style.grey('    reading this as a clean bill.'))
  }

  if (summary.counts.unknown > 0) {
    out.push('')
    out.push(
      style.yellow(`  ${summary.counts.unknown} attempt(s) could not be measured:`),
    )
    const seen = new Set<string>()
    for (const caseResult of run.cases) {
      for (const attempt of caseResult.attempts) {
        if (attempt.verdict !== 'unknown') continue
        const key = `${attempt.caseId}:${attempt.reason}`
        if (seen.has(key)) continue
        seen.add(key)
        out.push(`    ${attempt.caseId}  ${style.grey(attempt.reason)}`)
      }
    }
  }

  out.push('')
  return out.join('\n')
}

const STATUS_STYLE = {
  regressed: style.red,
  improved: style.green,
  within_noise: style.grey,
  unknown: style.yellow,
} as const

export function renderComparison(comparison: RunComparison): string {
  const out: string[] = ['']

  if (!comparison.comparable) {
    out.push(style.yellow(style.bold('  cannot compare these runs')))
    out.push(`  ${comparison.reason}`)
    // Hash "bir şey değişti" der; okuyucunun tamir edeceği şey alanın kendisi.
    for (const change of comparison.environmentChanges) {
      out.push(`    ${pad(change.field, 16)} ${change.before} → ${change.after}`)
    }
    // Durduran sebep değil, ayrı bir eksiklik: ayrı satırda.
    if (comparison.note !== undefined) out.push(style.grey(`  also: ${comparison.note}`))
    out.push(
      style.grey(
        '  Two runs are only comparable when the skill version, model, system prompt\n' +
          '  hash and case set are identical. Assay does not guess across a drift.',
      ),
    )
    out.push('')
    return out.join('\n')
  }

  const width = Math.max(...comparison.cases.map((c) => c.caseId.length), 20)
  out.push(`${style.bold('comparison')}  ${verdictLabel(comparison.verdict)}`)
  out.push('')
  for (const change of comparison.cases) out.push(renderChange(change, width))
  out.push('')
  out.push(`  ${comparison.reason}`)
  out.push('')
  return out.join('\n')
}

function renderChange(change: CaseComparison, width: number): string {
  const paint = STATUS_STYLE[change.status]
  const before = change.before === null ? style.grey('—') : rate(change.before)
  const after = change.after === null ? style.grey('—') : rate(change.after)
  return (
    `  ${paint(pad(change.status, 13))} ${pad(change.caseId, width)}\n` +
    `    before ${before}\n` +
    `    after  ${after}\n` +
    `    ${style.grey(change.reason)}`
  )
}
