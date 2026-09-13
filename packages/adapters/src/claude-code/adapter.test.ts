import { describe, expect, it } from 'vitest'
import {
  ClaudeCodeAdapter,
  environmentHash,
  environmentOf,
  passthroughEnv,
  skillMatches,
} from './adapter.js'
import type { ClaudeCodeSession } from './adapter.js'
import type { ParsedStream } from './stream.js'

/**
 * Adaptörün karar mantığı — gerçek koşum yapmadan. Akış ayrıştırması
 * stream.test.ts'te gerçek fixture'larla sınanıyor; burada sınanan şey,
 * ayrıştırılmış bir oturumdan hangi sinyalin üretildiği.
 */

const init: NonNullable<ParsedStream['init']> = {
  sessionId: 's1',
  model: 'claude-haiku-4-5-20251001',
  cwd: '/w',
  version: '2.1.251',
  permissionMode: 'dontAsk',
  outputStyle: 'default',
  tools: ['Read', 'Write'],
  skills: ['widget-manifest'],
  agents: [],
  plugins: [{ name: 'assay-probe', version: '0.0.1' }],
}

const healthyResult = {
  subtype: 'success',
  isError: false,
  numTurns: 2,
  terminalReason: 'completed',
  inputTokens: 10,
  outputTokens: 42,
  costUsd: 0.01,
  permissionDenials: [],
}

/**
 * Test oturumu. `parsed` kısmi verilir: her test yalnızca ilgilendiği alanı
 * yazsın, gerisi sağlam bir oturumdan gelsin. (Kısmi tip, `as ParsedStream`
 * dökümlerinin yerini aldı — akışa yeni bir alan eklendiğinde döküm sessizce
 * kırılıyordu.)
 */
type SessionOverrides = Partial<Omit<ClaudeCodeSession, 'parsed'>> & {
  // `| undefined`: "alanı hiç verme" ile "açıkça yok" ayrı iki senaryo ve
  // ikincisi burada sınanan şey (init ya da result gelmemiş bir akış).
  parsed?: { [K in keyof ParsedStream]?: ParsedStream[K] | undefined }
}

function session(overrides: SessionOverrides = {}): ClaudeCodeSession {
  // Tek döküm, tek yerde: bir test `result: undefined` diyerek alanı bilerek
  // SİLEBİLİYOR ve `exactOptionalPropertyTypes` altında bu birleşimin tipi
  // `ParsedStream` olmuyor. Çağrı yerlerinde döküm yok; akışa yeni bir alan
  // eklendiğinde varsayılan nesne kırmızıya döner.
  const parsed = {
    init,
    result: healthyResult,
    trace: [{ seq: 1, kind: 'session_end', outcome: 'completed' }],
    triggeredSkills: [],
    refusals: [],
    malformed: 0,
    ...(overrides.parsed ?? {}),
  } as ParsedStream
  return {
    id: 'claude-code-c-0-s1',
    adapter: 'claude-code',
    startedAt: new Date(0).toISOString(),
    targetSkill: 'widget-manifest',
    exitCode: 0,
    latencyMs: 1000,
    stderr: '',
    configDir: '/tmp/x',
    ...overrides,
    parsed,
  }
}

const adapter = new ClaudeCodeAdapter({ cleanup: false })

describe('skillMatches', () => {
  it.each([
    ['widget-manifest', 'widget-manifest', true],
    ['assay-probe:widget-manifest', 'widget-manifest', true],
    ['other:widget-manifest', 'widget-manifest', true],
    ['widget-manifest-v2', 'widget-manifest', false],
    ['assay-probe:other', 'widget-manifest', false],
    ['', 'widget-manifest', false],
  ])('%s vs %s → %s', (observed, target, expected) => {
    expect(skillMatches(observed, target)).toBe(expected)
  })
})

