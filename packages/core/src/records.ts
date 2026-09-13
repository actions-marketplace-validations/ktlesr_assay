/**
 * Kanonik koşum kayıtları.
 *
 * Bunlar hem Faz 1'in dosya store'unun hem de Faz 2'nin Postgres şemasının tek
 * doğruluk kaynağıdır; Prisma modelleri bu tiplerden türetilecek. Bugün doğru
 * tanımlamak, iki kalıcılık hedefinin ayrışmasını engeller (docs/stack.md).
 *
 * core I/O yapmaz: buradaki hiçbir tip dosya sistemine veya ağa dokunmaz.
 * Kanıtı runner toplar, core değerlendirir.
 */

import type { Assertion } from './suite.js'

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------

/**
 * Değişmez #1: verdict üç durumludur. Sinyal alınamadıysa `unknown` — sessiz
 * `pass` yasak.
 */
export type Verdict = 'pass' | 'fail' | 'unknown'

/** `unknown` bir hata kovası değil, birinci sınıf sonuç. Her zaman gerekçe taşır. */
export interface VerdictDetail {
  verdict: Verdict
  /** Neden bu sonuç. `unknown` için hangi sinyalin eksik olduğu. */
  reason: string
  /** Makine tarafından okunabilir ek kanıt; raporda gösterilir. */
  detail?: Readonly<Record<string, unknown>>
}

// ---------------------------------------------------------------------------
// Pin'ler — değişmez #2
// ---------------------------------------------------------------------------

/**
 * Dört pin. Biri eksik veya kaymışsa iki koşum karşılaştırılamaz.
 * `suiteHash` beyan edilen `suiteVersion`'ın unutulduğu durumu yakalar; runner
 * suite kaynağından hesaplar.
 */
export interface Pins {
  /** Pin 1 — beyan edilen skill sürümü. `owner/repo@<sha>` veya etiket. */
  skillSource: string
  /**
   * Pin 1'in denetçisi — skill dizininin içerik hash'i.
   *
   * `skillSource` insanın beyanı; unutulur, güncellenmez. Bu hash gerçeği
   * taşır: skill dosyası değişip beyan değişmezse karşılaştırma yine de
   * durur. `suiteVersion`/`suiteHash` çiftiyle aynı mantık.
   * Runner hesaplayamadıysa boş kalır ve karşılaştırma `unknown` üretir.
   */
  skillHash: string
  /** Pin 2 — tam model kimliği. */
  model: string
  /** Pin 3 — host sistem promptunun hash'i. */
  systemPromptHash: string
  /** Pin 4 — beyan edilen vaka seti sürümü. */
  suiteVersion: number
  /** Pin 4'ün denetçisi — suite kaynağının içerik hash'i. */
  suiteHash: string
  /**
   * Pin 3'ün denetçisi — host'un bildirdiği ortamdan türetilen hash.
   *
   * Sistem promptu hash'i DEĞİLDİR ve öyle etiketlenmez (docs/decisions.md).
   * Ama pin 3'ün ölçülemediği bir hostta kaymayı yakalayan tek şey bu:
   * model, araç listesi, skill listesi ve output style değişirse hash değişir.
   * Adaptör veremediyse alan hiç yok.
   */
  environmentHash?: string
}

/**
 * Bilgi taşımayan pin değerleri.
 *
 * Host bir pini vermediğinde alan boş kalmıyor, bir yer tutucu taşıyor. İki
 * koşumda da aynı yer tutucu bulunuyor ve saf bir eşitlik kontrolü bunu
 * "tuttu" sayıyordu — yani ölçülmemiş bir koşulu ölçülmüş gibi raporluyordu.
 * Değişmez #1'in yasakladığı şeyin pin tarafındaki karşılığı.
 */
const UNAVAILABLE_PIN_VALUES = new Set(['', 'not-provided-by-host', 'unknown', 'n/a'])

const isUnavailable = (value: string | number | undefined): boolean =>
  value === undefined ||
  (typeof value === 'string' && UNAVAILABLE_PIN_VALUES.has(value.trim().toLowerCase()))

/** İki koşumun karşılaştırılabilir olup olmadığı. */
export interface PinComparison {
  comparable: boolean
  /** Kayan pin adları. Boş değilse karşılaştırma `unknown` üretir. */
  drifted: readonly (keyof Pins)[]
  /**
   * Ölçülemeyen pin adları — "tuttu" da değil, "kaydı" da değil.
   *
   * Bir denetçisi varsa (pin 3 için `environmentHash`) ve o denetçi iki
   * koşumda da dolu ve eşitse pin kapsanmış sayılır ve burada görünmez.
   */
  unavailable: readonly (keyof Pins)[]
}

