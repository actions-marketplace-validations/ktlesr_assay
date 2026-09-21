import { comparePins, type Run } from '@ktlsr/assay-core'

/**
 * "vs previous" bağlantısının hedefi.
 *
 * Bağlantı yalnızca gerçekten karşılaştırılabilecek bir koşuma gitmeli;
 * pinleri uyuşmayan bir çifte götürmek ziyaretçiye "Not comparable" gösterip
 * bırakmaktı. Karar `/compare`'ın kullandığı `comparePins`le veriliyor, yani
 * bağlantı ile sayfa ayrışamaz.
 *
 * - `comparable`: pinleri uyuşan en yakın önceki koşum. `adjacent` false ise
 *   aradaki koşum(lar) başka koşullarda ölçülmüş ve atlanmış.
 * - `differs`: önceki koşum var ama hiçbiri aynı koşullarda değil. Bağlantı
 *   hemen önceki koşuma, neyin değiştiğini göstermek için gidiyor.
 * - `null`: önceki koşum yok.
 */
export type Baseline =
  | { kind: 'comparable'; slug: string; startedAt: string; adjacent: boolean }
  | { kind: 'differs'; slug: string }
  | null

/** `older`: bu koşumdan eski koşumlar, yeniden eskiye. */
export function baselineFor(
  run: Run,
  older: readonly { slug: string; run: Run }[],
): Baseline {
  const index = older.findIndex((item) => comparePins(item.run.pins, run.pins).comparable)
  const match = older[index]
  if (match !== undefined) {
    return {
      kind: 'comparable',
      slug: match.slug,
      startedAt: match.run.startedAt,
      adjacent: index === 0,
    }
  }
  const previous = older[0]
  return previous === undefined ? null : { kind: 'differs', slug: previous.slug }
}
