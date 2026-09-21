import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { outcomeOf, parseSession, parseStreamJson } from './stream.js'

/**
 * Fixture'lar gerçek `claude -p --output-format stream-json` koşumlarından
 * alındı (docs/host-feasibility.md, 0.6 spike'ı). Uydurulmuş akış yok; şema
 * kayarsa bu testler kırılır.
 */
const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../__fixtures__/${name}`, import.meta.url)), 'utf8')

const parse = (name: string) => parseSession(parseStreamJson(fixture(name)))

describe('parseStreamJson', () => {
  it('JSON olmayan satırları atlar', () => {
    const events = parseStreamJson('warning: something\n{"type":"a"}\n\n{"type":"b"}\n')
    expect(events).toHaveLength(2)
  })

  it('bozuk JSON satırı bozuk olarak sayılır, sessizce yutulmaz', () => {
    const parsed = parseSession(parseStreamJson('{"type":"a"}\n{bozuk\n'))
    expect(parsed.malformed).toBe(1)
  })
})

describe('gerçek koşum: skill /slash ile çağrıldı', () => {
  const parsed = parse('explicit-slash.jsonl')

  it('init aktif kurulumu taşır', () => {
    expect(parsed.init?.model).toBe('claude-haiku-4-5-20251001')
    expect(parsed.init?.skills.length).toBeGreaterThan(100)
    expect(parsed.init?.plugins.map((p) => p.name)).toContain('assay-probe')
  })

  it('slash çağrısı Skill aracı üretmez — tetiklenme gözlenemez', () => {
    // 0.6'nın kilit bulgusu: kullanıcı /skill-adı yazdığında akışta tool_use yok.
    expect(parsed.triggeredSkills).toEqual([])
    expect(parsed.trace.filter((e) => e.kind === 'skill_trigger')).toHaveLength(0)
  })

  it('skill çalıştı ama bunu yalnızca metinden anlarız', () => {
    const texts = parsed.trace.filter((e) => e.kind === 'assistant_message')
    expect(texts.some((e) => (e.text ?? '').includes('ASSAY_PROBE_FIRED'))).toBe(true)
  })

  it('oturum sonu completed', () => {
    expect(parsed.result?.subtype).toBe('success')
    expect(parsed.result?.terminalReason).toBe('completed')
    expect(parsed.trace.at(-1)).toMatchObject({
      kind: 'session_end',
      outcome: 'completed',
    })
  })
})

describe('gerçek koşum: skill tetiklenmedi, model işi kendi yaptı', () => {
  const parsed = parse('no-trigger.jsonl')

  it('araç çağrıları ize geçer', () => {
    const calls = parsed.trace.filter((e) => e.kind === 'tool_call')
    expect(calls.length).toBeGreaterThan(0)
    expect(calls.map((c) => c.tool)).toContain('Write')
  })

  it('araç argümanları korunur', () => {
    const write = parsed.trace.find((e) => e.kind === 'tool_call' && e.tool === 'Write')
    expect(write?.args).toBeDefined()
  })

  it('Skill çağrısı yok, dolayısıyla tetiklenme yok', () => {
    expect(parsed.triggeredSkills).toEqual([])
  })

  it('token kullanımı ve maliyet okunur', () => {
    expect(parsed.result?.outputTokens).toBeGreaterThan(0)
    expect(parsed.result?.costUsd).toBeGreaterThan(0)
  })
})

describe('gerçek koşum: kimlik yok — subtype yalan söylüyor, diğer alanlar söylemiyor', () => {
  const parsed = parse('not-logged-in.jsonl')

  it('subtype tek başına yanıltıcı: koşum olmadığı hâlde "success"', () => {
    expect(parsed.result?.subtype).toBe('success')
  })

  it('ama is_error ve terminal_reason doğruyu söylüyor', () => {
    expect(parsed.result?.isError).toBe(true)
    expect(parsed.result?.terminalReason).toBe('api_error')
  })

  it('hiç çıktı üretilmemiş', () => {
    expect(parsed.result?.outputTokens).toBe(0)
    expect(parsed.result?.costUsd).toBe(0)
  })

  it('metin "not logged in" diyor', () => {
    expect(parsed.result?.text ?? '').toMatch(/not logged in/i)
  })
})

describe('Skill araç çağrısı ize ve tetiklenmeye dönüşür', () => {
  // Gerçek transkriptlerden gözlenen blok biçimi (docs/host-feasibility.md).
  const events = [
    { type: 'system', subtype: 'init', session_id: 's1', model: 'm', skills: ['docx'] },
    {
      type: 'assistant',
      message: {
        content: [
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'Skill',
            input: { skill: 'docx', args: 'x' },
          },
        ],
      },
    },
    {
      type: 'user',
      message: {
        content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'ok' }],
      },
    },
    {
      type: 'result',
      subtype: 'success',
      is_error: false,
      num_turns: 2,
      usage: { output_tokens: 5 },
    },
  ]
  const parsed = parseSession(events)

  it('hem tool_call hem skill_trigger üretir', () => {
    expect(parsed.trace.filter((e) => e.kind === 'tool_call')).toHaveLength(1)
    expect(parsed.trace.filter((e) => e.kind === 'skill_trigger')).toHaveLength(1)
    expect(parsed.triggeredSkills).toEqual(['docx'])
  })

  it('tool_result aracına bağlanır', () => {
    const result = parsed.trace.find((e) => e.kind === 'tool_result')
    expect(result?.tool).toBe('Skill')
    expect(result?.isError).toBeUndefined()
  })

  it('seq monoton artar', () => {
    const seqs = parsed.trace.map((e) => e.seq)
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b))
    expect(new Set(seqs).size).toBe(seqs.length)
  })
})

// ---------------------------------------------------------------------------
// Aktivasyon doğrulaması (0.2.0)
// ---------------------------------------------------------------------------

/**
 * Bir `Skill` çağrısı + isteğe bağlı sonucu + akış sonu.
 *
 * `skillResult: null` "sonuç hiç gelmedi" demek — çağrının sonuçsuz kalması
 * ile boş bir sonuç dönmesi farklı iki durum ve ikisi de tetiklenme değil.
 */
const skillStream = (
  skillResult: { isError?: boolean; content?: unknown } | null,
  denials: unknown[] = [],
) => [
  { type: 'system', subtype: 'init', session_id: 's1', model: 'm', skills: ['docx'] },
  {
    type: 'assistant',
    message: {
      content: [{ type: 'tool_use', id: 'toolu_1', name: 'Skill', input: { skill: 'docx' } }],
    },
  },
  ...(skillResult === null
    ? []
    : [
        {
          type: 'user',
          message: {
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'toolu_1',
                ...(skillResult.isError === true ? { is_error: true } : {}),
                content: skillResult.content ?? '',
              },
            ],
          },
        },
      ]),
  {
    type: 'result',
    subtype: 'success',
    is_error: false,
    num_turns: 2,
    usage: { output_tokens: 5 },
    permission_denials: denials,
  },
]

describe('aktivasyon sirasi (0.4.0)', () => {
  it('dogrulanmis aktivasyonlar akistaki cagri sirasiyla listeleniyor', () => {
    const call = (id: string, skill: string) => ({
      type: 'assistant',
      message: { content: [{ type: 'tool_use', id, name: 'Skill', input: { skill } }] },
    })
    const body = (id: string) => ({
      type: 'user',
      message: { content: [{ type: 'tool_result', tool_use_id: id, content: '# body' }] },
    })
    const parsed = parseSession([
      { type: 'system', subtype: 'init', session_id: 's1', model: 'm', skills: ['cro', 'signup'] },
      call('t1', 'signup'),
      body('t1'),
      call('t2', 'cro'),
      body('t2'),
      { type: 'result', subtype: 'success', is_error: false, num_turns: 3, usage: { output_tokens: 5 } },
    ])
    expect(parsed.triggeredSkills).toEqual(['signup', 'cro'])
  })
})

describe('tetiklenme = doğrulanmış aktivasyon, çağrının varlığı değil', () => {
  it('gövde taşıyan hatasız sonuç tetiklenmedir', () => {
    const parsed = parseSession(skillStream({ content: '# docx\n\nUse this skill to…' }))
    expect(parsed.triggeredSkills).toEqual(['docx'])
    expect(parsed.refusals).toEqual([])
    expect(parsed.trace.filter((e) => e.kind === 'skill_trigger')).toHaveLength(1)
  })

  it('hata dönen Skill sonucu tetiklenme SAYILMAZ', () => {
    const parsed = parseSession(
      skillStream({
        isError: true,
        content: '<tool_use_error>Claude requested permissions to use Skill</tool_use_error>',
      }),
    )
    expect(parsed.triggeredSkills).toEqual([])
    expect(parsed.trace.filter((e) => e.kind === 'skill_trigger')).toHaveLength(0)
    expect(parsed.refusals).toHaveLength(1)
    expect(parsed.refusals[0]?.skill).toBe('docx')
    expect(parsed.refusals[0]?.reason).toMatch(/failed/)
  })

  it('permission_denials içindeki çağrı tetiklenme sayılmaz', () => {
    // Host reddi ZATEN bildiriyordu; 0.2.0'a kadar ayrıştırıcı okumuyordu.
    const parsed = parseSession(
      skillStream({ content: 'body' }, [{ tool_name: 'Skill', tool_use_id: 'toolu_1' }]),
    )
    expect(parsed.triggeredSkills).toEqual([])
    expect(parsed.refusals[0]?.reason).toMatch(/denied permission/)
  })

  it('sonucu hiç gelmemiş çağrı tetiklenme sayılmaz', () => {
    const parsed = parseSession(skillStream(null))
    expect(parsed.triggeredSkills).toEqual([])
    expect(parsed.refusals[0]?.reason).toMatch(/no matching tool_result/)
  })

  it('gövdesiz başarılı sonuç tetiklenme sayılmaz — enjekte edilen bir şey yok', () => {
    const parsed = parseSession(skillStream({ content: '   ' }))
    expect(parsed.triggeredSkills).toEqual([])
    expect(parsed.refusals[0]?.reason).toMatch(/no skill body/)
  })

  it('red, izde çağrının sonucuna yazılır', () => {
    const parsed = parseSession(
      skillStream({ content: 'body' }, [{ tool_name: 'Skill', tool_use_id: 'toolu_1' }]),
    )
    const result = parsed.trace.find((e) => e.kind === 'tool_result')
    expect(result?.refusal).toMatch(/denied permission to use Skill/)
  })

  it('Skill dışındaki reddedilen araçlar da işaretlenir', () => {
    const parsed = parseSession([
      {
        type: 'assistant',
        message: {
          content: [{ type: 'tool_use', id: 'b1', name: 'Bash', input: { command: 'ls' } }],
        },
      },
      {
        type: 'user',
        message: {
          content: [
            { type: 'tool_result', tool_use_id: 'b1', is_error: true, content: 'denied' },
          ],
        },
      },
      {
        type: 'result',
        subtype: 'success',
        is_error: false,
        num_turns: 1,
        usage: { output_tokens: 3 },
        permission_denials: [{ tool_name: 'Bash', tool_use_id: 'b1' }],
      },
    ])
    const result = parsed.trace.find((e) => e.kind === 'tool_result')
    expect(result?.refusal).toMatch(/denied permission to use Bash/)
  })

  it('aynı skill önce reddedilip sonra aktive olursa tetiklenme sayılır', () => {
    const parsed = parseSession([
      { type: 'system', subtype: 'init', session_id: 's', model: 'm', skills: ['docx'] },
      {
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', id: 'a', name: 'Skill', input: { skill: 'docx' } },
          ],
        },
      },
      {
        type: 'user',
        message: {
          content: [
            { type: 'tool_result', tool_use_id: 'a', is_error: true, content: 'nope' },
          ],
        },
      },
      {
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', id: 'b', name: 'Skill', input: { skill: 'docx' } },
          ],
        },
      },
      {
        type: 'user',
        message: { content: [{ type: 'tool_result', tool_use_id: 'b', content: 'body' }] },
      },
      {
        type: 'result',
        subtype: 'success',
        is_error: false,
        num_turns: 3,
        usage: { output_tokens: 5 },
      },
    ])
    expect(parsed.triggeredSkills).toEqual(['docx'])
    expect(parsed.refusals).toHaveLength(1)
  })

  it('seq, tetiklenme eklendikten sonra da tekil ve monoton', () => {
    const parsed = parseSession(skillStream({ content: 'body' }))
    const seqs = parsed.trace.map((e) => e.seq)
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b))
    expect(new Set(seqs).size).toBe(seqs.length)
  })
})

// ---------------------------------------------------------------------------
// Hook olayları (0.2.0)
// ---------------------------------------------------------------------------

describe('hook olayları ize geçer', () => {
  const parsed = parse('explicit-slash.jsonl')
  const hooks = parsed.trace.filter((e) => e.kind === 'hook')

  it('gerçek koşumda hook_started ve hook_response okunur', () => {
    expect(hooks.length).toBeGreaterThan(0)
    expect(hooks.map((e) => e.hook?.phase)).toContain('started')
    expect(hooks.map((e) => e.hook?.phase)).toContain('response')
  })

  it('hook adı ve olayı korunur', () => {
    expect(hooks.map((e) => e.hook?.name)).toContain('SessionStart:startup')
    expect(hooks.map((e) => e.hook?.event)).toContain('SessionStart')
  })

  it('exit_code ve outcome okunur — hook iptal olduysa bu görünür', () => {
    const responses = hooks.filter((e) => e.hook?.phase === 'response')
    expect(responses.map((e) => e.hook?.outcome)).toContain('cancelled')
    expect(responses.some((e) => e.hook?.exitCode === 1)).toBe(true)
  })

  it('stdout okunur', () => {
    const withStdout = hooks.filter((e) => (e.hook?.stdout ?? '') !== '')
    expect(withStdout.length).toBeGreaterThan(0)
  })

  it('uzun çıktı kesilir ve kesildiği yazılır', () => {
    const long = 'x'.repeat(5000)
    const events = parseSession([
      {
        type: 'system',
        subtype: 'hook_response',
        hook_name: 'H',
        hook_event: 'SessionStart',
        exit_code: 0,
        outcome: 'success',
        stdout: long,
      },
    ])
    const stdout = events.trace[0]?.hook?.stdout ?? ''
    expect(stdout.length).toBeLessThan(long.length)
    expect(stdout).toMatch(/truncated, 5000 chars total/)
  })

  it('hook_progress ize girmez — 0.2.0 yalnızca started ve response okuyor', () => {
    const events = parseSession([
      { type: 'system', subtype: 'hook_progress', hook_name: 'H', hook_event: 'E' },
    ])
    expect(events.trace).toHaveLength(0)
  })
})

describe('permission_denials', () => {
  it('boş liste okunur ve red üretmez', () => {
    const parsed = parseSession(skillStream({ content: 'body' }, []))
    expect(parsed.result?.permissionDenials).toEqual([])
  })

  it('camelCase alan adları da okunur', () => {
    const parsed = parseSession(
      skillStream({ content: 'body' }, [{ toolName: 'Skill', toolUseId: 'toolu_1' }]),
    )
    expect(parsed.result?.permissionDenials).toEqual([
      { tool: 'Skill', toolUseId: 'toolu_1' },
    ])
    expect(parsed.triggeredSkills).toEqual([])
  })

  it('gerçek koşumlarda alan var ve boş', () => {
    expect(parse('no-trigger.jsonl').result?.permissionDenials).toEqual([])
  })
})

describe('hata taşıyan tool_result', () => {
  const parsed = parseSession([
    {
      type: 'assistant',
      message: {
        content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'x' } }],
      },
    },
    {
      type: 'user',
      message: {
        content: [
          {
            type: 'tool_result',
            tool_use_id: 't1',
            is_error: true,
            content: 'EACCES: denied',
          },
        ],
      },
    },
    {
      type: 'result',
      subtype: 'success',
      is_error: false,
      num_turns: 1,
      usage: { output_tokens: 3 },
    },
  ])

  it('isError ve hata metni korunur — no_swallowed_errors bunu okur', () => {
    const failure = parsed.trace.find((e) => e.isError === true)
    expect(failure?.tool).toBe('Bash')
    expect(failure?.error).toContain('EACCES')
  })
})

describe('outcomeOf', () => {
  const base = {
    subtype: 'success',
    isError: false,
    numTurns: 1,
    inputTokens: 1,
    outputTokens: 1,
  }

  it.each([
    [{ ...base }, 'completed'],
    [{ ...base, isError: true }, 'error'],
    [{ ...base, terminalReason: 'interrupted' }, 'aborted'],
    [{ ...base, subtype: 'error_max_turns' }, 'error'],
  ] as const)('%o → %s', (result, expected) => {
    expect(outcomeOf(result)).toBe(expected)
  })
})
