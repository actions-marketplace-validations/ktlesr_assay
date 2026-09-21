# İşletim

Yayın hattının bakımı. Süreç ve gerekçe [releasing.md](releasing.md)'de; burası
düzenli olarak yapılması gereken işler ve bir şey bozulduğunda bakılacak yer.

---

## Kimlik doğrulama: trusted publishing

**Saklanan token yok. Yenilenecek bir şey yok.**

Yayın, GitHub'ın verdiği kısa ömürlü ve bu iş akışına özgü bir OIDC kimliğiyle
yapılıyor. npm, `ktlesr/assay` deposunun `release.yml` iş akışını tanıyor ve
yalnızca oradan gelen yayınları kabul ediyor. Token sızması diye bir durum yok,
çünkü ortada sızacak bir sır yok.

Gereken üç şey:

| | |
|---|---|
| npm tarafı | Her paketin *Settings > Trusted Publisher* kaydı: GitHub Actions, `ktlesr/assay`, `release.yml` |
| İş akışı izni | `permissions: id-token: write` |
| Token'ın **yokluğu** | `changesets/action`'a `NPM_TOKEN` verilmiyor; token bulamayınca OIDC'ye düşüyor |

Üçüncüsü ters görünüyor ama kasıtlı. 0.1.0 yayınında log şunu yazdı:

```
No NPM_TOKEN found, but OIDC is available - using npm trusted publishing
```

İş akışına bir `NPM_TOKEN` geri eklenirse OIDC devre dışı kalır ve yayın
token'a döner — yani provenance ve 2FA sorunları geri gelir. **Eklemeyin.**

### Yeni bir paket eklenirse

Trusted publisher kaydı paket başına. `@ktlsr` altına beşinci bir paket
eklenirse ilk yayınından önce onun da kaydı açılmalı, yoksa o paket
`ENEEDAUTH` benzeri bir hatayla düşer.

Yumurta-tavuk sorunu burada da var: trusted publisher paketin npm ayarlar
sayfasından tanımlanıyor, yani paket var olmadan tanımlanamıyor. 0.1.0'da bu
sorun paket adları önceden ayrılarak çözüldü.

### Süresi dolmuş token hatası (tarihsel)

`EOTP` — 0.1.0'ın ilk yayın denemesi bu hatayla düştü:

```
npm error code EOTP
npm error This operation requires a one-time password from your authenticator.
```

Sebep: npm'in varsayılan paket ayarı publish için 2FA ya da bypass-2FA yetkili
token istiyor; sıradan bir granular access token bunu karşılamıyor ve CI
interaktif istemi cevaplayamıyor. Trusted publishing'e geçildikten sonra bu
hata mümkün değil — 2FA sorusu hiç sorulmuyor.

Bu kayıt, aynı hata bir gün token'lı bir yola dönüldüğünde tanınsın diye
duruyor.

## Kısmi yayın

Dört paket sırayla gönderiliyor. Ortada bir hata olursa bir kısmı npm'de kalır.

Bu **onarılabilir bir durum**: `pnpm publish` registry'de zaten var olan bir
sürümü atlar. Düzeltme yolu, sorunu giderip aynı iş akışını yeniden
koşturmaktır — gitmiş paketler atlanır, eksik olanlar gönderilir. Sürüm
numarasını yükseltmen gerekmez.

Yayın sonrası `tools/verify-published.mjs` dört paketi registry'den okuyup
doğruluyor; eksik varsa iş akışı kırmızıya döner. changesets'in "yayımladım"
demesi bir iddia, registry'den okumak kanıt.

---

## Depo görünürlüğü

