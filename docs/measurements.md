# Ölçüm Raporu — anthropics/skills üç skill

**Tarih:** 2026-09-03 · **Host:** Claude Code · **Model:**
`claude-haiku-4-5-20251001` · **Ölçen:** `@ktlsr/assay@0.1.0`, npm'den
(`npx`), yerel derleme değil.

Bu koşumun iki amacı vardı: gerçek skill'lerin tetiklenme sınırını ölçmek ve
yayımlanan paketin dışarıdan kurulduğunda gerçekten çalıştığını doğrulamak.

Rapordaki tablolarda elle yazılmış tek bir sayı yok; hepsi
`node tools/measurement-report.mjs <root> <suite...>` ile gerçek koşum
kayıtlarından üretildi.

**Pinler.** Skill kaynağı `anthropics/skills@53048666b05b4799081517d00e09e0a2dd688678`,
model kimliği yukarıda, suite sürümü 1. Sistem promptu hash'ini host vermiyor;
kayıt bunun yerine ortam hash'i tutuyor (bkz. docs/decisions.md, pin 3).

---

## Neden bu üç skill

Ölçüt tek bir soruydu: **sınırı belirsiz olanı seç.** Net sınırlı bir skill'i
ölçmenin bilgi değeri yok — cevabı baştan biliniyor.

| Skill | İddia ettiği dar iş | Etrafındaki kalabalık alan |
|---|---|---|
| `webapp-testing` | çalışan yerel bir web uygulamasını tarayıcıda sürmek | birim testi, API testi, statik kod okuma, Playwright yapılandırması |
| `mcp-builder` | MCP sunucusu **inşa etmek** | var olanı yapılandırmak, var olanı kullanmak, Anthropic API araç tanımı, düz REST servisi |
| `doc-coauthoring` | yapılandırılmış bir **birlikte yazma oturumu** | README üretimi, düzyazı düzenleme, sürüm notları, docstring |

Üçünün ortak özelliği: iddia ettikleri iş, ajanın skill olmadan da zaten
yaptığı bir şeyin dar bir alt kümesi. Ayrım gücü ancak yakın komşuyla ölçülür.

## Kurulum ve izolasyon

Her skill kendi plugin dizinine kuruldu
(`plugins/<skill>/skills/<skill>/SKILL.md` + `.claude-plugin/plugin.json`) ve
`--skill` ile yalnızca o koşuma yüklendi. Adaptör her attempt için temiz bir
`CLAUDE_CONFIG_DIR` açtığı için kullanıcının 119 skill'lik kurulumu devrede
değil: her koşumda tek bir hedef skill aktif.

**Düzeltme (2026-09-13).** Bu ölçümler kullanıcının `~/.claude/CLAUDE.md`'si
bağlamdayken yapıldı: `CLAUDE_CONFIG_DIR` onu kesmiyordu, host çalışma
dizininin üst dizinlerinde de talimat arıyor ve Windows'ta `%TEMP%` ev
dizininin altında. Dosya tek bir ilgisiz talimat taşıyor (`/graphify`); bu
sayfadaki kayıtlarda modelin metninde izi yok. 0.4.5'ten itibaren üst dizinler
dışlanıyor ve yüklenen dosyalar ölçülüp kayda yazılıyor (roadmap 0.4.5).

Hiçbir istemde skill adı geçmiyor. Ölçülen şey modelin istemden skill'i kendi
seçmesi; komut çalıştırmak değil.

## Vaka seti tasarımı