/**
 * Pinleri karşılaştırır.
 *
 * Üç durum, iki değil: **tuttu**, **kaydı**, **ölçülemedi**. Eskiden ikincisi
 * ve üçüncüsü aynıydı; iki koşumda da `not-provided-by-host` yazan bir pin
 * "tuttu" sayılıyor ve karşılaştırmaya ölçülmemiş bir garanti veriyordu.
 *
 * Ölçülemeyen bir pin karşılaştırmayı durdurur (değişmez #2: "pinlerden biri
 * **eksik** veya farklıysa karşılaştırma yapılmaz"). Tek istisna, o pini
 * kapsayan bir denetçinin iki koşumda da dolu ve eşit olması.
 */
export function comparePins(a: Pins, b: Pins): PinComparison {
  const keys: (keyof Pins)[] = [
    'skillSource',
    'skillHash',
    'model',
    'systemPromptHash',
    'suiteVersion',
    'suiteHash',
  ]

  /*
   * Denetçinin bulgusu denetçinin adıyla raporlanır (0.3.0-a).
   *
   * `environmentHash` pin 3'ün denetçisi: host sistem promptu hash'ini
   * vermediğinde koşulların kaymadığını gösterebilen tek şey o. Ama bulgusu
   * eskiden pin 3'ün adına yazılıyordu ve rapor "systemPromptHash changed"
   * diyordu — oysa o alan iki kayıtta da `not-provided-by-host` ile duruyor,
   * yani kımıldamadı. Doğru karar (karşılaştırma durur), yanlış adres.
   *
   * Üç durum:
   *  - iki tarafta da dolu ve EŞİT   → pin 3 kapsandı, karşılaştırma açılır
   *  - iki tarafta da dolu ve FARKLI → `environmentHash` kaydı; pin 3 hakkında
   *    bir şey bilmiyoruz ve iddia da etmiyoruz, o yüzden ayrıca anılmaz
   *  - en az biri yok              → denetçi yok; pin 3 ölçülemedi
   */
  const bothEnvironments =
    !isUnavailable(a.environmentHash) && !isUnavailable(b.environmentHash)
  const environmentCovers = bothEnvironments && a.environmentHash === b.environmentHash
  const environmentDrifted = bothEnvironments && a.environmentHash !== b.environmentHash

  const drifted: (keyof Pins)[] = []
  const unavailable: (keyof Pins)[] = []

  for (const key of keys) {
    if (isUnavailable(a[key]) || isUnavailable(b[key])) {
      // Denetçi kaydıysa aynı olayı ikinci kez, üstelik başka bir adla
      // raporlamıyoruz: `environmentHash` zaten aşağıda kayan alan olarak
      // listeleniyor.
      const answered =
        key === 'systemPromptHash' && (environmentCovers || environmentDrifted)
      if (!answered) unavailable.push(key)
      continue
    }
    if (a[key] !== b[key]) drifted.push(key)
  }

  if (environmentDrifted) drifted.push('environmentHash')

  return {
    comparable: drifted.length === 0 && unavailable.length === 0,
    drifted,
    unavailable,
  }
}

// ---------------------------------------------------------------------------
// İz
// ---------------------------------------------------------------------------

export type TraceEventKind =
  | 'tool_call'
  | 'tool_result'
  | 'assistant_message'
  | 'skill_trigger'
  | 'session_end'
  | 'hook'

export type SessionOutcome = 'completed' | 'aborted' | 'error'

/**
 * Host'un koşum sırasında çalıştırdığı bir hook.
 *
 * Hook'lar ölçümün görünmez değişkenidir: bir `SessionStart` hook'u sistem
 * promptuna metin enjekte edebilir, bir `PreToolUse` hook'u araç çağrısını
 * reddedebilir. İkisi de skill'in davranışını değiştirir ve hiçbiri skill'in
 * kendisi değildir. Kayıtta durmazlarsa iki koşum arasındaki fark
 * açıklanamaz kalır.
 */
export interface HookRecord {
  /** Host'un verdiği hook adı, ör. `SessionStart:startup`. */
  name: string
  /** Hangi olayda koştu, ör. `SessionStart`. */
  event: string
  /** Başlangıç mı yanıt mı. */
  phase: 'started' | 'response'
  exitCode?: number
  /** Host'un bildirdiği sonuç, ör. `success`, `cancelled`. */
  outcome?: string
  stdout?: string
  stderr?: string
}

/**
 * Host'tan okunan tek bir olay. Adaptörler ham transkripti buna normalize eder;
 * assertion motoru yalnızca bu tipi bilir.
 */
