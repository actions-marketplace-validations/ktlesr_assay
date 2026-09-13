# Yol Haritası

Dört faz. Sıra bir ilkeye dayanıyor: **önce host sinyalini kanıtla, sonra
SaaS'ı inşa et.** Faz 0 ve 1 bitmeden Faz 2'ye geçilmez.

Her adımın somut bir çıktısı var. Çıktı üretilmeden adım kapanmaz.

---

## FAZ 0 — Fizibilite

**Amaç:** Assay'in gerçekte neyi kanıtlayabileceğini belirlemek. Bu fazın
çıktısı git/gitme kararıdır.

| Adım | Çıktı |
|---|---|
| 0.1 Proje anayasası | Repo hijyeni, CLAUDE.md, `docs/` (product, invariants, stack, decisions, workflow, roadmap) |
| 0.2 Monorepo iskeleti | pnpm workspace, paketler, ortak tsconfig, bağımlılık kuralının ihlal yakaladığını kanıtlayan test |
| 0.3 Vaka seti şeması | YAML şeması + Zod doğrulayıcı; negatif vaka zorunluluğu şema seviyesinde |
| 0.4 Assertion motoru | Deterministik assertion'lar, üç durumlu verdict üretimi |
| 0.5 Adaptör arayüzü | Host adaptör sözleşmesi + MockAdapter (yalnızca test aracı) |
| 0.6 Host fizibilite spike ⚠️ | `docs/host-feasibility.md` — Claude Code / Codex / Copilot için dört sinyalin okunabilirlik matrisi |

### Faz 0 → Faz 1 geçiş kriteri

En az bir hostta **trigger sinyali orta veya yüksek güvenilirlikle**
okunabiliyor olmalı.

Okunamıyorsa ürünün kapsamı yeniden tanımlanmalı: tetiklenme katmanı
olmadan Assay bir ajan entegrasyon testi aracına dönüşür ve o alanda
rekabet çok daha sert. Bu durumda 0.6 raporundan sonra durulur.

0.6 tamamlanmadan Faz 1'e geçilmez.

---

## FAZ 1 — CLI ürünü

**Amaç:** `assay run ./suite.yaml` gerçek bir skill'i gerçek bir hostta
güvenilir ölçüyor.

| Adım | Çıktı |
|---|---|
| 1.1 Gerçek adaptör | 0.6'da en temiz sinyali veren host için çalışan adaptör |
| 1.2 Runner, sandbox ve yerel store | Sandbox içinde N tekrarlı koşum, kanonik kayıt, `.assay/runs/` dosya store |
| 1.3 Sandbox güvenlik incelemesi | Sandbox kaçış yüzeyi raporu ve kapatılan açıklar |
| 1.4 CLI | `assay run`, terminal ve HTML rapor, doğru CI exit code |
| 1.5 GitHub Action | PR'da koşan action |
| 1.6 Dogfooding | `docs/dogfooding.md` — 3–5 gerçek skill üzerinde mühendislik raporu |

### Faz 1 → Faz 2 geçiş kriteri

Hepsi birden tutmalı:

- 1 gerçek host üzerinde koşuyor
- 3–5 gerçek skill ölçüldü
- Her skill için pozitif + negatif + yakın-komşu vakası var
- En az 10 tekrarla koşuldu
- Trigger için `pass` / `fail` / `unknown` üretiliyor
- Artefakt doğrulaması çalışıyor
- Araç çağrısı izi okunuyor
- `no_swallowed_errors` gerçek bir vakada tetiklendi
- HTML ve terminal rapor var
- CI exit code doğru

Bunlar tutuyorsa çekirdek ürün riski büyük ölçüde çözülmüştür. Faz 2 ancak
bundan sonra anlamlı.

---

## FAZ 2 — Hosted katman

**Amaç:** Geçmiş, regresyon karşılaştırması, ekip görünürlüğü.

| Adım | Çıktı |
|---|---|
| 2.1 Veri modeli | `packages/db` Prisma şeması, `core` kanonik tiplerinden türetilmiş |
| 2.2 Tema sistemi ve tasarım dili | Koyu/açık tema, tokenlar, `/dev/components` ayakta |
| 2.3 Bileşen katmanı | `packages/ui` — oran gösterimi N ve GA olmadan render edilemez |
| 2.4 Dashboard | Koşum geçmişi, regresyon görünümü, EmptyState |
| 2.5 Kimlik doğrulama | Auth.js, rol alanı |
| 2.6 Admin panel | Kullanıcı ve koşum yönetimi |
| 2.7 Tanıtım sayfası | Yalnızca gerçek koşum çıktısı; uydurma rakam, logo, referans yok |

### Faz 2 → Faz 3 geçiş kriteri

- Yerel store ve hosted şema aynı kanonik modeli paylaşıyor, ayrışma yok
- Dashboard'daki her sayı gerçek bir koşumdan geliyor
- Hiçbir oran N ve güven aralığı olmadan render edilmiyor
- `unknown` ayrı bir durum olarak gösteriliyor, hata kovasına düşmüyor

---

## FAZ 3 — Sağlamlaştırma

| Adım | Çıktı |
|---|---|
| 3.1 Tam güvenlik incelemesi | Sandbox, auth, admin ve veri sınırlarının raporu |
| 3.2 Test ve CI | Kapsam eşiği, CI pipeline'ı yeşil |
| 3.3 Deploy | Dokploy üzerinde çalışan kurulum |

---

## 0.1.3 — Ölçülmeyen koşum her katmanda `unknown` — TAMAMLANDI

**Amaç:** Aynı olayın iki katmanda iki farklı verdict üretmemesi.

Token iptal edildiğinde tetiklenme `unknown`, artefakt assertion'ları `fail`,
`side_effect` ise `pass` dönüyor. Üçü de aynı koşumdan geliyor ve ölçüm hiç
yapılmadı. Sebep: tetiklenme katmanı oturumun durumuna bakıyor, assertion
katmanı bakmıyor — oturum koşmadığında boş çalışma dizini "kanıt toplandı"
sayılıyor ve `REQUIRES` koruması alanı dolu görüyor
([blockers.md](blockers.md)).

Değişmez #1'in iki yönlü ihlali: `fail` kullanıcıyı yanlış yere bakmaya
gönderiyor, `side_effect`in `pass`ı ise doğrudan yasaklanan sessiz geçiş.

| Adım | Çıktı |
|---|---|
| 0.1.3-a Kanıt yokluğu kanıt sayılmasın | `SessionResult.outcome === 'error'` iken `runAttempt` `files`, `env` ve `exitCode` alanlarını doldurmaz; sevk katmanının mevcut `REQUIRES` koruması `unknown` üretir |
| 0.1.3-b Koşan ama yazmayan ajan ayrı kalsın | `outcome: 'completed'` ve boş workspace `fail` vermeye devam eder — orada gerçekten ölçüm var |
| 0.1.3-c Test | Kimlik bilgisiz bir oturumu taklit eden koşum testi: her katman `unknown`, hiçbiri `fail` ya da `pass` |

