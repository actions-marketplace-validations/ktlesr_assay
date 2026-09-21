import { describe, expect, it } from 'vitest'
import {
  containsHomePath,
  containsName,
  containsSecret,
  redact,
  redactDeep,
} from './redact.js'

describe('sır maskeleme', () => {
  it('bilinen anahtar biçimlerini maskeler', () => {
    // Desen kaynakta düz yazılmıyor: `tools/scan-history.mjs` takip edilen
    // dosyalarda sır deseni arıyor ve kendi testimizi sızıntı sanıyordu.
    const text = `key=${['sk', 'ant', 'api01'].join('-')}-abcdefghijklmnopqrstuvwxyz012345`
    expect(redact(text)).toBe('key=[redacted:anthropic-api-key]')
    expect(containsSecret(text)).toBe(true)
  })
})

/**
 * Ev dizini yolları.
 *
 * Kayıt CI artefaktı olarak yükleniyor, HTML raporuna basılıyor ve hosted
 * tarafta yayımlanabiliyor. İz metinleri mutlak yollarla dolu ve o yollar
 * işletim sistemi kullanıcı adını taşıyor — yani bir skill yazarı kendi
 * koşumunu paylaştığında makine kullanıcı adını da paylaşıyor.
 */
describe('ev dizini maskeleme', () => {
  it('Windows kullanıcı adını maskeler, yolun geri kalanını korur', () => {
    const text = String.raw`Base directory: C:\Users\ada\AppData\Local\Temp\assay-skill-Mbz\skills`
    expect(redact(text)).toBe(
      String.raw`Base directory: C:\Users\<user>\AppData\Local\Temp\assay-skill-Mbz\skills`,
    )
  })

  it('Windows yolunu eğik çizgiyle yazılmış hâlinde de yakalar', () => {
    expect(redact('python C:/Users/ada/Temp/out/test.py')).toBe(
      'python C:/Users/<user>/Temp/out/test.py',
    )
  })

  it('macOS ve Linux ev dizinlerini maskeler', () => {
    expect(redact('open /Users/ada/projects/app/index.html')).toBe(
      'open /Users/<user>/projects/app/index.html',
    )
    expect(redact('cd /home/ada/work && ls')).toBe('cd /home/<user>/work && ls')
  })

  // CI koşucusu bir kimlik değil; maskelemek yolu okunmaz yapar, kimseyi korumaz.
  it('genel hesap adlarına dokunmaz', () => {
    const ci = '/home/runner/work/assay/assay'
    expect(redact(ci)).toBe(ci)
    expect(containsHomePath(ci)).toBe(false)
  })

  it('maskelenmiş metni yeniden maskelemez', () => {
    const once = redact(String.raw`C:\Users\ada\x`)
    expect(redact(once)).toBe(once)
  })

  it('sızıntıyı tespit eder ve maskeledikten sonra tespit etmez', () => {
    const text = 'ran /Users/ada/bin/tool'
    expect(containsHomePath(text)).toBe(true)
    expect(containsHomePath(redact(text))).toBe(false)
  })

  // Asıl sızıntı yüzeyi: iz olaylarının metni ve araç argümanları.
  it('iç içe iz nesnelerinde de maskeler', () => {
    const trace = [
      {
        kind: 'tool_call',
        tool: 'Read',
        args: { file_path: String.raw`C:\Users\ada\Temp\app\index.html` },
      },
      { kind: 'assistant_message', text: 'I read /home/ada/notes.md first.' },
    ]
    const clean = redactDeep(trace)
    expect(JSON.stringify(clean)).not.toContain('ada')
    expect(clean[0]?.args?.file_path).toBe(
      String.raw`C:\Users\<user>\Temp\app\index.html`,
    )
    expect(clean[1]?.text).toBe('I read /home/<user>/notes.md first.')
  })
})

/**
 * `scrub`un gerçek kayıtlarda kaçırdığı üç biçim (0.4.1-b, 2026-09-10).
 * Seçilen sekiz kayıtta 68 kullanıcı adı bu biçimlerde kalmıştı; örnekler o
 * kayıtlardan, ad `ada` ile değiştirilerek alındı.
 */
describe('scrub kaçakları', () => {
  it('ters bölüleri yenmiş yolu maskeler', () => {
    // Ajanın kabuğu `C:\Users\ada\AppData` yazımını düzleştirmişti.
    const text =
      "ls: cannot access 'C:UsersadaAppDataLocalTempassay-attempt-x': No such file"
    expect(redact(text)).toBe(
      "ls: cannot access 'C:Users<user>AppDataLocalTempassay-attempt-x': No such file",
    )
    expect(containsHomePath(text)).toBe(true)
  })

  it('profil klasörü tanınmıyorsa maskeyi yolun sonuna kadar uzatır', () => {
    expect(redact("'C:Usersada.claudeprojects' done")).toBe("'C:Users<user>' done")
  })

  it('Claude Code proje adındaki kullanıcı adını maskeler', () => {
    const slash = '/tmp/assay-cc-93QS4f/projects/C--Users-ada/memory'
    expect(redact(slash)).toBe('/tmp/assay-cc-93QS4f/projects/C--Users-<user>/memory')
    expect(redact(String.raw`cc\projects\C--Users-ada\memory`)).toBe(
      String.raw`cc\projects\C--Users-<user>\memory`,
    )
  })

  it('kod dizgesindeki çift kaçışlı yolu maskeler', () => {
    // JSON'da dört, dizgede iki ters bölü: ajanın yazdığı JS literali.
    const text = String.raw`fs.createWriteStream('C:\\Users\\ada\\AppData\\Local\\out.log')`
    expect(text).toContain('\\\\Users\\\\')
    expect(redact(text)).toBe(
      String.raw`fs.createWriteStream('C:\\Users\\<user>\\AppData\\Local\\out.log')`,
    )
  })

  it('üç biçimin maskelenmiş hâlini yeniden maskelemez', () => {
    const once = redact(String.raw`C:UsersadaAppData C--Users-ada/m C:\\Users\\ada\\x`)
    expect(redact(once)).toBe(once)
    expect(containsHomePath(once)).toBe(false)
  })
})

describe('bilinen ad', () => {
  it('desenlerin tavanını kapatır: tireli ve noktalı ad', () => {
    const names = ['ada.lovelace']
    expect(redact('C--Users-ada-lovelace/memory', { names })).toBe(
      'C--Users-<user>/memory',
    )
    expect(redact('C:Usersada.lovelaceNotes', { names })).toBe('C:Users<user>Notes')
  })

  it('genel hesap adını bilinen ad olarak da maskelemez', () => {
    expect(redact('/home/runner/x', { names: ['runner'] })).toBe('/home/runner/x')
  })

  it('yol dışındaki geçişi maskelemez ama bildirir', () => {
    const text = 'Author: Ada <ada@example.com>'
    expect(redact(text, { names: ['ada'] })).toBe(text)
    expect(containsName(text, ['ada'])).toBe(true)
    expect(containsName('the adapter loaded', ['ada'])).toBe(false)
  })
})
