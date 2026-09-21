# Engeller

Üç denemede çözülemeyen ve izole edilerek geçilen sorunlar. Her kayıt: ne
denendi, neden çözülmedi, ne izole edildi, açmak için ne gerekiyor.

Boşsa engel yok demektir.

---

*(henüz kayıt yok)*

## 2026-08-31 — Google ile giriş yapılandırılmadı
Ne gerekiyor: `AUTH_GOOGLE_ID` ve `AUTH_GOOGLE_SECRET` (Google Cloud Console →
OAuth 2.0 istemci kimliği, yönlendirme adresi
`<site>/api/auth/callback/google`).
Ne yapıldı: Sağlayıcı kodda duruyor ama yalnızca iki değişken de doluyken
etkinleşiyor. Boşken giriş ekranı "Google sign-in is not configured on this
instance." yazıyor — düğme gösterilip çalışmaması yerine.
Neden izole edildi: Sır uydurulmaz (sözleşme 1). Parola ile giriş yolu tam
çalışıyor ve doğrulandı.
Açmak için: iki değişkeni `.env`e yaz, sunucuyu yeniden başlat. Kod değişikliği
gerekmiyor.

## 2026-08-31 — E-posta gönderimi (SMTP) yok
Ne gerekiyor: SMTP kimlik bilgileri.
Ne yapıldı: E-posta doğrulama ve parola sıfırlama akışı yazılmadı.
`User.emailVerified` alanı şemada duruyor ve boş kalıyor.
Neden izole edildi: Gönderilemeyen bir doğrulama e-postası, kullanıcıyı hesabına
sokmayan bir akış demek.
Açmak için: SMTP bilgileri geldiğinde Auth.js'in `Nodemailer` sağlayıcısı ve bir
parola sıfırlama akışı eklenir.

## 2026-09-01 — Konteyner imajı bu makinede derlenmedi — ÇÖZÜLDÜ (aynı gün)
Çözüm: İmaj ilk dağıtım denemesinde sunucuda başarıyla derlendi. (Konteyner
ayrıca açılışta Prisma CLI'yi bulamayıp döngüye girdi; pnpm sembolik bağları
runner aşamasına taşınmıyordu, CLI artık npm ile kuruluyor.) Prisma
istemcisi üretildi, altı paket derlendi, Next standalone çıktısı ve middleware
oluştu. Aynı koşumda görülen Prisma OpenSSL uyarısı `Dockerfile`'a `openssl`
eklenerek kapatıldı. Dağıtım ayrı bir sebeple düştü (host portu 3000 doluydu);
`docker-compose.yml` artık portu host'a yayınlamıyor.
Ne gerekiyor: çalışan bir Docker daemon'ı.
Ne yapıldı: `Dockerfile`, `docker-compose.yml`, `docker-entrypoint.sh` ve
`docs/deploy.md` yazıldı; `/api/health` uygulandı ve yerelde 200 dönüyor.
Neden izole edildi: Docker Desktop kapalı (`open //./pipe/dockerDesktopLinuxEngine`)
ve Next'in standalone çıktısı Windows'ta sembolik bağ yetkisi istiyor (EPERM).
Bu yüzden `output: 'standalone'` yalnızca `NEXT_STANDALONE=1` iken açık;
bayraksız `pnpm build` geliştirme makinesinde çalışmaya devam ediyor.
Açmak için: CI ubuntu üzerinde `NEXT_STANDALONE=1` ile derliyor ve
`apps/web/.next/standalone/apps/web/server.js` dosyasının varlığını denetliyor.
İmajın kendisi ilk dağıtımda doğrulanacak.

## 2026-09-01 — CI koşumunun sonucu uzaktan doğrulanamadı
Ne gerekiyor: `gh auth login` veya `GH_TOKEN`.
Ne yapıldı: CI adımlarının tamamı yerelde aynı sırayla koşturuldu ve geçti
(temiz `generated` dizininden `prisma generate` + typecheck, lint, kapsam
eşikleriyle test, derleme).
Neden izole edildi: `gh` kimlik doğrulaması yok; sır uydurulmaz.
Açmak için: `gh auth login` sonrası `gh run list`.