**Geçiş kriteri.** Host oturumu açamadığında bir attempt'in ürettiği her
verdict `unknown`. Hiçbir katman `pass` vermiyor, hiçbir katman `fail`
vermiyor, ve gerekçe kimlik/host sorununu adıyla söylüyor.

**Neden ayrı bir yama.** 0.1.2 yayımlandı ve bu bir davranış değişikliği:
bugün `fail` alan koşumlar `unknown` almaya başlayacak, yani CI çıkış kodu
1'den 3'e kayacak. Doğru yön bu ama sürüm notunda yazılması gerekiyor.

---

## 0.2.0 — Sandbox tavanı: reddedilen komut

**Amaç:** Ölçümün "skill bunu yapamadı" ile "Assay buna izin vermedi"yi
ayırması.

Adaptör `--permission-mode acceptEdits` ile koşuyor: `Write` serbest, kabuk
çalıştırma onay bekliyor ve etkileşimsiz koşumda onaylayacak kimse yok. Redde
ait metin izde duruyor ama sınıflandırılmıyor, dolayısıyla iki farklı
başarısızlık aynı görünüyor. Ölçüldü: `webapp-testing` tamamlama koşumunda
10 denemenin 10'unda en az bir kabuk çağrısı reddedildi ve 4'ü
`no_swallowed_errors`'ı tetikledi ([measurements.md](measurements.md),
[blockers.md](blockers.md)).

Aynı ayrımın tetiklenme katmanındaki karşılığı 0.2.0-d'de bulundu ve daha
ağırdı: adaptör `Skill` çağrısını görüp "tetiklendi" yazıyor, aktivasyonun
gerçekleşip gerçekleşmediğine bakmıyordu. Bir pilot koşumda 4 kayıtlı
tetiklenmenin 4'ü de reddedilmiş aktivasyondu ve rapor precision %100 dedi.

| Adım | Çıktı | Durum |
|---|---|---|
| 0.2.0-a Reddi sınıflandır | `TraceEvent.refusal` ve `result.permission_denials` okunuyor; izin reddi yüzünden düşen artefakt assertion'ı `fail` değil `unknown` üretir | iz tarafı **tamam**; artefakt assertion'ı bekliyor |
| 0.2.0-b Redde ayrı cümle | `no_swallowed_errors` "gerçek hata bildirilmedi" ile "Assay'in reddi bildirilmedi"yi ayrı raporlar | bekliyor |
| 0.2.0-c Komut allowlist'i | Vaka seti `sandbox: { allow_commands: [...] }` beyan eder; runner host'un `--allowedTools` biçimine çevirir, izin genişlemesi `suiteHash`'e girer | bekliyor |
| 0.2.0-d Tetiklenme = doğrulanmış aktivasyon | Reddedilen aktivasyon tetiklenme sayılmıyor; her katmanda `unknown` ve doğruluk matrisinin dışında | **tamam** |
| 0.2.0-e İzin modu dışarı açıldı | `--permission-mode`, varsayılan değişmeden; mod kayda, rapora ve ortam hash'ine giriyor | **tamam** |
| 0.2.0-f Hook olayları | `system/hook_started` ve `hook_response` kanonik ize giriyor | **tamam** |

**Geçiş kriteri.** Bir kabuk çalıştıran tamamlama vakası, komut allowlist'i
verildiğinde `pass`/`fail` üretebiliyor; verilmediğinde `unknown` üretiyor ve
sebebini yazıyor. Hiçbir durumda izin reddi `fail` olarak raporlanmıyor.

**Davranış değişikliği.** 0.2.0-d bugün `fail`/`pass` alan koşumları `unknown`a
çeviriyor ve CI çıkış kodunu 1'den 3'e kaydırıyor. Ayrıca izin modu ortam
hash'ine girdiği için 0.2.0 öncesi kayıtlar yeni kayıtlarla "ortam kaydı"
olarak karşılaştırılıyor. İkisi de sürüm notunda yazılı.

