# Host Fizibilite Raporu

**Tarih:** 2026-08-31 · **Adım:** 0.6 · **Amaç:** Assay'in gerçekte neyi
kanıtlayabileceğini belirlemek. Bu raporun sonundaki değerlendirme Faz 1'e
geçilip geçilmeyeceğini belirler.

Bu bir mühendislik raporudur. Deneyle görülen ile belgeden okunan ayrı ayrı
işaretlenmiştir. Doğrulanamayan her iddia **DOĞRULANMADI** etiketi taşır.

---

## Matris

| Host | Skill discovery | Trigger observable | Tool trace | Completion | Genel |
|---|---|---|---|---|---|
| **Claude Code** | Evet — **yüksek** ✅ deneyle | Kısmen — **yüksek** (model seçtiğinde) ✅ deneyle | Evet — **yüksek** ✅ deneyle | Evet — **yüksek**, çapraz kontrolle ✅ deneyle | **Ölçülebilir** |
| **OpenAI Codex** | Evet ama **izole edilemiyor** — düşük ✅ deneyle | **Yalnızca metinden çıkarım** — düşük ✅ deneyle | Evet — **orta** ✅ deneyle | Evet — **orta** ✅ deneyle | **Tetiklenme ölçülemez** |
| **GitHub Copilot** | Evet — **orta** 📄 belge | Kısmen — **düşük** 📄 belge | Kısmen — **düşük** 📄 belge | Kısmen — **düşük** 📄 belge | **Belirsiz, doğrulanmadı** |

✅ = bu makinede deneyle görüldü · 📄 = yalnızca belgeden okundu, **DOĞRULANMADI**

---

## Claude Code — deneyle doğrulandı

**Sürüm:** 2.1.251 · **Yöntem:** Tek kullanımlık bir plugin (`assay-probe`)
yazıldı, `--plugin-dir` ile oturuma yüklendi, `claude -p --output-format
stream-json --verbose` ile üç koşum yapıldı ve çıktı incelendi. Ayrıca bu
makinedeki 245 gerçek oturum transkripti (`~/.claude/projects/**/*.jsonl`)
tarandı.

### A. Skill discovery — Evet, güvenilirlik **yüksek** ✅

Koşumun ilk olayı `system/init` ve aktif kurulumun tamamını taşıyor:

```json
{ "type": "system", "subtype": "init",
  "session_id": "...", "cwd": "...", "model": "claude-haiku-4-5-20251001",
  "permissionMode": "dontAsk", "claude_code_version": "2.1.251",
  "tools": [27 ad], "skills": [119 ad], "agents": [10 ad],
  "plugins": [{ "name": "assay-probe", "path": "...", "source": "assay-probe@inline", "version": "0.0.1" }],
  "memory_paths": { "auto": "..." } }
```

Kontrol kaldıraçları da var ve çalışıyor:

| Kaldıraç | Ne yapar | Durum |
|---|---|---|
| `--plugin-dir <path>` | Skill'i yalnızca bu oturuma yükler | ✅ doğrulandı — `plugins` listesinde `assay-probe@inline` göründü |
| `CLAUDE_CONFIG_DIR=<temiz dizin>` | Kullanıcının global skill'lerini devre dışı bırakır | ✅ doğrulandı — skill sayısı **119 → 19**'a düştü, `plugins` yalnızca `assay-probe`. **Kullanıcının CLAUDE.md'sini kesmez** (2026-09-13): host çalışma dizininin üst dizinlerinde de talimat arıyor; Windows'ta `%TEMP%` ev altında. 0.4.5'te üst dizinler `claudeMdExcludes` ile dışlanıyor ve yüklenen dosyalar `InstructionsLoaded` kancasıyla ölçülüyor |
| `--disable-slash-commands` | Tüm skill'leri kapatır | 📄 belgeden |
| `--bare` | Plugin sync, CLAUDE.md keşfi, auto-memory kapalı | ⚠️ **ANTHROPIC_API_KEY gerektirir** (aşağıya bakınız) |