Her skill için 3 pozitif + 4 yakın komşu negatifi + 2 alakasız negatif, her
vaka 10 tekrar. Dosyaya atıf yapan istemler `setup.fixtures` ile gerçek
dosyalarla koşuldu — atıf yapıp dosyayı vermemek skill'i değil eksik dosyayı
ölçer (bu tuzağa 1.6'da düşülmüştü, bkz. docs/dogfooding.md).

**İlk turda üç setten ikisi 90/90 geçti.** Bu skill'in mükemmel olduğu değil,
**setin yeterince zor olmadığı** anlamına gelir. Bu yüzden her skill için
ikinci, sınırda bir set yazıldı ve koşuldu. Aşağıdaki iki tablo bu yüzden
yan yana duruyor: fark skill'in değil, vaka setinin farkı.

---

## Sonuçlar

| Vaka seti | Verdict | Precision | Recall | Unknown | Maliyet | Süre |
|---|---|---|---|---|---|---|
| `doc-coauthoring` | pass | 100% (N=30, 95% CI 89%–100%) | 100% (N=30, 95% CI 89%–100%) | 0 | $3.26 | 25.0 dk |
| `doc-coauthoring-borderline` | fail | 51% (N=59, 95% CI 38%–63%) | 100% (N=30, 95% CI 89%–100%) | 0 | $2.68 | 16.6 dk |
| `mcp-builder` | pass | 100% (N=30, 95% CI 89%–100%) | 100% (N=30, 95% CI 89%–100%) | 0 | $5.93 | 69.7 dk |
| `mcp-builder-borderline` | pass | 100% (N=30, 95% CI 89%–100%) | 100% (N=30, 95% CI 89%–100%) | 0 | $8.39 | 116.6 dk |
| `webapp-testing` | fail | 100% (N=29, 95% CI 88%–100%) | 97% (N=30, 95% CI 83%–99%) | 0 | $4.72 | 50.5 dk |
| `webapp-testing-borderline` | fail | 91% (N=33, 95% CI 76%–97%) | 100% (N=30, 95% CI 89%–100%) | 0 | $5.39 | 59.7 dk |

### `doc-coauthoring`

| Vaka | Beklenen | Geçiş oranı | Pass | Fail | Unknown |
|---|---|---|---|---|---|
| `trigger.positive.design_doc` | tetiklenmeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.positive.proposal` | tetiklenmeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.positive.tech_spec` | tetiklenmeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.negative.near_neighbor.readme` | tetiklenmemeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.negative.near_neighbor.edit_prose` | tetiklenmemeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.negative.near_neighbor.release_notes` | tetiklenmemeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.negative.near_neighbor.docstrings` | tetiklenmemeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.negative.unrelated.regex` | tetiklenmemeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.negative.unrelated.docker` | tetiklenmemeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |

### `doc-coauthoring-borderline`

| Vaka | Beklenen | Geçiş oranı | Pass | Fail | Unknown |
|---|---|---|---|---|---|
| `trigger.positive.runbook` | tetiklenmeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.positive.adr` | tetiklenmeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.positive.one_pager` | tetiklenmeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.negative.near_neighbor.customer_email` | tetiklenmemeli | 90% (N=10, 95% CI 60%–98%) | 9 | 1 | 0 |
| `trigger.negative.near_neighbor.talk_abstract` | tetiklenmemeli | 0% (N=10, 95% CI 0%–28%) | 0 | 10 | 0 |
| `trigger.negative.near_neighbor.self_review` | tetiklenmemeli | 0% (N=10, 95% CI 0%–28%) | 0 | 10 | 0 |
| `trigger.negative.near_neighbor.job_description` | tetiklenmemeli | 20% (N=10, 95% CI 6%–51%) | 2 | 8 | 0 |
| `trigger.negative.unrelated.regex` | tetiklenmemeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.negative.unrelated.docker` | tetiklenmemeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |

### `mcp-builder`

| Vaka | Beklenen | Geçiş oranı | Pass | Fail | Unknown |
|---|---|---|---|---|---|
| `trigger.positive.typescript_server` | tetiklenmeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.positive.python_server` | tetiklenmeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.positive.implicit_no_acronym` | tetiklenmeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.negative.near_neighbor.configure` | tetiklenmemeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.negative.near_neighbor.consume` | tetiklenmemeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.negative.near_neighbor.api_tools` | tetiklenmemeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.negative.near_neighbor.plain_service` | tetiklenmemeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.negative.unrelated.git` | tetiklenmemeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.negative.unrelated.css` | tetiklenmemeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |

### `mcp-builder-borderline`

| Vaka | Beklenen | Geçiş oranı | Pass | Fail | Unknown |
|---|---|---|---|---|---|
| `trigger.positive.explicit_anchor` | tetiklenmeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.positive.implicit_stdio` | tetiklenmeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.positive.implicit_portable` | tetiklenmeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.negative.near_neighbor.openai_functions` | tetiklenmemeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.negative.near_neighbor.langchain_tools` | tetiklenmemeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.negative.near_neighbor.claude_code_plugin` | tetiklenmemeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.negative.near_neighbor.agent_cli` | tetiklenmemeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.negative.unrelated.git` | tetiklenmemeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.negative.unrelated.css` | tetiklenmemeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |

### `webapp-testing`

| Vaka | Beklenen | Geçiş oranı | Pass | Fail | Unknown |
|---|---|---|---|---|---|
| `trigger.positive.console_debug` | tetiklenmeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.positive.screenshot` | tetiklenmeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.positive.flow_walkthrough` | tetiklenmeli | 90% (N=10, 95% CI 60%–98%) | 9 | 1 | 0 |
| `trigger.negative.near_neighbor.unit_test` | tetiklenmemeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.negative.near_neighbor.static_read` | tetiklenmemeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.negative.near_neighbor.playwright_config` | tetiklenmemeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.negative.near_neighbor.api_probe` | tetiklenmemeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.negative.unrelated.types` | tetiklenmemeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.negative.unrelated.shell` | tetiklenmemeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |

### `webapp-testing-borderline`

| Vaka | Beklenen | Geçiş oranı | Pass | Fail | Unknown |
|---|---|---|---|---|---|
| `trigger.positive.console_debug` | tetiklenmeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.positive.rendered_value` | tetiklenmeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.positive.responsive_overlap` | tetiklenmeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.negative.near_neighbor.public_scrape` | tetiklenmemeli | 70% (N=10, 95% CI 40%–89%) | 7 | 3 | 0 |
| `trigger.negative.near_neighbor.pdf_render` | tetiklenmemeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.negative.near_neighbor.load_test` | tetiklenmemeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.negative.near_neighbor.grpc_service` | tetiklenmemeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.negative.unrelated.types` | tetiklenmemeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |
| `trigger.negative.unrelated.shell` | tetiklenmemeli | 100% (N=10, 95% CI 72%–100%) | 10 | 0 | 0 |

**Toplam:** 540 attempt · 7934 iz olayı · **$30.36** · 338 dakika ajan süresi.

---

## Karne: `doc-coauthoring`

**İlk set: 90/90, sıfır sızıntı. Sonraki set: precision %51.** Aynı skill,
aynı model, aynı pinler. Değişen tek şey negatiflerin nasıl kurulduğu.

İlk setin izleri ayrımın nerede yapıldığını gösterdi: üç pozitifte ajanın
**ilk eylemi** `Skill` çağrısı — hiçbir şeye dokunmadan karar veriyor. Dört
negatifte doğrudan `Read`/`Write` ile işe başlıyor ve skill'i hiç düşünmüyor.

Ama ayrım konuda değildi. İlk setteki dört negatifin dördünde de ajanın
önünde **dönüştüreceği bir kaynak** vardı: JS export'ları, 2000 kelimelik bir
kılavuz, commit listesi, bir Python dosyası. Üç pozitifte içerik yalnızca
kullanıcının kafasındaydı. Yani set "birlikte yazma işi mi" ekseninde değil,
"ortada dönüştürülecek bir şey var mı" ekseninde ayrışmıştı — istemeden.

İkinci set o değişkeni sabitledi: dört yakın komşunun da içeriği yalnızca
kullanıcının kafasında, sıfırdan yazılacak ve yapılandırılmış. Değişen tek şey
**belge olup olmadıkları**.

| Yakın komşu | Sızma |
|---|---|
| konferans konuşması özeti | **10/10** |
| performans öz değerlendirmesi | **10/10** |
| iş ilanı | **8/10** |
| müşteriye e-posta | 1/10 |

Ham izde sebep ajanın kendi ağzından yazılı — iş ilanı vakasında `Skill`
çağrısından hemen önce:

> "I'll help you turn that knowledge into a compelling job posting. Let me use
> a structured workflow to gather your context and build this out together."

**Bulgu.** `doc-coauthoring`'in gerçek sınırı "bu bir belge mi" değil,
"içerik yalnızca kullanıcının kafasında mı ve yapılandırılması gerekiyor mu".
Sızma vektörü açıklamadaki son ifade: *"or similar structured content."* Bir
öz değerlendirme ve bir iş ilanı bu tanımı karşılıyor. Yalnızca e-posta
tuttu — çünkü e-posta gözle görülür biçimde belge değil.

## Karne: `mcp-builder`

**İki bağımsız set, 180 attempt, tek hata yok.** Precision ve recall her iki
sette de %100 (N=30, %95 GA %89–%100).

İlk setin negatifleri "MCP" sözcüğünü paylaşıyordu ama işin şeklini
paylaşmıyordu. `doc-coauthoring` dersinden sonra ikinci set o boşluğu
kapattı: dört yakın komşunun da işi harfiyen açıklamadaki cümle — "bir dış
servisi, iyi tasarlanmış araçlar üzerinden bir LLM'e açmak" — ve değişen tek
şey protokolün MCP olmaması: OpenAI function calling, LangChain tool
wrapper'ları, Claude Code plugin'i, ajanın süreceği bir CLI.

Dördü de 10/10 tuttu. Pozitif tarafta, "MCP" hiç geçmeyen iki istem
(stdio üzerinden konuşan bağlayıcı; üç istemcinin de bağlanabileceği tek
sunucu) 10/10 tetikledi.

**Bulgu.** `mcp-builder` ölçtüğümüz iki zorluk seviyesinde de sağlam. Protokol
kimliğini işin şeklinden ayırt ediyor: aynı iş MCP değilse tetiklenmiyor, MCP
ise adı anılmasa bile tetikleniyor. Bu sette kırılamadı; daha sınırda bir set
için öneri aşağıda.

## Karne: `webapp-testing`

**İlk set: 89/90 — kıran şey bir negatif değil, bir pozitif.**
Recall %97 (N=30, %95 GA %83–%99).

`flow_walkthrough` 7. denemede skill hiç çağrılmadı. İzde ajan sunucuyu
başlatıyor, `reset.html`'i okuyor, hatayı kaynaktan görüyor ve tarayıcıyı hiç
açmadan cevaplıyor:

> "I can see the bug directly in the code."

**Bulgu 1.** `webapp-testing`'in recall'ı, hatanın kaynakta görünür olduğu
durumda düşüyor. Tarayıcı ancak statik okuma sorunu çözemediğinde kazanıyor.
Benim pozitifim iki yoldan da çözülebiliyordu, yani temiz bir pozitif değil
sınırda bir pozitifti.

İkinci set bunu düzeltti: üç pozitifin de cevabı render edilmiş sayfada
(ekrandaki sayı verisiyle çelişiyor; 375px'te bir katman düğmeyi kapatıyor).
Üçü de 10/10 tetikledi — yani düzeltme işe yaradı.

İkinci setin negatifleri skill'in iddiasını bir kesişim olarak ele aldı
(*tarayıcı gerekiyor* **ve** *yerel web uygulaması testi*) ve kesişimin
dışındaki hücreleri yokladı. Üçü tuttu, biri sızdı:

| Yakın komşu | Sızma |
|---|---|
| genel bir siteden veri kazıma (tarayıcı var, yerel test yok) | **3/10** |
| HTML'i PDF'e render etmek | 0/10 |
| yerel uygulamaya yük testi (yerel test var, tarayıcı yok) | 0/10 |
| yerel gRPC servisini sınamak | 0/10 |

**Bulgu 2.** Sızan vaka tarayıcı gerektiren ama yerel uygulama testi olmayan
tek vaka. İzde ajan doğrudan söylüyor: *"I'll use the webapp-testing skill to
open the browser, navigate to the URL..."* Yani skill "tarayıcı sür" işine
tetikleniyor, "yerel web uygulamasını test et" işine değil; açıklamadaki iki
koşuldan yalnızca birini taşıyor.

**Dürüstlük notu.** Bu vakadaki 7 "geçiş"in hepsi ayrım gücünden gelmiyor.
Geçen denemelerin bir kısmında ajan işi hiç yapmadı — "I can't directly open
and interact with a graphical browser in your environment" deyip skill'i
yalnızca **düzyazıda** önerdi. Adaptör bunu tetiklenme saymıyor (yalnızca
`Skill` araç çağrısı sayılıyor) ve bu doğru; ama vaka kısmen "reddetti" diye
geçti, "ayırt etti" diye değil. Gerçek precision bu vakada ölçülenden düşük
olabilir.

---

## Hiçbir negatifin kırılmadığı yerler ve daha sınırda öneriler

Sözleşme gereği açıkça: **`mcp-builder` iki sette de hiç kırılmadı.** Bu,
setin yeterince zor olmadığı ihtimalini içerir.

Bir sonraki tur için, ölçülmemiş kalan sınır:

- **Var olan bir MCP sunucusunun araç tanımlarını yeniden yazmak.** "Model
  `search_tickets`'ı kullanıcı aramasında çağırıyor; açıklamaları ve şemaları
  ayırt edici hâle getir." Skill'in içeriğinin büyük kısmı tam olarak araç
  tasarımı kalitesi — bu vaka pozitif de olabilir. Yer gerçeği tartışmalı
  olduğu için bu turda **negatif olarak kullanılmadı**; ayrı bir pozitif
  olarak ölçülmeli.
- **MCP sunucusunu test etmek / hata ayıklamak**, inşa etmek değil.
- **MCP istemcisi yazmak** (sunucu değil).
- **Bir MCP sunucusunu başka bir dile taşımak** — inşa mı, göç mü?

`doc-coauthoring` için ölçülmemiş sınır: kullanıcının bütün olguları peşinen
verdiği bir olay sonrası raporu (postmortem). Yapılandırılmış, sıfırdan ve
belge — ama bağlam aktarımı gerekmiyor, yani workflow'un ilk aşaması boş.
Yer gerçeği tartışmalı olduğu için bu turda kullanılmadı.

`webapp-testing` için: **spec yazmak ama koşmamak.** "Checkout akışı için
Playwright spec'lerini yaz, ben sonra koşarım." Skill Playwright script'i
yazmakla ilgili, dolayısıyla bu da pozitif olabilir; ayrı ölçülmeli.

Bu dört başlığın ortak özelliği: yer gerçeği benim için de belirsiz. Belirsiz
yer gerçeğiyle negatif yazmak, skill'i değil benim kanaatimi ölçer.

---

## Yöntemin kendisi hakkında bir bulgu

En pahalı ders skill'lerle ilgili değil, **vaka setiyle** ilgili.

`doc-coauthoring` aynı skill, aynı model ve aynı pinlerle iki kez ölçüldü.
Precision %100 ve %51 çıktı. Aradaki fark tamamen negatiflerin nasıl
kurulduğundan geliyor. İlk set, farkında olmadan skill'in sınırını değil
başka bir değişkeni (ortada dönüştürülecek bir kaynak var mı) ölçüyordu ve
o değişken üzerinde skill kusursuz görünüyordu.

Bunun pratik sonucu: **yalnızca "geçti" raporlayan bir tetiklenme suite'i,
skill hakkında olduğu kadar suite hakkında da bir ifadedir.** Değişmez #5
negatif ve yakın komşu zorunluluğu koyuyor; bu koşum onun yeterli olmadığını
gösteriyor. Yakın komşunun *hangi eksende* yakın olduğu da denetlenmeli:
negatifler pozitiflerden yalnızca ölçülmek istenen özellikte ayrılmalı, başka
hiçbir şeyde değil.

Somut öneri: bir tetiklenme suite'i 90/90 geçtiğinde bu bir başarı değil, bir
**uyarı** olarak okunmalı ve rapor bunu söylemeli. `assay` bugün bunu
söylemiyor.

---

## `@ktlsr/assay@0.1.0` — paket kalitesi

Paket npm'den `npx` ile kuruldu ve altı koşumun tamamını yürüttü: 540 attempt,
0 `unknown`, doğru çıkış kodları. Ölçüm zinciri dışarıdan kurulmuş hâliyle
çalışıyor — yerel derlemeye hiç dokunulmadı.

Görülen kusurlar — **ikisi de 0.1.1'de düzeltildi:**

**1. `assay init` bir dizin verilince ham yığın izi ile çöküyordu.**
Yardım metni "write an example suite next to a skill" diyor ve argüman
`init [path]`; bu ifade doğal olarak skill dizinini işaret ediyor. Oysa
argüman bir **dosya** yolu. Dizin verildiğinde yakalanmamış bir istisna
çıkıyordu (`EISDIR: illegal operation on a directory`) ve Node yığın izi
basılıyordu; diğer kullanım hataları düzgün biçimde exit 2 ve tek satırlık
mesaj üretirken burada o sözleşme bozuluyordu.

> 0.1.1: `init` artık yazmadan önce `stat` ile bakıyor ve dizin görürse
> `EXIT.usage` ile tek satır dönüyor:
> `error <path> is a directory; pass the suite file to write, e.g. <path>/assay.suite.yaml`.
> Yardım metni `assay init [file]  write an example suite file` oldu.

**2. Rapor 90/90 geçen bir suite ile zayıf bir suite'i ayırt etmiyordu.**
Yukarıdaki yöntem bulgusunun araç tarafındaki karşılığı: `assay` "tüm
negatifler geçti" durumunu işaretlemiyordu.

> 0.1.1: `RunSummary.discrimination` alanı eklendi (`cases`, `attempts`,
> `falsePositives`, `untested`). Hiçbir negatif kırılmadıysa terminal ve HTML
> raporunda **no negative case broke** notu çıkıyor ve ölçülen negatif vaka
> ve deneme sayısını yazıyor. Bu bir **not**, verdict değil: `webapp-testing`
> taban koşumu hâlâ `FAIL` (bir pozitif kaçtı) ve notu da taşıyor. Sızıntı
> olan koşumlarda not hiç çıkmıyor.

Bunun dışında `validate`, `run`, `report`, `--html`, `--store`, `--repeat` ve
`setup.fixtures` beklendiği gibi çalıştı. `--repeat 1` uyarısı yerinde ve
kayıtta işaretli. Hiçbir oran N ve güven aralığı olmadan basılmadı; altı
koşumda da `unknown` üretilmedi.

**Kapsam notu.** Not şimdilik SDK tarafında: terminal ve HTML raporu. Hosted
dashboard (`apps/web`) aynı `RunSummary`'yi okuyor ama notu henüz
göstermiyor; yayımlanmayan bir paket olduğu için 0.1.1'in kapsamı dışında
tutuldu.

---

## Yeniden üretmek

```
git clone --depth 1 https://github.com/anthropics/skills.git
# skill'i plugins/<skill>/skills/<skill>/ altina kopyala, plugin.json ekle
npx @ktlsr/assay validate suites/<skill>.suite.yaml
npx @ktlsr/assay run suites/<skill>.suite.yaml --skill plugins/<skill> --store .runs-<skill>
npx @ktlsr/assay report
```

Vaka setleri ve fixture'lar `examples/measurements/` altında. Tablolar
`node tools/measurement-report.mjs <root> <suite...>` ile kayıtlardan
üretilir.


---
---

# Tamamlama Ölçümü — aynı üç skill

**Tarih:** 2026-09-03 · **Host:** Claude Code · **Model:**
`claude-haiku-4-5-20251001` · **Ölçen:** `@ktlsr/assay@0.1.1`, npm'den
(`npx`), yerel derleme değil.

Yukarıdaki bölüm tetiklenmeyi ölçüyor: skill doğru istekte devreye giriyor
mu? Bu bölüm bir sonraki soruyu soruyor: **devreye girdikten sonra iş bitiyor
mu?**

Vaka setleri `suites/<skill>-completion.suite.yaml`. Tetiklenme setlerine
dokunulmadı; bunlar ayrı dosyalar, ayrı store'lar, ayrı koşumlar.

**Pinler.** Skill kaynağı yukarıdakiyle aynı
(`anthropics/skills@53048666b05b4799081517d00e09e0a2dd688678`), model kimliği
aynı, suite sürümü 1. Üç kayıt üç ayrı `skillHash` taşıyor — her skill kendi
plugin dizininden yüklendi.

Tablolardaki hiçbir sayı elle yazılmadı; hepsi
`node tools/completion-report.mjs . <skill...>` ile kayıtlardan üretildi.

---

## Vaka seti tasarımı

Her skill için 3 tamamlama vakası. Her vakada:

- `expect.triggered: true`
- üretilecek her artefakt için `file_exists`, mümkün olduğunda `file_valid`
  (json/yaml), `json_schema` ve `file_content_matches`
- `{ type: trace, rule: no_swallowed_errors }`
- `{ type: side_effect, writes_within: [out], network: deny }`

İstemler tetiklenmeyi değil işi istiyor: her birinin sonunda somut bir dosya
var ve assertion o dosyaya bağlı. Girdi gereken vakalar `setup.fixtures` ile
gerçek dosyalarla koşuldu (`suites/fixtures/`): ham toplantı notları, bir API
belgesi ve üç HTML sayfası — biri sağlam, biri tek karakterlik bir yazım
hatasıyla bozuk (`teir`), biri o hatanın düzeltilmiş hâli.

İki vaka tamamlama vakası **değil** ve neden orada olduklarını söylemek
gerekiyor:

**Her sette bir negatif var.** Değişmez #5, negatif vakası olmayan her
suite'i reddediyor — doğrulayıcı `error` üretiyor, koşum hiç başlamıyor.
Yani yalnızca pozitif tamamlama vakalarından oluşan bir set yazılamazdı.
Aracın kendi kuralını kendi rahatlığı için gevşetmek yerine her sete bir
yakın-komşu negatifi kondu.

**`doc-coauthoring` setinde bir kontrol vakası var.**
`control.design_doc_no_artifact`, `complete.design_doc_with_outline` ile
kelimesi kelimesine aynı istem — tek fark, teslim edilecek dosyayı isteyen
son paragrafın olmaması. İkisi aynı koşumda, aynı dört pinle yan yana
duruyor, dolayısıyla aradaki tetiklenme farkı tek bir değişkene ait.

## Önce bir yöntem hatası: ilk taslak skill'i değil beni ölçüyordu

İlk taslak istemler sıfırdan yazılmıştı ve şöyle cümleler içeriyordu:
"şu dosyayı şu başlıklarla yaz", "playwright kurulu değil, çalıştırmaya
kalkma", "sadece kaynağı istiyorum".

Sonuç: `doc-coauthoring` 0/6, `webapp-testing` 0/6 tetiklendi — **ama her
artefakt assertion'ı geçti.** Yani ajan işi skill'siz bitiriyordu. Ölçülen
şey skill değil, benim yazdığım kısıttı: "çalıştırma" cümlesi bir tarayıcı
sürme aracının varlık sebebini istemden siliyordu.

Düzeltme iki parçalı. (1) Ölçüm makinesine Python playwright ve chromium
kuruldu; `webapp-testing` istemleri artık gerçek doğrulama istiyor.
(2) Her tamamlama istemi, tetiklenme setinde 10/10 tetikleyen açılış
cümlesiyle başlıyor ve üzerine **yalnızca** teslim edilecek dosya ekleniyor.

Bu, yukarıdaki "yakın komşu tek eksende ayrılmalı" kuralının pozitif
taraftaki karşılığı: bir tamamlama vakası, tetikleyen bir istemden yalnızca
artefakt talebiyle ayrılmalı. Aksi hâlde "tetiklenmedi" sonucu skill hakkında
değil, istem hakkında bir ifade olur.

---

## Sonuçlar

| Vaka seti | Verdict | Attempt | Tetiklenme (tamamlama vakaları) | Artefakt tam | Unknown | Maliyet | Süre |
|---|---|---|---|---|---|---|---|
| `doc-coauthoring-completion` | fail | 50 | 63% (N=40, %95 GA 47%–76%) | 38% (N=40, %95 GA 24%–53%) | 0 | $1.66 | 12.9 dk |
| `mcp-builder-completion` | fail | 40 | 63% (N=30, %95 GA 46%–78%) | 93% (N=30, %95 GA 79%–98%) | 2 | $2.20 | 22.8 dk |
| `webapp-testing-completion` | fail | 40 | 93% (N=30, %95 GA 79%–98%) | 80% (N=30, %95 GA 63%–90%) | 11 | $3.49 | 39.9 dk |

Üç set de `fail`. Sebepleri üç ayrı yerde ve birbirine benzemiyor.

### `doc-coauthoring-completion`

| Vaka | Tetiklenme oranı | Artefakt tamamlama oranı | Vaka geçiş oranı |
|---|---|---|---|
| `complete.decision_record` | 0% (N=10, %95 GA 0%–28%) | 100% (N=10, %95 GA 72%–100%) | 0% (N=10, %95 GA 0%–28%) |
| `complete.design_doc_with_outline` | 50% (N=10, %95 GA 24%–76%) | 50% (N=10, %95 GA 24%–76%) | 0% (N=10, %95 GA 0%–28%) |
| `complete.proposal_with_objections` | 100% (N=10, %95 GA 72%–100%) | 0% (N=10, %95 GA 0%–28%) | 0% (N=10, %95 GA 0%–28%) |
| `control.design_doc_no_artifact` | 100% (N=10, %95 GA 72%–100%) | — | 100% (N=10, %95 GA 72%–100%) |
| `trigger.negative.near_neighbor.release_notes` | 0% (N=10, %95 GA 0%–28%) | — | 100% (N=10, %95 GA 72%–100%) |

### `mcp-builder-completion`

| Vaka | Tetiklenme oranı | Artefakt tamamlama oranı | Vaka geçiş oranı |
|---|---|---|---|
| `complete.typescript_server` | 30% (N=10, %95 GA 11%–60%) | 100% (N=10, %95 GA 72%–100%) | 30% (N=10, %95 GA 11%–60%) |
| `complete.python_server_with_manifest` | 60% (N=10, %95 GA 31%–83%) | 80% (N=10, %95 GA 49%–94%) | 40% (N=10, %95 GA 17%–69%) |
| `complete.server_with_eval_cases` | 100% (N=10, %95 GA 72%–100%) | 100% (N=10, %95 GA 72%–100%) | 100% (N=10, %95 GA 72%–100%) |
| `trigger.negative.near_neighbor.configure_existing` | 0% (N=10, %95 GA 0%–28%) | — | 100% (N=10, %95 GA 72%–100%) |

### `webapp-testing-completion`

| Vaka | Tetiklenme oranı | Artefakt tamamlama oranı | Vaka geçiş oranı |
|---|---|---|---|
| `complete.signin_flow_verified` | 100% (N=10, %95 GA 72%–100%) | 70% (N=10, %95 GA 40%–89%) | 30% (N=10, %95 GA 11%–60%) |
| `complete.bug_root_cause_report` | 100% (N=10, %95 GA 72%–100%) | 90% (N=10, %95 GA 60%–98%) | 0% (N=10, %95 GA 0%–28%) |
| `complete.regression_suite_green` | 80% (N=10, %95 GA 49%–94%) | 80% (N=10, %95 GA 49%–94%) | 30% (N=10, %95 GA 11%–60%) |
| `trigger.negative.near_neighbor.unit_tests` | 0% (N=10, %95 GA 0%–28%) | — | 100% (N=10, %95 GA 72%–100%) |

### Katman özeti

| Vaka seti | `no_swallowed_errors` pass/fail/unknown | `side_effect` pass/fail/unknown |
|---|---|---|
| `doc-coauthoring-completion` | 30/0/0 | 29/0/1 |
| `mcp-builder-completion` | 30/0/0 | 27/0/3 |
| `webapp-testing-completion` | 26/4/0 | 12/4/14 |

**`no_swallowed_errors` pass dışı sonuç:** 
- `webapp-testing` `complete.regression_suite_green` #1 → **fail** — the session completed successfully but 1 of 6 failures were never mentioned afterwards
- `webapp-testing` `complete.regression_suite_green` #2 → **fail** — the session completed successfully but 3 of 9 failures were never mentioned afterwards
- `webapp-testing` `complete.regression_suite_green` #4 → **fail** — the session completed successfully but 3 of 6 failures were never mentioned afterwards
- `webapp-testing` `complete.regression_suite_green` #8 → **fail** — the session completed successfully but 4 of 7 failures were never mentioned afterwards

**Yan etki ihlali:** 
- `webapp-testing` `complete.signin_flow_verified` #6 — wrote outside out: run_test.sh
- `webapp-testing` `complete.bug_root_cause_report` #4 — wrote outside out: analyze_and_test.py, run_test.py, test_click.py
- `webapp-testing` `complete.bug_root_cause_report` #8 — wrote outside out: test_calculate.py
- `webapp-testing` `complete.regression_suite_green` #6 — wrote outside out: run_ui_tests.py

### Tetiklendi ama artefaktı tamamlamadı

| Vaka seti | Vaka | Deneme | Artefakt | Düşen assertion |
|---|---|---|---|---|
| `doc-coauthoring` | `complete.design_doc_with_outline` | 5/10 (#0, #1, #3, #4, #7) | fail | `file_exists` fail: no file matches out/queue-design.md<br>`file_exists` fail: no file matches out/outline.yaml<br>`file_valid` fail: no file matches out/outline.yaml, so nothing could be validated<br>`file_content_matches` fail: no file matches out/queue-design.md<br>`file_content_matches` fail: no file matches out/outline.yaml |
| `doc-coauthoring` | `complete.proposal_with_objections` | 10/10 (#0, #1, #2, #3, #4, #5, #6, #7, #8, #9) | fail | `file_exists` fail: no file matches out/trunk-based-proposal.md<br>`file_content_matches` fail: no file matches out/trunk-based-proposal.md<br>`file_content_matches` fail: no file matches out/trunk-based-proposal.md<br>`file_content_matches` fail: no file matches out/trunk-based-proposal.md |
| `webapp-testing` | `complete.signin_flow_verified` | 3/10 (#2, #7, #8) | fail | `file_exists` fail: no file matches out/result.json<br>`file_valid` fail: no file matches out/result.json, so nothing could be validated<br>`json_schema` fail: no file matches out/result.json |
| `webapp-testing` | `complete.bug_root_cause_report` | 1/10 (#1) | fail | `file_exists` fail: no file matches out/findings.md<br>`file_exists` fail: no file matches out/repro.py<br>`file_content_matches` fail: no file matches out/findings.md<br>`file_content_matches` fail: no file matches out/findings.md<br>`file_content_matches` fail: no file matches out/repro.py |
| `webapp-testing` | `complete.regression_suite_green` | 1/10 (#9) | fail | `file_exists` fail: no file matches out/run.txt |

**Toplam:** 130 attempt · 1971 iz olayı · **$7.35** · 76 dakika ajan süresi.

---

## En ilginç bulgu: `doc-coauthoring` tetiklenmekle bitirmek arasında seçim yapıyor

Tamamlama vakalarının 30 denemesinde çapraz tablo şöyle:

| | artefakt tam | artefakt eksik |
|---|---|---|
| **tetiklendi** | 0 | 15 |
| **tetiklenmedi** | 15 | 0 |

İstisna yok. Skill devreye girdiği her denemede dosya yazılmadı; girmediği
her denemede yazıldı.

`complete.proposal_with_objections` bunun en saf hâli: **10/10 tetiklendi,
0/10 dosya yazıldı.** Ham iz yedi olaydan ibaret ve hiç `Write` içermiyor:

```
assistant_message  "I'll help you build a compelling trunk-based development
                    proposal. This is exactly the kind of structured doc work
                    where the doc-coauthoring workflow helps..."
tool_call Skill    {"skill":"doc-coauthoring:doc-coauthoring"}
skill_trigger      doc-coauthoring:doc-coauthoring
tool_result Skill
assistant_message  (SKILL.md icerigi)
assistant_message  "## Initial Meta-Questions ... What's your read on these
                    points?"
session_end
```

`env.writes` boş. Son mesaj beş soru soruyor ve cevap bekliyor.

Sebep skill'in kendi tasarımı: `SKILL.md` "Act as an active guide, walking
users through three stages" diyor ve birinci aşama Context Gathering — yani
kullanıcıya soru sorup beklemek. Tek turluk bir koşumda cevaplayacak kimse
yok; oturum sorularla bitiyor.

`complete.design_doc_with_outline` aynı şeyi 50/50 gösteriyor: tetiklenen beş
denemede dosya yok, tetiklenmeyen beş denemede dosya var. Ve kontrol vakası
(`control.design_doc_no_artifact` — aynı istem, dosya talebi yok) 10/10
tetikliyor. İkisi birlikte şunu söylüyor: **isteme somut bir çıktı dosyası
eklemek bu skill'in tetiklenme oranını düşürüyor; tetiklendiğinde ise dosyayı
üretmiyor.**

Bunun pratik anlamı skill'in kırık olduğu değil. `doc-coauthoring` çok turluk
bir oturum için tasarlanmış ve tek turluk bir CI koşumunda ölçüldüğünde tanım
gereği tamamlanmıyor. Ölçüm bunu görünür kılıyor — ve bir skill yazarının
bilmesi gereken şey tam da bu: *bu skill'in çıktısı bir dosya değil, bir
konuşma.* Bir CI hattına "belgeyi üret" diye konursa hiçbir zaman üretmez.

Diğer iki skill'de bu desen yok. `mcp-builder`'ın tetiklenen 19 denemesinin
19'unda da artefakt tam; artefakt hataları yalnızca tetiklenmeyen iki
denemede. `webapp-testing` 28 tetiklenen denemenin 23'ünde bitiriyor, beşinde
eksik bırakıyor — ve o beşi aşağıdaki sebep ilginç kılıyor.

## `webapp-testing`: tetiklendi, çalıştı, yarısını yazdı

Beş denemede skill devreye girdi, sayfayı gerçekten sürdü, ama istenen
artefaktın bir parçası eksik kaldı:

- `complete.signin_flow_verified` — 3 denemede `out/test_signin.py` yazıldı
  ama `out/result.json` hiç yazılmadı. Ajan gözlemi mesajına yazdı, dosyaya
  yazmadı.
- `complete.bug_root_cause_report` — 1 denemede hiçbir dosya yazılmadı.
- `complete.regression_suite_green` — 1 denemede `out/run.txt` yazılmadı.

Desen tek: **ikinci artefakt unutuluyor.** Birincil çıktı (betik) hemen her
zaman var; ondan sonra istenen makine okunur özet (`result.json`, `run.txt`)
düşüyor. Bir skill yazarı için bu, "skill çalışıyor mu" sorusunun cevabından
daha kullanışlı bir bilgi.

## `no_swallowed_errors` dört kez tetiklendi

Dördü de `webapp-testing` `complete.regression_suite_green` vakasında ve
hepsi aynı sebeple: ajan testleri **çalıştıramadı** ve bunu söylemedi.

Attempt #8'in izinde yedi başarısız araç sonucu var:

```
PowerShell  "Compound command changes working directory ... requires manual approval"
PowerShell  "tee-object may receive a path from an upstream pipeline command ..."
Bash        "This Bash command contains multiple operations. The following parts
             require approval: cd ... && python test_estimator.py"
Bash        "This command requires approval"   (x3)
```

Bunlar host'un izin katmanından geliyor: adaptör `--permission-mode
acceptEdits` kullanıyor, yani `Write` serbest ama kabuk çalıştırma onay
istiyor ve onay verecek kimse yok. Kural, bu yedi hatadan dördünün sonraki
mesajlarda hiç anılmadığını yakaladı.

**Bu bir sandbox sınırı, skill kusuru değil** ve öyle raporlanmalı. Ama
`no_swallowed_errors`'ın işi tam olarak bu: ajan bir şeyi yapamadığında bunu
kullanıcıya söylüyor mu? Dört denemede söylemedi.

Buradan çıkan ikinci ve daha rahatsız edici gözlem: `out/run.txt` bu vakada
10 denemenin 8'inde **var**, oysa 10 denemenin 10'unda da en az bir kabuk
çağrısı onay beklerken reddedildi. Artefakt
assertion'ı "dosya var ve şu deseni içeriyor" diyor; "bu dosya gerçekten bir
koşumdan geldi" diyemiyor. Tamamlama katmanının bugünkü tavanı bu ve rapora
yazılması gerekiyor: **bir dosyanın varlığı, içeriğinin kazanılmış olduğunun
kanıtı değil.**

## Yan etki: dört ihlal, hepsi aynı biçimde

Dört denemede `writes_within: [out]` ihlal edildi, dördü de
`webapp-testing`'de:

| Vaka | # | Çalışma dizini köküne yazılan |
|---|---|---|
| `complete.signin_flow_verified` | 6 | `run_test.sh` |
| `complete.bug_root_cause_report` | 4 | `analyze_and_test.py`, `run_test.py`, `test_click.py` |
| `complete.bug_root_cause_report` | 8 | `test_calculate.py` |
| `complete.regression_suite_green` | 6 | `run_ui_tests.py` |

Hiçbiri sandbox dışına çıkmadı; hepsi geçici çalışma betiği ve `out/` yerine
köke yazıldı. `network: deny` hiçbir koşumda ihlal edilmedi — ağ araçları
zaten adaptör tarafından reddediliyor.

`side_effect` 18 denemede `unknown` döndü (`doc-coauthoring` 1,
`mcp-builder` 3, `webapp-testing` 14). Sebep her seferinde aynı ve beklenen:
koşum `Bash` kullandı, kabuk komutunun yan etkisi gözlenemiyor, iddia bu
yüzden ölçülemedi (2026-08-31 kararı). Bu 18 denemede "sınır aşılmadı"
denmedi — denseydi ölçüm değil tahmin olurdu.

## Ölçülemeyenler ve tavanlar

- **Kabuk kullanan her koşumda yan etki `unknown`.** 130 denemenin 18'i.
  Doğru bedel; alternatifi, gözlemlenmemiş bir şeye "temiz" demek.
- **Dosyanın içeriği kazanıldı mı, bilinmiyor.** Yukarıda anlatıldı.
- **Kabuk çalıştırma onay istiyor.** `acceptEdits` izin modu `Write`'a izin
  verip `Bash`'i onaya bırakıyor; test *çalıştırma* isteyen vakalar bu yüzden
  kısmen ölçülemiyor. `webapp-testing`'in 11 `unknown` denemesinin kaynağı bu.
- **`doc-coauthoring` tek turda tanım gereği tamamlanmıyor.** Çok turluk
  oturum ölçmek Assay'in bugünkü koşum modelinde yok.

---

## Yeniden üretmek

```
git clone --depth 1 https://github.com/anthropics/skills.git
# skill'i plugins/<skill>/skills/<skill>/ altina kopyala, plugin.json ekle
python -m pip install playwright && python -m playwright install chromium
npx @ktlsr/assay validate suites/<skill>-completion.suite.yaml
npx @ktlsr/assay run suites/<skill>-completion.suite.yaml \
  --skill plugins/<skill> --store .runs-<skill>-completion
node tools/completion-report.mjs . <skill>
```

Vaka setleri ve fixture'lar `suites/` altında.

---

# Paralel Koşum Ölçümü — 0.3.0-d

**Soru.** 240 denemelik bir koşum `--concurrency` 1, 2 ve 4'te ne kadar sürüyor?

**Yöntem.** Host tarafı sabit süreli sahte bir adaptörle taklit ediliyor
(deneme başına 250 ms) ve aynı suite altı vaka × kırk tekrarla koşuluyor.
Böylece ölçülen şey **Assay'in kendi ölçeklenmesi ve ek yükü**: iş listesi,
worker açılışı, journal yazımı, süreç ağacı kapatma.

Üretici: `tools/fixtures/measure-concurrency.mjs`.

**Bu ölçümün söylemediği şey:** host hız sınırı. Sahte adaptör ağa çıkmıyor.
Gerçek hız sınırı ancak paralı bir koşumla ölçülür; aşağıda ayrı başlık.

| Kol | `--concurrency` | Süre | Hızlanma | Deneme | `unknown` | Deneme başına ek yük |
|---|---|---|---|---|---|---|
| süreç içi | 1 | 61.4 sn | 1.00x | 240 | 0 | ~6 ms |
| süreç içi | 2 | 30.7 sn | 2.00x | 240 | 0 | ~6 ms |
| süreç içi | 4 | 15.4 sn | 3.99x | 240 | 0 | ~6 ms |
| izole (varsayılan) | 1 | 191.2 sn | 1.00x | 240 | 0 | ~546 ms |
| izole (varsayılan) | 2 | 100.9 sn | 1.89x | 240 | 0 | ~591 ms |
| izole (varsayılan) | 4 | 53.5 sn | 3.57x | 240 | 0 | ~642 ms |

**Gerçek bir koşuma çevirisi.** 4.2.2 ölçümünde 240 deneme ~8 saat sürdü, yani
deneme başına ~120 sn. Aynı iş `--concurrency 4` ile ~2 saat 5 dakikaya iner
(3.57x); izolasyonun deneme başına ~0.6 sn'lik ek yükü bu ölçekte toplam
~2.5 dakika, yani **%2'nin altında**. Ek yük sabit; denemenin uzunluğuyla
büyümüyor.

**Okunuşu.**

- **Süreç içi** kol neredeyse doğrusal ölçekleniyor ve deneme başına ek yük
  ~5 ms. Bu, iş listesi ve journal yazımının maliyeti.
- **İzole** kol (ürünün varsayılanı, deneme başına bir süreç) deneme başına
  ~0.5 sn ek yük taşıyor: worker açılışı ve süreç ağacının kapatılması.
  Windows'ta ağaç PPID üzerinden PowerShell ile yürünüyor (0.3.0-c) ve o çağrı
  tek başına birkaç yüz milisaniye.
- Bu ek yük sabit, denemenin uzunluğuyla ölçeklenmiyor. 250 ms'lik sahte bir
  denemede oran büyük görünüyor; gerçek bir denemede ajan 30–120 saniye
  çalışıyor ve aynı 0.5 sn **%1'in altında** kalıyor. Ölçümün büyüklüğü değil,
  oranı yanıltıcı.
- Eş zamanlılık 4'te izole kolun hızlanması doğrusalın biraz altında: worker
  açılışları CPU'yu paylaşıyor.

**Host hız sınırı — ölçülmedi.**

Yukarıdaki sayılar ağa çıkmayan bir adaptörle alındı. "Concurrency 4'te hız
sınırına çarpıyor muyuz" sorusu ancak gerçek host'la ölçülür ve o koşum para
harcar. Sözleşme 1 gereği tetiği kullanıcı çekiyor.

Ne yapılacağı belli: aynı suite'i küçük bir tekrarla (ör. 2 vaka × 4 tekrar)
`--concurrency 4` ile koşmak ve izde `429`/`rate limit` sinyali aramak. Tahmini
maliyet birkaç yüz milisaniyelik değil, **birkaç dolar** mertebesinde ve süre
birkaç dakika. Sonuç buraya, bu başlığın altına yazılacak.

Bugün bilinen: bir hız sınırı yanıtı adaptör tarafında sıradan bir host hatası
olarak görünür ve deneme `unknown` olur (değişmez #1). Yani hız sınırı ölçümü
**bozmuyor**, yalnızca ölçülemeyen deneme sayısını artırıyor — ve bu, raporda
ayrı bir kova olarak görünüyor.

---

# 0.4.0-f — marketingskills çakışma koşumu, yeni şemayla yeniden puanlandı

**Soru.** `expect.winner` şeması doğru mu? Kanıt olarak yeni bir koşum değil,
var olan gerçek bir koşum kullanıldı: aynı kanıt her zaman aynı verdict'i verir,
ve kayıt her denemenin tetiklenme gözlemini taşıyor. Maliyeti $0.

**Girdiler** (ölçüm deposu `skill-trigger-measurements`, yalnızca okundu):

- kayıt `run-2026-09-10T11-01-34-914Z-0bec859e` — assay 0.3.2, 20 vaka × 10, 200 deneme
- suite `suites/marketingskills.collide.suite.yaml` v2 — yalnız `not_triggered`
- analizci `tools/collide.py` — beklenen kazananı vaka id'sinden okuyor
- rapor `reports/marketingskills.collide.md` — bölüm 5: "179 pass, 21 fail; that is not the finding"

**Türetilmiş suite:** `examples/measurements/marketingskills.collide.winner.suite.yaml`.
Id'ye gömülü kazanan, `collide.py`'nin `expected()` kuralıyla `expect.winner`a
taşındı. Vaka id'leri bayt bayt aynı. Tek anlamsal düzeltme tartışmalı vakada:
özgün suite `not_triggered: [copy-editing]` diyordu, oysa kendi yorumu tartışmalı
vakayı "iki açıklamanın da istediği" diye tanımlıyor; çelişen satır düşürüldü.

Özgün suite yeni doğrulayıcıdan 15 uyarıyla geçiyor ("this case also passes when
no skill triggers at all"); türetilmiş suite uyarısız.

## Sonuç

| | pass | fail | unknown |
|---|---|---|---|
| Kayıttaki (0.3.2, eski şema) | 179 | 21 | 0 |
| Yeniden puanlanmış (0.4.0, `winner`) | **79** | **121** | 0 |

- `pass` → `fail` dönen deneme: **100**. Bunlar, hiçbir `marketing-skills:`
  skill'inin tetiklenmediği ve eskiden `pass` sayılan pozitif denemelerin
  **tam kümesi** (küme eşitliği doğrulandı). `fail` → `pass` dönen: 0.
- Matris, `collide.py`'nin matrisiyle karşılaştırıldı (13 satır):

| Tanım | Karşılaştırılan dolu hücre | Fark |
|---|---|---|
| `collide.py`'nin süzgeci (yalnız `marketing-skills:` aktivasyonları), aynı Assay kodu | 17 | **0** |
| Assay'in tanımı (ilk doğrulanmış aktivasyon, herhangi bir skill) | 18 | 2 hücre, tek deneme |

Tek fark: `collide.cro.lead_form` #7'de yalnızca host'la gelen `run` skill'i
tetiklendi. `collide.py` pazarlama dışı skill'leri saymadığı için onu "none"a
yazıyor (cro × none = 15); Assay `run` sütununa (cro × none = 14, cro × run = 1).
Verdict ikisinde de `fail`. Assay'in "none" sütunu gerçekten hiçbir skill'in
tetiklenmediği anlamına geliyor; bir host skill'inin isteği kapması da bir
çakışma bulgusu (karar: decisions.md, 2026-09-10).

`collide.py` matrisinde olmayan iki satır, onun tablo 1'iyle tutarlı:
tartışmalı `copywriting / copy-editing` → none × 10, `none` (negatifler) → none × 30.

## Yeniden üretmek

```
npx tsc -b
node tools/rescore.mjs <kayit.json> examples/measurements/marketingskills.collide.winner.suite.yaml
node tools/rescore.mjs <kayit.json> examples/measurements/marketingskills.collide.winner.suite.yaml --json
```

Hücre hücre karşılaştırma `collide.py`'nin kendi fonksiyonlarını içe aktarıyor
ve aynı Assay kodunu süzülmüş bir kayıtla ikinci kez koşuyor.

## Görsel doğrulamada bulunanlar

HTML raporu bu gerçek kayıttan çizildi. 420 px'de sayfa yana taşıyordu; matris
değil, 0.4.0'dan önce de var olan iki şey yüzünden: vaka tablosu ve kırılmayan
pin değerleri (hash'ler). İkisi düzeltildi. Matrisin ilk sütunu yapışkan yapıldı:
15 sütun yana kaydırılınca satır etiketleri kayboluyordu. Terminal çıktısında
ortak önek, host'la gelen tek bir öneksiz ad (`run`) yüzünden hiç atılmıyordu ve
300 karakterlik satır üretiyordu; kural daraltıldı.
