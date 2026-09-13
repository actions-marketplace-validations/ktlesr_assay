# Temiz koşum ortamı — plan

Durum: **tasarım, uygulanmadı** (2026-09-13). Onay bekleyen kararlar en altta.

## Amaç ve kapsam

Kendi ölçümlerim için, makinemin ölçüme karışmadığı kontrollü bir koşum ortamı.

- **Kapsamda:** benim suite'lerim, benim tetiklediğim koşumlar, ölçüm deposundaki
  skill'ler (bir kısmı üçüncü taraf: marketingskills, impeccable, hallmark).
- **Kapsam dışı:** hosted bir ürün. Başkalarının kodunu çalıştırmak, kullanıcı
  hesabı, kota, kredi yönetimi yok. Tek kiracı: ben.

"Üçüncü taraf skill" kapsam dışında değil: bugün de ölçülen skill'ler yabancı kod
ve ajan onların talimatıyla kabuk komutu çalıştırabiliyor. Ortam bu yüzden
ölçülen ajana güvenmiyor. Güvenmediği ölçüde de iddia ediyor — "engelleniyor"
yalnızca gerçekten engellenen şey için söylenecek.

## Makinenin ölçüme karıştığı yerler

| Arıza | Bugün | Ortamda |
|---|---|---|
| Host CLAUDE.md sızıntısı | 0.4.5'te üç katmanla kapandı, ölçülüyor | Deneme konteynerinde HOME boş, çalışma dizininin üstünde talimat yok; 0.4.5'in dışlaması ve ölçümü aynen kalıyor |
| `%TEMP%` ev altında | 0.4.5'te çalışma kökü `C:\assay-work` | Konteynerde `/tmp` ve `/work`, ev yok |
| `System32` PATH'te yok | Windows'a özgü, ölçülen skill'in `where curl.exe` sondası düştü | Linux imajı; PATH imajda sabit |
| Git Bash `add_item` arızası | Windows'a özgü, 390 Bash çağrısının 11'ini düşürdü | Bash yerel; Git Bash yok |
| Yetim dev sunucular | 0.3.0-c: ağaç öldürme, "en iyi çaba" | Deneme konteyneri deneme bitince bütün olarak ölüyor (PID ad alanı); yetim kalamaz |
| Ajanın runner'ı öldürmesi | 0.3.0-c: kayıp bir denemeyle sınırlı, tavan yazılı (A3) | Runner başka bir PID ad alanında; ajan onu göremiyor |
| Port çakışması (eş zamanlı) | 0.3.0-d: port kirası, "yumuşatma, garanti değil" | Her denemenin kendi ağ ad alanı; çakışma olamaz |
| Disk ve CPU kotası yok (A2) | Kabul edilmiş risk | Konteyner başına bellek, CPU, pid ve disk sınırı |
| Claude Code sürümü kendiliğinden güncelleniyor | Ortam hash'i koşumlar arasında kaydı (2.1.267 → 2.1.268, 0bec859e/2bc985d5) | Sürüm imajda pinli; yükseltme bilinçli ve imajla birlikte |

## Mimari

```
                    ┌──────────────────── ayrı VPS ────────────────────┐
 dizüstü            │                                                   │
 assay-remote ─ssh──┼─► supervisor (assay run, host'ta, tek kullanıcı)  │
   (tetik)          │     │  deneme başına: docker run … worker          │
                    │     ▼                                             │
                    │   ┌─ deneme konteyneri (kısa ömürlü) ─┐           │
                    │   │ claude + worker, HOME=/home/agent │           │
                    │   │ ANTHROPIC_API_KEY=sahte           │           │
                    │   │ ağ: yalnızca iç ağ                │──► kimlik  │
                    │   └───────────────────────────────────┘    proxy ─┼─► api.anthropic.com
                    │                                   (gerçek anahtar) │
                    │   .assay/runs (kalıcı disk) ─► assay push ────────┼─► assayctl.dev (gizli)
                    └───────────────────────────────────────────────────┘
 dizüstü ◄── rsync ── .assay/runs
```

Üç parça, hepsi ayrı VPS'te:

1. **Supervisor** — bugünkü `assay run`. Journal, store, ilerleme onda. Değişen tek
   şey: worker'ı yerel bir süreç olarak değil, bir konteynerde başlatıyor.