## 2026-09-01 — npm yayını için NPM_TOKEN yok — GEÇERSİZ (trusted publishing)
Çözüm: Token üretildi ve `NPM_TOKEN` adıyla GitHub repo secret'ı olarak
eklendi. Tür **Granular Access Token** — klasik ("Automation") tokenlar Kasım
2025'te iptal edildiği için tek seçenek bu, ve yazma izinliler en fazla 90 gün
yaşıyor. Bu yüzden düzenli yenileme gerektiriyor: prosedür
[operations.md](operations.md). Aşağısı, engel açıkken yazılmış kayıttır.

Ne gerekiyordu: `@ktlsr/assay*` paketlerine yazma izni olan bir npm access
token.
Ne yapıldı: Yayın hazırlığının tamamı token olmadan bitirildi ve doğrulandı —
paket adları `@ktlsr/*` olarak değiştirildi, sürümler 0.1.0'a çekildi,
changesets kuruldu, `tsconfig.build.json` ile testler ve map'ler tarball'dan
çıkarıldı, LICENSE/NOTICE/README/CHANGELOG her pakete kondu,
`.github/workflows/release.yml` yazıldı. Dört tarball üretildi, içerikleri
`pnpm pack:check` ile denetlendi, geçici bir dizine kurulup `assay` komutu
çalıştırıldı.
Neden izole edildi: Sır uydurulmaz (sözleşme 1). Ayrıca npm yayını geri
alınamaz; tetiği kullanıcı çekmeli.
Açmak için: GitHub > repo > *Settings* > *Secrets and variables* > *Actions* >
*New repository secret*, ad `NPM_TOKEN`. Yerelde `npm login` yeterli; token'la
çalışılacaksa `npm config set //registry.npmjs.org/:_authToken $NPM_TOKEN` —
`.npmrc` elle yazılmaz, `.gitignore` kapsamında ve pre-commit taraması
reddediyor. Secret tanımlanana kadar `release.yml` içindeki `guard` işi
`release` işini hiç koşturmuyor ve loga `::warning::` yazıyor.
Süreç: [releasing.md](releasing.md).

## 2026-09-01 — 0.1.0 yayını 2FA (EOTP) nedeniyle durdu — ÇÖZÜLDÜ (aynı gün)
Çözüm: Trusted publishing (OIDC) kuruldu; token yolu tamamen terk edildi.
0.1.0 dört paket olarak yayımlandı ve provenance ile doğrulandı.
Ne gerekiyor: Ya bypass-2FA yetkili yeni bir `NPM_TOKEN`, ya da elle yayın
için bir authenticator kodu. İkisi de kullanıcının npm hesabında.
Ne yapıldı: Yayın `workflow_dispatch` ile tetiklendi (koşum `33500616977`).
Token doğrulaması, `pnpm check`, `pack:check` ve provenance imzalama geçti;
publish çağrısı `npm error code EOTP` ile reddedildi. Dört paketin hiçbiri
yayımlanmadı — kısmi yayın yok, registry `npm view` ile doğrulandı.
Neden izole edildi: Sır uydurulmaz ve 2FA kodu ancak kullanıcıda. Yayın
dışındaki her şey hazır ve doğrulanmış durumda.
Açmak için: Seçenekler ve bedelleri [operations.md](operations.md) içinde
"`EOTP` — token 2FA'yı atlayamıyor" başlığı altında. Kalıcı çözüm trusted
publishing ama o paketin var olmasını gerektiriyor, yani ilk sürüm bu iki
yoldan biriyle çıkmalı.

## 2026-09-03 — 0.1.1 yayımlanamıyor: npm'de trusted publisher tanımlı değil — ÇÖZÜLDÜ (aynı gün)

**Çözüm:** Dört paket için npm tarafında trusted publisher kaydı yapıldı
(GitHub Actions · `ktlesr/assay` · `release.yml` · yalnızca publish izni).
Koşum `33711487808` yeşil: log "No NPM_TOKEN found, but OIDC is available -
using npm trusted publishing" diyor, dört paket de 0.1.1 olarak registry'de
ve `_npmVersion` 12.0.2 — yani gerçekten OIDC yeteneği olan npm yayımladı.
Provenance dördünde de üretildi (`slsa.dev/provenance/v1`). Aşağısı, engel
açıkken yazılmış kayıttır.

