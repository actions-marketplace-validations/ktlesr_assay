# GitHub Marketplace'e yayın

Eylem marketplace'e hazır. Kalan adımlar **hesap erişimi** istiyor, yani
kodda değil GitHub arayüzünde yapılıyor. Bu dosya ne yapıldığını ve senin ne
yapman gerektiğini ayırıyor.

## Hazır olan

| Koşul | Durum |
|---|---|
| `action.yml` deponun kökünde | ✅ `action/action.yml`'den taşındı |
| Depoda tek eylem tanımı | ✅ eski tanım silindi |
| `name`, `description`, `author` | ✅ |
| `branding.icon` + `branding.color` | ✅ `activity` · `gray-dark` |
| Depo herkese açık | ✅ |
| Lisans | ✅ Apache-2.0 |
| README (kullanım) | ✅ `action/README.md`, kökten bağlanıyor |
| Eylem kendi kendine yeter | ✅ CLI ve host'u kendi kuruyor |
| Kimlik bilgisi girdisi | ✅ `anthropic-api-key` / `claude-code-oauth-token` |
| Sürüm pini | ✅ `assay-version`, yayımlanan sürümle eşitliği testte |

Koşulların hepsi `tools/action-metadata.test.ts` ile denetleniyor. Dosya
taşınırsa, `branding` silinirse veya pin yayımlanmış sürümden ayrışırsa test
kırmızıya döner — yayın anında değil, commit anında.

## Senin yapman gerekenler

### 1. Eylem adının marketplace'te boş olduğunu doğrula

Marketplace'te **ad global olarak benzersiz** olmak zorunda ve "Assay" büyük
ihtimalle alınmış. Tanımdaki ad şu an:

```
name: Assay — Agent Skill measurement
```

Yayın formunda ad çakışırsa GitHub uyarıyor. Çakışırsa `action.yml` içindeki
`name` alanını değiştir (örn. `Assay Skill Measurement`) ve tekrar dene. Depo
adı ve kullanım referansı (`ktlesr/assay@v1`) bundan etkilenmiyor.

### 2. Depo açıklamasını doldur

Şu an boş. Marketplace listesi bunu gösteriyor.

```
gh repo edit ktlesr/assay --description "A CI test runner for Agent Skills: does your skill still fire?"
```

### 3. Bir sürüm etiketi ve `v1` takip etiketi oluştur

Marketplace yayını bir **release**'den yapılıyor. Konvansiyon: kesin sürüm
etiketi + kullanıcıların bağlandığı hareketli `v1`.

```
git tag -a action-v1.0.0 -m "Assay action v1.0.0"
git tag -f v1 action-v1.0.0
git push origin action-v1.0.0
git push -f origin v1
```

`git push -f origin v1` **geri alınamaz bir işlem** (var olan etiketi
oynatıyor). İlk yayında etiket zaten yok, yani risk yok; sonraki sürümlerde
`v1`'i oynatmadan önce mevcut kullanıcıların ne aldığını bilerek yap.

### 4. Release'i yayımla ve marketplace kutusunu işaretle

1. GitHub → **Releases** → **Draft a new release**
2. Tag: `action-v1.0.0`
3. **Publish this Action to the GitHub Marketplace** kutusunu işaretle
4. İlk kez yayımlıyorsan **GitHub Marketplace Developer Agreement**'ı kabul
   etmen istenir — bunu ancak hesap sahibi yapabilir
5. Kategori seç: birincil **Continuous integration**, ikincil **Testing**
6. **Publish release**

GitHub yayından önce `action.yml`'i doğruluyor; bir alan eksikse kutuyu
işaretlemene izin vermiyor. Yukarıdaki testler tam olarak o doğrulamayı
önceden yapıyor.

### 5. Yayından sonra tek bir gerçek koşumla doğrula

Marketplace listesi "çalışıyor" demiyor, "yayımlandı" diyor. Eylemin başka bir
depodan gerçekten koştuğunu görmek için boş bir depoda:

```yaml
- uses: actions/checkout@v5
- uses: ktlesr/assay@v1
  with:
    suite: ./my-skill.suite.yaml
    skill: ./my-skill
    claude-code-oauth-token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
```

