# Karar Günlüğü

Otonom modda verilen her belirsizlik kararı buraya yazılır.

Format:

```
## <tarih> — <karar başlığı>
Bağlam: neden bir karar gerekti
Seçenekler: değerlendirilenler
Karar: seçilen
Gerekçe: neden
Geri dönüş maliyeti: düşük / orta / yüksek
```

---

## 2026-08-31 — Node 22 LTS, `.nvmrc` ile pinli

Bağlam: Runtime sürümü seçilmeli. Adaptörler alt süreç ve dosya sistemi
işi yapacak; sürüm sapması sandbox davranışını değiştirebilir.
Seçenekler: Node 20 LTS · Node 22 LTS · Node 24 (current) · Bun
Karar: Node 22.20.0, `.nvmrc` ile pinli.
Gerekçe: Makinede kurulu sürüm bu ve aktif LTS. Node 24 henüz LTS değil.
Bun cazip ama adaptörlerin alt süreç/izolasyon davranışı Node ekosisteminde
daha öngörülebilir ve Assay'in kendisi bir ölçüm aracı — kendi altında
sürpriz istemiyoruz.
Geri dönüş maliyeti: düşük

## 2026-08-31 — pnpm workspace, paket yöneticisi olarak pnpm

Bağlam: Monorepo'da bağımlılık sınırlarını zorlamak gerekiyor;
`packages/core` hiçbir şeye bağımlı olmamalı.
Seçenekler: npm workspaces · yarn · pnpm workspace
Karar: pnpm 10.19.0, workspace modu.
Gerekçe: Katı `node_modules` düzeni sayesinde bildirilmemiş bağımlılık
kazara çözülmez. Bağımlılık kuralı yalnızca lint'te değil, disk düzeninde
de zorlanmış olur. Yığın kararı zaten pnpm yönündeydi.
Geri dönüş maliyeti: düşük

## 2026-08-31 — ESLint 9 flat config + Prettier

Bağlam: Lint ve format aracı seçilmeli. Lint'in asıl işi stil değil,
paketler arası bağımlılık sınırını makine seviyesinde zorlamak.
Seçenekler: ESLint + Prettier · Biome · yalnızca tsc
Karar: ESLint 9 flat config + Prettier. Bağımlılık sınırı için
`no-restricted-imports`; yetmezse dependency-cruiser eklenir.
Gerekçe: Biome daha hızlı ama mimari sınır kuralları için ESLint eklenti
ekosistemi hâlâ gerekli. `web → runner` yasağını kural olarak ifade
edebilmek bu seçimin tek sebebi; stil ikincil.
Geri dönüş maliyeti: düşük

## 2026-08-31 — Test koşucusu Vitest

Bağlam: Assertion motoru ve şema doğrulayıcı için test gerekiyor.
Seçenekler: Vitest · node:test · Jest
Karar: Vitest.
Gerekçe: TS/ESM ile ek yapılandırma istemiyor, monorepo workspace desteği
var. `node:test` yeterli olurdu ama Faz 2'de React bileşen testi gelince
ikinci bir koşucu eklemek gerekirdi.
Geri dönüş maliyeti: düşük

## 2026-08-31 — Conventional Commits

Bağlam: Commit konvansiyonu seçilmeli.
Seçenekler: serbest · Conventional Commits · gitmoji
Karar: Conventional Commits. Gövdede ne yapıldığı ve verilen kararlar.
Gerekçe: Otonom modda commit'leri ajan atıyor; makine tarafından üretilen
geçmişin makine tarafından okunabilir olması ileride changelog ve
sürümleme otomasyonunu bedavaya getirir.
Geri dönüş maliyeti: düşük

## 2026-08-31 — Lisans Apache-2.0, NOTICE dosyasıyla

Bağlam: SDK açık kaynak olacak; lisans seçilmeli.
Seçenekler: MIT · Apache-2.0 · çift lisans
Karar: Apache-2.0, `NOTICE` dosyası ile birlikte. Copyright sahibi
"Assay contributors".
Gerekçe: Ürün tanımında zaten Apache-2.0 belirtilmiş. Patent hükmü,
kurumsal kullanıcının hukuk incelemesinden geçmeyi kolaylaştırıyor —
hedef kullanıcının bir kısmı kurumsal ekip.
Geri dönüş maliyeti: yüksek (lisans değişimi katkıcı onayı ister)

## 2026-08-31 — Faz 1 kalıcılığı dosya tabanlı, SQLite değil

Bağlam: Faz 1'de koşum kayıtları bir yere yazılmalı; yığın "SQLite veya
dosya tabanlı store" diyerek seçimi açık bırakmış.
Seçenekler: SQLite (better-sqlite3) · JSON dosya store · hiç kalıcılık yok
Karar: `.assay/runs/` altında sürümlü JSON dosya store.
Gerekçe: Faz 1'in ihtiyacı dört pin + N tekrarın kaydı ve tekrar okunması;
bunun için sorgu motoru gerekmiyor. Dosya store'un iki ek getirisi var:
kayıtlar insan tarafından okunabilir ve doğrudan CI artefaktı olarak
yüklenebilir. Native bağımlılık (better-sqlite3) eklemek, aracın kendi
kurulumunu kırılganlaştırır. Faz 2'de Postgres zaten gelecek; SQLite ara
istasyonu iki kez migration demek.
Geri dönüş maliyeti: düşük

## 2026-08-31 — Git kökü: d:\assay içinde ayrı repo