2. **Deneme konteyneri** — deneme başına yeni, bitince siliniyor. İçinde Claude Code,
   Assay'in worker'ı ve skill'in ihtiyaç duyduğu araçlar.
3. **Kimlik proxy'si** — gerçek anahtarı tutan tek süreç. Deneme konteynerlerinin
   dış dünyaya açılan tek kapısı.

### Neden bu ayrım mevcut koda oturuyor

0.3.0-c zaten her denemeyi ayrı bir worker sürecinde koşturuyor
(`superviseAttempt`: `spawn(node, [worker.js, payload.json])`); worker sonucu bir
dosyaya yazıyor ve supervisor ağacı kapatıyor. Konteyner, bu `spawn`'ın yerine
`docker run --rm … node worker.js /io/payload.json` koymak demek: payload dizini
bind mount, sonuç aynı dosyadan okunuyor, "ağacı kapat" = `docker kill`. Supervisor
ile worker arasındaki sözleşme (sonuç dosyası, `DONE` satırı, öldürülen deneme
`unknown`) değişmiyor.

## 1. Nerede ve hangi izolasyon

**Karar önerisi: ikisi. Ayrı bir VPS, üstünde deneme başına konteyner.**

| Seçenek | Ne çözer | Neden yetmez / neden seçilmedi |
|---|---|---|
| Yalnızca VPS (konteynersiz) | Windows'a özgü arızalar, token dizüstünde durmuyor | Yetimler, runner'ın öldürülmesi, port çakışması, ev dizini aynen kalır — sorunları bir makineden diğerine taşır |
| Yalnızca konteyner, dizüstünde (Docker Desktop) | Neredeyse hepsi | Token dizüstünde kalır; dizüstü uyku/bellek baskısı koşumu öldürür (bugün iki sunucu "low memory" ile kapandı) |
| Koşum başına tek konteyner | CLAUDE.md, TEMP, Windows arızaları | Ajan aynı PID ad alanında supervisor'u öldürebilir; yetimler koşum sonuna kadar yaşar; eş zamanlı denemeler portları paylaşır |
| **VPS + deneme başına konteyner** | **Tablodaki hepsi** | Konteyner başlatma maliyeti deneme başına ~1–2 sn; denemeler 15–90 sn |
| VM/microVM (gVisor, Firecracker) | Çekirdek paylaşımını da kaldırır | Tek kiracı için orantısız; yükseltme yolu olarak duruyor |

**Mevcut Dokploy VPS'i değil.** O makinede production veritabanı ve web var.
Ölçülen ajan yabancı kod çalıştırıyor; aynı çekirdeği, aynı Docker'ı ve aynı ağı
production verisiyle paylaşması, ölçüm ortamının bir kaçışını production'ın bir
kaçışı yapar. Ayrı makine, patlama yarıçapını "harcama tavanı olan bir API
anahtarı" ile sınırlıyor.

**Deneme konteynerinin sınırları:**
- kök olmayan kullanıcı (uid 1000), `--cap-drop ALL`, `--security-opt no-new-privileges`,
  Docker'ın varsayılan seccomp profili
- kök dosya sistemi salt okunur; yazılabilir olan yalnızca `/work` (çalışma dizini),
  `/tmp` ve `/home/agent` (tmpfs)
