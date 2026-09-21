/**
 * Tetiklenme değerlendirmesi.
 *
 * Assay'in en ayırt edici katmanı ve aynı zamanda en kolay yanlış yapılanı:
 * sinyal okunamadığında "tetiklenmedi" varsaymak, her negatif vakayı bedavaya
 * geçirir. Bu yüzden okunamayan sinyal `unknown`'dır, `false` değil.
 */

import type { TriggerObservation, VerdictDetail } from './records.js'

export interface TriggerExpectation {
  /** Hedef skill tetiklenmeli mi. Belirtilmemişse iddia yok. */
  triggered?: boolean | undefined
  /** Tetiklenmemesi gereken diğer skill'ler (coexistence). */
  notTriggered?: readonly string[] | undefined
  /**
   * İlk tetiklenmesi gereken skill'ler; biri yeter. `[]` = hiçbir skill
   * tetiklenmemeli (`winner: none`). `expectedWinnerOf` ile normalize edilmiş
   * değer (0.4.0).
   */
  winner?: readonly string[] | undefined
}

/**
 * Vakanın tetiklenme iddiasını gözleme karşı sınar.
 *
 * Vaka tetiklenme hakkında hiçbir iddiada bulunmuyorsa `null` döner — bu bir
 * sonuç değil, sonucun konu dışı olduğunun ifadesidir. Çağıran, `null` için
 * kayda tetiklenme satırı yazmaz.
 */