`github.com/ktlesr/assay` **public** (2026-09-01'de açıldı). İki sonucu var:

- **Provenance üretiliyor.** `release.yml` içinde `id-token: write` ve her
  pakette `publishConfig.provenance: true`.
- **Paket bağlantıları çalışıyor.** Dört README ve dört `package.json`
  (`repository`, `homepage`, `bugs`) içindeki dokuz benzersiz URL 200 dönüyor;
  yayından önce tek tek denendi.

Depo tekrar özele alınırsa ikisi de bozulur: provenance hata verir ve yayın
düşer, npm'deki bağlantılar 404'e döner. Görünürlük değişikliği yayın hattını
ilgilendiren bir karardır.

---

## Ölçüm makinesi: Git Bash domain asılması

**Belirti.** `sh.exe`/`bash.exe` çağrılarının bir kısmı şu satırla ölüyor:

```
0 [main] bash (29304) C:\Program Files\Git\bin\..\usr\bin\bash.exe:
  *** fatal error - add_item ("\??\C:\Program Files\Git", "/", ...) failed, errno 1
```

Ölmeyenler ~15 saniye sürüyor. Git hook'ları (`core.hooksPath .githooks`)
`/bin/sh` üzerinden koştuğu için **her commit bu kumarı oynuyor**; koşum
kütüğünde de sıradan bir araç hatası gibi görünüyor.

**Ölçüldü (düzeltmeden önce).**

| Ölçüm | Sonuç |
|---|---|
| `sh -c 'echo ok'` × 30, sıralı | 9/30 başarısız |
| Aynısı, soğuk paylaşılan bellekle × 8 | **7/8 başarısız**, min **15 063 ms** |
| Bir msys süreci belleği kurduktan sonra × 12 | 0/12, ort **23 ms** |
| Soğuk/ılık ayrımı (deney A) | soğuk 17 582–19 391 ms · ılık 16 ms |
| `impeccable` 4.2.2 ölçümü | 390 Bash çağrısının 11'i (4.2.1'de 403'te 0) |

**Kök neden.** Makine artık var olmayan bir domain'e kayıtlı:

```
Win32_ComputerSystem : PartOfDomain = True, Domain = KA.sibervatan
Resolve-DnsName KA.sibervatan  -> "DNS adı yok"          8 284 ms
nltest /dsgetdc:KA.sibervatan  -> ERROR_NO_SUCH_DOMAIN  15 993 ms
```

Oturum açan kullanıcı yerel (`LOGONSERVER=\\ZAFER-ROG`), yani Windows'un kendisi
etkilenmiyor. Ama msys2 çalışma zamanı hesap çözümünü `nsswitch.conf`taki `db`
kaynağıyla yapıyor ve `db`, makinenin domain'i için `DsGetDcName` çağırıyor. O
çağrı ~16 saniyede zaman aşımına uğruyor; msys'in paylaşılan bellek
başlatmasını seri hâle getiren spinlock ise **15 saniyede pes ediyor**. Süre
dolduğunda ikinci bir süreç kritik bölgeye giriyor, mount tablosunu ikinci kez
kurmaya çalışıyor ve `add_item` EPERM (errno 1) döndürüyor. Ölçülen 15 063 ms'lik
taban, spinlock'un zaman aşımının ta kendisi.

İlk çağrının ardından Windows'un negatif önbelleği (netlogon, varsayılan 45 sn)
cevabı tutuyor; bu yüzden arıza **aralıklı** görünüyor: yoğun çalışırken kaybolur,
birkaç dakika ara verince geri gelir.

**Düzeltme.** `tools/fix-msys-domain-stall.ps1` — yükseltilmiş PowerShell'de:

```powershell
pwsh -NoProfile -File tools\fix-msys-domain-stall.ps1
```

İki dosya değişiyor, ikisi de Git kurulumunun içinde:

| Dosya | Değişiklik |
|---|---|
| `C:\Program Files\Git\etc\passwd` | yoktu; `mkpasswd -c` ile mevcut kullanıcı için üretiliyor |
| `C:\Program Files\Git\etc\nsswitch.conf` | `passwd: files db` → `passwd: files`, `db_enum: none` |

Böylece hesap çözümü dosyadan yapılıyor ve domain'e hiç gidilmiyor. Betik
değişiklikten önce ikisini de `etc\assay-backup-<zaman damgası>\` altına
kopyalıyor, sonra 10 koşumla doğruluyor.

**Geri alma.**

```powershell
pwsh -NoProfile -File tools\fix-msys-domain-stall.ps1 -Rollback
```

En son yedeği geri yükler: `nsswitch.conf` eski hâline döner, betiğin ürettiği
`/etc/passwd` silinir.

**Bilinen sınır.** `/etc/passwd` yalnızca o an oturum açmış kullanıcıyı taşıyor.
Makinede başka bir hesapla çalışılacaksa betik o hesapla bir kez daha
koşturulmalı; aksi hâlde `id -un` o hesabı çözemez. Kalıcı çözüm makineyi ölü
domain'den çıkarmak, ama bu yeniden başlatma ve profil riski demek — ölçüm
makinesinde gerekmiyor.

**Düzeltmeden sonra ölçüldü.**

| Ölçüm | Sonuç |
|---|---|
| Soğuk koşum × 4 (her birinden önce 60 sn bekleme) | **24–40 ms**, 0/4 başarısız |
| Eş zamanlı 6 koşum (çökmeyi tetikleyen durum) | 0/6 başarısız |
| Betiğin kendi doğrulaması × 10 | 0/10, ort 65 ms |
| `id -un` | `ZAFER-ROG+ASUS` — kimlik hâlâ çözülüyor |

Kontrollü deney (aynı msys DLL'i, geçici bir kökte üç yapılandırma, her
ölçümden önce 60 sn önbellek beklemesi):

| Yapılandırma | Soğuk koşum |
|---|---|
| A) sevk edilen `passwd: files db`, `/etc/passwd` yok | 17 582 · 18 061 · 19 391 ms |
| C) sevk edilen yapılandırma + `/etc/passwd` | 14 · 16 · 18 ms |
| B) `passwd: files` + `/etc/passwd` (uygulanan) | 14 · 18 · 19 ms |

Hızı getiren `/etc/passwd`; `passwd: files` ek olarak `/etc/passwd`'de
bulunmayan bir SID'in tekrar domain'e düşmesini kapatıyor.

**Ölçümlere etkisi.** Bu arıza `impeccable` 4.2.2 raporunda bir karıştırıcı
olarak sayıldı ve orada yayımlanan sayılar **değiştirilmiyor**; ölçüm koşulduğu
koşullarla birlikte kayıtlı kalır. Düzeltmeden sonraki koşumlar bu gürültüyü
taşımayacak.
