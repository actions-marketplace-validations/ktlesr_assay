import { describe, expect, it } from 'vitest'
import type { RefusedActivation, TriggerObservation } from './records.js'
import { activationUnverified } from './records.js'
import { evaluateTrigger } from './trigger.js'

const seen = (
  triggered: boolean,
  skills: string[] = triggered ? ['docx'] : [],
  complete = true,
): TriggerObservation => ({
  available: true,
  triggered,
  skills,
  refused: false,
  refusals: [],
  complete,
  via: 'transcript',
})

/**
 * Model skill'i seçti, host aktivasyonu vermedi.
 *
 * `triggered: false` ile birlikte geliyor çünkü aktivasyon olmadı — ama bu
 * "tetiklenmedi" DEĞİL. Ayrımı `refused` taşıyor.
 */
const refused = (
  refusals: RefusedActivation[] = [
    { skill: 'docx', reason: 'the host denied permission for the Skill call' },
  ],
  skills: string[] = [],
): TriggerObservation => ({
  available: true,
  triggered: false,
  skills,
  refused: refusals.some((r) => r.skill === 'docx'),
  refusals,
  complete: true,
  via: 'transcript',
})

const blind = (reason = 'the host emits no skill markers'): TriggerObservation => ({
  available: false,
  reason,
})

describe('evaluateTrigger — iddia yoksa', () => {
  it('vaka tetiklenme hakkında bir şey söylemiyorsa null', () => {
    expect(evaluateTrigger(seen(true), {})).toBeNull()
    expect(evaluateTrigger(blind(), {})).toBeNull()
    expect(evaluateTrigger(seen(true), { notTriggered: [] })).toBeNull()
  })
})

describe('evaluateTrigger — pozitif ve negatif vakalar', () => {
  it.each([
    [true, true, 'pass'],
    [true, false, 'fail'],
    [false, false, 'pass'],
    [false, true, 'fail'],
  ] as const)('gözlem %s, beklenti %s → %s', (observed, expected, verdict) => {
    expect(evaluateTrigger(seen(observed), { triggered: expected })?.verdict).toBe(
      verdict,
    )
  })

  it('fail gerekçesi hangi yönde saptığını söyler', () => {
    expect(evaluateTrigger(seen(false), { triggered: true })?.reason).toContain(
      'did not trigger, but this case expects it to',
    )
    expect(evaluateTrigger(seen(true), { triggered: false })?.reason).toContain(
      'triggered, but this case expects it not to',
    )
  })
})

describe('evaluateTrigger — sinyal okunamıyorsa', () => {
  it('unknown döner, "tetiklenmedi" varsaymaz', () => {
    const result = evaluateTrigger(blind(), { triggered: false })
    expect(result?.verdict).toBe('unknown')
    expect(result?.reason).toContain('could not be read')
  })

  it('okunamayan sinyal hiçbir beklentiyle pass üretmez', () => {
    for (const expectation of [{ triggered: true }, { triggered: false }]) {
      expect(evaluateTrigger(blind(), expectation)?.verdict).not.toBe('pass')
    }
  })

  it("gerekçe host'un verdiği nedeni taşır", () => {
    expect(
      evaluateTrigger(blind('no structured trace'), { triggered: true })?.reason,
    ).toContain('no structured trace')
  })
})

describe('evaluateTrigger — coexistence', () => {
  it('yasaklı skill tetiklenmediyse pass', () => {
    const result = evaluateTrigger(seen(true, ['docx']), {
      triggered: true,
      notTriggered: ['pdf'],
    })
    expect(result?.verdict).toBe('pass')
  })

  it('yasaklı skill tetiklendiyse fail ve adını verir', () => {
    const result = evaluateTrigger(seen(true, ['docx', 'pdf']), {
      triggered: true,
      notTriggered: ['pdf'],
    })
    expect(result?.verdict).toBe('fail')
    expect(result?.reason).toContain('pdf triggered but should not have')
  })

  it('host tam liste vermiyorsa unknown — eksik listeyle "tetiklenmedi" denemez', () => {
    const result = evaluateTrigger(seen(true, ['docx'], false), {
      triggered: true,
      notTriggered: ['pdf'],
    })
    expect(result?.verdict).toBe('unknown')
    expect(result?.reason).toContain('not the full set')
  })

  it('kesin başarısızlık, ölçülemeyen coexistence parçasından önce gelir', () => {
    // Hedef skill tetiklenmemiş: bu kesin bir fail. Coexistence ölçülemiyor
    // olsa bile gerçek bir başarısızlığı unknown'ın arkasına saklamayız.
    const result = evaluateTrigger(seen(false, [], false), {
      triggered: true,
      notTriggered: ['pdf'],
    })
    expect(result?.verdict).toBe('fail')
  })

  it('hedef doğru ama coexistence ölçülemiyorsa unknown', () => {
    const result = evaluateTrigger(seen(true, ['docx'], false), {
      triggered: true,
      notTriggered: ['pdf'],
    })
    expect(result?.verdict).toBe('unknown')
  })
})