export interface TraceEvent {
  /** Olay sırası. Adaptör atar, monoton artar. */
  seq: number
  kind: TraceEventKind
  /** `tool_call` için host'un verdiği çağrı kimliği. */
  id?: string
  /** `tool_result` için hangi çağrının sonucu olduğu. */
  callId?: string
  /** ISO 8601. Host vermiyorsa yok. */
  at?: string
  /** `tool_call` / `tool_result` için araç adı. */
  tool?: string
  /** `tool_call` argümanları. */
  args?: Readonly<Record<string, unknown>>
  /** `tool_result` başarısız mı. */
  isError?: boolean
  /** Hata metni, varsa. */
  error?: string
  /** `assistant_message` metni. */
  text?: string
  /**
   * Host, bu mesajın bir hatayı açıkça bildirdiğini söyleyebiliyorsa burada
   * belirtir. Verildiğinde no_swallowed_errors sezgiselinin önüne geçer.
   */
  acknowledgesError?: boolean
  /** `skill_trigger` için tetiklenen skill. */
  skill?: string
  /** `session_end` için oturumun nasıl bittiği. */
  outcome?: SessionOutcome
  /**
   * Çağrı yapılmadı çünkü izin katmanı reddetti — ve neden.
   *
   * "Skill bunu yapamadı" ile "Assay buna izin vermedi" iki farklı ölçümdür;
   * ikisi de araç çağrısının düşmesiyle sonuçlanır ve izde aynı görünürlerse
   * ayırt edilemezler. Bu alan reddi adıyla söyler.
   */
  refusal?: string
  /** `hook` için host'un çalıştırdığı hook. */
  hook?: HookRecord
}

// ---------------------------------------------------------------------------
// Tetiklenme sinyali
// ---------------------------------------------------------------------------

/**
 * Aktivasyonu istenmiş ama doğrulanamamış bir skill çağrısı.
 *
 * Model skill'i seçti — bu gözlendi. Ama gövdesi oturuma girmedi: izin
 * katmanı reddetti, host hata döndürdü, ya da çağrının sonucu hiç gelmedi.
 * Bu ne tetiklenmedir ne de tetiklenmemedir; ölçüm yapılmamıştır.
 */
export interface RefusedActivation {
  /** Host'un bildirdiği skill adı. */
  skill: string
  /** Neden aktivasyon sayılmadı. Kullanıcıya gösterilir. */
  reason: string
}

/**
 * Tetiklenme okunamadıysa bu tip "bilinmiyor"u görmezden gelinemez kılar:
 * `triggered` alanına `available: true` olmadan erişilemez.
 */
export type TriggerObservation =
  | {
      available: true
      /**
       * Hedef skill **aktive oldu** mu.
       *
       * Çağrının gözlenmesi yetmez: gövdesi oturuma enjekte edilmediyse
       * skill koşmamıştır. Reddedilmiş bir çağrıyı tetiklenme saymak, ürünün
       * ölçtüğünü iddia ettiği tek şeyi sahte kılar.
       */
      triggered: boolean
      /**
       * Bu koşumda aktive olduğu gözlenen skill'ler, **ilk aktivasyon
       * sırasında** ve tekrarsız: ilk eleman ilk tetiklenen skill.
       *
       * Sıra bir sözleşme (0.4.0): çakışma değerlendirmesi kazananı `skills[0]`
       * olarak okuyor ve matrisin sütunları da ondan geliyor. Adaptör bu sırayı
       * korumak zorunda; Claude Code adaptörü akıştaki çağrı sırasını koruyor
       * (adapter.test.ts, stream.test.ts).
       */
      skills: readonly string[]
      /**
       * Hedef skill seçildi ama aktivasyonu doğrulanamadı ve hiç aktive
       * olmadı. `true` iken tetiklenme iddiası `unknown` üretir — ne pass ne
       * fail (değişmez #1).
       *
       * Yoksa kayıt 0.2.0'dan önce yazılmış: o sürüm aktivasyonu doğrulamıyor,
       * seçilen her skill'i tetiklenmiş sayıyordu (0.2.0-d). Eksik alan "red
       * yok" diye okunamaz — kontrol hiç yapılmadı (`activationUnverified`).
       */
      refused?: boolean
      /** Aktivasyonu doğrulanamayan her çağrı, sebebiyle. `refused` ile birlikte yok olur. */
      refusals?: readonly RefusedActivation[]
      /**
       * `skills` tetiklenen skill'lerin *tamamı* mı, yoksa yalnızca hedef mi?
       * `false` ise "şu skill tetiklenmedi" iddiası doğrulanamaz ve `unknown`
       * üretilir — coexistence ölçümü ancak tam liste ile anlamlıdır.
       */
      complete: boolean
      /** Sinyalin hangi mekanizmadan okunduğu. Raporda gösterilir. */
      via: string
    }
  | { available: false; reason: string }