**Bulgu:** Assay'in dört pininden birini (aktif skill seti) *ölçebilmek* değil,
*kontrol edebilmek* gerekiyor ve bu mümkün. Bu, coexistence testinin şemada
bugün yer almasını da haklı çıkarıyor.

### B. Trigger observability — Kısmen, güvenilirlik **yüksek** ✅

İki farklı çağrı yolu var ve **yalnızca biri gözlenebilir:**

**1. Model kendi seçtiğinde → açık `Skill` tool_use.** Gerçek transkriptlerden
(12 dosyada bulundu):

```json
{ "type": "tool_use", "id": "toolu_016jYvaCUg3W1FX6vvCDVbWQ",
  "name": "Skill",
  "input": { "skill": "frontend-design", "args": "..." } }
```

Skill kimliği `input.skill` alanında, metinden çıkarım yok, belirsizlik yok.
**Assay'in ölçmek istediği tam olarak bu yol** — tetiklenme doğruluğu, modelin
seçim yapmasıyla ilgilidir.

**2. Kullanıcı `/skill-adı` yazdığında → `Skill` tool_use YOK.** ✅ deneyle:
`claude -p "/assay-probe"` koşumu skill'in gövdesini çalıştırdı
(`ASSAY_PROBE_FIRED` çıktısı geldi) ama akışta hiç `tool_use` görünmedi. CLI
slash komutunu kendisi çözüyor ve skill içeriğini bağlama enjekte ediyor.

**Sonuç:** Assay tetiklenmeyi model seçtiğinde güvenilir okur; kullanıcının
elle çağırdığı yolu okuyamaz. Bu bir kısıt değil, doğru davranış — elle
çağrılan bir skill'in "tetiklenme doğruluğu" diye bir ölçüsü yoktur.

**DOĞRULANMADI:** Bir skill'in içeriğinin `Skill` tool_use olmadan otomatik
enjekte edildiği üçüncü bir yol olup olmadığını kanıtlayamadım. Yokluğu
kanıtlanamaz; adaptör bu ihtimale karşı `complete: false` bildirmelidir.

### C. Structured trace — Evet, güvenilirlik **yüksek** ✅

`stream-json` akışı ve disk transkripti aynı yapıyı taşıyor:

- `tool_use` blokları: `id`, `name`, `input` (tam argümanlar)
- `tool_result` blokları: `is_error: true|false`, `content`
- `assistant` mesajları: `thinking` ve `text` blokları ayrı ayrı
- `system/hook_started`, `hook_response` olayları (`--include-hook-events`)

Bu makinedeki tek bir gerçek oturumda **21 adet `is_error: true`** tool_result
bulundu. `no_swallowed_errors` ölçümünün ihtiyaç duyduğu ham sinyal mevcut:
hata olayı, hatadan sonraki asistan mesajları, ve oturum sonu.

Metin parse etmek gerekmiyor. Bu, Assay'in `TraceEvent` tipine doğrudan
eşleniyor.

### D. Completion signal — Evet, güvenilirlik **yüksek** (çapraz kontrolle) ✅

Akışın son olayı `result`:

```json
{ "type": "result", "subtype": "success", "is_error": false,
  "num_turns": 1, "stop_reason": "end_turn", "terminal_reason": "completed",
  "duration_ms": 217826, "total_cost_usd": 0.048094,
  "usage": { "input_tokens": 10, "output_tokens": 210,
             "cache_creation_input_tokens": 23517, ... },
  "permission_denials": [], "session_id": "..." }
```

Maliyet ve gecikme katmanı bedavaya geliyor: `total_cost_usd`, `duration_ms`,
`usage`.

**Ama tek bir alana güvenilemez — kritik bulgu ⚠️**

`CLAUDE_CONFIG_DIR` deneyinde koşum kimlik doğrulaması olmadan başladı.
Ham `result` olayı (fixture: `packages/adapters/src/__fixtures__/not-logged-in.jsonl`):