**Ne gerekiyor:** npmjs.com üzerinde dört paket için trusted publisher kaydı.
Her paket → Settings → Trusted Publisher → GitHub Actions; organization
`ktlesr`, repository `assay`, workflow `release.yml`. Dördü ayrı ayrı:
`@ktlsr/assay`, `@ktlsr/assay-core`, `@ktlsr/assay-runner`,
`@ktlsr/assay-adapters`.

**Ne yapıldı (dört yayın denemesi, hiçbiri paketi göndermedi):**

1. İlk iki deneme `E404 PUT /@ktlsr%2fassay-core`. Kök sebep: `c1adebd`
   `NODE_AUTH_TOKEN`'ı kaldırmıştı ve Node 22 ile gelen npm 10.9.8 trusted
   publishing yapamıyor (>= 11.5.1 gerekiyor). Yani hatta hiçbir kimlik
   bilgisi yoktu. Yayımlanan 0.1.0'ın `_npmVersion` alanı 10.9.8 olduğu için
   0.1.0'ın da aslında token ile yayımlandığı kanıtlandı
   (bkz. docs/decisions.md düzeltmesi).
2. `npm install -g npm@latest` + sürüm kapısı eklendi (npm 12.0.2). Hata
   sürdü ama mesaj netleşti: "could not be found **or you do not have
   permission to access it**".
3. `setup-node`'dan `registry-url` kaldırıldı: o satır
   `//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}` içeren bir `.npmrc`
   yazıyordu ve token'sız hatta BOŞ bir kimlik bilgisine çözülüyordu; npm
   "kimlik zaten var" sanıp OIDC değişimini hiç denemiyordu.
4. Son deneme: `ENEEDAUTH — need auth This command requires you to be logged
   in`. npm artık kimlik bilgisi olmadığını dürüstçe söylüyor ve OIDC
   değişimini deneyip registry'den olumlu yanıt alamıyor.

Hata dizisi E404 → ENEEDAUTH, hattaki iki gerçek kusurun kapandığını ve geriye
yalnızca registry tarafındaki kaydın kaldığını gösteriyor.

**Neden izole edildi:** Trusted publisher kaydı npm hesabı erişimi istiyor;
sır ve hesap ayarı uydurulmaz (sözleşme 1). Yayın geri alınamaz bir işlem
olduğu için tahminle daha fazla deneme yapılmadı.

**Hasar yok:** Registry'de dört paket de `["0.1.0"]`. `core` bağımlılık
sırasında ilk sırada olduğu için diğer üçü hiç denenmedi; kısmi yayın
oluşmadı.

**Açmak için:** Kayıtlar tanımlandıktan sonra
`gh workflow run Release -f confirm=yayimla`. Kod değişikliği gerekmiyor.

**Alternatif (tercih edilmiyor):** `NPM_TOKEN` secret'ı tanımlanıp iş akışına
`NODE_AUTH_TOKEN` geri konabilir — ama o zaman `setup-node`'a `registry-url`
da geri eklenmeli, çünkü `.npmrc`'yi o yazıyor. Bu, token'sız hat kararını
geri alır ve 90 günlük yenileme döngüsünü geri getirir.

## 2026-09-03 — `acceptEdits` kabuğu onaya gönderiyor; sandbox kısıtı skill hatasından ayrılamıyor

**Ne gerekiyor:** Kod değişikliği. Sır ya da erişim gerekmiyor — bu bir kapsam
kararı ve 0.2.0'a alındı ([roadmap.md](roadmap.md)).

**Sorun.** Claude Code adaptörü `--permission-mode acceptEdits` ile koşuyor
(2026-08-31 kararı). Bu mod `Write` ve `Edit`'e izin veriyor ama kabuk
çalıştırmayı **onay bekleyen** duruma gönderiyor. Koşum etkileşimsiz olduğu
için onaylayacak kimse yok; çağrı reddediliyor.

Reddin izdeki görünümü sıradan bir araç hatası:

