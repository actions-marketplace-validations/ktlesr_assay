# Temiz koşum ortamı — plan

Durum: **K0, K1, K2 tamam; yerelde** (2026-09-13). Sunucu kararı K4'e ertelendi.
Kararlar ve K0–K2 sonuçları en altta.

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

## K0 sonuçları (2026-09-13)

Düzenek ve ham sayılar `tools/k0/`de (Dockerfile, sahte sunucular, kapasite
betiği, çözümleyici, `capacity-summary.json`, `capacity-samples.csv`).
Yerelde Docker Desktop (28.4.0; VM 24 CPU, 31 GB).

### Varsayımlar — ücretsiz, model çağrısı yok

Sahte bir Anthropic API (gerçek biçimde SSE dönen), bir kimlik proxy'si ve
bir çıkış günlükçüsü, dışarıya kapalı bir iç Docker ağında.

| Soru | Sonuç |
|---|---|
| İmajda talimat dosyası var mı | **Yok.** `find /` CLAUDE.md, CLAUDE.local.md, `.claude/` bulmadı; `/etc/claude-code` yok. HOME'da yalnızca kabuk dosyaları |
| Kök olmayan kullanıcı (uid 1000) | `acceptEdits` ve `bypassPermissions` ikisi de oturumu tamamladı |
| Kimlik proxy'si | Konteyner sahte anahtarla konuştu; upstream **yalnızca gerçek anahtarı** gördü; konteynerin ortamında gerçek anahtar yok |
| SSE proxy'den geçiyor mu | Evet — 6 parça, 300 ms'ye yayılmış (tamponlanmadı); dört varyasyonun dördü `result: ok` |
| Claude Code'un API dışı adresleri | Varsayılanda `api.anthropic.com:443`'e **5** CONNECT (zorunlu olmayan trafik). `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` ile **0**; model çağrısı base URL'ye gidiyor |
| 0.4.5'in ölçümü konteynerde | Yayımlanmış 0.4.5 kaydı `environment.memory: []` (ölçüldü, temiz) ile yazdı |

Tavan: çıkış günlükçüsü yalnızca `HTTPS_PROXY`'ye uyan trafiği görüyor. Uymayan
bir bağlantı iç ağda zaten dışarı çıkamıyor; oturumların dördü de tamamlandığı
için zorunlu bir çağrı bu yoldan gitmiyor.

### Tasarıma iki düzeltme

1. **Çıkış yalnızca Anthropic değil.** impeccable'ın ağır vakasında ajan
   `npm install`, vite ve Playwright çalıştırıyor (aşağıda). "Yalnız
   `api.anthropic.com`" diyen bir çıkış kuralı bu vakayı ölçemez hâle getirir;
   ajanın çıkışı bir izin listesinden (npm registry vb.) geçmeli. Kimlik yine
   yalnızca proxy'de; değişen, proxy'nin tek çıkış değil **tek kimlikli çıkış**
   olması.
2. **Playwright'ın tarayıcısı imajda.** Yoksa ajanın her `npx playwright`'ı ~150 MB
   indirir; imaj Chromium'la 0.67 GB.
   *Düzeltme (K1):* K0'ın imajındaki tarayıcı ajana hiç ulaşmadı. `/opt`'a
   `PLAYWRIGHT_BROWSERS_PATH` ile kurulmuştu ve adaptörün ortam allowlist'i bu
   değişkeni geçirmiyor; üstelik ajan npm'deki son sürümü (1.63.0) kurdu, imajdaki
   1.55.0'dı. p2-1'in izinde `chromium_headless_shell-1243` bulunamadı ve ajan
   `npx playwright install chromium` ile indirdi. Aşağıdaki tablo bu indirmeyi de
   içeriyor.

### Kapasite — gerçek koşum