**Neden konteyner değil.** Konteyner sandbox (A1'in yükseltme yolu) bu üçünü de
gereksiz kılmaz: konteynerin içinde de bir izin modeli seçmek gerekiyor. Sıra
bu yüzden böyle — önce ölçümün dürüstlüğü, sonra izolasyonun sertliği.
Konteyner Faz 3'te kalıyor ([sandbox-security.md](sandbox-security.md), A1).

---

## 0.3.0 — Ölçüm altyapısı: hayatta kalma, hız, dürüst gerekçe

**Amaç:** Uzun bir ölçümün kendi kendini yok etmemesi, dörtte bir sürede
bitebilmesi, denemeyi kararı netleşmiş vakaya harcamaması ve reddettiği
karşılaştırmanın gerekçesini doğru adrese göndermesi.

**Kanıt tabanı.** 2026-09-08, `impeccable` 4.2.2 ölçümü: izin modu başına 120,
toplam **240 deneme**, iki izin modu, $21.15, 285.8 dakika ajan zamanı, ~8 saat
duvar saati. Kayıtlar ve ledger'lar ölçüm deposunda (`assay-example`):
`reports/impeccable.4.2.2.<mod>.ledger.tsv`, `reports/impeccable.4.2.2.md`,
`reports/impeccable.4.2.2.progress.md`. Aşağıdaki beş kusurun beşi de bu
koşumda canlı görüldü. Dördü Assay'in kendi kodunda; biri (madde 1) hem kodda
hem tasarımda.

| Adım | Çıktı | İş | Geri dönüş | Durum |
|---|---|---|---|---|
| 0.3.0-a Kayan pin adıyla söylensin | `compare` `environmentHash`i ve içinde kayan alanı adıyla raporlar | S (~0.5 gün) | düşük | **tamam** |
| 0.3.0-b Öldürülen koşum ölçtüğünü kaybetmesin | Deneme başına append-only journal, `partial` kayıt, `assay recover` | M (~1 gün) | düşük | **tamam** |
| 0.3.0-c Runner ajanın erişiminden çıksın | Süreç ağacı öldürme + supervisor/worker ayrımı; öldürülen deneme `unknown` | L (2–3 gün) | orta | **tamam** |
| 0.3.0-d Paralel koşum | `--concurrency`, varsayılan 1; port kirası; kayda yazılır | M (~1 gün) | düşük | **tamam** |
| 0.3.0-e Hızlı mod | `--fast` = N=3 + yalnız tetiklenme katmanı; ölçülen katmanlar kayda girer | M (~1–1.5 gün) | düşük | **tamam** |

Uyarlanabilir durdurma (**erken durma**) 0.3.0'a alınmadı; gerekçesi ve planı
0.3.1 başlığında.

---

### 0.3.0-a — `compare` kayan pini adıyla söylesin

**Kanıt.** Çapraz izin modu karşılaştırması doğru şekilde reddedildi (exit 3)
ama gerekçe **"systemPromptHash changed"** oldu. İki kayıtta da
`systemPromptHash: not-provided-by-host` — yani o alan kımıldamadı. Değişen
`environmentHash`, ve onun içinde değişen tek alan `permissionMode`
(`acceptEdits` → `bypassPermissions`). Doğru karar, yanlış adres: kullanıcı
hiç var olmayan bir sistem promptu kaymasını aramaya gönderiliyor.

**Kök sebep.** `comparePins` (`packages/core/src/records.ts`), `environmentHash`
ayrıştığında `drifted`'a `'systemPromptHash'` yazıyor — çünkü hash pin 3'ün
denetçisi olarak tasarlandı (2026-09-03 kararı). Denetçinin bulgusu denetlenen
pinin adıyla raporlanıyor. Aynı kusur ters yönde de var: hash bir tarafta
okunamadığında rapor `systemPromptHash` okunamadı diyor.

| # | Seçenek | Bedel | Karar |
|---|---|---|---|
| A | Olduğu gibi bırakmak | Her çapraz mod karşılaştırması yanlış adres verir | Hayır |
| B | `drifted`'a `environmentHash` yazmak | Küçük; mesaj doğru ama "hangi alan" demiyor | Yetersiz |
| C | B + hash'in içinde kayan alanı söylemek | Kayda opsiyonel `environment` bileşenleri eklenir; adaptör onları zaten hesaplıyor ve atıyor | **Evet** |

**C.** `Run.environment?: { model, version, outputStyle, permissionMode, tools,
skills, agents, plugins }` — `environmentHash`in girdisi zaten tam olarak bu
nesne (`packages/adapters/src/claude-code/adapter.ts`) ve hash alındıktan sonra
atılıyor. İki kayıtta da varsa `compare` alan alan fark alır ve
`permissionMode: acceptEdits → bypassPermissions` der; yoksa hash düzeyinde
"the environment record changed" der. Pin 3 hâlâ pin 3; yalnızca kaymanın
nerede görüldüğü doğru yazılır.

**İş.** S — `records.ts` (tip + `comparePins`), `compare.ts` (cümle), adaptör
(bileşenleri döndür), runner (kayda yaz), terminal ve HTML render. ~150 satır +
testler.
**Geri dönüş maliyeti.** Düşük. Kayıt alanı ek ve opsiyonel; eski kayıtlar
okunmaya devam eder ve hash düzeyindeki cümleyi alır.
**Not.** Bu adım hiçbir verdict'i değiştirmiyor, yalnızca gerekçe cümlesini.
Sırada birinci olmasının sebebi bu: risksiz, yarım günlük ve bugün yanlış olan
bir çıktıyı düzeltiyor.

---

### 0.3.0-b — Öldürülen koşum ölçtüğünü kaybetmesin

**Kanıt.** `bypassPermissions-chunk5` iki kez üst üste `exit -1`, `record NONE`
ile öldü (ledger satırları 17:06 ve 17:21). Her iki denemede de beş deneme
ekrana `✓` basmıştı ve **hiçbiri diske yazılmadı**. Toplam ~40 dakika ve ~$4.
4.2.1 ölçümünde de aynı şey olmuştu.

**Kök sebep — bizde.** `runSuite` bütün vakalar bittikten sonra tek bir `Run`
döndürüyor (`packages/runner/src/run.ts`); `RunStore.save` CLI'da o dönüşten
sonra çağrılıyor (`packages/cli/src/cli.ts`). Yani koşum ortasında ölen bir
süreç, o ana kadar **tamamlanmış her denemeyi de** götürüyor. Kayıp, ölen
denemeyle değil koşumun uzunluğuyla orantılı: ölçüm büyüdükçe risk büyüyor ve
tam da uzun ölçümlerde ölüyor.

| # | Seçenek | Bedel | Karar |
|---|---|---|---|
| A | Olduğu gibi + kullanıcı chunk'lasın | Bugün yapılan; 5 chunk'a bölmek yetmedi, chunk içi ölüm kurtarılamıyor | Hayır |
| B | Her denemeden sonra tam kaydı yeniden yazmak | O(n²) yazma; 240 denemelik kayıt MB'larca, her denemede yeniden serileştirilir | Hayır |
| C | Append-only journal + normal bitişte katlama | Küçük ve dönüşsüz; kayıp en fazla bir deneme | **Evet** |

**C.** Her deneme bittiğinde `.assay/runs/<run-id>.partial.jsonl` dosyasına bir
satır eklenir. Koşum normal bittiğinde satırlar tek bir `Run` kaydına katlanır
ve journal silinir. `assay recover` (ya da `run` başlangıcında bulunan yetim
journal) yarım journal'ı kayda çevirir.

Kurtarılan kayıt **yarım olduğunu söyler**: `partial: true`, kesilme sebebi ve
vaka başına gerçek N. Değişmez #4 zaten her oranı N ve aralığıyla gösteriyor;
yarım bir kayıt yalan söylemiyor, yalnızca daha az şey biliyor ve aralığı geniş
çıkıyor. `compare` yarım kaydı reddetmez — ama raporda yarım olduğu yazılır.

**İş.** M — runner store + `run.ts` + CLI `recover` + testler. ~1 gün.
**Geri dönüş maliyeti.** Düşük. Journal geçici bir dosya; kayıt şemasına tek
opsiyonel alan giriyor.

---

### 0.3.0-c — Runner ajanın erişemeyeceği yerde olsun

**Kanıt.** `bypassPermissions` altında ölçülen ajan işini doğrulamak için dev
sunucu başlatıyor, sonra süreçleri **porta göre** öldürüyor. Assay runner'ı
aynı kullanıcı altında sıradan bir `node` süreci ve aynı alanda duruyor.
4.2.1'de bir, 4.2.2'de iki koşum bu şekilde öldü; ikisi de chunk içinde, yani
sürücünün araya girebileceği bir yerde değil.

**İkinci kök sebep — bu kez tamamen bizde.** Adaptör zaman aşımında yalnızca
doğrudan çocuğu öldürüyor: `child.kill('SIGKILL')`
(`packages/adapters/src/claude-code/adapter.ts`). `claude.exe`'nin başlattığı
dev sunucular hayatta kalıyor. Yani **portu meşgul eden yetimleri biz
üretiyoruz**; bir sonraki denemenin ajanı portu dolu buluyor ve porta göre
öldürmeye girişiyor. Kullanıcının sürücüsü 3., 4. ve 5. chunk'tan önce 2, 1 ve
4 yetim temizledi — döngünün her halkası ölçülmüş durumda.

| # | Seçenek | Bedel | Karar |
|---|---|---|---|
| A | Süreç ağacını öldür (job object / süreç grubu) | Küçük; yetim üretmeyi bırakır, döngünün başlangıcını keser | **Evet** |
| B | Supervisor/worker ayrımı | Orta; öldürülen deneme koşumu düşürmez | **Evet** |
| C | Runner'ı başka bir isimle koşturmak | Küçük ama sahte: ajan porta göre de öldürüyor | Hayır |
| D | Konteyner (deneme başına) | Büyük; Windows'ta Docker bağımlılığı. A1'in yükseltme yolu | Faz 3 |

**A.** Ajan süreci kendi süreç grubunda (POSIX) / job object'inde (Windows)
başlatılır ve deneme bittiğinde ağaç bütün olarak öldürülür. Bugünkü tek
çocuk öldürme, yetim üretimini garanti ediyor.

**B.** Dayanıklı taraf (store, journal, ilerleme, rapor) bir supervisor
sürecinde kalır; her deneme kısa ömürlü bir worker sürecinde koşar. Worker
öldürülürse supervisor o denemeyi `unknown` yazar — gerekçe "the attempt
process was killed; the measured agent may have killed it" — ve devam eder.
Bu, madde 1'in tek gerçek cevabı olmakla kalmıyor, madde 2'nin de ön koşulu.

**Tavan açıkça yazılacak.** Supervisor da aynı makinede bir `node` süreci;
`taskkill /F /IM node.exe` onu da öldürür. Hiçbir yerde "korunuyor"
denmeyecek — "kayıp bir denemeyle sınırlanıyor" denecek. Sandbox'ın kendi dili
zaten bu (2026-08-31: *gözlemler, zorlamaz*). Gerçek izolasyon konteyner ve o
Faz 3'te.

**İş.** L — runner'ın iç mimarisi, worker giriş noktası, IPC, öldürülme
tespiti, testler. 2–3 gün.
**Geri dönüş maliyeti.** Orta. Genel API (`runSuite`) aynı kalıyor; değişen
altındaki koşum düzeni.

---

### 0.3.0-d — Paralel koşum

**Kanıt.** 240 deneme sekiz saat sürdü. Döngü `run.ts` içinde iç içe iki `for`
ve her deneme `await` ediliyor; hiçbir şey paralel değil. Ajan zamanı 285.8
dakika, yani duvar saatinin yarısından fazlası tek bir sıraya dizilmiş bekleme.

**Çakışma alanları.**

| Alan | Durum |
|---|---|
| Port | Ajan dev sunucu başlatıyor. İki paralel deneme aynı portu ister; biri diğerini öldürür — madde 1'in aynısı, işçi sayısı katı |
| Host hız sınırı / maliyet piki | Paralellik üst sınırı büyük ihtimalle burası |
| CPU ve bellek | Deneme başına bir tarayıcı açılabiliyor |
| Skill kopyası, `CLAUDE_CONFIG_DIR`, çalışma dizini | Zaten deneme başına ayrı; çakışma yok |

**Karar.** `--concurrency <n>`, **varsayılan 1**. Değer kayda yazılır.
`environmentHash`'e **girmez**: host ortamının bir özelliği değil, koşum
düzeninin. Ama gecikme ve maliyet sayıları eş zamanlı koşumda aynı şeyi
ölçmüyor; rapor concurrency > 1 iken gecikmenin karşılaştırılabilir olmadığını
söyler.

**Port kirası.** Her worker'a ayrık bir port aralığı verilir ve `PORT`,
`VITE_PORT` gibi değişkenlerle worker ortamına konur. Bu bir **yumuşatma,
garanti değil**: ajanın bu değişkenlere uyma zorunluluğu yok. Tavan yazılacak;
gerçek ayrım konteynerle gelir.

**Beklenen kazanç.** concurrency 4'te ~8 saat → ~2–2.5 saat. Üst sınır host hız
sınırı, makine değil.

**İş.** M — c'nin üstüne ~1 gün.
**Geri dönüş maliyeti.** Düşük; bayrak ve varsayılan değişmiyor.

---

### 0.3.0-e — Hızlı mod

**Kanıt — araç zaten elle kullanıldı.** 4.2.2 ölçümünden önce ayrı bir store'da
(`.assay-smoke`) 12 denemelik bir duman koşumu yapıldı ve sekiz saatlik ölçümün
manşet bulgusunu önceden gösterdi: 5/5 çağrıda base dizin doğru çözüldü
(bulgu 4a kapanmış), 0/7 yanlış pozitif. Elle yapılan ve işe yarayan şey araca
girmeli.

**Tasarım.** `--fast` = `--repeat 3` + yalnızca tetiklenme katmanı + bütçe
tavanı. Amacı kanıt değil erken uyarı; tam mod nightly ve sürüm öncesi kalır.

> **Sapma (2026-09-10).** Gizli bütçe tavanı kaldırıldı; tavan yalnızca
> `--max-attempts` ile geliyor ve bütçenin kestiği koşum `pass` veremiyor.
> Gerçek hostta tavan bütün negatifleri kesip PASS verdi. Gerekçe
> [decisions.md](decisions.md)'de.

**Dürüstlük kısıtları.**

- Değişmez #3 sağlanıyor: 3 > 1.
- Değişmez #4: aralıklar geniş çıkar (3/3 → %44–100). Gizlenmez; hızlı mod
  raporu bunu manşete taşır: *bu koşum regresyon gösteremez, yalnızca kırılma
  gösterir.*
- Değişmez #1: atlanan bir assertion "geçti" sayılamaz. Bu yüzden hızlı mod
  **yarım ölçülen vaka üretmez**: ölçülen katmanlar kayda yazılır
  (`layers: ['trigger']`), yalnızca artefakt ölçen vakalar hiç koşulmaz, koşulan
  vakada beyan edilmiş assertion'lar "bu modda değerlendirilmedi" olarak
  listelenir. Vaka verdict'i beyan edilmiş dar katmandan gelir — bu bir yarım
  ölçüm değil, dar ve beyan edilmiş bir ölçüm.

Katman kavramı kayda girdiği için `report` ve `compare` de okuyabilir: farklı
katman kapsamıyla ölçülmüş iki koşum aynı vakada karşılaştırılmaz.

**Kullanım.** PR'da `--fast`, gece ve sürüm öncesi tam koşum. GitHub Action
varsayılanı buna göre güncellenir. d'den sonra bir tetiklenme suite'i
(12 vaka × 3) concurrency 4 ile ~10 dakikaya iner.

**İş.** M — core katman alanı, runner, cli, terminal, html, action, docs.
~1–1.5 gün.
**Geri dönüş maliyeti.** Düşük.

---

### Sıra ve gerekçesi

**a → b → c → d → e**, sonra 0.3.1'de uyarlanabilir durdurma.

- **a önce**, çünkü yarım gün ve bugün her çapraz mod karşılaştırmasında yanlış
  bir cümle basıyoruz. Hiçbir davranışa dokunmuyor.
- **b ikinci**: tek başına bile bir daha 40 dakika kaybettirmez, ve c'nin
  altyapısı zaten bu.
- **c üçüncü**: hem madde 1'in gerçek cevabı hem d'nin ön koşulu.
- **d dördüncü**: c olmadan paralellik madde 1'i çoğaltmaktan başka bir şey
  yapmaz.
- **e beşinci**: benimseme için kritik ama d'den sonra çok daha hızlı, ve
  ölmeyen bir runner üstünde anlamlı.

**Makul alternatif:** e'yi öne almak (benimseme argümanı). Reddedilmedi, ama
önerilmiyor: hızlı mod, ölçtüğünü kaybeden bir runner üzerinde ilk deneyimi
iyileştirmez. İlk koşumu ölen kullanıcının ikinci koşumu olmaz.

### Geçiş kriteri

- Öldürülen bir koşum, o ana kadar tamamlanmış her denemeyi kayıtta bırakıyor;
  kayıt yarım olduğunu ve neden kesildiğini söylüyor.
- Ajanın başlattığı süreçler deneme bitiminde ölüyor; art arda iki chunk'ta
  yetim sayısı sıfır.
- `--concurrency 4` ile aynı suite karşılaştırılabilir sonuç veriyor (aynı
  pinler, aralıklar kesişiyor) ve duvar saati en az yarıya iniyor.
- `--fast` bir suite'i N=3 ve yalnız tetiklenme katmanıyla koşuyor; kayıt hangi
  katmanların ölçüldüğünü söylüyor; rapor manşette "erken uyarı, kanıt değil"
  diyor.
- Çapraz izin modu karşılaştırması kayan alanı adıyla söylüyor.

### Davranış değişikliği

- b `partial`, e `layers`, a `environment` alanlarını kayda ekliyor. Üçü de
  opsiyonel; eski kayıtlar okunmaya devam ediyor.
- d ve e yeni bayraklar. **Hiçbir varsayılan değişmiyor** — tekrar sayısı,
  izin modu ve eşzamanlılık aynı kalıyor.

### Kapsam dışı, kaydedildi

**HTML raporundaki metrik kutuları hâlâ kart.** `docs/design.md` #1 "veri
kutularda değil çizgilerde durur, kart yok" diyor; CLI'ın HTML raporundaki
TRIGGER PRECISION / ATTEMPTS / COST kutuları bu kuralın dışında kalmış durumda.
0.3.0-b'de aynı dosyadaki `.callout` düzeltildi ama kutulara dokunulmadı: bu,
raporun tamamının web'in tasarım diline hizalanması demek ve kendi
değişikliğini hak ediyor. Ölçümün doğruluğunu etkilemiyor.

Ölçüm sırasında ortaya çıkan ama beş maddeye girmeyen bir gürültü kaynağı: bu
makinedeki Git Bash `add_item ... fatal error` çökmesi 390 Bash çağrısının
11'ini düşürdü (4.2.1'de 403'te 0) ve skill'in başarısızlık sütununu şişirdi.
Assay bunu host ortamı kazası olarak sınıflandırmıyor, sıradan bir araç hatası
sayıyor. Aynı çökme bu plan hazırlanırken de iki kez görüldü. Sınıflandırılıp
`unknown` üretmesi gerekip gerekmediği 0.3.2'de değerlendirilecek; şimdi
yapılmayacak.

---

## 0.3.1 — Uyarlanabilir durdurma ve yarım kaydın verdict'i

| Adım | Çıktı | Durum |
|---|---|---|
| 0.3.1-a Uyarlanabilir durdurma | Sabit bakış çizelgesi + Bonferroni; kalibrasyon koşumu | bekliyor |
| 0.3.1-b Kurtarılan yarım kayıt `pass` veremez | Yarım kaydın verdict'i en iyi ihtimalle `unknown`; hiç koşulmamış vakalar kayıtta adıyla | **tamam** |

### 0.3.1-a — Uyarlanabilir durdurma

**Amaç:** Denemeyi kararı çoktan netleşmiş vakaya değil, kararsız vakaya
harcamak.

**Neden ayrı sürüm.** Yayımlanan güven aralığının *anlamını* değiştiriyor ve
doğrulaması para harcayan bir kalibrasyon koşumu istiyor.

**Kanıt iki yönlü.**

- *İsraf:* dört ölçümün dördünde de tamamlama vakası 0/10; negatiflerde 280
  denemede 0 yanlış pozitif. Bu vakalarda beşinci denemeden sonra gelen hiçbir
  deneme kararı değiştirmedi.
- *Ters yön:* aynı rapor `empty_state` için "N=10'da aralık %6–51'e karşı
  %24–76; bu bir sonuç değil" diyor. Yani sabit N yalnızca fazla harcamıyor,
  **yanlış yere** harcıyor.

Bu yüzden özellik "erken durma" değil **yeniden dağıtım**: kararı netleşmiş
vakadan alınan denemeyi kararsız vakaya vermek.

**Değişmez uyarısı — uygulamadan önce okunacak.** Naif çözüm (her denemeden
sonra Wilson aralığına bak, yeterince darsa dur) istatistiksel olarak
yanlıştır: tekrar tekrar bakılarak durdurulan bir aralık artık %95 kapsama
taşımaz (optional stopping). Değişmez #4 aralığın gösterilmesini şart koşuyor;
gösterilen aralığın **iddia ettiği şey olması** aynı kuralın ruhu. Kararsızlık
ölçen bir aracın kendi aralığını sessizce şişirmesi, LLM judge eklemekle aynı
sınıfta bir hata olurdu.

| # | Seçenek | Karar |
|---|---|---|
| A | Sabit N (bugün) | Ölçülmüş israf |
| B | Naif Wilson erken durma | **Hayır** — kapsama garantisi kaybolur |
| C | Sabit bakış çizelgesi + Bonferroni düzeltmesi (α/k) | **Evet** |
| D | Anytime-valid güven dizisi (e-değeri / bahis) | Yükseltme yolu |

**C.** Bakışlar önceden ilan edilir (örn. 5, 10, 20, 40) ve α = 0.05/4
kullanılır. Deterministik, açıklanabilir, biraz muhafazakâr — aralık naif
Wilson'dan geniş çıkar ve bu doğru olan. Kayıt durma kuralını ve bakış sayısını
taşır; rapor "N=7'de durduruldu (kural: aralık genişliği ≤ 0.25, 4 bakışa
düzeltilmiş %95)" der. Alt sınır değişmez #3'ün altına inmez.