Bu koşum gerçek para harcıyor (host çağrısı). Bir vakalık küçük bir suite
yeterli.

## Sürüm çıkarırken

`assay-version` pini sürüm PR'ında kendiliğinden yükseliyor
(`tools/sync-action-pin.mjs`, `version-packages` betiğinin parçası); `pin >=
manifest` testi kaçırırsa PR kırmızıya döner. npm yayını bittikten sonra:

```
git tag -a action-vX.Y.Z -m "action: assay CLI pin A.B.C" origin/main
git tag -f v1 origin/main
git push origin action-vX.Y.Z && git push -f origin v1
gh release create action-vX.Y.Z --verify-tag --latest   --title "Assay action vX.Y.Z — pins CLI A.B.C" --notes-file <notlar>
```

Sürüm notu önce **davranış değişikliğini** söyler: çıkış kodu kayıyorsa hangi
durumda ve `allow-unknown` ile nasıl geri alınır.

### Dışarıdan doğrulama — `v1`'i taşıdıktan sonra her seferinde

`ktlesr/assay-example` eylemi başka bir depodan `@v1` ile kullanan tüketici
deposu; host kimliği (`CLAUDE_CODE_OAUTH_TOKEN`) secret olarak orada. Elle
tetiklenen `Assay` iş akışı 3 vaka × 2 deneme koşuyor (birkaç sent).

```
gh workflow run assay.yml -R ktlesr/assay-example --ref main
```

Üç şeye bakılır, üçü de gerekli:

1. Kütükte `Download action repository 'ktlesr/assay@v1' (SHA:…)` — `v1`
   yeni commit'e çözülmüş mü.
2. Kütükte `ASSAY_VERSION: A.B.C` — kurulması *istenen* sürüm.
3. `assay-runs` artefaktındaki kayıtta `run.assayVersion` yeni sürüme eşit mi —
   gerçekten o sürümün *koştuğunun* doğrudan kanıtı (0.3.2'den itibaren; ilk kez
   0.3.2'nin kendi doğrulamasında okundu). Terminal raporu da aynı değeri
   `assay X.Y.Z` satırında basıyor.

0.3.2 öncesi sürümlerde üçüncü kanıt dolaylıydı: 0.3.1 normal biten bir koşumun kaydına
yeni alan eklemiyor (değişiklik yalnız kurtarma yolunda). O zaman zincir şöyle
kuruluyor: kütükte "using the assay CLI built in this workspace" satırının
**olmadığı** (npm dalı çalıştı) + tam sürüm kurulumunun başarılı olduğu (sürüm
yoksa ETARGET) + registry'deki tarball'ın o sürümün davranışını taşıdığını
gösteren bir parmak izi (0.3.1 için: aynı yarım journal'ı 0.3.0 `pass`, 0.3.1
`unknown` diye kurtarıyor). Kök sebep kayıtta: koşum kaydı onu üreten Assay
sürümünü taşımıyor.

**Ad tuzağı.** Bu makinedeki `D:\assay-example` klasörü `ktlesr/assay-example`
DEĞİL; uzağı `ktlesr/skill-trigger-measurements` (ölçüm deposu). Orada secret
yok ve eylem oradan koşamaz. 0.3.0 doğrulamasında bir duman testi iş akışı
yanlışlıkla oraya kondu ve geri alındı.

Kırıcı bir değişiklikte `v1`'i oynatma; `v2` aç ve marketplace listesini
oradan güncelle.

## Bilerek yapılmayanlar

**Dockerfile tabanlı eylem yok.** Composite eylem runner'ın node'unu ve
npm'ini kullanıyor; Docker imajı her koşuma bir imaj çekme maliyeti eklerdi ve
kazandıracağı tek şey Node sürümü izolasyonu — bunu `assay-version` pini zaten
sağlıyor.

**`node_modules` depoya vendor'lanmadı.** JavaScript eylemleri için yaygın
bir kalıp (`dist/` commit etmek) ama bu bir composite eylem: bağımlılıklar
koşum sırasında npm'den geliyor ve sürümleri pinli. Depoya derlenmiş bağımlılık
koymak, ölçüm aracının kendi tedarik zincirini denetlenemez yapardı.
