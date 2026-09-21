# Kurulum — Faz 3.3

Hosted katman tek bir konteyner ve bir Postgres. Ölçüm burada koşmuyor; SDK
kullanıcının makinesinde veya CI'ında koşuyor ve kaydı `assay push` ile
buraya yolluyor. Bu yüzden sunucunun ajan çalıştırma ihtiyacı yok: küçük bir
VPS yeter.

## Gerekli sırlar

Hiçbiri repoda yok ve uydurulmaz. `.env.example` şablonu; gerçek değerler
`.env` dosyasına ya da Dokploy'un ortam değişkenleri ekranına girilir.

| Değişken | Ne | Nasıl üretilir |
|---|---|---|
| `DATABASE_URL` | Postgres adresi | compose kullanılıyorsa otomatik kurulur |
| `POSTGRES_PASSWORD` | Postgres parolası | `openssl rand -base64 24` |
| `AUTH_SECRET` | Oturum imzalama anahtarı | `openssl rand -base64 32` |
| `AUTH_URL` | Sitenin dış adresi | `https://<alan adı>` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google ile giriş | isteğe bağlı; boşsa sağlayıcı gösterilmez |
| `ASSAY_PUBLIC_SITE` | Yayın modu | `true` iken uygulamanın yarısı kapanır (aşağıya bak) |

Açılışta `docker-entrypoint.sh` ilk üçünü denetliyor ve eksikse **konteyner
başlamıyor**: `exit 1`. Ayrıca `AUTH_URL` sonunda eğik çizgi varsa veya https
değilse de duruyor. Yanlış yapılandırılmış bir sürümü yayına almaktansa
dağıtımı düşürmek daha ucuz; Dokploy o sırada eski sürümü ayakta tutuyor.

`DATABASE_POOL_MAX` boş bırakılır. Yalnızca geliştirmedeki PGlite soketiyle
koşarken `1` olmalı.

## Yayın modu — yalnızca tanıtım ve yayımlanmış ölçümler

`ASSAY_PUBLIC_SITE=true` iken yalnızca `/dev` ve `/api/bootstrap` 404 döner
(`apps/web/lib/public-mode.ts`). `/signin`, `/admin` ve `/settings` kimlik
doğrulama arkasında açık kalır (decisions.md, 2026-09-02). Landing'deki giriş
düğmesi ve başlıktaki oturum bağlantısı gizlenir.

