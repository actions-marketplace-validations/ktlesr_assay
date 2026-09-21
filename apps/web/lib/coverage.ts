import type { Run } from '@ktlsr/assay-core'

/**
 * Koşumun kapsamı — oranlardan ÖNCE okunması gereken üç durum (0.4.3-b).
 *
 * Hızlı mod (`layers`), koşulmayan vakalar (`skipped`) ve yarım kayıt
 * (`partial`) hosted sayfada hiç gösterilmiyordu: vaka başına 3 denemelik bir
 * erken uyarı tam bir ölçüm gibi görünüyor, atlanan vaka sessizce yok oluyordu.
 * CLI raporu üçünü de manşette söylüyor (terminal.ts); cümleler buradan aynı.
 */
export interface CoverageNotice {
  key: 'fast' | 'skipped' | 'partial'
  title: string
  body: string[]
  items?: ReadonlyArray<{ caseId: string; reason: string }>
}

export function coverageNotices(run: Run): CoverageNotice[] {
  const notices: CoverageNotice[] = []

  if (run.layers !== undefined && !run.layers.includes('assertions')) {
    notices.push({
      key: 'fast',
      title: 'Fast mode — an early warning, not evidence',
      body: [
        `Only the ${run.layers.join(' and ')} layer was measured. Declared assertions were not evaluated, and they are not counted as unknown.`,
        `At ${run.runs} attempts per case the intervals are wide by construction. Run without --fast before trusting a green result.`,
      ],
    })
  }

  const skipped = run.skipped ?? []
  if (skipped.length > 0) {
    const budgetCut = skipped.filter((item) => item.cause === 'budget').length
    const unreached = skipped.filter((item) => item.cause === 'interrupted').length
    notices.push({
      key: 'skipped',
      title: `${skipped.length} ${skipped.length === 1 ? 'case was' : 'cases were'} not run`,
      body: [
        ...(budgetCut > 0
          ? [
              `The attempt budget cut ${budgetCut} of them, so this run cannot pass: a cut case was never measured and may be every negative in the set.`,
            ]
          : []),
        ...(unreached > 0
          ? [
              `The run was interrupted before ${unreached} of them started, so this record cannot pass: a case it never reached may be every negative in the set.`,
            ]
          : []),
      ],
      items: skipped.map(({ caseId, reason }) => ({ caseId, reason })),
    })
  }

  if (run.partial !== undefined) {
    notices.push({
      key: 'partial',
      title: 'Incomplete run',
      body: [
        run.partial.reason,
        `Recovered ${run.partial.recoveredAt}. The counts below are the attempts that completed, not the declared repeat count — read N on each case. An incomplete record cannot pass; at best it is unknown.`,
        ...(run.partial.droppedLines === undefined
          ? []
          : [
              `${run.partial.droppedLines} journal line(s) were unreadable and were dropped.`,
            ]),
      ],
    })
  }

  return notices
}

/** Dizin satırı için tek kelimelik kapsam notu; tam metin koşum sayfasında. */
export function coverageTag(run: Run): string | null {
  if (run.partial !== undefined) return 'incomplete run'
  if (run.layers !== undefined && !run.layers.includes('assertions')) return 'fast mode'
  return null
}

/**
 * `unknown` verdict'in kapsamdan gelen sebebi, varsa (0.4.3-b).
 *
 * Yarım ya da bütçenin kestiği bir kayıt tek bir okunamayan deneme olmadan da
 * `unknown`; hüküm cümlesi onu "okunabilir sinyal yok" diye açıklıyordu
 * ("0 of 1 attempts produced no readable signal") — yanlış adres.
 */
export function unknownBecause(run: Run): string | null {
  if (run.partial !== undefined) {
    return 'The run was interrupted before it finished, so this record cannot pass — read what was not measured below.'
  }
  const cut = (run.skipped ?? []).filter(
    (item) => item.cause === 'budget' || item.cause === 'interrupted',
  )
  if (cut.length > 0) {
    return `The attempt budget stopped ${cut.length} ${cut.length === 1 ? 'case' : 'cases'} before they ran, so this run cannot pass — read what was not measured below.`
  }
  return null
}
