'use client'

import type { ReactNode } from 'react'
import { IconAlert, IconFail, IconInfo, IconPass, IconUnknown } from './icons'
import { countSentence, intervalGloss, pct, type Measurement } from './format'

export type { Measurement }

/**
 * Ölçüm bileşenleri.
 *
 * İki iş yapıyorlar.
 *
 * Birincisi bir kısıtı **tip seviyesinde** zorlamak: bir oran, gözlem sayısı ve
 * güven aralığı olmadan render edilemez. `Measurement` üçünü birlikte taşır ve
 * bileşenler yalnızca bu tipi kabul eder — çıplak bir `number` geçirmenin yolu
 * yok.
 *
 * İkincisi anlaşılır olmak. Bir oran burada üç kayıtta birden okunuyor ve sırası
 * bilerek şu:
 *   1. sayım, düz cümleyle — "20 denemenin 14'ünde"
 *   2. yüzde, büyük ve tabular
 *   3. aralık, çizilmiş, uçlarındaki sayılarla
 * İstatistik bilmeyen okuyucu birinci satırda cevabı alıyor; bilen üçüncüde
 * belirsizliğin genişliğini görüyor. Hiçbiri diğerinin yerine geçmiyor.
 *
 * `@ktlsr/assay-core`'daki `Proportion` bu tipe yapısal olarak uyar; paket bilerek
 * hiçbir Assay paketine bağlanmıyor (docs/stack.md), uyum
 * `tools/ui-contract.test.ts` ile denetleniyor.
 */

export type VerdictKind = 'pass' | 'fail' | 'unknown'

// ---------------------------------------------------------------------------
// Verdict işareti — renk tek taşıyıcı değil
// ---------------------------------------------------------------------------

const VERDICT: Record<
  VerdictKind,
  { Glyph: typeof IconPass; label: string; tone: string }
> = {
  pass: { Glyph: IconPass, label: 'pass', tone: 'text-pass' },
  fail: { Glyph: IconFail, label: 'fail', tone: 'text-fail' },
  unknown: { Glyph: IconUnknown, label: 'unknown', tone: 'text-unknown' },
}

/**
 * Verdict rozeti.
 *
 * Dolgu yok, zemin yok: çizilmiş işaret + küçük kapital sözcük. Aynı çemberin
 * içi üç farklı biçimde dolu, yani renk körlüğünde de ayrışıyor.
 */
export function Badge({
  verdict,
  showLabel = true,
  size = 14,
}: {
  verdict: VerdictKind
  showLabel?: boolean
  size?: number
}) {
  const mark = VERDICT[verdict]
  return (
    <span className={`mark ${mark.tone}`}>
      <mark.Glyph size={size} />
      {showLabel ? (
        <span>{mark.label}</span>
      ) : (
        <span className="sr-only">{mark.label}</span>
      )}
    </span>
  )
}

/**
 * Yalnızca yüzde — ama `Measurement` isteyerek.
 *
 * Yoğun satırlarda sayı sütununda tek başına yüzde duruyor; N ve aralık aynı
 * satırın diğer sütunlarında (`countSentence` ve `IntervalRule`). Bileşen
 * çıplak bir `number` kabul etmiyor: oranı N'den ve aralığından koparıp
 * biçimlendirmenin yolu yok, çünkü tek girdi üçünü birlikte taşıyan tip.
 */
export function RateFigure({ value }: { value: Measurement }) {
  return <>{value.rate === null ? '—' : pct(value.rate)}</>
}

// ---------------------------------------------------------------------------
// Aralık çizimi — bu arayüzün imzası
// ---------------------------------------------------------------------------

const clamp = (value: number) => Math.min(100, Math.max(0, value))

/**
 * İki uç etiketinin ("100%" + boşluk + "100%") kutuya sığdığı en küçük genişlik.
 * `.interval-bounds` mono yazı tipinde, yani `ch` bir karakter.
 */
const BOUNDS_WIDTH = '9ch'

/**
 * Güven aralığı — çizilmiş bir açıklık.
 *
 * İlerleme çubuğu değil: uçlarında serif olan bir aralık ve içinde ölçülen
 * değeri gösteren bir işaret. Yüklenirken **ölçülen noktadan dışa doğru**
 * açılıyor — bir aletin ibresinin yerine oturması gibi. Tek yazılı hareket bu.
 *
 * Gözlem yoksa yalnızca boş eksen çizilir; bir değer çizmek yalan olurdu.
 */