Açık kalanlar: `/` (tanıtım), `/runs`, `/suites` ve `/compare` (yalnızca
`public: true` vaka setleri; `/compare` 0.4.1'de açıldı), `/api/health`,
`/api/runs` (token ile korunuyor — kapatılırsa siteye yeni ölçüm yüklenemez).

Sebep ürünle ilgili: assayctl.dev'e gelen kişi bir SaaS'a değil, bir ölçüm
aracının tanıtımına ve gerçek bir koşum çıktısına bakıyor. Boş bir admin
paneline veya kimse için çalışmayan bir giriş ekranına rastlamamalı.

### İki aşamalı ilk kurulum

Yayın modunda giriş kapalı olduğu için yönetici ve token üretimi önce yapılır:

1. `ASSAY_PUBLIC_SITE` **boş** bırakılarak dağıt.
2. Yöneticiyi aç, arayüzden bir API token üret.
3. Yerelden referans ölçümü yükle: `assay push --suite ./suite.yaml`.
4. O vaka setini **public** işaretle (admin > suites).
5. `ASSAY_PUBLIC_SITE=true` yap ve yeniden dağıt.

Sonraki ölçümler `/api/runs` açık olduğu için yayın modunda da yüklenebilir.

## Konteyner

`Dockerfile` üç aşamalı. Koşum aşaması pnpm ağacını değil Next'in standalone
çıktısını taşıyor, kök olarak koşmuyor ve `/api/health` üzerinden sağlık
kontrolü yapıyor. Sağlık kontrolü veritabanına gerçekten bir sorgu atıyor:
"süreç ayakta" ile "uygulama çalışıyor" aynı şey değil.

```
docker compose up -d --build
```

Açılışta `docker-entrypoint.sh` bekleyen migration'ları uyguluyor
(`prisma migrate deploy`). Migration başarısızsa sunucu **başlamıyor** —
yarım şemayla açılan bir örnek, ölçüm kaydını sessizce yarım saklardı.

## Dokploy

1. **Yeni proje → Compose.** Depoyu bağla, dal `main`, dosya
   `docker-compose.yml`.
2. **Ortam değişkenleri**: yukarıdaki tabloyu gir. `AUTH_URL` alan adının
   tamamı olmalı, sonunda eğik çizgi olmadan.
3. **Alan adı**: `web` servisi, port `3000`. TLS'i Dokploy'un Traefik'i
   üstlenir; uygulama HSTS başlığını zaten gönderiyor, bu yüzden alan adı
   HTTPS'e bağlanmadan yayına alınmamalı.
4. **Kalıcı hacim**: `pgdata`. Yeniden kurulumda silinmemeli.
5. **Sağlık kontrolü**: `/api/health`, 200 bekleniyor.
6. İlk yöneticiyi aç — tek seferlik uç:

```
# a) ASSAY_BOOTSTRAP_TOKEN'ı kur (openssl rand -hex 32), yeniden dağıt
# b) bir kez çağır:
curl -X POST https://assayctl.dev/api/bootstrap   -H "Authorization: Bearer <ASSAY_BOOTSTRAP_TOKEN>"   -H "Content-Type: application/json"   -d '{"email":"sen@ornek.com","password":"en-az-12-karakter"}'
# c) ASSAY_BOOTSTRAP_TOKEN'ı sil, yeniden dağıt
```

Kayıt ekranı yok (bkz. docs/decisions.md). Üç kilit var: değişken yoksa uç
**404** döner (varlığı sızmaz), token eşleşmezse **401**, zaten bir yönetici
varsa **409**. Yani değişken açık unutulsa bile ikinci bir yönetici
açılamaz. Uç ayrıca yayın modunda middleware ile kapalı.

Yanlış bir hesap açtıysan aynı uçtan geri al:

```
curl -X DELETE https://assayctl.dev/api/bootstrap   -H "Authorization: Bearer <ASSAY_BOOTSTRAP_TOKEN>"   -H "Content-Type: application/json"   -d '{"email":"yanlis@ornek.com"}'
```

Yalnızca **tek yönetici varken** çalışır: bu ucun işi kurulumu geri almak,
çalışan bir ekipten yönetici budamak değil. Birden çok yönetici varsa `409`
döner ve admin paneli kullanılır. Silme gereğinin sebebi somut: panel
kullanıcı silemiyor ve son yöneticiyi askıya almayı da reddediyor, yani
yanlış açılmış bir ilk hesap oradan düzeltilemiyor.

`tools/create-user.mjs` yalnızca **geliştirme** aracıdır. Üretim imajında yok
ve oraya kopyalansa da `@ktlsr/assay-db` standalone çıktısından çözülemiyor;
ikisi de dağıtımda denendi ve kanıtlandı.

## Yedekleme

Yedeklenecek tek şey Postgres. Koşum kayıtları ayrıca kullanıcının kendi
makinesinde `.assay/runs/` altında duruyor — hosted taraf kaybolursa ölçümler
kaybolmaz, yalnızca geçmiş ve karşılaştırma kaybolur. Bu ayrım kasıtlı
(docs/product.md).

```
docker compose exec db pg_dump -U assay assay | gzip > assay-$(date +%F).sql.gz
```

## Yayına almadan önce

- [ ] `AUTH_SECRET` üretildi ve yalnızca sunucuda duruyor
- [ ] Alan adı HTTPS'te; HSTS başlığı gönderiliyor
- [ ] İlk yönetici hesabı açıldı, parolası 12 karakterden uzun
- [ ] `/api/health` 200 dönüyor
- [ ] Bir koşum `assay push` ile yüklendi ve arayüzde göründü
- [ ] Vaka setleri gizli; yalnızca kasten yayımlananlar `public`
- [ ] Yedekleme komutu bir kez elle koşturuldu ve dosya geri yüklendi
- [ ] `ASSAY_PUBLIC_SITE=true` ve kapalı rotalar gerçekten 404 dönüyor
- [ ] `robots.txt` alan adını doğru gösteriyor
- [ ] Sayfa koyu ve açık temada açılıyor, mobilde yatay kaydırma yok
- [ ] Google OAuth geri dönüş adresi konsola eklendi:
      `https://<alan adı>/api/auth/callback/google`

## Prisma CLI runner aşamasına npm ile kuruluyor

İlk dağıtımda konteyner sonsuz yeniden başlatma döngüsüne girdi:

```
Error: Cannot find module '/app/packages/db/node_modules/prisma/build/index.js'
```

Sebep pnpm'in dizin düzeni. `packages/db/node_modules` sembolik bağlardan
ibaret ve hepsi `/app/node_modules/.pnpm/...` içine işaret ediyor; o store
runner aşamasına kopyalanmadığı için kopyalanan bağlar kırık kalıyordu.
`docker-entrypoint.sh` açılışta `prisma migrate deploy` çalıştırdığı için
konteyner hiç ayağa kalkamadı.

`Dockerfile` artık `packages/db/package.json`'ı kopyalayıp Prisma CLI'yi
npm ile kuruyor. Sürüm manifestodan okunuyor: burada sabitlemek aynı sürümü
iki yerde tutmak olurdu.

Kurulum **nötr bir dizinde** (`/tmp/prisma-cli`) yapılıp `node_modules`
taşınıyor. İlk denemede `npm install` doğrudan `packages/db` içinde
koşturuldu ve düştü:

```
npm error code EUNSUPPORTEDPROTOCOL
npm error Unsupported URL Type "workspace:": workspace:*
```

npm o dizindeki `package.json`'ın tamamını okuyor ve içindeki
`"@ktlsr/assay-core": "workspace:*"` belirtecini tanımıyor. Sürümü oradan
okuyup kurulumu başka yerde yapmak iki gereksinimi de karşılıyor.

Adımın sonunda `test -f .../prisma/build/index.js` var: dosya oluşmadıysa
derleme orada durur, konteyner çalışma zamanında değil.

### Bunun alan adına etkisi

Konteyner ayağa kalkmadığı için Traefik'in yönlendireceği bir arka uç yoktu
ve alan adı Traefik'in kendi 404'ünü döndürüyordu. Teşhis şu ayrıma dayandı:
gelen yanıt `Content-Length: 19` idi (Traefik'in "404 page not found" metni)
ve uygulamanın kendi güvenlik başlıkları (`Content-Security-Policy`,
`Strict-Transport-Security`) yanıtta hiç yoktu. İstek uygulamaya ulaşsaydı
o başlıklar gelirdi.

Bu belirti yanıltıcı: alan adı, ağ ve ortam değişkenleri doğru olsa bile
aynı 404 görünür. **Alan adı 404 dönüyorsa önce konteynerin gerçekten ayakta
olduğuna bak** — Dokploy'un "yeşil" dağıtımı imajın derlendiğini söyler,
konteynerin ayakta kaldığını değil.

### Ağ ve Traefik etiketleri

`docker-compose.yml` bunları **taşımıyor**. Dokploy dağıtım sırasında kendi
Traefik etiketlerini ve ağını compose dosyasına ekliyor; elle eklemek
çakışma üretir. Alan adı ayarı değiştirildiğinde compose'un yeniden
dağıtılması gerekiyor — arayüzde kaydetmek tek başına yetmiyor.

## Port: host'a yayınlanmıyor

`web` servisi 3000'i **host'a bağlamıyor**, yalnızca `expose` ediyor.
Dokploy'un Traefik'i konteynere Docker ağı üzerinden ulaşıyor; host portu hem
gereksiz hem çakışma kaynağı.

İlk dağıtım tam bu yüzden düştü:

```
Bind for 0.0.0.0:3000 failed: port is already allocated
```

Sunucuda 3000'i tutan başka bir şey vardı. Alan adını Dokploy'da bağlarken
yine `web` servisi ve port `3000` seçilir — bu, konteynerin içindeki port.

Compose'u Dokploy'suz tek başına koşturacaksan `docker-compose.yml` içindeki
yorumlu `ports:` satırlarını aç.

## Doğrulanmış olan

**Konteyner imajı derlendi** (2026-09-01, ilk dağıtım denemesi). Prisma
istemcisi üretildi, altı paket derlendi, Next standalone çıktısı ve middleware
(34.4 kB) oluştu, imaj katmanları dışa aktarıldı. Derleme tarafında açık kalan
bir bilinmez yok.

Aynı koşumda bir uyarı görüldü ve kapatıldı: Prisma OpenSSL sürümünü tespit
edemiyor ve tahmine düşüyordu. `Dockerfile` artık `openssl` ve
`ca-certificates` kuruyor — açılışta `migrate deploy` aynı motoru kullandığı
için bunu tahmine bırakmak doğru değildi.