// ---------------------------------------------------------------------------
// Yan etkiler
// ---------------------------------------------------------------------------

export interface NetworkRequest {
  host: string
  method?: string
  /** Sandbox isteği engelledi mi. */
  blocked: boolean
}

/** Sandbox'ın gözlemlediği ortam değişimi. */
export interface EnvDiff {
  writes: readonly string[]
  deletes: readonly string[]
  network: readonly NetworkRequest[]
  /**
   * Yan etkisi gözlenemeyen araç çağrıları (kabuk komutları gibi).
   *
   * Boş değilse `writes` ve `network` listeleri **eksik olabilir** ve yan etki
   * iddiaları ölçülemez sayılır. Boş bir liste "yan etki yok" demek değil,
   * "göremediğimiz bir yol kullanılmadı" demektir.
   */
  unobserved?: readonly string[]
}

// ---------------------------------------------------------------------------
// Kanıt — assertion motorunun tek girdisi
// ---------------------------------------------------------------------------

export interface CapturedFile {
  path: string
  bytes: Uint8Array
}

/**
 * Koşumdan toplanan kanıt. Her alan opsiyonel: toplanamamış olabilir.
 *
 * Değişmez #1'in tip seviyesinde zorlanması buradan gelir — bir assertion'ın
 * değerlendiricisi yalnızca ihtiyaç duyduğu alanlar *mevcutken* çağrılır
 * (bkz. assertions.ts). Eksik kanıt değerlendiriciye hiç ulaşmaz, dolayısıyla
 * veri yokluğunda `pass` üretmek yapısal olarak imkânsızdır.
 */
export interface Evidence {
  files?: readonly CapturedFile[]
  trace?: readonly TraceEvent[]
  exitCode?: number
  env?: EnvDiff
}

// ---------------------------------------------------------------------------
// Sonuç kayıtları
// ---------------------------------------------------------------------------

export interface AssertionResult extends VerdictDetail {
  assertion: Assertion
}

export interface Cost {
  inputTokens: number
  outputTokens: number
  /** Host maliyet vermiyorsa yok. Uydurulmaz. */
  usd?: number
}

/** Tek bir tekrar. `runs: 10` → vaka başına 10 Attempt. */
export interface Attempt {
  /** 0'dan başlayan tekrar sırası. */
  index: number
  caseId: string
  startedAt: string
  finishedAt: string
  /** Host'tan okunan ham gözlem: tetiklendi mi, liste tam mı. */
  trigger: TriggerObservation
  /**
   * Gözlemin vakanın beklentisiyle karşılaştırılması.
   *
   * `trigger` ne olduğunu söylüyor; bu alan beklenenin olup olmadığını.
   * Vaka `expect.triggered` ya da `expect.not_triggered` beyan etmiyorsa yok.
   *
   * Kendi alanında duruyor, `assertions` içinde değil: `assertions` vaka
   * setinde BEYAN EDİLEN assertion'ların sonucu ve her biri `Assertion`
   * birleşiminden bir tip taşıyor. Tetiklenme kontrolü öyle bir tip değil;
   * listeye sentetik bir üye eklemek, `assertion.type` üzerinden dallanan
   * her tüketiciyi kırardı ve kayıt artık suite'i yansıtmazdı.
   */
  triggerCheck?: VerdictDetail
  /** Vaka setinde beyan edilen assertion'ların sonucu. */
  assertions: readonly AssertionResult[]
  /**
   * Beyan edilmiş ama **bu modda değerlendirilmemiş** assertion'lar.
   *
   * Hızlı mod yalnızca tetiklenme katmanını ölçüyor. Bu assertion'lar
   * `assertions` listesine `unknown` olarak girmiyor: `unknown` "ölçmeye
   * çalıştık, sinyal alamadık" demek ve koşumu ölçülemez ilan ediyor. Burada
   * olan şey başka — hiç bakılmadı, çünkü kullanıcı bakılmamasını istedi.
   * İkisini aynı kovaya koymak, kasıtlı bir kapsam kararını bir ölçüm
   * başarısızlığı gibi gösterirdi.
   *
   * Sonucu olmayan bir iddia bir sonuç listesinde duramaz; o yüzden ayrı alan.
   */
  notEvaluated?: readonly Assertion[]
  /**
   * Attempt'in bileşik sonucu: `triggerCheck` ve `assertions` birlikte.
   *
   * `reason` başarıda kaç KONTROL geçtiğini sayar ve o sayı
   * `assertions.length + (triggerCheck ? 1 : 0)`'a eşittir. Eskiden sayı
   * "assertion" diye adlandırılıyordu ve tetiklenme kontrolünü de içeriyordu;
   * kayıt kendi içinde tutarsızdı — boş bir `assertions` listesinin yanında
   * "all 1 assertion(s) passed" yazıyordu.
   */
  verdict: Verdict
  reason: string
  latencyMs?: number
  cost?: Cost
  trace?: readonly TraceEvent[]
  env?: EnvDiff
}