impeccable'dan iki vaka (en ağır tetiklenme vakası `hero_direction` +
negatif `slow_query`), `bypassPermissions` (en kötü durum), 1, 2 ve 4 paralel
konteyner, her konteynerde bir ağır + bir hafif deneme; `docker stats` ~2 sn'de
bir. **14 denemenin 14'ü geçti, hepsi `environment.memory: []`.** Abonelik
token'ıyla, nominal **$1.47** (K0'a özgü: token `--env-file` ile konteynere
verildi, proxy'siz — tasarımın hedefi değil). Kayıtlar yüklenmedi.

| P | Duvar | Toplam CPU zirve / p95 / medyan | Toplam bellek zirve |
|---|---|---|---|
| 1 | 170 sn | 1,19 / 0,71 / 0,03 çekirdek | 684 MiB |
| 2 | 317 sn | 1,37 / 0,52 / 0,04 çekirdek | 998 MiB |
| 4 | 128 sn | 1,11 / 1,02 / 0,10 çekirdek | 1.314 MiB |

Ağır denemenin kendisi iki ayrı şey olabiliyor:

| Ajan ne yaptı | Deneme | Bellek zirve | CPU zirve | Disk (yazılabilir katman) | Süreç | Süre | Maliyet |
|---|---|---|---|---|---|---|---|
| Neredeyse hiçbir şey (1 Bash) | p2-0, p4-3 | 212–225 MiB | 0,05 | 2–3 MB | 41–43 | 53–88 sn | $0.07–0.13 |
| `npm install` + vite + Playwright | p1-0, p4-0/1/2 | 433–684 MiB | 0,75–1,19 | 120–919 MB | 68–107 | 92–161 sn | $0.13–0.18 |
| Aynısı, uzun (54 Bash, 22 Playwright) | p2-1 | **998 MiB** | **1,37** | **938 MB** | **212** | 306 sn | $0.47 |

Okuma:
- **Model bekleniyor, makine değil.** Medyan CPU konteyner başına ~%3–10; süreyi
  API belirliyor. P=4'ün duvar saati P=1'inkinden kısa (denemeler daha hafif çıktı).
- **Konteyner başına tavan ≈ 1 GB bellek, ~1,4 çekirdek kısa patlama, ~1 GB geçici
  disk, ~200 süreç.** Geçici disk konteynerle birlikte siliniyor.
- **4 paralel en kötü durum (hepsi p2-1 gibi): ~4 GB bellek, patlamada ~5–6 çekirdek,
  ~4 GB geçici disk.** Gözlenen gerçek P=4: 1,3 GB, ~1,1 çekirdek.
