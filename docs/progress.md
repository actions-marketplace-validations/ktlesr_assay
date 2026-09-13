# İlerleme

Oturum sıfırlanırsa buradan devam edilir. Baştan başlanmaz.

Kararların tam listesi [decisions.md](decisions.md), engeller
[blockers.md](blockers.md).

## Durum

**Faz 0–3 tamam** · **kalibrasyon tamam** ·
**npm'de 0.4.5** · **eylem v1.3.5** (`v1` → `d3146fb`, pin 0.4.5)

**0.4.5 yayımlandı (2026-09-13): host talimat dosyası sızıntısı.** Yayın koşumu
`34765415465`, PR #11, registry'den doğrulandı; `v1` ve `action-v1.3.5` →
`d3146fb`. Sitedeki maruz kayıtların künyesinde not var (yeniden ölçülmedi,
kullanıcı kararı; gerekçe notta).
Önceki durum:
Kullanıcının `~/.claude/CLAUDE.md`'si Windows'ta her denemenin bağlamına
giriyordu (host çalışma dizininin üst dizinlerinde talimat arıyor, `%TEMP%` ev
altında). Düzeltme üç katman: çalışma dizini ev dışında (`C:\assay-work`),
üst dizinler `claudeMdExcludes` ile dışlanıyor, yüklenen dosyalar host'un
`InstructionsLoaded` kancasıyla ölçülüp `environment.memory` olarak kayda ve
ortam hash'ine giriyor. Changeset `host-memory-isolation.md`. **Sitede yayımlı
her koşum maruz kalmış** (ayrıntı roadmap 0.4.5, tablo
`tools/host-memory-exposure.mjs`); yayımlı kayıtlara ne yapılacağı kullanıcı
kararı. Ücretsiz uçtan uca sonda: `tools/probe-host-memory.mjs`.

