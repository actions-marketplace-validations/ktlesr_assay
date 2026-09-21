/**
 * Skorlama.
 *
 * Tek kural: **hiçbir fonksiyon çıplak oran döndürmez.** Her oran bir
 * `Proportion`'dır ve N ile Wilson güven aralığını yanında taşır (değişmez #4).
 *
 * İkinci kural: `unknown` sonuçlar oranların paydasından çıkarılır ama
 * **ayrıca sayılır**. Ölçülemeyeni başarısızlık saymak da başarı saymak kadar
 * yanlış; ikisi de gerçeği gizler.
 */

import {
  proportion,
  type Attempt,
  type Proportion,
  type Run,
  type Verdict,
} from './records.js'

// ---------------------------------------------------------------------------
// Sayım
// ---------------------------------------------------------------------------

export interface VerdictCounts {
  pass: number
  fail: number
  unknown: number
  /** Toplam gözlem. `pass + fail + unknown`. */
  total: number
}

export function countVerdicts(verdicts: readonly Verdict[]): VerdictCounts {
  const counts = { pass: 0, fail: 0, unknown: 0, total: verdicts.length }
  for (const verdict of verdicts) counts[verdict] += 1
  return counts
}

/**
 * Kesin sonuçların oranı. `unknown`'lar paydadan çıkarılır.
 *
 * Hepsi `unknown` ise N=0 olur ve `Proportion.rate` `null` döner — "hiç
 * ölçülemedi" ile "%0 geçti" karışmaz.
 */
export function decidedRate(counts: VerdictCounts): Proportion {
  return proportion(counts.pass, counts.pass + counts.fail)
}

// ---------------------------------------------------------------------------
// Tetiklenme doğruluğu
// ---------------------------------------------------------------------------

/** Tek bir tetiklenme gözlemi: beklenen ve gözlenen. */
export interface TriggerObservationPoint {
  /** Vaka tetiklenmesini bekliyor mu (pozitif vaka mı). */
  expected: boolean
  /** Gözlenen tetiklenme. Okunamadıysa `null`. */
  observed: boolean | null
}

/**
 * Tetiklenme karışıklık matrisi.
 *
 * Pozitif sınıf = "skill tetiklenmeli". `unknown` gözlemler matrise girmez,
 * `unknown` alanında sayılır.
 */
export interface TriggerAccuracy {
  truePositive: number
  falsePositive: number
  trueNegative: number
  falseNegative: number
  /** Okunamayan gözlemler. Matrise dahil değil. */
  unknown: number
  /** TP / (TP + FP) — tetiklendiğinde haklı mıydı. */
  precision: Proportion
  /** TP / (TP + FN) — tetiklenmesi gerektiğinde tetiklendi mi. */
  recall: Proportion
  /**
   * Harmonik ortalama. Oran olmadığı için `Proportion` değil; precision veya
   * recall ölçülemediyse `null`.
   */
  f1: number | null
}

export function triggerAccuracy(
  points: readonly TriggerObservationPoint[],
): TriggerAccuracy {
  let truePositive = 0
  let falsePositive = 0
  let trueNegative = 0
  let falseNegative = 0
  let unknown = 0

  for (const point of points) {
    if (point.observed === null) {
      unknown += 1
      continue
    }
    if (point.expected && point.observed) truePositive += 1
    else if (!point.expected && point.observed) falsePositive += 1
    else if (!point.expected && !point.observed) trueNegative += 1
    else falseNegative += 1
  }

  const precision = proportion(truePositive, truePositive + falsePositive)
  const recall = proportion(truePositive, truePositive + falseNegative)
  const f1 =
    precision.rate === null || recall.rate === null || precision.rate + recall.rate === 0
      ? null
      : (2 * precision.rate * recall.rate) / (precision.rate + recall.rate)

  return {
    truePositive,
    falsePositive,
    trueNegative,
    falseNegative,
    unknown,
    precision,
    recall,
    f1,
  }
}

// ---------------------------------------------------------------------------
// Kararsızlık
// ---------------------------------------------------------------------------

export interface Flakiness {
  passRate: Proportion
  /**
   * Vaka kararsız mı: hem `pass` hem `fail` gözlendi. Tek koşumda anlamsız
   * olduğu için N < 2 iken `null`.
   */
  flaky: boolean | null
  /** Kesin gözlem sayısı 2'nin altındaysa kararsızlık ölçülememiştir. */
  measured: boolean
}