describe('readTriggerSignal — sağlam oturum', () => {
  it('Skill çağrısı varsa triggered true', async () => {
    const observation = await adapter.readTriggerSignal(
      session({
        parsed: { triggeredSkills: ['assay-probe:widget-manifest'] },
      }),
    )
    expect(observation).toMatchObject({
      available: true,
      triggered: true,
      complete: true,
    })
  })

  it('Skill çağrısı yoksa triggered false — bu bir gözlem, varsayım değil', async () => {
    const observation = await adapter.readTriggerSignal(session())
    expect(observation).toMatchObject({ available: true, triggered: false, skills: [] })
  })

  it('skills ilk aktivasyon sirasinda ve tekrarsiz: ilk eleman ilk tetiklenen (0.4.0)', async () => {
    // Çakışma değerlendirmesi kazananı skills[0] olarak okuyor; sıra bir sözleşme.
    const observation = await adapter.readTriggerSignal(
      session({ parsed: { triggeredSkills: ['cro', 'signup', 'cro', 'popups'] } }),
    )
    expect(observation).toMatchObject({ skills: ['cro', 'signup', 'popups'] })
  })

  it('başka bir skill tetiklendiyse listede görünür ama triggered false', async () => {
    const observation = await adapter.readTriggerSignal(
      session({ parsed: { triggeredSkills: ['pdf'] } }),
    )
    expect(observation).toMatchObject({
      available: true,
      triggered: false,
      skills: ['pdf'],
    })
  })

  it('via alanı sinyalin kaynağını söyler', async () => {
    // 0.2.0: sinyal artık "Skill çağrısı" değil "doğrulanmış Skill
    // aktivasyonu". Eski ifade tam olarak düzeltilen hatayı tarif ediyordu.
    const observation = await adapter.readTriggerSignal(session())
    expect(observation.available && observation.via).toContain(
      'confirmed Skill activation',
    )
  })
})

/**
 * 0.2.0 — reddedilen aktivasyon tetiklenme değil.
 *
 * Impeccable pilotunda dört kayıtlı tetiklenmenin dördü de reddedilmişti;
 * adaptör hepsini `triggered: true` diye bildirdi.
 */
describe('readTriggerSignal — reddedilen aktivasyon', () => {
  const refusal = {
    skill: 'assay-probe:widget-manifest',
    reason: 'the host denied permission for the Skill call, so the skill never loaded',
  }

  it('reddedilen hedef skill triggered false ve refused true', async () => {
    const observation = await adapter.readTriggerSignal(
      session({ parsed: { triggeredSkills: [], refusals: [refusal] } }),
    )
    expect(observation).toMatchObject({
      available: true,
      triggered: false,
      refused: true,
    })
    expect(observation.available && observation.refusals).toEqual([refusal])
  })

  it('reddedilen skill "tetiklenen skill"ler listesine girmez', async () => {
    const observation = await adapter.readTriggerSignal(
      session({ parsed: { triggeredSkills: [], refusals: [refusal] } }),
    )
    expect(observation.available && observation.skills).toEqual([])
  })

  it('hedef başka bir çağrıda aktive olduysa refused false', async () => {
    const observation = await adapter.readTriggerSignal(
      session({
        parsed: {
          triggeredSkills: ['assay-probe:widget-manifest'],
          refusals: [refusal],
        },
      }),
    )
    expect(observation).toMatchObject({ triggered: true, refused: false })
  })

  it('reddedilen başka bir skill hedefi etkilemez', async () => {
    const observation = await adapter.readTriggerSignal(
      session({
        parsed: {
          triggeredSkills: [],
          refusals: [{ skill: 'pdf', reason: 'the Skill call failed' }],
        },
      }),
    )
    expect(observation).toMatchObject({ triggered: false, refused: false })
  })
})

describe('readTriggerSignal — çapraz kontrol düşerse okunamadı', () => {
  const broken: ReadonlyArray<[string, SessionOverrides, string]> = [
    [
      'result olayı hiç yok',
      { parsed: { result: undefined } },
      'no result event',
    ],
    [
      'host hata bildirdi',
      { parsed: { result: { ...healthyResult, isError: true } } },
      'reported an error',
    ],
    [
      'sıfır tur',
      { parsed: { result: { ...healthyResult, numTurns: 0 } } },
      'zero turns',
    ],
    [
      'hiç çıktı token üretilmedi',
      { parsed: { result: { ...healthyResult, outputTokens: 0 } } },
      'no output tokens',
    ],
    [
      'oturum completed değil',
      {
        parsed: {
          result: { ...healthyResult, terminalReason: 'api_error' },
        },
      },
      'ended as "api_error"',
    ],
    ['süreç hiç başlamadı', { spawnError: 'ENOENT' }, 'could not be started'],
  ]

  it.each(broken)('%s → available: false', async (_name, overrides, fragment) => {
    const observation = await adapter.readTriggerSignal(session(overrides))
    expect(observation.available).toBe(false)
    expect(!observation.available && observation.reason).toContain(fragment)
  })

  it('bozuk oturum asla triggered: false üretmez — "tetiklenmedi" ile karışmaz', async () => {
    for (const [, overrides] of broken) {
      const observation = await adapter.readTriggerSignal(session(overrides))
      expect(observation).not.toHaveProperty('triggered')
    }
  })

  it('init yoksa aktif skill seti bilinmiyor demektir', async () => {
    const observation = await adapter.readTriggerSignal(
      session({ parsed: { init: undefined } }),
    )
    expect(observation.available).toBe(false)
    expect(!observation.available && observation.reason).toContain('no system/init')
  })
})