Bağlam: `D:\` sürücüsünün tamamı halihazırda bir git reposu. `d:\assay`
içinde çalışırken `git status` binlerce alakasız dosya gösteriyor.
Seçenekler: D:\ reposunun alt dizini olarak çalışmak · d:\assay içinde
ayrı `git init`
Karar: `d:\assay` içinde ayrı repo (`git init -b main`), remote
`ktlesr/assay`.
Gerekçe: Assay bağımsız yayımlanacak açık kaynak bir SDK. Sürücü genelindeki
repoya karışması hem sır sızıntısı riski hem de anlamsız bir geçmiş demek.
İç içe repo, dış repo tarafından yok sayılır.
Geri dönüş maliyeti: düşük

## 2026-08-31 — Bağımlılık sınırı: ESLint `no-restricted-imports`, dependency-cruiser değil

Bağlam: `core → hiçbir şey` ve `web ↛ runner` kuralları makine seviyesinde
zorlanmalı. 0.2 iki araç arasında seçim bırakmıştı.
Seçenekler: dependency-cruiser (ayrı araç, ayrı config, grafik doğrulama) ·
ESLint `no-restricted-imports` bölgeleri · yalnızca kod incelemesi
Karar: `eslint.config.js` içinde paket başına bir `no-restricted-imports`
bölgesi. Kuralın gerçekten ihlal yakaladığı `tools/dependency-boundaries.test.ts`
ile kanıtlanır (9 yasak + 6 serbest vaka + core'un dependencies'inin boş olduğu).
Gerekçe: ESLint zaten yığında. İkinci bir araç, ikinci bir config ve ikinci bir
CI adımı demek. Kuralın kendisi bir testle korunduğu için dependency-cruiser'ın
sunduğu ek güvence marjinal. Grafik seviyesinde döngü tespiti gerekirse sonradan
eklenir.
Geri dönüş maliyeti: düşük

## 2026-08-31 — `apps/web` Faz 2'ye kadar düz CSS

Bağlam: Yığın Tailwind + shadcn/ui diyor ama tema sistemi 2.2 adımının konusu.
0.2'de web yalnızca iskelet.
Seçenekler: Tailwind'i şimdi kur · 2.2'ye kadar düz CSS
Karar: `apps/web/app/globals.css` içinde CSS değişkenleriyle düz CSS; koyu/açık
tema `prefers-color-scheme` ile.
Gerekçe: Tema token sistemi 2.2'nin çıktısı. Şimdi Tailwind kurmak, 2.2'de
yeniden tasarlanacak bir yapılandırmayı iki kez yazmak olur. İskelet sayfanın
ihtiyacı 60 satır CSS.
Geri dönüş maliyeti: düşük

## 2026-08-31 — `apps/web/postcss.config.mjs` boş dosya olarak var

Bağlam: `D:\postcss.config.mjs` (başka bir projeye ait) Next'in yukarı doğru
config aramasına takılıyordu; dev sunucusu `@tailwindcss/postcss` bulunamadı
diye 500 veriyordu.
Seçenekler: Next config'te postcss yolunu sabitlemek · yerel boş postcss config
Karar: `apps/web/postcss.config.mjs` → `export default { plugins: {} }`.
Gerekçe: Aramayı proje sınırında durduran en küçük çözüm. Tailwind 2.2'de zaten
buraya eklenecek. Bu, geliştirme makinesine özgü bir kaza değil: monorepo'yu
başka bir kökün altına klonlayan herkes aynı sızıntıyı yaşar.
Geri dönüş maliyeti: düşük

## 2026-08-31 — Tek kök Vitest yapılandırması

Bağlam: Monorepo'da test koşumu paket başına mı, kökten mi?
Seçenekler: paket başına vitest config + workspace/projects · tek kök config
Karar: Kökte tek `vitest.config.ts`, `packages/*/src/**/*.test.ts` ve
`tools/**/*.test.ts` glob'ları.
Gerekçe: Paketler aynı ortamı (node) paylaşıyor. Yedi ayrı config, tek satırlık
bir glob'un yaptığı işi yapardı. Faz 2'de `apps/web` jsdom ortamı isterse
`projects` alanına o zaman geçilir.
Geri dönüş maliyeti: düşük

## 2026-08-31 — Kullanıcıya görünen metinler İngilizce, kod yorumları ve docs Türkçe
Bağlam: Doğrulayıcı hata mesajları yazılırken dil seçilmeli. Proje Türkçe
yürüyor ama SDK Apache-2.0 ve uluslararası skill yazarlarını hedefliyor.
Seçenekler: her şey Türkçe · her şey İngilizce · ayrım
Karar: Kullanıcıya görünen her string (doğrulama hataları, ileride CLI çıktısı
ve rapor) İngilizce. Kod yorumları, docs/ ve commit mesajları Türkçe.
Gerekçe: "Jest for Agent Skills" konumlandırmasıyla Türkçe hata mesajı veren bir
CLI tutarsız olur. Mesajlar koda dağılınca sonradan çevirmek ucuz değil; bugün
seçmek bedava. Türkçe docs projeyi yürüten için okuma maliyetini düşürüyor ve
dışarıya sızmıyor.
Geri dönüş maliyeti: orta

## 2026-08-31 — core'un I/O yasağı lint kuralı, `dependencies: {}` kuralı değil
Bağlam: 0.2'de "core hiçbir şeye bağımlı değil" testi `dependencies` nesnesinin
boş olmasını şart koşuyordu. 0.3'te core'a zod ve yaml gerekti.
Seçenekler: zod/yaml'ı runner'a taşıyıp core'u bağımsız tutmak · testi
"@assay/* bağımlılığı yok" olarak daraltıp I/O yasağını ayrıca zorlamak
Karar: İkincisi. `dependencies` içinde `@assay/*` olmaması + `packages/core`
içinde Node yerleşiklerinin (`node:*`, `fs`, `path`, `child_process`, `net`,
`crypto`, ...) `no-restricted-imports` ile yasaklanması. Yedi yasak ve iki
serbest vaka testte.
Gerekçe: Asıl kural "core saf hesaplamadır, tarayıcıda da aynı davranır" idi;
`dependencies: {}` bunun kaba bir vekiliydi. Zod ve yaml saf hesaplama, I/O
yapmıyor. Node yerleşiklerini yasaklamak niyeti doğrudan ifade ediyor ve daha
sıkı: core'a `node:fs` sızarsa lint yakalar, oysa eski kural yakalamazdı.
Geri dönüş maliyeti: düşük

## 2026-08-31 — Yakın-komşu vakası id konvansiyonuyla işaretlenir
Bağlam: Değişmez #5 yakın-komşu negatifi ister; doğrulayıcının bunu tanıması
gerekiyor.
Seçenekler: vakaya ayrı `kind: near_neighbor` alanı · id içinde `near_neighbor`
segmenti
Karar: id segmenti. `trigger.negative.near_neighbor.pdf`.
Gerekçe: id'ler zaten hiyerarşik ve zorunlu. İkinci bir alan, aynı bilgiyi iki
yerde tutmak ve ikisinin çelişme ihtimalini yaratmak olurdu. Plan dosyasındaki
örnek de bu konvansiyonu kullanıyor.
Geri dönüş maliyeti: düşük

## 2026-08-31 — `version` vaka seti sürümü, ayrıca şema sürümü alanı yok
Bağlam: Dördüncü pin "vaka seti sürümü". Plan örneğinde tek bir `version: 1`
alanı var ve bunun şema sürümü mü vaka seti sürümü mü olduğu belirsiz.
Seçenekler: iki ayrı alan (`version` + `suite_version`) · tek alan, vaka seti
sürümü · içerik hash'ini core'da hesaplamak
Karar: Tek alan; `version` vaka seti sürümüdür ve vakalar değiştiğinde artırılır.
İçerik hash'i core'da hesaplanmaz, runner koşum kaydına yazar.
Gerekçe: İki sürüm alanı, biri hep unutulacak iki alan demek. Hash core'da
hesaplanamaz çünkü `node:crypto` I/O yasağının kapsamında ve tarayıcıda yok;
üstelik hash'in doğal yeri kaynağı okuyan taraf. Beyan edilen sürüm insan
niyetini, runner'ın yazdığı hash gerçeği taşır — biri unutulursa diğeri yakalar.
Geri dönüş maliyeti: orta (suite dosyalarına alan eklemek geriye dönük kırar)

## 2026-08-31 — Kanıt modeli: core değerlendirir, runner toplar
Bağlam: `file_exists`, `file_valid`, `side_effect` gibi assertion'lar dosya
sistemine bakmak zorunda; ama core I/O yapmıyor.
Seçenekler: assertion motorunu runner'a taşımak · core'a dosya okuma vermek ·
runner'ın topladığı `Evidence` nesnesini core'a girdi vermek
Karar: Üçüncüsü. `Evidence { files?, trace?, exitCode?, env? }` — her alan
opsiyonel, çünkü toplanamamış olabilir. Runner kanıtı toplar, core değerlendirir.
Gerekçe: Motoru runner'a taşımak core'u boşaltır ve ileride hosted tarafın aynı
kaydı yeniden değerlendirmesini imkânsız kılar. Kanıt nesnesi ayrıca ölçümü
yeniden üretilebilir yapar: aynı Evidence her zaman aynı verdict'i verir.
Geri dönüş maliyeti: yüksek (motorun konumu mimarinin merkezinde)

## 2026-08-31 — "Veri yokken pass yok" kuralı sevk katmanında zorlanıyor
Bağlam: Değişmez #1 "hiçbir assertion veri yokluğunda PASS dönmez, tip
seviyesinde zorla" diyor.
Seçenekler: her değerlendiricide elle kontrol · sevk katmanının kanıtı önceden
çözmesi · sonuç tipinde kısıt
Karar: Her assertion tipi hangi kanıt alanlarına ihtiyaç duyduğunu `REQUIRES`
tablosunda bildirir. Sevk katmanı eksik alan görürse değerlendiriciyi **hiç
çağırmaz** ve `unknown` üretir. Değerlendiricilerin girdi tipinde (`Resolved<K>`)
o alanlar opsiyonel değildir.
Gerekçe: Değerlendirici eksik kanıtı göremediği için yanlışlıkla `pass` dönmesi
yapısal olarak imkânsız. Elle kontrol, yeni bir assertion tipi eklendiğinde
unutulacak tek satırdı.
Geri dönüş maliyeti: düşük

## 2026-08-31 — no_swallowed_errors üç kademeli deterministik bildirim tespiti
Bağlam: "Ajan hatayı bildirdi mi?" sorusu LLM judge olmadan cevaplanmalı
(değişmez #6).
Seçenekler: yalnızca host sinyaline güvenmek (pratikte hep unknown) · anahtar
sözcük sezgiseli · üç kademe
Karar: (1) adaptörün `acknowledgesError` alanı, (2) hata metnindeki ayırt edici
belirteçlerin veya araç adının mesajda geçmesi, (3) genel başarısızlık
sözcükleri. Üçü de tutmuyorsa `fail`. Oturum başarıyla bitmediyse `pass`;
`session_end` yoksa veya sonucu yoksa `unknown`.
Gerekçe: Yalnızca host sinyali beklemek ölçümü pratikte hep `unknown` yapardı ve
ürünün ayırt edici özelliği ölürdü. Üç kademe yanlış `fail` riskini düşürüyor:
`fail` demek için ajanın hatadan sonra ürettiği metnin ne aracı, ne hata
belirtecini, ne de herhangi bir başarısızlık sözcüğünü içermemesi gerekiyor.
Tavan: yalnızca imalı kabul yakalanamaz; yükseltme yolu adaptörün
`acknowledgesError` doldurması, ki o sezgiselin önüne geçiyor.
Geri dönüş maliyeti: düşük (tek modül)

## 2026-08-31 — JSON Schema doğrulaması için ajv
Bağlam: `json_schema` ve `tool_args_valid` assertion'ları JSON Schema
doğrulaması istiyor.
Seçenekler: elle yazılmış alt küme · ajv · @cfworker/json-schema
Karar: ajv 8, `strict: false`, `allErrors: true`. Derlenen şemalar
önbelleklenir.
Gerekçe: Elle yazılmış bir alt küme, tam da sessizce yanlış veri geçiren yerdir —
bir doğrulayıcı aracında kabul edilemez. ajv sıkıcı ve standart seçim. `strict`
kapalı, çünkü kullanıcının şemasındaki tanımadığımız anahtar kelimeler koşumu
düşürmemeli.
Geri dönüş maliyeti: düşük

## 2026-08-31 — Oran tipi N ve güven aralığını yapısal olarak taşır
Bağlam: Değişmez #4 "hiçbir oran N ve güven aralığı olmadan gösterilmez" diyor.
Bir kod incelemesi kuralı olarak bu er geç aşınır.
Seçenekler: `number` döndürüp gösterim katmanında kural · `Proportion` tipi
Karar: `Proportion { successes, n, rate: number | null, ci: {...} | null }`.
Wilson skor aralığı. Gözlem yoksa `rate` de `ci` de `null`.
Gerekçe: Çıplak bir `number` üretilmediği için oranı N'siz göstermek için
kasıtlı çaba gerekiyor. Wilson, Wald yerine seçildi: 10/10 başarıda Wald
[%100, %100] der ve belirsizliği tamamen gizler, Wilson [%72, %100] der.
`null` seçeneği "N=0 iken oran yoktur"u tüketiciye zorla hatırlatıyor.
Geri dönüş maliyeti: orta

## 2026-08-31 — TriggerObservation'a `complete` alanı
Bağlam: `expect.not_triggered` ile "pdf tetiklenmemeli" denebiliyor. Ama bir host
yalnızca hedef skill'i raporluyorsa, gözlenen `skills` listesi eksiktir ve
"pdf listede yok" ifadesi "pdf tetiklenmedi" anlamına gelmez.
Seçenekler: eksik listeyi tam varsaymak · coexistence'ı v0'dan çıkarmak ·
gözleme `complete` bayrağı eklemek
Karar: `complete: boolean`. `false` iken coexistence iddiası `unknown` üretir.
Gerekçe: Eksik listeyi tam varsaymak, tam da değişmez #1'in yasakladığı sessiz
`pass` olurdu — üstelik en sinsi biçimde, çünkü her coexistence vakası geçerdi.
Bayrak adaptöre "bunu biliyor musun" diye soruyor ve bilmiyorsa ölçüm
yapılmıyor.
Geri dönüş maliyeti: düşük

## 2026-08-31 — Tetiklenmede kesin fail, ölçülemeyen parçadan önce gelir
Bağlam: Bir vaka hem `triggered: true` hem `not_triggered: [pdf]` diyorsa ve host
tam liste vermiyorsa: hedef skill tetiklenmemişken sonuç ne olmalı?
Seçenekler: ölçülemeyen parça varsa hep `unknown` · kesin başarısızlık önce gelir
Karar: `fail` > `unknown` > `pass`. Hedef skill iddiası kesin biçimde
başarısızsa vaka `fail`; yalnızca ölçülemeyen parça kaldıysa `unknown`.
Gerekçe: `combineVerdicts` ile aynı öncelik. Gerçek bir başarısızlığı `unknown`
arkasına saklamak, ölçmediğini `pass` demek kadar zararlı — kullanıcı kırık bir
skill'i "ölçülemedi" diye geçiştirir.
Geri dönüş maliyeti: düşük

## 2026-08-31 — MockAdapter `@ktlsr/assay-runner/testing` alt yolunda
Bağlam: Veri gerçekliği sözleşmesi MockAdapter'ın arayüze veya seed'e veri
beslemesini yasaklıyor. Bu bir niyet beyanı olarak kalırsa aşınır.
Seçenekler: ana giriş noktasından dışa verip yorumla uyarmak · ayrı alt yol ·
ayrı paket
Karar: `packages/runner/src/testing/mock-adapter.ts`, package.json'da `./testing`
alt yolu. `tools/dependency-boundaries.test.ts` iki şeyi denetliyor: ana giriş
noktası bu yolu dışa vermiyor ve test olmayan hiçbir kaynak onu içe aktarmıyor.
Testin gerçekten yakaladığı, index'e kasıtlı bir export eklenerek doğrulandı.
Gerekçe: Ayrı paket fazla; yorumla uyarmak az. Alt yol, kazayla kullanmayı
imkânsız kılıyor: ayrı bir import yazmak gerekiyor ve o import testte kırmızıya
dönüyor.
Geri dönüş maliyeti: düşük

## 2026-08-31 — Adaptör metotları async, senkron fırlatma yok
Bağlam: MockAdapter senkron fırlattığında `rejects.toThrow` çalışmıyordu.
Seçenekler: çağıranın hem try/catch hem .catch yazması · metotları async yapmak
Karar: Tüm adaptör metotları `async`. Senkron fırlatmalar da reddedilen promise'e
dönüşür.
Gerekçe: Runner'ın hata yakalamayı tek yerde yapabilmesi için sözleşmenin "her
çağrı promise döner" garantisi vermesi gerekiyor. Aksi hâlde her adaptör
çağrısında iki farklı hata yolu olurdu ve biri er geç unutulurdu.
Geri dönüş maliyeti: düşük

## 2026-08-31 — Faz 1 adaptörü Claude Code
Bağlam: 0.6 fizibilite spike'ı üç hostu karşılaştırdı.
Seçenekler: Claude Code · Codex · Copilot
Karar: Faz 1 adaptörü Claude Code.
Gerekçe: Dört sinyalin dördü de gözlenebiliyor, üçü yüksek güvenilirlikte ve
metin parse etmeye gerek yok. `system/init` aktif skill setini veriyor,
`Skill` tool_use tetiklenmeyi açıkça bildiriyor, `tool_result.is_error` iz
sinyalini taşıyor, `result` mesajı maliyet ve gecikmeyi bedavaya getiriyor.
Codex'in tetiklenme sinyali belgelenmemiş, Copilot'unki log parse gerektiriyor.
Motoru gerçek veriyle doğrulamanın tek temiz yolu bu.
Geri dönüş maliyeti: düşük (adaptör arayüzü host-bağımsız)

## 2026-08-31 — Koşum izolasyonu CLAUDE_CONFIG_DIR ile
Bağlam: İzole edilmemiş bir probe koşumunda 119 skill aktifti; hedef skill
doğal dille tetiklenmedi ve model komşu bir skill'in aracına uzandı.
Seçenekler: kullanıcının kurulumunu olduğu gibi kullanmak · `--bare` ·
temiz `CLAUDE_CONFIG_DIR` + `--plugin-dir`
Karar: Her koşum kendi geçici `CLAUDE_CONFIG_DIR`'ında, skill `--plugin-dir`
ile yalnızca o oturuma yüklenir. Deneyle doğrulandı: skill sayısı 119 → 19.
Gerekçe: İzolasyonsuz ölçülen şey skill değil, kullanıcının kurulumudur.
`--bare` daha temiz olurdu ama OAuth okumuyor, yalnızca ANTHROPIC_API_KEY
kabul ediyor; `CLAUDE_CONFIG_DIR` aynı izolasyonu verip kaldıraç bırakıyor.
Geri dönüş maliyeti: düşük

## 2026-08-31 — `subtype: success` tek başına tamamlama kanıtı sayılmaz
Bağlam: İzole config deneyinde koşum "Not logged in" ile bitti ama akış
`subtype: "success"` raporladı.
DÜZELTME (aynı gün, fixture incelenince): Bu kaydın ilk hâli `is_error: false`
diyordu, yanlıştı. Ham veri `is_error: true`, `terminal_reason: "api_error"`,
`total_cost_usd: 0`, `output_tokens: 0`. Yani host yalnızca `subtype` alanında
yanıltıcı; diğer alanlar doğruyu söylüyor. Karar değişmiyor, gerekçesi
daralıyor: tek alana güvenilmez.
Seçenekler: host'un başarı bildirimine güvenmek · çapraz kontrol
Karar: Adaptör `finalize` içinde çapraz kontrol yapar. `total_cost_usd === 0`
ve `usage.output_tokens === 0`, ya da `num_turns === 0`, ya da
`terminal_reason !== 'completed'` ise oturum `unknown` işaretlenir.
Gerekçe: Değişmez #1'in canlı kanıtı. Host'un iyimser başarı bildirimine
güvenmek, tam da sessiz `pass` üretme yolu.
Geri dönüş maliyeti: düşük

## 2026-08-31 — Pin 3 sistem promptu hash'i değil, ortam hash'i olarak adlandırılacak
Bağlam: Claude Code sistem promptunu veya hash'ini vermiyor. `system/init`
model, sürüm, araç listesi, skill listesi, agent listesi, plugin listesi ve
output_style veriyor.
Seçenekler: alanı boş bırakıp pin eksik demek · init alanlarından türetilmiş
hash'i sistem promptu hash'i diye yazmak · türetilmiş hash'i kendi adıyla yazmak
Karar: `init` alanlarından deterministik bir *ortam hash'i* hesaplanır ve
raporda o adla gösterilir; sistem promptu hash'i alanı host vermediği sürece
boş kalır.
Gerekçe: Türetilmiş bir hash'i sistem promptu hash'i diye etiketlemek,
kullanıcıya sahip olmadığı bir garantiyi satmaktır. İki farklı sistem promptu
aynı init alanlarını üretebilir. Ortam hash'i yine de gerçek bir kayma
detektörü — sadece daha az şey iddia ediyor.
Geri dönüş maliyeti: düşük

## 2026-08-31 — Çapraz-host matrisi Faz 1'e çekilmiyor, roadmap'te kalıyor
Bağlam: 0.6'nın ilk hâli, `claude plugin eval` bulgusu yüzünden çapraz-host
uyumluluk matrisinin "sonraki dalga"dan Faz 1'e çekilmesini önermişti. O öneri
Codex'in ölçülebilir olduğu varsayımına dayanıyordu.
Seçenekler: Codex adaptörünü Faz 1'e almak · metinden çıkarımla ölçmek ·
çapraz-host'u ertelemek
Karar: Ertelemek. Faz 1 yalnızca Claude Code adaptörüyle devam eder.
Gerekçe: Codex deneyle sınandı ve varsayım çürüdü. (1) Tetiklenme yapısal bir
olay olarak yayınlanmıyor; tek kanıt asistan mesajının serbest metni
("I'm using the assay-probe skill because..."). (2) Skill seti izole
edilemiyor: `CODEX_HOME` yalnızca config'i kapsıyor, `USERPROFILE`/`HOME`
override'ı işe yaramadı, 1235 kullanıcı skill'i yüklendi ve bağlam bütçesi
aşıldığı için tüm skill açıklamaları düştü. Metinden çıkarımla ölçmek
teknik olarak mümkün ama değişmez #1'e aykırı: modelin "bu skill'i
kullanıyorum" demesi bir gözlem değil, bir iddiadır. Ölçülemeyen bir şeye
adaptör yazmak, yığında bilinçli olarak olmayanlar listesindeki hatanın
aynısı olurdu.
Geri dönüş maliyeti: düşük — `codex exec --json` akışı araç izi ve tamamlama
için zaten yeterli; yapısal bir skill olayı çıktığı gün adaptör bir günlük iş.

## 2026-08-31 — Farklılaşma çapraz-host değil, ölçüm dürüstlüğü
Bağlam: `claude plugin eval` Faz 1 kapsamıyla örtüşüyor ve çapraz-host kaçış
yolu kapandı. Assay'in var oluş gerekçesi yeniden tanımlanmalı.
Seçenekler: projeyi durdurmak · çapraz-host'u zorlamak · deterministik ölçüm
dürüstlüğüne yaslanmak
Karar: Üçüncüsü. Üç savunma hattı: deterministik skorlama (judge yok), üç
durumlu verdict, regresyon hafızası.
Gerekçe: Bu spike'ta host iki kez, iki farklı sebeple "başarılı" dedi ve koşum
hiç gerçekleşmemişti — önce "not logged in", sonra "401 revoked", ikisinde de
`subtype: success`. Bir eşikten geçen skor bunu göremez. `claude plugin eval`
skorlamayı LLM'e yaptırıyor; kararsızlık ölçen aracın kendisinin kararsız
olması ölçümü açıklanamaz kılıyor. Bu iki fark teknik, bugün inşa edilebilir
ve rakip tarafından kopyalanması ürün kararı gerektirir.
Geri dönüş maliyeti: düşük (konumlandırma, kod değil)

## 2026-08-31 — Adaptör sözleşmesi `core`'a taşındı
Bağlam: `HostAdapter` ve yardımcı tipleri `packages/runner`'daydı ama
`packages/adapters` yalnızca `core`'a bağlanabiliyor (docs/stack.md). Adaptör
sözleşmesini uygulamak için runner'a bağlanması gerekirdi.
Seçenekler: bağımlılık kuralını gevşetmek · sözleşmeyi core'a taşımak ·
adapters'ı runner'a bağımlı yapmak
Karar: `packages/core/src/adapter.ts` — yalnızca tipler, çalışma zamanı kodu
yok. `runner` aynı adla yeniden dışa veriyor, çağrı yerleri değişmedi.
Gerekçe: Tipler saf; core'un "I/O yok" kuralını ihlal etmiyorlar. Bağımlılık
kuralını gevşetmek `web → runner` yasağını da tartışmaya açardı; kural
gevşetilmedi, tip doğru yere kondu.
Geri dönüş maliyeti: düşük

## 2026-08-31 — Claude Code süreci doğrudan `.exe` olarak spawn ediliyor
Bağlam: İlk canlı koşumda üç vakadan ikisi `unknown` döndü; akış hiç gelmedi.
Sebep: Windows'ta Node 22 `.cmd` dosyalarını kabuk olmadan spawn etmiyor
(CVE-2024-27980) ve kabuğa düşünce çok satırlı istem argümanı bozuluyor.
Seçenekler: istemi tek satıra sıkıştırmak · geçici dosyaya yazıp yolunu
geçmek · PATH üzerinde `.exe` arayıp doğrudan spawn + istemi stdin'den vermek
Karar: Üçüncüsü. `resolveBinary` PATH'te `claude.exe` arar; bulunca kabuk
kullanılmaz. İstem her durumda stdin'den gider.
Gerekçe: İstemi sıkıştırmak vaka setini bozar — çok satırlı istem gerçek bir
kullanım. Geçici dosya, sandbox yüzeyine gereksiz bir dosya ekler. `.exe`
doğrudan spawn hem kabuk ayrıştırmasını hem ARG_MAX sınırını ortadan
kaldırıyor. Kabuk yolu yedek olarak duruyor.
Geri dönüş maliyeti: düşük

## 2026-08-31 — `complete: true`, Claude Code için
Bağlam: `TriggerObservation.complete`, gözlenen skill listesinin tam olup
olmadığını söylüyor. Claude Code adaptörü ne bildirmeli?
Seçenekler: temkinli davranıp `false` · `true`
Karar: `true`, ama yalnızca çapraz kontrolden geçmiş oturumlarda.
Gerekçe: `system/init` aktif skill setinin tamamını veriyor ve model tarafından
seçilen her skill çağrısı `Skill` aracından geçiyor (12 gerçek transkriptte
doğrulandı, canlı koşumda da öyle davrandı). `false` demek her coexistence
vakasını kalıcı olarak `unknown` yapardı — ölçülebilir bir şeyi ölçmemek olurdu.
Kalan risk: `Skill` aracı olmadan içerik enjekte eden üçüncü bir yol varsa
gözden kaçar; yokluğu kanıtlanamadı (docs/host-feasibility.md).
Geri dönüş maliyeti: düşük (tek alan)

## 2026-08-31 — Sandbox gözlemler, zorlamaz (Faz 1)
Bağlam: 1.2 izolasyon teknolojisini seçmemi istiyordu; kriter kurulum kolaylığı
değil izolasyon güvenilirliği.
Seçenekler: Docker konteyner · işletim sistemi seviyesi jail · geçici çalışma
dizini + host'un araç izni katmanı
Karar: Üçüncüsü, ve **hiçbir yerde "engelleniyor" denmiyor, "gözleniyor"
deniyor.** Her attempt kendi geçici dizininde; dosya sistemi öncesi/sonrası
hash'lenip farkı alınıyor; çalışma dizini dışına yazma girişimleri izdeki araç
çağrılarından okunuyor; ağ araçları host'un `--disallowed-tools` mekanizmasıyla
reddediliyor.
Gerekçe: Docker'ı bugün eklemek, ölçemediğimiz bir şeye altyapı yazmak olurdu
(yığında bilinçli olarak olmayanlar listesi). Asıl risk teknoloji seçimi değil,
**kapasiteyi olduğundan fazla göstermek**. Tavan kodda ve dokümanda açıkça
yazılı: süreç kendi başına soket açarsa görülmez, dosya sistemi yazımı OS
seviyesinde engellenmez. 1.3 güvenlik incelemesi bu yüzeyi ölçecek ve gerekirse
Docker o zaman gelecek.
Geri dönüş maliyeti: orta (sandbox arayüzü değişmeden altına konteyner konabilir)

## 2026-08-31 — Adaptör varsayılan izin modu `acceptEdits`, ağ reddedilir
Bağlam: İlk uçtan uca koşumda tamamlama vakası 0/3 geçti. İz gösterdi ki
`--permission-mode dontAsk` `Write` ve `Bash`'i reddediyor; ajan dosyayı hiç
yazamıyordu.
Seçenekler: `dontAsk` (hiçbir tamamlama vakası ölçülemez) · `bypassPermissions`
(sandbox dışına da yazar) · `acceptEdits` + ağ araçlarının reddi
Karar: `acceptEdits`, artı `--disallowed-tools WebFetch WebSearch`.
Gerekçe: Ajan sandbox çalışma dizinine yazabilmeli, yoksa görev tamamlama
katmanı ölçülemez. `bypassPermissions` sandbox iddiasını tamamen boşaltırdı.
Ağın kapalı olması `side_effect: { network: deny }` iddiasının dayandığı tek
gerçek; açık bırakmak o assertion'ı süs hâline getirirdi.
Geri dönüş maliyeti: düşük (adaptör seçeneği)

## 2026-08-31 — Reddedilen araç çağrısı yan etki sayılmaz
Bağlam: Canlı koşumda ajan sandbox dışına yazmayı denedi, host reddetti; ama
`EnvDiff.writes` o yolu yazılmış gibi gösteriyordu.
Seçenekler: denenen her yolu yazım saymak · yalnızca başarılı çağrıları saymak
Karar: `TraceEvent`'e `id` (çağrı) ve `callId` (sonuç) alanları eklendi; sonucu
hata olan çağrı yan etki üretmiyor, ağ çağrısı ise `blocked: true` işaretleniyor.
Sonucu hiç gelmemiş çağrı gerçekleşmiş sayılıyor — sessizce yok sayılmıyor.
Gerekçe: Gerçekleşmemiş bir yazımı kaydetmek, ölçüm aracında kabul edilemez bir
yalan. Ters yön de tehlikeli: sonucu bilinmeyen çağrıyı yok saymak gerçek bir
yan etkiyi gizleyebilirdi, o yüzden şüphe hâlinde "oldu" kabul ediliyor.
Geri dönüş maliyeti: düşük

## 2026-08-31 — Pin 1'e içerik hash'i eklendi (`skillHash`)
Bağlam: CLI'ın `compare` komutu ilk gerçek denemede iki koşumu karşılaştırdı ve
"regresyon yok" dedi — oysa aralarında skill dosyasını değiştirmiştim. Sebep:
pin 1 (`target.source`) beyan edilen bir string ve içerik değişince kımıldamıyor.
Seçenekler: kullanıcının beyanına güvenmek · skill dizininin içerik hash'ini
runner'ın hesaplaması
Karar: `Pins.skillHash` — runner skill dizininin içerik hash'ini hesaplar ve
kayda yazar; `comparePins` bunu da denetler. `suiteVersion`/`suiteHash` çiftinin
aynısı. Store sürümü 2'ye çıkarıldı.
Gerekçe: Beyan edilen sürüm unutulur. Unutulduğunda iki farklı skill'in koşumları
karşılaştırılabilir görünüyordu ve bu, ürünün tek iddiasını — regresyon sinyali —
sessizce yanlış yapıyordu. Gerçek koşumla doğrulandı: skill'e tek satır eklendi,
beyan değişmedi, `compare` "skillHash changed" diyerek reddetti ve exit 3 döndü.
Geri dönüş maliyeti: düşük

## 2026-08-31 — CLI çıkış kodu 3: ölçülemedi
Bağlam: CI'da "başarısız" ile "ölçülemedi" aynı kodla dönerse değişmez #1
komut satırında kaybolur.
Seçenekler: unknown'ı 1 saymak · 0 saymak · ayrı kod
Karar: `0` geçti, `1` bir vaka düştü, `2` kullanım hatası, `3` hiçbir şey
ölçülemedi. `--allow-unknown` ile 3 → 0.
Gerekçe: Bir test aracının en tehlikeli hatası ölçemediğini "geçti" saymaktır;
`0` bunu yapardı. `1` de yanlış: kullanıcı kırık bir skill arar, oysa sorun
kimlik bilgisi veya host'tur. Ayrı kod, boru hattının bu iki durumu farklı ele
almasına izin veriyor. Bayrak, kararı kullanıcıya bırakıyor ama varsayılanı
dürüst tarafta tutuyor.
Geri dönüş maliyeti: düşük

## 2026-08-31 — Regresyon iddiası güven aralıklarına dayanır
Bağlam: İki oran farklı diye regresyon demek, küçük N'de neredeyse her koşumda
alarm üretir.
Seçenekler: ham fark eşiği · güven aralığı kesişimi
Karar: Aralıklar kesişiyorsa `within_noise`; ayrıksa ve düşüş varsa `regressed`.
Gerekçe: N=3 ile %100'den %0'a düşüş bile istatistiksel olarak gürültüden ayırt
edilemiyor ve bunu söylemek dürüstlük. Ham eşik, kullanıcıyı sahte alarmlara
boğar ve alarmları görmezden gelmeyi öğretir — regresyon aracının ölümü budur.
Bedeli: gerçek ama küçük regresyonları yakalamak için N büyütmek gerekiyor,
ki zaten doğru cevap o.
Geri dönüş maliyeti: düşük

## 2026-08-31 — CI baseline'ı GitHub artefaktı
Bağlam: 1.5 regresyon karşılaştırması için önceki koşumun nereden geleceğini
sormuş ve kararı bana bırakmıştı.
Seçenekler: repoya commit'lenen baseline dosyası · GitHub Actions artefaktı ·
hosted baseline (Faz 2)
Karar: Aynı workflow'un base branch üzerindeki en son başarılı koşumundan
`assay-runs` artefaktı indirilir.
Gerekçe: Commit'lenen baseline, ölçüm sonucunu repo geçmişine karıştırır ve her
koşumda gürültülü bir diff üretir. Hosted baseline Faz 2'de gelecek ama SDK'nın
platformsuz tam çalışması şart. Artefakt, `GITHUB_TOKEN` dışında hiçbir şey
istemiyor.
Bilinen sınırlar açıkça yazıldı: artefaktlar süresi dolunca kaybolur (varsayılan
90 gün), bir branch'in ilk koşumunda baseline yoktur ve yorum bunu söyler,
yakın zamanlı iki PR aynı baseline'a bakar. Karşılaştırma mantığı `core`'da
olduğu için Faz 2'de yalnızca "önceki koşum nereden geliyor" değişecek.
Geri dönüş maliyeti: düşük

## 2026-08-31 — Action yalnızca kendi ürettiği kaydı raporlar
Bağlam: `action/run.mjs` ilk hâlinde `.assay/runs` içindeki en yeni kaydı
okuyordu. CLI çöktüğünde bu, **önceki koşumun sonucunu** bu koşumunmuş gibi
raporluyordu — yerel denemede görüldü.
Seçenekler: her koşumdan önce store'u temizlemek · koşum kimliğini CLI'dan
almak · koşum öncesi/sonrası en yeni kaydı karşılaştırmak
Karar: Üçüncüsü. Koşumdan önceki en yeni kayıt kimliği tutuluyor; sonrasında
değişmemişse kayıt üretilmemiş sayılıyor ve `::error::` ile `unknown` çıkıyor.
Gerekçe: Store'u temizlemek yerel geçmişi siler. Bir aracın en tehlikeli hatası
ölçmediğini ölçülmüş göstermek; burada üstelik *başka bir koşumun* sonucunu
gösterecekti.
Geri dönüş maliyeti: düşük

## 2026-08-31 — Ajan süreci ortamı devralmaz, allowlist geçer
Bağlam: 1.3 güvenlik incelemesi. Adaptör alt sürece `{ ...process.env }`
geçiriyordu.
Seçenekler: tüm ortamı geçirmek · bilinen sırları çıkarmak (denylist) ·
allowlist
Karar: Allowlist. `PATH`, `HOME`/`USERPROFILE`, `TEMP`, `SystemRoot`,
`PATHEXT`, dil/saat dilimi, proxy ve `ANTHROPIC_BASE_URL`. Kimlik bilgisi
ayrıca ekleniyor.
Gerekçe: Denylist her yeni sır adında güncellenmesi gereken bir liste demek ve
biri mutlaka unutulur. Allowlist'te unutulan şey en kötü ihtimalle host'un
çalışmamasına yol açar — sessiz sızıntıya değil. CI'da bu fark
`GITHUB_TOKEN`'ın ölçülen skill'e açık olup olmaması demek.
Geri dönüş maliyeti: düşük

## 2026-08-31 — Kabuk komutu kullanan koşumda yan etki iddiası `unknown`
Bağlam: `EnvDiff.writes` anlık görüntü farkından ve `Write`/`Edit` araç
çağrılarından türetiliyor. Bir kabuk komutu ikisinde de görünmüyor;
`side_effect` assertion'ı bu durumda `pass` dönüyordu.
Seçenekler: kabuk argümanını ayrıştırıp ne yaptığını tahmin etmek · kabuk
araçlarını tamamen yasaklamak · gözlenemeyen çağrıyı kaydedip iddiayı
`unknown` yapmak
Karar: Üçüncüsü. `EnvDiff.unobserved` alanı; boş değilse `side_effect`
`unknown` üretiyor.
Gerekçe: Kabuk komutunun ne yaptığını argümanından okumak (`echo`, `>`, `curl`,
boru hatları, değişken genişletme) güvenilir değil ve tam da sessizce yanlış
geçiren yer olurdu. Kabuğu yasaklamak, kabuk kullanan skill'leri ölçülemez
yapardı. Bedeli açık: kabuk kullanan her skill'in yan etki katmanı `unknown`
olur — doğru bedel bu, alternatifi ölçmediğini ölçtüm demek (değişmez #1).
Geri dönüş maliyeti: düşük

## 2026-08-31 — Sandbox sınırları kapatılmadı, ölçüldü ve yazıldı
Bağlam: 1.3, dosya sistemi ve ağ sınırının gerçekten zorlanıp zorlanmadığını
soruyor.
Seçenekler: Docker/konteyner sandbox'ı şimdi eklemek · sınırı host'a bırakıp
belgelemek
Karar: İkincisi. `docs/sandbox-security.md` içinde A1 ve A2 kabul edilen risk
olarak yazıldı: dosya sistemi ve ağ sınırı Claude Code'un izin katmanına
dayanıyor, disk ve CPU kotası yok.
Gerekçe: Konteyner gerçek çözüm ama Faz 1'in sorusu "ölçebiliyor muyuz"
idi ve cevap evet çıktı. Şimdi eklemek, ürünün asıl riskini (ölçüm dürüstlüğü)
çözmeden altyapı yazmak olurdu. Asıl tehlike izolasyonun eksikliği değil,
**eksik izolasyonu tam sanmak** — o yüzden M1'de gözlenemeyen yüzey `unknown`
üretiyor ve hiçbir yerde "engelleniyor" denmiyor. Konteyner Faz 3'e bırakıldı;
bu rapor onu artık gerekçelendiriyor.
Geri dönüş maliyeti: orta (sandbox arayüzü değişmeden altına konteyner konur)

## 2026-08-31 — Dogfooding hedefi: birbirinin yakın komşusu üç skill
Bağlam: 1.6 üç-beş gerçek skill istiyor ve seçimin gerekçelendirilmesini
şart koşuyor.
Seçenekler: rastgele popüler skill'ler · tek bir skill'i derinlemesine ·
birbirinin yakın komşusu olan bir küme
Karar: `docx`, `pdf`, `xlsx` (anthropics/skills). Skill'ler repoda
vendor'lanmadı; proprietary lisanslılar, yerel kurulumdan kopyalanıyor.
Gerekçe: Üçü de "bunu bir belgeye çevir" istemiyle çağrılabilir, yani
birbirlerinin en zor negatifi. Yakın-komşu vakası yazmak için ideal küme ve
değişmez #5'in ölçtüğü şey tam burada sınanıyor. Rastgele skill'lerle
negatif vakalar kolay olurdu ve ayrım gücü ölçülmemiş olurdu.
Geri dönüş maliyeti: düşük

## 2026-08-31 — Ölçülemeyecek katmanlar suite'e konmadı
Bağlam: Doküman skill'leri Python betikleri çalıştırıyor; izole çalışma
dizininde bağımlılıkları yok. Ayrıca `Bash` kullandıkları için 1.3'ten sonra
`side_effect` zaten `unknown` üretecekti.
Seçenekler: artefakt ve yan etki vakalarını ekleyip `fail`/`unknown` almak ·
eklememek ve raporda nedenini yazmak
Karar: Eklenmedi; docs/dogfooding.md "Ölçülemeyenler" başlığında neden
eklenmediği yazıldı. Tamamlama katmanı ayrıca `examples/widget-manifest`
suite'iyle doğrulandı.
Gerekçe: Python kurulumu eksik olduğu için düşen bir artefakt vakası skill'i
değil sandbox'ı ölçerdi ve raporu gürültüyle doldururdu. Sonucu baştan belli
olan bir ölçümü koşmak, ölçüm değil tören olur. Ama sessizce atlamak da
olmaz — raporda açıkça yazılı.
Geri dönüş maliyeti: düşük

## 2026-08-31 — `db` paketi `core`'a bağlanabilir
Bağlam: 2.1 "şemayı core'daki kanonik tiplerden türet" diyor ama bağımlılık
grafiği `db → (bağımsız)` idi.
Seçenekler: db'yi bağımsız tutup eşlemeyi web'e taşımak · db → core izni
Karar: `db → core`. Eşleme (`toRunRow`/`fromRunRow`) db paketinde.
Gerekçe: Eşlemeyi web'e taşımak, CLI'ın `push` komutunun aynı kodu tekrar
yazmasını gerektirirdi ve iki kopya er geç ayrışırdı — tam olarak 2.1'in
yasakladığı şey. Kuralın amacı core'u bağımsız tutmak ve web'i runner'dan
uzak tutmaktı; db'yi core'dan izole etmek o amaca hizmet etmiyor.
`packages/ui` bağımsız kalıyor.
Geri dönüş maliyeti: düşük

## 2026-08-31 — Kısıt testleri PGlite ile, Docker'sız
Bağlam: CHECK kısıtlarının gerçekten tuttuğunu kanıtlamak için Postgres
gerekiyor.
Seçenekler: Docker'da postgres · testcontainers · PGlite (süreç içi WASM
Postgres) · kısıtları test etmemek
Karar: PGlite. `packages/db/src/constraints.test.ts` migration'ı uygulayıp
her kısıtı ihlal ediyor.
Gerekçe: Docker CI'da servis, yerelde kurulum demek; testler o an koşulmaz
hâle gelir ve kısıtlar denetimsiz kalır. PGlite gerçek Postgres semantiği
veriyor (CHECK, enum, jsonb, cascade) ve `pnpm test` içinde saniyeler sürüyor.
Kısıtın gerçekten tuttuğu ancak koşulan bir testle bilinir.
Geri dönüş maliyeti: düşük

## 2026-08-31 — Tüm zaman damgaları `timestamptz`
Bağlam: Gidiş-dönüş testi 3 saatlik kayma gösterdi. Prisma'nın `DateTime`
varsayılanı `timestamp(3)` — saat dilimsiz.
Seçenekler: eşlemede UTC'ye zorlamak · şemada `@db.Timestamptz(3)`
Karar: Şemada. Tüm `DateTime` alanları `timestamptz`.
Gerekçe: Ölçüm kaydındaki zamanlar mutlak anlar. Saat dilimsiz saklamak,
başka bir bölgedeki sunucunun farklı zamanlar okuması demek; eşlemede
düzeltmek de her yeni alanda tekrarlanacak bir hatırlama işi olurdu.
Test bunu yakaladı, kod incelemesi yakalamazdı.
Geri dönüş maliyeti: düşük (migration henüz uygulanmadı)

## 2026-08-31 — `Case.expectTriggered` NOT NULL değil, "bir şey ölçer" CHECK'i
Bağlam: 2.1 `Case.expectTriggered NOT NULL` istiyor. Ama 0.3'te yayımlanan
vaka şeması, yalnızca artefakt ölçen vakalara izin veriyor.
Seçenekler: NOT NULL yapıp şemayı kırmak · nullable bırakıp kuralı gevşetmek ·
nullable + "vaka bir şey ölçmeli" CHECK'i
Karar: Üçüncüsü. `expectTriggered IS NOT NULL OR notTriggered dolu OR
assertions dolu`.
Gerekçe: Kuralın amacı "her vaka bir şey ölçsün" idi; `expectTriggered NOT
NULL` bunun bir vekiliydi ve tamamlama vakalarını yasaklardı. CHECK niyeti
doğrudan ifade ediyor.
Not: ilk yazımı `array_length('{}',1) > 0` içeriyordu; Postgres'te bu NULL
döner ve NULL sonuçlu CHECK ihlal sayılmaz — kısıt sessizce boşa çıkıyordu.
Test yakaladı, `coalesce` ile düzeltildi.
Geri dönüş maliyeti: düşük

## 2026-08-31 — Faz 2'de doğrudan `main`, feature branch değil
Bağlam: Sözleşme 2 Faz 2'den itibaren her adım için feature branch ve PR
istiyordu; kullanıcı sonradan "commit et, main'e push et" talimatı verdi.
Seçenekler: PR akışını sürdürmek · doğrudan main
Karar: Doğrudan `main`. `faz2/veri-modeli` dalı açılmıştı, main'e birleştirildi.
Gerekçe: Kullanıcının açık talimatı sözleşmenin üzerinde. Tek geliştiricili
otonom bir akışta PR, incelemesi olmayan bir tören olurdu; koruma testlerde
ve pre-commit hook'ta duruyor.
Geri dönüş maliyeti: düşük

## 2026-08-31 — Tipografi: Instrument Serif + IBM Plex, Fraunces + Inter değil
Bağlam: 2.2 Fraunces + Inter'i başlangıç noktası veriyor, daha iyisi bulunursa
değiştirilmesini ve gerekçelendirilmesini istiyor.
Karar: Instrument Serif (başlık) + IBM Plex Sans (gövde) + IBM Plex Mono (veri).
Gerekçe: Fraunces yumuşak ve hümanist — bir dergi kapağı, ölçüm aleti değil.
Inter'in tabular rakamları var ama karakteri yok ve her arayüzde duruyor.
IBM Plex, kimliği ölçüm ve makine olan bir şirket için tasarlandı; mono kardeşi
sans ile aynı iskeleti paylaşıyor, yani bir hash ile bir etiket aynı sesle
konuşuyor — sertifika dilinde bu önemli.
Geri dönüş maliyeti: düşük (token)

## 2026-08-31 — `unknown` rengi antimon (soğuk arduvaz mavisi)
Bağlam: Bağlayıcı kısıt: UNKNOWN yeşile ya da kırmızıya yakın hiçbir ton
almayacak, nötr ama görmezden gelinemeyecek.
Seçenekler: gri · sarı/amber · soğuk mavi-gri
Karar: `#5B6B8A`. Ayrıca şekil farkı: pass `●`, fail `✕`, unknown `◐`.
Gerekçe: Gri görmezden gelinir; amber uyarı rengi ve kırmızıya yakın okunur.
Soğuk mavi-gri ikisinden de eşit uzakta, iki temada da metinden ayrışıyor.
Antimon tahlilde gerçekten kullanılan bir metal — paletin geri kalanıyla aynı
dünyadan. Yarım dolu daire "kısmen bilinen" demek; renk kaldırılsa bile anlam
duruyor.
Geri dönüş maliyeti: düşük

## 2026-08-31 — Tailwind kaynak yolları açıkça bildiriliyor
Bağlam: Tailwind v4 kaynakları otomatik bulmaya çalışıyor ama bu monorepo'da
bulamadı: üretilen stil sayfasında tek bir utility yoktu ve sayfa tamamen
stilsiz render edildi.
Seçenekler: otomatik tespite güvenmek · `@source` ile yolları yazmak
Karar: `@source "../app"` ve `@source "../lib"`.
Gerekçe: Sessizce stilsiz bir sayfa üretmek, iki satır yazmaktan çok daha
pahalı. Ekran görüntüsü almasaydım fark edilmezdi — "arayüzü etkileyen her
adımdan sonra ekran görüntüsü al" kuralının karşılığı bu.
Geri dönüş maliyeti: düşük

## 2026-08-31 — Kanonik kayda `skill` alanı
Bağlam: Koşum listesi ekranında dört skill de "skills" görünüyordu. Kayıt
skill adını taşımıyor; `pins.skillSource` sürümü taşıyor
(`anthropics/skills@local-install`), adı değil.
Seçenekler: adı `skillSource`'tan ayrıştırmak · suite dosyasını okumak ·
kayda `skill` alanı eklemek
Karar: `Run.skill`. Prisma şemasına da eklendi.
Gerekçe: `skillSource`'tan ayrıştırmak `owner/repo@sha` biçimini varsayar ve
yerel bir skill'de anlamsız. Suite dosyasını okumak, kaydın kendi kendine
yetmesi ilkesini bozar — hosted taraf suite dosyasını görmüyor.
`expectedTrigger` ile aynı gerekçe.
Geri dönüş maliyeti: düşük

## 2026-08-31 — `@ktlsr/assay-ui` bağımsız kalıyor, `Measurement` yapısal olarak uyuyor
Bağlam: `MetricValue` bileşeni core'daki `Proportion` tipine ihtiyaç duyuyor
ama bağımlılık grafiği `ui → (bağımsız)` diyor.
Seçenekler: `ui → core` izni · ui'da yapısal olarak uyumlu kendi tipi
Karar: İkincisi. `Measurement { successes, n, rate, ci }` — core'un
`Proportion`'ı buna atanabiliyor. Uyum `tools/ui-contract.test.ts` ile hem
tip hem davranış seviyesinde denetleniyor (iki biçimlendiricinin aynı metni
ürettiği de sınanıyor).
Gerekçe: `db → core` iznini vermiştim çünkü orada alternatif eşlemeyi ikiye
bölmekti. Burada öyle değil: tasarım sistemi kendi başına kullanılabilir
kalıyor ve kural yalnızca "oran N ve aralık olmadan render edilemez" — bunu
yapısal bir tip de zorluyor.
Geri dönüş maliyeti: düşük

## 2026-08-31 — Tema tokenları `:root`'a değil, herhangi bir kaba bağlanıyor
Bağlam: Bileşen kataloğu iki temayı aynı sayfada yan yana göstermeli.
Tokenlar `:root[data-theme='dark']` ile yazılmıştı; koyu panel sessizce açık
render ediliyordu.
Karar: `[data-theme='dark']` ve `[data-theme='light']` — kök şartı kalktı.
Sıra: temel açık → sistem tercihi → koyu öznitelik → açık öznitelik.
Gerekçe: Kök şartı, temayı iç içe kullanmayı imkânsız kılıyordu. Ekran
görüntüsü yakaladı; kod incelemesi yakalamazdı çünkü CSS geçerliydi.
Geri dönüş maliyeti: düşük

## 2026-08-31 — `apps/web` `@ktlsr/assay-ui`'yi kaynaktan derliyor
Bağlam: İz görüntüleyicinin ızgarası sessizce çöktü. Sebep: Tailwind `src`'yi
tarıyordu ama çalışma zamanı derlenmiş `dist`i kullanıyordu; sınıf adı ile
CSS kuralı ayrıştı.
Seçenekler: dev sırasında `tsc -b --watch` · Next `transpilePackages`
Karar: `transpilePackages: ['@ktlsr/assay-ui']`, ui'nın `exports` alanı `src`i
gösteriyor. İç importlardaki `.js` uzantıları kaldırıldı (ui zaten Bundler
çözümlemesi kullanıyor).
Gerekçe: İki yerden derlenen tek bir paket her zaman ayrışır. Watch süreci
eklemek sorunu ertelerdi. Tek kaynak = tek gerçek.
Geri dönüş maliyeti: düşük (ui yayımlanacaksa `dist` tekrar açılır)

## 2026-08-31 — Katman bileşenleri Radix üzerine
Bağlam: 2.3 modal, alert dialog, tooltip, popover, dropdown ve toast istiyor;
odak tuzağı ve erişilebilirlik şart.
Seçenekler: elle yazmak · shadcn/ui'yi olduğu gibi almak · Radix primitifleri
üzerine kendi görünümümüzü koymak
Karar: Üçüncüsü. Radix'in davranışı, Assay'in görünümü.
Gerekçe: Odak tuzağı, kaçış tuşu, dışarı tıklama ve `aria-*` ilişkilerini elle
doğru yazmak zor ve erişilebilirlik "sadeleştirilmeyecekler" listesinde
(ponytail). shadcn'in varsayılan görünümü ise tam da kaçınılan jenerik dil —
dolgulu rozet, yumuşak gölge, yuvarlak köşe. Davranışı alıp görünümü
tokenlarla yeniden çizmek ikisini birden veriyor.
Geri dönüş maliyeti: düşük

## 2026-08-31 — Kimlik doğrulama Auth.js v5 (beta), oturum stratejisi JWT
Bağlam: 2.5'te giriş gerekiyor. Yığın "Auth.js" diyor; v5 Next 15 App Router
için uygun sürüm ama hâlâ beta (5.0.0-beta.32). Ayrıca Auth.js'te credentials
sağlayıcısı veritabanı oturumuyla çalışmıyor.
Seçenekler: next-auth v4 (kararlı ama App Router'da sürtünmeli) · v5 beta ·
kendi oturum katmanımız
Karar: `next-auth@beta` (v5), `session.strategy = 'jwt'`. Prisma adaptörü yine
kurulu: kullanıcı, hesap ve doğrulama kayıtları veritabanında.
Gerekçe: Kendi oturum yönetimimizi yazmama kararı zaten verilmişti. v4'ün App
Router yolu yamalı; iki kez yazmaktansa beta'yı sabitlemek daha ucuz. JWT
seçimi bir tercih değil, credentials sağlayıcısının şartı. Bedeli: oturum
sunucudan tek tıkla iptal edilemez — bu yüzden `jwt` geri çağrısı her istekte
kullanıcının rolünü ve askı durumunu veritabanından tazeliyor ve askıya alınan
kullanıcının token'ı bir sonraki istekte ölüyor.
Geri dönüş maliyeti: orta

## 2026-08-31 — RBAC middleware'de değil, layout/guard katmanında
Bağlam: Plan "RBAC middleware" diyor. Next middleware kenar (edge) çalışma
zamanında koşuyor; Prisma ve Argon2 orada çalışmıyor.
Seçenekler: Auth.js'in bölünmüş config'i ile kenar-güvenli middleware · korunan
her layout'ta sunucu tarafı guard
Karar: `apps/web/lib/guard.ts` — `requireUser` / `requireAdmin`, korunan
bölümün layout'unda çağrılır.
Gerekçe: Bölünmüş config, rolü token'dan okuyan ikinci bir doğruluk kaynağı
yaratırdı. Layout'ta denetim, o bölümün bütün alt yollarını kapsıyor;
middleware eşleştiricisine yeni bir yol eklemeyi unutma riski yok. Kaybedilen:
korumalı sayfa isteği sunucuya kadar geliyor — ölçülebilir bir maliyeti yok.
Geri dönüş maliyeti: düşük

## 2026-08-31 — Geliştirme veritabanı: PGlite'ın soket sunucusu
Bağlam: Hosted katman Postgres istiyor; geliştirme makinesinde Postgres kurulu
değil ve `DATABASE_URL` bir sır. Sır beklemek 2.5'i durdururdu.
Seçenekler: Docker Postgres · kurulu Postgres şartı · PGlite'ı soket sunucusu
olarak açmak
Karar: `tools/dev-postgres.mjs` — PGlite'ı `@electric-sql/pglite-socket` ile
127.0.0.1:5433'te Postgres tel protokolüyle açar. `pnpm db:dev`.
Gerekçe: Kısıt testleri zaten PGlite üzerinde koşuyor; aynı motoru bir porta
açmak Prisma için gerçek bir Postgres demek ve sürücü farkı bırakmıyor.
Docker'a bağımlılık, aracın kendi kurulumunu kırılganlaştırırdı. Üretimde
`DATABASE_URL` gerçek bir Postgres'i gösterir; kod tarafında fark yok.
Geri dönüş maliyeti: düşük

## 2026-08-31 — Kayıt ekranı yok; ilk yönetici komut satırından
Bağlam: İlk yöneticinin nasıl doğduğu belirsiz.
Seçenekler: açık kayıt + "ilk kayıt olan yönetici olur" · davet · kurulum
komutu
Karar: `pnpm db:user <email> <parola> ADMIN`. Web'de kayıt ekranı yok.
Gerekçe: "İlk kayıt olan yönetici olur" kestirmesi, kurulumla ilk ziyaret
arasındaki pencerede yarış açar. Hosted taraf zaten davetle açılacak; kurulum
komutu bunun en küçük hâli.
Geri dönüş maliyeti: düşük

## 2026-08-31 — Prisma 7 sürücü adaptörü `@prisma/adapter-pg`
Bağlam: Prisma 7 `datasourceUrl` ile doğrudan bağlanmayı kaldırdı; istemci bir
sürücü adaptörü istiyor.
Seçenekler: Accelerate · `@prisma/adapter-pg`
Karar: `@prisma/adapter-pg`, bağlantı adresi `DATABASE_URL`'den.
Gerekçe: Accelerate harici bir servis ve para harcar. `pg` adaptörü hem
geliştirmedeki PGlite soketine hem üretimdeki Postgres'e aynı şekilde bağlanıyor.
Geri dönüş maliyeti: düşük

## 2026-09-01 — Koşum görünürlüğü varsayılan gizli, vaka seti seviyesinde
Bağlam: 3.1 güvenlik incelemesi, yüklenen her koşumun kimliği bilen herkese
açık olduğunu buldu. Kayıt istem metinlerini, araç argümanlarını ve dosya
yollarını taşıyor.
Seçenekler: her şeyi oturum arkasına almak · koşum başına görünürlük bayrağı ·
vaka seti başına görünürlük bayrağı
Karar: `Suite.public`, varsayılan `false`. Erişim `RunScope` ile sorgu
katmanında; `listRuns`/`loadRun` kapsam almadan çağrılamıyor.
Gerekçe: Her şeyi oturum arkasına almak, tanıtım sayfasının gerçek bir ölçüm
gösterme yolunu kapatırdı ve ürünün iddiası tam da bu. Koşum başına bayrak,
aynı vaka setinin bazı koşumları açık bazıları gizli olduğunda karşılaştırmayı
yarım gösterir. Vaka seti doğal birim: yayımlanan şey bir ölçüm serisi.
Kapsamı çağırana bırakmak, bir ekranda unutulduğunda sessiz sızıntı demekti;
bu yüzden parametre zorunlu.
Geri dönüş maliyeti: düşük

## 2026-09-01 — Geliştirme veritabanı migration'ları dev-postgres.mjs uyguluyor
Bağlam: İkinci migration geldiğinde `prisma migrate` gölge veritabanı istedi;
PGlite onu vermiyor.
Seçenekler: her migration'ı elle uygulamak · geliştirmede gerçek Postgres şartı
· sunucunun kendi izleme tablosu
Karar: `tools/dev-postgres.mjs` bir `_assay_migrations` tablosu tutuyor ve
açılışta yalnızca eksik migration'ları uyguluyor. Testler de bütün
migration'ları sırayla uyguluyor.
Gerekçe: Elle uygulama, bir migration'ı atlamış bir geliştirme veritabanıyla
saatlerce koşmak demek. Üretimde `prisma migrate deploy` kullanılacak; bu
yalnızca geliştirme kolaylığı ve on beş satır.
Geri dönüş maliyeti: düşük

## 2026-09-01 — Palet akromatik; kroma yalnızca ölçümde
Bağlam: İlk palet (sıcak krem zemin, koyu kahve, altın vurgu) gerçek ekranlarda
görülünce ölçüm aleti değil dergi kapağı gibi duruyordu ve o kombinasyon şu an
her yerde.
Seçenekler: sıcaklığı azaltmak · başka bir marka rengi seçmek · arayüzü
akromatik yapıp kromayı ölçüme ayırmak
Karar: Üçüncüsü. Zemin ve çizgiler soğuk nötr; renk yalnızca verdict işareti,
güven aralığı ve kayan koşulda. Marka vurgu rengi yok — vurgu mürekkebin
kendisi.
Gerekçe: Kural artık okunabilir: ekranda bir renk gördüysen o bir ölçüm
sonucudur. Marka rengi eklemek renge ikinci bir anlam yüklerdi ve birinciyi
zayıflatırdı. Ayrıca kroma nadir olduğu için verdict renkleri neon olmak
zorunda kalmıyor; iki temada da düşük doygunlukla ayrışıyorlar.
Geri dönüş maliyeti: düşük (yalnızca token)

## 2026-09-01 — İkonlar çizilmiş SVG, Unicode glifi değil
Bağlam: Verdict işaretleri, iz adımları ve tema düğmesi Unicode glifleriyle
yazılmıştı (`●`, `✕`, `◐`, `→`, `¶`).
Seçenekler: glifleri sürdürmek · bir ikon kütüphanesi eklemek · seti kendimiz
çizmek
Karar: `packages/ui/src/icons.tsx` — 16×16 ızgara, 1.5 birim tek kalem
kalınlığı, `currentColor`. Bağımlılık eklenmedi.
Gerekçe: Glifler her yazı tipinde farklı boyda ve farklı taban çizgisinde
oturuyor; hizalama tesadüfe kalıyordu. Kütüphane, on beş ikon için bir
bağımlılık ve yabancı bir çizim dili demekti. Verdict işaretlerinin tek aileden
olması (aynı çember, içi farklı) ancak kendi çizimimizle mümkündü.
Geri dönüş maliyeti: düşük

## 2026-09-01 — Tema düğmesi tek ikon, tıkladıkça dönüyor
Bağlam: Üç düğmelik grup (LIGHT/DARK/SYSTEM) hem metin butonlarından oluşuyordu
hem dar ekranda başlığı sıkıştırıyordu.
Seçenekler: üç ikonlu grup · açılır menü · tek düğme, döngü
Karar: Tek düğme; o anki durumu gösteriyor, tıklamak sıradakine geçiriyor.
Sıra: sistem → açık → koyu.
Gerekçe: Üç düğme, üç durumun ikisini her zaman gereksiz gösteriyor. Açılır menü
tek tıklık bir iş için iki tık. Döngü tahmin edilebilir ve tek bir hedef; ekran
okuyucu etiketi hem şimdiki durumu hem sonraki adımı söylüyor.
Geri dönüş maliyeti: düşük

## 2026-09-01 — Oran üç kayıtta gösteriliyor
Bağlam: Değişmez #4 oranın N ve güven aralığıyla gösterilmesini şart koşuyor
ama `%70 (N=20, %95 GA %48–%85)` biçimi istatistik bilmeyen kullanıcı için
okunmuyordu.
Seçenekler: biçimi sadeleştirip aralığı küçültmek · aralığı kaldırıp yalnızca N
bırakmak (değişmez ihlali) · aynı oranı üç kayıtta göstermek
Karar: Üçüncüsü. Sayım cümlesi ("20 denemenin 14'ünde tetiklendi") → büyük
yüzde → çizilmiş aralık ve genişliğinin ne dediği. Ayrıca koşum ekranının
tepesinde tek cümlelik hüküm.
Gerekçe: İstatistik bilmeyen okuyucu birinci satırda cevabı alıyor, bilen
üçüncüde belirsizliği görüyor. Aralığı küçültmek onu süse çevirirdi; kaldırmak
değişmezi ihlal ederdi. Payda görünür olduğu için "%100" ile "4/4" arasındaki
fark da kayboluyor değil.
Geri dönüş maliyeti: düşük

## 2026-09-01 — npm scope `@ktlsr`, CLI adı `@ktlsr/assay`
Bağlam: Paketler `@assay/*` adıyla duruyordu ama o scope npm'de bize ait
değil. Yayın için gerçek bir ad uzayı gerekiyordu.
Seçenekler: `@assay` scope'unu almaya çalışmak · scope'suz `assay` · `@ktlsr`
kullanıcı scope'u
Karar: `@ktlsr`. CLI `@ktlsr/assay` (bin: `assay`), kütüphaneler
`@ktlsr/assay-core`, `-runner`, `-adapters`.
Gerekçe: Kullanıcı scope'u zaten sahip olunan ad uzayı; ek bir org kurulumu
ve ad çekişmesi yok. Scope'suz `assay` npm'de alınmış (v1.0.0, ilgisiz bir
paket) ve alınmamış olsa bile kullanıcının kararı onu şimdi kapmamaktı:
scope'suz bir ad ileride devretmesi zor bir bakım yükü. `bin` adı `assay`
kaldığı için kullanıcı deneyimi değişmiyor — kurulum adı ile komut adı ayrı
şeyler.
Geri dönüş maliyeti: yüksek (yayımlandıktan sonra ad değişimi yeni paket demek)

## 2026-09-01 — `db` ve `ui` yayımlanmıyor
Bağlam: Altı paketin hangilerinin npm'e gideceği belirsizdi.
Seçenekler: hepsini yayımlamak · yalnızca SDK dörtlüsünü yayımlamak
Karar: `core`, `runner`, `adapters`, `cli` yayımlanır; `db` ve `ui`
`private: true`.
Gerekçe: Ürün tanımındaki ayrım bu: SDK ölçer ve dağıtılır, hosted katman
hatırlar ve dağıtılmaz. `db` bir Prisma şeması ve migration seti — dışarıdan
kurulabilir bir kütüphane değil. `ui` kaynaktan tüketiliyor (`main` →
`src/index.ts`, web tarafında `transpilePackages`) ve tek tüketicisi
`apps/web`. İkisini yayımlamak, bakmak zorunda kalacağımız bir genel API
yüzeyi yaratırdı — kimsenin istemediği bir yüzey.
Geri dönüş maliyeti: düşük (sonradan yayımlamak kolay, geri çekmek zor)

## 2026-09-01 — Dört paket `fixed` grubunda, tek sürüm numarası
Bağlam: Changesets paketleri bağımsız da sürümleyebilir.
Seçenekler: bağımsız sürümler · `linked` · `fixed`
Karar: `fixed` — dördü her yayında aynı sürümü alır.
Gerekçe: Dördü tek bir SDK'nın parçaları ve yalnızca birlikte test ediliyorlar.
Bağımsız sürümlerde kullanıcı `@ktlsr/assay@0.2.0` ile hangi
`@ktlsr/assay-core`'un uyumlu olduğunu çözmek zorunda kalırdı; `linked`
yalnızca değişenleri hizalayıp aradaki boşlukları açık bırakıyor. Bedeli:
değişmeyen paketler de sürüm atlıyor — npm'de ucuz bir bedel.
Geri dönüş maliyeti: düşük

## 2026-09-01 — Yayın build'i ayrı tsconfig; map üretilmiyor, `src` gönderilmiyor
Bağlam: Geliştirme build'i `dist`e test dosyaları ve source map yazıyor;
`files: ["dist"]` bunların hepsini tarball'a alıyordu. Ayrıca map'ler `src`'yi
gösteriyor ama `src` tarball'da yok.
Seçenekler: `src`'yi de yayımlayıp map'leri çalışır kılmak · `.npmignore` ile
tek tek dışlamak · yayın için ayrı `tsconfig.build.json`
Karar: Üçüncüsü. `tsconfig.build.json` testleri hariç tutuyor,
`sourceMap`/`declarationMap` kapalı, `tsBuildInfoFile` dist dışında.
`build:publish` önce dist'i siliyor.
Gerekçe: `src`'yi yayımlamak tarball'ı iki katına çıkarır ve kullanıcıya işine
yaramayan bir kopya gönderir; asıl istenen şey `.d.ts` ve o zaten var.
`.npmignore` bir dışlama listesi — yeni bir dosya türü eklendiğinde
güncellenmesi unutulur, `files` beyaz listesi ise unutulduğunda eksik yayımlar
(güvenli taraf). Ölçüldü: geliştirme build'iyle `@ktlsr/assay-core` 84 dosya /
65.7 KB, yayın build'iyle 26 dosya / 32.2 KB.
Geri dönüş maliyeti: düşük

## 2026-09-01 — Tarball içeriği testle kanıtlanıyor (`pnpm pack:check`)
Bağlam: "Testler dist'ten çıkarıldı" bir iddiaydı; `files` alanına bakarak
doğrulanamıyordu çünkü sorun `files`'ta değil `dist`in içeriğindeydi.
Seçenekler: kod incelemesine güvenmek · `npm pack --dry-run` çıktısını elle
okumak · paketleyip içeriği programatik denetlemek
Karar: `tools/pack-check.mjs` — dört paketi gerçekten paketler, tarball'ı
zlib ile açıp yolları listeler, yasaklı desen (test, map, `src/`, `.env`,
`.npmrc`, anahtar, `node_modules`) bulursa exit 1; LICENSE/NOTICE/README
yoksa yine exit 1.
Gerekçe: Bu projenin kendi iddiası "ölçmediğini geçti sayma". Yayın
hazırlığında aynı standart geçerli: denetimin gerçekten yakaladığı,
geliştirme build'i paketlenerek kanıtlandı (9 test dosyası + 40 map
yakalandı, exit 1). `tar` komutuna kabuk açmak yerine `node:zlib` ile
başlıkların yürünmesinin sebebi Windows: GNU tar `C:\...` yolunu uzak sunucu
adresi sanıyor ve denetim hiç koşamıyordu.
Geri dönüş maliyeti: düşük

## 2026-09-01 — Yayın yolu `pnpm publish`, npm değil
Bağlam: Paketler birbirine `workspace:*` ile bağlı.
Seçenekler: `npm publish` · `pnpm publish`
Karar: `pnpm publish`. `pnpm release` script'inde sabit, docs/releasing.md'de
gerekçesiyle yazılı.
Gerekçe: `workspace:*` belirtecini gerçek sürüm numarasına çeviren pnpm.
`npm publish` onu olduğu gibi bırakır ve kurulamayan bir tarball yayımlar —
üstelik sessizce, çünkü paketleme başarılı görünür. Hata ancak bir kullanıcı
kurmaya çalıştığında ortaya çıkar ve sürüm geri alınamaz.
Geri dönüş maliyeti: düşük

## 2026-09-01 — Sürüm yükseltme bir PR, doğrudan yayın değil
Bağlam: `release.yml` main'e her push'ta yayımlayabilirdi.
Seçenekler: main'e push = yayın · changesets'in sürüm PR'ı akışı
Karar: İkincisi. Changeset girince "Version Packages" PR'ı açılır; o PR
birleşince yayımlanır.
Gerekçe: npm yayını geri alınamaz. Yayımlanacak sürüm numarasının
birleştirilmeden önce görünür olması, bu geri alınamazlığın tek makul
karşılığı. Ayrıca CHANGELOG'un gözden geçirilecek bir yeri oluyor.
Geri dönüş maliyeti: düşük

## 2026-09-01 — `NPM_TOKEN` yoksa yayın işi koşmaz, sessizce atlanmaz
Bağlam: Secret henüz tanımlı değil ama workflow eklenecekti.
Seçenekler: workflow'u secret gelene kadar eklememek · secret yokken
başarısız olmak · guard işiyle atlamak ve uyarı yazmak
Karar: Üçüncüsü. `guard` işi token'ın varlığını çıktıya çevirir; `release`
işi ona bağlı. Token yoksa `::warning::` yazılır ve docs/blockers.md'ye
yönlendirilir.
Gerekçe: Secrets bağlamı iş seviyesindeki `if` içinde okunamıyor, o yüzden
guard bir iş olmak zorunda. Kırmızı bir CI, sebebi "henüz token yok" olan
bir durumda yanlış sinyal — ekip kırmızıyı görmezden gelmeyi öğrenir. Sessiz
atlama ise daha kötü: yayımlandı sanılır. Uyarı ikisinin arası ve doğru olanı.
Geri dönüş maliyeti: düşük

## 2026-09-01 — Token geçerliliği yayından önce sınanıyor, `guard` yetmiyor
Bağlam: `guard` işi yalnızca `NPM_TOKEN` secret'ının var olup olmadığını
biliyor. npm granular access tokenları yazma izniyle en fazla 90 gün yaşıyor;
süresi dolmuş bir token da "dolu"dur ve guard'dan geçer.
Seçenekler: guard'ı yeterli saymak · publish hatasına bırakmak · pahalı
adımlardan önce `npm whoami` ile sınamak
Karar: Üçüncüsü. `setup-node`'dan hemen sonra `npm whoami`; başarısızsa
`::error::` ve docs/operations.md'ye yönlendirme.
Gerekçe: Kontrol olmasaydı hata `pnpm check` ve `pack:check` koştuktan sonra,
yayının tam ortasında çıkardı. Asıl risk kaybedilen dakikalar değil, **kısmi
yayın**: dört paket sırayla gönderiliyor ve kimlik hatası ortada patlarsa bir
kısmı npm'de kalır. Onarılabilir bir durum (pnpm var olan sürümü atlar) ama
hiç girmemek daha ucuz. Ayrıca hata mesajı sebebi söylüyor: `E401`
görüldüğünde kodda aranmıyor.
Geri dönüş maliyeti: düşük

## 2026-09-01 — Yayın sonrası registry'den doğrulanıyor
Bağlam: changesets'in `published: true` çıktısı aracın kendi beyanı.
Seçenekler: beyana güvenmek · registry'den okumak
Karar: `tools/verify-published.mjs` — `publishedPackages` listesindeki her
sürümü `npm view` ile registry'den okuyor, eksik varsa exit 1.
Gerekçe: Bu projenin adaptörü host'un `subtype: "success"` bildirimine tam da
bu sebeple güvenmiyor ve çapraz kontrol yapıyor; kendi yayın hattımızda daha
gevşek bir standart tutmak tutarsız olurdu. Doğrulayıcının kendisi iki yönde
sınandı: yayımlanmamış bir sürüm için exit 1, gerçekten yayımlanmış iki paket
için exit 0. Windows'ta `npm` bir `.cmd` olduğu için kabuk gerekiyor
(CVE-2024-27980) — pozitif test bunu yakaladı, aksi hâlde araç yalnızca
CI'da çalışırdı ve yerelde hep "bulunamadı" derdi.
Geri dönüş maliyeti: düşük

## 2026-09-01 — Trusted publishing ertelendi, kurulmadı
Bağlam: 90 günlük token yenileme döngüsünün kalıcı çözümü trusted publishing
(OIDC): saklanan secret yok, dolayısıyla yenilenecek bir şey de yok.
Seçenekler: şimdi kurmak · 0.1.0'dan sonra kurmak
Karar: Sonra. Prosedür docs/operations.md'de adım adım yazılı.
Gerekçe: Trusted publishing bir paketin npm ayarlarından yapılandırılıyor,
yani paketin önce var olması gerekiyor. Yayımlanmamış bir paket için
kurulamaz — teknik bir sıra zorunluluğu, tercih değil. Özel depoda çalıştığı
doğrulandı; yalnızca provenance üretilmiyor ve o zaten bu depo için mümkün
değil.
Geri dönüş maliyeti: düşük

## 2026-09-01 — Token dört pakete kapsamlı, scope'un tamamına değil
Bağlam: Granular access token ya bütün bir scope'a ya seçilen paketlere yetki
veriyor.
Seçenekler: `@ktlsr` scope'unun tamamına yazma · dört paketi tek tek seçmek
Karar: Dört paket tek tek. docs/operations.md'de yenileme adımı olarak yazılı.
Gerekçe: Token sızarsa yazılabilecek yer bu dördüyle sınırlı kalır. Scope
yetkisi, `@ktlsr` altına ileride eklenecek ilgisiz her paketi de kapsardı —
üstelik sessizce, çünkü token'ı yeniden üretmek gerekmez. Bedeli: yeni bir
paket eklendiğinde tokenın güncellenmesi gerekiyor. Unutulursa `E403` veriyor
ve o hata operations.md'deki tabloda tanımlı.
Geri dönüş maliyeti: düşük

## 2026-09-01 — Klasik npm tokenları artık yok; belgeler düzeltildi
Bağlam: Yayın hazırlığında `.env.example` ve docs "Classic Token >
Automation" diyordu.
Karar: Belgeler granular access token'a göre düzeltildi.
Gerekçe: npm Kasım 2025'te klasik token üretimini kapattı ve mevcut olanları
iptal etti; Şubat 2026'da hepsi öldü. Bugün tek seçenek granular access token
ve yazma izinlilerin ömrü 90 günle sınırlı. Yanlış menü adı tarif eden bir
prosedür, tam da acele edildiğinde okunacak yerde işe yaramaz.
Kaynak: github.blog changelog, 2025-11-05 ve 2025-12-09.
Geri dönüş maliyeti: düşük

## 2026-09-01 — Kalibrasyon yayın öncesi zorunlu adım
Bağlam: Assay bugüne kadar yalnızca yeşil sonuç üretmişti. Yeşil sonuç iki
durumda aynı görünür: araç çalışıyordur, ya da araç hiçbir şey ölçmüyordur.
Seçenekler: birim testlerine güvenmek · yayından sonra bakmak · kasıtlı
başarısız vakalarla gerçek koşum yapmak
Karar: Üçüncüsü. `examples/calibration*.suite.yaml` ve
`examples/calibration/` altındaki iki fixture skill; sonuç
docs/calibration.md.
Gerekçe: Birim testleri motorun mantığını kanıtlıyor ama uçtan uca zinciri
(host → adaptör → kanıt → assertion → verdict → çıkış kodu) kanıtlamıyor.
Kalibrasyon 36 gerçek koşumla üç durumun üçünü de üretti ve dört çıkış kodunu
doğruladı. Ayrıca bir kusur buldu: ilk `unknown` vakası hedef skill'in
"do not run shell commands" talimatıyla çakışıyordu, yani skill'i değil benim
kurduğum vakayı ölçüyordu — ayrı bir fixture'la düzeltildi.
Geri dönüş maliyeti: düşük

## 2026-09-01 — `regressed` kalibrasyonda üretilemedi, kayıt altına alındı
Bağlam: `compare` üç sonuç üretebiliyor: `within_noise`, `regressed`,
`unknown`. Kalibrasyon ilk ve üçüncüyü gerçek koşumlarla üretti;
`regressed` üretilemedi.
Seçenekler: ~40 ek koşumla (≈$1) zorlamak · suite'i değiştirerek taklit
etmek · eksiği yazıp yayına devam etmek
Karar: Üçüncüsü. docs/calibration.md'de "üretilemeyen verdict" başlığı
altında gerekçesiyle yazıldı.
Gerekçe: `regressed` yalnızca güven aralıkları ayrık olduğunda üretiliyor ve
N=3'te aralıklar %0–56 kadar geniş; %100'den %0'a düşüş bile ayrık çıkmıyor.
Bu tasarımın istediği davranış. Taklit etmek mümkün değil: suite ve skill
pinli, değiştirilince karşılaştırma `unknown`'a düşüyor — sahte regresyon
üretme yolu bilerek kapatılmış. Eksiği gizlemek, tam da bu projenin
yasakladığı şey olurdu; yazmak ve maliyetini söylemek doğrusu.
Geri dönüş maliyeti: düşük

## 2026-09-01 — Yayın `workflow_dispatch` ile, push ile değil
Bağlam: `release.yml` main'e her push'ta koşuyordu ve depoda changeset
kalmadığında `changesets/action` doğrudan publish moduna geçiyor. Yani belge
düzelten bir commit bile npm'e gitmeye çalışıyordu; yayın hazırlığı sırasında
bu iki kez tetiklendi.
Seçenekler: "changeset yoksa yayımla" davranışını sürdürmek · yayını ayrı bir
tetikleyiciye almak
Karar: `push` yalnızca sürüm hazırlığı yapar (`publish` girdisi boş geçilir);
yayın `workflow_dispatch` ve `confirm: yayimla` onay metniyle.
Gerekçe: npm yayını geri alınamaz. Geri alınamaz bir eylemin tetiği, sıradan
bir commit'in yan etkisi olamaz. Onay metni ikinci bir kilit: yanlışlıkla
açılan bir koşum yayımlamıyor. Bedeli bir ek komut; karşılığı, yayının ne
zaman olacağının kesin olması.
Geri dönüş maliyeti: düşük

## 2026-09-01 — Provenance açıldı, elle yayının bedeli kabul edildi
Bağlam: Depo public yapıldı; npm provenance artık mümkün.
Seçenekler: kapalı bırakmak · açmak
Karar: Açık. `id-token: write` + `publishConfig.provenance: true`.
Gerekçe: Provenance, yayımlanan tarball'ın hangi commit'ten hangi iş akışıyla
derlendiğini imzalı olarak kanıtlıyor — ölçüm dürüstlüğü satan bir aracın
kendi dağıtım zincirinde bunu atlaması tutarsız olurdu. Bedeli: provenance
yalnızca CI'da üretilebiliyor, elle yayın `--no-provenance` istiyor ve o
sürüm kaynağını kanıtlamıyor. Bu yüzden elle yayın bir kaçış yolu olarak
belgelendi, tercih edilen yol olarak değil.
Geri dönüş maliyeti: düşük

## 2026-09-01 — Kimlik doğrulama trusted publishing, token hattan çıkarıldı
Bağlam: 0.1.0'ın ilk yayın denemesi `EOTP` ile düştü — npm'in varsayılan paket
ayarı publish için 2FA ya da bypass-2FA yetkili token istiyor ve CI interaktif
istemi cevaplayamıyor. Trusted publishing kurulunca ikinci deneme geçti ve log
"No NPM_TOKEN found, but OIDC is available" dedi.
Seçenekler: bypass-2FA yetkili tokenı hatta bırakmak · token'ı çıkarıp yalnızca
OIDC'ye dayanmak
Karar: `NPM_TOKEN` iş akışından tamamen çıkarıldı. `guard` işinin token
kontrolü ve `npm whoami` adımı kaldırıldı; `id-token: write` kaldı.
Gerekçe: changesets/action token bulduğunda OIDC'yi kullanmıyor, yani token'ı
bırakmak trusted publishing'i sessizce devre dışı bırakırdı — ve bypass-2FA
yetkisi npm tarafından kullanımdan kaldırılıyor (≈Ocak 2027'de yayın yetkisi
gidiyor). Token'sız hatta yenilenecek secret, sızacak sır ve 90 günlük döngü
yok. Bedeli: elle yayın artık mümkün değil, çünkü OIDC kimliği yalnızca
yapılandırılmış iş akışından geliyor. Bu bir kayıp değil — denetlenmemiş bir
kaçış yolunun kapanması.
Geri dönüş maliyeti: düşük (token geri eklenebilir, ama eklenmemeli)

## 2026-09-01 — Yayın doğrulaması changesets'in bayrağına değil, yayın moduna bağlı
Bağlam: 0.1.0 başarıyla yayımlandı ama "yayımlanan sürümler registry'de
görünüyor mu" adımı atlandı. Sebep: adım `steps.changesets.outputs.published`
koşuluna bağlıydı; kendi yayın komutumuzu (`pnpm -r publish`) kullandığımız
için action çıktıyı ayrıştıramıyor ve bayrağı `false` bırakıyor.
Seçenekler: changesets'in kendi publish komutunu kullanmak · bayrağı düzeltmeye
çalışmak · koşulu yayın moduna bağlayıp paket listesini manifestolardan okumak
Karar: Üçüncüsü. Koşul `needs.guard.outputs.publishing == 'true'`;
`verify-published.mjs` `PUBLISHED_PACKAGES` boşsa dört manifestodan okuyor.
Gerekçe: Doğrulamanın varlık sebebi "aracın beyanına güvenme" idi ve tam da
aracın bir beyanına bağlanmıştı. Paketler yayımlandı, doğrulama sessizce
atlandı ve bunu ancak elle bakınca fark ettim — ölçüm aracının kendi hattında
kabul edilemez. Manifestolar yayımlanan sürümün tek doğruluk kaynağı zaten.
Geri dönüş maliyeti: düşük

## 2026-09-02 — İlk yönetici aracı imaja kopyalanıyor, instrumentation'a taşınmadı
Bağlam: `docs/deploy.md` `docker compose exec web node tools/create-user.mjs`
diyordu ama `tools/` üretim imajında yoktu; komut çalışmayacaktı.
Seçenekler: bootstrap'ı `instrumentation.ts` üzerinden sunucu sürecinde
koşturmak · `tools/`u imaja kopyalamak · kayıt ekranı açmak
Karar: İkincisi. `Dockerfile` yalnızca `tools/create-user.mjs`yi kopyalıyor.
Gerekçe: Önce birincisi denendi ve **derlemeyi kırdı**. `middleware.ts` var
olduğu için Next `instrumentation.ts`yi edge çalışma zamanı için de derliyor;
oradan `packages/db` → `@prisma/adapter-pg` → `pg` zinciri `fs`, `path` ve
`stream` istiyor ve edge'de bunlar yok. Dosya içindeki `NEXT_RUNTIME`
kontrolü çalışma zamanında; webpack yine de bundle'a alıyor. Commit geri
alındı (9bd7e18 → revert).
Kopyalama yaklaşımının kendi riski var: araç workspace paketlerini import
ediyor ve bunlar standalone çıktısında yalnızca `apps/web` onları izlediği
için bulunuyor. Bu varsayım sessizce değişebilir — auth bir gün argon2'yi
bırakırsa araç çalışma zamanında kırılır. Bu yüzden Dockerfile derleme
sırasında ikisini de gerçekten import ediyor: çözülemezse derleme durur.
Bu turdaki üç dağıtım hatasının ortak dersi bu — hata çalışma zamanında
değil, derlemede görünmeli.
Geri dönüş maliyeti: düşük

## 2026-09-02 — İlk yönetici tek seferlik API ucundan
Bağlam: `tools/create-user.mjs` üretimde iki kez çalışmadı. Önce `tools/`
imajda yoktu; kopyalanınca da `@ktlsr/assay-db` `/app`ten çözülemedi —
Next'in standalone çıktısı workspace paketlerini üst düzeyde açmıyor. İkisi
de dağıtımda kanıtlandı. Arada `instrumentation.ts` üzerinden bootstrap
denendi ve derlemeyi kırdı: `middleware.ts` var olduğu için o dosya edge
için de derleniyor ve `pg` zinciri `fs`/`path`/`stream` istiyor.
Seçenekler: Postgres'i dışarı açıp yerelden koşmak · kayıt ekranı ·
tek seferlik API ucu
Karar: `POST /api/bootstrap`.
Gerekçe: Rota sunucu çalışma zamanı için derleniyor ve bağımlılıkları oraya
izleniyor — `/api/runs` aynı paketi aynı şekilde kullanıyor ve üretimde
çalıştığı ölçüldü (405 dönüyordu). Yani çözümün işe yarayacağı tahmin değil,
gözlem. Postgres'i dışarı açmak geçici de olsa veritabanını internete
verirdi.
Üç kilit: `ASSAY_BOOTSTRAP_TOKEN` yoksa uç 404 (varlığı sızmıyor), token
eşleşmezse 401, zaten bir ADMIN varsa 409. Değişken açık unutulsa bile
ikinci bir yönetici açılamıyor. Uç ayrıca yayın modunda middleware ile
kapatılıyor.
Geri dönüş maliyeti: düşük

## 2026-09-02 — Yayın modunda giriş kapatılmıyor, kimlik doğrulama arkasında kalıyor
Bağlam: İlk kurulumda `/signin`, `/admin` ve `/settings` yayın modunda 404
dönüyordu. Sonucu şu oldu: siteyi yönetmek için yayın modunu kapat, dağıt,
işini yap, aç, tekrar dağıt — her yönetim işi iki fazladan dağıtım.
Seçenekler: kapalı tutmak · kimlik doğrulama arkasında açık bırakmak ·
tahmin edilmesi zor gizli bir yol
Karar: İkincisi. Yayın modunda yalnızca `/dev`, `/compare` ve
`/api/bootstrap` kapalı.
Gerekçe: İlk talep zaten "kapat **veya** kimlik doğrulama arkasına al"
diyordu. `/admin` ve `/settings` `requireAdmin`/`requireUser` ile korunuyor
(apps/web/lib/guard.ts); yetkisiz ziyaretçi yalnızca giriş ekranını görür.
Kapalı olan üçü ise gerçekten ziyaretçiye yarım uygulama gösteriyor:
`/dev/components` bir bileşen kataloğu, `/compare` kimlik doğrulama bile
istemeyen ve koşum kimliği olmadan boş bir form, `/api/bootstrap` işini
bitirmiş bir kurulum ucu. Gizli yol seçeneği karanlıkta güvenlik olurdu.
Geri dönüş maliyeti: düşük

## 2026-09-02 — Ekran görüntüsü aracı (playwright) eklendi
Bağlam: docs/workflow.md arayüzü etkileyen her adımdan sonra iki temada
ekran görüntüsü istiyor. Depoda tarayıcı otomasyonu yoktu ve görsel
doğrulama bugüne kadar yapısal kontrole (CSS'te iki tema seçicisi var mı,
viewport meta yerinde mi) indirgeniyordu.
Seçenekler: yapısal kontrolle yetinmek · playwright eklemek
Karar: `playwright` devDependency + `tools/shoot.mjs`.
Gerekçe: Giriş ekranı tasarımı istendiğinde yapısal kontrol yetmez oldu —
"düğmeler birbirinin aynı görünüyor" gibi bir kusur ancak bakınca görülür.
Araç her yol için üç kare alıyor (açık, koyu, 375px mobil) ve yatay taşmayı
ölçüp raporluyor; taşma sessizce kaçan bir hata türü.
Tema `data-theme` ile zorlanıyor, sistem tercihine bırakılmıyor: aksi hâlde
sonuç koşumu çalıştıran makineye bağlı olurdu.
Geri dönüş maliyeti: düşük

## 2026-09-03 — Kırılmayan vaka seti için ikinci, sınırda set koşuldu

Bağlam: Üç skill ölçüldü; `doc-coauthoring` ve `mcp-builder` setleri 90/90
geçti. Sözleşme "hiçbir negatif kırılmadıysa daha sınırda bir set öner"
diyor.
Seçenekler: yalnızca öneriyi yazmak · ikinci seti yazıp koşmak
Karar: İkincisi. `*-borderline.suite.yaml` setleri yazıldı ve koşuldu.
Gerekçe: Öneri bir iddiadır, koşum bir ölçümdür — ve bu projenin tamamı bu
ayrımın üstünde duruyor. Karşılığı da alındı: `doc-coauthoring` aynı skill,
aynı model ve aynı pinlerle %100 ve %51 precision verdi. Farkın tamamı vaka
setinden geliyordu. Bu, tek başına en değerli bulgu oldu ve yalnızca
"önerseydim" görünmezdi. `mcp-builder` ikinci sette de kırılmadı; bu da
ölçülmüş bir sonuç, tahmin değil.
Bedeli: iki ek koşum, ~$16 ve ~3 saat.
Geri dönüş maliyeti: düşük

## 2026-09-03 — Yakın komşu tek eksende ayrılmalı

Bağlam: `doc-coauthoring`'in ilk seti kusursuz göründü. İzler sebebi
gösterdi: dört negatifin dördünde de ajanın önünde dönüştürülecek bir kaynak
(kod, düzyazı, commit listesi) vardı; üç pozitifte içerik yalnızca
kullanıcının kafasındaydı. Set, ölçmek istediğim özelliği değil bu ikinci
değişkeni ölçüyordu.
Seçenekler: sonucu olduğu gibi raporlamak · değişkeni sabitleyip yeniden
ölçmek ve yöntemi kayda geçirmek
Karar: İkincisi. Değişmez #5'e pratikte bir ek şart: negatif, pozitiften
**yalnızca ölçülmek istenen özellikte** ayrılmalı; başka hiçbir şeyde değil.
Gerekçe: Negatifin var olması yetmiyor. Yanlış eksende uzak duran bir negatif
suite'i geçirir ve skill'i ölçülmüş gösterir — değişmez #5'in tam olarak
engellemek istediği yanlış güvenlik hissi, bir adım ötede yeniden üretiliyor.
İkinci set bunu kanıtladı: eksen sabitlenince precision %100'den %51'e düştü.
Sonuç: 90/90 geçen bir tetiklenme suite'i bir başarı değil, bir uyarıdır.
Araç bugün bunu söylemiyor; docs/measurements.md'ye eksik olarak yazıldı.
Geri dönüş maliyeti: düşük

## 2026-09-03 — `examples.test.ts` alt dizinleri de kapsıyor

Bağlam: Test yalnızca `examples/*.suite.yaml` glob'unu kullanıyordu; alt
dizinlerdeki suite'ler (`examples/dogfood/`, yeni `examples/measurements/`)
şema değişikliğine karşı korumasızdı.
Seçenekler: olduğu gibi bırakmak · glob'u `examples/**/*.suite.yaml` yapmak
Karar: İkincisi. Kapsam 6 dosyadan 18'e çıktı.
Gerekçe: Testin varlık sebebi "şema değişip de örnekler güncellenmezse burası
kırmızıya döner". Örneklerin üçte ikisi kapsam dışıydı, yani test amacının
üçte birini yapıyordu. Tek karakterlik düzeltme.
Geri dönüş maliyeti: düşük

## 2026-09-03 — Ölçüm fixture'ları lint kapsamı dışında

Bağlam: `examples/measurements/fixtures/` altındaki dosyalar kasten bozuk
(tanımsız `validator`, yanlış toplam hesabı) ve tarayıcıda koşuyor; ESLint
`no-undef` ile 9 hata verdi.
Seçenekler: fixture'lara `eslint-disable` serpiştirmek · tarayıcı globals'ı
tanımlamak · dizini ignore listesine almak
Karar: `examples/**/fixtures/**` ignore.
Gerekçe: `no-undef` hatası burada bir kusur değil, **ölçülen şeyin kendisi**:
`validator is not defined` tam da ajanın tarayıcıda bulması beklenen hata.
Onu susturmak fixture'ı bozar. Globals tanımlamak da yanlış olurdu —
bu dosyalar bizim kaynak kodumuz değil, ölçüm girdisi. `tools/fixtures/**`
zaten aynı gerekçeyle muaftı.
Geri dönüş maliyeti: düşük

## 2026-09-03 — Ayrım gücü notu `core`'da, ve verdict'i etkilemiyor

Bağlam: Ölçüm raporu (docs/measurements.md) aracın 90/90 geçen bir suite ile
zayıf bir suite'i ayırt etmediğini buldu. Uyarının nereye konacağı ve ne kadar
sert olacağı belirsizdi.
Seçenekler: (a) uyarıyı yalnızca terminal renderer'ında hesaplamak ·
(b) `core`'da `RunSummary`'ye türetilmiş alan · (c) uyarıyı verdict'e veya
çıkış koduna bağlamak
Karar: (b) — `RunSummary.discrimination { cases, attempts, falsePositives,
untested }`. Not terminal ve HTML raporunda gösteriliyor; `verdict` ve çıkış
kodu değişmiyor.
Gerekçe: (a) iki tüketici (terminal, HTML) ve ileride hosted taraf için aynı
hesabı üç yere kopyalamak demekti; üçü er geç ayrışırdı. (c) daha cazipti ama
yanlış: "negatiflerin hepsi geçti" bir ölçüm başarısızlığı değil, ölçümün
kapsamı hakkında bir bilgi. CI'ı bu yüzden kırmak, kullanıcıyı negatifleri
zayıflatmaya değil suite'i susturmaya iter. Ayrıca `unknown` ile karışırdı:
`unknown` "ölçemedik" demek, bu ise "ölçtük ama neyi ölçtüğümüz sınırlı".
Kanıt: `webapp-testing` taban koşumu hâlâ `FAIL` (bir pozitif kaçtı) ve notu
da taşıyor — ikisi bağımsız.
Ölçülemeyen negatif attempt'ler paydaya girmiyor: okunamamış bir negatif
ayrım gücü hakkında da bir şey söylemez (değişmez #1 ile aynı mantık).
Kapsam: `apps/web` aynı alanı okuyabiliyor ama notu göstermiyor; yayımlanmayan
bir paket olduğu için 0.1.1'in dışında bırakıldı.
Geri dönüş maliyeti: düşük (türetilmiş alan, kayıt şeması değişmedi)

## 2026-09-03 — DÜZELTME: 0.1.0 OIDC ile değil, token ile yayımlanmıştı

Bağlam: 2026-09-01 tarihli "Kimlik doğrulama trusted publishing, token hattan
çıkarıldı" kaydı, 0.1.0'ın trusted publishing (OIDC) ile yayımlandığını
söylüyor ve dayanağı olarak koşum kütüğündeki şu satırı gösteriyordu:
`No NPM_TOKEN found, but OIDC is available - using npm trusted publishing`.
**Bu okuma yanlıştı.** O satır changesets/action'ın kendi `NPM_TOKEN`
değişkenini bulamadığını söylüyor; gerçek kimlik bilgisi `setup-node`'un
`.npmrc`'ye yazdığı `NODE_AUTH_TOKEN` ile geliyordu ve o sırada iş akışında
hâlâ tanımlıydı.

Kanıt (üçü birden):
1. `npm view @ktlsr/assay-core@0.1.0 _npmVersion` → **10.9.8**. npm'in OIDC
   token değişimi 11.5.1'de geldi; 10.9.8 trusted publishing yapamaz.
2. Başarılı koşumun commit'indeki (`efc4f16`) `release.yml` iki yerde
   `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` taşıyor.
3. `c1adebd` bu iki satırı ve `npm whoami` ön kontrolünü kaldırdı. Ondan
   sonraki **ilk** yayın denemesi olan 0.1.1, iki bağımsız koşumda da
   `E404 PUT .../@ktlsr%2fassay-core` verdi.

Yani hat, c1adebd'den beri hiçbir kimlik bilgisi taşımıyordu. Kimlik
bilgisiz bir PUT'a npm, paketin varlığını sızdırmamak için 401 değil **404**
döner; hata mesajı bu yüzden "paket yok" gibi okunuyor ve yanlış yere
baktırıyor. Provenance'ın imzalanmış olması da yanıltıcı: o Sigstore'a
GitHub OIDC'si ile yapılıyor ve npm kimlik doğrulamasından bağımsız.

Seçenekler: (a) `NODE_AUTH_TOKEN`'ı geri koymak · (b) iş akışında npm'i
>= 11.5.1'e yükseltip trusted publishing'i gerçekten çalıştırmak
Karar: (b). Yayın işine `npm install -g npm@latest` ve sürüm kapısı eklendi;
npm 11.5.1'den eskiyse yayın **publish'e hiç gitmeden** durur.
Gerekçe: (a) token'sız hat kararını geri alır ve 90 günlük yenileme
döngüsünü geri getirir — o karar hâlâ doğru, yalnızca ön koşulu eksikti.
Asıl ders ise ayrı: `npm whoami` ön kontrolü kaldırılırken yerine hiçbir şey
konmamıştı, bu yüzden kimlik bilgisi olmadan yayın denenip geri alınamaz bir
adımın ortasında patlayabiliyordu. Sürüm kapısı o boşluğu dolduruyor.
Şans eseri hasar yok: `core` bağımlılık sırasında ilk yayımlanan paket
olduğu için dördü de gitmedi; kısmi yayın olmadı.
Geri dönüş maliyeti: düşük

## 2026-09-03 — 0.1.1 trusted publishing ile yayımlandı, hat token'sız kaldı

Bağlam: Dört paket için npm'de trusted publisher kaydı yapıldıktan sonra
yayın tekrar tetiklendi (koşum `33711487808`).
Seçenekler: `NPM_TOKEN`'ı geri koymak · yalnızca OIDC ile devam etmek
Karar: OIDC. Hatta hiçbir npm kimlik bilgisi yok.
Gerekçe: Üç bağımsız kanıt OIDC'nin gerçekten kullanıldığını gösteriyor —
kütükte "No NPM_TOKEN found, but OIDC is available - using npm trusted
publishing", registry'de `_npmVersion: 12.0.2` (0.1.0'ın 10.9.8'i OIDC
yapamıyordu) ve dört pakette de provenance. Aracın kendi beyanına
güvenmiyoruz: `verify-published.mjs` dördünü registry'den okudu.
Yan doğrulamalar: `npx @ktlsr/assay@0.1.1 init <dizin>` tek satır mesajla
exit 2 veriyor; `report` çıktısı "no negative case broke" notunu gerçek bir
kayıtta gösteriyor.
Geri dönüş maliyeti: düşük

## 2026-09-03 — Tamamlama setleri `suites/` altında, ayrı dosyalar

Bağlam: Tamamlama vakaları istendi; mevcut tetiklenme setlerine dokunulmaması
şart koşuldu. Depodaki konvansiyon `examples/measurements/`, istenen yol
`suites/<skill>-completion.suite.yaml`.
Seçenekler: konvansiyona uyup `examples/measurements/` altına koymak ·
istenen yolu kullanmak
Karar: İstenen yol. Ayrıca `tools/examples.test.ts` glob'u
`suites/**/*.suite.yaml` kapsayacak şekilde genişletildi (18 → 23 dosya).
Gerekçe: Yol açık bir talimattı. Ama testin glob'u genişletilmeseydi yeni
setler şema koruması dışında kalırdı — 2026-09-03'te alt dizinler için
düzeltilen kusurun aynısı, bir dizin ötede. Tek satırlık ek.
Geri dönüş maliyeti: düşük

## 2026-09-03 — Tamamlama setine de negatif kondu

Bağlam: İstenen tasarım "her vakada `expect.triggered: true`" idi. Değişmez #5
negatifsiz her suite'i **reddediyor** (doğrulayıcı `error` üretiyor), yani
yalnızca pozitif tamamlama vakalarından oluşan bir set hiç koşamazdı.
Seçenekler: doğrulayıcıyı "tamamlama seti" için gevşetmek · her sete bir
yakın-komşu negatifi eklemek
Karar: İkincisi. Her sette bir `trigger.negative.near_neighbor.*` vakası var
ve dosyada tamamlama vakası olmadığı yorumla yazılı.
Gerekçe: Değişmez #5 "uygulamadan önce dur ve bildir" listesinde; ölçüm
aracının kendi kuralını kendi rahatlığı için gevşetmesi tam olarak bu
listenin engellediği şey. Negatifin bedeli set başına 10 attempt; karşılığı,
setin "her istekte tetiklenen skill" durumunu hâlâ görebilmesi.
Geri dönüş maliyeti: düşük

## 2026-09-03 — Tamamlama isteminin açılışı tetiklenme setinden kopyalanır

Bağlam: İlk taslak tamamlama istemleri sıfırdan yazılmıştı ve
`doc-coauthoring` altı denemenin altısında da tetiklenmedi (0/6);
`webapp-testing` de 0/6. Ölçülen şey skill değil, istemin tonuydu.
Seçenekler: sonucu olduğu gibi raporlamak · istemleri tetiklenme setindeki
bilinen-tetikleyen cümlelerle açacak biçimde yeniden yazmak
Karar: İkincisi. Her tamamlama istemi, tetiklenme setinde 10/10 tetikleyen
açılışla başlıyor; üzerine YALNIZCA teslim edilecek dosya ekleniyor.
Ayrıca `webapp-testing` istemlerindeki "playwright kurulu değil,
çalıştırmaya kalkma" kısıtı kaldırıldı ve ölçüm makinesine python
playwright + chromium kuruldu.
Gerekçe: 2026-09-03'teki "yakın komşu tek eksende ayrılmalı" kuralının
pozitif taraftaki karşılığı. Bir tamamlama vakası, tetikleyen bir istemden
yalnızca artefakt talebiyle ayrılmalı; başka hiçbir şeyle değil. Aksi hâlde
"tetiklenmedi" sonucu skill hakkında değil, istem hakkında bir ifade olur.
"Çalıştırma" kısıtı da aynı hatanın bir başka biçimiydi: tarayıcı sürme
aracının varlık sebebini istemden siliyordu.
Geri dönüş maliyeti: düşük

## 2026-09-03 — Kontrol vakası suite'in içinde, dışında değil

Bağlam: "Dosya istemek `doc-coauthoring`'in tetiklenmesini düşürüyor"
iddiasının kanıtı, ayrı bir geçici koşumdaydı (scratchpad).
Seçenekler: ayrı koşumu raporda anlatmak · kontrolü suite'e vaka olarak
koymak
Karar: `control.design_doc_no_artifact` — `complete.design_doc_with_outline`
ile kelimesi kelimesine aynı istem, yalnızca dosya isteyen son paragraf yok.
Gerekçe: Ayrı koşumdaki kontrol farklı pinler ve farklı bir kayıt demek;
"aynı koşulda" iddiasını okuyucunun bana güvenerek kabul etmesi gerekirdi.
Aynı suite'te yan yana duran iki vaka, aynı kayıtta, aynı dört pinle
karşılaştırılabilir. 2026-09-03'teki "öneri bir iddiadır, koşum bir
ölçümdür" kararının aynısı.
Geri dönüş maliyeti: düşük

## 2026-09-03 — Sandbox izin reddi 0.2.0'da sınıflandırılacak, mod değişmeyecek

Bağlam: `--permission-mode acceptEdits` `Write`'a izin verip kabuk
çalıştırmayı onaya gönderiyor; etkileşimsiz koşumda onay yok. Tamamlama
ölçümünde bir vakanın 10 denemesinin 10'unda en az bir kabuk çağrısı
reddedildi ve 4'ü `no_swallowed_errors`'ı tetikledi. Assay reddi sıradan bir
araç hatasından ayırmıyor.
Seçenekler: (A) olduğu gibi bırakmak · (B) varsayılanı `bypassPermissions`
yapmak · (C) reddi birinci sınıf sinyal yapmak · (D) vaka seti başına komut
allowlist'i · (E) konteyner sandbox
Karar: C ve D, 0.2.0'da; E Faz 3'te kalıyor. İzin modu değişmiyor.
Gerekçe: (B) sandbox'ın gözlediği her sınırı kaldırırdı ve H4 zaten bunu
kasıtlı olarak kapatmıştı. (E) doğru uzun vadeli cevap ama bugünkü sorunu
çözmüyor: konteynerin içinde de bir izin modeli seçmek gerekiyor. (C)
değişmez #1'in doğrudan gereği — engellediğimiz bir şeyin olmamasını skill'in
kusuru diye raporlamak, ölçemediğini "geçti" saymanın aynası. (D) izin
genişlemesini vaka setine yazıyor, yani `suiteHash`'e giriyor ve pinlenmiş bir
karar oluyor; bugünkü sessiz genel reddin tersi.
Kapanmadan önceki durum raporda açıkça yazılı: bu bir sandbox sınırı, skill
kusuru değil.
Geri dönüş maliyeti: düşük

## 2026-09-03 — Metodoloji sayfasının verisi derleme öncesi üretilip commit'leniyor

Bağlam: `/methodology` gerçek koşum kayıtlarından tablo göstermeli (sözleşme
3) ama `apps/web` runner'a bağlanamıyor (docs/stack.md) ve koşum store'ları
`.gitignore` kapsamında.
Seçenekler: koşumları veritabanına yükleyip `listRuns` ile okumak · sayfayı
elle yazılmış sayılarla doldurmak (sözleşme ihlali) · kayıtlardan JSON üretip
commit'lemek
Karar: `tools/methodology-data.mjs` → `apps/web/app/methodology/measurements.json`.
Gerekçe: Veritabanı yolu, sayfayı bir dağıtımın veri durumuna bağlardı —
yayın sunucusunda o koşumlar yüklü değilse sayfa boşalırdı, oysa yazının
kendisi o sayıların üstüne kurulu. Üretici betik commit'li ve komut sayfanın
sonunda yazılı, yani sayı elle yazılmış değil, türetilmiş: `docs/measurements.md`
tablolarıyla aynı disiplin. Kayıtların kimliği (run id, tarih, pinler) sayfada
gösteriliyor ki iddia denetlenebilsin.
Geri dönüş maliyeti: düşük

## 2026-09-03 — Ev dizini yolları da maskeleniyor

Bağlam: /methodology sayfasındaki ham iz `C:\Users\KESER\...` basıyordu.
Aynı iz HTML raporunda ve yüklenen koşum kaydında da var; bir skill yazarı
kendi raporunu paylaştığında makine kullanıcı adını da paylaşıyor.
Seçenekler: yalnızca sayfada gizlemek · yolu tamamen silmek · kullanıcı adını
maskeleyip yolun biçimini korumak
Karar: Üçüncüsü, ve `packages/core`'daki mevcut sır maskelemesinin içinde.
`C:\Users\ada\...` → `C:\Users\<user>\...`; macOS ve Linux ev dizinleri de
kapsanıyor, `runner`/`root` gibi genel hesap adlarına dokunulmuyor.
Gerekçe: Sayfada gizlemek sızıntının bir yüzünü kapatıp diğer ikisini açık
bırakırdı; asıl yüzey kayıt. Yolu tamamen silmek iz sinyalini bozar — hangi
dosyanın açıldığı ölçümün bir parçası; silinen tek şey kimlik olmalı.
`redactDeep` zaten runner'da iz ve env üzerine uygulanıyordu, yani tek bir
desen listesi üç tüketiciyi birden kapsıyor.
Not: sayfanın verisi maskeleme eklenmeden ÖNCE yazılmış kayıtlardan
üretiliyor, bu yüzden `tools/methodology-data.mjs` de maskeleme uyguluyor ve
üretilen JSON'da maskelenmemiş bir yol kalırsa exit 1 veriyor.
Geri dönüş maliyeti: düşük

## 2026-09-03 — Ölçülemeyen pin "tuttu" sayılmaz

Bağlam: `comparePins` saf eşitlik yapıyordu. Claude Code sistem promptu
hash'ini vermiyor ve alan iki koşumda da `not-provided-by-host` taşıyor —
yani ölçülmemiş bir koşul "tuttu" sayılıyor ve karşılaştırmaya sahip
olmadığı bir garanti veriliyordu. Değişmez #2 "pinlerden biri **eksik** veya
farklıysa karşılaştırma yapılmaz" diyor; kod yalnızca "farklı"yı uyguluyordu.
Seçenekler: olduğu gibi bırakmak · her eksik pini kesin engel yapmak
(Claude Code'da compare tamamen ölür) · üçüncü durum + denetçi
Karar: Üçüncüsü. `PinComparison` artık `unavailable` da döndürüyor; eksik
pin karşılaştırmayı durduruyor. İstisna: `Pins.environmentHash` iki koşumda
da dolu ve eşitse pin 3 kapsanmış sayılıyor ve karşılaştırma açılıyor.
Adaptör bu hash'i zaten hesaplıyordu (2026-08-31 kararı) ama kayda hiç
yazılmıyordu; runner artık yazıyor.
Gerekçe: İkinci seçenek doğru ama tek başına aracın çalışan bir özelliğini
öldürürdü; eksik olan ön koşuldu, kural değil. Ortam hash'i pin 3'ün
denetçisi olarak tam da `skillHash`/`suiteHash` çiftinin işini yapıyor:
beyan edilemeyen bir koşulu içerikten yakalıyor. Attempt'ler farklı hash
bildirirse ortam koşum ortasında kaymış demektir; o durumda hiçbir değer
yazılmıyor ve pin ölçülemedi kalıyor.
Bedeli: ortam hash'i taşımayan eski kayıtlar artık karşılaştırılamıyor ve
`unknown` üretiyor. Bu doğru cevap — o koşumlarda koşulların aynı olduğu
gerçekten bilinmiyor.
Geri dönüş maliyeti: orta (kayıt şemasına alan eklendi, opsiyonel)

## 2026-09-03 — Beyaz zemin, canlı ölçüm alanı ve iki sütunlu bölüm ızgarası

Bağlam: Üç sayfanın (tanıtım, giriş, metodoloji) "premium seviyede, animasyonlu
ve hareketli arka planlı, beyaz zeminli" yeniden tasarımı istendi. DESIGN.md
zemini soğuk gri (#f1f3f3) yapıyor, gradienti ve bölüm animasyonlarını
yasaklıyor. Ayrıca "bazı metinler sarılıyor ve yanlarında boşluk bırakıyor"
kusuru bildirildi.
Seçenekler: dünyayı değiştirmek (konsept turnuvası) · dünyayı devralıp
genişletmek
Karar: İkincisi. Sertifika konsepti duruyor; üç kural değişti.
1. Zemin saf beyaz, yükseltilmiş yüzey bir ton koyu — ilişki tersine döndü.
2. Hareketli zemin var ama ürünün kendi işaretlerinden: milimetrik kâğıt
   ızgarası ve yavaşça açılıp kapanan güven aralıkları. Gradient bulutu yok.
3. Bölümler geniş ekranda iki sütun: işaretçi solda (yapışkan), gövde sağda.
Gerekçe: Kullanıcı sertifika kimliğini reddetmedi, bitişini istedi; dünyayı
değiştirmek ürün gerçeğini atmak olurdu (impeccable/new-work: "Established
world: inherit it"). Hareketli zemin ölçümden yapılınca marka rengi eklemeden
"premium" oluyor ve renk hâlâ yalnızca verdict'te. İki sütun ızgarası
bildirilen kusurun kök sebebini kapatıyor: çift daralma (sütun 60rem,
paragraf 66ch) her paragrafın sağında ölü alan bırakıyordu; artık o alan
bölümün başlığı.
Sınır: ızgara yalnızca `:has(> .section-title)` olan düzyazı bölümlerine
uygulanıyor. Referans bölümlerinde gövde üç sütunlu bir bileşen ızgarası ve
onu dar sütuna sokmak öksüz bir üçüncü kart bırakıyordu — ekran görüntüsü
yakaladı.
Geri dönüş maliyeti: düşük (token ve CSS)

## 2026-09-03 — Tetiklenme kontrolü kayıtta kendi alanında

Bağlam: Gerçek bir koşum kaydında sayı ile liste uyuşmuyordu. Tetiklenme
vakalarında `assertions: []` boştu ama `reason` "all 1 assertion(s) passed"
diyordu; tamamlama vakasında dört assertion listeleniyor, `reason` "all 5"
diyordu. Sebep: `runAttempt` tetiklenme kontrolünü `combineVerdicts`'e
veriyor ama kayda yalnızca assertion'ları yazıyordu; `combineVerdicts` ise
başarı cümlesinde saydığı her şeye "assertion" diyordu.
Seçenekler: (a) tetiklenme kontrolünü `assertions` listesine sentetik bir üye
olarak eklemek · (b) sayımdan çıkarmak · (c) kayda kendi alanı olarak eklemek
ve sayılan şeyin adını düzeltmek
Karar: (c). `Attempt.triggerCheck?: VerdictDetail` eklendi; `combineVerdicts`
ikinci bir `noun` parametresi aldı ve runner ona `'check'` geçiyor. Kayıttaki
sayı artık `assertions.length + (triggerCheck ? 1 : 0)`'a eşit.
Gerekçe: (a) `assertions` listesini kirletirdi — o liste vaka setinde BEYAN
EDİLEN assertion'ların sonucu ve her üyesi `Assertion` birleşiminden bir tip
taşıyor. Sentetik bir üye, `assertion.type` üzerinden dallanan her tüketiciyi
kırar ve kayıt artık suite'i yansıtmazdı. (b) gerçekten koşan bir kontrolü
görünmez yapardı ve yalnızca tetiklenme ölçen bir vakada "all 0" ya da
"nothing was asserted" derdi — oysa bir şey ölçülmüştü.
Kayıt zaten `trigger` alanında ham gözlemi taşıyordu; eksik olan, o gözlemin
beklentiyle karşılaştırılmasıydı. İkisi ayrı: biri ne olduğunu, diğeri
beklenenin olup olmadığını söylüyor. Ekranda da ayrı gösteriliyor.
Testle sabitlendi: geçen her attempt'te `reason`'daki sayı listelenen kontrol
sayısına eşit. Kaydı ileride okuyup rapor üretecek biri buna güvenebilmeli.
Geri dönüş maliyeti: düşük (kayda opsiyonel alan; eski kayıtlar okunmaya
devam ediyor, `storeVersion` değişmedi)

## 2026-09-03 — Terminal her iki temada da kendi koyu zemininde

Bağlam: Hero'daki terminal bloğu terminale benzemiyordu: sayfanın zeminini
kullanıyordu, arkadaki milimetrik ızgara içinden geçiyordu ve blok boşta
duruyordu. Sebep bir detay değil, benim daha önce verdiğim yanlış bir karardı:
bitiş incelemesindeki "kart yok" kuralını (DESIGN.md) `.term`e de uygulayıp
dolgusunu kaldırmıştım.
Seçenekler: sayfa zemininin bir tonunu kullanmak · yalnızca koyu temada koyu
olmak · her iki temada da kendi koyu zeminine oturmak
Karar: Üçüncüsü. Terminal her iki temada da koyu; açık temada beyaz sayfanın
tek koyu nesnesi, koyu temada sayfadan bir tık daha derin.
Gerekçe: "Kart yok" kuralı VERİ blokları için — veri kutuda değil çizgide
durur. Terminal bir veri bloğu değil, farklı bir malzeme: sayfanın malzemesi
kâğıt, terminal bir ekran. Kâğıdın üstünde bir ekran göstermek sertifika
konseptiyle çelişmiyor, onu tamamlıyor (bir rapora yapıştırılmış konsol
çıktısı). Terminal her yerde koyudur; bu bir tema tutarsızlığı değil.
Palet BÜYÜMEDİ: `--term-*` tokenlarının değerleri koyu temanın kendi
paletinden birebir alındı, ölçüm renkleri dahil. Yeni renk üretilmedi, yazı
tipi mono kaldı, pencere süsü (mac noktaları, başlık çubuğu) eklenmedi.
Ayrım komut bandıyla yapılıyor: yazılan satır bir tık açık zemin ve tam
kontrast mürekkep, çıktı daha sessiz — gerçek bir terminalde girdi ile
program çıktısı aynı şey değil.
Geri dönüş maliyeti: düşük (token + CSS)

## 2026-09-03 — Yapışkan başlık ve buzlu cam; camın altında mürekkep güçlenir

Bağlam: Başlık yapışkan olsun ve "buzlu/premium" bir zemin taşısın istendi.
Craft floor "dekor olarak cam" yasaklıyor.
Karar: Cam uygulandı ama dekor olarak değil: yapışkan bir başlığın altından
içerik akıyor ve başlık hem okunabilir kalmalı hem altındakini gizlememeli.
`backdrop-filter` bu belirli soruna verilen belirli cevap. Gradient ve gölge
yok; derinlik yine hairline ile.
Ölçüm, karardan daha önemli çıktı: ilk deneme `surface %72` idi ve koyu
terminal başlığın altından geçtiğinde cam #b8b8b8'e düşüyordu. `--text-faint`
orada 2.4:1 veriyor — 4.5 eşiğinin çok altında. Üstelik o token düz beyazda
bile 4.86:1 ile sınırda; değişken zeminde sınırda bir değer, sınırın altına
düşen bir değerdir.
İki değişiklik birlikte: opaklık %86'ya (koyu temada %88) çıkarıldı ve
başlıktaki bağlantıların mürekkebi `--text-faint`ten `--text-muted`e alındı.
Sabit zeminli bir başlıkta faint yeterliydi; camın zemini içerikle değişiyor.
`saturate(0.8)`: kaydırırken bir verdict rengi camın altından geçtiğinde
başlığı boyamıyor — kroma ölçüme ait, başlığa değil.
Yedekler: `backdrop-filter` desteklenmiyorsa ve
`prefers-reduced-transparency: reduce` iken zemin opak. Okunabilirlik efektin
önünde.
Geri dönüş maliyeti: düşük

## 2026-09-03 — Kanıtın yokluğu kanıt sayılamaz (0.1.3'e alındı)

Bağlam: Token iptalinden sonra aynı koşum üç farklı verdict üretti:
tetiklenme `unknown`, artefakt assertion'ları `fail`, `side_effect` `pass`.
Ölçüm hiç yapılmamıştı.
Sebep: tetiklenme katmanı `sessionProblem()` ile oturumun durumuna bakıyor,
assertion katmanı bakmıyor. Oturum koşmadığında çalışma dizini boş kalıyor,
`capture()` boş bir dizi dönüyor ve `evidence.files` "var ama boş" oluyor.
Sevk katmanının koruması yalnızca `undefined` denetliyor; `[]` ondan geçiyor.
Seçenekler: (A) her değerlendiriciye oturum kontrolü · (B) `Evidence`'a
`sessionFailed` bayrağı · (C) oturum çapraz kontrolden geçmediyse kanıt
alanlarını hiç doldurmamak
Karar: (C), 0.1.3'te.
Gerekçe: (A) yeni bir assertion tipi eklendiğinde unutulacak tek satır — sevk
katmanı tam da bunu önlemek için var (2026-08-31 kararı: "veri yokken pass
yok" sevk katmanında zorlanıyor). (B) aynı hatanın kılık değiştirmiş hâli:
kontrolü yine değerlendiricilere dağıtıyor. (C) hiç yeni mekanizma
gerektirmiyor; `REQUIRES` koruması zaten doğru soruyu soruyor, yalnızca
gerçeği görmüyordu.
İki yönlü ihlal olduğu not edildi: `fail` kullanıcıyı kırık skill aramaya
gönderiyor, `side_effect`in `pass`ı ise doğrudan değişmez #1'in yasakladığı
sessiz geçiş — ve ikincisi daha tehlikeli.
Ayrım korunacak: gerçekten koşup hiçbir şey yazmayan bir ajan (`completed` +
boş workspace) `fail` vermeye devam etmeli; orada ölçüm var.
Ayrı bir yama olmasının sebebi: davranış değişikliği. Bugün `fail` alan
koşumlar `unknown` alacak, CI çıkış kodu 1'den 3'e kayacak.
Geri dönüş maliyeti: düşük

## 2026-09-04 — Zeminin hareketi sürüklenen ızgaradan ölçüm halkalarına geçti

Bağlam: Kullanıcı arka planı beğenmediğini bildirdi; özellikle "aşağı doğru
olan belirip kaybolan grid parçaları". Kusur iki animasyonun birleşimiydi:
`field-drift` ızgarayı sonsuz sürüklüyor, üstündeki radyal maske de kenarları
eritiyordu — yani her çizgi ekranın bir yerinde beliriyor, başka bir yerinde
kayboluyordu. `field-interval` yatay çizgileri de açılıp kapanıyordu;
"belirip kaybolan"ın ikinci kaynağı oydu. Örnek olarak etkileşimli bir ripple
(halka) arka plan bileşeni verildi.
Seçenekler: (a) verilen bileşeni olduğu gibi almak · (b) hareketi tamamen
kaldırmak · (c) ripple fikrini alıp ürünün diline çevirmek
Karar: (c). Izgara **sabitlendi** (sürüklenme ve aralık çizgileri kaldırıldı);
yerine ölçülen bir noktadan dışa açılan üç eşmerkezli hairline halka geldi.
Halkalar kendiliğinden ~4.3 sn'de bir doğuyor, `pointerdown` olduğunda o
noktada bir tane daha doğuyor.
Gerekçe: (a) üç bağlayıcı yasağı birden çiğnerdi — verilen bileşen
`from-indigo-50 via-purple-50 to-pink-50` gradienti ve mor/mavi/pembe halkalar
kullanıyor; docs/design.md'de gradient yasak, marka vurgu rengi yok ve **kroma
yalnızca ölçüme ayrılmış**. Renkli bir zemin, "ekranda gördüğün renk bir ölçüm
sonucudur" kuralını sessizce bozardı. (b) istenen şey değildi; istenen daha
iyi bir hareketti, hareketsizlik değil. (c) halkayı ürünün kendi işaretine
bağlıyor: eşmerkezli üç halka güven aralığının radyal hâli — içteki değer,
dıştakiler belirsizlik. Kâğıt durur, üstünde olan biter hareket eder.
Uygulama farkları: halka `transform: scale` ile büyüyor (`width`/`height`
animasyonu her karede layout tetiklerdi); `styled-jsx` yerine `globals.css`
(depo konvansiyonu — bu depoda `components/ui` dizini ve `cn()` yardımcısı
yok, web bileşenleri `apps/web/app/components/` altında ve stil tek bir
global sayfada); dinleyici `window` üzerinde, alanın kendisinde değil — alan
içeriğin ARKASINDA ve `pointer-events: none`, kendi üstünde dinleseydi ya hiç
tetiklenmez ya da sayfanın tıklamalarını yutardı; aynı anda en fazla 6 halka
kümesi yaşıyor; `prefers-reduced-motion` açıkken hiç halka doğmuyor.
Bedeli: alan artık bir istemci bileşeni. Önceki hâli sıfır JS'ti ve bu bir
kayıp; karşılığında sayfanın dokunulduğunu bilen tek katmanı oldu.
Doğrulandı: `pnpm check` yeşil; dört sayfa (`/`, `/methodology`, `/signin`,
`/compare`) iki temada ve 375px'te çekildi — hepsi 200, yatay taşma yok,
konsolda hata yok. Tıklamadan 650 ms sonra üç halka canlı; 6 sn'de
kendiliğinden doğan küme de sayıldı. Next geliştirme katmanındaki "1 issue"
rozeti değişiklikten önce de vardı (stash'lenmiş taban koşumuyla karşılaştırıldı).
Geri dönüş maliyeti: düşük (tek bileşen + tek CSS bloğu)

## 2026-09-05 — Tetiklenme, çağrının varlığı değil aktivasyonun doğrulanması

Bağlam: Ayrıştırıcı bir `Skill` `tool_use` bloğu gördüğü anda "tetiklendi"
yazıyordu; eşleşen `tool_result`a hiç bakmıyordu. Impeccable pilotunda 4
kayıtlı tetiklenmenin 4'ü de reddedilmiş aktivasyondu — hiçbiri koşmamıştı —
ve rapor precision %100 dedi.
Seçenekler: (a) olduğu gibi bırakıp raporda uyarı yazmak · (b) reddi
`triggered: false` saymak · (c) reddi üçüncü bir durum yapmak
Karar: (c). `TriggerObservation` artık `refused` ve `refusals` taşıyor; hedef
skill seçilip aktive olmadıysa tetiklenme iddiası `unknown` üretiyor ve
gözlem doğruluk matrisine hiç girmiyor.
Gerekçe: (b) iki yönde de yanlış olurdu. Pozitif vaka `fail` alır ve kullanıcı
kırık olmayan bir skill'i tamir etmeye gider; negatif vaka `pass` alır ve
modelin skill'e uzandığı gizlenir — değişmez #1'in doğrudan yasakladığı sessiz
geçiş, üstelik en sinsi biçimde çünkü her negatif vaka geçer. (a) ise ölçüm
aracının kendi sayısına uyarı iliştirip yine o sayıyı basması olurdu.
Aktivasyonun doğrulanması dört yapısal engelle yapılıyor (metin eşleştirmesi
yok): host çağrıyı `permission_denials`'ta reddetti mi, `tool_result` hata
döndü mü, sonuç gövdesiz mi, sonuç hiç geldi mi.
Tavan: üçüncü engel, host'un başarılı bir `Skill` sonucunu her zaman gövdeyle
döndürdüğü varsayımına dayanıyor. Varsayım bozulursa her aktivasyon reddedilmiş
görünür ve her vaka `unknown` olur — gürültülü ama sessiz geçiş değil.
Aynı skill bir çağrıda reddedilip başka bir çağrıda aktive olduysa ölçüm
vardır ve `refused` false kalır.
Geri dönüş maliyeti: düşük (tek modül + tek alan), ama davranış değişikliği:
bugün `fail`/`pass` alan koşumlar `unknown` alacak.

## 2026-09-05 — İzin modu dışarı açıldı, varsayılan değişmedi

Bağlam: `--permission-mode` adaptörde `acceptEdits` olarak sabitti.
`allowed-tools` beyan eden bir skill bu modda hiç aktive olamıyor, yani o
skill Assay ile ölçülemiyordu.
Seçenekler: varsayılanı gevşetmek · modu dışarı açmak · vaka setine taşımak
Karar: CLI'da `--permission-mode`, adaptörde aynı adlı seçenek. **Varsayılan
`acceptEdits` kaldı.** `bypassPermissions` ayrıca `--allow-bypass-permissions`
istiyor. Bilinmeyen bir mod sessizce varsayılana düşmüyor, kullanım hatası
veriyor.
Gerekçe: Varsayılanı gevşetmek bugünkü koşumların anlamını sessizce
değiştirirdi; istenen şey seçim hakkıydı, farklı bir varsayılan değil. Vaka
setine taşımak 0.2.0-c'nin (`sandbox.allow_commands`) konusu ve ayrı bir şema
değişikliği; mod önce çalışır olmalı. Yanlış yazılmış bir modun sessizce
varsayılana düşmesi, kullanıcının ölçtüğünü sandığı şeyi ölçmemesi demekti.
Geri dönüş maliyeti: düşük

## 2026-09-05 — İzin modu ortam hash'inin içine girdi

Bağlam: Mod dışarı açılınca ölçümün bir koşulu oldu: araçları kısıtlanmış bir
skill ile kısıtlanmamış olan iki farklı ölçümdür. Kayıt bunu taşımazsa iki
farklı koşum karşılaştırılabilir görünür.
Seçenekler: yalnızca kayda yazmak · beşinci bir pin açmak · pin 3'ün
denetçisi olan `environmentHash`'e katmak
Karar: Üçüncüsü, artı `Run.permissionMode` alanı raporda okunsun diye.
Gerekçe: `init.permissionMode` zaten ayrıştırılıyordu ve hash'in dışında
bırakılmıştı; hash'in işi tam olarak "host'un bildirdiği ortam kaydı mı"
sorusunu cevaplamak. Beşinci bir pin açmak `comparePins`'in anahtar listesini
büyütür ve eski kayıtları "pin eksik" diye tamamen karşılaştırılamaz yapardı.
Hash'e katmak aynı işi yapıyor ve eski kayıtlar yalnızca "ortam kaydı" diyor.
Alan ayrıca kayıtta duruyor çünkü bir hash raporda okunmaz, mod okunur.
Bedeli: 0.2.0 öncesi kayıtlar yeni kayıtlarla karşılaştırıldığında `unknown`
üretiyor. Bu yanlış bir alarm değil — o koşumların modu gerçekten kayıtlı
değildi.
Geri dönüş maliyeti: orta (hash tanımı değişti, eski karşılaştırmalar durdu)

## 2026-09-05 — Hook olayları kanonik ize giriyor

Bağlam: Ayrıştırıcı `system` olaylarından yalnızca `init`i okuyordu.
`hook_started` ve `hook_response` akışta zaten var ve `stdout`, `stderr`,
`exit_code`, `outcome` taşıyorlar.
Seçenekler: yalnızca `ParsedStream`'e almak · ize `hook` türü eklemek ·
hook'ları görmezden gelmeye devam etmek
Karar: Yeni bir `TraceEventKind` değeri (`hook`) ve `TraceEvent.hook` alanı.
Prisma tarafında `HOOK` enum değeri, `hook` jsonb sütunu ve "HOOK olayı
hook'suz olamaz" kısıtı.
Gerekçe: Yalnızca `ParsedStream`'de tutmak onları kayda hiç sokmazdı, yani
görünmez kalırlardı. Hook'lar ölçümün görünmez değişkeni: bir `SessionStart`
hook'u sistem promptuna metin enjekte edebiliyor, bir `PreToolUse` hook'u araç
çağrısını reddedebiliyor. İkisi de skill'in davranışını değiştiriyor ve hiçbiri
skill'in kendisi değil. Kayıtta durmazlarsa iki koşum arasındaki fark
açıklanamaz kalır.
`hook_progress` bilerek dışarıda: 0.2.0'ın kapsamı started ve response.
Çıktı 2000 karakterde kesiliyor ve kesildiği metnin sonunda yazıyor — kayıt bir
CI artefaktı ve hook stdout'u gerçek koşumlarda on binlerce karakter.
Geri dönüş maliyeti: düşük (ek alan; eski kayıtlar okunmaya devam ediyor)

## 2026-09-05 — `permission_denials` okunuyor, red izde kendi alanında

Bağlam: `result.permission_denials` her koşumda geliyordu ve ayrıştırıcı yok
sayıyordu. Reddedilen bir çağrı izde sıradan bir araç hatası gibi duruyordu.
Seçenekler: yalnızca `Skill` reddi için okumak · her reddedilen çağrıyı
işaretlemek
Karar: İkincisi. `TraceEvent.refusal` reddin sebebini taşıyor ve red, çağrının
sonucuna işleniyor; sonuç hiç gelmediyse çağrının kendisine.
Gerekçe: "Skill bunu yapamadı" ile "Assay buna izin vermedi" iki farklı ölçüm
ve ikisi de araç çağrısının düşmesiyle sonuçlanıyor. İzde ayırt edilemezlerse
rapor okuyucusu yanlış yere bakar. Roadmap'teki 0.2.0-a maddesi bu; artefakt
assertion'larının reddi ayrı ele alması (0.2.0-a'nın ikinci yarısı) ve
`no_swallowed_errors`'ın redde ayrı cümle kurması (0.2.0-b) bu alanın üstüne
gelecek — bu yamada yalnızca sinyal okunuyor ve saklanıyor.
Geri dönüş maliyeti: düşük

## 2026-09-05 — `pinEnvironmentHash` hosted şemaya eklendi

Bağlam: `Pins.environmentHash` yerel kayıtta vardı ama `RunRow`'da yoktu;
yüklenen her koşumda pin 3 "ölçülemedi" kalıyor ve hosted karşılaştırma hep
`unknown` üretiyordu. İzin modu bu hash'in içine girdiği için sessiz kayıp
büyüyecekti.
Seçenekler: ayrı bir yamaya bırakmak · aynı migration'a katmak
Karar: Aynı migration.
Gerekçe: Eksik olan alan tam da bu yamanın dayandığı alan; ayrı bırakmak, izin
modunu hash'e koyup hash'i saklamamak olurdu. Zaten açılmış bir migration'a bir
sütun eklemenin maliyeti yok.
Geri dönüş maliyeti: düşük

## 2026-09-05 — Action pini depo sürümünden geride olamaz, ileride olabilir

Bağlam: `action-metadata.test.ts` `action.yml`'deki `assay-version` pinini
`packages/cli/package.json` sürümüne **tam eşitlikle** bağlıyordu. 0.2.0'ın
sürüm PR'ında test düştü: manifest 0.2.0'a çıktı, pin 0.1.3'te kaldı.
Kusur pinde değil, testin varsaydığı sırada: manifest önce hareket ediyor
(sürüm PR'ı), npm sonra (elle tetiklenen yayın koşumu). Tam eşitlik, aradaki
pencerede depoyu kırmızıya çeviriyor.
Seçenekler: (a) pini yayın sonrası ayrı bir commit'le güncellemek ·
(b) testin npm'e bakması · (c) kuralı yönlü yapmak
Karar: (c). Test artık `pin >= manifest` istiyor; geride kalmak hata, ileride
olmak değil. Pin sürüm PR'ında manifest ile birlikte yükseliyor.
Gerekçe: (a) pini kalıcı olarak bir sürüm geride bırakırdı — eylem her zaman
bir önceki CLI'ı kurardı ve tam da testin engellemek istediği durum sürekli
hâle gelirdi. (b) bir birim testini ağa bağlar, kararsızlaştırır ve yayın
penceresi boyunca yine kırmızı verirdi. (c) korunmak istenen asıl kuralı
koruyor: pin geride kalırsa eylem deponun ürettiğinden ESKİ bir CLI kurar ve
sessizce yanlış ölçüm üretir — `assay scrub` olmayan bir sürüm maskelenmemiş
kayıt yükler, 0.2.0 öncesi bir sürüm reddedilen aktivasyonları tetiklenme
sayar.
Karşılaştırma sözlük sırasıyla değil sayısal yapılıyor: `'0.10.0' < '0.9.0'`
doğru çıkar ve kural sessizce tersine dönerdi. Kuralın yönü ayrı bir testle
sabitlendi; ters çevrildiğinde kırmızıya döndüğü görüldü.
Tavan: `9.9.9` gibi bir yazım hatası artık burada yakalanmıyor. Yakalandığı
yerler duruyor — yayın sonrası `verify-published.mjs` ve eylemin kendi
kurulum adımı.
Bedeli: birleştirme ile yayın arasında `action.yml` npm'de henüz olmayan bir
sürümü gösteriyor. Pencere kısa ve kasıtlı; sırayı tersine çevirmenin bedeli
kalıcıydı.
Geri dönüş maliyeti: düşük

## 2026-09-05 — Dışarıya bakan her şey İngilizce; commit mesajları da

Bağlam: 2026-08-31 tarihli "Kullanıcıya görünen metinler İngilizce, kod
yorumları ve docs Türkçe" kararı commit mesajlarını Türkçe tarafta bırakmıştı
ve kök `README.md` hiç ele alınmamıştı. Depo public, eylem GitHub
Marketplace'te listeleniyor ve liste kök README'yi gösteriyor: uluslararası
bir geliştirici kitlesine Türkçe bir sayfa çıkıyordu.
Seçenekler: her şeyi Türkçe tutmak · yalnızca README'yi çevirmek · sınırı
"dışarıya bakan / bakmayan" ekseninde yeniden çizmek
Karar: Üçüncüsü. **İngilizce:** kullanıcıya görünen stringler, kök README,
paket README'leri, action README, CONTRIBUTING **ve commit mesajları.**
**Türkçe:** kod yorumları ve `docs/` altındaki çalışma notları.
Gerekçe: Eski ayrım "kullanıcıya görünen string" ekseninde çizilmişti ve
README bir string değil — kural onu görmüyordu. Doğru eksen dosyanın türü
değil, kime baktığı. Commit mesajları da bu tarafa geçti: depo public, geçmiş
herkese açık ve `git log` bir katkıcının okuduğu ilk şeylerden biri. Bu,
2026-08-31 kararının commit kısmını **geçersiz kılıyor**.
`docs/` Türkçe kalıyor: orası ürün belgesi değil, bakımı yapanın defteri ve
çeviri maliyeti her karar kaydında tekrar tekrar ödenirdi. Bedeli, dışarıdan
gelen birinin oraya tıkladığında şaşırması — bu yüzden dışarıya bakan her
sayfada o bağlantıların yanına `(Turkish)` notu düşüldü.
Geri dönüş maliyeti: orta (çeviri işi geri alınmaz, ama kural değiştirilebilir)

## 2026-09-05 — README'de ölçüm iddiası yalnızca kayıtlı koşumdan

Bağlam: README'nin "Durum" bölümü 150 koşumluk `xlsx` hikâyesini güncel
sonuçmuş gibi anlatıyordu ve "hosted katman henüz yok" diyordu — ikisi de
artık yanlış. Yenisini yazarken elimde daha yeni ölçümlerin **kaydı yoktu.**
Seçenekler: yeni ölçümleri isimleriyle anmak · sayılarını tahmin etmek ·
yalnızca kaydı olan ölçümleri yazmak
Karar: Üçüncüsü. Yazılan her sayı depoda duran bir koşum kaydına dayanıyor
(`docs/measurements.md`, `docs/dogfooding.md`) ve README bunu açıkça söylüyor:
"Nothing on this page is estimated."
Gerekçe: Sözleşme 3 zaten uyduruk rakamı yasaklıyor, ama asıl mesele daha
dar: bu ürünün tek iddiası ölçmediğini ölçtüm dememek. Kendi tanıtım
sayfasında kaydı olmayan bir sonucu anmak, tam da 0.2.0'da düzeltilen hatanın
pazarlama hâli olurdu. Kaydı yayımlanmamış skill'ler README'ye girmedi;
girdikleri gün sayılarıyla girecekler.
Geri dönüş maliyeti: düşük

## 2026-09-08 — 0.3.0 sırası: önce dürüst gerekçe ve hayatta kalma, sonra hız

Bağlam: 4.2.2 ölçümü (240 deneme, ~8 saat) beş kusuru canlı gösterdi ve beşi
birden 0.3.0'a sığmıyor. Sıra seçilmeliydi.
Seçenekler: (a) benimseme argümanına göre hızlı modu öne almak · (b) süreye
göre paralelliği öne almak · (c) kayıp ve yanlış gerekçeyi önce kapatmak
Karar: a(compare gerekçesi) → b(journal) → c(supervisor/süreç ağacı) →
d(paralellik) → e(hızlı mod). Uyarlanabilir durdurma 0.3.1'e.
Gerekçe: Hızlı mod ilk deneyimi iyileştirmek için var; ölçtüğünü kaybeden ve
kendini öldüren bir runner üzerinde ilk deneyimi iyileştirmez — ilk koşumu ölen
kullanıcının ikinci koşumu olmaz. Paralellik, süreç izolasyonu olmadan madde
1'i çoğaltmaktan başka bir şey yapmaz: iki paralel deneme aynı portu ister ve
biri diğerini öldürür. `compare` gerekçesi en başta, çünkü yarım günlük, hiçbir
davranışa dokunmuyor ve bugün her çapraz mod karşılaştırmasında yanlış bir
cümle basıyoruz.
Geri dönüş maliyeti: düşük (sıralama, kod değil)

## 2026-09-08 — Kayan pin hash'in adıyla değil, kayan alanın adıyla raporlanacak

Bağlam: Çapraz izin modu karşılaştırması doğru reddedildi (exit 3) ama gerekçe
"systemPromptHash changed" dedi. İki kayıtta da o alan `not-provided-by-host`;
değişen `environmentHash` ve içindeki `permissionMode`.
Seçenekler: olduğu gibi bırakmak · `drifted`'a `environmentHash` yazmak ·
kayda ortam bileşenlerini de yazıp kayan alanı adıyla söylemek
Karar: Üçüncüsü. `Run.environment` (opsiyonel) — hash'in girdisi olan nesne
kayda da yazılır; `comparePins` iki kayıtta da varsa alan alan fark alır.
Gerekçe: Hash pin 3'ün denetçisi olarak tasarlandı (2026-09-03) ve denetçinin
bulgusu denetlenen pinin adıyla raporlanıyordu. Sonuç, kullanıcıyı hiç
kımıldamamış bir sistem promptunu aramaya göndermek. Doğru karar yanlış
gerekçeyle verildiğinde kullanıcı kararın kendisine de güvenmemeyi öğrenir —
bu araç için en pahalı kayıp o. Bileşenleri kayda yazmak ayrıca bedava:
adaptör onları zaten hesaplayıp atıyor.
Geri dönüş maliyeti: düşük (opsiyonel alan; eski kayıtlar hash düzeyindeki
cümleyi alır)

## 2026-09-08 — Öldürülen koşum: journal, tam kaydı yeniden yazma değil

Bağlam: Koşum ortasında ölen süreç, tamamlanmış her denemeyi de götürüyor;
kayıt ancak `runSuite` döndükten sonra bir kez yazılıyor. 4.2.2'de iki kez
oldu, ~40 dakika ve ~$4.
Seçenekler: kullanıcı chunk'lasın (bugün yapılan, yetmedi) · her denemeden
sonra tam kaydı yeniden yazmak · append-only journal + bitişte katlama
Karar: Journal. `.assay/runs/<run-id>.partial.jsonl`, normal bitişte tek kayda
katlanıp silinir; yarım journal `assay recover` ile kayda çevrilir ve
`partial: true` taşır.
Gerekçe: Tam kaydı her denemede yeniden yazmak O(n²) ve 240 denemelik bir kayıt
MB'larca — ölçüm büyüdükçe pahalılaşan bir koruma, tam da uzun ölçümlerde
gerekiyor. Chunk'lama dışarıdan sarmalama ve chunk içi ölümü kurtaramıyor
(ölçüldü). Yarım kayıt yalan söylemiyor: değişmez #4 zaten her oranı N ve
aralığıyla gösteriyor, N küçük olduğu için aralık geniş çıkıyor ve `partial`
alanı bunu ayrıca söylüyor.
Geri dönüş maliyeti: düşük

## 2026-09-08 — Runner "korunuyor" demeyecek, "kayıp bir denemeyle sınırlanıyor" diyecek

Bağlam: Ölçülen ajan porta göre süreç öldürüyor ve runner aynı alanda bir
`node` süreci. Supervisor/worker ayrımı ve süreç ağacı öldürme planlandı.
Seçenekler: çözümü "runner artık korunuyor" diye sunmak · tavanı açıkça yazmak
Karar: İkincisi. Supervisor da aynı makinede bir `node` süreci;
`taskkill /F /IM node.exe` onu da öldürür. Dokümanda ve kodda "korunuyor"
denmeyecek.
Gerekçe: Sandbox için 2026-08-31'de verilen kararın aynısı: **gözlemler,
zorlamaz**. Asıl tehlike izolasyonun eksikliği değil, eksik izolasyonu tam
sanmak. Gerçek ayrım konteynerle gelir ve Faz 3'te; o gelene kadar iddia,
sağlanan şeyle aynı büyüklükte kalmalı.
Ayrıca kapanan asıl halka bizim kusurumuz: adaptör yalnızca doğrudan çocuğu
öldürdüğü için dev sunucu yetimlerini Assay üretiyor ve bir sonraki denemenin
ajanı portu dolu bulup porta göre öldürmeye girişiyor.
Geri dönüş maliyeti: düşük

## 2026-09-08 — Eşzamanlılık kayda girer, ortam hash'ine girmez

Bağlam: `--concurrency` paralel koşumu açacak. Eş zamanlı koşum gecikme ve
kaynak paylaşımını değiştiriyor; ölçümün bir koşulu mu?
Seçenekler: `environmentHash`e katmak (izin modunda yapıldığı gibi) · yalnızca
kayda yazmak · hiç yazmamak
Karar: Kayda yazılır, hash'e girmez. Rapor, concurrency > 1 iken gecikme
sayılarının karşılaştırılabilir olmadığını söyler.
Gerekçe: `environmentHash` host'un bildirdiği ortamın kaydı — model, sürüm,
araç seti, skill seti, izin modu. Eşzamanlılık host ortamının değil koşum
düzeninin özelliği; hash'e katmak, farklı hızda koşulmuş iki ölçümü
tetiklenme oranı bakımından da karşılaştırılamaz yapardı ve bu fazla temkin
gerçek regresyonları `unknown` arkasına saklardı. Etkilenen tek katman gecikme
ve maliyet (katman 7); doğru cevap o katmanı işaretlemek, hepsini durdurmak
değil.
Geri dönüş maliyeti: düşük

## 2026-09-08 — Hızlı mod yarım vaka üretmez; ölçülen katman kayda yazılır

Bağlam: `--fast` yalnızca tetiklenme katmanını koşacak. Artefakt
assertion'larının ne olacağı belirsizdi.
Seçenekler: assertion'ları atlayıp vakayı geçmiş saymak (değişmez #1 ihlali) ·
atlanan assertion'ları `unknown` yapmak (koşum `unknown`a düşer, çıkış kodu 3
olur ve hızlı mod işe yaramaz) · ölçülen katmanları kayda beyan etmek
Karar: Üçüncüsü. `Run.layers` (örn. `['trigger']`); yalnızca artefakt ölçen
vakalar hiç koşulmaz, koşulan vakada beyan edilmiş assertion'lar "bu modda
değerlendirilmedi" diye listelenir ve vaka verdict'i beyan edilmiş katmandan
gelir.
Gerekçe: Bu bir yarım ölçüm değil, dar ve **beyan edilmiş** bir ölçüm — ölçmediği
şeyi ölçtüm demiyor, ölçmediğini söylüyor. Assertion'ları `unknown`a çevirmek
teknik olarak dürüst ama pratikte hızlı modu öldürürdü: her koşum exit 3
verirdi ve kullanıcı `--allow-unknown` yazmayı öğrenirdi, ki o alışkanlık
gerçek `unknown`ları da görünmez yapardı.
Katman kayda girdiği için `compare` farklı kapsamla ölçülmüş iki koşumu aynı
vakada karşılaştırmayı reddedebilir.
Geri dönüş maliyeti: düşük (opsiyonel alan)

## 2026-09-08 — Erken durma naif Wilson'la yapılmayacak; 0.3.1'e ayrıldı

Bağlam: Sabit N=10 israf: dört ölçümün dördünde de tamamlama vakası 0/10 ve
negatiflerde 280 denemede 0 yanlış pozitif — beşinci denemeden sonra hiçbir
deneme kararı değiştirmedi. Ters yön de var: aynı raporda N=10'da aralıklar
%6–51'e karşı %24–76 çıkıyor ve "bu bir sonuç değil" deniyor.
Seçenekler: sabit N (bugün) · her denemeden sonra Wilson aralığına bakıp
yeterince darsa durmak · sabit bakış çizelgesi + Bonferroni düzeltmesi ·
anytime-valid güven dizisi
Karar: Sabit bakış çizelgesi + düzeltme (örn. 5/10/20/40'ta bak, α = 0.05/4),
0.3.1'de. Naif Wilson **reddedildi**.
Gerekçe: Tekrar tekrar bakılarak durdurulan bir aralık artık %95 kapsama
taşımaz (optional stopping). Değişmez #4 aralığın gösterilmesini şart koşuyor;
gösterilen aralığın iddia ettiği şey olması aynı kuralın ruhu. Kararsızlık
ölçen bir aracın kendi aralığını sessizce şişirmesi, LLM judge eklemekle aynı
sınıfta bir hata olurdu. Düzeltilmiş aralık naif olandan geniş çıkar — bu bir
kusur değil, satın alınan kesinliğin gerçeği.
Özelliğin adı da düzeltildi: bu "erken durma" değil **yeniden dağıtım** —
kararı netleşmiş vakadan alınan denemeyi kararsız vakaya vermek.
Ayrı sürüm olmasının sebebi: yayımlanan aralığın anlamını değiştiriyor ve
doğrulaması para harcayan bir kalibrasyon koşumu istiyor (~$10–20, sözleşme 1
gereği tetiği kullanıcı çeker).
Geri dönüş maliyeti: orta

## 2026-09-08 — Git Bash arızası ölü domain kaydından; hesap çözümü dosyaya sabitlendi

Bağlam: `sh.exe` çağrılarının %30'u `add_item ... errno 1` ile ölüyordu ve
ölmeyenler ~15 sn sürüyordu. Bu depodaki her git hook'u `/bin/sh` üzerinden
koşuyor, yani her commit bu kumarı oynuyordu. Aynı çökme `impeccable` 4.2.2
ölçümünde 390 Bash çağrısının 11'ini düşürdü ve skill'in başarısızlık sütununu
şişirdi.
Seçenekler: (a) makineyi ölü domain'den çıkarmak · (b) kalıcı bir msys süreci
tutup paylaşılan belleği ayakta tutmak · (c) hesap çözümünü `/etc/passwd`e
sabitlemek · (d) `passwd: files` ile `db` kaynağını tamamen kapatmak
Karar: c + d birlikte, `tools/fix-msys-domain-stall.ps1` ile; yedek alınıyor ve
`-Rollback` geri alıyor.
Gerekçe: Kök neden ölçüldü — makine `KA.sibervatan` domain'ine kayıtlı ama o
domain çözülmüyor (`nltest /dsgetdc` 15 993 ms sonra `ERROR_NO_SUCH_DOMAIN`).
msys2 hesap çözümünü `db` kaynağıyla yapıyor ve `db` o domain için
`DsGetDcName` çağırıyor; çağrı ~16 sn'de düşerken msys'in paylaşılan bellek
spinlock'u 15 sn'de pes ediyor ve ikinci süreç mount tablosunu ikinci kez
kurmaya çalışıyor. Ölçülen 15 063 ms'lik taban o zaman aşımının kendisi.
(a) doğru kalıcı çözüm ama yeniden başlatma ve profil riski; ölçüm makinesinde
gerekmiyor. (b) yalnızca semptomu erteliyor ve ayakta tutulacak bir süreç
gerektiriyor. Kontrollü deney hangi yarının işi yaptığını gösterdi: `/etc/passwd`
tek başına soğuk koşumu 17.6 sn'den 14–18 ms'ye indiriyor; `passwd: files` ek
olarak dosyada bulunmayan bir SID'in tekrar domain'e düşmesini kapatıyor.
Doğrulandı: soğuk koşum 24–40 ms (0/4), eş zamanlı 6 koşum 0/6, ardından beş
push'un beşi de ilk denemede geçti.
Bilinen sınır: `/etc/passwd` yalnızca betiği koşturan hesabı taşıyor.
Geri dönüş maliyeti: düşük (`-Rollback`, iki dosya)

## 2026-09-08 — Düzeltme betiği `mkpasswd`e bağlanmıyor, satırı kendisi hesaplıyor

Bağlam: Betiğin ilk hâli `/etc/passwd`i `mkpasswd -c` ile üretiyordu. Yükseltilmiş
ilk koşumda tam orada asıldı ve hiçbir şey yazmadan öldü.
Seçenekler: `mkpasswd`i zaman aşımıyla denemek · satırı Windows API'sinden
hesaplamak
Karar: Hesaplamak. `mkpasswd` 60 sn içinde cevap verirse çıktısı tercih ediliyor,
vermezse hesaplanan satır kullanılıyor.
Gerekçe: `mkpasswd` de bir msys ikilisi, yani düzeltmeye çalıştığı arızanın
içinde. Bir düzeltme aracının, düzelttiği şeye bağımlı olması onu tam da
gerektiği anda çalışmaz yapıyor. Hesaplanan satır (`uid = 0x30000 + RID`,
birincil grup 513, `+` ayıracı) `mkpasswd` çıktısıyla karakter karakter
karşılaştırıldı ve aynı çıktı.
Geri dönüş maliyeti: düşük

## 2026-09-08 — Denetçinin bulgusu denetçinin adıyla raporlanır

Bağlam: 0.3.0-a. `environmentHash` pin 3'ün denetçisi; kaydığında `comparePins`
`drifted`a `systemPromptHash` yazıyordu.
Seçenekler: olduğu gibi bırakmak · `environmentHash` yazmak · ikisini birden
listelemek
Karar: Yalnızca `environmentHash`. Ortam kaydığında `systemPromptHash` ne
`drifted`da ne `unavailable`da anılıyor.
Gerekçe: Pin 3 hakkında bilinen bir şey yok — kaydığı da bilinmiyor,
tutmadığı da. İki listede birden anmak aynı olayı iki farklı adla raporlamak
olurdu ve okuyucu iki ayrı sorun sanardı. Host gerçekten bir sistem promptu
hash'i veriyorsa o hâlâ kendi adıyla kayıyor; ayrı bir testle sabitlendi.
`apps/web` bu kusuru zaten elle telafi ediyordu (ortam satırları
`systemPromptHash` drift anahtarını taşıyordu); o telafi kaldırıldı.
Geri dönüş maliyeti: düşük

## 2026-09-08 — Ortam bileşenleri kayda giriyor, hash'in yanında

Bağlam: Hash "bir şey değişti" diyebiliyor, "ne değişti" diyemiyor. Adaptör
bileşenleri hesaplayıp atıyordu.
Seçenekler: yalnızca hash'i tutmak ve kullanıcıya iki kaydı elle
karşılaştırtmak · bileşenleri de kayda yazmak
Karar: `Run.environment` (opsiyonel) ve `SessionResult.environment`. Hash artık
`environmentOf(init)` nesnesinden hesaplanıyor; ikisi tek fonksiyondan besleniyor.
Gerekçe: Tek bir alan eklendiğinde hash'in ve kaydın ayrışması, raporun kayan
alanı yanlış göstermesi demek olurdu — düzeltilen kusurun tekrarı. Tek kaynak
bunu yapısal olarak engelliyor. Bileşenler zaten hesaplanıyordu; maliyet sıfıra
yakın.
Ayrışma kuralı hash ile aynı: attempt'ler farklı ortam bildirirse hiçbir değer
yazılmıyor. Prisma tarafında sütun jsonb ve okuma `isEnvironment` ile
daraltılıyor — şekli tutmayan bir değeri `Environment` diye geçirmek, aynı
kusurun bir katman aşağıdaki hâli olurdu.
Geri dönüş maliyeti: düşük (opsiyonel alan; eski kayıtlar okunmaya devam ediyor
ve karşılaştırma onlarda hash düzeyinde konuşuyor)

## 2026-09-08 — Journal append-only JSONL; tam kayıt her denemede yeniden yazılmıyor

Bağlam: 0.3.0-b. Koşum ortasında ölen süreç, tamamlanmış her denemeyi de
götürüyordu (4.2.2'de iki kez, ~40 dk ve ~$4).
Seçenekler: kullanıcı chunk'lasın · her denemeden sonra tam `Run` kaydını
yeniden yaz · append-only journal
Karar: `.assay/runs/<id>.partial.jsonl`. İlk satır başlık (kimlik, pinler,
beyan edilen tekrar sayısı), sonraki her satır bir deneme. Normal bitişte tek
kayda katlanıp siliniyor.
Gerekçe: Tam kaydı her denemede yeniden yazmak O(n²) ve 240 denemelik bir kayıt
megabaytlarca — koruma tam da uzun ölçümlerde gerekiyor ve tam da orada
pahalılaşırdı. Ekleme yapıldığı ve hiçbir satır sonradan değişmediği için
süreç bir satırın ortasında ölürse yalnızca o satır bozuk olur.
Yazma senkron (`appendFileSync`): asenkron bir yazımın kuyrukta beklerken
kaybolması, engellenmek istenen şeyin ta kendisi olurdu.
Geri dönüş maliyeti: düşük (geçici dosya; kayıt şemasına tek opsiyonel alan)

## 2026-09-08 — Kurtarılan kayıt yarım olduğunu söyler; `runs` beyan edilen sayı kalır

Bağlam: Yarım bir kayıt vaka başına daha az deneme taşıyor ama `runs` alanı
suite'te beyan edilen tekrar sayısını taşıyor.
Seçenekler: `runs`u gerçekleşen sayıya çekmek · kaydı olduğu gibi bırakmak ·
`partial` künyesi eklemek
Karar: `Run.partial { reason, recoveredAt, droppedLines? }`. `runs` beyan
edilen sayı olarak kalıyor.
Gerekçe: `runs`u gerçekleşene çekmek, beyan ile gerçeği aynı alana sıkıştırıp
ikisini de kaybetmek olurdu — üstelik vaka başına farklı olabiliyorlar.
Kaydı sessiz bırakmak ise okuyucuya `runs: 10` gösterip vaka başına 10 deneme
sandırırdı. Değişmez #4 zaten vaka başına N'i gösteriyor; `partial` alanı
kaydın kendisinin de yarım olduğunu söylemesini sağlıyor. Terminal ve HTML
raporunda uyarı **manşette**: oranlar okunmadan önce görülmeli.
Geri dönüş maliyeti: düşük (opsiyonel alan; eski kayıtlar okunmaya devam ediyor)

## 2026-09-08 — Okunamayan satır atılıyor ama SAYILIYOR

Bağlam: SIGKILL bir satırın ortasında gelebilir; journal'ın sonunda yarım bir
JSON kalır.
Seçenekler: sessizce atmak · kurtarmayı tamamen reddetmek · atıp saymak
Karar: Atılıyor ve `partial.droppedLines` olarak kayda yazılıyor.
Gerekçe: Sessizce atmak, kaç denemenin kaybolduğunu gizlemek olurdu — kaydın
yarım olduğunu gizlemenin küçük hâli. Tamamen reddetmek ise okunabilen
denemeleri de çöpe atardı; tam olarak engellenmek istenen kayıp.
Başlıksız bir journal kayda çevrilmiyor **ve silinmiyor**: hangi koşuma ait
olduğu bilinmeden denemeler bir kayda yazılamaz, ama okunamayan bir dosyayı
yok etmek de ölçüm aracının işi değil.
Geri dönüş maliyeti: düşük

## 2026-09-08 — Öldürme testi gerçek bir süreçle, `dist` her koşumda derlenerek

Bağlam: "Süreç koşum ortasında öldürüldü" senaryosu taklit edilebilirdi
(`try/finally` ile bir hata fırlatmak). Kaybın nasıl olduğu ancak yazan süreç
haber vermeden öldüğünde görülür.
Seçenekler: süreç içinde taklit · gerçek çocuk süreç + SIGKILL
Karar: Gerçek çocuk süreç (`tools/fixtures/killable-run.mjs`), üç deneme sonra
`SIGKILL`. Çocuk derlenmiş `dist`ten içe aktarıyor ve test **her koşumda**
`tsc -b` çağırıyor (güncelken ~100 ms).
Gerekçe: "dist varsa koş, yoksa atla" sessiz geçiş olurdu: test koşmadığında da
yeşil görünürdü. Daha incesi bu tuzağa bir kez düşüldü — kaynak geri
yüklendikten sonra `tsc -b` zaman damgasına bakıp derlemeyi atladı ve test eski
`dist`i koştu, yani ölçtüğünü sandığı şeyi ölçmedi. Her koşumda derlemek o
kapıyı kapatıyor.
Testin gerçekten yakaladığı ters çevirmeyle doğrulandı: journal'a yazma
kaldırılınca kurtarılabilen deneme sayısı **0**, yani 4.2.2'deki kaybın aynısı.
Geri dönüş maliyeti: düşük

## 2026-09-08 — jsonb alanları yayılımdan çıkarılıyor: Prisma `null`ı JSON null yazıyor

Bağlam: `run_partial_shape` kısıtı normal biten her koşumu reddetti.
Seçenekler: kısıtı gevşetmek · yazma tarafını düzeltmek
Karar: `environment` ve `partial` `...runRow` yayılımından çıkarılıp yalnızca
dolu olduklarında ekleniyor.
Gerekçe: Prisma'ya `null` geçmek jsonb sütununa **JSON null** yazıyor ve
`IS NULL` yanlış çıkıyor. Aynı tuzak `TraceEvent.hook`ta belgelenmişti; buna
rağmen iki kez düşüldü — ilk düzeltmede koşullu ekleme yapıldı ama
`...runRow` yayılımı `partial: null`ı zaten koyduğu için işe yaramadı.
Kısıtı gevşetmek, kısıtın yakaladığı gerçek kusuru görmezden gelmek olurdu:
kısıt doğru davrandı, yazma yanlıştı.
Geri dönüş maliyeti: düşük

## 2026-09-08 — Deneme ayrı süreçte; adaptör nesne değil tarif olarak geçiyor

Bağlam: 0.3.0-c. Ölçülen ajan runner'ı öldürebiliyor ve runner aynı süreçte
bütün koşumu taşıyor.
Seçenekler: (a) runner'ı yeniden adlandırıp gizlemek · (b) her denemeyi ayrı
bir süreçte koşturmak · (c) konteyner
Karar: (b). `RunOptions.isolate` bir **adaptör tarifi** alıyor
(`{ module, export, options }`); worker adaptörü kendisi kuruyor.
Gerekçe: (a) sahte — ajan porta göre de öldürüyor. (c) doğru uzun vadeli cevap
ama Faz 3 ve bugünkü sorunu çözmüyor. (b) öldürülen şeyi koşumdan bir denemeye
indiriyor.
Adaptörün nesne olarak geçememesi tasarımın kendisi: süreç sınırından yalnızca
JSON geçiyor. Tarifi **çağıran kod** veriyor, vaka seti dosyası değil — bir
suite dosyasının hangi modülün yükleneceğini söyleyebilmesi, ölçüm girdisine
kod çalıştırma yetkisi vermek olurdu.
Kütüphane olarak çağıranlar için varsayılan hâlâ süreç içi: kendi adaptör
örneğini geçen biri süreç sınırına zorlanmıyor. CLI her zaman izole koşuyor,
`--no-isolation` kaçış yolu.
Geri dönüş maliyeti: orta (runner'ın iç akışı değişti; genel API aynı)

## 2026-09-08 — Worker kendi kendine çıkmıyor; ağacı sevk katmanı kapatıyor

Bağlam: Ajanın başlattığı dev sunucular denemeden sonra da yaşıyor.
Seçenekler: worker normal çıksın, ağaç sonra kapatılsın · worker sonucu yazıp
canlı beklesin, ağacı sevk katmanı kapatsın
Karar: İkincisi. Worker sonucu dosyaya yazıyor, tek satır "yazdım" diyor ve
bekliyor; sevk katmanı onu ağacıyla birlikte kapatıyor.
Gerekçe: Ağaç ancak kök süreç canlıyken güvenilir yürünebiliyor. Worker
çıktıktan sonra Windows'ta yürünecek bir ağaç kalmıyor ve torunlar yetim
kalıyor — düzeltilmek istenen şeyin ta kendisi. Sonucun kaynağı dosya; stdout
satırı yalnızca bir işaret, ölçüm değil.
Geri dönüş maliyeti: düşük

## 2026-09-08 — Windows'ta ağaç PPID üzerinden yürünüyor; `taskkill /T` yetmiyor

Bağlam: Ağaç kapatma önce `taskkill /T` ile yazıldı.
Seçenekler: `taskkill /T` ile yetinmek · PPID üzerinden özyinelemeli inmek
Karar: PowerShell ile PPID üzerinden özyinelemeli. Deneme başına bir süreç
açılışı; ölçüm koşumları dakikalarca sürdüğü için görünmüyor.
Gerekçe: Ölçüldü — `detached` başlatılmış bir torun `taskkill /T` ile ölmüyor,
ve kabuktan ayrılmış bir dev sunucu tam olarak böyle başlıyor. Bu, testin ilk
hâli **yanlış sebeple yeşil** olduğu için ortaya çıktı: detached olmayan bir
çocuk zaten Node'un (libuv'un) job object'i sayesinde ebeveyniyle ölüyordu,
yani ölçülen şey bizim çabamız değildi. Yetim `detached` yapılınca `/T` kaldı.
İki yan karar: hata metnine bakılmıyor (mesajlar yerelleştirilmiş; tek
dilden bağımsız soru "süreç hâlâ orada mı"), ve PowerShell tam yolla
çağrılıyor (bu makinede `System32` PATH'te değil — aynı eksiklik 4.2.2'de
ölçülen skill'in `where curl.exe` sondasını da düşürmüştü).
Geri dönüş maliyeti: düşük

## 2026-09-08 — Öldürülen deneme `unknown`, `fail` değil

Bağlam: Worker sonuç yazmadan öldüğünde deneme ne olmalı.
Seçenekler: `fail` · `unknown`
Karar: `unknown`, ve gerekçe sebebi adıyla söylüyor ("the attempt process was
killed by SIGKILL … the measured agent can reach processes on this machine").
Gerekçe: Ölçüm yapılmadı. `fail` demek kullanıcıyı kırık olmayan bir skill'i
tamir etmeye gönderirdi — değişmez #1'in tam olarak engellediği hata.
Test ters çevirmeyle sabitlendi: verdict `fail`e çevrildiğinde kırmızıya
dönüyor.
Geri dönüş maliyeti: düşük

## 2026-09-08 — Adaptör modülünü çağıran çözüyor

Bağlam: Worker `packages/runner` içinde ve `runner` adapters'a bağlanamıyor
(docs/stack.md). `import('@ktlsr/assay-adapters')` worker'da çözülmüyordu ve
her deneme "the attempt process exited with code 1" veriyordu.
Seçenekler: bağımlılık kuralını gevşetmek · worker'a çözümleme yolu vermek ·
çağıranın modülü çözüp mutlak URL geçmesi
Karar: Üçüncüsü. CLI `import.meta.resolve('@ktlsr/assay-adapters')` ile çözüp
`file:` URL'si geçiyor; worker `file:` ve dosya yollarını olduğu gibi
kullanıyor.
Gerekçe: Kuralı gevşetmek `web ↛ runner` yasağını da tartışmaya açardı. Modülü
çözmek zaten adapters'a bağlı olan paketin işi. Kusur uçtan uca duman testinde
çıktı — birim testleri fixture'ı mutlak yolla geçtiği için görmüyordu.
Geri dönüş maliyeti: düşük

## 2026-09-08 — "Bu modül giriş noktası mı" doğru sorulmalı

Bağlam: Worker'ın kendini çalıştırma koruması `import.meta.url.endsWith(
'worker.js')` diyordu.
Karar: `process.argv[1]`in çözülmüş file URL'si `import.meta.url`e eşit mi.
Gerekçe: Derlenmiş modülün url'si **her zaman** `worker.js` ile bitiyor — içe
aktarıldığında bile. Sonuç: `@ktlsr/assay-runner`ı içe aktaran her süreç
worker'ın `main`ini koşturmaya kalkıyordu ve ilgisiz bir argümanı payload
sanıp `ENOENT` veriyordu. Vitest'te görünmedi çünkü orada modül `worker.ts`;
yalnızca gerçek süreçle koşan test yakaladı. Kaynaktan koşan bir test, ürünün
koştuğu şeyi koşmuyor olabilir.
Geri dönüş maliyeti: düşük

## 2026-09-08 — Eş zamanlılık varsayılan 1; kayda giriyor, ortam hash'ine girmiyor

Bağlam: 0.3.0-d. 240 denemelik bir ölçüm sekiz saat sürüyordu ve denemeler
sıralıydı.
Seçenekler: varsayılanı makine çekirdek sayısına bağlamak · varsayılanı 2–4
yapmak · varsayılan 1, `--concurrency` ile açmak
Karar: Varsayılan 1. Değer 1'den büyükse `Run.concurrency` olarak kayda
yazılıyor; `environmentHash`e **girmiyor**.
Gerekçe: Eş zamanlı denemeler CPU'yu, belleği, portları ve host hız sınırını
paylaşıyor. Hızlanmak kullanıcının bilerek verdiği bir karar olmalı — sessiz
bir varsayılan, ölçümün koşullarını kullanıcı fark etmeden değiştirirdi.
Hash'e katmamanın sebebi ayrı: hash "host'un bildirdiği ortam" kaydı ve
eş zamanlılık koşum düzeninin özelliği. Katsaydık farklı hızda koşulmuş iki
ölçüm **tetiklenme oranı** bakımından da karşılaştırılamaz olurdu; oysa
etkilenen tek katman gecikme ve maliyet (katman 7). Doğru cevap o katmanı
işaretlemek, hepsini durdurmak değil — terminal raporu eş zamanlılık 1'den
büyükken "gecikme ve maliyet seri bir koşumla karşılaştırılamaz" diyor.
Geri dönüş maliyeti: düşük (opsiyonel alan + bayrak)

## 2026-09-08 — Kayıt beyan sırasında, bitiş sırasında değil

Bağlam: Paralel koşumda denemeler karışık bitiyor.
Seçenekler: bitiş sırasında yazmak (ucuz) · beyan sırasında yazmak
Karar: İş listesi önceden kuruluyor, her sonuç kendi yerine konuyor; kayıt
suite sırasında.
Gerekçe: Aynı suite iki kez koşulduğunda kaydın vaka sırası değişirse iki kaydı
yan yana okumak zorlaşır ve diff gürültülü olur. Bitiş sırası ölçümün değil
zamanlamanın özelliği.
Testin bunu gerçekten sınadığı ancak ters çevirmeyle anlaşıldı: hızlı bir sahte
adaptörle denemeler zaten sırayla bitiyor ve sıralama kodu kaldırıldığında test
yeşil kalıyordu. Test artık bitişi kasten tersine çeviren bir adaptör kullanıyor
(ilk vaka en yavaş) ve ters çevirmede kırmızıya dönüyor.
Geri dönüş maliyeti: düşük

## 2026-09-08 — Port kirası: yumuşatma, garanti değil

Bağlam: Eş zamanlı iki denemenin ajanı aynı portu isterse biri diğerinin
sunucusunu öldürür — 0.3.0-c'de kapatılan döngünün paralel hâli.
Seçenekler: portları görmezden gelmek · işçi başına ayrık aralık verip
"izole" demek · aralığı verip sınırını yazmak
Karar: Üçüncüsü. İşçi başına ayrık aralık `PORT`, `VITE_PORT` ve
`ASSAY_PORT_RANGE` olarak ajanın ortamına konuyor; adaptörün allowlist'ine bu
üçü eklendi (değerleri Assay yazıyor, kullanıcının ortamından gelmiyorlar).
Gerekçe: Ajanın bu değişkenlere uyma zorunluluğu yok; sabit port yazan bir dev
sunucu yine çakışır. "İzole" demek, sağlanmayan bir garanti satmak olurdu —
sandbox için verilen kararın aynısı (*gözlemler, zorlamaz*). Test kiranın
gerçekten ayrık olduğunu ve ajanın ortamına ulaştığını ölçüyor; ajanın ona
uyacağını değil.
Geri dönüş maliyeti: düşük

## 2026-09-09 — Değerlendirilmeyen assertion `unknown` değil, ayrı bir alan

Bağlam: 0.3.0-e. Hızlı mod yalnızca tetiklenme katmanını ölçüyor; vaka
setinde beyan edilmiş artefakt assertion'larının kayıtta ne olacağı belirsizdi.
Seçenekler: sessizce düşürmek · `assertions` listesine `unknown` olarak
koymak · ayrı bir alanda "değerlendirilmedi" diye listelemek
Karar: Üçüncüsü. `Attempt.notEvaluated`.
Gerekçe: `unknown` "ölçmeye çalıştık, sinyal alamadık" demek ve koşumu exit 3
ile ölçülemez ilan ediyor; burada olan şey başka — kullanıcı bakılmamasını
istedi. İkisini aynı kovaya koymak kasıtlı bir kapsam kararını ölçüm
başarısızlığı gibi gösterirdi ve pratikte hızlı modu öldürürdü: her koşum exit
3 verir, kullanıcı `--allow-unknown` yazmayı öğrenir ve o alışkanlık gerçek
`unknown`ları da görünmez yapardı. Sessizce düşürmek ise beyan edilmiş bir
iddianın kayıttan yok olması demekti.
Geri dönüş maliyeti: düşük (opsiyonel alan)

## 2026-09-09 — Koşulmayan vaka N=0'lık bir satır değil

Bağlam: Hızlı mod yalnızca artefakt ölçen vakaları hiç koşmuyor; deneme tavanı
dolduğunda da kalan vakalar koşulmuyor.
Seçenekler: `cases` içinde sıfır denemeli satır olarak göstermek · hiç
göstermemek · ayrı bir listede sebebiyle göstermek
Karar: `Run.skipped { caseId, reason }`.
Gerekçe: "Koşulmadı" ile "koşuldu ama karar çıkmadı" iki ayrı şey; N=0'lık bir
satır ikincisi gibi okunur ve değişmez #4'ün oran gösterimini anlamsız bir
paydayla doldurur. Hiç göstermemek ise kapsamı gizlemek olurdu — okuyucu
suite'te 12 vaka görüp kayıtta 8 vaka bulur ve farkı kendi çıkarır.
Geri dönüş maliyeti: düşük (opsiyonel alan)

## 2026-09-09 — Deneme tavanı `--fast`tan ayrı bir bayrak

Bağlam: Hızlı modun bir bütçe tavanı var (60 deneme). Tavanın yalnızca hızlı
moda mı ait olacağı belirsizdi.
Seçenekler: `--fast` içinde saklı tutmak · ayrı `--max-attempts` bayrağı
Karar: Ayrı bayrak; `--fast` onun varsayılanını koyuyor, üzerine yazılabiliyor.
Gerekçe: Tavan hızlı moda özgü değil — tam bir koşumda da "bu kadar para
harca" demek istenebilir ve o istek hızlı modun katman daraltmasıyla birlikte
gelmek zorunda değil. İki kararı tek bayrakta birleştirmek, birini isteyeni
diğerini de almaya zorlardı.
Geri dönüş maliyeti: düşük

## 2026-09-09 — Action'ın `fast` girdisi var, varsayılanı değişmiyor

Bağlam: 0.3.0-e planı "GitHub Action varsayılanı buna göre güncellenir" diyor;
aynı planın davranış değişikliği başlığı ise "hiçbir varsayılan değişmiyor"
diyor.
Seçenekler: action varsayılanını `fast: true` yapmak · girdiyi ekleyip
varsayılanı `false` bırakmak
Karar: İkincisi. `fast` girdisi eklendi, varsayılan `false`; açıklaması PR'da
kullanılmasını, gece ve sürüm öncesi tam koşumu öneriyor.
Gerekçe: Varsayılanı çevirmek, eylemi kullanan her deponun ölçümünü haber
vermeden daraltırdı — dün artefakt iddialarını sınayan bir iş bugün yalnızca
tetiklenmeye bakar ve kimse fark etmez. Öneri belgeye, karar kullanıcıya ait.
Not: girdi verildiğinde `assay-version` pini bayrağı tanıyan bir sürümü
göstermeli; pin sürüm PR'ında zaten birlikte yükseliyor.
Geri dönüş maliyeti: düşük

## 2026-09-10 — Worker gerçekten canlı kalıyor; POSIX'te ağaç da yürünüyor

Bağlam: CI 0.3.0-c'den (`2f4fbb7`) beri her push'ta kırmızıydı: süreç ağacı
testi Windows'ta geçip Linux runner'ında düşüyordu. İki ayrı kusur üst üste
biniyordu ve ikisi de Windows'ta görünmüyordu.
1. Worker'ın "canlı bekle" satırı `await new Promise(() => {})` idi. Çözülmeyen
   bir söz event loop'u açık tutmaz; Node worker'ı `DONE` yazar yazmaz
   kapatıyordu. Yorum tersini iddia ediyordu.
2. POSIX yolu yalnızca köke grup sinyali gönderiyordu. `detached: true` POSIX'te
   `setsid` demek; öyle başlayan bir torun kendi grubunu kuruyor ve kaçıyor.
Windows'ta ikisi de görünmedi, çünkü PPID alanı ebeveyn ölünce de korunuyor ve
yürüyüş yetimi yine buluyor.
Seçenekler: testi Linux'ta atlamak · yalnızca grup sinyalini düzeltmek · ikisini
birden düzeltip her birini ayrı ölçmek
Karar: Üçüncüsü. Worker açık bir zamanlayıcıyla canlı; zamanlayıcı ebeveyn
ölünce worker'ı kapatıyor. POSIX'te ağaç `ps -A -o pid=,ppid=` fotoğrafından
yürünüyor, her düğüme ve grubuna SIGKILL.
Gerekçe: Testi Linux'ta atlamak ürünün Linux'ta yetim bıraktığını gizlerdi —
CI'da koşan her kullanıcı Linux'ta. İlk düzeltme (yalnızca yürüyüş) CI'da yine
kırmızıydı; konteynerde ölçülünce ikinci kusur çıktı. Aynı kod bir koşumda
kırmızı, diğerinde yeşil verdi: worker'ın çıkışı ile `ps` fotoğrafı arasında
yarış vardı ve eski test onu şansa bağlı yakalıyordu. Bu yüzden canlı kalma ve
ebeveyn ölünce çıkma iki ayrı, yarışsız testle ölçülüyor.
Doğrulama (node:22.20.0 konteyneri + Windows): düzeltme 3/3 koşumda 6/6 yeşil;
zamanlayıcı kaldırılınca, ebeveyn kontrolü kaldırılınca ve yürüyüş
kaldırılınca her biri tam kendi testinde kırmızı — iki platformda da.
Tavan: kök çağrıdan önce ölmüş bir ara sürecin altındakiler init'e geçmiştir ve
yürüyüşte görünmez; kesin cevap subreaper ya da konteyner, Faz 3.
Geri dönüş maliyeti: düşük

## 2026-09-10 — Eylem pini sürüm PR'ında betikle yükseliyor

Bağlam: `changeset version` yalnızca paket manifestlerini yükseltiyor. 0.2.0'da
`action.yml`'deki `assay-version` pini sürüm dalına elle bir commit'le
yükseltildi; changesets o dalı her `main` push'unda yeniden ürettiği için elle
eklenen commit düşebiliyordu. 0.3.0'ın sürüm PR'ı (#3) pinsiz açıldı.
Seçenekler: her sürümde elle yükseltmek · `version-packages` betiğine bağlamak
Karar: `tools/sync-action-pin.mjs`, `changeset version`dan hemen sonra.
Gerekçe: Unutulmaya en açık adım, unutulduğunda sessiz yanlış ölçüm üreten adım:
eylem deponun ürettiğinden eski bir CLI kurar (0.2.0 öncesi bir sürüm reddedilen
aktivasyonları tetiklenme sayar). Betiğin kanıtı mevcut `pin >= manifest` testi.
Sınandı: pin eşitken fark yok, 0.3.0'a yükseltmede yalnızca pin satırı değişiyor,
desen bulunamazsa exit 1.
Not: bot'un açtığı sürüm PR'ında CI koşmuyor (`GITHUB_TOKEN` ile açılan PR iş
akışı tetiklemez). PR içeriği main + sürüm yükseltmesi olduğu için pin testi PR
dalının dosyalarıyla yerelde koşuldu: 10/10.
Geri dönüş maliyeti: düşük

## 2026-09-10 — Bütçenin kestiği koşum `pass` veremez; hızlı modun gizli tavanı kaldırıldı

Bağlam: 0.3.0-e'nin roadmap tasarımı `--fast = --repeat 3 + yalnız tetiklenme
katmanı + bütçe tavanı` idi ve tavan 60 deneme olarak uygulandı. Gerçek hostta
ölçüldü (impeccable, claude-haiku-4-5): `--max-attempts 3` hiçbir negatif vakayı
koşturmadan doldu ve koşum yalnız pozitiflerle **PASS** dedi, precision %100.
`assay ci` bunu exit 0 ile geçirirdi. Şema değişmez #5'i doğruluyor ama bütçe
negatifleri koşum anında kesebiliyordu; aynı durum değişmez #1 açısından
sessiz bir `pass`.
Seçenekler: (a) olduğu gibi bırakmak · (b) bütçeyi vakalar yerine tekrarlara
dağıtmak · (c) yalnız bir sınıf (bütün negatifler ya da bütün pozitifler)
kesilince `unknown` · (d) herhangi bir bütçe kesmesinde koşum en iyi ihtimalle
`unknown`
Karar: (d), ve hızlı modun gizli tavanı kaldırıldı. `--fast` artık 3 tekrar +
yalnız tetiklenme katmanı; tavan yalnızca kullanıcının `--max-attempts`inden
geliyor. Ölçülmüş bir `fail` yine `fail`. Katman elemesi verdict'i etkilemiyor.
`SkippedCase.cause` (`layer` | `budget`) bu ayrımı taşıyor.
Gerekçe: (b) tekrar sayısını 3'ün altına iterdi ve değişmez #3 tabanını
zorlardı. (c) yarım bir cevap: yedi negatiften birini ölçüp altısını kesen bir
koşum yine geçerdi, oysa kesilen altı negatif hakkında hiçbir şey bilinmiyor.
(d) kuralı basit tutuyor: kesilen vaka ölçülmedi, ölçülmeyen şey geçmiş sayılmaz.
Katman elemesi farklı, çünkü onu kullanıcı beyan etti; bütçe elemesinde hangi
vakanın kesileceğini suite sırası seçiyor.
**Roadmap'ten sapma.** 0.3.0-e tasarımı tavanı hızlı modun parçası sayıyordu.
(d) ile birlikte gizli bir 60'lık tavan, 20 vakadan büyük her suite'i hızlı
modda sessizce `unknown`a mahkûm ederdi — kullanıcı bir kısayol ister, bir kapı
duvarı alırdı. Maliyet tavanı kullanıcının bilerek verdiği bir karar olmalı;
gizli bir varsayılan, ölçümün kapsamını kullanıcı fark etmeden daraltırdı.
Aynı yamada iki kusur daha kapandı. (1) Journal başlığı kapsamı taşımıyordu:
öldürülüp kurtarılan bir hızlı mod koşumu tam ölçüm gibi okunuyor, bütçe
kesmesi de kayboluyordu. Plan artık journal'dan önce kuruluyor ve başlıkta
duruyor. (2) Veritabanına yazılan `unknownReason` yedek cümleye düşerdi ("hiçbir
deneme açıklamadı"); artık kesmeyi adıyla söylüyor.
Doğrulama: on ters çevirme, her biri kendi testinde kırmızı. Kuralın kendisini
silen ilk mutasyon yanlış sebeple kırmızıydı (derleme kırıldı, 24 test atlandı);
tip-geçerli mutasyonla tam iki testte `expected 'pass' to be 'unknown'`. Gerçek
hostta: 3 deneme geçti, 0 unknown, koşum UNKNOWN, `ci` exit 3.
Geri dönüş maliyeti: düşük (opsiyonel davranış; hiçbir varsayılan değişmedi)

## 2026-09-10 — Kurtarılan yarım kayıt `pass` veremez; ulaşılamayan vaka adıyla yazılır (0.3.1-b)

Bağlam: 0.3.0'da ölçüldü: üç denemeden sonra öldürülen koşum `pass` olarak
kurtarıldı ve yalnız pozitif vakayı taşıdı. Koşumun hiç ulaşmadığı negatif vaka
kaydın hiçbir yerinde yoktu. Bütçe kesmesiyle aynı sınıf bir kusur, üstelik iz
bırakmıyordu.
Seçenekler: `partial` künyesini yeterli saymak · yarım kaydı hiç kaydetmemek ·
bütçe kuralının aynısı + ulaşılamayan vakaları adlandırmak
Karar: Üçüncüsü. Journal başlığı planlanan vaka listesini (`planned`) taşıyor;
kurtarma, başlamamış her vakayı `skipped`a `cause: 'interrupted'` ile yazıyor.
Verdict'te iki ayrı kural: (a) yarım kayıt `pass` veremez; (b) katman dışı her
atlama `pass`i engeller.
Gerekçe: Künye yetmiyor, çünkü verdict alanı künyeden bağımsız okunuyor
(`assay push` sonrası dashboard, `compare` taban çizgisi). Kaydetmemek 0.3.0-b'nin
kurtardığı ölçümü geri atar. (a) ayrıca gerekli: son vakanın ortasında kesilen
bir koşum hiçbir vakayı tamamen kaçırmaz, `skipped` boş kalır, ama denemeleri
eksiktir. (b) kurtarma yolunda (a)'nın arkasında kalıyor ve oradan gözlenemiyor;
yine de duruyor, çünkü ileride eklenecek bir sebep varsayılan olarak "ölçülmedi"
sayılmalı. Yalnız `layer` beyan edilmiş bir kapsamdır. (b) `verdictOf` üzerinden
doğrudan sınanıyor.
0.3.0 journal'larında `planned` yok: ulaşılamayan vakalar adlandırılamıyor ama
kayıt yine `pass` vermiyor.
Doğrulama: 12 ters çevirme; ters çevirme betiği bu kez her mutasyondan sonra
önce derliyor ve derlemesi bozuk mutasyonu geçersiz sayıyor. On ikisi de
derleme temizken bir assertion'da, tam kendi testinde kırmızı. Gerçek hostta:
bir deneme sonra öldürülen hızlı mod koşumu `UNKNOWN` kurtarıldı ve ulaşılamayan
11 vaka adıyla kayıtta.
Yan bulgu: ebeveyn ölümünü sınayan test, düştüğünde worker'ı sonsuza kadar
yaşatıyordu. Bir ters çevirme koşumu makinede ~2.5 saat bir yetim bıraktı. Test
artık sonuç ne olursa olsun worker'ı kapatıyor; aynı mutasyonla sınandı, geride
worker kalmadı.
Geri dönüş maliyeti: düşük (davranış değişikliği: bugün `pass` kurtarılan kayıt
`unknown` olur; sürüm notunda)

## 2026-09-10 — Koşum kaydı onu üreten Assay sürümünü taşıyor (0.3.2)

Bağlam: 0.3.1'in dışarıdan doğrulanmasında, kaydın hangi sürümden geldiğini
gösteren bir alan yoktu ve kanıt dolaylı kaldı. Asıl sorun doğrulamadan büyük:
verdict'in anlamı sürümler arasında değişti (0.2.0 reddedilen aktivasyonu
tetiklenme sayıyordu, 0.3.0 yarım kaydı `pass` sayabiliyordu).
Seçenekler: sürümü CLI'ın yazması · runner'ın kendi `package.json`'undan ·
elle yazılmış bir sabit
Karar: Runner, `package.json`'undan (`packages/runner/src/version.ts`). Kurtarılan
kayıt journal başlığındaki sürümü taşıyor, kurtaranı değil. Eski kayıtlar
doldurulmuyor; `core`'daki `assayVersionLabel` onları "0.3.1 or earlier (the
record predates version stamping)" diye okuyor. Terminal, HTML ve hosted koşum
sayfası aynı cümleyi kullanıyor. Hosted şemada `assayVersion` sütunu var ve boş
string bir kısıtla reddediliyor.
Gerekçe: CLI yazsaydı `runSuite`'i kütüphane olarak çağıranların kayıtları
sürümsüz kalırdı. Dört paket tek sürümle yayımlandığı için runner'ın sürümü
CLI'ınkiyle aynı. Elle yazılmış bir sabit sürüm PR'ında unutulurdu; testi zaten
değeri diskteki `package.json`'la karşılaştırıyor. Kurtarmada kurtaranın sürümünü
basmak, kaydı hiç koşmadığı bir sürümün ürünü gibi gösterirdi. Geriye dönük
doldurma tahmin olurdu: bilinmeyen sürüm bilinmeyen kalır, ama boş değil,
adıyla.
Etiket "0.3.1 öncesi" değil "0.3.1 or earlier": alan 0.3.2'de geldi, yani
0.3.1'in kendi kayıtları da sürümsüz. İstenen ifade 0.3.1 kayıtları için yanlış
olurdu.
Doğrulama: 14 ters çevirme, derleme kapılı. Biri (veritabanı okuması) ilk
biçimiyle derlemeyi bozdu ve kapı onu "geçersiz" olarak işaretledi. Önceki
turlarda bu tür bir mutasyon "yanlış sebeple kırmızı" diye okunmuştu. Tip-geçerli
biçimiyle doğru sebeple kırmızı. Hosted sayfa gerçek (31 Ağustos) kayıtlarla
açık/koyu/mobil çekildi.
Yan düzeltme: `records.ts` ortam farkında ayırıcı olarak çıplak NUL karakteri
taşıyordu (0.3.0-a); `grep` dosyayı ikili sanıp aramıyordu. Anlamı aynı olan
`'\u0000'` kaçışıyla değiştirildi.
Ortam notu: bu makinede 3000 ve 5433 başka projelerin Docker konteynerlerinde.
Assay web 3100'de, geliştirme veritabanı 5434'te açıldı (`ASSAY_DEV_PG_PORT`).
Geri dönüş maliyeti: düşük (opsiyonel alan + nullable sütun)

## 2026-09-10 — Çakışma vakasında beklenen kazanan: `expect.winner`, "ilk tetiklenen" (0.4.0)

Bağlam: marketingskills çakışma koşumunda (200 deneme) Assay 179 pass / 21 fail
dedi; oysa 13 skill'in 7'si kendi vakasında hiç tetiklenmedi. Suite'in tek bir
`target.skill`'i var; hedef dışı bir skill için pozitif bir alan yok. Çakışma
vakaları yalnızca `not_triggered` ile yazılabildi, ve hiçbir şey
tetiklenmediğinde o koşul sağlandı: 100 pozitif deneme sahte `pass`.
Seçenekler: (a) kazanan = listede herhangi bir yerde tetiklenen · (b) kazanan =
ilk doğrulanmış aktivasyon · (c) kazanan = tek tetiklenen
Karar: (b), kullanıcı onayıyla. `winner: <skill>`, tartışmalı vaka için
`winner: [a, b]` (biri kazanırsa geçer), negatif için `winner: none`.
Gerekçe: Çakışmanın sorusu "model önce hangisine uzandı". (a), yanlış skill'e
uzanıp sonra düzelten modeli başarılı sayardı. (c), meşru bir ikinci aktivasyonu
(ör. copywriting'in ardından copy-editing) cezalandırırdı; tekillik isteyen
`not_triggered` ekleyebiliyor. Matrisin sütunları da ilk tetiklenen. `none` ayrı
bir alan yerine bir sözcük, çünkü matrisin "none" satırı ve sütunuyla bire bir
örtüşüyor; `active_skills`'te `none` adlı bir skill varsa doğrulayıcı hata
veriyor.
Geri dönüş maliyeti: orta (yayımlandıktan sonra alanın anlamı değiştirilemez)

## 2026-09-10 — Beklenen kazanan hiç tetiklenmediyse `fail`, `unknown` değil (0.4.0)

Bağlam: Çakışma suite'lerinde en sık başarısızlık yanlış skill değil, hiçbir
skill'in tetiklenmemesi. Bunun `fail` mi `unknown` mu olacağı belirsizdi.
Seçenekler: `fail` · `unknown`
Karar: `fail`. `unknown` yalnızca sinyal okunamadığında, liste eksikken
(`complete: false`), kazanan seçilip aktivasyonu reddedildiğinde, ya da hiçbir
aktivasyon doğrulanmayıp bir red olduğunda.
Gerekçe: Sinyal okundu, liste tam, beklenen skill tetiklenmedi — bu bir ölçüm.
Hedef skill için `triggered: true` iken aynı durum bugün zaten `fail`; hedef
dışı skill için farklı verdict tutarsız olurdu. `unknown`, marketingskills'in
manşet bulgusunu (7/13 skill hiç tetiklenmedi) exit 3'ün arkasına saklar ve
kullanıcıyı olmayan bir host sorununu aramaya gönderirdi — 0.3.0-a'daki yanlış
adresin aynısı. "Hiçbiri tetiklenmedi" ile "yanlış skill kazandı" farklı gerekçe
cümlesi alıyor ve matriste ayrı sütunda duruyor.
Geri dönüş maliyeti: orta

## 2026-09-10 — Çakışma matrisi web'de 0.4.1'de (0.4.0 şema ve veritabanıyla sınırlı)

Bağlam: Matris terminal, HTML ve hosted tarafta gösterilmeli; 0.4.0'ın kapsamı
belirsizdi.
Seçenekler: hepsi 0.4.0'da · şema + CLI raporları + veritabanı 0.4.0'da, web
ekranı 0.4.1'de
Karar: İkincisi, kullanıcı onayıyla.
Gerekçe: Yerel ve hosted şema ayrışmamalı, bu yüzden `CaseResult.expectedWinner`
sütunu 0.4.0'da geliyor; ekran bu sütunun üstünde ayrı bir iş ve kendi ekran
görüntüsü doğrulamasını istiyor. Şemanın doğruluğu gerçek veriyle yeniden
puanlamada kanıtlanıyor, ekranda değil.
Geri dönüş maliyeti: düşük

## 2026-09-10 — Host'la gelen bir skill de "ilk tetiklenen" sayılır (0.4.0-f)

Bağlam: marketingskills kaydı yeniden puanlanırken, `collide.py` ile Assay'in
matrisi tek bir denemede ayrıştı. `collide.cro.lead_form` #7'de yalnızca Claude
Code'un kendi skill'lerinden biri (`run`) tetiklendi. `collide.py` yalnız
`marketing-skills:` önekli aktivasyonları sayıyor ve bu denemeyi "none"a yazıyor;
Assay'in onaylanan tanımı ("ilk doğrulanmış aktivasyon") `run` sütununa.
Seçenekler: (a) ilk tetiklenen = `active_skills` içindeki ilk aktivasyon
(`collide.py` ile birebir) · (b) ilk tetiklenen = herhangi bir doğrulanmış
aktivasyon (onaylanan tanım)
Karar: (b), kullanıcı onayıyla (süzgeç eklenmedi; `run`'ın isteği kapması
görünür kalsın). Aynı Assay kodunun (a)'nın süzgeciyle `collide.py` ile 17
hücrenin 17'sinde aynı sonucu verdiği ayrıca gösterildi; fark yalnızca tanımda.
Gerekçe: (a) o deneme için "hiçbir skill tetiklenmedi" der, oysa bir skill
tetiklendi — "none" sütununun anlamını bozar. Host skill'inin isteği kapması da
bir çakışma: plugin yazarının bilmek isteyeceği şey tam olarak bu. Verdict iki
tanımda da aynı (cro kazanmadı). İki tanımın verdict'te ayrıştığı tek durum
"host skill önce, beklenen sonra" ve onaylanan gerekçe ("model önce hangisine
uzandı") orada da `fail` diyor. (a) ayrıca kaydın `active_skills`'i taşımasını
gerektirirdi; matris kayıttan kurulamazdı.
Geri dönüş maliyeti: düşük (yalnızca matris sütunu; ikinci bir süzgeçli görünüm
istenirse eklenebilir)

## 2026-09-10 — Hosted'a yüklenecek koşumlar: her ölçümden bir temsilci, bir çift

Bağlam: `assay push` ilk kez gerçek kullanımda. Ölçüm deposunda 40 kayıt, altı
ölçüm (animate, better-typography, ui-ux-pro-max, impeccable, marketingskills,
hallmark). Hepsini yüklemek istenmedi; en az biri kırmızı, biri karşılaştırılabilir
çift, biri çakışma matrisi taşımalıydı.
Seçenekler: hepsini yüklemek · her ölçümün en büyük kaydı · her ölçümden bir
temsilci + dört pini aynı bir çift
Karar: sekiz aday — animate 57205e2b, better-typography ac10d159 (tek `unknown`
denemesiyle üç durumu gösteren kayıt), ui-ux-pro-max 2a900c03, impeccable 4.2.1
c3d2b624 (N=10 tam ölçüm), impeccable 4.2.2 acceptEdits parçaları 631543d1 +
c4c1faa3 (çift: skillHash, model, environmentHash, suiteHash aynı; 12 vakanın
12'si ikisinde de var), marketingskills 0bec859e, hallmark ablation A kolu
2dc28f84 (12/38, en kırmızı kayıt; B kolu skill'i çıkarılmış hâli, tek başına
yanıltıcı olurdu).
Gerekçe: Suite dosyası kayıttaki `suiteHash`e uymayan 15 kayıt zaten
yüklenemiyor (push hash'i yerel suite'le karşılaştırıyor). Parça parça koşulmuş
bir ölçümün (impeccable 4.2.2, 5+6 parça) hepsini yüklemek aynı ölçümü on bir
kez göstermek olurdu; iki parça çiftin işini görüyor. Çift için 4.2.1 ile 4.2.2
seçilmedi: skillHash kaydığı için `compare` bunu doğru olarak reddediyor — o bir
karşılaştırma değil, reddin gösterimi.
Sonuç: sekizin beşi yüklendi. 09-03 tarihli üçü hosted tarafın bir kusuru
yüzünden yüklenemedi (bkz. roadmap 0.4.1-a). marketingskills yüklendi ama
kullanıcı kararıyla gizli kaldı (aşağıda).
Geri dönüş maliyeti: düşük (yönetici panelinden silinebilir, gizlenebilir)

## 2026-09-10 — `scrub`un bıraktığı kullanıcı adı, yüklemeden önce elle maskelendi

Bağlam: Yükleme public bir siteye gidiyor. Seçilen sekiz kaydın kopyasına
yayımlanmış 0.4.0 `assay scrub` uygulandı; üç kaydı yeniden yazdı ama makine
kullanıcı adı 68 yerde kaldı. Üç biçim desenlerin dışında: ajanın kabuk
komutunda ters bölüleri yenmiş `C:Users<ad>AppData...`, izole config'in bellek
yolundaki Claude Code proje adı `C--Users-<ad>` (0bec859e'de 55 kez) ve ajanın
yazdığı koddaki çift kaçışlı `C:` + dört ters bölü + `Users`. Sır (anahtar,
token, JWT, özel anahtar) bulunmadı; e-postaların hepsi örnek adres.
Seçenekler: kayıtları yüklememek · 0.4.0'ın bıraktığıyla yüklemek · kalan adı
aynı `<user>` işaretiyle maskeleyip yüklemek · önce `redact`i düzeltip yayımlamak
Karar: Üçüncüsü — yalnızca scratch kopyada, yalnızca o dizge (büyük/küçük harf
duyarsız) `<user>` ile değiştirildi; ölçüm deposundaki asıllara dokunulmadı.
Sonrasında bağımsız bir taramayla sıfır kaldığı doğrulandı.
Gerekçe: Değiştirilen şey ölçüm değil kimlik: hiçbir verdict, sayı veya pin
değişmiyor ve işaret `redact`in kendi işaretinin aynısı. Yüklememek görevin
kendisini düşürürdü; olduğu gibi yüklemek kullanıcı adını public siteye koymak
olurdu. Desenleri düzeltip yayımlamak doğru kalıcı cevap ama "yayımlanmış 0.4.0
ile çalış" talimatının dışında; kusur roadmap'e yazıldı (0.4.1-b).
Geri dönüş maliyeti: düşük

## 2026-09-10 — Yeniden puanlanmış çakışma kaydı yüklenmedi

Bağlam: Kullanıcı 0.4.0-f'de `tools/rescore.mjs` ile yeniden puanlanan
marketingskills kaydının (179/21 → 79/121, matrisli) yüklenmesini sordu.
Seçenekler: kaydı v2 suite'le yüklemek · kazananlı suite'le yüklemek · pini
kazananlı suite'e çevirip yüklemek · yüklememek
Karar: Yüklenmedi.
Gerekçe: (1) Site matrisi çizemiyor — `apps/web` içinde tek bir `collision`
referansı yok (0.4.1). (2) Kayıt ölçüldüğü v2 suite'in pinini taşıyor; push onu
kazananlı suite'le reddeder, v2 ile gönderilirse 79/121 verdict'leri onları
üretmeyen, kazanan beyan etmeyen bir vaka setine bağlanır. Pini çevirmek kaydın
koşulmadığı bir suite'le ölçüldüğünü iddia etmek olur (değişmez #2, sözleşme 3);
üstelik kayıt `assayVersion: 0.3.2` derken kazanan semantiği 0.4.0'da var ve
şemada "yeniden puanlandı" diyen bir alan yok. Dürüst yol: kazananlı suite'le
0.4.0'da gerçek bir koşum (para harcar, tetik kullanıcıda) ve 0.4.1.
Aynı sebeple eski suite'le puanlanmış 0bec859e kullanıcı kararıyla gizlendi:
yüklendi, suite'i bir süre yayımlı kaldı, sonra `/admin/suites`ten private
yapıldı (anonim istek 404 döndüğü doğrulandı).
Geri dönüş maliyeti: düşük

## 2026-09-10 — Yayımlanmış ölçümlerin dizini oturumsuz ziyaretçiye de açılacak (0.4.1)

Bağlam: Üç suite yayımlandı; oturumsuz ziyaretçi yalnızca birine ulaşabildi.
Kök adres ziyaretçiye tanıtım sayfasını gösteriyor ve o sayfa tek bir suite'i
öne çıkarıyor; "Measured skills" listesi yalnızca oturum açmış kullanıcıya.
Yayımlama ve görünürlük doğru çalışıyor — üç sayfa da doğrudan URL ile açıldı.
Seçenekler: olduğu gibi bırakmak · `/suites` dizini · tanıtım sayfasının altında
liste
Karar: 0.4.1'e alındı (kullanıcı kararı); adres ve yerleşim uygulama sırasında
seçilecek.
Gerekçe: "Publish" düğmesi ölçümü herkese açtığını söylüyor, ama ziyaretçinin
ona ulaşacak bir yolu yoksa yayımlama yarım bir eylem. Veri katmanı hazır
(`listSuites({ kind: 'public' })` tanıtım sayfasında zaten çağrılıyor); eksik
olan yalnızca ekran.
Geri dönüş maliyeti: düşük

## 2026-09-10 — `push` kişisel veri kalıntısında yüklemez; bilinen ad maskeye girer (0.4.1-b, c)

Bağlam: İlk gerçek yüklemede 0.4.0 `scrub` sekiz kayıtta kullanıcı adını 71
yerde bıraktı (üç biçim: ters bölüsü yenmiş yol, Claude Code proje adı, çift
kaçışlı yol). Kullanıcı "push öncesi tarama yapıp uyarsın" istedi.
Seçenekler: (a) yalnızca uyarı basıp yüklemek · (b) kalıntıda yüklememek,
bilinçli geçiş için bayrak · (c) sessizce maskeleyip yüklemek
Karar: Desenler üç biçimi kapsıyor; ayrıca bu makinenin hesap adı (`localNames`)
kayıt yazılırken, okunurken, `scrub`da ve `push`ta maskeye veriliyor. `push`
maskeden sonra sır, ev dizini ya da hesap adı bulursa yüklemiyor, yerlerini
JSON yoluyla sayıyor; `--allow-unmasked` kontrolden sonra geçiriyor. Maske
yüklenen kopyayı değiştirdiyse kaç yer olduğunu söylüyor.
Gerekçe: (a) bir CI kütüğünde kaybolur ve veri yine gider; public bir sayfa ve
önbellekleri geri alınamaz. Uyarının kaçırılamayan hâli yüklememek. (c) zaten
store okumasında yapılıyor, ama yol dışında geçen ad (ör. commit yazar satırı)
maskelenemez: orada adın kimlik mi sözcük mü olduğu bilinemez, bu yüzden
kullanıcıya soruluyor. Bilinen ad core'a parametre olarak geliyor; core
işletim sistemine bakamıyor.
Ölçüm: sekiz kayıtta 71 → 0, yalnızca desenlerle (ad bilinmeden) de 0. Tavan:
liste dışı bir profil klasöründe düzleşmiş yolun maskesi yolun sonuna kadar
uzuyor (fazla maskelemek güvenli yön); başka bir makinenin tireli adı Claude
proje adında yalnızca ilk parçasından maskeleniyor.
Doğrulama: 13 ters çevirme, derleme kapılı; on üçü de kendi testinde kırmızı.
Kapı bir kez tabanı yakaladı: eklenen bir test tip hatası taşıyordu ve 13
mutasyonun hepsi "geçersiz" çıktı — kırmızı sayılmadı.
Geri dönüş maliyeti: düşük (push'a bir ret yolu ve bir bayrak)

## 2026-09-10 — 0.2.0 öncesi kayıt: aktivasyon kontrolü "yapılmadı" olarak saklanır (0.4.1-a, d)

Bağlam: İlk gerçek yüklemede ölçüm deposundaki on kaydın (animate,
better-typography, ui-ux-pro-max ölçümlerinin tamamı ve impeccable pilotu)
hiçbiri yüklenemedi. Tetiklenme gözleminde `refused`/`refusals` yoktu ve
eşleme `[...trigger.refusals]` ile TypeError attı; sunucu kullanıcıya yalnızca
"the run could not be stored" gönderdi.
Seçenekler: (a) eksik alanı `refused: false, refusals: []` ile doldurmak ·
(b) alanları opsiyonel yapıp yokluğu "kontrol yapılmadı" diye saklamak
Karar: (b). Core'da iki alan opsiyonel; veritabanında `triggerRefused` NULL
yalnızca boş red listesiyle birlikte geçerli. Migration 0.2.0'ın eski satırlara
yazdığı `false`ı NULL'a çeviriyor; eski satır izin modu olmayan koşumla
tanınıyor (ölçüm deposundaki 40 kayıtta iki yokluk birebir örtüşüyor).
`evaluateTrigger` eski bir gözlemde seçilmiş bir skill varsa `unknown` veriyor;
hiçbir şey seçilmediyse gözlem tam. Hosted koşum sayfası künyede "Activation
check: not made" satırını gösteriyor. Bozuk bir kayıt işleme girmeden yerini
söyleyen bir `RecordShapeError` ile reddediliyor ve sunucu bu mesajı iletiyor.
Gerekçe: (a) yapılmamış bir kontrolü "red yok" diye kaydetmek olurdu; 0.2.0-d'de
bir pilotta dört "tetiklenme"nin dördü reddedilmiş aktivasyondu. 0.2.0
migration'ı `false` yazarken gerekçesi "yerel store'da alan yok → falsy" ile
hizalanmaktı; core artık yokluğu "doğrulanmadı" diye okuduğu için aynı gerekçe
şimdi NULL'u gösteriyor. Hata mesajı bizim eşleme kodumuzdan geliyor, tablo ya
da sütun adı taşımıyor.
Mevcut bir kısıt testi eski kuralı sabitliyordu ("sinyal okundu ama red durumu
bilinmiyor → reddedilir"); anlamı değiştiği için iki teste bölündü: boş red
listesiyle NULL kabul, dolu listeyle NULL red.
Doğrulama: 9 ters çevirme derleme kapılı, dokuzu da kendi testinde kırmızı;
route'unki (vitest dışında) elle: ters çevrildiğinde mesaj yine genel 400'e
düşüyor. Yerel veritabanında migration 0.2.0 öncesi 198 satırın hepsini NULL
yaptı, sonrası 218 satıra dokunmadı; üç eski gerçek kayıt yazıldı (297 deneme)
ve sayfasında satır göründü.
Geri dönüş maliyeti: orta (alan anlamı ve kısıt değişti; migration veriyi
dönüştürüyor, ama dönüşüm geri çevrilebilir)

## 2026-09-10 — `/compare` yayın modunda açık (0.4.1-i)

Bağlam: 2026-09-02'de `/compare` yayın modunda kapatılmıştı: "kimlik doğrulama
istemiyor ve koşum kimliği olmadan boş bir form". İlk gerçek yüklemede koşum ve
suite sayfalarının "vs previous" bağlantısı ziyaretçiyi 404'e gönderdi ve
karşılaştırma — hosted tarafın varlık sebebi — sitede hiç yapılamadı.
Seçenekler: kapalı tutup bağlantıları gizlemek · açmak
Karar: Açık. Kapalı rotalar yalnızca `/dev` ve `/api/bootstrap`; liste
`apps/web/lib/public-mode.ts`te ve sınanıyor. `robots.ts` `/compare`'ı taramaya
kapalı tutuyor: sorgu parametreli ve sonsuz kombinasyonlu adresler dizine
girmemeli; bu erişimi değil yalnızca taramayı etkiliyor.
Gerekçe: Açmak bir şey sızdırmıyor — sayfa koşumları görünürlük kapsamıyla
okuyor ve yayımlanmamış bir koşum için "One of those runs is missing" diyor
(yayından önce yerelde ölçüldü). Parametresiz hâli bir `EmptyState`; "yarım
uygulama" gerekçesi bir bağlantıyı 404'e çevirmeye değmezdi.
Doğrulama: 3 birim ters çevirme + middleware bağlantısının elle ters çevrilmesi
(kural yok sayılınca `/dev` 200), dördü de kırmızı. Yayın modunda yerel: çift
için 200 ve "no regression across 12 case(s)".
Geri dönüş maliyeti: düşük

## 2026-09-10 — Yayımlanmış ölçümlerin dizini `/suites`te (0.4.1-m)

Bağlam: Ziyaretçi yalnızca tanıtım sayfasının öne çıkardığı tek suite'e
ulaşabiliyordu; "Measured skills" listesi yalnızca oturum açmış kullanıcıya
açıktı. Kullanıcı `/suites` ya da tanıtım sayfasının altını önerdi.
Seçenekler: tanıtım sayfasına tam listeyi gömmek · `/suites` dizini + tanıtım
sayfasından bağlantı
Karar: `/suites`, oturum açmış ana sayfayla aynı bileşeni (`SuiteList`)
kullanıyor; kapsamı `listSuites`in varsayılanı (ziyaretçiye yalnızca public).
Tanıtım sayfasında "Every published measurement" bağlantısı. 0.2.0 öncesi bir
kaydın satırı "activation not verified" notunu taşıyor.
Gerekçe: Tanıtım sayfası bir hikâye anlatıyor (tek bir gerçek koşum); listeyi
oraya gömmek onu bir kataloğa çevirirdi. Tek bileşen, iki listenin ayrışmasını
engelliyor.
Aynı sayfada iki kusur daha kapandı. Hero ve Getting started `npx assay …`
diyordu; kapsamsız `assay` npm'de ilgisiz bir paket, yani ziyaretçi başkasının
kodunu çalıştıracaktı. Ve "Nine cases, ten attempts each" / "measured ten
times" sabit yazılmıştı; öne çıkan koşum değişince (hallmark: 5 vaka × 10)
sayfa yanlış sayı söylüyordu — sözleşme 3. Sayılar artık koşumdan.
Doğrulama: dizin kapsamı `{ kind: 'all' }` yapılınca gizli `xlsx` görünüyor,
tanıtım bağlantısı kaldırılınca 0 — ikisi de elle, derleme kapılı, kırmızı.
Açık/koyu × 1280/375'te taşma yok.
Geri dönüş maliyeti: düşük

## 2026-09-10 — Üst çubukta dizin bağlantısının adı "Measurements" (0.4.1-o)

Bağlam: `/suites` yalnızca tanıtım sayfasından bağlantılı; bir koşum sayfasına
doğrudan gelen ziyaretçi (issue'lardan gelen herkes) diğer ölçümlere
ulaşamıyor. Kullanıcı bağlantıyı üst çubukta "Method"un yanına istedi ve adı
bana bıraktı: "Measurements" ya da "Suites".
Seçenekler: "Measurements" · "Suites"
Karar: "Measurements"; adres `/suites` kalıyor. Toplu küçük kusur turunda
uygulanacak; 404 sayfasının "linked from the front page" cümlesi de aynı
bağlantıya dönecek.
Gerekçe: Sitenin kendi dili bu — tanıtım sayfasındaki bağlantı "Every published
measurement", 404 sayfası "The measurements published here". Ziyaretçi bir
ölçüm arıyor; "suite" bir iç terim (vaka seti) ve ziyaretçiye bir şey söylemiyor.
Etiketin adresle aynı olması gerekmiyor, adresi değiştirmek ise yayımlanmış
bağlantıları kırardı.
Tavan: etiket uzun; 375 px'te "Method", "Sign in" ve tema düğmesiyle birlikte
sığmazsa mobilde kısaltma ya da taşıma uygulama sırasında ekran görüntüsüyle
seçilecek.
Geri dönüş maliyeti: düşük

## 2026-09-10 — Küçük kusurlar turu (0.4.1-e…o)

Bağlam: İlk gerçek `assay push`ın bulduğu, önceki turda ertelenen kusurlar.
Kararlar:
- **e — `push` için çıkış kodu 4.** Sunucuya ulaşılamadığında ya da sunucu
  reddettiğinde kod 2'ydi (kullanım hatası); CI kullanıcısı komutunu düzeltmeye
  gidiyordu. Yeni kod ölçüm kodlarından (0–3) ayrı: yükleme bir ölçüm değil.
  Davranış değişikliği, sürüm notunda.
- **f — sunucu görünürlüğü söylüyor.** `POST /api/runs` 201 ile `public`
  döndürüyor; CLI vaka seti gizliyse "only you can open this link" diyor. CLI
  tahmin etmiyor: aynı suite'e daha önce yayımlanmış bir koşum yazılabilir.
- **g — token sayfası isteğin kökünü öneriyor** (`x-forwarded-host`/`-proto`,
  yoksa `host`).
- **h — `--version`**, runner'ın sürümü; kayıttaki `assayVersion` ile aynı değer.
- **j — aralık etiketleri.** Kutu en az iki etiket genişliğinde (`9ch`, kutunun
  mono yazı tipinde) ve sağ kenarı çizginin sonunu geçmiyor. Koddaki "iki yana
  eşit taşar" yorumu yanlıştı: `space-between` taşmayı sona iter.
- **k — ad kırılması.** `BreakableName` `:` ve `/`'den sonra `<wbr>` koyuyor;
  `overflow-wrap: anywhere` son çare olarak kalıyor.
- **l — boş payda.** `MeasurementBlock` sebebi çağırandan alıyor (`empty`);
  koşum sayfası okunmuş deneme varken kesinliğin boş paydasını "never fired"
  diye söylüyor. Bileşen sebebi tahmin etmiyor.
- **n — onay penceresi.** Saydam zemin, görünmeyen kenarlık ve karartmayan
  backdrop'un tek sebebi yığın sırasıydı: `main` z-index 1 ile kendi yığın
  bağlamını kuruyor, portal katmanlarının z-index'i yoktu ve sayfanın altında
  çiziliyorlardı. Bütün portal katmanları `z-50`. İki ders: (1) bileşen
  kataloğu `main` kullanmıyordu, kusur orada hiç görülemezdi — katalog artık
  `main`; (2) ilk doğrulama yanlış sebeple yeşildi: Radix modal body'ye
  `pointer-events: none` veriyor ve `elementFromPoint` o öğeleri atlıyor, yani
  ölçülen şey çizim sırası değil tıklanabilirlikti. Ölçüm artık geçici
  `pointer-events: auto` ile yapılıyor; ters çevrildiğinde iki temada kırmızı.
- **o — üst çubukta "Measurements"** ve 404 sayfasından dizine bağlantı. 375px'te
  başlık 343px'e ~380px düşüyordu ve "Sign in" iki satıra kırılıyordu (ölçüldü).
  Kullanıcının önerisiyle dar ekranda (≤26rem) başlık yazısı bir kademe
  küçülüyor, harf aralığı ve boşluklar daralıyor; "Sign in" `head-link`
  sınıfını alıp kırılmıyor. 320px'te bu da yetmedi: ≤340px'te sözcük işareti
  görsel olarak çekiliyor (ekran okuyucuda duruyor), simge kalıyor. Hiçbir
  bağlantı gizlenmiyor.
Doğrulama: birim ters çevirmeler (e, f, h, g: 9) derleme kapılı, hepsi kırmızı;
sayfa maddeleri (j, k, l, n, o×3, f'nin route'u: 8) elle, derleme kapılı, gerçek
sayfada ölçülerek, hepsi kırmızı. 7 sayfa × 2 tema × 2 genişlikte taşma yok.
Geri dönüş maliyeti: düşük (e bir davranış değişikliği; sürüm notunda)

## 2026-09-10 — Web'de çakışma matrisi: cevap önce, dağılım sonra (0.4.1-1)

Bağlam: 0.4.0 matrisi terminal ve HTML raporuna koydu, veritabanında kazanan
sütunlarını hazırladı; hosted koşum sayfası 0.4.1'e kalmıştı.
Seçenekler: CLI tablosunun birebir kopyası ("won" en sağda) · "won" etiketin
yanında
Karar: Matris verdict'in hemen altında, precision/recall bloklarının üstünde;
o iki blok çakışma koşumunda "target skill only" diye etiketleniyor. "won"
sütunu etiketin yanında ve iki kırılmaz satırda (yüzde + sayım, %95 GA).
Tablo kendi kabında kayıyor, etiket sütunu yapışkan ve opak. Renk yalnızca
ölçüm: isabet `pass`, başka skill ilk tetiklendiyse `fail`, deneme yoksa soluk
nokta. Gösterim mantığı `lib/collision-view.ts`te ve sınanıyor; önek kuralı
core'un (`collisionPrefix`, `outsidePrefix`), yani terminal ve HTML ile aynı.
Gerekçe: CLI düzeninde 375px'te en önemli sayı on altı sütun ötede kalıyordu
(ekran görüntüsüyle görüldü). İlk sarma denemesi aralığı "0%–" / "28%)" diye
bölüyordu; iki kasıtlı satır hem okunuyor hem N ve aralığı taşıyor (değişmez #4).
Doğrulama verisi: kazanan beyan eden gerçek bir kayıt yok (0.4.0 ile
kazananlı suite'te koşum yapılmadı, kullanıcı şimdilik istemedi). Görsel ve
sayısal doğrulama için 0.4.0-f'de gerçek marketingskills kaydından yeniden
puanlanan kayıt YALNIZCA yerel dev veritabanına `-rescored-local` kimliğiyle
yazıldı; production'a yüklenmedi (2026-09-10 kararı geçerli). Sayfadaki matris,
core'un aynı kayıttan hesapladığıyla 240 hücrenin 240'ında aynı —
veritabanı gidiş-dönüşü ve çizim birlikte.
Ters çevirme: görünüm modelinde 5 (derleme kapılı, hepsi kırmızı), sayfada 4
(elle, web typecheck kapılı: matris çizilmiyor, ek yok, aralık yok, tablo kendi
kabında kaymıyor — hepsi kırmızı).
Geri dönüş maliyeti: düşük

## 2026-09-11 — Çakışma koşumu için suite sürüm 3; ölçüm deposu salt okunur kaldı

Bağlam: Kullanıcı kazananlı suite'le gerçek bir çakışma koşumunu onayladı.
Elimdeki kazananlı suite (0.4.0-f) yalnızca yeniden puanlama için türetilmişti:
başlığı öyle diyor, `version: 2`'yi kaynağından koruyor (id'ler eşleşsin diye) ve
fixture yolu ölçüm deposuna göre göreli.
Seçenekler: türetilmiş dosyayı olduğu gibi koşmak · ölçüm deposunun `suites/`
dizinine koymak · sürümü artırılmış bir kopyayı ölçüm deposunun düzenini
taklit eden bir çalışma dizininde koşmak
Karar: Üçüncüsü. `examples/measurements/marketingskills.collide.v3.suite.yaml`:
gövde türetilmiş dosyayla byte byte aynı (vakalar, istemler, kazananlar,
fixture'lar, id'ler), yalnızca başlık ve `version: 3`. Koşum, `suites/` ve
`fixtures/marketing-site` (ölçüm deposundan kopya) taşıyan bir scratch
dizininde; skill ölçüm deposundaki `skills/marketing-skills-collide`'dan
okunuyor. Kayıt scratch store'a yazılıyor.
Gerekçe: Vakaların anlamı değişti (kazanan artık suite'te); aynı sürüm numarası
iki farklı vaka setini adlandırırdı — sürüm alanının varlık sebebi bu ayrım
(decisions.md, 2026-08-31). Türetilmiş dosyanın "for re-scoring only" başlığı
gerçek bir koşumun pinine girseydi yanıltıcı olurdu. Ölçüm deposu kullanıcının;
oraya dosya koymak onun kararı. Suite hash'i fixture içeriğinden değil suite
dosyasından geldiği için kopya dizin ölçümü değiştirmiyor.
Yapılacak (kullanıcı kararı): suite ve kayıt ölçüm deposuna taşınabilir.
Geri dönüş maliyeti: düşük

## 2026-09-11 — İlk kazananlı çakışma koşumu: hızlı mod bir vakayı atladı; kayıt gizli yüklendi

Bağlam: v3 suite'le 0.4.2, `--fast --concurrency 4`: 20 vakadan 19'u koşuldu,
57 deneme, $3.07, 7 dk 49 sn duvar saati (run-2026-09-11T14-11-49-883Z-2bc985d5).
Tartışmalı vaka `contested.copywriting.headline_better` yalnızca `winner`
taşıyor ve hızlı mod onu "the case only declares assertions" diye atladı.
Sebep: `planWork`'ün tetiklenme iddiası testi 0.3.0'dan kalma ve `winner`'ı
(0.4.0) bilmiyordu.
Seçenekler: kaydı yüklememek · olduğu gibi yükleyip yayımlamak · olduğu gibi
gizli yükleyip kusuru düzeltmek, yayını ve yeniden koşumu kullanıcıya bırakmak
Karar: Üçüncüsü. Kayıt 0.4.2 ile yüklendi (maskelenecek bir şey kalmamıştı:
runner hesap adını kayıt yazılırken maskeliyor) ve gizli. Kusur düzeltildi
(0.4.3-a, changeset hazır), yayımlanmadı.
Gerekçe: Ölçülen 19 vaka gerçek ve verdict `fail` — atlama bir geçişi
gizlemedi. Ama yayımlanırsa sayfa atlanan vaka için yanlış bir cümle ("only
declares assertions") gösterir ve matriste tartışmalı satır eksik kalır.
Yayımlamak ya da 0.4.3 ile yeniden koşmak (~$3) kullanıcı kararı.
Bulgu (19 vaka, vaka başına 3 deneme — erken uyarı, kanıt değil): 200
denemelik v2 koşumunun resmiyle aynı. emails, seo-audit, ai-seo, schema
kendi vakalarında 3/3 kazandı; cold-email 2/3; signup, cro, popups, paywalls,
onboarding, copy-editing, programmatic-seo ve hedef product-marketing hiç
tetiklenmedi; cro'da bir denemede host'la gelen `run` önce tetiklendi; üç
`winner: none` negatifinde 9/9 hiçbir skill tetiklenmedi.
Geri dönüş maliyeti: düşük

## 2026-09-11 — Hosted sayfa kapsamı CLI kadar belirgin söylüyor (0.4.3-b)

Bağlam: Web koşum sayfası `layers`, `skipped` ve `partial`'ı hiç okumuyordu.
Kullanıcı üçünün de CLI'daki belirginlikte gösterilmesini istedi.
Karar: Verdict'in hemen altında, matrisin ve oranların ÜSTÜNDE üç uyarı
kutusu (hızlı mod, koşulmayan vakalar sebepleriyle, yarım kayıt); cümleler
CLI'ınkiyle aynı (`lib/coverage.ts`, sınanıyor). Dizin satırında ve suite
sayfasında son koşum için tek kelimelik not ("fast mode" / "incomplete run";
yarım kayıt öncelikli). Ayrıca `unknown` hüküm cümlesi kapsam sebebini
söylüyor: yarım kayıt "0 of 1 attempts produced no readable signal" diyordu —
okunamayan tek deneme olmadan `unknown` olan bir kayıt için yanlış adres
(0.4.1-l'nin kardeşi).
Doğrulama verisi (yalnızca yerel): bugünkü çakışma koşumu (hızlı mod + katman
elemesi), 0.3.1-b'nin gerçek hostta öldürülüp kurtarılmış kaydı (hızlı mod +
yarım + kesinti elemesi) ve 0.3.0'ın gerçek bütçe kesmesi kaydı. Üçünde de
uyarılar sayılardan önce; tam bir koşumda hiçbiri yok. 375px'te uzun vaka
kimlikleri sayfayı taşırıyordu (15 öğe) — liste `overflow-wrap: anywhere`.
Ters çevirme: yardımcıda 5 (araçla), sayfada 4 (elle, web typecheck kapılı;
biri ilk biçimiyle tip hatası verdi, geçersiz sayıldı ve tip-geçerli biçimle
tekrarlandı). Hepsi kırmızı.
Geri dönüş maliyeti: düşük

## 2026-09-11 — 0.4.3 yayımlandı, `v1` taşınmadı; çakışma kaydı ölçüm deposunda

Bağlam: Kullanıcı sırayı onayladı: 0.4.3-b, 0.4.3 yayını, tartışmalı vakayla
yeniden koşum, kayıt ve suite'in ölçüm deposuna taşınması.
Kararlar:
- 0.4.3 npm'e çıktı (yayın koşumu `34612331881`, birleştirme `a705483`, PR #9;
  dört paket registry'den okundu, provenance, OIDC). `v1` eylem etiketi ve
  bir action sürümü bu kez istenmedi; etiketi zorla taşımak açık onay istiyor
  (sözleşme 1), bu yüzden `v1` hâlâ v1.3.2 / CLI 0.4.2. main'deki `action.yml`
  pini 0.4.3.
- Yeniden koşum ölçüm deposundan, yayımlanmış 0.4.3 ile: 20/20 vaka, 60 deneme,
  $3.04 (912ad216). Suite ölçüm deposunda commit'li (`05b820b`); iki kayıt
  `.assay/runs/`'ta (gitignore, diğerleri gibi). Scratch kopyaları silindi.
- Yayımlama kullanıcıda. Suite düzeyinde olduğu için 0.4.2 kaydı (2bc985d5)
  da açılır; sayfası atlanan vakayı 0.4.2'nin yanlış gerekçesiyle gösterir.
  Silmek geri alınamaz bir üretim verisi işlemi — kullanıcının.
Geri dönüş maliyeti: düşük

## 2026-09-11 — İlk kazananlı çakışma koşumu production'da doğrulandı; eylem v1.3.3

Kullanıcı 2bc985d5'i sildi ve v3 suite'i yayımladı. Production'da 912ad216:
matris core'un aynı kayıttan hesapladığıyla 240/240 hücrede, "won" sayımları
15/15 satırda aynı (sayfadan okunup karşılaştırıldı); hızlı mod uyarısı
sayıların üstünde; atlanan vaka ve yarım kayıt yok, o uyarılar çıkmıyor; tam
bir koşumda (c4c1faa3) hiçbir uyarı yok; v2 kaydı gizli kaldı (404). İki tema ×
1280/375'te üç sayfada taşma yok. Kullanıcının açık onayıyla `v1` 0.4.3'e
taşındı ve action-v1.3.3 açıldı (`a63120c`); dış depo doğrulaması yapılmadı
(istenmedi).

## 2026-09-11 — Konum bilgisi üst çubuktan sayfanın başlık alanına taşındı

Bağlam: Üst çubuk hem gezinmeyi (Method, Measurements) hem konum izini
taşıyordu. İkisi görsel olarak ayrılmıyordu ve derin sayfalarda iz "R…",
"ATTE…" diye okunamayacak kadar kırpılıyordu; 48rem altında hiç görünmüyordu.
Seçenekler: (a) üst çubukta tutup ayırıcıyla ayırmak · (b) üst çubuğun altına
ikinci bir şerit · (c) izi sayfanın kendi başlık alanına almak
Karar: (c). Üst çubukta yalnızca marka, Method, Measurements, Sign in ve tema
düğmesi. İz `<main>`in ilk öğesi: başlık çubuğunun hairline'ının altında,
sayfa başlığının (hüküm sayfalarında 2px'lik verdict çizgisinin) hemen
üstünde; mono, `text-xs`, büyük harfe çevrilmiyor, `/` ayırıcı `--rule-strong`
tonunda, son öğe `aria-current="page"`. Kırpılmıyor: dar ekranda satır sarılıyor,
uzun kimlik gerekirse bölünüyor.
İz yalnızca içinde bir bağlantı varsa çiziliyor (`lib/trail.ts`,
`visibleTrail`): bağlantısız iz ("skills", "admin / users") başlığı tekrarlar ve
gidilecek bir yer göstermez. Koşum, attempt, suite ve compare sayfalarının izine
kök olarak `measurements → /suites` eklendi; böylece iz hep bir üst yere çıkıyor.
Gerekçe: (a) sorunun kendisini korurdu — 375px'te marka, iki bağlantı, giriş ve
tema düğmesinin yanında yer yok; kırpma kaçınılmazdı. (b) gölgesiz, hairline'lı
bir dilde ikinci bir yapışkan şerit iki çizgi arasında bir bant daha demek ve
kaydırırken içeriğin üstünde iki kat yer kaplardı. İz bir gezinme aracı değil,
sayfanın künyesi; künye sayfanın başlığıyla birlikte okunur. Başlık çubuğunun
40px altında, verdict çizgisinin 24px üstünde durduğu için alttaki başlığa
bağlanıyor, üstteki gezinmeye değil.
Aynı turda attempt sayfasında 375px'te iki eski taşma kapandı: hüküm cümlesi ve
assertion gerekçesi boşluksuz regex taşıyabiliyordu (sayfa 800px'e
genişliyordu); ikisine `overflow-wrap: anywhere`.
Doğrulama: açık/koyu × 1280/375, attempt, koşum, suite ve /suites (izsiz)
sayfalarında; hepsinde yatay kaydırma yok, iz tam metin. Üç birim ters çevirme
(`visibleTrail` koşulu ters, hep çiz, hiç çizme) her biri kendi testinde
kırmızı; shell'in izi çizmemesi canlı sayfada sıfır `Breadcrumb` ile görüldü.
Geri dönüş maliyeti: düşük

## 2026-09-11 — Üst çubukta marka sitenin kırmızısında ve kalın

Bağlam: Kullanıcı üst çubuktaki "Assay"ın sitenin kırmızısıyla ve kalın
yazılmasını istedi: daha çok öne çıksın ve yanındaki menülerden ayrışsın.
Seçenekler: ayrı bir marka rengi üretmek · sitenin mevcut kırmızısını
(`--fail`) kullanmak
Karar: `.wordmark` `color: var(--fail)`, `font-weight: 700`; simge de aynı
renkte (currentColor). Yeni token üretilmedi.
Gerekçe: Kullanıcı kararı. 2026-09-01'deki "kroma yalnızca ölçümde" kuralının
bilinçli tek istisnası: kırmızı başka her yerde `fail` demek, markada değil.
Bağlamı ayırt ettiriyor (sabit konum, serif sözcük işareti). Ayrı bir marka
kırmızısı üretmek paleti büyütürdü ve iki yakın kırmızı yan yana dururdu.
Instrument Serif yalnızca 400 ağırlığıyla geliyor; kalınlık tarayıcının
sentezi. Ekran görüntüsünde okunaklı; ileride gerçek bir kalın kesim gerekirse
yükseltme yolu display yazı tipini değiştirmek.
Doğrulama: açık/koyu × 1280 ve 390/375/360/320'de üst çubukta taşma ve
çakışma yok; koyu temada koyu temanın kırmızısı (#ec8172).
Geri dönüş maliyeti: düşük (tek CSS kuralı)

## 2026-09-11 — Karşılaştırmada durduran sebep önde; "vs previous" yalnızca aynı koşullara

Bağlam: Production'da frontend-design'ın `/compare` sayfası "suiteHash changed;
systemPromptHash could not be read" diyordu: iki sebep aynı cümlede, hangisinin
karşılaştırmayı durdurduğu belirsiz. Ayrıca suite ve koşum sayfalarındaki
"vs previous" bağlantısı pinleri uyuşmayan çiftlere gidiyordu; ziyaretçi
tıklayıp "Not comparable" görüyordu. Kullanıcı bağlantı için kararı bana
bıraktı: yalnızca karşılaştırılabilir koşuma gitmek ya da görünüp
"conditions differ" diye işaretlenmek.
Seçenekler (gerekçe): cümleyi web'de bölmek · core'da bölmek.
(bağlantı): pinleri uyuşan en yakın koşuma git, yoksa gizle · her zaman hemen
öncekine git ama işaretle · ikisinin birleşimi
Karar:
- Core: `RunComparison.reason` yalnızca durduran sebebi söylüyor. Kayan pin
  varsa sebep o; okunamayan pin `note`a iniyor ("even without that change the
  conditions could not be shown to match"). Kayma yoksa okunamayan pin sebebin
  kendisi — değişmez #2 gereği eksik pin de karşılaştırmayı durdurur, yani
  "yalnızca bir eksiklik" olduğu durum kaymanın yanında olduğu durum. Terminal
  notu ayrı bir `also:` satırında basıyor; web "What changed" listesinin altında
  "Also not readable" başlığıyla. Yalnızca okunamayan pin varken eskiden boş
  kalan "What drifted" listesi artık "What could not be read".
- Bağlantı birleşim: pinleri uyuşan en yakın önceki koşuma gidiyor
  (`lib/baseline.ts`, `/compare`'ın kullandığı `comparePins`le — bağlantı ile
  sayfa ayrışamaz). Aradaki koşumları atladıysa etiket tarihi söylüyor
  ("vs 09-08 10:15"). Aynı koşullarda önceki koşum yoksa bağlantı gizlenmiyor,
  soluk "conditions differ" diye hemen önceki koşuma, neyin değiştiğini
  gösteren sayfaya gidiyor. Koşum sayfasında aynı üç durum cümleyle.
Gerekçe: Sebebi web'de bölmek CLI'daki aynı belirsizliği bırakırdı; iki
tüketici tek kaynaktan konuşmalı (`discrimination` kararıyla aynı). Bağlantıyı
tamamen gizlemek, bir skill'in koşulları değiştiği bilgisini de gizlerdi — ve
"Not comparable" sayfası o bilginin kendisi (hangi pin kaydı). Sorun sayfanın
varlığı değil, bağlantının karşılaştırma vaat etmesiydi; etiket artık vaat
etmiyor. "conditions differ" antimon değil gri: bir ölçüm sonucu değil gezinme,
ve satırın kendi verdict işaretiyle karışırdı.
Aynı turda geçmiş satırında iki düzen kusuru: masaüstünde son sütun 6rem'di ve
"conditions differ"ı taşımıyordu (8rem); 375px'te yüzde işaret sütununa düşüp
taşıyordu — satır artık vaka satırıyla aynı düzende.
Doğrulama: yerelde her suite sayfasındaki her bağlantının etiketi, gittiği
sayfanın sonucuyla karşılaştırıldı (11/11 tutarlı: "conditions differ" ↔
"Not comparable", "vs previous" ↔ vaka vaka karşılaştırma). Aradaki koşumu
atlayan durum yerel veride yok; birim testiyle sınanıyor. Ters çevirme: core 3,
CLI 1, `baselineFor` 3 (araçla, derleme kapılı); sayfada 2 (elle, web typecheck
kapılı — ilk biçimi kullanılmayan import yüzünden tip hatası verdi, geçersiz
sayılıp tip-geçerli biçimle tekrarlandı). Hepsi kırmızı. Açık/koyu × 1280/375'te
taşma yok.
Geri dönüş maliyeti: düşük (opsiyonel alan; `reason` metni daraldı — sürüm notunda)

## 2026-09-13 — 0.4.4 yayımlandı; eylem v1.3.4

Kullanıcının talimatıyla (PR #10 birleşti): yayın koşumu `34754297580`,
`6e491ed` üzerinde. Dört paket registry'den okundu — `latest=0.4.4`,
`_npmVersion` 12.0.2 (OIDC, token değil), dördünde de SLSA provenance —
ve `npx @ktlsr/assay@0.4.4 --version` temiz bir dizinde 0.4.4 bastı.
`action-v1.3.4` (açıklamalı) `6e491ed`'de açıldı ve GitHub Release "Latest";
`v1` açık onayla `a63120c`'den `6e491ed`'ye zorla taşındı. `v1`'deki
`action.yml` pini API'den okundu: 0.4.4. İçerik yalnızca `compare`
gerekçesinin daralması (davranış değişikliği metinde; çıkış kodları aynı).
Dış depo doğrulaması yapılmadı (istenmedi).

## 2026-09-13 — 0.4.4 dışarıdan doğrulandı; v3 tam çakışma koşumu ertelendi

`ktlesr/assay-example`'da `@v1` ile koşum `34754816362`: eylem `ktlesr/assay@v1`'i
`6e491ed` olarak indirdi, `assay-version: 0.4.4` kurdu ve artefakttaki kayıt
(`run-2026-09-13T11-35-19-801Z-c65f756d`) `assayVersion: "0.4.4"` taşıyor;
3 vaka, 6 deneme, `pass`. Log'da "scrub yok" uyarısı yalnızca betiğin kaynağı
olarak görünüyor; `##[warning]` yok, yani `scrub` gerçekten çalıştı.

