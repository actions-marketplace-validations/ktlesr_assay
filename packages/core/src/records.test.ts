import { describe, expect, it } from 'vitest'
import {
  assayVersionLabel,
  comparePins,
  formatProportion,
  proportion,
  type Pins,
} from './records.js'

describe('assayVersionLabel — 0.3.2', () => {
  it('surum varsa onu veriyor', () => {
    expect(assayVersionLabel({ assayVersion: '0.3.2' })).toBe('0.3.2')
  })

  it('surum yoksa bos degil, damgadan once yazildigini soyluyor', () => {
    // Alan 0.3.2'de geldi: 0.3.1'in kendi kayıtları da alansız, o yüzden
    // "0.3.1 öncesi" değil "0.3.1 ya da öncesi".
    const label = assayVersionLabel({})
    expect(label).toContain('0.3.1 or earlier')
    expect(label).toContain('predates version stamping')
  })

  it('bos string de surum sayilmiyor', () => {
    expect(assayVersionLabel({ assayVersion: '  ' })).toContain('0.3.1 or earlier')
  })
})

describe('proportion — değişmez #4', () => {
  it('gözlem yoksa oran da aralık da null', () => {
    const p = proportion(0, 0)
    expect(p.rate).toBeNull()
    expect(p.ci).toBeNull()
    expect(formatProportion(p)).toBe('no observations (N=0)')
  })

  it('8/10 için Wilson aralığı yaklaşık %49–%94', () => {
    const p = proportion(8, 10)
    expect(p.rate).toBeCloseTo(0.8, 10)
    expect(p.ci?.low).toBeCloseTo(0.4902, 3)
    expect(p.ci?.high).toBeCloseTo(0.9433, 3)
    expect(formatProportion(p)).toBe('80% (N=10, 95% CI 49%–94%)')
  })

  it("10/10 mükemmel geçişte bile aralık 1'e sıkışmaz", () => {
    const p = proportion(10, 10)
    expect(p.rate).toBe(1)
    expect(p.ci?.low).toBeCloseTo(0.7225, 3)
    expect(p.ci?.high).toBe(1)
  })

  it('N büyüdükçe aralık daralır', () => {
    const width = (n: number) => {
      const p = proportion(Math.round(0.8 * n), n)
      return (p.ci?.high ?? 1) - (p.ci?.low ?? 0)
    }
    expect(width(100)).toBeLessThan(width(10))
    expect(width(1000)).toBeLessThan(width(100))
  })

  it("0/10 alt sınırı 0'ın altına inmez", () => {
    const p = proportion(0, 10)
    expect(p.rate).toBe(0)
    expect(p.ci?.low).toBe(0)
    expect(p.ci?.high).toBeLessThan(0.35)
  })

  it('imkânsız girdiler reddedilir', () => {
    expect(() => proportion(11, 10)).toThrow(RangeError)
    expect(() => proportion(-1, 10)).toThrow(RangeError)
    expect(() => proportion(1.5, 10)).toThrow(RangeError)
  })
})