/** Bir vakanın N tekrarının toplamı. */
export interface CaseResult {
  caseId: string
  /**
   * Vakanın tetiklenme iddiası. Kayıt bunu taşıyor ki rapor ve karşılaştırma
   * suite dosyasına ihtiyaç duymasın — Faz 2'de hosted taraf yalnızca kaydı
   * görecek. İddia yoksa alan da yok.
   */
  expectedTrigger?: boolean
  /**
   * Çakışma vakasının beklenen kazananı (0.4.0): ilk tetiklenmesi kabul edilen
   * skill'ler; birden fazlaysa biri yeter. `[]` = hiçbir skill tetiklenmemeli
   * (`winner: none`). İddia yoksa alan da yok. `expectedTrigger` ile aynı
   * gerekçe: matris suite dosyası olmadan kayıttan kurulabilmeli.
   */
  expectedWinner?: readonly string[]
  attempts: readonly Attempt[]
  /** Değişmez #4: oran asla çıplak gösterilmez, bkz. Proportion. */
  passRate: Proportion
  passed: number
  failed: number
  unknown: number
}

/** Tek bir `assay run` koşumu. */
export interface Run {
  id: string
  startedAt: string
  finishedAt: string
  /** Adaptör kimliği — hangi host ortamı. */
  host: string
  /**
   * Ölçülen skill'in adı (`target.skill`).
   *
   * Pin'lerdeki `skillSource` sürümü taşır, adı değil: `anthropics/skills@abc`
   * hangi skill'in ölçüldüğünü söylemiyor. Kayıt kendi kendine yetsin diye
   * ad ayrıca saklanıyor — rapor ve hosted taraf suite dosyasını görmüyor.
   */
  skill: string
  pins: Pins
  /**
   * Koşumun izin modu — host'un bildirdiği hâliyle.
   *
   * `Pins` değil, ama pinlerin denetçisi olan `environmentHash`'in içinde:
   * mod değişirse hash değişir ve karşılaştırma durur. Burada ayrıca duruyor
   * çünkü bir hash raporda okunmaz, mod okunur.
   *
   * Attempt'ler farklı mod bildirdiyse (mod koşum ortasında kaydıysa) alan
   * yazılmaz.
   */
  permissionMode?: string
  /**
   * `Pins.environmentHash`'in girdisi — host'un bildirdiği ortamın kendisi.
   *
   * Hash "bir şey değişti" diyebiliyor, "ne değişti" diyemiyor. Bileşenler
   * kayıtta durduğunda `compareRuns` kayan alanı adıyla söyleyebiliyor
   * (`permissionMode: acceptEdits → bypassPermissions`). Adaptör bunları hash
   * için zaten üretiyordu ve atıyordu.
   *
   * Opsiyonel: eski kayıtlarda yok ve host bildirmiyorsa yazılmaz. Yokken
   * karşılaştırma hash düzeyinde konuşur.
   */
  environment?: Environment
  /** Suite'te beyan edilen tekrar sayısı. */
  runs: number
  /**
   * Aynı anda koşan deneme sayısı. Varsayılan 1.
   *
   * `environmentHash`e **girmiyor**: host'un bildirdiği ortamın değil koşum
   * düzeninin özelliği ve tetiklenme oranını değiştirmesi beklenmiyor. Ama
   * kayda giriyor, çünkü **gecikme ve maliyet sayıları** eş zamanlı koşumda
   * aynı şeyi ölçmüyor: denemeler CPU'yu, belleği ve host hız sınırını
   * paylaşıyor. Alanı okumadan iki koşumun süresini karşılaştırmak yanlış
   * olur.
   */
  concurrency?: number
  /**
   * Bu koşumda **ölçülen katmanlar**. Alan yoksa hepsi ölçüldü.
   *
   * Hızlı mod yalnızca tetiklenme katmanını koşuyor. O koşumun kaydı, dar bir
   * ölçüm olduğunu kendi içinde söylemek zorunda: yoksa okuyucu artefakt
   * iddialarının sınandığını sanır. Bu bir yarım ölçüm değil, **beyan edilmiş
   * dar bir ölçüm** — ölçmediğini ölçtüm demiyor, ölçmediğini söylüyor.
   */
  layers?: readonly RunLayer[]
  /**
   * Hiç koşulmamış vakalar ve sebepleri.
   *
   * `cases` içinde sıfır denemeli bir vaka **görünmüyor**: "koşulmadı" ile
   * "koşuldu ama karar çıkmadı" iki ayrı şey ve N=0'lık bir satır ikincisi
   * gibi okunurdu. Koşulmayan vaka buraya, sebebiyle yazılıyor.
   */
  skipped?: readonly SkippedCase[]
  cases: readonly CaseResult[]
  verdict: Verdict
  /**
   * Koşum yarım kaldı ve journal'dan toparlandı.
   *
   * Alan varsa kayıt, ölçümün tamamı değil o ana kadar tamamlanmış
   * denemelerdir. Bu bir yalan değil, daha az bilgi: değişmez #4 zaten her
   * oranı N ve aralığıyla gösteriyor, N küçük olduğu için aralık geniş
   * çıkıyor. Ama kaydın kendisi de yarım olduğunu söylemek zorunda — okuyucu
   * `runs: 10` görüp vaka başına 10 deneme sanmamalı.
   */
  partial?: PartialRun
  /**
   * Kaydı üreten Assay sürümü (runner paketinin sürümü; dört paket tek sürümle
   * yayımlanıyor). 0.3.2'de geldi.
   *
   * Verdict'in anlamı sürümler arasında değişti: 0.2.0 reddedilen aktivasyonu
   * tetiklenme sayıyordu, 0.3.0 yarım kaydı `pass` sayabiliyordu. Sürümü
   * taşımayan bir kayıt, hangi kurallarla yargılandığını söyleyemez.
   *
   * Yoksa kayıt 0.3.1 ya da öncesinden: okurken `assayVersionLabel` kullan,
   * alanı doğrudan basma — boş kalmasın, bildiğini söylesin.
   */
  assayVersion?: string
}

