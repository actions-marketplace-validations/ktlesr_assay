/**
 * Tek dosyalık HTML rapor.
 *
 * Paylaşılabilir olması gerekiyor: PR'a eklenir, Slack'e atılır. O yüzden
 * dış kaynak yok — CSS gömülü, script yok, ağ isteği yok.
 *
 * Değişmez #4 burada da geçerli: oranlar `formatProportion` üzerinden basılır.
 * `unknown` kendi rengini ve kendi sayacını taşır.
 */

import {
  assayVersionLabel,
  hostMemoryLabel,
  containerLabel,
  collisionPrefix,
  formatProportion,
  NO_SKILL,
  outsidePrefix,
  redact,
  type CollisionMatrix,
  type Run,
  type RunSummary,
  type Verdict,
} from '@ktlsr/assay-core'

/**
 * Kaçış ve maskeleme aynı yerde.
 *
 * Maskeleme kayıt YAZILIRKEN de yapılıyor ama bu yetmiyor: rapor eski
 * kayıtlardan da üretilebiliyor ve o kayıtlar maskeleme eklenmeden önce
 * yazıldı. Rapor bir dosya olarak paylaşılıyor, yani sızıntının son çıkış
 * kapısı burası. Tek bir yerde durdurmak, her interpolasyonu tek tek
 * hatırlamaktan güvenli.
 */
const escape = (value: string): string =>
  redact(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ??
      char,
  )

const caseVerdict = (failed: number, unknown: number): Verdict =>
  failed > 0 ? 'fail' : unknown > 0 ? 'unknown' : 'pass'

/**
 * Çakışma matrisi, HTML için (0.4.0).
 *
 * Kendi yatay kaydırma kabında: on dört sütunluk bir matris sayfayı yana
 * taşırmasın. Köşegen yeşil, köşegen dışı kırmızı, sıfır soluk; renk kalkınca
 * da sayılar okunuyor.
 */
function renderCollisionHtml(matrix: CollisionMatrix): string {
  const prefix = collisionPrefix(matrix)
  const short = (name: string) => (prefix !== '' && name.startsWith(prefix) ? name.slice(prefix.length) : name)
  const label = (expected: readonly string[]) =>
    expected.length === 0 ? NO_SKILL : expected.map(short).join(' / ')
  const head = matrix.columns.map((c) => `<th class="num">${escape(short(c))}</th>`).join('')
  const rows = matrix.rows
    .map((row) => {
      const cells = matrix.columns
        .map((c) => {
          const count = row.cells[c] ?? 0
          const hit = row.expected.length === 0 ? c === NO_SKILL : row.expected.includes(c)
          const cls = count === 0 ? 'zero' : hit ? 'hit' : 'miss'
          return `<td class="c ${cls}">${count === 0 ? '·' : count}</td>`
        })
        .join('')
      const notes = [
        ...(row.alsoFired > 0 ? [`${row.alsoFired} also fired`] : []),
        ...(row.unmeasured > 0 ? [`${row.unmeasured} unmeasured`] : []),
      ]
      return `        <tr><td class="mono">${escape(label(row.expected))}</td>${cells}<td class="rate">${escape(formatProportion(row.won))}${notes.length === 0 ? '' : `<br><span class="note">${escape(notes.join(', '))}</span>`}</td></tr>`
    })
    .join('\n')
  return `  <section>
    <h2>Collision matrix</h2>
    <p class="note">Rows are the expected winner, columns the first skill to fire. Winning means firing first; a skill that fired later is counted under "also fired".${prefix === '' ? '' : ` Names are shown without the common prefix <span class="mono">${escape(prefix)}</span>${outsidePrefix(matrix, prefix).length === 0 ? '' : `; not under it: <span class="mono">${escape(outsidePrefix(matrix, prefix).join(', '))}</span>`}.`}${matrix.unmeasured === 0 ? '' : ` ${matrix.unmeasured} attempt(s) could not be measured and are not in the matrix.`}</p>
    <div class="matrix">
    <table>
      <thead><tr><th>expected \\ fired</th>${head}<th>Won</th></tr></thead>
      <tbody>
${rows}
      </tbody>
    </table>
    </div>
  </section>`
}