export function flakiness(counts: VerdictCounts): Flakiness {
  const decided = counts.pass + counts.fail
  return {
    passRate: decidedRate(counts),
    flaky: decided < 2 ? null : counts.pass > 0 && counts.fail > 0,
    measured: decided >= 2,
  }
}

// ---------------------------------------------------------------------------
// Maliyet ve hacim
// ---------------------------------------------------------------------------

export interface Totals {
  attempts: number
  inputTokens: number
  outputTokens: number
  /** Host maliyet vermediyse `null` — sıfır değil. */
  usd: number | null
  /** Toplam süre. Ölçülemeyen attempt'ler dahil değil. */
  durationMs: number
  toolCalls: number
}

export function totals(attempts: readonly Attempt[]): Totals {
  let inputTokens = 0
  let outputTokens = 0
  let usd = 0
  let sawCost = false
  let durationMs = 0
  let toolCalls = 0

  for (const attempt of attempts) {
    if (attempt.cost !== undefined) {
      inputTokens += attempt.cost.inputTokens
      outputTokens += attempt.cost.outputTokens
      if (attempt.cost.usd !== undefined) {
        usd += attempt.cost.usd
        sawCost = true
      }
    }
    durationMs += attempt.latencyMs ?? 0
    toolCalls += (attempt.trace ?? []).filter(
      (event) => event.kind === 'tool_call',
    ).length
  }

  return {
    attempts: attempts.length,
    inputTokens,
    outputTokens,
    usd: sawCost ? usd : null,
    durationMs,
    toolCalls,
  }
}

// ---------------------------------------------------------------------------
// Koşum özeti
// ---------------------------------------------------------------------------

export interface RunSummary {
  counts: VerdictCounts
  /** Attempt seviyesinde geçiş oranı. */
  passRate: Proportion
  trigger: TriggerAccuracy
  totals: Totals
  /** Koşumun bileşik verdict'i: bir fail varsa fail, yoksa unknown varsa unknown. */
  verdict: Verdict
  /** Negatif tarafın ayrım gücü ölçülebildi mi (bkz. `Discrimination`). */
  discrimination: Discrimination
  /**
   * Çakışma matrisi (0.4.0): yalnızca en az bir vaka kazanan beklediğinde.
   * Varken `trigger` yalnız hedef skill'i anlatır ve raporda öyle etiketlenir.
   */
  collision?: CollisionMatrix
}

/**
 * Negatif vakaların ayrım gücü hakkında bir NOT — verdict değil.
 *
 * Bir tetiklenme suite'inde hiçbir negatif hiçbir denemede kırılmadıysa
 * ölçülen şey "skill bu negatiflerde tetiklenmiyor"dur. Setin ayrım gücünün
 * nerede bittiği ölçülmemiştir: negatifler pozitiflerden ölçülmek istenen
 * özellikte değil, başka bir eksende uzak olabilir ve bu fark sonucu
 * kusursuz gösterir (bkz. docs/measurements.md).
 *
 * Bu yüzden `untested` bir hata değil, bir uyarıdır ve `verdict`'i
 * etkilemez. Değişmez #5 negatif bulunmasını şart koşar; bu alan
 * negatiflerin gerçekten sınandığını söyler.
 */
export interface Discrimination {
  /** Tetiklenmemesi beklenen ayrık vaka sayısı. */
  cases: number
  /** Bu vakalarda ölçülebilmiş attempt sayısı (unknown sayılmaz). */
  attempts: number
  /** Beklenmediği hâlde tetiklenen attempt sayısı. */
  falsePositives: number
  /** En az bir negatif ölçüldü ve hiçbiri kırılmadı. */
  untested: boolean
}

/**
 * Bir attempt'in doğruluk matrisine giren gözlemi.
 *
 * Üç durum, iki değil. Sinyal okunamadıysa `null`; **aktivasyonu
 * doğrulanamamış bir çağrı da `null`** — model skill'i seçti ama gövdesi
 * oturuma girmedi, yani ne tetiklendi ne tetiklenmedi.
 *
 * Bu satır olmadan precision yalan söylüyordu: reddedilen dört aktivasyon
 * dört gerçek tetiklenme sayılıyor ve pozitif vakalar %100 precision
 * veriyordu (0.2.0 öncesi davranış).
 */