**0.4.4 yayımlandı (2026-09-13):** core `compare` gerekçesi yalnızca durduran
sebebi söylüyor, `RunComparison.note`, CLI `also:` satırı. Yayın koşumu
`34754297580`, birleştirme `6e491ed` (PR #10); dört paket registry'de
(`latest=0.4.4`, npm 12.0.2/OIDC, provenance), `npx @ktlsr/assay@0.4.4
--version` temiz dizinde 0.4.4. Eylem: `v1` ve `action-v1.3.4` → `6e491ed`,
GitHub Release "Latest", `v1`'deki `action.yml` pini 0.4.4. Eylem dış depodan doğrulandı (`ktlesr/assay-example`, koşum `34754816362`: `@v1` → `6e491ed`, `assay-version: 0.4.4`, kayıtta `assayVersion: "0.4.4"`, 3 vaka / 6 deneme `pass`, `scrub` çalıştı).

Son güncelleme: 2026-09-11 akşam (oturum kapanışı). assayctl.dev'de public: animate, better-typography,
ui-ux-pro-max, impeccable (3 koşum), hallmark, frontend-design,
marketing-skills v3. Gizli:
marketing-skills v2 (0bec859e, bilinçli). marketing-skills v3 (ilk kazananlı
çakışma koşumu, 912ad216) **public**; matris production'da doğrulandı. Devam
için **"Sırada"**.

## Oturum kaydı — 2026-09-11 (akşam, üç arayüz turu)

Üçü de main'de ve production'da (Dokploy, push'tan kendiliğinden); üçü de
açık/koyu × 1280/375 ekran görüntüsüyle ve derleme kapılı ters çevirmeyle
doğrulandı, kararları decisions.md'de (2026-09-11).

| commit | ne |
|---|---|
| `a09430a` | Konum izi (breadcrumb) üst çubuktan çıktı, sayfanın başlık alanına geldi (`lib/trail.ts`, yalnızca bağlantılı iz çiziliyor). Attempt sayfasında 375px'te iki eski taşma (boşluksuz regex) kapandı |
| `db9701d` | Üst çubukta "Assay" sitenin kırmızısında (`--fail`) ve kalın — kullanıcı kararı, "kroma yalnızca ölçümde" kuralının bilinçli tek istisnası; Instrument Serif'in kalını tarayıcı sentezi |
| `4e6269f` | `/compare`: gerekçe yalnızca durduran sebebi söylüyor, okunamayan pin ayrı nota ("Also not readable"; kayma yoksa okunamayan pin sebebin kendisi — değişmez #2). "vs previous" pinleri uyuşan en yakın önceki koşuma gidiyor (`lib/baseline.ts`, `comparePins`), atlarsa tarih yazıyor, yoksa soluk "conditions differ" ile neyin değiştiğini gösteren sayfaya. Geçmiş satırı düzeni (8rem sütun, 375px'te yüzde yerinde) |

Doğrulama: `4e6269f` sonrası `pnpm check` 42 dosya / 828 test yeşil; her suite
sayfasındaki her karşılaştırma bağlantısının etiketi gittiği sayfanın sonucuyla
tutarlı (yerelde 11/11, production'da 4/4 — frontend-design'ın iki bağlantısı da
"conditions differ", çünkü 09-01 kayıtları ortam hash'i taşımıyor). Aradaki
koşumu atlayan "vs <tarih>" durumunun gerçek verisi henüz yok; yalnızca birim
testiyle sınanıyor.

`4e6269f`'nin core/CLI kısmı 0.4.4 ile npm'e çıktı (2026-09-13).

## Oturum kaydı — 2026-09-10

**Çıkan sürümler (hepsi registry'den ve `ls-remote` ile doğrulandı):**

| npm | eylem | birleştirme | içerik |
|---|---|---|---|
| 0.3.0 | v1.2.0 | `b66f74c` (#3) | hayatta kalma, paralellik, `--fast`; bütçe kesmesi `pass` veremez |
| 0.3.1 | v1.2.1 | `ddf5014` (#4) | kurtarılan yarım kayıt `pass` veremez, ulaşılamayan vaka adıyla |
| 0.3.2 | v1.2.2 | `94677c4` (#5) | kayıt `assayVersion` taşıyor |
| 0.4.0 | v1.3.0 | `4109517` (#6) | çakışma şeması: `expect.winner`, matris (terminal/HTML) |
| 0.4.1 | v1.3.1 | `bb2f192` (#7) | maskeleme üç biçim + hesap adı, push taraması; 0.2.0 öncesi kayıt; `/compare`, `/suites` |
| 0.4.2 | v1.3.2 | `114f4b9` (#8) | push çıkış 4, gizli koşum uyarısı, `--version`; küçük kusurlar turu |

0.3.x–0.4.0 dışarıdan (`ktlesr/assay-example`) doğrulandı; 0.4.1 ve 0.4.2'de dış
koşum yapılmadı (istenmedi, para harcıyor).

**İlk gerçek `assay push` (0.4.0 ile).** assayctl.dev'e sekiz temsilci kayıt
seçildi, beşi yüklendi; üç eski ölçüm 0.4.1 hosted düzeltmesinden sonra
yüklendi. Sitede şu an: impeccable (3 koşum) ve hallmark **public**;
marketingskills (0bec859e, eski suite'le puanlanmış) **gizli** (kullanıcı
kararı); animate, better-typography, ui-ux-pro-max o gün gizli yüklendi,
2026-09-11 itibarıyla kullanıcı tarafından yayımlanmış. Production Dokploy'la main'e her push'ta kendiliğinden
dağıtılıyor.

**Bulunan kusurlar ve durumları** (tablo roadmap.md 0.4.1):
0.4.1-a…o'nun hepsi kapandı — eski kayıt reddi (a), maskeleme kaçakları (b, c),
genel 400 (d), push çıkış kodu (e), gizli koşum sessizliği (f), token sayfası (g),
`--version` (h), `/compare` 404 (i), aralık taşması (j), ad kırılması (k), boş
payda gerekçesi (l), dizin eksikliği (m), onay penceresi yığın sırası (n), üst
çubukta dizin (o). Web matrisi (0.4.1-1) tamam. Ek olarak tanıtım sayfasında
`npx assay` (ilgisiz bir npm paketini çalıştırıyordu), yanlış `init` yolu ve elle
yazılmış sayılar düzeltildi.

**Önemli kararlar** (tam metin decisions.md, 2026-09-10): bütçe/kurtarma kesmesi
`pass` veremez; hızlı modun gizli tavanı yok; kazanan = ilk doğrulanmış
aktivasyon, `winner: none`, hiçbiri tetiklenmediyse `fail`; host skill'i de
"ilk tetiklenen" sayılır; yeniden puanlanmış kayıt yüklenmez (köken); push
kalıntıda yüklemez (`--allow-unmasked`); 0.2.0 öncesi aktivasyon "yapılmadı"
olarak NULL; `/compare` yayın modunda açık; dizin `/suites`, üst çubukta
"Measurements"; push için çıkış kodu 4.

**Dersler.** Derleme kapılı ters çevirme bugün iki kez tabanı yakaladı (bir test
tip hatası, tüm tur "geçersiz" sayıldı). Bir doğrulama yanlış sebeple yeşildi:
Radix modal `pointer-events: none` verdiği için `elementFromPoint` çizim
sırasını değil tıklanabilirliği ölçtü; bileşen kataloğu `<main>` kullanmadığı
için kusur orada hiç oluşmuyordu. İkisi de düzeltildi.

Dört paket yayımlanıyor: `@ktlsr/assay`, `-core`, `-runner`, `-adapters`.
**0.3.0 yayımlandı (2026-09-10).** Dört paket registry'de, `latest=0.3.0`, npm
12.0.2 ile (OIDC, token değil), dördünde de SLSA provenance. `npx
@ktlsr/assay@0.3.0` temiz bir dizinde kurulup çalıştı; bağımlılıklar `0.3.0`'a
sabit. Yayın koşumu `34452831662`, birleştirme `b66f74c` (PR #3).

**Eylem v1.2.0 (2026-09-10).** `v1` ve `action-v1.2.0` → `3bef824` (pin 0.3.0),
GitHub Release "Latest". Dışarıdan doğrulandı (`ktlesr/assay-example`, koşum
`34456079954`): `@v1` → `3bef824`, `ASSAY_VERSION: 0.3.0`, 6/6 pass, ve
artefakttaki kayıt yalnızca 0.3.0'ın yazdığı `environment` alanını taşıyor.
Yol docs/marketplace.md'de.

**0.3.1 yayımlandı (2026-09-10).** 0.3.1-b: kurtarılan yarım kayıt `pass`
veremiyor, ulaşılamayan vakalar `skipped`da `cause: 'interrupted'` ile adıyla.
Dört paket registry'de (`latest=0.3.1`, npm 12.0.2/OIDC, provenance); yayın
koşumu `34460207347`, birleştirme `ddf5014` (PR #4). Parmak izi: aynı yarım
journal'ı npm 0.3.0 `pass`, npm 0.3.1 `unknown` diye kurtarıyor.
Eylem v1.2.1: `v1` ve `action-v1.2.1` → `ddf5014`; dışarıdan doğrulandı
(`ktlesr/assay-example`, koşum `34460704366`, `@v1` → `ddf5014`,
`ASSAY_VERSION: 0.3.1`, npm dalı, 6/6 pass).

**0.3.2 yayımlandı (2026-09-10).** Koşum kaydı onu üreten Assay sürümünü
taşıyor (`Run.assayVersion`); eski kayıtlar "0.3.1 or earlier" diye okunuyor.
Dört paket registry'de (`latest=0.3.2`, npm 12.0.2/OIDC, provenance); yayın
koşumu `34464668930`, birleştirme `94677c4` (PR #5). Eylem v1.2.2: `v1` ve
`action-v1.2.2` → `94677c4`. Dışarıdan doğrulandı (`ktlesr/assay-example`,
koşum `34465074947`): `@v1` → `94677c4`, `ASSAY_VERSION: 0.3.2`, ve kaydın
kendisinde `assayVersion: "0.3.2"` — sürüm doğrulaması artık doğrudan.

**0.4.0 yayımlandı (2026-09-10): çakışma ölçümü şeması.** Registry'de dört paket
(`latest=0.4.0`, npm 12.0.2/OIDC, provenance; yayın koşumu `34506237094`,
birleştirme `4109517`, PR #6). Eylem v1.3.0: `v1` ve `action-v1.3.0` → `4109517`;
dışarıdan doğrulandı (`ktlesr/assay-example` koşum `34506753558`, kayıtta
`assayVersion: "0.4.0"`). Tek hücre farkı kullanıcı onayıyla bırakıldı. `expect.winner`
(ilk doğrulanmış aktivasyon kazanır; `winner: none` negatif), hiçbiri
tetiklenmediyse `fail`, terminal ve HTML'de çakışma matrisi, tireli vaka id'leri,
hosted şemada kazanan sütunları. Kanıt: marketingskills kaydı yeniden puanlandı
— 179/21 → 79/121, "100 sahte pass"in tam kümesi döndü, matris `collide.py` ile
aynı süzgeçte 17/17 hücre aynı (docs/measurements.md, 0.4.0-f). 63 ters çevirme,
63'ü derleme temizken kırmızı. Sırada: 0.4.1 (web'de matris) ve 0.3.1-a (kalibrasyon, para harcar).

**0.4.1 yayımlandı (2026-09-10): ilk gerçek `assay push`ın bulguları.** Registry'de
dört paket (`latest=0.4.1`, npm 12.0.2/OIDC, provenance; yayın koşumu
`34518475687`, birleştirme `bb2f192`, PR #7). Eylem v1.3.1: `v1` ve
`action-v1.3.1` → `bb2f192`; dış depoda koşum yapılmadı (bu turda istenmedi,
para harcıyor) — `ls-remote` ve `v1`'deki `action.yml` pini (0.4.1) okundu.
İçerik: kullanıcı adının üç biçimi ve hesap adı maskeleniyor, `push` kalıntıda
yüklemiyor; 0.2.0 öncesi kayıt "aktivasyon doğrulanmadı" olarak saklanıyor ve
bozuk kayıt yerini söylüyor; `/compare` yayın modunda açık; `/suites` dizini.
Production Dokploy'la push'tan kendiliğinden dağıtıldı; migration 0.2.0 öncesi
satırlarda `triggerRefused`'ı NULL yaptı (frontend-design "activation not
verified" gösteriyor). Üç eski ölçüm (animate 57205e2b, better-typography
ac10d159, ui-ux-pro-max 2a900c03) 0.4.1 ile yüklendi — maskelenmemiş asıllardan;
push 1 ve 7 yeri maskeledi, yüklenen yolda ad sıfır. Üçü de gizli (yayımlama
kullanıcı kararı). Sırada: küçük kusurlar (0.4.1-e…n) ve web matrisi (0.4.1-1).

**0.4.2 yayımlandı (2026-09-10): küçük kusurlar turu.** Registry'de dört paket
(`latest=0.4.2`, npm 12.0.2/OIDC, provenance; yayın koşumu `34523997246`,
birleştirme `114f4b9`, PR #8). Eylem v1.3.2: `v1` ve `action-v1.3.2` →
`114f4b9`; dış depoda koşum yapılmadı (istenmedi). CLI: `push` yükleme
gerçekleşmezse 4 ile çıkıyor (davranış değişikliği), gizli koşumu söylüyor,
`--version`. Web ve ui düzeltmeleri (g, j, k, l, n, o) Dokploy'la push'tan
dağıtıldı. Sırada: web'de çakışma matrisi (0.4.1-1).

**Geliştirme ortamı notu:** bu makinede 3000 ve 5433 başka projelerin
konteynerlerinde. Assay: `ASSAY_DEV_PG_PORT=5434 node tools/dev-postgres.mjs`
ve `apps/web` içinde `DATABASE_URL=postgres://postgres@127.0.0.1:5434/postgres
npx next dev --port 3100`.

Sırada **0.3.1-a** (uyarlanabilir durdurma): kalibrasyon koşumu ~$10–20, tetiği
kullanıcı çeker.

## Tamamlananlar

| Adım | Çıktı | Commit |
|---|---|---|
| 0.1 Proje anayasası | docs/, CLAUDE.md, repo hijyeni | `eff9647` |
| 0.2 Monorepo iskeleti | pnpm workspace, zorlanan bağımlılık sınırları | `d731b9a` |
| 0.3 Vaka seti şeması | `parseSuite`, Zod + anlamsal doğrulama | `02818de` |
| 0.4 Assertion motoru | kanonik tipler, `no_swallowed_errors`, Wilson | `f873f2d` |
| 0.5 Adaptör arayüzü | `HostAdapter`, MockAdapter | `b1e6690` |
| 0.6 Host fizibilite | docs/host-feasibility.md, git kararı | `e787ee6` |
| 1.1 Gerçek adaptör | Claude Code, canlı doğrulama 3/3 | `4f5b950` |
| 1.2 Runner + store | uçtan uca 12/12, skorlama | `eae4316` |
| 1.4 CLI | run/validate/report/compare/ci, HTML rapor | `2ffe1c2` |
| 1.5 GitHub Action | PR karnesi, baseline artefaktı | `47f2b88` |
| 1.3 Sandbox güvenliği | 4 yüksek + 2 orta bulgu kapatıldı | `fce6643` |
| 1.6 Dogfooding | 3 skill, 150 koşum, gerçek kusur bulundu | `bf37645` |
| 2.1 Veri modeli | Prisma şeması, DB seviyesinde değişmezler, gidiş-dönüş | `d62b30a` |
| 2.2 Tema sistemi | tahlil sertifikası dili, iki tema, Tailwind v4 | `13b2352` |
| 2.3 Bileşen katmanı | packages/ui, Radix tabanlı, /dev/components | `c7d74ff` |
| 2.4 Dashboard | beş ekran, karşılaştırma reddi gerçek veriyle | `8e90b58` |
| 2.5 Kimlik doğrulama | Auth.js, rol, API token, assay push, DB'den okuma | `5332597` |
| 2.6 Admin panel | kullanıcılar, koşumlar, denetim kaydı | `b685d50` |
| 2.7 Tanıtım sayfası | yalnızca veritabanından okunan gerçek ölçüm | `f25fd36` |
| 3.1 Güvenlik incelemesi | 2 yüksek + 3 orta bulgu kapatıldı | `cb76d75` |
| 3.2 Test ve CI | kapsam eşiği, prisma generate, derleme adımı | `4bbc04d` |
| 3.3 Deploy | Dockerfile, compose, /api/health, docs/deploy.md | `a3c0858` |
| npm hazırlık | `@ktlsr` scope'u, 0.1.0, changesets, tarball denetimi | `afa1cb8` |
| Yayın hattı | token doğrulaması, yayın sonrası registry kanıtı | `5094571` |
| Public depo | provenance, geçmiş sır taraması (temiz) | `3016d53` |
| Yayın tetiği | push değil, `workflow_dispatch` + onay metni | `4dc5fc1` |
| Kalibrasyon | fail/unknown gerçek koşumlarla kanıtlandı | (bu commit) |
| 0.1.1 | ayrım gücü notu; OIDC ile yayın (0.1.0 token'la gitmişti) | `651846c` |
| 0.1.2–0.1.3 | `assay scrub`; ölçülmeyen koşum her katmanda `unknown` | — |
| 0.2.0 | tetiklenme = doğrulanmış aktivasyon, `--permission-mode`, hook olayları | — |

## 0.3.0 — nerede kaldık

Beş maddenin beşi de kodda **tamam** ve `pnpm check` yeşil (688 test).
Kanıt tabanı 2026-09-08 `impeccable` 4.2.2 ölçümü: 240 deneme, ~8 saat,
$21.15. Beş kusurun beşi o koşumda canlı görüldü.

| Adım | Ne yapıldı | Commit |
|---|---|---|
| 0.3.0-a | `compare` kayan alanı adıyla söylüyor; ortam bileşenleri kayda giriyor | `e1d0336` `01d5f89` `728d6b7` |
| 0.3.0-b | Append-only journal, `partial` kayıt, `assay recover` | `b4b414d` `86b9626` |
| 0.3.0-c | Supervisor/worker ayrımı, süreç ağacı öldürme, öldürülen deneme `unknown` | `2f4fbb7` |
| 0.3.0-d | `--concurrency`, varsayılan 1, port kirası | `2a08bc9` |
| 0.3.0-e | `--fast`, `--max-attempts`, `Run.layers` / `skipped`, `Attempt.notEvaluated` | `c1eda78` |

0.3.0-e ters çevirmeyle doğrulandı (2026-09-09, altı mutasyon): katman
filtresi, atlanan vaka, bütçe tavanı, `layers`in kayda yazılması, `layers`in
worker payload'ına geçmesi ve terminal manşeti — altısında da testler kırmızıya
döndü. İlk denemede "yalnız-artefakt vakası" mutasyonu **yanlış sebeple**
kırmızıydı (derlemeyi kırdı, 9 test atlandı); tip-geçerli bir mutasyonla
tekrarlandı ve 4 test gerçekten düştü.

**CI 2026-09-08'den 2026-09-10'a kadar kırmızıydı** (0.3.0-c'den beri): süreç
ağacı testi yalnızca Linux'ta düşüyordu. İki kusur — worker canlı kalmıyordu,
POSIX yolu yalnızca grup sinyali gönderiyordu — Docker konteynerinde ölçülüp
kapatıldı (decisions.md, 2026-09-10). Linux yolu artık yerelde de sınanabiliyor:
`node:22.20.0` konteyneri.

**`--fast` gerçek hostta koşuldu (2026-09-10).** `impeccable.suite.yaml`'dan
türetilmiş 13 vakalık bir set (12 vaka + koşulmaması gereken bir yalnız-artefakt
vakası), `claude-haiku-4-5-20251001`, `--concurrency 4`.

| Kontrol | Sonuç |
|---|---|
| Yalnız artefakt ölçen vaka | koşulmadı; `skipped`'da sebebiyle, `cases`'te yok ✓ |
| Koşulan vakada assertion'lar | `assertions: []`, `notEvaluated: [file_exists, trace]`, verdict tetiklenmeden (`fail`), 0 `unknown` ✓ |
| Rapor manşeti | terminal ve HTML'de oranların üstünde ✓ — HTML vaka bazında hangi assertion'ın değerlendirilmediğini söylemiyor (terminal söylüyor) |
| `layers` | `["trigger"]` ✓ |
| Bütçe tavanı | `--max-attempts 3`: 3 deneme, 11 vaka sebebiyle `skipped` ✓ — **ama koşum `PASS`** |

36 + 3 deneme, $2.43 + $0.37. `--concurrency 4` ile duvar saati 6.2 dk, ajan
zamanı 23.0 dk (3.7x) — 0.3.0-d'nin gerçek hosttaki ilk ölçümü.

**Kapandı (2026-09-10):** bütçenin kestiği koşum artık `pass` veremiyor, hızlı
modun gizli tavanı kalktı, HTML vaka bazında "not evaluated" gösteriyor, journal
başlığı kapsamı taşıyor. Gerçek hostta: 3/3 geçti, koşum UNKNOWN, `ci` exit 3.
Sırada 0.3.0 yayını (PR #3).

Yan iş: bu makinedeki Git Bash `add_item` çökmesi ölü domain kaydından
geliyordu; `tools/fix-msys-domain-stall.ps1` ile kapatıldı (`a307c56`).

**Yapılmayanlar — bilinçli:**

- 0.3.0 **yayımlanmadı**. Yayın `gh workflow run release.yml -f confirm=yayimla`
  ile elle tetikleniyor; sürüm PR'ı önce birleşmeli.
- `--fast` **gerçek bir hostta hiç koşulmadı**. Testler sahte adaptörle;
  para harcayan bir doğrulama koşumu yapılmadı (sözleşme 1: tetiği kullanıcı
  çeker).
- Roadmap'in "kapsam dışı" notu duruyor: HTML raporundaki metrik kutuları
  hâlâ kart, `docs/design.md` #1 ile çelişiyor. Ölçümü etkilemiyor.

## Sırada

Sıra ve onay durumu (2026-09-13):

0a. **Temiz koşum ortamı — plan hazır, onay bekliyor** (2026-09-13):
    [runner-environment.md](runner-environment.md), roadmap "Temiz koşum
    ortamı" (K0–K6). Kod yazılmadı. Açık kararlar planın sonunda; K0 ücretsiz ve
    ilk adım.
00. ~~0.4.5 yayını ve maruz kayıtlar~~ — **tamam (2026-09-13)**: yayımlandı,
    `v1` taşındı; maruz kayıtlara künye notu düşüldü, yeniden ölçülmedi.

0. ~~0.4.4 yayını~~ — **tamam (2026-09-13).** Registry'den doğrulandı;
   `v1` ve `action-v1.3.4` → `6e491ed` (kullanıcının açık onayıyla).

1. ~~Kazananlı suite'le gerçek çakışma koşumu~~ — **tamam (2026-09-11).**
   0.4.3 ile 912ad216: 20/20 vaka, 60 deneme, $3.04; kayıt ve suite ölçüm
   deposunda (`05b820b`). v3 suite kullanıcı tarafından yayımlandı, 0.4.2
   koşumu (2bc985d5) kullanıcı tarafından silindi. Production'da matris
   core'un aynı kayıttan hesapladığıyla 240/240 hücrede ve 15/15 "won"
   sayımında aynı; hızlı mod uyarısı sayıların üstünde; dizin ve suite sayfası
   "fast mode" diyor; iki tema × 1280/375'te taşma yok. Ölçüm deposundaki
   rapor (`reports/marketingskills.collide.md`) başına iki koşumun farkını
   söyleyen not eklendi (`633f4b3`).
   v3 tam koşumu (roadmap "Ölçüm-1") **Ertelendi (kullanıcı kararı, 2026-09-13):** ifade bağlama deneyinin B kolu bugünkü kurulumun aynısı; deney tam modda koşulursa v3 tam matrisi de oradan gelir — iki kez ödenmez. Ayrı bir v3 tam koşumu yapılmayacak.
2. ~~Üç eski ölçümün yayımlanması~~ — **tamam**: animate, better-typography,
   ui-ux-pro-max public (anonim istekle doğrulandı, 2026-09-11). Yalnız
   marketing-skills v2 (0bec859e) gizli; bilinçli karar.
3. **0.3.1-a — uyarlanabilir durdurma.** Sabit bakış çizelgesi + Bonferroni;
   ~2 gün kod + kalibrasyon koşumu (~$10–20). **Onay bekliyor (para).**
4. ~~Dış depo doğrulaması~~ — **0.4.4 için tamam (2026-09-13)**: dış depodan doğrulandı (`ktlesr/assay-example`, koşum `34754816362`: `@v1` → `6e491ed`, `assay-version: 0.4.4`, kayıtta `assayVersion: "0.4.4"`, 3 vaka / 6 deneme `pass`, `scrub` çalıştı).
   0.4.1–0.4.3 dışarıdan hiç koşulmadı; 0.4.4 onların üst kümesi.
5. Kayıt dışı kalanlar, küçük: tanıtım sayfasının öne çıkardığı suite
   yayımlananlara göre değişiyor (şu an hallmark) — bilinçli seçim gerekirse
   bir "featured" alanı; `robots.ts` `/compare`'ı taramaya kapalı tutuyor
   (bilinçli).
6. **Impeccable'ı yeniden ölç — yayımlanmış bir sürüm çıkınca.** Kullanıcının
   #744 numaralı issue'daki bulgularını referans alan bir özellik issue'su (#789)
   ve bir test vakası (#791) açıldı, commit main'e girdi. Degraded Setup yolu artık
   `craft-floor.md`'yi her UI düzenlemesinden önce, `document.md`'yi DESIGN.md
   yazımından önce **koşulsuz** okutuyor — ölçülen iki bulguyu doğrudan
   hedefliyor. main'deki commit değil, yayımlanmış sürüm ölçülecek; önceki
   ölçümlerle karşılaştırılabilmesi için aynı suite (`impeccable.suite.yaml`,
   c820aafc), aynı model ve aynı izin modu. skillHash değişeceği için `compare`
   bunu reddedecek — sürümler arası fark vaka vaka, aralıklarla okunur.
   **Tetik: yeni sürüm yayımlanınca; koşum para harcar, onay gerekir.**

Ondan sonrası roadmap.md'nin "sonraki dalga"sı: model güncelleme
sertifikasyonu, çapraz-host matrisi. Bilerek yapılmadı.

**Ölçüm reposu (D:\assay-example = ktlesr/skill-trigger-measurements).**
Son commit `05b820b` (v3 çakışma suite'i), origin ile eşit. Koşum kayıtları
`.assay/runs/` altında ve `.assay/` gitignore'da (912ad216 dahil): kayıtların
tek kopyası bu makinede.

## Yayın durumu

- Paketler: `@ktlsr/assay` (bin `assay`), `-core`, `-runner`, `-adapters`.
  `db`, `ui`, `web` yayımlanmaz.
- Sürüm 0.1.0 **yayımlandı**; dördü de registry'de ve provenance taşıyor.
- Yayın **push ile tetiklenmiyor**: `gh workflow run release.yml -f
  confirm=yayimla`. Sebep — main'e atılan her commit bir yayın denemesine
  dönüşüyordu.
- Kimlik doğrulama trusted publishing (OIDC). `NPM_TOKEN` hattan çıkarıldı;
  iş akışına geri eklenirse OIDC devre dışı kalır — eklemeyin.
- İlk yayın denemesi `EOTP` ile düşmüştü (token 2FA'yı atlayamıyor); trusted
  publishing bu sınıfı tamamen ortadan kaldırdı.
- Yayın sonrası doğrulama artık changesets'in `published` bayrağına değil
  yayın moduna bağlı: 0.1.0'da bayrak `false` kaldığı için doğrulama sessizce
  atlanmıştı, paketler gitmişti ama kimse kontrol etmemişti.
- Süreç [releasing.md](releasing.md), işletim [operations.md](operations.md),
  kalibrasyon [calibration.md](calibration.md).

## CI durumu

2026-09-01'de CI'ın **her push'ta kırmızı olduğu** fark edildi — yalnızca bu
oturumun commit'lerinde değil, 31 Ağustos'takilerde de. Koşumlar 10–20
saniyede düşüyordu: `pnpm/action-setup` hem action config'indeki `version: 10`
hem `package.json`'daki `packageManager` alanını görünce "Multiple versions of
pnpm specified" hatası veriyor ve kurulum hiç başlamıyordu. Yerelde `pnpm
check` geçtiği için fark edilmemişti.

`version:` üç workflow'dan da kaldırıldı (`cf28065`). CI o commit'te ilk kez
uçtan uca yeşile döndü: install, prisma generate, typecheck, lint, coverage,
build ve standalone denetimi.

Aynı düzeltme Release'i de kurtardı — yayın tetiklendiğinde tam olarak aynı
adımda düşecekti.

## Kalibrasyon özeti

Araç kırmızı gösterebiliyor; 2026-09-01'de 36 gerçek koşumla kanıtlandı.
`fail` üç katmanda (tetiklenme, tamamlama, yutulan hata), `unknown` iki
yoldan (okunamayan sinyal 6/6, gözlenemeyen yan etki 2/3), çıkış kodlarının
dördü de doğru. **Üretilemeyen tek verdict `regressed`** — sebebi
istatistiksel, [calibration.md](calibration.md)'de yazılı.

## Çalışma kuralları (oturum sıfırlanırsa)

- Her adım sonunda: typecheck + lint + test, arayüz varsa iki temada ekran
  görüntüsü, sır taraması, commit, `main`'e push.
- Üç denemede çözülmeyen sorun `blockers.md`'ye yazılır, parça izole edilir,
  kalanla devam edilir.
- Eksik sır (Google OAuth, SMTP, model anahtarı) durdurmaz: `.env.example`'a
  placeholder, özellik iskelet, ilgili test `skip`, `blockers.md`'ye kayıt.
- Yalnızca üç şeyde durulur: sır sızıntısı, geri alınamaz git işlemi,
  `invariants.md` ile çelişki.

## Ortam

- Kimlik: `.env` içinde `CLAUDE_CODE_OAUTH_TOKEN` (`claude setup-token`).
  Doğrulamak için `node tools/check-auth.mjs`.
- Gerçek host koşumu para harcar: attempt başına ~$0.03–0.06.
- `pnpm dev` → http://localhost:3000
- **Bu makinede** 3000 ve 5433 başka projelerin Docker konteynerlerinde:
  `ASSAY_DEV_PG_PORT=5434 node tools/dev-postgres.mjs`, `apps/web` içinde
  `DATABASE_URL=postgres://postgres@127.0.0.1:5434/postgres DATABASE_POOL_MAX=1
  npx next dev --port 3100`.
- PGlite soketi **tek istemci** kabul ediyor ve bir istemci ayrıldıktan sonra
  yenisini çoğu zaman kabul etmiyor. Web açıkken betikle veritabanına
  yazılmaz: web'i ve DB'yi durdur, DB'yi başlat, tek süreçte yaz, DB'yi yeniden
  başlat, web'i aç.
- `packages/core` değişince `npx tsc -b` yetmiyor: çalışan `next dev` core'un
  eski `dist`ini önbellekte tutuyor — web'i yeniden başlat.
- Oturum kapanışında (2026-09-11 akşam) web 3100 ve DB 5434 bu oturumdan
  başlatılmıştı; oturumla birlikte kapanmış olabilirler. Yeniden açmak için
  yukarıdaki iki komut (önce DB).
- Yerel dev veritabanında sınama için yazılanlar (production'da yok):
  `…0bec859e-rescored-local` (matris doğrulaması, 0.4.0-f kaydı), `run-f3-*`
  kopyaları, yerel public bayrakları, `xlsx` gizli.
- Hosted taraf veritabanı ister. Geliştirmede: `pnpm db:dev` (PGlite,
  127.0.0.1:5433). `apps/web/.env.local` içinde `DATABASE_URL`, `AUTH_SECRET`
  ve `DATABASE_POOL_MAX=1`.
- İlk yönetici: `DATABASE_URL=... pnpm db:user <email> <parola> ADMIN`.
- Veritabanını gerçek koşumlarla doldurmak: arayüzden token üret, sonra
  `ASSAY_URL=... ASSAY_TOKEN=... node tools/seed-hosted.mjs`.
- Testler: `pnpm check` (typecheck + lint + test). Gerçek host koşumları
  test suite'inde değil, `tools/` altında elle çalıştırılır.