**Doğrulama para harcar.** Kuralın gerçekten daha az denemeyle aynı sonucu
verdiğini göstermek için aynı suite'in sabit-N ve uyarlanabilir koşumları yan
yana gerekiyor (~$10–20). Sözleşme 1 gereği tetiği kullanıcı çeker.

**İş.** L — ~2 gün kod + bir kalibrasyon koşumu.
**Geri dönüş maliyeti.** Orta — yayımlanmış aralığın anlamı bir kez
değiştirilir.

### 0.3.1-b — Kurtarılan yarım kayıt `pass` veremez

**Kanıt.** 0.3.0'da bütçenin kestiği koşumun `pass` verebildiği gerçek hostta
görüldü ve kapatıldı (decisions.md, 2026-09-10). Aynı kusur ikinci bir yoldan
açık kalıyor: öldürülüp `assay recover` ile kurtarılan bir koşum, ölçülen her
denemesi geçtiyse `pass` diyor. `recoverJournal` verdict'i yalnızca tamamlanmış
denemelerden hesaplıyor; koşulmamış olanlar hesaba girmiyor.

**Bütçeden daha ağır olan kısmı.** Bütçe kesmesi vakaları `skipped`a sebebiyle
yazıyor. Kurtarma yazmıyor: koşum sıradaki vakalara hiç gelmeden öldüyse o
vakalar kaydın **hiçbir yerinde** görünmüyor — ne `cases`'te ne `skipped`'da.
Suite sırasında negatifler sondaysa (ölçülen bütün setlerde öyle), yarıda
kesilen bir koşum yalnız pozitiflerle `pass` diyen ve eksiğini söylemeyen bir
kayıt bırakır. Kayıt `partial` künyesini ve manşetteki "incomplete run" notunu
taşıyor, ama verdict alanı tek başına okunduğunda — `assay push` sonrası
dashboard, `compare`'in taban çizgisi — yalan söylüyor.