```json
{ "subtype": "success", "is_error": true, "num_turns": 1,
  "terminal_reason": "api_error", "total_cost_usd": 0,
  "usage": { "output_tokens": 0 },
  "result": "Not logged in · Please run /login" }
```

**`subtype` "success" diyor ama koşum hiç gerçekleşmedi.** Alan adı, taşıdığı
anlamı taşımıyor: burada "istek başarıyla sonuçlandı" değil, "akış normal
kapandı" demek.

**Düzeltme:** Bu raporun ilk sürümü `is_error: false` yazıyordu. Yanlıştı —
ham veri `is_error: true` ve `terminal_reason: "api_error"` diyor. İlk sürüm
özet bir çıktıya bakıp `is_error`'ı doğrulamadan iddia etmişti. Host göründüğü
kadar iyimser değil: `subtype` yanıltıcı, `is_error` ve `terminal_reason`
doğru.

Bunun sonucu değişmiyor: adaptör tek alana güvenemez, çapraz kontrol şart:

- `is_error === true` → koşum başarısız
- `num_turns === 0` → hiçbir şey koşmadı
- `usage.output_tokens === 0` → ajan hiç üretmedi
- `terminal_reason !== 'completed'` → oturum normal bitmedi

Dördü `ClaudeCodeAdapter.sessionProblem` içinde uygulandı (1.1). Biri tutarsa
tetiklenme sinyali `available: false` döner — "tetiklenmedi" ile
karıştırılmaz.

### Ek bulgular

**Skill seti kirliliği ölçümü bozuyor — pratikte en büyük engel.** İzole
edilmemiş bir koşumda 119 skill aktifti. `assay-probe` doğal dille
tetiklenmedi; model işi doğrudan yaptı ve komşu bir skill'in aracına
(`Artifact`) uzandı. Temiz `CLAUDE_CONFIG_DIR` ile skill sayısı 19'a düştü.
**Assay her koşumu izole bir config dizininde yürütmek zorunda**, yoksa
ölçtüğü şey skill değil, kullanıcının kurulumudur.