function observedTrigger(attempt: Attempt): boolean | null {
  if (!attempt.trigger.available) return null
  if (attempt.trigger.refused && !attempt.trigger.triggered) return null
  return attempt.trigger.triggered
}

/**
 * Attempt'lerden koşum özeti.
 *
 * `expectedTrigger` her vaka için beklenen tetiklenmeyi verir; vaka tetiklenme
 * hakkında iddiada bulunmuyorsa `undefined` döner ve o vaka doğruluk matrisine
 * girmez.
 */
export function summarize(
  attempts: readonly Attempt[],
  expectedTrigger: (caseId: string) => boolean | undefined,
): RunSummary {
  const counts = countVerdicts(attempts.map((a) => a.verdict))

  const points: TriggerObservationPoint[] = []
  const negativeCases = new Set<string>()
  let negativeAttempts = 0
  let falsePositives = 0
  for (const attempt of attempts) {
    const expected = expectedTrigger(attempt.caseId)
    if (expected === undefined) continue
    const observed = observedTrigger(attempt)
    points.push({ expected, observed })
    if (expected) continue
    negativeCases.add(attempt.caseId)
    // Ölçülemeyen attempt ayrım gücü hakkında hiçbir şey söylemiyor.
    if (observed === null) continue
    negativeAttempts += 1
    if (observed) falsePositives += 1
  }

  return {
    counts,
    passRate: decidedRate(counts),
    trigger: triggerAccuracy(points),
    totals: totals(attempts),
    verdict: counts.fail > 0 ? 'fail' : counts.unknown > 0 ? 'unknown' : 'pass',
    discrimination: {
      cases: negativeCases.size,
      attempts: negativeAttempts,
      falsePositives,
      untested: negativeAttempts > 0 && falsePositives === 0,
    },
  }
}

/**
 * Kayıttan doğrudan özet.
 *
 * Beklentiler kaydın kendisinde durduğu için suite dosyasına gerek yok;
 * `assay report` ve ileride hosted taraf bunu kullanır.
 */
export function summarizeRun(run: Run): RunSummary {
  const expected = new Map(run.cases.map((c) => [c.caseId, c.expectedTrigger]))
  const summary = summarize(
    run.cases.flatMap((c) => c.attempts),
    (caseId) => expected.get(caseId),
  )
  const collision = collisionMatrix(run)
  return collision === undefined ? summary : { ...summary, collision }
}

// ---------------------------------------------------------------------------
// Çakışma matrisi (0.4.0)
// ---------------------------------------------------------------------------

/** Matriste "hiçbir skill tetiklenmedi" sütunu ve `winner: none` satırı. */
export const NO_SKILL = 'none'

/**
 * Matristeki bütün skill adlarının ortak `plugin:` öneki, yoksa `''`.
 *
 * `marketing-skills:copy-editing` gibi on dört sütun terminale sığmıyor; önek
 * bir kez başlıkta söylenip hücrelerden atılıyor.
 *
 * Önekli adların hepsi aynı öneki taşımalı, ve atılması iki adı
 * çakıştırmamalı: `p:run` ile öneksiz `run` birlikteyse önek atılmaz. İlk hâli
 * tek bir öneksiz ad (host'la gelen `run`) görünce hiç atmıyordu ve gerçek
 * kayıtta 300 karakterlik satır üretti. Önek altında olmayan adlar
 * `outsidePrefix` ile ayrıca söylenir ki `run`, `marketing-skills:run` diye
 * okunmasın.
 */
export function collisionPrefix(matrix: CollisionMatrix): string {
  const names = matrix.columns.filter((c) => c !== NO_SKILL)
  const prefixed = names.filter((n) => n.includes(':'))
  const prefixes = new Set(prefixed.map((n) => n.slice(0, n.indexOf(':') + 1)))
  const [only] = [...prefixes]
  if (prefixes.size !== 1 || only === undefined) return ''
  const shortened = names.map((n) => (n.startsWith(only) ? n.slice(only.length) : n))
  return new Set(shortened).size === shortened.length ? only : ''
}

/** Matristeki, ortak önek altında OLMAYAN skill adları (ör. host'la gelen `run`). */
export function outsidePrefix(matrix: CollisionMatrix, prefix: string): string[] {
  if (prefix === '') return []
  return matrix.columns.filter((c) => c !== NO_SKILL && !c.startsWith(prefix))
}