```
Bash        "This command requires approval"
Bash        "This Bash command contains multiple operations. The following parts
             require approval: cd ... && python test_estimator.py"
PowerShell  "Compound command changes working directory ... requires manual approval"
PowerShell  "tee-object may receive a path from an upstream pipeline command ..."
```

Assay bu metni **sınıflandırmıyor**. Sonuç, ölçümde iki ayrı şeyin aynı
görünmesi:

1. **Tamamlama katmanı sandbox'ı ölçüyor.** Bir şey *çalıştırması* gereken
   skill (test koşucusu, derleme adımı, betik) işi bitiremiyor; düşen assertion
   skill hakkında değil, bizim kısıtımız hakkında.
2. **`no_swallowed_errors` iki farklı iddiayı karıştırıyor.** Kural "ajan
   hatayı bildirdi mi" diye soruyor ve doğru cevaplıyor — ama hatanın kaynağı
   Assay olduğunda kullanıcı "skill hatayı yutuyor" ile "Assay komutu
   reddetti, skill bunu söylemedi" arasını ayıramıyor.

**Ölçüldü.** `webapp-testing` tamamlama koşumu,
`complete.regression_suite_green`, 10 deneme:

| Gözlem | Sayı |
|---|---|
| En az bir kabuk çağrısı onay beklerken reddedilen deneme | 10/10 |
| `no_swallowed_errors` **fail** veren deneme | 4/10 |
| `out/run.txt` (koşum çıktısı) üreten deneme | 8/10 |

Son satır sorunun ikinci yüzü: dosya çoğu denemede var, oysa koşum hemen hiç
gerçekleşmedi. `file_exists` + `file_content_matches` dosyanın var olduğunu
söyleyebiliyor, içeriğinin hak edildiğini söyleyemiyor
([measurements.md](measurements.md)).

**Değerlendirilen seçenekler.**

| # | Seçenek | Bedeli | Karar |
|---|---|---|---|
| A | Olduğu gibi bırakmak | İki hata biçimi kalıcı olarak karışık kalır | Hayır |
| B | Varsayılanı `bypassPermissions` yapmak | Sandbox'ın gözlediği her sınır kalkar (H4, sandbox-security.md) | Hayır |
| C | Reddi birinci sınıf sinyal yapmak | Küçük; adaptör + assertion sevkiyatı | **0.2.0** |
| D | Vaka seti başına komut allowlist'i | Şema alanı + adaptör bayrağı; gerçek kapsam kazandırıyor | **0.2.0, C'den sonra** |
| E | Konteyner sandbox | Büyük; A1'in yükseltme yolu | Faz 3'te kalıyor |

**C — reddi sınıflandır.** Adaptör, `tool_result` hatasının host'un izin
katmanından mı yoksa komutun kendisinden mi geldiğini işaretler
(`TraceEvent.refusal: 'permission'`). Buna bağlı iki davranış:

- Reddedilen bir çağrının engellediği artefakt assertion'ı `fail` değil
  **`unknown`** üretir. Değişmez #1'in doğrudan gereği: engellediğimiz bir
  şeyin olmamasını skill'in kusuru diye raporlamak, ölçemediğini raporlamanın
  aynası.
- `no_swallowed_errors` iki ayrı sebep döndürür: "ajan gerçek bir hatayı
  bildirmedi" ve "ajan **Assay'in** reddini bildirmedi". İkincisi hâlâ değerli
  bir sinyal — bildirmemek yine bildirmemektir — ama farklı bir cümle.

**D — komut allowlist'i.** Vaka seti `sandbox: { allow_commands: [...] }`
beyan eder; runner bunu host'un `--allowedTools "Bash(python:*)"` biçimine
çevirir. İzin genişlemesi vaka setinde yazılı ve `suiteHash`'e giriyor, yani
pinlenmiş ve görünür bir karar oluyor — bugünkü sessiz genel reddin tersi.

**Neden şimdi kapatılmadı:** ikisi de davranış değişikliği ve 0.1.1 yayınının
kapsamı dışında. Sınırın kendisi bugün ölçüldü ve yazıldı; kapatılması
0.2.0'ın işi. Bu arada rapor bunu bir sandbox sınırı olarak açıkça söylüyor
(docs/measurements.md, "Ölçülemeyenler ve tavanlar").