/**
 * 0.2.0 — reddedilen aktivasyon üçüncü bir durumdur.
 *
 * Model skill'i seçti, host gövdesini enjekte etmedi. Bunu "tetiklenmedi"
 * saymak iki yönde de yanlış: pozitif vaka `fail` alır ve kullanıcı kırık
 * olmayan bir skill'i tamir etmeye gider; negatif vaka `pass` alır ve modelin
 * skill'e uzandığı gizlenir — değişmez #1'in yasakladığı sessiz geçiş.
 */
describe('evaluateTrigger — reddedilen aktivasyon', () => {
  it('pozitif vaka fail değil unknown alır', () => {
    const result = evaluateTrigger(refused(), { triggered: true })
    expect(result?.verdict).toBe('unknown')
    expect(result?.reason).toContain('selected but its activation was not confirmed')
    expect(result?.reason).toContain('denied permission')
  })

  it('negatif vaka pass değil unknown alır — sessiz geçiş yok', () => {
    const result = evaluateTrigger(refused(), { triggered: false })
    expect(result?.verdict).toBe('unknown')
  })

  it('gerekçe reddin sebebini adıyla söyler', () => {
    const result = evaluateTrigger(
      refused([{ skill: 'docx', reason: 'the Skill call succeeded but carried no skill body' }]),
      { triggered: true },
    )
    expect(result?.reason).toContain('no skill body')
  })

  it('aynı skill başka bir çağrıda aktive olduysa ölçüm vardır', () => {
    // `refused: false` — hedef aktive oldu, red bir şey değiştirmiyor.
    const observation = {
      available: true as const,
      triggered: true,
      skills: ['docx'],
      refused: false,
      refusals: [{ skill: 'docx', reason: 'the Skill call failed' }],
      complete: true,
      via: 'transcript',
    }
    expect(evaluateTrigger(observation, { triggered: true })?.verdict).toBe('pass')
  })

  it('reddedilen bir komşu skill coexistence iddiasını ölçülemez yapar', () => {
    const observation = {
      available: true as const,
      triggered: true,
      skills: ['docx'],
      refused: false,
      refusals: [{ skill: 'pdf', reason: 'the Skill call failed' }],
      complete: true,
      via: 'transcript',
    }
    const result = evaluateTrigger(observation, { triggered: true, notTriggered: ['pdf'] })
    expect(result?.verdict).toBe('unknown')
    expect(result?.reason).toContain('pdf was selected')
  })

  it('gerçekten aktive olmuş bir komşu hâlâ kesin fail', () => {
    // fail > unknown: gerçek bir ihlal, ölçülemeyenin arkasına saklanmaz.
    const observation = {
      available: true as const,
      triggered: true,
      skills: ['docx', 'pdf'],
      refused: false,
      refusals: [{ skill: 'xlsx', reason: 'the Skill call failed' }],
      complete: true,
      via: 'transcript',
    }
    const result = evaluateTrigger(observation, {
      triggered: true,
      notTriggered: ['pdf', 'xlsx'],
    })
    expect(result?.verdict).toBe('fail')
  })
})

/**
 * 0.4.0 — çakışma: kazanan = ilk doğrulanmış aktivasyon.
 *
 * marketingskills koşumunda 100 pozitif deneme, hiçbir skill tetiklenmediği
 * hâlde `pass` sayıldı: vakalar yalnız `not_triggered` ile yazılabiliyordu.
 * Buradaki ilk iki test o farkı yan yana gösteriyor.
 */
