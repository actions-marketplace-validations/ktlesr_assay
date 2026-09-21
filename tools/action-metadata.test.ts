import { existsSync, readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'

/**
 * GitHub Actions Marketplace'in yayın koşulları.
 *
 * Bunlar bir stil tercihi değil, yayının kabul edilme şartları ve hepsi
 * sessizce bozulabilir: dosya taşınır, `branding` silinir, ad değişir. Yayın
 * anında öğrenmek yerine testte öğrenmek istiyoruz — depo bir kez
 * yayımlandıktan sonra kırık bir `action.yml` marketplace listesini düşürür.
 *
 * Kaynak: docs.github.com — "Publishing actions in GitHub Marketplace".
 */
const raw = existsSync('action.yml') ? readFileSync('action.yml', 'utf8') : null
const action = raw === null ? null : (parse(raw) as Record<string, unknown>)

/**
 * İki sürümü sayısal olarak karşılaştırır: `a < b` → negatif, eşit → 0.
 *
 * Sözlük sırası kullanılamaz: `'0.10.0' < '0.9.0'` doğru çıkar ve kural sessizce
 * tersine döner.
 */
export function compareSemver(a: string, b: string): number {
  const parts = (value: string) => value.split('.').map((piece) => Number(piece))
  const left = parts(a)
  const right = parts(b)
  for (let i = 0; i < 3; i += 1) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

describe('marketplace koşulları', () => {
  it('eylem tanımı deponun KÖKÜNDE', () => {
    // Marketplace kökte arıyor. `action/action.yml` çalışan bir eylemdi ama
    // yayımlanamıyordu; bu testin var olma sebebi o.
    expect(raw).not.toBeNull()
    expect(existsSync('action/action.yml')).toBe(false)
  })

  it('tek bir eylem tanımı var', () => {
    // "Deponuz yalnızca bir eylem içermeli" — iki tanım yayını reddettiriyor.
    expect(existsSync('action/action.yml')).toBe(false)
  })

  it('ad, açıklama ve yazar dolu', () => {
    expect(typeof action?.['name']).toBe('string')
    expect(String(action?.['name']).length).toBeGreaterThan(0)
    expect(String(action?.['description']).length).toBeGreaterThan(20)
    expect(String(action?.['author']).length).toBeGreaterThan(0)
  })

  it('branding ikon ve rengi geçerli', () => {
    const branding = action?.['branding'] as { icon?: string; color?: string } | undefined
    expect(branding).toBeDefined()
    // Marketplace yalnızca bu beş rengi kabul ediyor.
    expect(['white', 'yellow', 'blue', 'green', 'orange', 'red', 'purple', 'gray-dark'])
      .toContain(branding?.color)
    expect(String(branding?.icon).length).toBeGreaterThan(0)
  })

  it('betik yolları kökten çözülüyor', () => {
    // Tanım köke taşındı ama betikler `action/` altında kaldı; yolların
    // güncellenmemesi eylemi çalışma zamanında düşürürdü.
    const steps = (action?.['runs'] as { steps?: { run?: string }[] } | undefined)?.steps
    const commands = (steps ?? []).map((step) => step.run ?? '').join('\n')
    for (const script of ['action/run.mjs', 'action/comment.mjs']) {
      expect(commands).toContain(script)
      expect(existsSync(script)).toBe(true)
    }
  })

  it('kimlik bilgisi girdisi var ve zorunlu tutulmuyor', () => {
    // İkisinden biri yeterli, o yüzden ikisi de `required: false`; eksikliği
    // eylem kendi adımında kontrol ediyor ve net bir hata veriyor.
    const inputs = action?.['inputs'] as Record<string, { required?: boolean }>
    expect(inputs['anthropic-api-key']).toBeDefined()
    expect(inputs['claude-code-oauth-token']).toBeDefined()
    expect(inputs['anthropic-api-key']?.required ?? false).toBe(false)
  })

  it('CLI sürümü pinli — ölçüm aracının kendisi kaymaz', () => {
    const inputs = action?.['inputs'] as Record<string, { default?: string }>
    const pinned = String(inputs['assay-version']?.default ?? '')
    expect(pinned).toMatch(/^\d+\.\d+\.\d+$/)
  })

  /*
   * Pin, deponun sürümünden GERİDE olamaz — ama ileride olabilir.
   *
   * Eskiden tam eşitlik aranıyordu ve bu, yayın sırasıyla çelişiyordu:
   * manifest önce hareket ediyor (sürüm PR'ı), npm sonra (elle tetiklenen
   * yayın koşumu). Aradaki pencerede pin, henüz yayımlanmamış bir sürümü
   * gösteriyor ve tam eşitlik testi depoyu kırmızıya çeviriyordu — ölçülen
   * şey bir kusur değil, hattın kendi sırasıydı.
   *
   * Tutulan asıl kural yönlü: pin geride kalırsa eylem, deponun ürettiğinden
   * ESKİ bir CLI kuruyor demektir ve bu sessizce yanlış ölçüm üretir —
   * `assay scrub` olmayan bir sürüm maskelenmemiş kayıt yükler, 0.1.3 öncesi
   * bir sürüm kimlik hatasını `fail` diye raporlar. Bu yüzden geride kalmak
   * hata, ileride olmak değil.
   *
   * npm'e bakılmıyor, bilerek: bir birim testinin ağa çıkması onu
   * kararsızlaştırırdı ve zaten yayın penceresi boyunca kırmızı verirdi.
   * Tavan açık — 9.9.9 gibi bir yazım hatası burada yakalanmaz; onu yayın
   * sonrası `verify-published.mjs` ve eylemin kendi kurulum adımı yakalar.
   */
  it('pin deponun sürümünden geride değil', () => {
    const inputs = action?.['inputs'] as Record<string, { default?: string }>
    const pinned = String(inputs['assay-version']?.default ?? '')
    const manifest = JSON.parse(readFileSync('packages/cli/package.json', 'utf8')) as {
      version: string
    }
    expect(
      compareSemver(pinned, manifest.version),
      `action.yml pini ${pinned}, depo sürümü ${manifest.version}: pin geride kalamaz`,
    ).toBeGreaterThanOrEqual(0)
  })

  it('kural yönlü: geri sürüm hata, ileri sürüm değil', () => {
    // Kuralın kendisi sınanıyor — testin yalnızca bugünkü değerlerle
    // yeşil olması, yönünün doğru olduğunu göstermez.
    expect(compareSemver('0.1.3', '0.2.0')).toBeLessThan(0) // geride → hata
    expect(compareSemver('0.2.0', '0.2.0')).toBe(0) // eşit → kabul
    expect(compareSemver('0.2.1', '0.2.0')).toBeGreaterThan(0) // ileride → kabul
    // Sözlük sırası burada yanılırdı: '0.10.0' < '0.9.0' der.
    expect(compareSemver('0.10.0', '0.9.0')).toBeGreaterThan(0)
    expect(compareSemver('1.0.0', '0.99.99')).toBeGreaterThan(0)
  })

  it('gizli girdiler kütüğe yazılmıyor', () => {
    // `echo`/`cat` ile bir secret'ı basmak onu koşum kütüğüne koyar ve kütük
    // deponun okuyucularına açıktır.
    expect(raw).not.toMatch(/echo .*inputs\.(anthropic-api-key|claude-code-oauth-token)/)
  })
})
