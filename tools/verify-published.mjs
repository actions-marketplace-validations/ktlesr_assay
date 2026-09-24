/**
 * Yayın sonrası doğrulama.
 *
 * changesets'in "yayımladım" demesi bir iddia; registry'den okumak kanıt.
 * Bu proje host'un başarı bildirimine de aynı sebeple güvenmiyor
 * (packages/adapters, `finalize` çapraz kontrolü).
 *
 * .github/workflows/release.yml tarafından, yalnızca gerçekten yayın
 * yapıldığında çağrılır. PUBLISHED_PACKAGES changesets'in çıktısıdır:
 * [{ name, version }, ...]
 */
import { execFileSync } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { readFileSync } from 'node:fs'

/**
 * Yayımlanan paketleri çalışma alanından okur.
 *
 * changesets'in `publishedPackages` çıktısına güvenilmiyor: kendi yayın
 * komutumuzu (`pnpm -r publish`) kullandığımız için action çıktıyı
 * ayrıştıramıyor ve `published` bayrağını `false` bırakıyor. 0.1.0 yayınında
 * bu yüzden doğrulama adımı sessizce atlandı — paketler yayımlanmıştı ama
 * kimse kontrol etmemişti. Kaynağı manifestolar yapmak bu boşluğu kapatıyor.
 */
function fromWorkspace() {
  return ['core', 'runner', 'adapters', 'cli'].map((dir) => {
    const pkg = JSON.parse(readFileSync(`packages/${dir}/package.json`, 'utf8'))
    return { name: pkg.name, version: pkg.version }
  })
}

const raw = process.env.PUBLISHED_PACKAGES
let packages

if (raw && raw.trim() !== '' && raw.trim() !== '[]') {
  packages = JSON.parse(raw)
} else {
  packages = fromWorkspace()
  console.log('PUBLISHED_PACKAGES boş — manifestolardan okunuyor.')
}

if (!Array.isArray(packages) || packages.length === 0) {
  console.error('::error::doğrulanacak paket bulunamadı')
  process.exit(1)
}

let missing = 0

/**
 * Registry yayılımını bekler.
 *
 * 0.1.2'de dördü de başarıyla yayımlandı ama son paket `npm view`'a iki saniye
 * sonra hâlâ görünmüyordu ve doğrulama işi kırmızıya döndürdü — yayın
 * tamamken. Yanlış alarmın bedeli gerçek alarmdan yüksek: bir daha "yayın
 * eksik kaldı" yazısını kimse ciddiye almaz.
 *
 * Bu yüzden yokluk hemen hata sayılmıyor, birkaç kez artan aralıklarla
 * soruluyor. Sürüm YANLIŞ geldiğinde beklenmiyor: o bir yayılma gecikmesi
 * değil, gerçekten farklı bir cevap.
 *
 * 0.4.6'da pencere (toplam 41 sn) yine yetmedi: `@ktlsr/assay` en son
 * yayımlanan paket ve en geç görünen o; 41. saniyede hâlâ yoktu, birkaç dakika
 * sonra `npm view` gösterdi. Pencere toplam ~2 dakikaya uzatıldı.
 */
const ATTEMPTS = [0, 3000, 6000, 12000, 20000, 30000, 45000]

const lookUp = (spec) => {
  try {
    // `npm view` yayımlanmamış bir sürümde sıfırdan farklı kodla çıkar.
    // Windows'ta `npm` bir .cmd; Node 22 onu kabuk olmadan spawn etmiyor
    // (CVE-2024-27980). CI ubuntu'da kabuk kullanılmıyor.
    return execFileSync('npm', ['view', spec, 'version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    }).trim()
  } catch {
    return null
  }
}

for (const { name, version } of packages) {
  const spec = `${name}@${version}`
  let found = null

  for (const [attempt, wait] of ATTEMPTS.entries()) {
    if (wait > 0) {
      console.log(`  ${spec} henüz görünmüyor, ${wait / 1000}s bekleniyor…`)
      await sleep(wait)
    }
    found = lookUp(spec)
    if (found !== null) break
    if (attempt === ATTEMPTS.length - 1) {
      console.error(
        `::error::${spec} registry'de bulunamadı — yayın eksik kalmış olabilir`,
      )
    }
  }

  if (found === null) {
    missing += 1
  } else if (found === version) {
    console.log(`ok ${spec}`)
  } else {
    console.error(`::error::${spec} bekleniyordu, registry ${found} diyor`)
    missing += 1
  }
}

if (missing > 0) {
  console.error(
    `\n${missing} paket doğrulanamadı. Kısmi yayın olabilir: pnpm publish zaten ` +
      `registry'de olan sürümleri atlar, bu yüzden düzeltme yolu iş akışını ` +
      `yeniden koşmaktır. Ayrıntı: docs/operations.md`,
  )
  process.exit(1)
}

console.log(`\n${packages.length} paketin hepsi registry'de doğrulandı.`)