describe('evaluateTrigger — winner (0.4.0)', () => {
  const fired = (skills: string[]) => seen(false, skills)

  it('hicbir sey tetiklenmediginde: not_triggered PASS der, winner FAIL der', () => {
    // Eski yol: kaybedenler sessiz kaldı — bu, kazananın kazandığı demek değil.
    expect(evaluateTrigger(fired([]), { notTriggered: ['cro', 'popups'] })?.verdict).toBe('pass')
    const result = evaluateTrigger(fired([]), { winner: ['signup'], notTriggered: ['cro', 'popups'] })
    expect(result?.verdict).toBe('fail')
    expect(result?.reason).toContain('no skill triggered, but this case expects signup to win')
  })

  it('beklenen ilk tetiklenirse pass', () => {
    const result = evaluateTrigger(fired(['signup']), { winner: ['signup'] })
    expect(result?.verdict).toBe('pass')
    expect(result?.reason).toContain('signup triggered first, as expected')
  })

  it('tartismali vakada ikisinden biri ilk olursa pass', () => {
    expect(evaluateTrigger(fired(['copy-editing']), { winner: ['copywriting', 'copy-editing'] })?.verdict).toBe('pass')
    expect(evaluateTrigger(fired(['copywriting']), { winner: ['copywriting', 'copy-editing'] })?.verdict).toBe('pass')
  })

  it('yanlis skill ilk tetiklenirse fail, ve gerekce hangisinin kazandigini soyler', () => {
    const result = evaluateTrigger(fired(['cro']), { winner: ['signup'] })
    expect(result?.verdict).toBe('fail')
    expect(result?.reason).toContain('cro triggered first, but this case expects signup to win')
  })

  it('beklenen ikinci tetiklenirse fail: kazanmak ilk olmaktir', () => {
    expect(evaluateTrigger(fired(['cro', 'signup']), { winner: ['signup'] })?.verdict).toBe('fail')
  })

  it('beklenenden sonra baska bir skill tetiklenirse pass: also fired verdicti bozmaz', () => {
    expect(evaluateTrigger(fired(['signup', 'cro']), { winner: ['signup'] })?.verdict).toBe('pass')
  })

  it('tekillik isteyen not_triggered ekler: sonradan tetiklenen yasakli skill fail', () => {
    const result = evaluateTrigger(fired(['signup', 'cro']), { winner: ['signup'], notTriggered: ['cro'] })
    expect(result?.verdict).toBe('fail')
    expect(result?.reason).toContain('cro triggered but should not have')
  })

  it('winner: none — hicbiri tetiklenmezse pass, biri tetiklenirse fail', () => {
    expect(evaluateTrigger(fired([]), { winner: [] })?.verdict).toBe('pass')
    const result = evaluateTrigger(fired(['pricing']), { winner: [] })
    expect(result?.verdict).toBe('fail')
    expect(result?.reason).toContain('pricing triggered, but this case expects no skill to trigger')
  })

  it('liste eksikse (complete: false) ilk tetikleneni bilemeyiz: unknown', () => {
    expect(evaluateTrigger(seen(false, [], false), { winner: ['signup'] })?.verdict).toBe('unknown')
    expect(evaluateTrigger(seen(false, [], false), { winner: [] })?.verdict).toBe('unknown')
  })

  it('beklenen secilip aktivasyonu reddedildiyse unknown, fail degil', () => {
    const obs = refused([{ skill: 'signup', reason: 'denied' }], ['cro'])
    const result = evaluateTrigger(obs, { winner: ['signup'] })
    expect(result?.verdict).toBe('unknown')
    expect(result?.reason).toContain('signup was selected but its activation was not confirmed')
  })

  it('hicbir aktivasyon dogrulanmayip bir red varsa unknown: kimin kazanacagi bilinmiyor', () => {
    const obs = refused([{ skill: 'cro', reason: 'denied' }], [])
    expect(evaluateTrigger(obs, { winner: ['signup'] })?.verdict).toBe('unknown')
    expect(evaluateTrigger(obs, { winner: [] })?.verdict).toBe('unknown')
  })

  it('sinyal okunamazsa unknown', () => {
    expect(evaluateTrigger(blind(), { winner: ['signup'] })?.verdict).toBe('unknown')
  })

  it('kazanan iddiasi olmayan vaka etkilenmiyor: eski gerekce cumlesi ayni', () => {
    expect(evaluateTrigger(seen(true), { triggered: true })?.reason).toBe(
      'the skill triggered, as expected (via transcript)',
    )
  })
})

/**
 * 0.2.0 öncesi gözlem (0.4.1-a): `refused` ve `refusals` yok. O sürüm seçilen
 * her skill'i tetiklenmiş sayıyordu; eksik alan "red yok" diye okunamaz.
 */
describe('0.2.0 öncesi gözlem', () => {
  const legacy = (skills: string[]): TriggerObservation => ({
    available: true,
    triggered: skills.includes('docx'),
    skills,
    complete: true,
    via: 'transcript',
  })

  it('seçilmiş bir skill üzerine kurulan iddia ölçülmemiştir', () => {
    const result = evaluateTrigger(legacy(['docx']), { triggered: true })
    expect(result?.verdict).toBe('unknown')
    expect(result?.reason).toContain('predates 0.2.0')
  })

  it('hiçbir skill seçilmediyse gözlem tamdır', () => {
    expect(evaluateTrigger(legacy([]), { triggered: false })?.verdict).toBe('pass')
    expect(evaluateTrigger(legacy([]), { triggered: true })?.verdict).toBe('fail')
  })

  it('kayıt düzeyinde işaretlenir', () => {
    const attempt = (trigger: TriggerObservation) => ({ trigger }) as never
    const run = (trigger: TriggerObservation) => ({ cases: [{ attempts: [attempt(trigger)] }] }) as never
    expect(activationUnverified(run(legacy(['docx'])))).toBe(true)
    expect(activationUnverified(run(seen(true)))).toBe(false)
    expect(activationUnverified(run(blind()))).toBe(false)
  })
})