export function renderHtmlReport(run: Run, summary: RunSummary): string {
  const rows = run.cases
    .map((caseResult) => {
      const verdict = caseVerdict(caseResult.failed, caseResult.unknown)
      /*
       * Değerlendirilmemiş assertion'lar vakanın altında, adlarıyla.
       *
       * Manşetteki "assertion'lara bakılmadı" cümlesi hangi iddianın
       * sınanmadığını söylemiyor; terminal söylüyordu, HTML söylemiyordu —
       * gerçek hosttaki hızlı mod koşumu gösterdi.
       */
      const notEvaluated = caseResult.attempts[0]?.notEvaluated ?? []
      const notEvaluatedNote =
        notEvaluated.length === 0
          ? ''
          : `<br><span class="note">not evaluated in this mode: ${escape(
              notEvaluated.map((assertion) => assertion.type).join(', '),
            )}</span>`
      return `        <tr>
          <td><span class="pill ${verdict}">${verdict}</span></td>
          <td class="mono">${escape(caseResult.caseId)}${notEvaluatedNote}</td>
          <td class="rate">${escape(formatProportion(caseResult.passRate))}</td>
          <td class="num">${caseResult.passed}</td>
          <td class="num">${caseResult.failed}</td>
          <td class="num ${caseResult.unknown > 0 ? 'warn' : ''}">${caseResult.unknown}</td>
        </tr>`
    })
    .join('\n')

  const unknowns = run.cases
    .flatMap((caseResult) => caseResult.attempts)
    .filter((attempt) => attempt.verdict === 'unknown')
  const unknownList =
    unknowns.length === 0
      ? ''
      : `    <section>
      <h2>Not measured <span class="count warn">${unknowns.length}</span></h2>
      <p class="note">These attempts produced no verdict. They are excluded from every
      rate above and counted here instead — an unmeasured attempt is not a passing one.</p>
      <ul class="reasons">
${[...new Map(unknowns.map((a) => [`${a.caseId}:${a.reason}`, a])).values()]
  .map(
    (attempt) =>
      `        <li><span class="mono">${escape(attempt.caseId)}</span><br><span class="note">${escape(attempt.reason)}</span></li>`,
  )
  .join('\n')}
      </ul>
    </section>`

  /*
   * Yarım kayıt manşette söylenir, dipnotta değil.
   *
   * Sayfanın üstündeki oranlar tamamlanmış denemelerden geliyor; koşum yarım
   * kaldıysa okuyucu bunu ORANLARI OKUMADAN ÖNCE bilmeli. Aşağıda bir yerde
   * dursaydı ölçüm olduğundan büyük görünürdü.
   */
  /*
   * Hızlı mod manşette: sayfanın üstündeki oranlar hızlı modda da aynı
   * görünüyor ve okuyucu neyin ölçülmediğini onlardan önce bilmeli.
   */
  const fastNote =
    run.layers === undefined || run.layers.includes('assertions')
      ? ''
      : `  <section class="callout">
    <h2>Fast mode — an early warning, not evidence</h2>
    <p>Only the ${escape(run.layers.join(' and '))} layer was measured. Declared
    assertions were not evaluated; they are listed as such rather than counted
    as unknown.</p>
    <p class="note">At ${run.runs} attempts per case the intervals are wide by
    construction. Run without <code>--fast</code> before trusting a green
    result.</p>
  </section>`

  /*
   * Koşulmayan vakalar manşette, hızlı moddan bağımsız.
   *
   * İlk hâli onları yalnızca hızlı mod notunun içinde anıyordu: `--fast`
   * olmadan `--max-attempts` ile kesilmiş bir koşumun raporu kesilen vakalardan
   * hiç söz etmiyordu. Bütçe kesmesi varsa başlık koşumun neden geçemediğini
   * söylüyor — verdict `unknown` ama tek bir `unknown` deneme yok ve okuyucu
   * sebebi başka yerde aramasın.
   */
  const skipped = run.skipped ?? []
  const budgetCut = skipped.filter((item) => item.cause === 'budget').length
  // Koşumun hiç ulaşamadığı vakalar (0.3.1-b): bütçeyle aynı sebepten geçemez.
  const unreached = skipped.filter((item) => item.cause === 'interrupted').length
  const skippedHeading =
    budgetCut > 0
      ? `The attempt budget cut ${budgetCut} case(s) — this run cannot pass`
      : unreached > 0
        ? `The run was interrupted before ${unreached} case(s) started — this record cannot pass`
        : `${skipped.length} case(s) were not run`
  const skippedNote =
    skipped.length === 0
      ? ''
      : `  <section class="callout">
    <h2>${skippedHeading}</h2>${
      budgetCut === 0
        ? ''
        : `
    <p>A case the budget cut was never measured, and it may be every negative in
    the set: a run of positives alone would look perfect. At best the run is
    unknown; a failure it did measure still counts.</p>`
    }${
      unreached === 0
        ? ''
        : `
    <p>A case the run never reached was never measured, and it may be every
    negative in the set. At best the record is unknown; a failure it did measure
    still counts.</p>`
    }
    <ul class="reasons">
${skipped
  .map(
    (item) =>
      `      <li><span class="mono">${escape(item.caseId)}</span><br><span class="note">${escape(item.reason)}</span></li>`,
  )
  .join('\n')}
    </ul>
  </section>`

  const partialNote =
    run.partial === undefined
      ? ''
      : `  <section class="callout">
    <h2>Incomplete run</h2>
    <p>${escape(run.partial.reason)}</p>
    <p class="note">Recovered ${escape(run.partial.recoveredAt)}. Every rate below is
    over the attempts that completed — read N on each case, not the declared
    ${run.runs} runs per case. An incomplete record cannot pass; at best it is
    unknown.${
      run.partial.droppedLines === undefined
        ? ''
        : ` ${run.partial.droppedLines} journal line(s) were unreadable and were dropped.`
    }</p>
  </section>`

  // Not, verdict değil: hiçbir negatif kırılmadıysa ölçülen şey yanlış
  // tetiklenme oranıdır, setin ayrım gücünün nerede bittiği değil.
  const discriminationNote = !summary.discrimination.untested
    ? ''
    : `    <section class="callout">
      <h2>No negative case broke</h2>
      <p>${summary.discrimination.cases} negative case(s), ${summary.discrimination.attempts}
      measured attempt(s), 0 false positives. That bounds the false-positive rate, not this
      set's discriminating power: the negatives may differ from the positives on some axis
      other than the one under test, which makes any skill look perfect. Tighten the near
      neighbours before reading this as a clean bill.</p>
      <p class="note">A note, not a verdict — it does not change the run result.</p>
    </section>`

  const collisionSection =
    summary.collision === undefined ? '' : renderCollisionHtml(summary.collision)
  const targetOnly =
    summary.collision === undefined ? '' : ` <span class="note">target only: ${escape(run.skill)}</span>`
  const f1 =
    summary.trigger.f1 === null ? 'not measurable' : summary.trigger.f1.toFixed(2)
  const cost =
    summary.totals.usd === null ? 'not reported' : `$${summary.totals.usd.toFixed(4)}`

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Assay — ${escape(run.id)}</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #fbfbfa; --fg: #1b1b19; --muted: #6b6b66; --line: #e3e2de;
    --pass: #2f7d4f; --fail: #b3261e; --unknown: #8a6a2f; --card: #fff;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #131311; --fg: #ecebe7; --muted: #96958e; --line: #2b2b28;
      --pass: #6fc08d; --fail: #e8776d; --unknown: #d9b56a; --card: #191917;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--fg);
    font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
  }
  main { max-width: 56rem; margin: 0 auto; padding: 3rem 1.5rem 5rem; }
  h1 { margin: 0 0 .25rem; font-size: 1.6rem; letter-spacing: -.02em; }
  h2 { margin: 2.5rem 0 .75rem; font-size: 1.05rem; }
  .sub { color: var(--muted); margin: 0 0 2rem; font-size: .9rem; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .85rem; }
  .note { color: var(--muted); font-size: .85rem; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: .55rem .5rem; border-bottom: 1px solid var(--line); }
  th { font-size: .75rem; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); font-weight: 600; }
  td.num, th.num { text-align: right; width: 4rem; }
  td.rate { font-variant-numeric: tabular-nums; white-space: nowrap; }
  /* Geniş tablo kendi kabında kayar; sayfa yana taşmaz. Vaka tablosu 420 px'de
     sayfayı taşırıyordu (0.4.0'dan önce de) — matris eklenirken ölçüldü. */
  .matrix, .scroll { overflow-x: auto; }
  .matrix table { width: auto; }
  .matrix td.c { text-align: right; font-variant-numeric: tabular-nums; min-width: 2.5rem; }
  .matrix td.hit { color: var(--pass); font-weight: 600; }
  .matrix td.miss { color: var(--fail); font-weight: 600; }
  .matrix td.zero { color: var(--muted); }
  /* Satır etiketi yapışkan: dar ekranda yana kaydırınca hangi satırda olduğun kaybolmasın. */
  .matrix tr > :first-child { position: sticky; left: 0; background: var(--bg); }
  .warn { color: var(--unknown); font-weight: 600; }
  /* Kart yok, yan sekme yok (docs/design.md #1): veri kutularda değil
     çizgilerde durur. Bölümü ayıran şey basılı bir tablonun cetvel çizgisi. */
  .callout { border-top: 1px solid var(--line); padding: 1rem 0 0; margin-top: 2rem; }
  .callout h2 { margin-bottom: .4rem; }
  .callout p { font-size: .85rem; margin: .4rem 0 0; }
  .pill {
    display: inline-block; padding: .1rem .5rem; border-radius: 999px;
    font-size: .7rem; text-transform: uppercase; letter-spacing: .04em; font-weight: 600;
    border: 1px solid currentColor;
  }
  .pill.pass { color: var(--pass); }
  .pill.fail { color: var(--fail); }
  .pill.unknown { color: var(--unknown); }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr)); gap: .75rem; margin-top: 2rem; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: .9rem 1rem; }
  .card .label { font-size: .72rem; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
  .card .value { font-size: .95rem; margin-top: .3rem; font-variant-numeric: tabular-nums; }
  .count { font-size: .8rem; padding: .05rem .45rem; border: 1px solid currentColor; border-radius: 999px; }
  .reasons { list-style: none; padding: 0; margin: 0; }
  .reasons li { padding: .5rem 0; border-bottom: 1px solid var(--line); }
  footer { margin-top: 3rem; color: var(--muted); font-size: .8rem; }
  .pins { display: grid; grid-template-columns: max-content 1fr; gap: .25rem 1rem; }
  .pins dt { color: var(--muted); font-size: .8rem; }
  /* Hash ve kaynak dizeleri boşluksuz; kırılmasalar dar ekranda sayfayı taşırıyor. */
  .pins dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
</style>
</head>
<body>
<main>
  <h1>Assay <span class="pill ${run.verdict}">${run.verdict}</span></h1>
  <p class="sub mono">${escape(run.id)}</p>
${fastNote}
${skippedNote}
${partialNote}
${collisionSection}

  <div class="grid">
    <div class="card"><div class="label">Trigger precision${targetOnly}</div><div class="value">${escape(formatProportion(summary.trigger.precision))}</div></div>
    <div class="card"><div class="label">Trigger recall${targetOnly}</div><div class="value">${escape(formatProportion(summary.trigger.recall))}</div></div>
    <div class="card"><div class="label">F1</div><div class="value">${escape(f1)}</div></div>
    <div class="card"><div class="label">Attempts</div><div class="value">${summary.totals.attempts} · ${summary.counts.unknown > 0 ? `<span class="warn">${summary.counts.unknown} unknown</span>` : 'none unknown'}</div></div>
  </div>

  <h2>Cases</h2>
  <div class="scroll">
  <table>
    <thead>
      <tr><th>Verdict</th><th>Case</th><th>Pass rate</th><th class="num">Pass</th><th class="num">Fail</th><th class="num">Unknown</th></tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
  </div>
  <p class="note">Every rate carries its observation count and 95% Wilson confidence
  interval. A rate without them would hide how little three runs can tell you.</p>

${discriminationNote}
${unknownList}

  <h2>Pins</h2>
  <p class="note">Two runs are comparable only when all four are identical.</p>
  <dl class="pins">
    <dt>Skill version</dt><dd class="mono">${escape(run.pins.skillSource)}</dd>
    <dt>Skill hash</dt><dd class="mono">${escape(run.pins.skillHash === '' ? 'not computed' : run.pins.skillHash)}</dd>
    <dt>Model</dt><dd class="mono">${escape(run.pins.model)}</dd>
    <dt>System prompt hash</dt><dd class="mono">${escape(run.pins.systemPromptHash)}</dd>
    <dt>Case set version</dt><dd class="mono">${run.pins.suiteVersion}</dd>
    <dt>Case set hash</dt><dd class="mono">${escape(run.pins.suiteHash)}</dd>
    <dt>Environment hash</dt><dd class="mono">${escape(run.pins.environmentHash ?? 'not reported by the host')}</dd>
    <dt>Permission mode</dt><dd class="mono">${escape(run.permissionMode ?? 'not reported by the host')}</dd>
    <dt>Host memory</dt><dd class="mono">${escape(hostMemoryLabel(run))}</dd>
    <dt>Container</dt><dd class="mono">${escape(containerLabel(run))}</dd>
    <dt>Assay version</dt><dd class="mono">${escape(assayVersionLabel(run))}</dd>
  </dl>
  <p class="note">The permission mode is part of the measurement: a skill whose
  tools are restricted and the same skill unrestricted are two different runs.
  It is folded into the environment hash, so runs measured under different
  modes do not compare.</p>

  <h2>Cost and latency</h2>
  <div class="grid">
    <div class="card"><div class="label">Tokens in / out</div><div class="value">${summary.totals.inputTokens} / ${summary.totals.outputTokens}</div></div>
    <div class="card"><div class="label">Cost</div><div class="value">${escape(cost)}</div></div>
    <div class="card"><div class="label">Duration</div><div class="value">${(summary.totals.durationMs / 1000).toFixed(1)} s</div></div>
    <div class="card"><div class="label">Tool calls</div><div class="value">${summary.totals.toolCalls}</div></div>
  </div>

  <footer>
    Host ${escape(run.host)} · ${escape(run.startedAt)} → ${escape(run.finishedAt)} ·
    ${run.runs} runs per case
  </footer>
</main>
</body>
</html>
`
}
