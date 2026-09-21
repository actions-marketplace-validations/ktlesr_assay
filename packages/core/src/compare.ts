/**
 * İki koşumun karşılaştırılması.
 *
 * İki kural burayı belirliyor:
 *
 * 1. **Dört pin sabit değilse karşılaştırma yapılmaz** (değişmez #2). Model
 *    güncellendiği için düşen bir skor regresyon değil, gürültüdür; onu
 *    regresyon diye raporlamak kullanıcıya yanlış yeri tamir ettirir.
 *
 * 2. **Regresyon iddiası güven aralıklarına dayanır.** İki oran farklı diye
 *    regresyon denmez; aralıklar kesişiyorsa fark gürültüden ayırt edilemez.
 *    N küçükken bu neredeyse her zaman böyledir ve bunu söylemek dürüstlüktür.
 */

import {
  comparePins,
  diffEnvironments,
  type EnvironmentChange,
  type Pins,
  type Proportion,
  type Run,
  type Verdict,
} from './records.js'

export type ChangeStatus =
  /** Aralıklar ayrık ve sonraki daha düşük. */
  | 'regressed'
  /** Aralıklar ayrık ve sonraki daha yüksek. */
  | 'improved'
  /** Fark var ama aralıklar kesişiyor: gürültüden ayırt edilemiyor. */
  | 'within_noise'
  /** Bir tarafta ölçüm yok. */
  | 'unknown'

export interface CaseComparison {
  caseId: string
  before: Proportion | null
  after: Proportion | null
  status: ChangeStatus
  reason: string
  /** `after.rate - before.rate`. Bir taraf ölçülemediyse `null`. */
  delta: number | null
}

export interface RunComparison {
  comparable: boolean
  /** Kayan pin adları. Boş değilse `cases` boş ve verdict `unknown`. */
  drifted: readonly (keyof Pins)[]
  /** Ölçülemeyen pin adları — kaymadı, ama tuttuğu da bilinmiyor. */
  unavailable: readonly (keyof Pins)[]
  /**
   * `environmentHash` kaydıysa hash'in içinde kayan alanlar.
   *
   * Boş olması "ortam kaymadı" demek değil: iki kayıttan biri ortam
   * bileşenlerini taşımıyorsa (0.3.0-a öncesi kayıtlar) hash düzeyinde
   * konuşulur ve burası boş kalır.
   */
  environmentChanges: readonly EnvironmentChange[]
  cases: readonly CaseComparison[]
  verdict: Verdict
  /** Karşılaştırmayı durduran sebep. Kayan pin varsa yalnızca o. */
  reason: string
  /**
   * İkincil eksiklik: bir pin kaydığı hâlde başka bir pin de okunamadıysa.
   * Karşılaştırmayı durduran o değil — kayma zaten durduruyor — ama kayma
   * olmasaydı da koşulların aynı olduğu gösterilemezdi.
   */
  note?: string
}

/**
 * İki koşumu karşılaştırır.
 *
 * Pinlerden biri kaymışsa VEYA ölçülemiyorsa hiçbir vaka karşılaştırılmaz ve
 * `unknown` döner; hangi pinin kaydığı `drifted`, hangisinin okunamadığı
 * `unavailable` içinde yazar. İkisi ayrı: biri "koşullar değişti", diğeri
 * "koşulların aynı olduğunu bilmiyoruz".
 */