## 2026-09-03 — Oturum koşmadığında assertion katmanı `fail` üretiyor — ÇÖZÜLDÜ (0.1.3)

**Çözüm:** `runAttempt` artık oturum çapraz kontrolden geçmediğinde
(`SessionResult.outcome === 'error'`) hiç kanıt toplamıyor; sevk katmanının
mevcut `REQUIRES` koruması her katmanda `unknown` üretiyor. Seçenek C
uygulandı. Ayrım korundu: gerçekten koşup hiçbir şey yazmayan ajan
`file_exists`te `fail` vermeye devam ediyor, ve iki yön de testli.
Düzeltmenin gerçekten yakaladığı, koşul geçici olarak `false` yapılıp testin
kırmızıya döndüğü görülerek doğrulandı. Aşağısı, engel açıkken yazılmış
kayıttır.


**Ne gerekiyor:** Kod değişikliği. Sır ya da erişim gerekmiyor; 0.1.3'e alındı
([roadmap.md](roadmap.md)).

**Sorun.** Aynı olay iki katmanda iki farklı verdict üretiyor. Token iptal
edildiğinde (veya host başka bir sebeple oturumu hiç açamadığında):

| Katman | Sonuç | Doğru mu |
|---|---|---|
| Tetiklenme | `unknown` | ✅ |
| `file_exists` / `file_valid` / `json_schema` | **`fail`** | ❌ ölçülmedi, başarısız değil |
| `side_effect` | **`pass`** | ❌ daha kötüsü: sessiz pass |

Üçü de aynı koşumdan geliyor. Ölçüm yapılmadı; iki katman bunu ölçülmüş gibi
raporluyor ve biri "geçti" diyor.

**Kök sebep.** Tetiklenme katmanı oturumun durumuna bakıyor, assertion katmanı
bakmıyor.

`ClaudeCodeAdapter.readTriggerSignal` `sessionProblem(session)` çağırıyor ve
sorun varsa `{ available: false, reason }` dönüyor — doğru davranış.

`finalize` ise aynı sorunu görüp `outcome: 'error'` yazıyor ama `files`
alanını hiç doldurmuyor. `runAttempt` bunu şöyle karşılıyor
(`packages/runner/src/run.ts`):

```ts
const captured = result.files === undefined ? await capture(workspace.dir) : null
evidence = {
  files: result.files ?? captured?.files ?? [],
  env: result.env ?? envDiff({ /* dokunulmamış çalışma dizini */ }),
  ...
}
```

Oturum hiç koşmadığı için çalışma dizini boş; `capture` boş bir dizi dönüyor.
Yani `evidence.files` **var ama boş**.

Sevk katmanının koruması (`packages/core/src/assertions.ts`) yalnızca alanın
**varlığını** denetliyor:

```ts
for (const key of REQUIRES[assertion.type]) {
  if (evidence[key] === undefined) return unknown(...)
}
```

`[]` `undefined` değil. Bu yüzden `file_exists` değerlendiriliyor ve "no file
matches out/…" diyerek `fail` üretiyor. Aynı şekilde `env` de dolu ve boş:
`writes: []`, `network: []` → `side_effect` hiçbir ihlal görmüyor ve `pass`
diyor.

Kanıt bu oturumda görüldü: kimlik bilgisiz bir koşumda üç tamamlama vakası
`fail`, negatif vaka `unknown` döndü — hepsi "Not logged in" hatasından.

**Neden bu bir değişmez ihlali.** Değişmez #1 sessiz `pass`ı yasaklıyor ve
gerekçesi "ölçemediğini raporlama". `fail` de aynı hatanın öbür yüzü:
kullanıcı kırık bir skill arar, oysa sorun kimlik bilgisidir. `side_effect`in
`pass`ı ise doğrudan yasaklanan şey.

**Değerlendirilen seçenekler.**

| # | Seçenek | Karar |
|---|---|---|
| A | Değerlendiricilerin her birine oturum kontrolü koymak | Hayır — yeni bir assertion tipi eklendiğinde unutulacak tek satır; sevk katmanı tam da bunu önlemek için var |
| B | `Evidence`'a `sessionFailed` bayrağı ekleyip her değerlendiricide bakmak | Hayır — A'nın kılık değiştirmiş hâli |
| C | Oturum çapraz kontrolden geçmediyse kanıt alanlarını **hiç doldurmamak** | **0.1.3** |