export function IntervalRule({
  value,
  tone = 'text-text-muted',
  delayMs = 0,
  showBounds = false,
}: {
  value: Measurement
  tone?: string
  /** Grup içinde sıraya göre küçük gecikme. Toplam gecikme sınırlı tutulur. */
  delayMs?: number
  /** Uç değerleri aralığın altında yaz. Yoğun listelerde kapalı. */
  showBounds?: boolean
}) {
  if (value.rate === null || value.ci === null) {
    return (
      <div className="interval" aria-hidden="true">
        <span className="interval-empty">not measured</span>
      </div>
    )
  }

  const low = clamp(value.ci.low * 100)
  const high = clamp(value.ci.high * 100)
  const width = Math.max(high - low, 0.8)
  const point = clamp(value.rate * 100)
  // İşaretin aralık içindeki göreli yeri: açılma buradan başlıyor.
  const origin = clamp(((point - low) / width) * 100)

  return (
    <div className={`interval ${tone}`}>
      <span
        className="interval-span"
        style={{
          left: `${low}%`,
          width: `${width}%`,
          ['--from-left' as string]: `${origin}%`,
          ['--from-right' as string]: `${100 - origin}%`,
          animationDelay: `${delayMs}ms`,
        }}
        aria-hidden="true"
      />
      <span
        className="interval-point"
        style={{ left: `${point}%`, animationDelay: `${delayMs + 90}ms` }}
        aria-hidden="true"
      />
      {showBounds ? (
        /*
         * Uç değerler aralığın UÇLARINDA duruyor (DESIGN.md: "aralık,
         * çizilmiş, uçlarındaki sayılarla") — ama bir flex satırı içinde.
         *
         * Önce ikisi ayrı ayrı `left: low%` ve `left: high%` ile
         * konumlanıyordu ve aralık daraldığında üst üste biniyorlardı. Sonra
         * tek etikete birleştirildi ve bu sefer uçları etiketlemekten
         * vazgeçilmiş oldu. Flex ikisini birden veriyor: kutular ASLA üst üste
         * binmez, iterler. Aralık genişken uçlara yaslanıyorlar.
         *
         * Daraldığında taşma iki yana eşit değil, SAĞA gidiyordu
         * (`space-between` sığmayan içeriği sona iter). Sağ uca yakın dar bir
         * aralıkta (%91–100) "100%" çizginin ve 375px'te sayfanın dışına
         * çıkıyordu (0.4.1-j). Kutu artık en az iki etiket genişliğinde ve sağ
         * kenarı çizginin sonunu geçmiyor: dar aralıkta etiketler sağa
         * yaslanıyor, ölçü birimi kutunun kendi mono yazı tipinin `ch`'si.
         */
        <span
          className="interval-bounds"
          style={{
            left: `min(${low}%, calc(100% - ${BOUNDS_WIDTH}))`,
            width: `max(${width}%, ${BOUNDS_WIDTH})`,
          }}
          aria-hidden="true"
        >
          <span className="interval-bound">{pct(value.ci.low)}</span>
          <span className="interval-bound">{pct(value.ci.high)}</span>
        </span>
      ) : null}
    </div>
  )
}

/**
 * Etiketli ölçüm satırı — yoğun listeler için.
 *
 * Bileşen aralığı sayıdan önce çizer: okuyucu belirsizliğin genişliğini sayıyı
 * okumadan görsün.
 */
export function MetricValue({
  label,
  value,
  tone,
  delayMs = 0,
}: {
  label: string
  value: Measurement
  tone?: string
  delayMs?: number
}) {
  return (
    <div className="metric-row">
      <span className="col-label">{label}</span>
      <IntervalRule
        value={value}
        delayMs={delayMs}
        {...(tone === undefined ? {} : { tone })}
      />
      <span className="metric-figure">
        {value.rate === null ? (
          <span className="text-unknown">not measured</span>
        ) : (
          <>
            <span className="metric-pct">{pct(value.rate)}</span>
            <span className="metric-detail">
              {value.successes}/{value.n}
            </span>
          </>
        )}
      </span>
    </div>
  )
}

/**
 * Ölçümün tam gösterimi — bir ekranda bir ya da iki tane.
 *
 * Sayım cümlesi, büyük yüzde, çizilmiş aralık ve aralığın ne dediği. Yüzdeyi
 * tek başına gösteren bir panel, N=3 ile N=300'ü aynı gösterir; bu blok
 * gösteremez.
 */
export function MeasurementBlock({
  label,
  value,
  verb = 'held',
  tone,
  delayMs = 0,
  empty,
}: {
  label: string
  value: Measurement
  /** Sayım cümlesindeki fiil: "fired", "held", "passed". */
  verb?: string
  tone?: string
  delayMs?: number
  /**
   * Payda sıfırken ne söyleneceği (0.4.1-l). Verilmezse sebep "okunabilir
   * sinyal yok" sayılır. Ama payda başka sebeple de sıfır olabilir: hedef skill
   * hiç tetiklenmediyse kesinliğin paydası tanım gereği boş, sinyal okundu.
   * Sebebi bilen çağıran; bileşen tahmin etmez.
   */
  empty?: { count: string; reason: string }
}) {
  const gloss = intervalGloss(value)
  const unmeasured = value.n === 0 && empty !== undefined ? empty : undefined
  return (
    <section className="measure-block">
      <p className="col-label">{label}</p>
      <p className="measure-count">{unmeasured?.count ?? countSentence(value, verb)}</p>
      <div className="measure-figure">
        <span className="measure-pct">{value.rate === null ? '—' : pct(value.rate)}</span>
        <div className="measure-instrument">
          <IntervalRule
            value={value}
            delayMs={delayMs}
            showBounds
            {...(tone === undefined ? {} : { tone })}
          />
        </div>
      </div>
      {gloss === null ? (
        <p className="measure-gloss text-unknown">
          {unmeasured?.reason ??
            'No attempt produced a readable signal, so there is no rate to show.'}
        </p>
      ) : (
        <p className="measure-gloss">
          95% confidence between {pct(value.ci?.low ?? 0)} and {pct(value.ci?.high ?? 0)}.{' '}
          {gloss}
        </p>
      )}
    </section>
  )
}