describe('readTrace', () => {
  it('iz varsa döner', async () => {
    expect(await adapter.readTrace(session())).toHaveLength(1)
  })

  it('süreç başlamadıysa undefined — boş dizi değil', async () => {
    expect(await adapter.readTrace(session({ spawnError: 'ENOENT' }))).toBeUndefined()
  })

  it('akış hiç gelmediyse undefined', async () => {
    const empty = session({
      parsed: { trace: [], result: undefined },
    })
    expect(await adapter.readTrace(empty)).toBeUndefined()
  })
})

describe('finalize', () => {
  it('sağlam oturum completed, maliyet ve gecikme taşır', async () => {
    const result = await adapter.finalize(session())
    expect(result.outcome).toBe('completed')
    expect(result.cost).toEqual({ inputTokens: 10, outputTokens: 42, usd: 0.01 })
  })

  it('sistem promptu hash alanı boş kalır — host vermiyor, uydurulmaz', async () => {
    const result = await adapter.finalize(session())
    expect(result.systemPromptHash).toBeUndefined()
  })

  it('ortam hash türetilir ve aktif skill seti raporlanır', async () => {
    const result = await adapter.finalize(session())
    expect(result.environmentHash).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(result.activeSkills).toEqual(['widget-manifest'])
  })

  /**
   * 0.3.0-a: hash'in girdisi olan nesne de kayda giriyor. Hash "bir şey
   * değişti" diyebiliyor, "ne değişti" diyemiyor.
   */
  it('ortam kaydi da doner ve hash in girdisiyle ayni nesnedir', async () => {
    const result = await adapter.finalize(session())
    expect(result.environment).toEqual(environmentOf(init))
    expect(result.environment?.skills).toEqual(['widget-manifest'])
    expect(result.environment?.permissionMode).toBe('dontAsk')
    // Hash gerçekten bu nesneden hesaplanıyor: ikisi ayrışırsa rapor kayan
    // alanı yanlış gösterirdi.
    expect(result.environmentHash).toBe(environmentHash(init))
  })

  it('ortam kaydi olmayan bir oturumda alan hic yazilmaz', async () => {
    const result = await adapter.finalize(session({ parsed: { init: undefined } }))
    expect(result.environment).toBeUndefined()
    expect(result.environmentHash).toBeUndefined()
  })

  it('çapraz kontrol düşerse outcome error', async () => {
    const result = await adapter.finalize(
      session({
        parsed: { result: { ...healthyResult, outputTokens: 0 } },
      }),
    )
    expect(result.outcome).toBe('error')
  })

  it('terminal_reason completed değilse aborted', async () => {
    const result = await adapter.finalize(
      session({
        parsed: {
          result: { ...healthyResult, terminalReason: 'interrupted' },
        },
      }),
    )
    expect(result.outcome).not.toBe('completed')
  })
})

describe('environmentHash', () => {
  it('aynı ortam aynı hash', () => {
    expect(environmentHash(init)).toBe(environmentHash({ ...init }))
  })

  it('liste sırası hash değiştirmez', () => {
    expect(environmentHash({ ...init, tools: ['Write', 'Read'] })).toBe(
      environmentHash(init),
    )
  })

  it.each([
    ['model', { model: 'other' }],
    ['sürüm', { version: '9.9.9' }],
    ['skill seti', { skills: ['widget-manifest', 'pdf'] }],
    ['araç seti', { tools: ['Read'] }],
    ['output style', { outputStyle: 'explanatory' }],
    ['plugin sürümü', { plugins: [{ name: 'assay-probe', version: '0.0.2' }] }],
    // 0.2.0: mod dışarı açıldı, yani ölçümün bir koşulu oldu. Hash'te
    // olmasaydı iki farklı ölçüm karşılaştırılabilir görünürdü.
    ['izin modu', { permissionMode: 'bypassPermissions' }],
  ])('%s değişince hash değişir', (_name, patch) => {
    expect(environmentHash({ ...init, ...patch })).not.toBe(environmentHash(init))
  })
})