**C — mevcut mekanizmayı olması gerektiği gibi kullanmak.** `runAttempt`,
`SessionResult.outcome === 'error'` gördüğünde `files`, `env` ve `exitCode`
alanlarını `undefined` bırakır. Sevk katmanının `REQUIRES` koruması zaten
"alan yoksa `unknown`" diyor; tek eksik, boş bir çalışma dizininin "kanıt
toplandı" sayılmasıydı. Yeni kod yolu yok, yeni bayrak yok — var olan koruma
gerçek durumu görüyor.

Dikkat edilecek tek yer: gerçekten koşup hiçbir şey yazmayan bir ajan ile hiç
koşmayan bir oturum ayrılmalı. Ayrım `outcome`'da: birincisi `completed` ve
boş bir workspace `fail` vermeye devam etmeli — orada gerçekten ölçüm var.

**Neden şimdi kapatılmadı:** davranış değişikliği ve 0.1.2 yayımlandı. Bir
sonraki yamada, testiyle birlikte: aynı olayın her katmanda `unknown`
ürettiğini gösteren bir koşum testi.

## 2026-09-08 — Ölçülen ajan runner'ı öldürüyor; koşum kayıt bırakmadan ölüyor

**Ne gerekiyor:** Kod değişikliği. Sır ya da erişim gerekmiyor — bu bir kapsam
kararı ve 0.3.0-b/c'ye alındı ([roadmap.md](roadmap.md)).

**Sorun.** `--permission-mode bypassPermissions` altında ölçülen ajan işini
doğrulamak için dev sunucu başlatıyor ve sonra süreçleri **porta göre**
öldürüyor. Assay runner'ı aynı kullanıcı altında sıradan bir `node` süreci ve
aynı alanda duruyor: ajan onu da öldürebiliyor. Koşum `exit -1` ile ölüyor ve
**hiçbir kayıt bırakmıyor**, çünkü kayıt ancak bütün vakalar bittikten sonra
tek seferde yazılıyor.

**Ölçüldü.** `impeccable` 4.2.2, `bypassPermissions` fazı, 5 chunk × 24 deneme
(`reports/impeccable.4.2.2.bypassPermissions.ledger.tsv`):