**Pin 3 (sistem promptu hash'i) doğrudan verilmiyor.** `init` mesajı `model`,
`claude_code_version`, `tools`, `skills`, `agents`, `plugins` ve `output_style`
veriyor; sistem promptunun kendisini veya hash'ini vermiyor. Adaptör bu
alanlardan türetilmiş bir *ortam hash'i* hesaplayabilir — ama bu sistem
promptu hash'i değildir ve öyle etiketlenmemelidir.

**Windows tuzağı:** Git Bash `/assay-probe` argümanını
`C:/Program Files/Git/assay-probe` yoluna çeviriyor (MSYS yol dönüşümü).
Adaptör süreçleri doğrudan spawn etmeli, kabuk üzerinden değil.

---

## ⚠️ Rekabet bulgusu: `claude plugin eval`

Spike sırasında beklenmedik bir şey çıktı ve raporun en önemli parçası bu.

**Anthropic, Claude Code ile birlikte birinci taraf bir skill/plugin eval
koşucusu dağıtıyor:** `claude plugin eval`.

```
claude plugin eval [target]
  Run eval cases (<eval dir>/**/case.yaml or prompt.md + graders/*.md)
  against a plugin and report scored results.
```

Yetenekleri (`--help` çıktısından, ✅ deneyle okundu):

| Yetenek | `claude plugin eval` | Assay Faz 1 planı |
|---|---|---|
| Vaka dosyası | `case.yaml` + `graders/*.md` | `suite.yaml` |
| Tekrar | `--runs`, varsayılan **3** | varsayılan ≥ 2 |
| Tetiklenme ölçümü | `--ablation with-without`, `tool_used: Skill` grader'ı "plugin-fired indicator" | tetiklenme suite'i |
| Skorlama | **LLM judge** (`--judge-model`, varsayılan haiku) | LLM judge **yok** |
| CI eşiği | `--threshold`, exit 1 | exit code |
| Rapor | self-contained HTML, claude.ai'a yayımlama | HTML + terminal |
| Maliyet tavanı | `--max-cost-usd` | maliyet katmanı |
| MCP mock'ları | `--mocks record\|off` | yok |
| Vaka yazma yardımı | `claude plugin eval init` (röportaj) | yok |

Bu, Assay'in Faz 1 kapsamının büyük kısmıyla **doğrudan örtüşüyor** — Claude
Code için. Kötü haberi yumuşatmıyorum: "Claude Code skill'lerimi CI'da test
etmek istiyorum" diyen bir kullanıcının bugün ücretsiz ve birinci taraf bir
cevabı var.

### Assay'in ayakta kalan farkları

Bunlar analizle çıkarıldı, kullanıcıyla doğrulanmadı — **pazar iddiası olarak
DOĞRULANMADI:**

1. **Vendor-bağımsızlık.** `claude plugin eval` yalnızca Claude Code'u koşar.
   Agent Skills açık bir standart ve Codex ile Copilot da destekliyor. Aynı
   skill'in üç host altında aynı davranıp davranmadığını ölçen kimse yok.
2. **Judge yok.** `claude plugin eval` skorlamayı bir LLM'e yaptırıyor.
   Kararsızlık ölçen bir aracın kendisinin kararsız olması, bu raporda
   `no_swallowed_errors` için verdiğimiz kararın tam tersi. Deterministik
   skorlama gerçek bir farklılaşma.
3. **Üç durumlu verdict.** `--threshold` skoru ikili bir kapıdan geçiriyor.
   Yukarıdaki "not logged in ama success" bulgusu, ölçülemeyen koşumun
   ölçülmüş sayılmasının ne kadar kolay olduğunu gösteriyor.
4. **Hafıza.** Eval koşucusu tek koşumu bilir. Regresyon, pin kayması ve
   zaman içindeki eğilim hosted katmanın konusu.
5. **`no_swallowed_errors`.** Grader listesinde bir muadili görülmedi.

### Bunun anlamı

Assay'in konumlandırması **"Claude Code skill'leri için test koşucusu"
olamaz** — o boşluk doldu. Ayakta kalabilecek konumlandırma:

> **Agent Skills için vendor-bağımsız, deterministik regresyon koşucusu.**

Yani rakip `claude plugin eval` değil, onun *kapsamadığı* soru: "bu skill
Codex'te ve Copilot'ta da çalışıyor mu, ve geçen aya göre bir şey bozuldu mu?"

---

## OpenAI Codex — deneyle doğrulandı

**Sürüm:** codex-cli 0.151.0 · **Yöntem:** CLI kuruldu, aynı `assay-probe`
skill'i `.agents/skills/` altına konuldu, `codex exec --json` ile iki koşum
yapıldı (`CODEX_API_KEY` ile kimlik doğrulandı).

Bu bölüm 0.6'da belgeden yazılmıştı; artık deneyle yeniden yazıldı ve
**değerlendirme aşağı çekildi.**

### Olay akışı — orta ✅

`codex exec --json` JSONL yayıyor ve yapı temiz:

```json
{"type":"thread.started","thread_id":"01a0588f-..."}
{"type":"turn.started"}
{"type":"item.completed","item":{"id":"item_0","type":"error","message":"..."}}
{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"..."}}
{"type":"turn.completed","usage":{"input_tokens":75904,"cached_input_tokens":56363,
  "output_tokens":781,"reasoning_output_tokens":228}}
```

`error` birinci sınıf bir item tipi, `turn.completed` token kullanımını
taşıyor. Araç izi ve tamamlama sinyali için yeterli.

### Tetiklenme — düşük ✅, **yapısal sinyal yok**

Skill'in seçildiğine dair tek kanıt, asistan mesajının **serbest metni**:

> "I'm using the `assay-probe` skill because this request maps directly to its
> widget-manifest workflow."

`Skill` diye bir item tipi, `skill_activated` diye bir olay, `item` üzerinde
bir `skill` alanı **yok**. Assay'in Claude Code'da `input.skill` alanından
belirsizlik olmadan okuduğu şey, Codex'te ancak metinden çıkarımla elde
edilebilir — ve model bunu söylemek zorunda değil, söylerken yanılabilir,
sürüm değiştiğinde ifade değişebilir.

Bu, 0.6'da "düşük, doğrulanmadı" diye tahmin edilen şeyin deneyle
doğrulanmasıdır. Tahmin doğruydu.

### Skill seti izole edilemiyor — **durdurucu** ✅

İki koşumda da:

```
ERROR codex_skills_extension::loader::host: skills scan reached its traversal
limit (root: file:///C:/Users/KESER/.agents/skills)

{"type":"error","message":"Exceeded skills context budget. All skill
descriptions were removed and 1235 additional skills were not included in
the model-visible skills list."}
```

**1235 skill** kullanıcı dizininden yüklendi, bağlam bütçesi aştı ve
**bütün skill açıklamaları kaldırıldı.** Yani model, skill'lerin ne yaptığını
görmeden seçim yapmak zorunda kaldı — tetiklenme doğruluğu ölçümünün öncülü
çöktü.

`CODEX_HOME` yalnızca config dizinini izole ediyor; kullanıcı seviyesindeki
`~/.agents/skills` etkilenmiyor. `USERPROFILE` ve `HOME` ortam değişkenlerini
geçici bir dizine çevirmeyi denedim — **işe yaramadı**, Codex yine gerçek
kullanıcı profilinden taradı. `--ignore-user-config` config.toml'u atlıyor,
skill dizinini değil.

Claude Code'un `--plugin-dir` + `CLAUDE_CONFIG_DIR` ikilisinin karşılığı
Codex'te yok. `codex plugin` alt komutu marketplace kurulumu yapıyor,
oturuma özel yükleme değil.

### Ek: Windows'ta skill gövdesi yüklenemedi

Codex, SKILL.md'yi bağlama enjekte etmiyor; **kabuk komutuyla okuyor**:

```
exec_command failed for `pwsh.exe -NoProfile -Command "Get-Content -Raw ...SKILL.md"`
  rejected: blocked by policy
```

`-s read-only`, `-s workspace-write` ve `--ignore-rules` ile üç kez denendi;
execpolicy pwsh ve cmd'yi topyekûn reddetti. Skill gövdesi hiç yüklenmedi ve
ajan "instructions were inaccessible" deyip genel bir cevap üretti.

Bunun iki sonucu var. Birincisi, Codex'te skill yüklemesi bir **araç
çağrısı** olarak görünebilir — dolaylı bir tetiklenme sinyali. İkincisi, bu
sinyal sandbox politikasına bağlı ve bu makinede hiç üretilmedi;
**DOĞRULANMADI.**

### Tahmin — hangi vaka tipleri UNKNOWN döner

Tetiklenme vakalarının tamamı (pozitif, negatif, yakın komşu) ve tüm
coexistence vakaları. Görev tamamlama ve araç izi vakaları ölçülebilir.

## GitHub Copilot — belgeden, **DOĞRULANMADI**

CLI bu makinede kurulu değil (`copilot: yok`).

**A. Skill discovery — orta.** Proje skill'leri `.github/skills`,
`.claude/skills` veya `.agents/skills`; kişisel skill'ler `~/.copilot/skills`
veya `~/.agents/skills`. Etkileşimli oturumda `/skills reload` ve
`/skills info <ad>` var — ama bunlar etkileşimli komutlar, programatik değil.

**B. Trigger observability — düşük.** "Copilot bir skill kullanmayı seçtiğinde
SKILL.md dosyası ajanın bağlamına enjekte edilir." Enjeksiyon bir araç çağrısı
değil; **dışarıdan gözlenebilir bir olay üretip üretmediği belgede yok.**
Copilot SDK'nın skill dokümanında da olay veya callback bahsi yok.

**C. Tool trace — düşük.** `-p` ile etkileşimsiz koşum, `--log-level`
(none/error/warning/info/debug/all) ve `--log-dir` var; loglar varsayılan
olarak `~/.copilot/logs/` altında ve başlangıçta budanıyor. **Yapılandırılmış
JSON akışı belgelenmemiş** — log parse etmek gerekir, ki bu kırılgan ve sürüm
değişiminde sessizce bozulur.

**D. Completion — düşük.** Etkileşimsiz modda çıkış kodu var; yapılandırılmış
bir sonuç nesnesi belgelenmemiş. Ayrıca açık hata kayıtları var: etkileşimsiz
modun beklenmedik şekilde erken çıkması ve `-p` modunda workspace
`.mcp.json`'ın sessizce atlanması gibi.

**Tahmin — hangi vaka tipleri UNKNOWN döner:** tetiklenme ve coexistence
vakalarının tamamı; araç izi vakalarının çoğu; `no_swallowed_errors` büyük
ihtimalle hepsi.

---

## Değerlendirme

### Hangi host en temiz sinyali veriyor?

**Claude Code, tek başına.** Dördü de gözlenebilir, üçü yüksek güvenilirlikte,
metin parse etmeye gerek yok, ve aktif skill seti hem kontrol hem rapor
edilebiliyor.

Codex deneyden sonra **düştü**: olay akışı temiz ama tetiklenme yapısal bir
sinyal olarak yayınlanmıyor ve skill seti izole edilemiyor. Copilot'un
belgelenmiş yüzeyi de yeterli değil.

### Faz geçiş kriteri

> "En az bir hostta trigger sinyali orta veya yüksek güvenilirlikle okunabiliyor
> olmalı."

**Karşılandı** — ama yalnızca Claude Code'da, ve yalnızca model skill'i kendi
seçtiğinde. Ürünün kapsamını daraltmak teknik olarak gerekmiyor.

### Ama iki bulgu stratejiyi sıkıştırıyor

**1. `claude plugin eval` Faz 1'in tek-host senaryosunu zaten karşılıyor.**
Assay tek host için yazılırsa, ücretsiz ve birinci taraf bir aracın soluk bir
kopyası olur.

**2. Çapraz-host bugün yapılamıyor.** Kaçış yolu olarak düşünülen
vendor-bağımsızlık, Codex denemesinden sonra **bugün inşa edilemez** çıktı:
tetiklenme yapısal olarak yayınlanmıyor ve skill seti izole edilemiyor.
Metinden çıkarımla ölçmek mümkün ama o, Assay'in kendi değişmezlerine aykırı —
"model 'bu skill'i kullanıyorum' dedi" bir gözlem değil, bir iddiadır.

İki bulgu birlikte, ilk raporun "çapraz-host matrisi artık var oluş
gerekçesidir" önerisini **geçersiz kılıyor**. O öneri, Codex'in ölçülebilir
olduğu varsayımına dayanıyordu; varsayım deneyle çürüdü.

### Ayakta kalan farklar

Rekabetten korunan üç şey kaldı; üçü de teknik ve bugün inşa edilebilir:

1. **Deterministik skorlama.** `claude plugin eval` skorlamayı bir LLM'e
   yaptırıyor (`--judge-model`, varsayılan haiku). Kararsızlık ölçen bir aracın
   kendisinin kararsız olması, ölçümü açıklanamaz kılar: "neden fail"
   sorusunun cevabı bir modelin görüşü olur.
2. **Üç durumlu verdict.** Bu spike'ta iki kez, iki farklı sebeple, `subtype`
   alanı "success" dedi ve koşum hiç gerçekleşmemişti (`not logged in`, sonra
   `401 revoked`). Doğru cevap `is_error` ve `terminal_reason` alanlarındaydı;
   yani sinyal vardı ama tek alana bakan bir araç onu kaçırır. `--threshold`
   ile ikili bir kapıdan geçen skor bunu göremez. Ölçülemeyeni ölçülmüş
   saymamak, bu ürünün tek satılabilir özelliği.
3. **Hafıza.** Eval koşucusu tek koşumu bilir. Regresyon, pin kayması ve zaman
   içindeki eğilim hosted katmanın konusu ve orada rakip yok.

### Öneri

**Kapsamı daraltma, derinleştir.** Faz 1 Claude Code adaptörüyle devam etsin;
çapraz-host matrisi roadmap'te "sonraki dalga"da kalsın — Codex yapısal bir
skill olayı yayınlayana kadar oraya yatırım yapmak, ölçülemeyen bir şeye
altyapı yazmak olur.

Farkı deterministik skorlama, üç durumlu verdict ve regresyon hafızası
taşıyacak. Bunlar "titiz mühendislik" değil, ürünün tek gerçek savunma hattı.

Codex tarafı kapanmadı, ertelendi: `codex exec --json` akışı araç izi ve
tamamlama için zaten yeterli. Yapısal bir tetiklenme olayı çıktığı gün adaptör
bir günlük iş.

### Durdurucu olmayan ama çözülmesi gereken üç şey

1. **İzolasyon zorunlu.** Her koşum kendi `CLAUDE_CONFIG_DIR`'ında yürümeli.
   ✅ mekanizma doğrulandı (119 → 19 skill).
2. **Kimlik bilgisi gerekli.** İzole config OAuth oturumunu devralmıyor.
   `claude setup-token` ile üretilen `CLAUDE_CODE_OAUTH_TOKEN` ✅ çalışıyor;
   `tools/check-auth.mjs` bunu sırrı yazdırmadan doğruluyor.
3. **Pin 3 türetilecek.** Sistem promptu hash'i doğrudan verilmiyor;
   `init` alanlarından bir ortam hash'i hesaplanacak ve raporda sistem promptu
   hash'i olarak değil, kendi adıyla gösterilecek.

## Kanıt

Deney artefaktları oturum scratchpad'inde tutuldu, repoya alınmadı (koşum
artefaktı, `.gitignore` kapsamında):

