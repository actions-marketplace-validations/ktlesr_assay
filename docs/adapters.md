# Host Adaptör Sözleşmesi

Bir adaptör bir **host ortamını** temsil eder, bir skill'i değil. Claude Code,
Codex ve Copilot ayrı adaptörlerdir; `docx` skill'i adaptör değildir.

Arayüz: `packages/runner/src/adapter.ts`.

```ts
interface HostAdapter<S extends AgentSession = AgentSession> {
  readonly id: string
  start(config: RunConfig): Promise<S>
  readTriggerSignal(session: S): Promise<TriggerObservation>
  readTrace(session: S): Promise<readonly TraceEvent[] | undefined>
  finalize(session: S): Promise<SessionResult>
}
```

## Sözleşmenin sert kuralı

**Sinyal okunamadığında hata fırlatma, okunamadığını söyle.**

`readTriggerSignal` her zaman bir `TriggerObservation` döner:

```ts
type TriggerObservation =
  | {
      available: true
      triggered: boolean
      skills: string[]
      refused: boolean
      refusals: { skill: string; reason: string }[]
      complete: boolean
      via: string
    }
  | { available: false; reason: string }
```

`triggered` alanına `available: true` olmadan erişilemez — tip, "bilinmiyor"u
görmezden gelinemez kılar. Runner `available: false` gördüğünde attempt'i
`unknown` işaretler. **Tahmin yürütmek ve varsayılan üretmek yasaktır**
(docs/invariants.md #1): sinyal okunamadığında "tetiklenmedi" varsaymak, her
negatif vakayı bedavaya geçirir.

`reason` insan tarafından okunacak: hangi mekanizmanın denendiğini ve neden
yetmediğini söylesin.

`via` sinyalin nereden okunduğunu söyler ve rapora düşer. İki host aynı verdict'i
farklı güvenilirlikte üretebilir; okuyucu bunu görebilmeli.

`complete`, `skills` listesinin tetiklenen skill'lerin *tamamı* olup olmadığını
söyler. `false` ise coexistence iddiaları (`expect.not_triggered`) doğrulanamaz
ve `unknown` üretilir.

## Tetiklenme = doğrulanmış aktivasyon (0.2.0)

**Skill'i çağırmak tetiklemek değildir.** Adaptör, ancak skill'in gövdesinin
oturuma girdiğini gözlediyse `triggered: true` diyebilir. Model skill'i seçti
ama host yüklemediyse bu **üçüncü bir durumdur**: `refused: true`, ve
`refusals` her çağrının neden aktivasyon sayılmadığını taşır.

Reddedilen bir aktivasyon ne `pass` ne `fail` üretir:

- `expect.triggered: true` → `unknown`. Skill kırık değil; izin katmanı
  durdurdu. `fail` demek kullanıcıyı yanlış yere bakmaya gönderirdi.
- `expect.triggered: false` → `unknown`. `pass` demek modelin skill'e
  uzandığını gizlerdi — değişmez #1'in yasakladığı sessiz geçiş.
- Doğruluk matrisi (`precision`, `recall`, ayrım gücü notu) bu attempt'i
  paydaya almaz.

Aynı skill bir çağrıda reddedilip başka bir çağrıda aktive olduysa ölçüm
vardır: `triggered: true`, `refused: false`.

Claude Code adaptöründe aktivasyon dört yapısal engelle doğrulanıyor — metin
eşleştirmesi yok:

1. `result.permission_denials` çağrının kimliğini taşıyor mu,
2. eşleşen `tool_result` hata döndü mü,
3. sonuç geldi ama gövde boş mu,
4. sonuç hiç gelmedi mi.

**Tavan.** 3 numara, host'un başarılı bir `Skill` sonucunu her zaman gövdeyle
döndürdüğü varsayımına dayanıyor. Host bir gün gövdeyi başka bir kanaldan
enjekte ederse her aktivasyon reddedilmiş görünür ve her vaka `unknown` olur.
Bu gürültülü bir bozulma, sessiz bir geçiş değil: yükseltme yolu, adaptörün
gövde kanalını tanıması.

## İz

`readTrace` iz alınamadığında `undefined` döner. **Boş dizi farklı bir iddiadır:**
"hiçbir araç çağrılmadı". Bu ayrım `no_swallowed_errors` için belirleyicidir —
alınamayan iz `unknown`, boş iz de `unknown` ama farklı gerekçeyle; ikisi de
`pass` değildir.

İz iki 0.2.0 alanı taşıyor:

- `refusal` — çağrı yapılmadı çünkü izin katmanı reddetti, ve nedeni. "Skill
  bunu yapamadı" ile "Assay buna izin vermedi" iki farklı ölçümdür; ikisi de
  araç çağrısının düşmesiyle sonuçlanır ve izde aynı görünürlerse ayırt
  edilemezler.
- `hook` — host'un çalıştırdığı kanca (`kind: 'hook'`). Bir `SessionStart`
  hook'u sistem promptuna metin enjekte edebilir, bir `PreToolUse` hook'u araç
  çağrısını reddedebilir; ikisi de skill'in davranışını değiştirir ve hiçbiri
  skill'in kendisi değildir. Kayıtta durmazlarsa iki koşum arasındaki fark
  açıklanamaz kalır. Çıktı 2000 karakterde kesilir ve kesildiği yazılır.

## Pin 3

`finalize` sistem promptu hash'ini verebiliyorsa `systemPromptHash` alanında
verir. Veremiyorsa alan yoktur; runner pin eksikliğini raporlar, **uydurmaz**.

## İzin modu

`finalize` host'un **bildirdiği** izin modunu `permissionMode` alanında verir —
adaptörün istediğini değil. İkisi ayrışırsa gerçek olan host'un söylediğidir ve
fark bir bulgudur. Host bildirmiyorsa alan yoktur.

Mod ölçümün koşuludur: araçları kısıtlanmış bir skill ile kısıtlanmamış olan
iki farklı ölçümdür. Bu yüzden Claude Code adaptöründe `environmentHash`'in
içine giriyor — mod kayarsa pin 3'ün denetçisi kayar ve karşılaştırma durur.

## MockAdapter

`@ktlsr/assay-runner/testing` altında. **Yalnızca test aracıdır**; arayüze, seed'e veya
rapora veri besleyemez (docs/workflow.md, veri gerçekliği sözleşmesi). Ana giriş
noktasından bilerek dışa verilmez ve `tools/dependency-boundaries.test.ts` bunu
denetler.

Hazır kenar durumları: `BLIND_HOST` (sinyal hiç okunamıyor), `PARTIAL_TRACE`
(iz var, `session_end` yok), `REFUSED_ACTIVATION` (model skill'i seçti, host
yüklemedi), `CRASHED_SESSION`, `START_FAILS`.