Roadmap "Ölçüm-1" (v3 ile tam çakışma koşumu, ~$10) kullanıcı kararıyla
ertelendi: ifade bağlama deneyinin B kolu bugünkü kurulumun aynısı, deney tam
modda koşulursa v3 tam matrisi de oradan gelir — aynı ölçüm iki kez
ödenmez. Sitede o zamana kadar 60 denemelik hızlı koşum (912ad216) duruyor ve
"fast mode" uyarısını taşıyor; ölçüm deposundaki rapor notu (`633f4b3`) iki
koşumun farkını söylüyor.

## 2026-09-13 — Host talimat dosyası sızıntısı: taşı, kes, ölç (0.4.5)

Bağlam: Kullanıcının `~/.claude/CLAUDE.md`'si Windows'ta her denemenin bağlamına
giriyordu. Adaptör temiz bir `CLAUDE_CONFIG_DIR` veriyor ve bunu izolasyon
sayıyordu; host ise çalışma dizininden köke kadar her dizinde talimat arıyor ve
`%TEMP%` ev dizininin altında. Kullanıcı üçünü birden istedi: çalışma dizini ev
dışında, yetmezse taramayı başka türlü kes, ve her koşumda ölç — "ölçülmemiş
izolasyon, izolasyon değil".
Seçenekler (kesim): `CLAUDE_CODE_DISABLE_CLAUDE_MDS` (ikilide var) · `--safe-mode` ·
`--bare` · `--setting-sources` · `claudeMdExcludes` ayarı
(ölçüm): çalışma dizininin üst dizinlerini runner'da taramak (host'un kuralının
modeli) · host'un `InstructionsLoaded` kancası (host'un kendi raporu) · API isteğini
yakalamak (yalnızca sonda için; gerçek koşumda istek Anthropic'e gidiyor)
Karar:
- Kök: `%TEMP%` ev altındaysa Windows'ta `<sürücü>:\assay-work`, POSIX'te `/tmp`;
  `ASSAY_WORK_ROOT` kullanıcının seçimi; oluşturulamazsa `%TEMP%`.
- Kesim: `claudeMdExcludes` — çalışma dizininin her üst dizininde `CLAUDE.md`,
  `CLAUDE.local.md`, `.claude/**`. `DISABLE_CLAUDE_MDS` fixture'ın kendi
  CLAUDE.md'sini de kapatırdı; `--safe-mode` skill ve plugin'leri, `--bare` OAuth'u
  kapatıyor; `--setting-sources` başka ayar dosyalarını da etkiliyor.
- Ölçüm: `InstructionsLoaded` kancası + `UserPromptSubmit` kanaryası, günlük config
  dizininde. Kanarya yoksa alan yazılmıyor ("ölçülmedi"); temiz oturumda `[]`.
  Kayıtta `Environment.memory`: `<tür> <yol> sha256:<16>`, içerisi `./` göreli,
  dışarısı mutlak. Ortam hash'ine yalnızca ölçüldüğünde giriyor.
Gerekçe: Üç katman üç ayrı soruya cevap: taşımak sızıntının sebebini kaldırıyor,
dışlama ev dışı bir kökün üstündeki dosyaları da kesiyor (`D:\CLAUDE.md`), ölçüm
ikisinin de tuttuğunu her koşumda gösteriyor — ve tutmadığı gün kayda yazıyor.
Runner'da üst dizinleri taramak host'un kuralını tahmin etmek olurdu; kural
değişirse tahmin sessizce yanlış çıkar. Kanca host'un yüklediğini söylüyor. Kanarya,
"hiçbir şey yüklenmedi" ile "kanca koşmadı"yı ayırıyor; o ayrım olmasa bu
düzeltme, düzelttiği hatayı — izolasyonu varsaymayı — kayıt düzeyinde yeniden
üretirdi. Kanarya olarak `SessionStart` denendi: akışta `hook_started` olayı
bırakıyor ve izin görünmez değişkenlerini (0.2.0-f) kirletirdi; `UserPromptSubmit`
akışa girmiyor ve stdout'u boş.
Hash'e girmesinin bedeli: 0.4.5 kayıtları 0.4.4 ve öncesiyle karşılaştırılmıyor.
Değişmez #2 gereği doğru cevap; eski kayıtlarda bağlama ne girdiği ölçülmedi.
Doğrulama yöntemi ayrıca kayda değer: sahte API anahtarı ve yerel yakalayıcıya
çevrilmiş `ANTHROPIC_BASE_URL` ile host'un gönderdiği istek **ücretsiz** okunabiliyor
(host sistem istemini kuruyor, yerel sunucu 400 dönüyor). İlk deneme kimlik
bilgisiz yapıldı ve hiçbir şey göstermedi: bellek, kimlik kontrolünden sonra
yükleniyor. Araç: `tools/probe-host-memory.mjs`.
Geri dönüş maliyeti: orta (ortam hash'inin tanımı genişledi; eski karşılaştırmalar
durdu; çalışma kökü Windows'ta yer değiştirdi)

## 2026-09-13 — 0.4.5 yayımlandı; maruz kayıtlara künye notu, yeniden ölçüm yok

Kullanıcı kararı: yayımla, `v1`'i taşı, `action-v1.3.5`'i aç; sitedeki maruz
kalmış kayıtlara künyede not düş, yeniden ölçme.
- Yayın: koşum `34765415465`, `d3146fb` (PR #11). Dört paket registry'den okundu
  (`latest=0.4.5`, npm 12.0.2/OIDC, provenance); `npm i @ktlsr/assay@0.4.5` temiz
  dizinde `--version` 0.4.5 bastı ve kurulan adaptörde `claudeMdExcludes`, runner'da
  `assay-work` var. `action-v1.3.5` açıldı, `v1` `6e491ed`'den `d3146fb`'ye taşındı;
  `v1`'deki pin API'den 0.4.5. Sürüm notu Linux runner'ların etkilenmediğini söylüyor:
  bugünkü dış depo koşumunun kaydında skill kopyası `/tmp/assay-skill-…`.
- Yayından önce CI'ın yakaladığı bir kusur: `workRoots` platformu parametre alıp
  yolu çalışan makinenin `path` modülüyle çözüyordu; Linux'ta `C:\Users\…` göreli
  sayılıp ev kontrolü "dışında" diyordu. `path.win32`/`path.posix` ile düzeltildi,
  `node:22.20.0` konteynerinde derlenmiş modülle doğrulandı.
- Not: koşum sayfasının künyesinde (`HostMemoryNote`). Yalnızca kayıttan maruziyeti
  okunan (yolları ev altında) ve ölçülmemiş kayıtlarda. Metin: kapatılmadan önce
  yapıldı; dosya bağlama girmiş olmalı, hangilerinin girdiği ölçülmedi; iz sayısı;
  "No trace does not prove no effect"; yeniden ölçmeme gerekçesi (iki store'daki
  1.250 Skill çağrısının ve 1.237 aktivasyonun hiçbiri `graphify`'ı hedeflemiyor —
  doğrulandı; etkilenebilir tek bulgu, marketing-skills positioning vakası, dosyasız
  kolda 10/10'a karşı 8/10 yeniden üretildi — ölçüm deposu raporu).
- Sayılar elle yazılmadı: `tools/host-memory-exposure.mjs --json` iki store'dan
  `apps/web/lib/host-memory-exposure.json`'u üretiyor (45 maruz kayıt; sitede yayımlı
  11 koşumun 11'i içinde). Metodoloji sayfasının verisiyle aynı disiplin.
- Doğrulama: 3 birim ters çevirme (web typecheck kapılı) ve bileşen düzeyinde bir
  canlı ters çevirme; hepsi kırmızı. Açık/koyu × 1280/375'te taşma yok.

## 2026-09-13 — Temiz koşum ortamı planlandı (öneriler, uygulanmadı)

Bağlam: Makine ölçüme altı yerden karıştı (CLAUDE.md, `%TEMP%`, `System32`, Git
Bash, yetimler, runner'ın öldürülmesi). Kullanıcı kendi ölçümleri için kontrollü bir
ortamın planını istedi; hosted ürün, kota ve yabancı kullanıcı kapsam dışı. Token
sunucuda durmalı (kullanıcının güvenlik kararı).
Seçenekler: yalnız VPS · yalnız dizüstünde konteyner · koşum başına konteyner ·
VPS + deneme başına konteyner · microVM
Öneri: ayrı VPS + deneme başına konteyner; kimlik proxy'si gerçek anahtarı tutuyor,
deneme konteyneri sahte anahtarla ona konuşuyor ve iç ağda başka çıkışı yok; tetik
CLI (ssh), sonuç mevcut `assay push` + `rsync`; API anahtarı (ayrı workspace, tavan).
Gerekçe: Tabloda tek seçenek bütün arızaları birlikte kapatıyor. Proxy, token'ı
ölçülen koddan (ajanın `Bash`'i ortamı devralıyor) tamamen uzaklaştırıyor ve ağın
"gözleniyor"unu "engelleniyor"a çeviriyor. Mevcut Dokploy VPS'i reddedildi:
production verisiyle çekirdek ve ağ paylaşmak, ölçüm ortamının bir kaçışını
production'ın kaçışı yapar. Mimari mevcut koda oturuyor: 0.3.0-c'nin worker'ı
`spawn` yerine `docker run` ile başlıyor, sonuç dosyası sözleşmesi değişmiyor.
Ayrıntı, maliyet, riskler, sıra: `docs/runner-environment.md`. Kararlar kullanıcının
onayına kadar öneri.
Geri dönüş maliyeti: düşük (yalnız plan)

## 2026-09-13 — Koşum ortamı kararları ve K0 ölçümü

Kullanıcı kararları: kimlik API anahtarı (ayrı Console workspace'i, harcama tavanı);
sunucu ertelendi — K0'da kapasite yerelde ölçülecek, ihtiyaç makul değilse yerelde
devam; izin modu `acceptEdits` varsayılan, suite başına bilinçli seçim; gerçek pin 3
roadmap'te K5'ten sonra; sunucuda yeniden kurulacak taban çizgileri marketingskills v3
ve impeccable 4.2.2.
K0 (ayrıntı `docs/runner-environment.md`, düzenek `tools/k0/`):
- Varsayımlar ücretsiz ölçüldü (sahte SSE API + kimlik proxy'si + çıkış günlükçüsü,
  iç ağ): imajda talimat dosyası yok; uid 1000 iki izin modunda çalışıyor; proxy
  anahtarı enjekte ediyor ve konteyner gerçek anahtarı görmüyor; SSE tamponlanmadan
  geçiyor; `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` ile API dışı dış bağlantı yok
  (varsayılanda 5); 0.4.5'in ölçümü konteynerde `[]`.
- Kapasite gerçek koşumla (abonelik token'ı, $1.47 nominal, 14 deneme, hepsi geçti):
  konteyner başına ≤~1 GB bellek, ~1,4 çekirdek patlama, ≤~1 GB geçici disk, ~200 süreç;
  süreyi model belirliyor (medyan CPU %3–10). 4 paralel en kötü durum ~4 GB, patlamada
  ~5–6 çekirdek.
- Tasarım düzeltmeleri: ajanın çıkışı yalnız Anthropic olamaz (npm, Playwright) —
  proxy tek kimlikli çıkış, ajan çıkışı izin listesinden; tarayıcı imajda.
- Kapasite koşumunda token proxy'siz, `--env-file` ile verildi: K0'a özgü bir kestirme,
  tasarımın hedefi değil. Kayıtlar yüklenmedi.
- Yan bulgu: `resolveFixtures` yalın dosya adıyla verilen suite'te fixture'ı bulamıyor
  (roadmap'e yazıldı, düzeltilmedi).

## 2026-09-13 — K1: deneme imajı ve ajanın çıkışı için izin listesi

Bağlam: Kullanıcı yerelde devam etmeyi seçti (sunucu kararı K4'e) ve K1'i K0'ın
iki düzeltmesiyle istedi: tarayıcı imajda, ajanın çıkışı izin listesinden (npm
registry ve Playwright).
Seçenekler (izin listesi): Squid + `dstdomain` ACL · iptables/nftables ile IP
süzme · iç ağ + küçük bir Node CONNECT proxy'si.
(tarayıcı yeri): `/opt` + `PLAYWRIGHT_BROWSERS_PATH` (K0) · adaptörün allowlist'ine
değişkeni eklemek · Playwright'ın varsayılan yolu (`~/.cache/ms-playwright`)
Karar:
- İzin listesi: `internal: true` ağ + `tools/runner-env/egress.mjs`. Yalnızca
  `CONNECT <ad>:443`, ad listede birebir (`registry.npmjs.org`, `cdn.playwright.dev`,
  `playwright.download.prss.microsoft.com`); düz HTTP 403. Deneme konteynerine
  `HTTPS_PROXY`.
- Tarayıcı varsayılan yolda, Playwright 1.63.0 (npm'deki son sürüm) ile.
- Talimat denetimi bütün dosya sisteminde, derleme adımında; imajda da duruyor.
- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` imaja konmadı.
Gerekçe:
- Squid aynı işi yapardı ama ikinci bir yazılım ve yapılandırma dili; K3'ün kimlik
  proxy'si zaten Node olacak ve iki proxy aynı dilde konuşursa birleşebilirler.
  IP süzme CDN'lerin arkasındaki adreslerde tutmaz. Asıl güvence proxy değil ağ:
  proxy'ye uymayan hiçbir bağlantı iç ağdan çıkamıyor, bu ölçüldü (ada, çıplak
  IP'ye, DNS'e). Proxy'nin tek işi izinli adlara tünel açmak; kararı veren fonksiyon
  (`allows`) beş mutasyonla sınandı.
- K0'ın tarayıcısı ajana ulaşmadı: adaptörün ortam allowlist'i
  `PLAYWRIGHT_BROWSERS_PATH`'i geçirmiyor ve ajan son sürümü kurdu (1.63.0,
  imajdaki 1.55.0'dı). Allowlist'e eklemek bir sürüm ister ve yalnızca birinci
  sorunu çözerdi. Varsayılan yol ikisini de kod değişikliği olmadan çözüyor. Plan
  "boş HOME" diyordu; amacı talimat dosyası ve denemeler arası kalıntıydı, deneme
  başına konteyner ikincisini zaten sağlıyor, tarayıcı talimat değil.
- Değişken imajda olsa da adaptör onu ajana geçirmiyor; ajana ulaşmayan bir ayarı
  imaja koymak yanıltıcı olurdu. Çağrılar proxy'de reddediliyor ve oturumu bozmuyor.
Bulgular (K2'ye): Claude Code `http://` bir base URL'yi de `HTTPS_PROXY`'ye
gönderiyor, bu yüzden kimlik proxy'si `NO_PROXY`'de olmalı (ilk koşumda iki deneme
`unknown` oldu); izin listesi bir ölçüm koşulu, imaj özetiyle kayda girmeli.
Tavan: proxy ada göre süzüyor, içeriğe bakmıyor; izinli bir adrese giden istek veri
taşıyabilir. Konteynerde sır olmaması (K3) bu yüzden ayrı bir koşul.
Doğrulama: `node tools/runner-env/verify.mjs` dokuz kontrolün dokuzunu geçti.
Üç düzenek ters çevirmesinin (her şeye izin veren proxy, iç olmayan ağ,
tarayıcısız HOME) her biri tam kendi kontrollerinde kırmızı. Talimat denetimi beş
yola bırakılan dosyanın beşinde ve derleme adımında düştü.
Geri dönüş maliyeti: düşük (araç dizini; ürün kodu değişmedi)