- **Bu makinede ihtiyaç VM'in %5'inin altında** (31 GB'ın ~1,3'ü, 24 çekirdeğin ~1'i).

Tavan: 7 ağır deneme küçük bir örnek ve varyans büyük (53–306 sn, $0.07–0.47).
Örnekleme ~2 sn; daha kısa patlamalar kaçmış olabilir. CPU hızlı bir masaüstünde
ölçüldü; daha yavaş bir VPS'te patlamalar uzar, düşmez.

### Sunucu kararı için sayılar

| Seçenek | Karşılıyor mu |
|---|---|
| Bu makine, yerelde | Fazlasıyla: en kötü P=4 bile VM'in küçük bir kısmı. Kalan tek eksik, token'ın dizüstünde durması (bugünkü gibi) |
| 2 vCPU / 4 GB VPS | P=2 rahat; P=4 tipik yükte olur, en kötü durumda sınırda |
| 4 vCPU / 8 GB VPS | P=4 en kötü durumda da payla |
| Disk | İmaj ~2 GB (sanal), deneme başına ≤1 GB geçici, kayıtlar MB'larca: 20 GB yeter |

## Kararlar (2026-09-13)

1. **Kimlik: API anahtarı**, ayrı bir Console workspace'inde, harcama tavanıyla.
2. **Sunucu: ertelendi.** K0'ın kapasite sayılarına göre karar verilecek; ihtiyaç
   makul değilse yerelde devam edilir ve sunucu alınmaz. Sayılar yukarıda.
3. **İzin modu: `acceptEdits` varsayılan kalıyor**, suite başına bilinçli seçim.
4. **Gerçek pin 3 roadmap'te, K5'ten sonra** (K7).
5. **Yeniden kurulacak taban çizgileri: marketingskills v3 ve impeccable 4.2.2.**
   Diğerleri kapandı.
6. **Yerelde devam; sunucu kararı K4'e.** 4 paralel en kötü durum ~4 GB, bu
   makinede 31 GB var; sunucu şu an bir sorun çözmüyor.

## K1 sonuçları (2026-09-13)

Dosyalar `tools/runner-env/`de: `Dockerfile` (iki hedef: `attempt`, `egress`),
`egress.mjs` (izin listesi proxy'si), `check-instructions.sh`, `verify.mjs`
(düzeneği kurup dokuz kontrolü koşan, ücretsiz betik), `egress.test.ts`.

```
docker build -t assay-egress --target egress tools/runner-env
docker build -t assay-attempt tools/runner-env
node tools/runner-env/verify.mjs
```

### İmaj

| | |
|---|---|
| Taban | `node:22.20.0-bookworm-slim`, **özetle pinli** (etiket Debian güncellemeleriyle yeniden derleniyor) |
| İçerik | Claude Code 2.1.270, `@ktlsr/assay` 0.4.5, Playwright 1.63.0'ın Chromium'u (`chromium-1243` + `chromium_headless_shell-1243`, 658 MB), git 2.39, Python 3.11, curl, procps. Sürümler `ARG`, varsayılanları pinli |
| Kullanıcı | `node`, uid 1000. HOME'da yalnızca `.cache/ms-playwright`; kabuk başlangıç dosyaları silindi |
| Host denetimi | `claude --version` derleme adımında koşuyor: npm 12 install script'lerini varsayılan olarak engelliyor ve host'un ikilisi bir `postinstall`dan geliyor. Engellenirse imaj derlenmiyor |
| Talimat denetimi | `assay-check-instructions` derleme adımında koşuyor; bütün dosya sisteminde `CLAUDE.md`, `CLAUDE.local.md`, `.claude`, `/etc/claude-code` arıyor. İmajda boş |
| Boyut | `assay-attempt` 2,28 GB, `assay-egress` 326 MB (açılmış) |
| Özet (bu makinede) | `assay-attempt` `sha256:65c39ca0…bb3c5`. Her yeniden derlemede değişir; kayda giren değer koşum anındaki özet (K2) |

**Tarayıcı neden HOME'da.** Adaptörün ortam allowlist'i `PLAYWRIGHT_BROWSERS_PATH`'i
ajana geçirmiyor, bu yüzden tarayıcı Playwright'ın varsayılan yolunda. Plan "boş
HOME, deneme başına tmpfs" diyordu; ikisinin amacı talimat dosyası ve denemeler
arası kalıntıydı. Deneme başına konteyner zaten her denemeyi imajdaki HOME'la
başlatıyor, tarayıcı da talimat değil. Denetim bu yüzden "HOME boş" değil "imajda
talimat yok" diye soruyor.

**Playwright sürümü neden 1.63.0.** Ajan `npm install playwright` yazıyor ve o günün
son sürümünü alıyor; tarayıcı revizyonu o sürümle aynı değilse indiriyor. npm'deki
sürüm ilerledikçe indirme geri gelir. İzinli (`cdn.playwright.dev`) ama yavaş, ve
imajı yükseltme işareti.

### Çıkış izin listesi

Deneme konteyneri `internal: true` bir ağda; tek komşusu çıkış proxy'si, proxy
dışa da bağlı. Konteynere `HTTPS_PROXY=http://<egress>:3128`. Proxy yalnızca
`CONNECT <ad>:443` kabul ediyor ve adın listede birebir olmasını istiyor:
`registry.npmjs.org`, `cdn.playwright.dev`, `playwright.download.prss.microsoft.com`
(Playwright 1.63.0'ın ayna listesi, kaynağından). Düz HTTP ile proxy'lenen her istek 403.

İzin listesini **ağ** zorluyor, istemcinin iyi niyeti değil: proxy'ye uymayan bir
bağlantı (Node'un kendi `fetch`'i, ham soket, doğrudan IP) iç ağdan çıkamıyor.

| Kontrol (`verify.mjs`) | Sonuç |
|---|---|
| Dış adlar çözülüyor mu (DNS kanalı) | Hayır — Docker'ın gömülü DNS'i iç ağda yalnızca konteyner adlarını çözüyor |
| Proxy'siz çıkış, ada ve çıplak IP'ye | Yok |
| npm registry ve Playwright CDN proxy üzerinden | Geçiyor |
| Başka bir ad, `api.anthropic.com` dahil | Proxy 403 veriyor |
| Fixture'ın `npm install`'ı (vite 6, react 19; esbuild ve rollup'ın platform paketleri) + `playwright@1.63.0` + Chromium başlatma | Geçiyor; **hiçbir tarayıcı indirilmedi** (proxy'nin gördüğü tek `cdn.playwright.dev` bağlantısı curl kontrolününki) |
| `assay run` proxy arkasında, sahte API ile | İki deneme tamamlandı, `environment.memory: []` |

Proxy'nin bir koşumda gördüğü: 19 izinli `registry.npmjs.org`, 1 izinli
`cdn.playwright.dev`, 11 reddedilen `api.anthropic.com` (Claude Code'un zorunlu
olmayan trafiği, aşağıda), 1 reddedilen `example.com`.

**Ters çevirme.** Birim testi (`allows`): port kontrolü yok, sonek eşleşmesi,
alt dize eşleşmesi, her şeye izin, büyük/küçük harf duyarlı — beşi de kırmızı.
Düzenek: her şeye izin veren proxy → "başka ad reddedildi", "api.anthropic.com
reddedildi" ve "listede olmayan izinli hedef" kırmızı; iç olmayan ağ → DNS ve iki
"proxy'siz çıkış yok" kırmızı; tarayıcısız HOME → başlatma kırmızı. Talimat
denetimi: beş yola bırakılan dosyanın beşinde ve derleme adımında düşüyor.

### K2'ye taşınan bulgular

1. **`NO_PROXY=<kimlik proxy'si>` şart.** Claude Code `http://` bir
   `ANTHROPIC_BASE_URL`'yi de `HTTPS_PROXY`'ye gönderiyor; ilk koşumda çıkış proxy'si
   model çağrısını reddetti ve iki deneme `unknown` oldu (doğru cevap: ölçülmedi).
   `NO_PROXY` adaptörün allowlist'inde, konteynere verilmesi yetiyor.
2. **Zorunlu olmayan trafik kapanmıyor.** `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`
   adaptörün allowlist'inde değil; imaja koymak ajana ulaşmazdı, konmadı. Çağrılar
   proxy'de reddediliyor ve oturumu bozmuyor (K0'da da bozmadı). Allowlist'e
   eklenirse günlükteki gürültü gider; kayda etkisi yok, ayrı ve küçük bir karar.
3. **İzin listesi bir ölçüm koşulu.** Hangi adreslerin açık olduğu ajanın ne
   yapabildiğini değiştiriyor; imaj özetiyle birlikte kayda ve ortam hash'ine
   girmeli.

### Tavanlar

- Proxy ada göre süzüyor, içeriğe bakmıyor. İzinli bir adrese giden istek veri
  taşıyabilir (ör. registry'ye bir paket adı olarak). Karşılığı konteynerde
  sızdırılacak sır olmaması: gerçek anahtar yalnızca kimlik proxy'sinde (K3).
- Kurulumu listede olmayan bir adrese giden paket (GitHub'dan ikili indiren
  postinstall betikleri) kurulamaz; o vakanın denemesi bundan etkilenir. Liste
  büyütülebilir; suite başına genişletme vaka setinde beyan edilmeli (0.2.0-c ile
  aynı ilke).
- Python'un Playwright'ı imajda yok (planda "ayrı etiket"). Yeniden kurulacak iki
  taban çizgisi (marketingskills v3, impeccable) gerektirmiyor; webapp-testing
  ölçülürken eklenir.

## K2 sonuçları (2026-09-13)

`assay run <suite> --skill <dir> --container assay-attempt --container-api <ad:port>`.
Kod `packages/runner/src/container.ts`; supervisor'un sonuç dosyası sözleşmesi,
zaman aşımı ve gerekçe cümleleri değişmedi, yalnızca başlatma (`docker run`) ve
kapatma (`docker rm -f`) konteynere geçti.

### Düzen

| | |
|---|---|
| Koşum başına | `internal: true` bir ağ; çıkış proxy'si **aynı imajdan** (`node /opt/assay/egress.mjs`, dışa da bağlı); `--container-api` ile verilen API konteyneri (kimlik proxy'si) ağa bağlanıyor. Koşum bitince üçü de kalkıyor |
| Deneme başına | `docker run --rm --init`, `--user node`, `--cap-drop ALL`, `no-new-privileges`, bellek 2 GB (takassız), 2 çekirdek, 512 süreç; imaj **özetle** koşuyor. `timeout -s KILL` supervisor ölse bile konteyneri zaman aşımı + 60 sn'de kapatıyor |
| Ortam | `HTTPS_PROXY` (çıkış), `NO_PROXY` (API konteyneri), `ANTHROPIC_BASE_URL`, yer tutucu `ANTHROPIC_API_KEY`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`. Ana makinenin hiçbir değişkeni geçmiyor |
| Bağlamalar | giriş/çıkış dizini (tek yazılabilir), skill kopyası, fixture, ve **Assay'in kodu**: runner, core ve adaptörün `dist` + `package.json`'ı, salt okunur |
| Kayıt | `environment.container = { image, platform, egress, limits }`; ortam hash'i adaptörün hash'i + bu kayıttan. İzin listesi runner'ın verdiği değil, proxy'nin başlarken **kendi bildirdiği** liste; ayrışırsa koşum başlamıyor |

**Assay'in kodu neden imajda değil.** İmajda paketlenmiş bir sürüm, ana
makinedeki runner'dan farklı olabilirdi (geliştirilen bir sürüm, eski bir imaj)
ve sürüm numarası bunu ayırmıyor: yayımlanmamış kod da `0.4.5` diyor. `dist`i
bağlamak kodu yapısı gereği aynı tutuyor. İmaj yalnızca üçüncü taraf bağımlılıkları
(ajv 8.20.0, yaml 2.9.0, zod 4.5.4 — kilit dosyasındaki sürümler) taşıyor.
`node_modules` bağlanmıyor: pnpm'in Windows bağlantıları Linux'ta çözülmüyor.
K1'in ayrı `egress` imajı kaldırıldı; proxy'nin kodu artık kayda giren imaj
özetinin içinde. İmajdaki global `@ktlsr/assay` da kaldırıldı.

**Dizüstü kayıtları değişmedi.** `container` yalnızca konteyner koşumunda
yazılıyor; ana makinede koşan kayıtların hash'i aynı kaldı ve 0.4.5 kayıtlarıyla
karşılaştırılmaya devam ediyor. Platform ayrıca yalnızca konteyner kaydında.

### K1'in üç bulgusu

1. **`NO_PROXY`** — konteyner ortamında API konteynerinin adı; model çağrısı
   çıkış proxy'sine gitmiyor.
2. **`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`** — adaptörün ortam allowlist'inde;
   konteynerde runner `1` veriyor. Çıkış günlüğünde `api.anthropic.com` bağlantısı 0
   (K1'de iki oturumda 11 reddedilen bağlantı vardı).
3. **İzin listesi ve imaj özeti kayıtta ve hash'te** — `compare` konteyner
   koşumunu dizüstü koşumuyla karşılaştırmıyor ve sebebi adıyla söylüyor:
   `container: none (a process on the host) → sha256:… linux/amd64; egress …`.

### Doğrulama (`node tools/runner-env/verify.mjs`, 34 kontrol, ücretsiz)

K1'in kontrolleri, `--cap-drop ALL` ile Chromium başlatması dahil, yeni imajla
tekrar geçti. K2, runner'ın kendi kurduğu düzende:

| Kontrol | Sonuç |
|---|---|
| Konteynerin içinden görülen süreçler | `docker-init, timeout, node, sh, ps` — supervisor ve ana makine yok |
| Kullanıcı / anahtar / ortam | uid 1000; yalnızca yer tutucu anahtar, OAuth yok; 11 değişken, ana makineninki yok |
| Ağ | dış ad çözülmüyor, doğrudan çıkış yok, registry proxy'den 200, başka adres 403, `host.docker.internal` erişilemez |
| Çalışma dizini | `/tmp/assay-attempt-…` (ev dizini dışında) |
| Ajan worker'ı öldürüyor | deneme `unknown`: "killed by SIGKILL inside its container … the measured agent runs as the same user" |
| Zaman aşımı | deneme `unknown`, konteyner kapatıldı |
| Yetim süreç başlatan deneme | tamamlandı; koşum sonrası konteyner, çıkış proxy'si ve ağ kalmadı |
| Kayıt | `container.image` = `docker image inspect` özeti, `linux/amd64`, üç adres, sınırlar; ortam hash'i ana makinenin hash'inden farklı |
| Gerçek Claude Code, sahte API | iki oturum tamamlandı; `environment.memory: []`; kimlik proxy'si yalnızca yer tutucuyu gördü ve anahtarı kendisi ekledi |
| CLI | `--container` koşumu terminalde `container sha256:…` satırı; `compare` exit 3 ve konteyneri adıyla; `--container-api` olmadan kullanım hatası |

Sahte API K0'ın sunucusu (kimlik proxy'si + sahte Anthropic); K3'ün kimlik
proxy'si aynı yere oturacak.

**Ters çevirme.** Birim: on iki mutasyon (hash konteyneri yok sayıyor, `NO_PROXY`
yok, yetkiler bırakılmış, skill yazılabilir, sonuç yolu ana makinede, ana makinenin
anahtarı geçiyor, adaptör yanlış bağlanıyor, fark konteyneri görmüyor, etiket boş,
eski fixture çözümü, allowlist değişkeni yok, `withContainer` boş) — üçü ilk
biçimiyle derlemeyi bozdu ve geçersiz sayıldı, tip-geçerli biçimleriyle on ikisi de
kendi testinde kırmızı. Uçtan uca dört mutasyon `verify.mjs`'de kırmızı:
`NO_PROXY` yok → iki oturum `unknown`; allowlist değişkeni yok → çıkış günlüğünde
yine `api.anthropic.com`; ağ iç değil → DNS, doğrudan çıkış **ve ana makinedeki
geliştirme sunucusu** (`host.docker.internal:3100`) açık; konteyner koşulu kayda
işlenmiyor → beş kontrol, `compare` dahil.

### Tavanlar

- **Ajan worker'la aynı kullanıcı.** Worker'ı öldürebiliyor (→ `unknown`) ve sonuç
  dosyasına yazabiliyor; ikincisi ana makinede de mümkündü, burada da gözlenmiyor.
  Yükseltme yolu ajanı ayrı bir kullanıcıyla başlatmak.
- **Supervisor ölürse** deneme konteyneri en geç zaman aşımı + 60 sn'de kalkıyor; ağ
  ve çıkış proxy'si elle temizliğe kalıyor (`docker rm -f assay-egress-…`,
  `docker network rm assay-net-…`).
- **Çıkış proxy'si koşum başına tek.** Günlüğü denemeye göre ayrılmıyor; ağ yan
  etkisini kayda denemeye göre yazmak ayrı bir iş.
- **Gerçek bir koşum K3'ü bekliyor.** Kimlik proxy'si yok; `--container-api` bugün
  yalnızca doğrulamanın sahte sunucusuna ya da elle kurulmuş bir proxy'ye
  bağlanabilir. Gerçek anahtar hiçbir yoldan konteynere verilmiyor.
- Web koşum sayfası `environment.container`ı henüz göstermiyor; kayıt taşıyor ve
  `compare` kullanıyor. İlk gerçek konteyner koşumuyla (K5) eklenir.