- `--memory`, `--cpus`, `--pids-limit`, tmpfs boyutu (A2'nin kapanışı)
- Docker soketi yok; host ağı yok; ağ: yalnızca proxy'ye açılan iç ağ (bkz. 2)
- skill kopyası ve fixture'lar salt okunur bind mount

**Supervisor host'ta**, ayrı bir kullanıcıyla. `docker` grubu kök eşdeğeri; bunu
yalnızca bu makinede ve yalnızca bu kullanıcıda kabul ediyorum. Deneme
konteynerlerine asla soket verilmez.

## 2. Anthropic kimliği

**Karar önerisi: gerçek anahtar yalnızca proxy'de. Deneme konteyneri onu hiç
görmüyor.**

Bugün kimlik bilgisi ajan sürecinin ortamına veriliyor (adaptör allowlist'i +
`CLAUDE_CODE_OAUTH_TOKEN`). Claude Code'un `Bash` aracının alt süreçleri bu ortamı
devralıyor; ölçülen bir skill `env` çalıştırıp token'ı okuyabilir ve kayıttaki
maskeleme (H3) onu yalnızca **kayıttan** siler. Üçüncü taraf skill ölçerken bu,
token'ı ölçülen koda vermek demek.

**Tasarım.** Deneme konteynerine `ANTHROPIC_API_KEY=<sahte>` ve
`ANTHROPIC_BASE_URL=http://proxy:8080` veriliyor. Proxy isteği alıyor, `x-api-key`
başlığını gerçek anahtarla değiştiriyor ve yalnızca `api.anthropic.com`'a
iletiyor. Deneme konteynerinin ağı `internal: true` bir Docker ağı; tek komşusu
proxy, proxy'nin dışa çıkışı var. Böylece:
- token konteynerde yok — okunacak bir şey yok
- dışa tek çıkış proxy; ölçülen kod başka bir adrese bağlanamıyor (A1'in ağ
  yarısı gerçekten kapanır: "gözleniyor" değil "engelleniyor" denebilir)
- proxy harcamayı koşum başına sayabilir ve bir tavanda kesebilir

**Doğrulanmış olan:** Claude Code keyfi bir anahtar dizesiyle `ANTHROPIC_BASE_URL`'ye
istek gönderiyor ve sistem istemini kurup yolluyor — 0.4.5'in ücretsiz sondası tam
olarak bunu yaptı (`tools/probe-host-memory.mjs`).

**Doğrulanmamış olan (K0'da ölçülecek):**
- İstek dışında Claude Code'un başka bir adrese ihtiyacı var mı (telemetri,
  sürüm kontrolü, `statsig`). Plan: `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`,
  `DISABLE_AUTOUPDATER=1`, sonra iç ağda koşup neyin düştüğüne bakmak. Düşen bir
  çağrı denemeyi `unknown` yapar, sessizce geçirmez.
- Akış (SSE) yanıtlarının proxy'den bozulmadan geçmesi.

**API anahtarı mı, OAuth mu.** Öneri: **API anahtarı**, Anthropic Console'da ayrı bir
workspace'te, aylık harcama tavanıyla.
- OAuth (`claude setup-token`) abonelik kotasına bağlı; ifade bağlama deneyinde
  oturum sınırına 184 denemede takıldı ve 16 negatif `unknown` kaldı. Uzun bir
  ölçüm ortasında kota bitmesi, ölçümün kendisini bozuyor.
- API anahtarı ölçüm başına gerçek para demek (bkz. 7), ama öngörülebilir, iptal
  edilebilir ve bir tavanı var.
- OAuth token'ının bir proxy'den enjekte edilmesi (`Authorization: Bearer` + beta
  başlığı) teknik olarak mümkün görünüyor ama doğrulanmadı ve aboneliğin bu
  kullanıma uygunluğu ayrı bir soru. Buna dayanmıyorum.

**Anahtarın saklanması:** VPS'te kökün okuyabildiği bir dosya (`0600`), proxy
konteynerine Docker secret olarak. Repoda yok, dizüstünde yok, deneme
konteynerinde yok. Dönüşüm: Console'da yeni anahtar → dosya → proxy yeniden
başlar.

## 3. HOME ve CLAUDE.md

Konteynerde de HOME var ve Claude Code yine çalışma dizininden köke kadar talimat
arıyor. Kurulum:

- **İmaj:** `/home/agent` boş; imajın hiçbir yerinde `CLAUDE.md`, `CLAUDE.local.md`
  ya da `.claude/` yok. Yönetilen (policy) yol da yok: Linux'ta
  `/etc/claude-code/CLAUDE.md`. İmaj derlenirken bir adım bunu **denetliyor**:
  `find / -name CLAUDE.md -o -name CLAUDE.local.md -o -path '*/.claude/*'` boş
  değilse derleme düşüyor.
- **Çalışma dizini** `/work`: üst dizini yalnızca `/`. `HOME=/home/agent` tmpfs,
  her denemede boş.
- **`CLAUDE_CONFIG_DIR`** bugünkü gibi: adaptör denemeye özel bir dizin açıyor,
  `claudeMdExcludes` ve ölçüm kancasını oraya yazıyor. Konteyner bunu gereksiz
  kılmıyor — **ölçüm kalıyor**. Ortam temiz olduğu için değil, temiz olduğunu her
  koşumda gösterdiği için güveniliyor: `environment.memory` bu ortamda da `[]`
  yazmalı; yazmıyorsa imaj bozulmuş demektir ve kayıt bunu söyler.
- Fixture'ın kendi `CLAUDE.md`'si `/work` altına kopyalanıyor ve yükleniyor — suite'in
  parçası.

## 4. Tetikleme

**Karar önerisi: şimdilik yalnızca CLI.**

`tools/assay-remote` (dizüstünde, küçük bir betik):
1. ölçüm deposunda commit'lenmemiş değişiklik varsa durur (sunucu ne koştuğunu
   commit'ten bilmeli)
2. `ssh runner 'cd measurements && git pull && assay run <suite> <bayraklar>'`
3. sunucuda tek seferde bir koşum (dosya kilidi); ikinci tetik bekler ya da reddedilir
4. bitince `assay push` (sunucuda) ve dizüstüne `rsync .assay/runs`

**Admin arayüzü neden şimdi değil.** Arayüzden tetik, production web'in ölçüm
sunucusuna bir iş göndermesi demek. En güvenli biçimi bile (web bir iş kuyruğuna
yazar, ölçüm sunucusu dar yetkili bir token'la kuyruğu okur) production
veritabanı ile ölçüm makinesi arasında yeni bir güven çizgisi açıyor ve tek
kullanıcılı bir kurulumda karşılığı yok. Yükseltme yolu yazılı: kuyruk tablosu +
ölçüm sunucusunda gelen portu olmayan bir çekme döngüsü. İhtiyaç doğduğunda.

## 5. Sonuçların dönüşü

**Mevcut push yolu olduğu gibi kullanılıyor.**
- Sunucu `.assay/runs`'ı kalıcı bir diskte tutuyor (journal dahil; ölen bir koşum
  `assay recover` ile kurtarılabilir).
- Koşum bitince `assay push` hosted'a yüklüyor — yayımlanmamış suite'e gider, gizli
  kalır; yayımlamak bugünkü gibi admin panelinden. Push'un maskeleme ve kalıntı
  kontrolü (0.4.1-b, c) aynen çalışıyor.
- Dizüstüne `rsync` ile iniyor. Böylece kaydın üç kopyası oluyor: sunucu diski,
  hosted veritabanı, dizüstü. Bugün 48 kaydın tek kopyası dizüstünde
  (progress.md, "Ölçüm reposu"); bu da kapanıyor.
- Sunucudaki upload token'ı (`ASSAY_TOKEN`) Anthropic anahtarından ayrı bir sır;
  yalnızca push için, supervisor kullanıcısında.

## 6. Kayda ne girmeli

Ortam değişince ölçümün koşulu değişir; kayıt bunu söylemeli ki eski dizüstü
kayıtlarıyla yeni sunucu kayıtları sessizce karşılaştırılmasın.

- **`environment.platform`** (işletim sistemi + mimari). Bugün ortam hash'i
  araç listesinden dolaylı olarak ayrışıyor (Windows'ta `PowerShell` aracı var),
  ama dolaylı bir ayrım bir kayma detektörü değil. Açıkça girmeli.
- **İmaj özeti** (`sha256:` digest). İmaj Node'u, Python'u, Playwright'ı ve Claude
  Code'u taşıyor; skill'in çalıştırdığı betikler bunlara bağlı. Ortam hash'ine girer.
- **Fırsat — gerçek pin 3.** Proxy host'un gönderdiği sistem istemini görüyor.
  `--exclude-dynamic-system-prompt-sections` ile değişken bölümler (cwd, tarih)
  ilk kullanıcı mesajına taşınırsa istemin hash'i kararlı olur ve
  `systemPromptHash` bugünkü `not-provided-by-host` yerine **ölçülmüş** bir değer
  taşır. Bayrak host'un istem düzenini değiştiriyor, yani kendisi bir koşul.
  Ayrı bir karar; bu planın dışında (bkz. açık kararlar).

## 7. Maliyet

**Sunucu.** 4 vCPU / 8 GB sınıfı bir VPS, ayda **~€7–17** (Hetzner CX32–CX42
sınıfı; fiyat satın almadan önce doğrulanmalı). Bellek bütçesi: bir Claude Code
süreci ~0.3–0.5 GB; tarayıcı süren bir skill (webapp-testing, impeccable'ın dev
sunucusu) deneme başına 1 GB'a çıkabiliyor. 8 GB'ta eş zamanlılık 4 rahat; 4 GB'ta 2.
Disk: imaj ~1–2 GB, kayıtlar koşum başına 1–20 MB.

**Koşum (API, gerçek kayıtlardan):**

| Koşum | Deneme | Tutar | Deneme başına | Duvar saati |
|---|---|---|---|---|
| marketingskills çakışma, tam (0bec859e) | 200 | $10.18 | $0.051 | 26 dk (eş zamanlılık 4) |
| marketingskills v3, hızlı (912ad216) | 60 | $3.04 | $0.051 | ~8 dk |
| impeccable 4.2.2, tamamlama ağırlıklı | 240 | $21.15 | $0.088 | ~8 sa seri; 4'le ~1.5–2 sa beklenir |

Hepsi Haiku 4.5. Kural: **tetiklenme ağırlıklı suite ~$0.05, tamamlama ağırlıklı
~$0.09 deneme başına.** Konteyner başlatma maliyeti ücretsiz, süreye deneme başına
~1–2 sn ekler.

**Aylık örnek:** 4 tam koşum (~$40–70) + 10 hızlı koşum (~$30) + sunucu (~€10) ≈
**$80–110/ay**. Console'daki harcama tavanı bunun üstüne konmalı; proxy ayrıca
koşum başına bir tavan uygulayabilir (`--max-attempts`'in para karşılığı).

**Geliştirme ücretsiz.** K0–K3 boyunca gerçek anahtar gerekmiyor: 0.4.5'in sondası
gibi sahte anahtar + yerel yakalayıcıyla proxy'nin, konteynerin ve ölçümün doğru
çalıştığı gösterilebiliyor. Para yalnızca K5'in doğrulama koşumunda (~$5–10).

## 8. Riskler ve tavanlar

- **Konteyner bir VM değil.** Çekirdek paylaşılıyor; bir çekirdek açığı konteynerden
  çıkışa izin verir. Karşılığı: ayrı makine (production'dan ayrı), kök olmayan
  kullanıcı, kapasite düşürme, soket yok. Kalan patlama yarıçapı: proxy'nin anahtarı
  ve sunucudaki kayıtlar. Anahtarın tavanı var; kayıtların hosted ve dizüstü
  kopyası var. Daha sertini isteyen yükseltme yolu gVisor.
- **Proxy tek hata noktası ve tek sır sahibi.** Düşerse denemeler `unknown` olur
  (ölçülmedi — doğru cevap). Ele geçirilirse anahtar sızar: tavan + dönüşüm.
- **Host'un bilinmeyen dış çağrıları.** Claude Code'un API dışında bir adrese
  ihtiyacı varsa iç ağda düşer. K0'da ölçülecek; ölçülmeden "engelleniyor"
  denmeyecek.
- **Ölçüm ortamı artık Linux.** Windows'a özgü davranışı olan bir skill bu ortamda
  farklı ölçülür. Doğru olan bu: ortam kayıtta (`platform`) ve hash'te; dizüstü
  kayıtlarıyla karşılaştırma `unknown` üretir. Bedeli: bugünkü taban çizgileri
  (impeccable, hallmark…) sunucuda **yeniden kurulmalı**.
- **Pinli Claude Code sürümü eskir.** Yükseltme bir imaj değişikliği ve ortam
  hash'ini bilerek kaydırır. Bu bir özellik: bugün sürüm koşumlar arasında
  habersiz kayıyordu.
- **API anahtarı abonelikten pahalı olabilir.** Ölçüm hacmi büyürse fark büyür.
  Tavan ve koşum başına sayaç bunu görünür tutar.
- **Tek operatör.** Sunucu yaması, Docker güncellemesi, disk dolması benim işim.
  Kayıt diski dolarsa journal yazamaz; koşum başında boş alan kontrolü.
- **"Hosted ürün değil" sınırı aşınabilir.** Admin arayüzünden tetik, çok kullanıcı,
  kota — her biri bu tasarımın güvenlik varsayımını (tek kiracı) değiştirir. Şimdi
  hiçbiri yapılmıyor.

## 9. İş büyüklüğü ve sıra

| Adım | Çıktı | İş | Para |
|---|---|---|---|
| K0 Varsayımları ölç | İç ağda Claude Code'un hangi adreslere gittiği; SSE'nin proxy'den geçmesi; kök olmayan kullanıcı + izin modları; imajda talimat dosyası yok. Sahte anahtar + yerel yakalayıcı, dizüstünde Docker Desktop | S (~0.5 gün) | 0 |
| K1 Deneme imajı | Dockerfile: Node 22.20, pinli Claude Code, Python + Playwright (ayrı etiket), uid 1000, boş HOME, talimat dosyası denetimi derleme adımında | M (~1 gün) | 0 |
| K2 Konteyner worker'ı | `superviseAttempt` için konteyner başlatıcı: payload/sonuç bind mount, sınırlar, `docker kill`; kayda `platform` ve imaj özeti. Testler: öldürülen deneme `unknown`, yetim yok, ajan supervisor'u göremiyor | M–L (~1.5–2 gün) | 0 |
| K3 Kimlik proxy'si | Tek upstream, anahtar enjeksiyonu, SSE aktarımı, koşum başına sayaç ve tavan; iç ağ | M (~1 gün) | 0 |
| K4 Sunucu | VPS, Docker, güvenlik duvarı (yalnız SSH), sırlar, kalıcı disk, ölçüm deposu, `ASSAY_TOKEN` | S (~0.5 gün) | sunucu |
| K5 Tetik ve doğrulama | `assay-remote` (ssh + kilit + push + rsync); bilinen bir suite'i sunucuda koşup dizüstü sonucuyla karşılaştırmak (aralıklar kesişmeli, ortam hash'i bilerek farklı); `environment.memory` `[]`; yetim sıfır | S–M (~1 gün) | ~$5–10 |
| K6 Belgeler | sandbox-security (A1 ağ yarısı, A2, A3 yeniden değerlendirilir), README, bu dosya | S | 0 |

**Toplam ~5–6 gün kod, ~$5–10 doğrulama, ayda ~€7–17 sunucu.**

**Sıra ve gerekçesi.** K0 önce: yarım gün ve ücretsiz, tasarımın en belirsiz iki
varsayımını (dış adresler, proxy'den akış) planı büyütmeden ölçüyor. K1–K3 dizüstünde
Docker Desktop'la ve sahte anahtarla geliştirilip doğrulanabiliyor; sunucuya ancak
çalıştığı gösterilmiş bir şey taşınıyor. K4 geç, çünkü sunucu kiralamak geri
alınabilir ama boşa para. K5 ilk ve tek paralı adım.

**Makul alternatif:** önce yalnızca K1 + "koşum başına tek konteyner" (K2'nin yarısı),
dizüstünde, ~1.5 gün. CLAUDE.md, TEMP ve Windows arızalarını hemen kapatır; yetimler
ve runner'ın öldürülmesi kalır, token dizüstünde kalır. Önerilmiyor ama reddedilmedi:
acil bir ölçüm varsa ara adım olarak işe yarar.

## Açık kararlar (kullanıcının)

1. **API anahtarı mı, OAuth mu** — öneri API anahtarı, ayrı workspace, harcama tavanı.
2. **Sunucu** — sağlayıcı ve boyut; öneri 4 vCPU / 8 GB, production'dan ayrı.
3. **Konteynerde `bypassPermissions`** — konteyner sınır olunca izin modu artık
   sandbox'ın tek duvarı değil; kabuk isteyen skill'ler allowlist'siz ölçülebilir
   (0.2.0-c'nin alternatifi). Ama mod ortam hash'inde: varsayılanı değiştirmek bütün
   taban çizgilerini kaydırır. Öneri: varsayılan `acceptEdits` kalsın, suite başına
   bilinçli seçim.
4. **Gerçek pin 3** (6'daki fırsat) — ayrı bir adım olarak roadmap'e mi alınsın.
5. **Mevcut taban çizgileri** — sunucuda hangi suite'ler yeniden kurulsun (her biri
   bir koşum parası).