export function compareRuns(before: Run, after: Run): RunComparison {
  const pins = comparePins(before.pins, after.pins)
  if (!pins.comparable) {
    // Kayan pin ile ölçülemeyen pin ayrı cümleler: biri "koşullar değişti",
    // diğeri "koşulların aynı olduğunu bilmiyoruz". İkisi de karşılaştırmayı
    // durduruyor ama kullanıcıya farklı bir iş düşüyor.
    const parts: string[] = []
    if (pins.drifted.length > 0) {
      parts.push(`${pins.drifted.join(', ')} changed between them`)
    }
    // Hash "bir şey değişti" der; okuyucunun ihtiyacı olan "ne değişti".
    const environmentChanges =
      pins.drifted.includes('environmentHash') &&
      before.environment !== undefined &&
      after.environment !== undefined
        ? diffEnvironments(before.environment, after.environment)
        : []
    if (environmentChanges.length > 0) {
      parts.push(
        `the host environment moved in ${environmentChanges
          .map((c) => `${c.field}: ${c.before} → ${c.after}`)
          .join('; ')}`,
      )
    }
    // Okunamayan pin, kayma yoksa sebebin kendisi (değişmez #2: eksik pin de
    // karşılaştırmayı durdurur); kayma varsa ayrı bir not. Aynı cümlede
    // durunca hangisinin durdurduğu okunmuyordu.
    const unread =
      pins.unavailable.length > 0
        ? `${pins.unavailable.join(', ')} could not be read in one or both runs`
        : undefined
    if (unread !== undefined && parts.length === 0) {
      parts.push(`${unread}, so the conditions cannot be shown to match`)
    }
    return {
      comparable: false,
      drifted: pins.drifted,
      unavailable: pins.unavailable,
      environmentChanges,
      cases: [],
      verdict: 'unknown',
      reason: `the runs are not comparable: ${parts.join('; ')}`,
      ...(unread !== undefined && pins.drifted.length > 0
        ? {
            note: `${unread}, so even without that change the conditions could not be shown to match`,
          }
        : {}),
    }
  }

  const beforeCases = new Map(before.cases.map((c) => [c.caseId, c]))
  const afterCases = new Map(after.cases.map((c) => [c.caseId, c]))
  const ids = [...new Set([...beforeCases.keys(), ...afterCases.keys()])].sort()

  const cases = ids.map((caseId) =>
    compareCase(
      caseId,
      beforeCases.get(caseId)?.passRate ?? null,
      afterCases.get(caseId)?.passRate ?? null,
    ),
  )

  const regressed = cases.filter((c) => c.status === 'regressed')
  const unresolved = cases.filter((c) => c.status === 'unknown')

  return {
    comparable: true,
    drifted: [],
    unavailable: [],
    environmentChanges: [],
    cases,
    verdict: regressed.length > 0 ? 'fail' : unresolved.length > 0 ? 'unknown' : 'pass',
    reason:
      regressed.length > 0
        ? `${regressed.length} case(s) regressed: ${regressed.map((c) => c.caseId).join(', ')}`
        : unresolved.length > 0
          ? `${unresolved.length} case(s) could not be compared`
          : `no regression across ${cases.length} case(s)`,
  }
}

function compareCase(
  caseId: string,
  before: Proportion | null,
  after: Proportion | null,
): CaseComparison {
  if (before === null || after === null) {
    return {
      caseId,
      before,
      after,
      status: 'unknown',
      delta: null,
      reason:
        before === null
          ? 'the case is new: it has no earlier measurement'
          : 'the case is gone from the newer run',
    }
  }

  if (
    before.rate === null ||
    after.rate === null ||
    before.ci === null ||
    after.ci === null
  ) {
    return {
      caseId,
      before,
      after,
      status: 'unknown',
      delta: null,
      reason: 'one of the runs produced no decided attempts for this case',
    }
  }

  const delta = after.rate - before.rate
  // Aralıklar kesişiyorsa fark gürültüden ayırt edilemez.
  const disjoint = after.ci.high < before.ci.low || after.ci.low > before.ci.high

  if (!disjoint) {
    return {
      caseId,
      before,
      after,
      delta,
      status: 'within_noise',
      reason:
        delta === 0
          ? 'unchanged'
          : `the ${delta > 0 ? 'rise' : 'drop'} of ${Math.abs(delta * 100).toFixed(0)} points sits inside the confidence intervals, so it cannot be told apart from noise`,
    }
  }

  return {
    caseId,
    before,
    after,
    delta,
    status: delta < 0 ? 'regressed' : 'improved',
    reason: `${delta < 0 ? 'dropped' : 'rose'} by ${Math.abs(delta * 100).toFixed(0)} points, and the confidence intervals do not overlap`,
  }
}