/**
 * Sürüm alanı olmayan kayıtlar için okuma etiketi.
 *
 * "0.3.1 öncesi" değil "0.3.1 ya da öncesi": alan 0.3.2'de geldi, yani 0.3.1'in
 * kendi kayıtları da alansız.
 */
export const PRE_VERSION_STAMP = '0.3.1 or earlier'

/**
 * Kaydı üreten Assay sürümü, okunabilir biçimde.
 *
 * Alan yoksa boş dönmez: kaydın damgalamadan önce yazıldığını söyler. Terminal,
 * HTML ve hosted taraf aynı cümleyi buradan alıyor.
 */
export function assayVersionLabel(run: Pick<Run, 'assayVersion'>): string {
  return run.assayVersion === undefined || run.assayVersion.trim() === ''
    ? `${PRE_VERSION_STAMP} (the record predates version stamping)`
    : run.assayVersion
}

/**
 * Kaydın tetiklenme gözlemleri aktivasyonu doğrulamadan mı yazıldı (0.4.1-a).
 *
 * 0.2.0 öncesi kayıtlarda `refused` yok: o sürüm seçilen her skill'i
 * tetiklenmiş sayıyordu. Terminal ve hosted taraf aynı cümleyi kullanıyor.
 */
export function activationUnverified(run: Pick<Run, 'cases'>): boolean {
  return run.cases.some((result) =>
    result.attempts.some((a) => a.trigger.available && a.trigger.refused === undefined),
  )
}

export const ACTIVATION_UNVERIFIED =
  'not made: the record predates 0.2.0, which began confirming that a selected skill actually loaded'

/**
 * Bir koşumun ölçebileceği katmanlar.
 *
 * `trigger` — skill doğru istekte devreye girdi mi.
 * `assertions` — vaka setinde beyan edilen artefakt, iz ve yan etki iddiaları.
 */
export type RunLayer = 'trigger' | 'assertions'

/** Koşulmamış bir vaka ve sebebi. */
export interface SkippedCase {
  caseId: string
  /** Neden koşulmadı — okuyucu eksiği görüp sebebini de görsün. */
  reason: string
  /**
   * Eleme türü. Koşum verdict'i buna bakıyor, `reason` metnine değil.
   *
   * `layer` — kullanıcı dar bir ölçüm beyan etti (`--fast`) ve vakada o
   *   katmanda ölçülecek bir şey yok. Kapsam kararı; verdict'i etkilemez.
   * `budget` — deneme tavanı doldu. Hangi vakanın kesileceğini kullanıcı değil
   *   suite sırası seçti; kesilen vaka negatifse ayrım gücü hiç ölçülmemiş
   *   olabilir. Koşum bu yüzden `pass` veremez (değişmez #1 ve #5).
   * `interrupted` — koşum bu vakaya hiç ulaşmadan öldü; kurtarma journal
   *   başlığındaki plandan buluyor. `budget` ile aynı sebepten `pass` engeli.
   *   Bu etiket olmadan ulaşılamayan vaka kayıttan iz bırakmadan düşüyordu.
   */
  cause: 'layer' | 'budget' | 'interrupted'
}