/**
 * Sertifikanın hüküm satırı.
 *
 * Ekranın en büyük öğesi ve ilk okunan şey: işaret, sözcük ve **düz bir
 * cümle**. Bir kullanıcının bu sayfadan tek bir şey anlaması gerekiyorsa o
 * şey burada yazıyor.
 */
/**
 * Ad, ayırıcılarından kırılabilir biçimde (0.4.1-k).
 *
 * Skill adları `plugin:skill` biçiminde ve içlerinde başka kırılma fırsatı yok;
 * başlıktaki `overflow-wrap: anywhere` 375px'te `hallmark:hallmar` / `k` diye
 * kelimenin ortasından bölüyordu. `:` ve `/`'den sonra bir `<wbr>` tarayıcıya
 * doğru yeri gösteriyor; `anywhere` yalnızca tek başına sığmayan bir parça
 * için son çare olarak kalıyor.
 */
export function BreakableName({ name }: { name: string }) {
  const parts = name.split(/(?<=[:/])/)
  return (
    <>
      {parts.map((part, index) => (
        <span key={index}>
          {index > 0 ? <wbr /> : null}
          {part}
        </span>
      ))}
    </>
  )
}

export function Determination({
  verdict,
  subject,
  sentence,
  meta,
}: {
  verdict: VerdictKind
  subject: string
  sentence: string
  meta?: ReactNode
}) {
  const mark = VERDICT[verdict]
  return (
    <section className={`determination ${mark.tone}`}>
      <mark.Glyph size={34} className="determination-mark" />
      <div className="determination-body">
        <p className="determination-word">{mark.label}</p>
        <h1 className="determination-subject">
          <BreakableName name={subject} />
        </h1>
        <p className="determination-sentence">{sentence}</p>
        {meta === undefined ? null : <div className="determination-meta">{meta}</div>}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Boş ve hata durumları
// ---------------------------------------------------------------------------

/**
 * Veri yokken uydurma veri değil, yönlendirici boş durum.
 *
 * `action` bir sonraki adımı söyler; "henüz veri yok" tek başına kullanıcıyı
 * bir yere götürmez.
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="state-panel">
      <p className="state-title">{title}</p>
      <p className="state-detail">{description}</p>
      {action === undefined ? null : <div className="state-action">{action}</div>}
    </div>
  )
}

/**
 * Hata durumu.
 *
 * Mesaj özür dilemez ve belirsiz olmaz: ne olduğunu ve ne yapılabileceğini
 * söyler.
 */
export function ErrorState({
  title,
  detail,
  action,
}: {
  title: string
  detail: string
  action?: ReactNode
}) {
  return (
    <div className="state-panel state-panel-error">
      <p className="mark text-fail">
        <IconAlert size={14} />
        <span>{title}</span>
      </p>
      <p className="state-detail state-detail-left">{detail}</p>
      {action === undefined ? null : <div className="state-action">{action}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Kenar notu
// ---------------------------------------------------------------------------

const CALLOUT = {
  info: { tone: 'text-text-muted', Glyph: IconInfo },
  warning: { tone: 'text-unknown', Glyph: IconUnknown },
  danger: { tone: 'text-fail', Glyph: IconAlert },
} as const

export type CalloutTone = keyof typeof CALLOUT

/**
 * Kenar notu — info, warning, danger.
 *
 * Renkli kalın bir sol kenar çubuğu yok: basılı bir belgenin kenar notu gibi,
 * üstünde ince bir çizgi ve sol boşlukta bir işaret. Renk yalnızca işarette;
 * metin her zaman okunabilir mürekkeple.
 */
export function Callout({
  tone = 'info',
  title,
  children,
}: {
  tone?: CalloutTone
  title: string
  children?: ReactNode
}) {
  const style = CALLOUT[tone]
  return (
    <div className="note" role={tone === 'info' ? undefined : 'note'}>
      <span className={`note-mark ${style.tone}`}>
        <style.Glyph size={14} />
      </span>
      <div className="note-body">
        <p className={`mark ${style.tone}`}>{title}</p>
        {children === undefined ? null : <div className="note-text">{children}</div>}
      </div>
    </div>
  )
}