| Dosya | Ne |
|---|---|
| `probe-plugin/` | Tek kullanımlık `assay-probe` plugin'i |
| `positive.jsonl` | Belirsiz istem — skill tetiklenmedi, model taslak istedi |
| `pos2.jsonl` | Taslaklı istem — skill tetiklenmedi, model işi doğrudan yaptı (119 skill aktif) |
| `explicit.jsonl` | `/assay-probe` — skill çalıştı, `Skill` tool_use **yok** |
| `isolated.jsonl` | Temiz `CLAUDE_CONFIG_DIR` — 19 skill, ama "not logged in" + `subtype: success` |
| `codex-probe/` | Codex için aynı skill, `.agents/skills/` altında |
| `codex-pos.jsonl` | Codex, varsayılan sandbox — 1235 skill, tetiklenme yalnızca metinde |
| `codex-pos2.jsonl` | Codex, `USERPROFILE`/`HOME` izole + `--ignore-rules` — izolasyon işe yaramadı |

Claude Code deney maliyeti: **0.114 USD**, dört koşum. Codex: iki koşum,
koşum başına ~76k girdi / ~800 çıktı token.

Gerçek transkript taraması: `~/.claude/projects/**/*.jsonl`, 245 dosya,
12'sinde `Skill` tool_use.

### Kaynaklar

- [Codex — Build skills](https://learn.chatgpt.com/docs/build-skills)
- [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk)
- [Codex TypeScript SDK README](https://github.com/openai/codex/tree/main/sdk/typescript)
- [GitHub Copilot — About agent skills](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills)
- [GitHub Copilot CLI — Adding agent skills](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills)
- [GitHub Copilot CLI — command reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference)
- [GitHub Copilot SDK — Custom skills](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/skills)
- [GitHub Copilot now supports Agent Skills (changelog)](https://github.blog/changelog/2025-12-18-github-copilot-now-supports-agent-skills/)