/** Yarım kalmış bir koşumun künyesi. */
export interface PartialRun {
  /** Neden yarım kaldı: süreç öldürüldü, çöktü, kesildi. */
  reason: string
  /** Journal'dan toparlandığı an. */
  recoveredAt: string
  /**
   * Okunamadığı için atılan satır sayısı.
   *
   * Süreç bir satırın ortasında öldüğünde journal'ın sonunda yarım bir JSON
   * kalıyor. O satır atılıyor ama **sayılıyor**: sessizce yutmak, kaç
   * denemenin kaybolduğunu gizlemek olurdu.
   */
  droppedLines?: number
}

/**
 * Host'un koşum başında bildirdiği ortam.
 *
 * `environmentHash` bu nesnenin kanonik serileştirmesinden hesaplanır; ikisi
 * ayrışmasın diye hash'i üreten taraf nesneyi de veriyor.
 */
export interface Environment {
  model: string
  version: string
  outputStyle?: string
  permissionMode?: string
  tools: readonly string[]
  skills: readonly string[]
  agents: readonly string[]
  plugins: readonly string[]
  /**
   * Host'un bağlama yüklediği talimat dosyaları (CLAUDE.md ve benzerleri) —
   * **ölçülmüş** hâliyle (0.4.5).
   *
   * Her giriş `<tür> <yol> sha256:<ilk 16>`: çalışma dizini içindeki dosya
   * `./` ile başlayan göreli yolla (suite'in fixture'ı), dışındaki mutlak
   * yolla (sızıntı). İçerik hash'i girişte, çünkü aynı yoldaki dosya
   * değişirse sistem istemi de değişir.
   *
   * Üç durum ayrı:
   *  - alan yok → ölçülmedi (0.4.5 öncesi kayıt ya da host'un ölçüm kancası
   *    o oturumda koşmadı). "Temiz" demek değil.
   *  - `[]` → ölçüldü, hiçbir talimat dosyası yüklenmedi.
   *  - dolu → ölçüldü, bunlar yüklendi.
   *
   * Ölçülmemiş izolasyon izolasyon değil: 0.4.5'e kadar adaptör kullanıcının
   * `CLAUDE.md`'sinin yüklenmediğini varsayıyordu ve Windows'ta yükleniyordu.
   * Alan hash'e yalnızca ölçüldüğünde giriyor; ölçülmemiş bir kayıtla ölçülmüş
   * bir kayıt bu yüzden "ortam kaydı" olarak ayrışır ve karşılaştırılmaz.
   */
  memory?: readonly string[]
}

/** Ortamın iki koşum arasında kayan tek bir alanı. */
export interface EnvironmentChange {
  field: keyof Environment
  before: string
  after: string
}

/**
 * İki ortam kaydını alan alan karşılaştırır.
 *
 * Liste alanlarında (araçlar, skill'ler) fark eklenen/çıkarılan olarak
 * yazılır: tam listeyi basmak raporu okunmaz yapıyor ve asıl soru "ne
 * değişti".
 */
export function diffEnvironments(
  a: Environment,
  b: Environment,
): readonly EnvironmentChange[] {
  const changes: EnvironmentChange[] = []
  const scalars = ['model', 'version', 'outputStyle', 'permissionMode'] as const
  for (const field of scalars) {
    const before = a[field] ?? '(not reported)'
    const after = b[field] ?? '(not reported)'
    if (before !== after) changes.push({ field, before, after })
  }
  const lists = ['tools', 'skills', 'agents', 'plugins'] as const
  for (const field of lists) {
    const before = [...a[field]].sort()
    const after = [...b[field]].sort()
    if (before.join('\u0000') === after.join('\u0000')) continue
    const added = after.filter((x) => !before.includes(x))
    const removed = before.filter((x) => !after.includes(x))
    changes.push({
      field,
      before: removed.length > 0 ? `-${removed.join(', -')}` : count(before.length),
      after: added.length > 0 ? `+${added.join(', +')}` : count(after.length),
    })
  }
  // Talimat dosyaları: "ölçülmedi" bir liste değil, ayrı bir durum (0.4.5).
  if (a.memory === undefined || b.memory === undefined) {
    if (a.memory !== b.memory) {
      changes.push({ field: 'memory', before: memoryText(a.memory), after: memoryText(b.memory) })
    }
  } else {
    const before = [...a.memory].sort()
    const after = [...b.memory].sort()
    if (before.join('\u0000') !== after.join('\u0000')) {
      const added = after.filter((x) => !before.includes(x))
      const removed = before.filter((x) => !after.includes(x))
      changes.push({
        field: 'memory',
        before: removed.length > 0 ? `-${removed.join(', -')}` : memoryText(before),
        after: added.length > 0 ? `+${added.join(', +')}` : memoryText(after),
      })
    }
  }
  return changes
}