describe('izin politikası', () => {
  it('varsayılan olarak ağ araçları reddedilir', () => {
    expect(new ClaudeCodeAdapter().deniedTools).toEqual(['WebFetch', 'WebSearch'])
  })

  it('çağıran listeyi değiştirebilir', () => {
    expect(new ClaudeCodeAdapter({ deniedTools: [] }).deniedTools).toEqual([])
  })

  it('varsayılan izin modu acceptEdits — 0.2.0 bunu değiştirmedi', () => {
    expect(new ClaudeCodeAdapter().permissionMode).toBe('acceptEdits')
  })

  it('izin modu dışarıdan verilebilir', () => {
    expect(new ClaudeCodeAdapter({ permissionMode: 'plan' }).permissionMode).toBe('plan')
  })

  it("finalize host'un BİLDİRDİĞİ modu raporlar, adaptörün istediğini değil", async () => {
    // Fixture'daki init dontAsk diyor; adaptör acceptEdits istedi. Kayda
    // gerçek olan yazılır — ikisi ayrışırsa fark bir bulgudur.
    const result = await adapter.finalize(session())
    expect(result.permissionMode).toBe('dontAsk')
  })

  it('host mod bildirmediyse alan boş kalır', async () => {
    const result = await adapter.finalize(
      session({ parsed: { init: { ...init, permissionMode: '' } } }),
    )
    expect(result.permissionMode).toBeUndefined()
  })
})

describe('güvenlik sınırları', () => {
  it('bypassPermissions bilerek istenmedikçe reddedilir', () => {
    expect(() => new ClaudeCodeAdapter({ permissionMode: 'bypassPermissions' })).toThrow(
      'removes every boundary',
    )
  })

  it('açıkça istenirse kabul edilir', () => {
    expect(
      () =>
        new ClaudeCodeAdapter({
          permissionMode: 'bypassPermissions',
          allowBypassPermissions: true,
        }),
    ).not.toThrow()
  })
})

describe('ortam allowlist"i — H1', () => {
  it('listede olmayan hiçbir değişken ajana geçmez', () => {
    process.env['ASSAY_TEST_SECRET'] = 'super-secret-value'
    process.env['GITHUB_TOKEN'] = 'ghp_should_not_leak'
    try {
      const passed = passthroughEnv()
      expect(passed['ASSAY_TEST_SECRET']).toBeUndefined()
      expect(passed['GITHUB_TOKEN']).toBeUndefined()
      expect(Object.values(passed)).not.toContain('super-secret-value')
    } finally {
      delete process.env['ASSAY_TEST_SECRET']
      delete process.env['GITHUB_TOKEN']
    }
  })

  it('sürecin çalışması için gerekenler geçer', () => {
    const passed = passthroughEnv()
    // PATH her platformda var; host onsuz çalışamaz.
    expect(passed['PATH'] ?? passed['Path']).toBeDefined()
  })

  it('konteynerin ayarları ajana ulaşır: proxy dışı adres ve zorunlu olmayan trafik (K2)', () => {
    const keys = ['NO_PROXY', 'HTTPS_PROXY', 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC'] as const
    const saved = keys.map((key) => process.env[key])
    process.env['NO_PROXY'] = 'assay-api'
    process.env['HTTPS_PROXY'] = 'http://assay-egress:3128'
    process.env['CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC'] = '1'
    try {
      const passed = passthroughEnv()
      expect(passed['NO_PROXY']).toBe('assay-api')
      expect(passed['HTTPS_PROXY']).toBe('http://assay-egress:3128')
      expect(passed['CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC']).toBe('1')
    } finally {
      keys.forEach((key, i) => {
        if (saved[i] === undefined) delete process.env[key]
        else process.env[key] = saved[i]
      })
    }
  })

  it('tanımlı olmayan değişkenler boş string olarak sızmaz', () => {
    delete process.env['NODE_OPTIONS']
    expect('NODE_OPTIONS' in passthroughEnv()).toBe(false)
  })
})