/**
 * Beklenen kazanan × ilk tetiklenen.
 *
 * Suite'in tek hedefi olduğu için `trigger` alanındaki precision/recall
 * yalnızca hedef skill'i anlatıyor; çakışma suite'inde bu en az ilginç satır.
 * Asıl cevap burada: her vakada model önce hangi skill'e uzandı.
 */
export interface CollisionMatrix {
  /** Satırlar vaka sırasında ilk görülüşe göre; aynı kazananı bekleyen vakalar birleşir. */
  rows: readonly CollisionRow[]
  /**
   * Sütunlar: önce `none`, sonra satırların beklediği skill'ler (köşegen
   * görünsün diye), sonra beklenmeyen ama gözlenen skill'ler.
   */
  columns: readonly string[]
  /** Matrise girmeyen, ölçülemeyen deneme sayısı (değişmez #1). */
  unmeasured: number
}

export interface CollisionRow {
  /** Beklenen kazanan(lar); `[]` = hiçbir skill (`winner: none`). */
  expected: readonly string[]
  /** Bu satıra düşen vaka sayısı. */
  cases: number
  /** Sütun → ilk tetiklenenin o sütun olduğu deneme sayısı. */
  cells: Readonly<Record<string, number>>
  /** İlk tetiklenenden sonra başka bir skill'in de tetiklendiği deneme sayısı. */
  alsoFired: number
  /** Beklenenin ilk tetiklendiği ölçülmüş denemeler — N ve aralıkla (değişmez #4). */
  won: Proportion
  /** Bu satırda ölçülemeyen ve matrise girmeyen deneme sayısı. */
  unmeasured: number
}

/**
 * Kayıttan çakışma matrisi; hiçbir vaka kazanan beklemiyorsa `undefined`.
 *
 * Bir deneme matrise ancak sinyal okunduysa, liste tamsa ve tetiklenme kontrolü
 * `unknown` değilse girer. Aksi hâlde "none" sütununa düşer ve reddedilen bir
 * aktivasyonu "hiçbiri tetiklenmedi" diye sayardı.
 */
export function collisionMatrix(run: Run): CollisionMatrix | undefined {
  const withWinner = run.cases.filter((c) => c.expectedWinner !== undefined)
  if (withWinner.length === 0) return undefined

  const rows = new Map<
    string,
    { expected: readonly string[]; cases: number; cells: Map<string, number>; alsoFired: number; won: number; measured: number; unmeasured: number }
  >()
  const observed = new Set<string>()
  let unmeasured = 0

  for (const caseResult of withWinner) {
    const expected = caseResult.expectedWinner as readonly string[]
    const key = expected.length === 0 ? NO_SKILL : expected.join(' / ')
    const row = rows.get(key) ?? {
      expected,
      cases: 0,
      cells: new Map<string, number>(),
      alsoFired: 0,
      won: 0,
      measured: 0,
      unmeasured: 0,
    }
    row.cases += 1
    for (const attempt of caseResult.attempts) {
      const trigger = attempt.trigger
      if (!trigger.available || !trigger.complete || attempt.triggerCheck?.verdict === 'unknown') {
        row.unmeasured += 1
        unmeasured += 1
        continue
      }
      const first = trigger.skills[0] ?? NO_SKILL
      if (first !== NO_SKILL) observed.add(first)
      row.cells.set(first, (row.cells.get(first) ?? 0) + 1)
      if (trigger.skills.length > 1) row.alsoFired += 1
      row.measured += 1
      const won = expected.length === 0 ? first === NO_SKILL : expected.includes(first)
      if (won) row.won += 1
    }
    rows.set(key, row)
  }

  const diagonal = [...rows.values()].flatMap((r) => r.expected)
  const columns = [
    NO_SKILL,
    ...new Set(diagonal),
    ...[...observed].filter((skill) => !diagonal.includes(skill)).sort(),
  ]

  return {
    rows: [...rows.values()].map((row) => ({
      expected: row.expected,
      cases: row.cases,
      cells: Object.fromEntries(row.cells),
      alsoFired: row.alsoFired,
      won: proportion(row.won, row.measured),
      unmeasured: row.unmeasured,
    })),
    columns,
    unmeasured,
  }
}