| # | Seçenek | Karar |
|---|---|---|
| A | Olduğu gibi bırakmak; `partial` künyesi yeter | Hayır — verdict alanı künyeden bağımsız okunuyor |
| B | Yarım kaydı hiç kaydetmemek | Hayır — 0.3.0-b'nin kurtardığı ölçümü geri atar |
| C | Yarım kaydın verdict'i en iyi ihtimalle `unknown`; ölçülmüş `fail` yine `fail` | **Evet** |

**C.** Bütçe kuralının aynısı: koşulmamış deneme ölçülmedi, ölçülmeyen şey
geçmiş sayılmaz. Ek olarak kurtarma, planlanıp hiç koşulmamış vakaları
`skipped`a yazar (`cause: 'interrupted'`). Plan journal başlığında zaten
duruyor (0.3.0'da `layers`/`skipped` için oraya taşındı); eksik olan vaka
listesinin kendisi. Gerekçe cümlesi kesilmeyi adıyla söyler.

**Doğrulama.** `killable-run` fixture'ı üç denemeden sonra SIGKILL ediyor.
Ölçüldü (2026-09-10, 0.3.0): kurtarılan kayıt `verdict=pass`, içinde yalnız
`trigger.positive.explicit:3`; negatif vaka ne `cases`'te ne `skipped`'da. Test o kaydın `unknown` olmasını ve koşulmamış
vakaların adıyla listelenmesini istemeli; ters çevirme verdict kuralını ve
vaka listesini ayrı ayrı sınamalı — ve bu fazda dört kez yaşandığı gibi,
mutasyon derlemeyi kırmamalı.

**Davranış değişikliği.** Bugün `pass` olarak kurtarılan kayıtlar `unknown`
olur. Hosted tarafa daha önce yüklenmiş kayıtların verdict'i değişmez; kural
yeni kurtarmalara uygulanır. Sürüm notunda yazılacak.

**İş.** S–M — `recoverJournal`, `verdictOf`, başlığa vaka planı, testler. ~0.5–1 gün.
**Geri dönüş maliyeti.** Düşük.

---

## 0.4.0 — Çakışma ölçümü şeması

**Amaç:** Birden çok skill'in birlikte kurulu olduğu bir suite'te "bu vakada X
kazanmalı" diyebilmek, ve hiçbir skill tetiklenmediğinde bunun geçti
sayılmaması.

**Kanıt.** `marketingskills` çakışma koşumu (ölçüm deposu,
`run-2026-09-10T11-01-34-914Z-0bec859e`, assay 0.3.2, 200 deneme;
`reports/marketingskills.collide.md` bölüm 5; not:
`issues/assay-0.4.0-collision-schema.md`). Assay koşumu **179 pass / 21 fail**
diye puanladı; oysa 13 skill'in 7'si kendi vakasında hiç tetiklenmedi.
**Hiçbir skill'in tetiklenmediği 100 pozitif deneme `pass` sayıldı**, çünkü
çakışma vakası yalnızca `not_triggered` ile yazılabiliyordu ve hiçbir şey
tetiklenmediğinde o koşul sağlanıyor. Kazananlar ve matris Assay'den değil, elle
yazılmış `tools/collide.py`'den geldi; beklenen kazanan vaka id'sine gömülmüştü.
Id'lere skill adı da yazılamadı: desen tireyi reddediyordu (`copy-editing`).

| Adım | Çıktı | Durum |
|---|---|---|
| 0.4.0-a Vaka kimliği | Tire her segmentte serbest; hata mesajı sorunlu karakteri adıyla söyler | **tamam** |
| 0.4.0-b `expect.winner` şeması | `winner: <skill>`, `winner: [a, b]` (tartışmalı), `winner: none`; doğrulayıcı kuralları; yalnız-`not_triggered` vakasına uyarı | **tamam** |
| 0.4.0-c Değerlendirme | Kazanmak = ilk doğrulanmış aktivasyon; hiçbiri tetiklenmediyse `fail`; kayda `expectedWinner` | **tamam** |
| 0.4.0-d Çakışma matrisi | `RunSummary.collision`; terminal ve HTML'de hedef-yalnız precision/recall'ın üstünde | **tamam** |
| 0.4.0-e Hosted şema | `CaseResult.expectedWinner` sütunu, migration, eşleme | **tamam** |
| 0.4.0-f Gerçek veriyle kanıt | marketingskills kaydı yeni şemayla yeniden puanlanır; matris `collide.py` tablosuyla hücre hücre aynı, "100 sahte pass" yok | **tamam** |
| 0.4.0-g Ters çevirme | Her adımda derleme kapılı | **tamam** |

**Kararlar** (gerekçeleri decisions.md, 2026-09-10):

- **Kazanmak = ilk doğrulanmış aktivasyon** (`skills[0]`). Kazanandan sonra
  tetiklenen skill "also fired" olarak kayda girer, verdict'i bozmaz; tekillik
  isteyen `not_triggered` ekler.
- **Negatif `winner: none`.** `none` ayrılmış sözcük; değişmez #5 için negatif
  sayılır.
- **Hiçbiri tetiklenmediyse `fail`, `unknown` değil.** Ölçüm yapıldı; `unknown`
  asıl bulguyu gizler ve kullanıcıyı yanlış adrese gönderirdi. "Hiçbiri" ile
  "yanlış skill" gerekçe cümlesinde ve matriste ayrı durur.
- **Web'deki matris ekranı 0.4.1'de.** Şema ve veritabanı 0.4.0'da; ekran ayrı.

**Tavan.** Gözlem, reddedilen çağrılarla doğrulanmış aktivasyonlar arasındaki
sırayı taşımıyor: "kazanandan önce reddedilmiş başka bir seçim" görünmez.
Yükseltme yolu, gözleme sıralı bir seçim listesi eklemek.

**Geriye dönük uyum.** Alanlar opsiyonel; `triggered` ve `not_triggered`'ın
anlamı değişmiyor; id deseni eskisinin üst kümesi. Mevcut suite'lerde tek fark,
yalnız `not_triggered` taşıyan vakalara düşen uyarı.

## 0.4.1 — Çakışma matrisi web'de ve yayımlanmış ölçümlerin dizini

| Adım | Çıktı | Durum |
|---|---|---|
| 0.4.1-1 Çakışma matrisi | Hosted koşum sayfasında `RunSummary.collision`; 0.4.0'ın veritabanı sütunu hazır, yalnızca ekran işi | **tamam** (production'da kazanan beyan eden kayıt yok; matris ilk gerçek kazananlı koşumla görünecek) |
| 0.4.1-2 Yayımlanmış ölçümlerin dizini | Oturumsuz ziyaretçi de yayımlanmış suite'lerin listesini görür — `/suites`, tanıtım sayfasından bağlantılı (kusur 0.4.1-m) | **tamam** |
| 0.4.1-3 Kişisel veri | `redact` üç biçimi ve bu makinenin hesap adını maskeler; `push` kalıntıda yüklemez (0.4.1-b, c) | **tamam** |
| 0.4.1-4 0.2.0 öncesi kayıt | Aktivasyon kontrolü "yapılmadı" olarak saklanır ve gösterilir; bozuk kayıt yerini söyler (0.4.1-a, d) | **tamam** |
| 0.4.1-5 `/compare` yayın modunda | Açık; kapsam koşumu sızdırmıyor (0.4.1-i) | **tamam** |
| 0.4.1-6 Küçük kusurlar turu | e, f, g, h, j, k, l, n, o (i ve m 0.4.1-5 ve 0.4.1-2'de kapandı) | **tamam** |
| 0.4.3-a Hızlı mod kazanan beyanını ölçüyor | `--fast` yalnızca `winner` taşıyan vakayı "only declares assertions" diye atlıyordu; artık koşuyor (gerçek çakışma koşumunda bulundu, 2026-09-11) | **tamam**, 0.4.3'te yayımlandı (`a705483`, PR #9) |
| 0.4.3-b Web koşum sayfası kapsamı söylemiyor | `layers` (hızlı mod), `skipped` ve `partial` hosted sayfada hiç gösterilmiyor: 3 denemelik bir erken uyarı tam ölçüm gibi görünür, atlanan vaka sessizce yok olur. CLI üçünü de manşette söylüyor (decisions.md 2026-09-08, 2026-09-09) | **tamam** — koşum sayfasında verdict'in altında, sayılardan önce üç uyarı; dizin ve suite sayfasında not; `unknown` hükmü kapsam sebebini söylüyor |
| Ölçüm-1 v3 ile tam çakışma koşumu | Sitedeki matris 60 denemelik hızlı koşumdan (`912ad216`, v3, N=3, yalnız tetiklenme); ölçüm raporu ise 200 denemelik tam koşumdan (`0bec859e`, v2). Aynı resim, farklı çözünürlük. v3 suite'le tam koşum (N=10, ~200 deneme, ~$10, `--concurrency 4`), yayımlanmış son sürümle; `assay push` ile yüklenir ve sitede hızlı koşumun yerini alır. Hızlı koşumu production'dan silmek kullanıcının kararı (geri alınamaz). Ölçüm deposundaki raporun başındaki not (`633f4b3`) yeni koşum kimliğiyle güncellenir | **ertelendi (kullanıcı kararı, 2026-09-13)** — ifade bağlama deneyinin B kolu bugünkü kurulumun aynısı; deney tam modda koşulursa v3 tam matrisi oradan gelir, iki kez ödenmez |

Aşağıdaki kusur tablosu bu sürüme girecek düzeltmelerin havuzu; hangilerinin
0.4.1'e alınacağı ayrıca kararlaştırılacak.

### `assay push`'un ilk gerçek kullanımında bulunanlar (2026-09-10)

Ölçüm deposundan sekiz kayıt yayımlanmış 0.4.0 ile https://assayctl.dev'e
gönderildi; beşi yüklendi. Kararlar: decisions.md, 2026-09-10.

| # | Kusur | Katman | Etki |
|---|---|---|---|
| 0.4.1-a | 0.2.0 öncesi kayıtta `trigger.refusals` yok; `toAttemptRow` (`packages/db/src/mapping.ts:329`) `[...trigger.refusals]` ile TypeError atıyor | hosted | Ölçüm deposundaki 10 kaydın hiçbiri yüklenemiyor — animate, better-typography ve ui-ux-pro-max ölçümlerinin tamamı ve impeccable pilotu |
| 0.4.1-b | `redact` üç biçimi kaçırıyor: ters bölüsü yenmiş `C:Users<ad>`, Claude Code proje adı `C--Users-<ad>`, çift kaçışlı yol | core | Seçilen 8 kayıtta `scrub` sonrası 68 kullanıcı adı kaldı; koşum anında maskeleme de aynı desenleri kullandığı için 0.3.2 kayıtlarında da var |
| 0.4.1-c | `push` göndermeden önce maskelemiyor ve uyarmıyor | cli | Kullanıcı `scrub`u bilmiyorsa kayıt ham gider |
| 0.4.1-d | Sunucu tanımadığı her hatayı "the run could not be stored" diye dönüyor | hosted | 0.4.1-a'nın sebebi ancak kod yerel veritabanında koşturularak bulundu |
| 0.4.1-e | `push` sunucu hatasında çıkış kodu 2 (kullanım hatası) veriyor | cli | CI "komutu yanlış yazdın" sanar |
| 0.4.1-f | `push` yüklenen koşumun suite'i yayımlanana kadar gizli olduğunu söylemiyor; bastığı URL herkese 404 | cli/hosted | İlk kullanımda "yüklendi ama sitede yok" |
| 0.4.1-g | Token sayfasının boş durumu `--url http://localhost:3000` öneriyor | web | Üretimde yanlış komut |
| 0.4.1-h | `--version` yok | cli | Hangi sürümle çalışıldığını görmenin yolu `npx` çıktısı |
| 0.4.1-i | Yayın modunda `/compare` 404, ama koşum ve suite sayfaları "vs previous" ile oraya bağlanıyor | web | Sitede karşılaştırma yapılamıyor; dört pini aynı çift yalnızca CLI'da karşılaştırılabildi (12/12 `within_noise`) |
| 0.4.1-j | Dar ve sağ uca yakın bir aralıkta (`91%–100%`) uç etiketleri kutuya sığmıyor; `justify-content: space-between` taşmayı sağa veriyor (kod yorumu "iki yana eşit taşar" diyor) | ui | 375px'te hallmark koşum ve suite sayfası iki temada yatay kayıyor (etiket 380px'e uzanıyor) |
| 0.4.1-k | Skill adı başlıkta kelimenin ortasından kırılıyor (`hallmark:hallmar` / `k`) | web | Mobilde okunmuyor; kırılma `:`'da olmalı |
| 0.4.1-l | Payda 0 olan oranın gerekçesi her zaman "No attempt produced a readable signal" | ui | Hedef skill hiç tetiklenmediğinde precision'ın paydası tanım gereği 0; sinyal okundu. 0.3.0-a'daki "yanlış adres" kusurunun ekrandaki hâli |
| 0.4.1-m | Oturumsuz ziyaretçi için yayımlanmış ölçümlerin dizini yok: kök `Landing` gösteriyor ve yalnızca tek suite'i öne çıkarıyor (herkese açık suite'ler içinde en son koşumu olan ilk `fail`, `landing.tsx:28-29`); "Measured skills" listesi yalnızca oturum açmış kullanıcıya | web | Üç suite yayımlandı, ziyaretçi yalnızca birine (hallmark) ulaşabiliyor; diğerleri yalnızca doğrudan URL ile açılıyor. Yayımlama ve görünürlük doğru çalışıyor; eksik olan keşif |
| 0.4.1-n | Yönetici onay penceresinin zemini saydam; arkadaki satırlar metnin içinden okunuyor | ui | `/admin/suites` "Make private" onayında görüldü; yazı okunuyor ama karışık |
| 0.4.1-o | `/suites` yalnızca tanıtım sayfasından bağlantılı; üst çubukta yok. 404 sayfası "linked from the front page" diyor | web | Bir koşum sayfasına doğrudan gelen ziyaretçi (issue'lardan gelen herkes) diğer ölçümlere ulaşamıyor. Çözüm: üst çubukta "Method"un yanına **Measurements** → `/suites`; 404 sayfası da oraya bağlanır. 375 px'te üst çubuk sığıyor mu ekran görüntüsüyle ölçülecek |

Sitede kontrol edilen (2026-09-10, ziyaretçi gözüyle, açık/koyu × 1280/375): beş
koşum sayfası ve iki suite sayfası 200; pinlerin yedisi ve Assay sürüm satırı
tam (0.3.2 öncesi kayıtlarda "0.3.1 or earlier" etiketi); konsol hatası yok;
yatay taşma yalnızca 0.4.1-j. Çakışma matrisi render olmuyor (bu sürümün asıl
maddesi) ve matris taşıyan bir kayıt da yok: çakışma ölçümü 0.3.2 ile, kazanan
beyan etmeyen suite'le koşuldu.

**0.4.1-a notu — `[]` ile doldurmak düzeltme değil.** 0.2.0 öncesi adaptör
aktivasyonu doğrulamıyordu (0.2.0-d: bir pilotta 4 "tetiklenme"nin 4'ü reddedilmiş
aktivasyondu). Eksik alanı boş liste saymak, yapılmamış bir kontrolü "red yok"
diye kaydetmek olur. Kayıt "aktivasyon doğrulanmadı (0.2.0 öncesi)" diye
saklanmalı ve gösterilmeli — `assayVersionLabel`in yaptığının aynısı.

---

## Sonraki dalga

Faz 3'ten sonra değerlendirilecek. **Şimdi yapılmayacak.**

**Skill collision testing.** Aynı hostta birden çok skill aktifken hangisinin
yanlış tetiklendiğini sistematik ölçen çarpışma matrisi. Şema desteği 0.3'te
hazırlanır (`active_skills` alanı), motor Faz 2 sonrasına kalır. Ekosistemin
gerçek sorunu tek skill'de değil, çakışmada.

**Model update certification.** Kullanıcının skill setini eski ve yeni model
altında koşturup "47 güvenli, 2 regresyon, 1 bilinmiyor" raporu üretmek.
Kurumsal satın alma gerekçesi büyük ihtimalle burada.

**Çapraz-host uyumluluk matrisi.** Bir skill'in Claude Code, Codex ve Copilot
altında nasıl davrandığı. Agent Skills açık bir standart olduğu için bu,
vendor-bağımsız bir güvenilirlik katmanı olma yolu.

Faz 1'e çekilmesi 0.6'da değerlendirildi ve **reddedildi**: Codex tetiklenmeyi
yapısal bir olay olarak yayınlamıyor (tek kanıt asistan mesajının serbest
metni) ve skill seti izole edilemiyor. Ölçülemeyen bir şeye adaptör yazmak
olurdu. Yapısal bir skill olayı çıktığı gün yeniden değerlendirilecek —
`codex exec --json` akışının geri kalanı zaten yeterli.
Ayrıntı: [host-feasibility.md](host-feasibility.md).

---

## Denetim noktaları

Otonom modda sessizce aşınan şeyler. Her rapordan sonra kontrol edilir:

- `docs/decisions.md` gerçekten dolduruluyor mu
- Verdict hâlâ üç durumlu mu; `unknown` "hata" kovasına taşınmış mı
- Oranlar bir yerde çıplak yüzdeye dönmüş mü
- Tekrar varsayılanı 1'e çekilmiş mi
- Sinyal okunamadığında makul bir varsayılan üretilmiş mi
- LLM judge "sadece şurada" diye eklenmiş mi
- Arayüzde uydurma veri belirmiş mi
- Yerel store ile hosted şema ayrışmaya başlamış mı

Bunların her biri tek başına makul bir gerekçeyle gelir. Hepsi kabul
edildiğinde ürünün tek farkı kalmaz.