describe('comparePins — değişmez #2', () => {
  const base: Pins = {
    skillSource: 'anthropics/skills@abc123',
    skillHash: 'sha256:1111',
    model: 'claude-opus-5-20260514',
    systemPromptHash: 'sha256:aaa',
    suiteVersion: 3,
    suiteHash: 'sha256:bbb',
  }

  it('dört pin aynıysa karşılaştırılabilir', () => {
    expect(comparePins(base, { ...base })).toEqual({
      comparable: true,
      drifted: [],
      unavailable: [],
    })
  })

  it.each([
    ['skillSource', 'anthropics/skills@def456'],
    ['skillHash', 'sha256:2222'],
    ['model', 'claude-opus-5-20260601'],
    ['systemPromptHash', 'sha256:ccc'],
    ['suiteHash', 'sha256:ddd'],
  ] as const)('%s kayarsa karşılaştırılamaz', (key, value) => {
    const result = comparePins(base, { ...base, [key]: value })
    expect(result.comparable).toBe(false)
    expect(result.drifted).toEqual([key])
  })

  /**
   * Üçüncü durum: ölçülemedi.
   *
   * Host bir pini vermediğinde alan bir yer tutucu taşıyor. İki koşumda da aynı
   * yer tutucu bulunuyordu ve saf eşitlik bunu "tuttu" sayıyordu — ölçülmemiş
   * bir koşula karşılaştırılabilirlik garantisi veriliyordu.
   */
  describe('ölçülemeyen pin', () => {
    const blind: Pins = { ...base, systemPromptHash: 'not-provided-by-host' }

    it('iki tarafta da yer tutucuysa "tuttu" sayılmaz', () => {
      const result = comparePins(blind, { ...blind })
      expect(result.comparable).toBe(false)
      expect(result.unavailable).toEqual(['systemPromptHash'])
      expect(result.drifted).toEqual([])
    })

    it('boş bir denetçi hash de ölçülemedi sayılır', () => {
      const result = comparePins({ ...base, skillHash: '' }, { ...base, skillHash: '' })
      expect(result.comparable).toBe(false)
      expect(result.unavailable).toEqual(['skillHash'])
    })

    it('ortam hash degeri esitse pin 3 kapsanir ve karsilastirma acilir', () => {
      const covered: Pins = { ...blind, environmentHash: 'sha256:env' }
      const result = comparePins(covered, { ...covered })
      expect(result.comparable).toBe(true)
      expect(result.unavailable).toEqual([])
    })

    /**
     * 0.3.0-a: kayan alan kendi adıyla raporlanır.
     *
     * Bu testin eski hâli `drifted: ['systemPromptHash']` bekliyordu, yani
     * kusuru kodluyordu. Gerçek bir koşumda görüldü: iki kayıtta da
     * `systemPromptHash` `not-provided-by-host` iken çapraz izin modu
     * karşılaştırması "systemPromptHash changed" dedi. Karar doğruydu
     * (karşılaştırma durmalı), gerekçe yanlış adres veriyordu — kullanıcı hiç
     * kımıldamamış bir sistem promptunu aramaya gönderiliyordu.
     */
    it('ortam hash kayarsa kayan alan environmentHash olarak raporlanir', () => {
      const a: Pins = { ...blind, environmentHash: 'sha256:env-a' }
      const b: Pins = { ...blind, environmentHash: 'sha256:env-b' }
      const result = comparePins(a, b)
      expect(result.comparable).toBe(false)
      expect(result.drifted).toEqual(['environmentHash'])
    })

    it('ortam hash kayinca systemPromptHash hicbir listede anilmaz', () => {
      const a: Pins = { ...blind, environmentHash: 'sha256:env-a' }
      const b: Pins = { ...blind, environmentHash: 'sha256:env-b' }
      const result = comparePins(a, b)
      // Denetçi zaten "koşullar değişti" dedi; denetlenen pini ayrıca
      // "ölçülemedi" diye saymak aynı olayı iki kez ve iki farklı adla
      // raporlamak olur.
      expect(result.drifted).not.toContain('systemPromptHash')
      expect(result.unavailable).not.toContain('systemPromptHash')
    })

    it('host gercekten sistem promptu hash i veriyorsa o kayar', () => {
      const seeing: Pins = { ...base, systemPromptHash: 'sha256:sp-a' }
      const result = comparePins(seeing, { ...seeing, systemPromptHash: 'sha256:sp-b' })
      expect(result.drifted).toEqual(['systemPromptHash'])
    })

    it('ortam hash yalnızca bir tarafta varsa kapsamaz', () => {
      const result = comparePins({ ...blind, environmentHash: 'sha256:env' }, blind)
      expect(result.comparable).toBe(false)
      expect(result.unavailable).toEqual(['systemPromptHash'])
    })
  })

  it('suite sürümü artınca da karşılaştırılamaz', () => {
    expect(comparePins(base, { ...base, suiteVersion: 4 }).drifted).toEqual([
      'suiteVersion',
    ])
  })

  it('birden çok kayma hepsini listeler', () => {
    const result = comparePins(base, { ...base, model: 'x', suiteHash: 'y' })
    expect(result.drifted).toEqual(['model', 'suiteHash'])
  })
})