| Chunk | Sonuç |
|---|---|
| 1–4 | exit 0, 24 deneme, kayıt yazıldı |
| 5 (1. deneme) | `exit -1`, `record NONE` — beş deneme `✓` basmıştı, hiçbiri diske yazılmadı |
| 5 (2. deneme) | `exit -1`, `record NONE` — aynı yerde, aynı biçimde |
| 5a / 5b (12'şer) | exit 0 — pencere küçültülerek kurtarıldı |

Bedel: ~40 dakika ve ~$4. Aynı şey 4.2.1 ölçümünde de olmuştu, yani bu tek
seferlik bir kaza değil.

**İkinci kök sebep, tamamen bizde.** Adaptör zaman aşımında yalnızca doğrudan
çocuğu öldürüyor (`child.kill('SIGKILL')`,
`packages/adapters/src/claude-code/adapter.ts`). `claude.exe`'nin başlattığı
dev sunucular hayatta kalıyor. Yani **portu meşgul eden yetimleri Assay
üretiyor**; bir sonraki denemenin ajanı portu dolu buluyor ve porta göre
öldürmeye girişiyor. Kullanıcının sürücüsü 3., 4. ve 5. chunk'tan önce 2, 1 ve
4 yetim temizledi — döngünün her halkası ölçülmüş durumda.

**Ne yapıldı (izolasyon).** Koşum baştan chunk'landı, chunk'lar arasında
5170–5210 aralığındaki dinleyen `node`/`vite`/`esbuild` süreçleri temizlendi ve
sürücü resumable yazıldı (`tools/run-chunks.ps1`). **Yetmedi:** öldürme
chunk'ın *içinde* oluyor ve orada araya girecek bir şey yok. Pencere `--repeat 1`
ile 12 denemeye indirilerek 5. chunk kurtarıldı.

**Neden üç denemede kapanmadı.** Sorun bir hata değil, bir tasarım sınırı:
runner ölçtüğü ajanla aynı süreç alanında duruyor. Dışarıdan sarmalayarak
(chunk, yetim temizliği, pencere küçültme) yalnızca hasar sınırlanabiliyor.

**Açmak için:** 0.3.0-b (deneme başına journal — kayıp en fazla bir deneme) ve
0.3.0-c (süreç ağacı öldürme + supervisor/worker ayrımı — öldürülen deneme
koşumu düşürmüyor, `unknown` yazılıyor). Gerçek izolasyon konteynerle gelir ve
Faz 3'te ([sandbox-security.md](sandbox-security.md), A1); 0.3.0 tavanı açıkça
yazacak: supervisor da aynı makinede bir `node` süreci, "korunuyor" denmeyecek.

### 2026-09-08 — Kaybın yarısı kapandı (0.3.0-b)

Yukarıdaki engelin **ikinci yarısı** — "koşum kayıt bırakmadan ölüyor" —
kapandı. Runner'ın öldürülebilir olması **kapanmadı**; o 0.3.0-c'nin işi.

Ne değişti: koşum her deneme bittiğinde `.assay/runs/<id>.partial.jsonl`
dosyasına tek satır ekliyor. Normal bitişte satırlar tek bir kayda katlanıyor
ve journal siliniyor. Süreç ölürse dosya diskte kalıyor ve `assay recover`
onu kayda çeviriyor; kayıt `partial` alanıyla yarım olduğunu söylüyor.

Doğrulandı — taklit değil, gerçek öldürme:

| Ölçüm | Sonuç |
|---|---|
| Çocuk süreç, 3 deneme sonra `SIGKILL` | journal 3 denemeyi taşıyor |
| `assay recover` | 3 deneme, 1 vaka, kayıt yazıldı, exit 0 |
| `assay report` | manşette "incomplete run", oran `100% (N=3, 95% CI 44%–100%)` |
| Aynı test, journal yazımı kaldırılınca | **0 deneme kurtarılabiliyor** — 4.2.2'deki kaybın aynısı |

Kalan risk: journal'ı yazan süreç ölüyor ama runner hâlâ ölçtüğü ajanla aynı
süreç alanında. Kayıp artık en fazla bir deneme; ölümün kendisi duruyor.

### 2026-09-08 — Diğer yarı daraltıldı (0.3.0-c): deneme öldürülebilir, koşum öldürülemez

Engelin kalan yarısı — "runner ölçülen ajanın erişiminde" — **kapanmadı,
daraltıldı.** Kapanması konteyner ister ve o Faz 3'te
([sandbox-security.md](sandbox-security.md), A1 ve A3).

Ne değişti:

1. Her deneme kısa ömürlü bir worker sürecinde koşuyor. Öldürülen şey koşum
   değil bir deneme; sevk katmanı onu `unknown` yazıp devam ediyor.
2. Worker sonucu yazdıktan sonra canlı bekliyor; ağacı sevk katmanı kapatıyor.
   Ajanın başlattığı dev sunucular böylece yetim kalmıyor — **yetimleri
   üreten bizdik.**
3. Ağaç Windows'ta PPID üzerinden yürünüyor: `taskkill /T` `detached` bir
   torunu öldürmüyor ve bu ölçüldü.

Ölçüldü (`tools/fixtures/measure-isolation.mjs`, iki kol da gerçek süreçler,
dış aktör PID'i bulup öldürüyor):

| Kol | Koşum | Kayda giren deneme | `unknown` | Öldürme | Yetim |
|---|---|---|---|---|---|
| süreç içi | **düştü** (exit -1) | 0 | — | 1 | yok |
| izole | sağ | 4 | 2 | 2 | yok |

Kalan tavan, testle birlikte kayıtlı: sevk katmanı da aynı makinede bir `node`
süreci. O öldürülürse koşum durur ve elde journal kalır (0.3.0-b);
`assay recover` onu kayda çevirir. Hiçbir yerde "korunuyor" yazmıyor.