export function evaluateTrigger(
  observation: TriggerObservation,
  expectation: TriggerExpectation,
): VerdictDetail | null {
  const wantsTriggered = expectation.triggered !== undefined
  const notTriggered = expectation.notTriggered ?? []
  const winner = expectation.winner
  if (!wantsTriggered && notTriggered.length === 0 && winner === undefined) return null

  if (!observation.available) {
    return {
      verdict: 'unknown',
      reason: `the trigger signal could not be read: ${observation.reason}`,
    }
  }

  /*
   * 0.2.0 öncesi kayıt: aktivasyon doğrulanmadı. Gözlenen "tetiklenme"
   * reddedilmiş bir seçim olabilir (0.2.0-d'de bir pilotta dördün dördü
   * öyleydi), yani seçilmiş bir skill üzerine kurulan her iddia ölçülmemiş.
   * Hiçbir skill seçilmediyse ise gözlem tam: reddedilecek bir çağrı yoktu.
   */
  if (observation.refused === undefined && observation.skills.length > 0) {
    return {
      verdict: 'unknown',
      reason: `the record predates 0.2.0, which began confirming that a selected skill actually loaded; ${observation.skills.join(', ')} was selected, but whether it activated was never checked`,
      detail: { observedSkills: observation.skills, via: observation.via },
    }
  }
  const refusals = observation.refusals ?? []

  const problems: string[] = []
  const unmeasurable: string[] = []

  /*
   * Reddedilen aktivasyon "tetiklenmedi" DEĞİLDİR.
   *
   * Model skill'i seçti; host gövdesini enjekte etmedi. Bunu `triggered:
   * false` sayıp pozitif vakayı `fail` yapmak kullanıcıyı skill'i tamir
   * etmeye gönderir, oysa kırık olan izin modudur. Negatif vakayı `pass`
   * saymak ise doğrudan sessiz geçiştir: skill aslında seçilmişti.
   *
   * İki yön de yanlış olduğu için sonuç `unknown` — ölçüm yapılmadı.
   */
  const targetUnmeasurable = observation.refused && !observation.triggered
  if (targetUnmeasurable && wantsTriggered) {
    const why = refusals.map((r) => r.reason)
    unmeasurable.push(
      `the skill was selected but its activation was not confirmed, so whether it triggers could not be measured${
        why.length === 0 ? '' : ` (${[...new Set(why)].join('; ')})`
      }`,
    )
  }

  if (wantsTriggered && !targetUnmeasurable && observation.triggered !== expectation.triggered) {
    problems.push(
      expectation.triggered === true
        ? `the skill did not trigger, but this case expects it to (observed via ${observation.via})`
        : `the skill triggered, but this case expects it not to (observed via ${observation.via})`,
    )
  }

  if (notTriggered.length > 0) {
    if (!observation.complete) {
      unmeasurable.push(
        `the host reports only the target skill, not the full set of triggered skills, so "${notTriggered.join(', ')} must not trigger" cannot be checked`,
      )
    } else {
      const offenders = notTriggered.filter((skill) => observation.skills.includes(skill))
      if (offenders.length > 0) {
        problems.push(`${offenders.join(', ')} triggered but should not have`)
      }
      // Seçilmiş ama aktive olmamış bir komşu skill de ölçülemez: "tetiklenmedi"
      // demek, modelin ona uzandığını gizlemek olurdu.
      const refusedNames = refusals.map((r) => r.skill)
      const unresolved = notTriggered.filter(
        (skill) => !observation.skills.includes(skill) && refusedNames.includes(skill),
      )
      if (unresolved.length > 0) {
        unmeasurable.push(
          `${unresolved.join(', ')} was selected but its activation was not confirmed, so "must not trigger" cannot be checked`,
        )
      }
    }
  }

  /*
   * Çakışma: kazanan = ilk doğrulanmış aktivasyon (0.4.0).
   *
   * `skills` aktivasyon sırasında (adaptör sözleşmesi, records.ts); ilk eleman
   * ilk tetiklenen. Beklenen skill hiç tetiklenmediyse bu `fail`: sinyal okundu,
   * liste tam, ölçüm yapıldı. `unknown` yalnızca gerçekten ölçemediğimizde —
   * aksi hâlde "7/13 skill hiç tetiklenmedi" bulgusu exit 3'ün arkasına saklanır
   * (decisions.md, 2026-09-10).
   *
   * Tavan: reddedilen çağrılarla doğrulanmış aktivasyonlar arasındaki sıra
   * gözlemde yok; "kazanandan önce reddedilmiş başka bir seçim" görünmez.
   */
  let winnerPass: string | undefined
  if (winner !== undefined) {
    const first = observation.skills[0]
    const refusedNames = refusals.map((r) => r.skill)
    if (!observation.complete) {
      unmeasurable.push(
        'the host reports only the target skill, not the full set of triggered skills, so which skill fired first cannot be checked',
      )
    } else if (winner.length === 0) {
      if (first !== undefined) {
        problems.push(
          `${first} triggered, but this case expects no skill to trigger (observed via ${observation.via})`,
        )
      } else if (refusedNames.length > 0) {
        unmeasurable.push(
          `${[...new Set(refusedNames)].join(', ')} was selected but its activation was not confirmed, so whether no skill triggers cannot be checked`,
        )
      } else {
        winnerPass = 'no skill triggered, as expected'
      }
    } else if (first !== undefined && winner.includes(first)) {
      winnerPass = `${first} triggered first, as expected`
    } else if (winner.some((skill) => refusedNames.includes(skill))) {
      unmeasurable.push(
        `${winner.filter((skill) => refusedNames.includes(skill)).join(', ')} was selected but its activation was not confirmed, so which skill wins cannot be measured`,
      )
    } else if (first === undefined && refusedNames.length > 0) {
      unmeasurable.push(
        `${[...new Set(refusedNames)].join(', ')} was selected but its activation was not confirmed, so which skill wins cannot be measured`,
      )
    } else if (first === undefined) {
      problems.push(
        `no skill triggered, but this case expects ${winner.join(' or ')} to win (observed via ${observation.via})`,
      )
    } else {
      problems.push(
        `${first} triggered first, but this case expects ${winner.join(' or ')} to win (observed via ${observation.via})`,
      )
    }
  }

  // Kesin bir başarısızlık, ölçülemeyen bir parçadan önce gelir: fail > unknown.
  if (problems.length > 0) {
    return {
      verdict: 'fail',
      reason: problems.join('; '),
      detail: { observedSkills: observation.skills, via: observation.via },
    }
  }

  if (unmeasurable.length > 0) {
    return {
      verdict: 'unknown',
      reason: unmeasurable.join('; '),
      detail: {
        via: observation.via,
        observedSkills: observation.skills,
        ...(refusals.length === 0 ? {} : { refusals }),
      },
    }
  }

  // Eski vakalar için cümle birebir aynı; kazanan iddiası varsa o da eklenir.
  const parts = [
    ...(wantsTriggered
      ? [`the skill ${observation.triggered ? 'triggered' : 'did not trigger'}, as expected`]
      : []),
    ...(winnerPass === undefined ? [] : [winnerPass]),
    ...(!wantsTriggered && winnerPass === undefined
      ? [`none of ${notTriggered.join(', ')} triggered, as expected`]
      : []),
  ]
  return {
    verdict: 'pass',
    reason: `${parts.join('; ')} (via ${observation.via})`,
    detail: { observedSkills: observation.skills, via: observation.via },
  }
}