const memoryText = (memory: readonly string[] | undefined) =>
  memory === undefined ? 'not measured' : memory.length === 0 ? 'none loaded' : count(memory.length)

/**
 * Koşumda host'un yüklediği talimat dosyaları, raporda okunacak hâliyle.
 *
 * Terminal, HTML ve hosted sayfa aynı cümleyi kullanıyor. Ölçülmemiş bir
 * kayıt "none" demez — ölçülmediğini söyler.
 */
export function hostMemoryLabel(run: Pick<Run, 'environment'>): string {
  const memory = run.environment?.memory
  if (memory === undefined) return 'not measured (the record predates 0.4.5 or the probe did not run)'
  if (memory.length === 0) return 'none loaded (measured)'
  return memory.join('; ')
}

/**
 * Çalışma dizini dışından yüklenmiş talimat dosyası var mı.
 *
 * İçerideki dosya suite'in fixture'ı; dışarıdaki, ölçülen bağlama sızan
 * host dosyası (0.4.5).
 */
export function memoryFromOutside(run: Pick<Run, 'environment'>): readonly string[] {
  return (run.environment?.memory ?? []).filter((entry) => !/^\S+ \.\//.test(entry))
}

/** `1 entry` / `2 entries` — rapor metni dilbilgisine takılmasın. */
const count = (n: number) => `${n} ${n === 1 ? 'entry' : 'entries'}`


// ---------------------------------------------------------------------------
// Oran — değişmez #4
// ---------------------------------------------------------------------------

/**
 * Bir oran, N ve güven aralığı olmadan var olamaz. Tip bunu zorlar: `rate`
 * çıplak bir sayı değil, `n` ve `ci` ile aynı nesnede taşınır ve gözlem yoksa
 * `null` olur.
 */
export interface Proportion {
  successes: number
  n: number
  /** n === 0 iken null: gözlem olmadan oran yoktur. */
  rate: number | null
  /** Wilson skor aralığı. n === 0 iken null. */
  ci: { low: number; high: number; level: 0.95 } | null
}

/** %95 için normal dağılımın z değeri. */
const Z_95 = 1.959963984540054

/**
 * Wilson skor aralığı. Küçük N'de Wald aralığından çok daha dürüst davranır:
 * 10/10 başarıda Wald [1, 1] der, Wilson [0.72, 1] der.
 */
export function proportion(successes: number, n: number): Proportion {
  if (!Number.isInteger(successes) || !Number.isInteger(n) || successes < 0 || n < 0) {
    throw new RangeError('proportion needs non-negative integers')
  }
  if (successes > n) {
    throw new RangeError(`proportion: ${successes} successes out of ${n} is impossible`)
  }
  if (n === 0) return { successes, n, rate: null, ci: null }

  const p = successes / n
  const z2 = Z_95 * Z_95
  const denominator = 1 + z2 / n
  const centre = p + z2 / (2 * n)
  const margin = Z_95 * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))

  // ponytail: 12 basamağa yuvarlama, p=1 iken üst sınırın 0.9999999999999999
  // çıkmasını engelliyor. Rapor hassasiyeti hiçbir zaman bunun yakınına gelmez.
  const clamp = (value: number) =>
    Math.min(1, Math.max(0, Math.round(value * 1e12) / 1e12))

  return {
    successes,
    n,
    rate: p,
    ci: {
      low: clamp((centre - margin) / denominator),
      high: clamp((centre + margin) / denominator),
      level: 0.95,
    },
  }
}

/** İnsan okunur biçim. Oranı N ve aralık olmadan yazdırmanın tek meşru yolu yok. */
export function formatProportion(p: Proportion): string {
  if (p.rate === null || p.ci === null) return 'no observations (N=0)'
  const pct = (value: number) => `${(value * 100).toFixed(0)}%`
  return `${pct(p.rate)} (N=${p.n}, 95% CI ${pct(p.ci.low)}–${pct(p.ci.high)})`
}
