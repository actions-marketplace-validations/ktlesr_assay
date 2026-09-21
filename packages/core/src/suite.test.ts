import { describe, expect, it } from 'vitest'
import { expectedWinnerOf, parseSuite, type SuiteIssue } from './suite.js'

/** Geçerli bir taban suite. Testler bunun üzerine tek bir bozukluk bindirir. */
const VALID = `
version: 3
target:
  skill: docx
  source: anthropics/skills@0f1c2d3
environment:
  host: claude-code
  model: claude-opus-5-20260514
  system_prompt_hash: sha256:9f2b1c0a
  active_skills: [docx, pdf, xlsx]
runs: 10
cases:
  - id: trigger.positive.explicit
    prompt: "Bu taslağı Word belgesine çevir."
    expect: { triggered: true }
  - id: trigger.negative.unrelated
    prompt: "Bugün hava nasıl?"
    expect: { triggered: false }
  - id: trigger.negative.near_neighbor.pdf
    prompt: "Bu taslağı PDF olarak dışa aktar."
    expect: { triggered: false }
  - id: complete.creates_valid_document
    prompt: "Bu taslaktan bir rapor üret."
    setup: { fixtures: ./fixtures/draft.md }
    expect:
      triggered: true
      assertions:
        - { type: file_exists, path: "out/*.docx" }
        - { type: file_valid, format: docx }
        - { type: trace, rule: no_swallowed_errors }
        - { type: side_effect, writes_within: ["out/"], network: deny }
`

const errorsOf = (issues: SuiteIssue[]) => issues.filter((i) => i.level === 'error')
const messagesOf = (issues: SuiteIssue[]) => issues.map((i) => i.message).join('\n')

function parse(yaml: string) {
  return parseSuite(yaml)
}

/** Taban suite'te bir satırı değiştirip yeniden koşmak için. */
function withReplacement(from: string, to: string): string {
  if (!VALID.includes(from)) throw new Error(`test fixture drifted: "${from}" not found`)
  return VALID.replace(from, to)
}

describe('parseSuite — geçerli suite', () => {
  it('taban suite hatasız ve uyarısız geçer', () => {
    const result = parse(VALID)
    expect(result.issues).toEqual([])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.suite.target.skill).toBe('docx')
    expect(result.suite.runs).toBe(10)
    expect(result.suite.cases).toHaveLength(4)
  })

  it('coexistence vakası active_skills ile birlikte geçerlidir', () => {
    const result = parse(
      withReplacement(
        '  - id: trigger.negative.unrelated',
        `  - id: coexistence.collision.pdf_steals
    prompt: "Bu taslağı belge hâline getir."
    expect: { triggered: true, not_triggered: [pdf] }
  - id: trigger.negative.unrelated`,
      ),
    )
    expect(errorsOf(result.issues)).toEqual([])
    expect(result.ok).toBe(true)
  })
})

describe('parseSuite — biçim hataları', () => {
  it('geçersiz YAML eyleme dönük mesaj verir', () => {
    const result = parse('version: 1\n  target: [')
    expect(result.ok).toBe(false)
    expect(messagesOf(result.issues)).toContain('not valid YAML')
  })

  it('boş suite reddedilir', () => {
    const result = parse('\n# yalnızca yorum\n')
    expect(result.ok).toBe(false)
    expect(messagesOf(result.issues)).toContain('empty')
  })

  it('hata yolu YAML konumunu gösterir', () => {
    const result = parse(
      withReplacement('  - id: trigger.positive.explicit', '  - id: BÜYÜK'),
    )
    expect(result.ok).toBe(false)
    expect(result.issues.map((i) => i.path)).toContain('cases[0].id')
  })
})

describe('parseSuite — dört pin', () => {
  const pins: ReadonlyArray<[string, string, string]> = [
    ['pin 1 skill sürümü', '  source: anthropics/skills@0f1c2d3', 'target.source'],
    ['pin 2 model kimliği', '  model: claude-opus-5-20260514', 'environment.model'],
    [
      'pin 3 sistem promptu hash',
      '  system_prompt_hash: sha256:9f2b1c0a',
      'environment.system_prompt_hash',
    ],
    ['pin 4 vaka seti sürümü', 'version: 3', 'version'],
  ]

  it.each(pins)('%s eksikse hata', (_name, line, path) => {
    const result = parse(VALID.replace(`${line}\n`, ''))
    expect(result.ok).toBe(false)
    expect(result.issues.map((i) => i.path)).toContain(path)
  })

  it('model "latest" olamaz uyarısı mesajda geçer', () => {
    const result = parse(
      withReplacement('  model: claude-opus-5-20260514', '  model: ""'),
    )
    expect(messagesOf(result.issues)).toContain('never "latest"')
  })
})

describe('parseSuite — değişmez #3: tekrar sayısı', () => {
  it.each([[1], [0], [-3]])('runs: %i reddedilir', (runs) => {
    const result = parse(withReplacement('runs: 10', `runs: ${runs}`))
    expect(result.ok).toBe(false)
    expect(messagesOf(result.issues)).toContain('observation, not a measurement')
  })

  it('runs: 2 kabul edilir', () => {
    expect(parse(withReplacement('runs: 10', 'runs: 2')).ok).toBe(true)
  })
})

describe('parseSuite — değişmez #5: negatif ve yakın komşu', () => {
  it('hiç negatif vaka yoksa hata', () => {
    const result = parse(
      withReplacement(
        '    expect: { triggered: false }',
        '    expect: { triggered: true }',
      ).replace('    expect: { triggered: false }', '    expect: { triggered: true }'),
    )
    expect(result.ok).toBe(false)
    expect(messagesOf(result.issues)).toContain('no negative case')
  })

  it('yakın komşu yoksa uyarı, hata değil', () => {
    const result = parse(
      withReplacement(
        '  - id: trigger.negative.near_neighbor.pdf',
        '  - id: trigger.negative.other',
      ),
    )
    expect(result.ok).toBe(true)
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]?.level).toBe('warning')
    expect(result.issues[0]?.message).toContain('no near-neighbour case')
  })
})

describe('parseSuite — vaka kimlikleri', () => {
  it('yinelenen id hata verir ve ilk konumu gösterir', () => {
    const result = parse(
      withReplacement(
        '  - id: trigger.negative.unrelated',
        '  - id: trigger.positive.explicit',
      ),
    )
    expect(result.ok).toBe(false)
    expect(messagesOf(result.issues)).toContain('first defined at cases[0]')
  })

  /*
   * 0.4.0 — geçersiz id sebebini adıyla söyler. Eski mesaj her durumda
   * "hierarchical and lowercase" diyordu ve tirenin sorun olduğunu söylemedi.
   */
  it.each([
    ['flat', 'has one segment'],
    ['Trigger.Positive', 'contains "T": ids are lowercase'],
    ['trigger..positive', 'empty segment'],
    ['trigger.pos itive', 'contains " "'],
    ['collide.copy:editing', 'contains ":": segments may use a-z, 0-9, "_" and "-"'],
    ['trigger.-positive', 'starts with "-"'],
    ['-trigger.positive', 'starts with "-"'],
    ['_trigger.positive', 'starts with "-"'],
  ])('gecersiz id reddedilir ve sebebini soyler: %s', (id, reason) => {
    const result = parse(
      withReplacement('  - id: trigger.positive.explicit', `  - id: "${id}"`),
    )
    expect(result.ok).toBe(false)
    expect(messagesOf(result.issues)).toContain(reason)
  })

  it.each([
    ['collide.copy-editing.tighten_paragraph'],
    ['marketing-skills.cold-email.follow-up'],
    ['trigger.positive.explicit'],
    // Eski desen ilk segment dışında `_` ile başlayan segmente izin veriyordu;
    // yeni desen onun üst kümesi olmalı.
    ['trigger.negative._legacy'],
  ])('tireli ve eski bicimli id kabul edilir: %s', (id) => {
    const result = parse(
      withReplacement('  - id: trigger.positive.explicit', `  - id: "${id}"`),
    )
    expect(messagesOf(result.issues)).not.toContain('case id')
    expect(result.ok).toBe(true)
  })

  it('hiçbir şey ölçmeyen vaka reddedilir', () => {
    const result = parse(
      withReplacement('    expect: { triggered: true }', '    expect: {}'),
    )
    expect(result.ok).toBe(false)
    expect(messagesOf(result.issues)).toContain('measures nothing')
  })
})

/**
 * 0.4.0 — `expect.winner`.
 *
 * Taban suite `docx, pdf, xlsx` kurulu. Pozitif vaka `winner` ile yeniden
 * yazılıyor; negatifler olduğu gibi kalıyor.
 */
describe('parseSuite — winner (0.4.0)', () => {
  const withWinner = (expectLine: string, active = '  active_skills: [docx, pdf, xlsx]') =>
    withReplacement('  active_skills: [docx, pdf, xlsx]', active).replace(
      '    expect: { triggered: true }',
      `    expect: ${expectLine}`,
    )

  it('tek kazanan, tartismali kazanan ve none gecerli', () => {
    for (const line of ['{ winner: pdf }', '{ winner: [pdf, xlsx] }', '{ winner: none }']) {
      const result = parse(withWinner(line))
      expect(errorsOf(result.issues)).toEqual([])
      expect(result.ok).toBe(true)
    }
  })

  it('expectedWinnerOf: tek skill, liste ve none normalize ediliyor', () => {
    expect(expectedWinnerOf({ winner: 'pdf' })).toEqual(['pdf'])
    expect(expectedWinnerOf({ winner: ['pdf', 'xlsx'] })).toEqual(['pdf', 'xlsx'])
    expect(expectedWinnerOf({ winner: 'none' })).toEqual([])
    expect(expectedWinnerOf({})).toBeUndefined()
  })

  it('kazanan active_skills disindaysa hata', () => {
    const result = parse(withWinner('{ winner: pptx }'))
    expect(result.ok).toBe(false)
    expect(messagesOf(result.issues)).toContain('expects "pptx" to win, but it is not listed')
  })

  it('active_skills bosken kazanan hata', () => {
    const result = parse(withWinner('{ winner: pdf }', '  active_skills: []'))
    expect(result.ok).toBe(false)
    expect(messagesOf(result.issues)).toContain('names a winner, but environment.active_skills is empty')
  })

  it('none baska kazananla birlesemez', () => {
    const result = parse(withWinner('{ winner: [none, pdf] }'))
    expect(result.ok).toBe(false)
    expect(messagesOf(result.issues)).toContain('"none" cannot be combined')
  })

  it('none adinda kurulu bir skill hata', () => {
    const result = parse(withWinner('{ winner: pdf }', '  active_skills: [docx, pdf, none]'))
    expect(result.ok).toBe(false)
    expect(messagesOf(result.issues)).toContain('"none" is reserved')
  })

  it('kazanan not_triggered listesinde de olamaz', () => {
    const result = parse(withWinner('{ winner: pdf, not_triggered: [pdf] }'))
    expect(result.ok).toBe(false)
    expect(messagesOf(result.issues)).toContain('expects pdf to win and also lists it in not_triggered')
  })

  it('hedef kazanmali ama tetiklenmemeli: celiski', () => {
    const result = parse(withWinner('{ triggered: false, winner: docx }'))
    expect(result.ok).toBe(false)
    expect(messagesOf(result.issues)).toContain('expects "docx" to win but also expects it not to trigger')
  })

  it('hedef tetiklenmeli ama hicbiri tetiklenmemeli: celiski', () => {
    const result = parse(withWinner('{ triggered: true, winner: none }'))
    expect(result.ok).toBe(false)
    expect(messagesOf(result.issues)).toContain('also expects no skill to trigger')
  })

  it('winner: none degismez #5 icin negatif sayiliyor', () => {
    // Bütün `triggered: false` vakaları `winner: none`a çevrilince suite hâlâ
    // negatif taşıyor sayılmalı.
    const onlyNone = VALID.replaceAll('    expect: { triggered: false }', '    expect: { winner: none }')
    const result = parse(onlyNone)
    expect(messagesOf(result.issues)).not.toContain('no negative case')
    expect(messagesOf(result.issues)).not.toContain('no near-neighbour case')
    expect(result.ok).toBe(true)
  })

  it('yalniz not_triggered tasiyan vaka uyari aliyor, hata degil', () => {
    // 100 sahte `pass`in kaynağı: hiçbir şey tetiklenmediğinde de geçer.
    const result = parse(withWinner('{ not_triggered: [pdf] }'))
    expect(result.ok).toBe(true)
    const warnings = result.issues.filter((i) => i.level === 'warning')
    expect(warnings.map((w) => w.message).join('\n')).toContain('also passes when no skill triggers at all')
  })

  it('winner ya da triggered ile birlikte not_triggered uyari almiyor', () => {
    const result = parse(withWinner('{ winner: pdf, not_triggered: [xlsx] }'))
    expect(messagesOf(result.issues)).not.toContain('also passes when no skill triggers')
  })
})

describe('parseSuite — coexistence', () => {
  const withCoexistence = (activeSkills: string) =>
    withReplacement('  active_skills: [docx, pdf, xlsx]', activeSkills).replace(
      '    expect: { triggered: true }',
      '    expect: { triggered: true, not_triggered: [pdf] }',
    )

  it('active_skills yokken not_triggered hata verir', () => {
    const result = parse(withCoexistence('  active_skills: []'))
    expect(result.ok).toBe(false)
    expect(messagesOf(result.issues)).toContain('environment.active_skills is empty')
  })

  it('active_skills alanı hiç yokken de hata verir', () => {
    const result = parse(
      VALID.replace('  active_skills: [docx, pdf, xlsx]\n', '').replace(
        '    expect: { triggered: true }',
        '    expect: { triggered: true, not_triggered: [pdf] }',
      ),
    )
    expect(result.ok).toBe(false)
    expect(messagesOf(result.issues)).toContain('environment.active_skills is empty')
  })

  it('not_triggered active_skills dışında bir skill sayamaz', () => {
    const result = parse(withCoexistence('  active_skills: [docx]'))
    expect(result.ok).toBe(false)
    expect(messagesOf(result.issues)).toContain('not listed in environment.active_skills')
  })

  it("active_skills v0'da opsiyoneldir", () => {
    const result = parse(VALID.replace('  active_skills: [docx, pdf, xlsx]\n', ''))
    expect(result.ok).toBe(true)
  })
})

describe('parseSuite — assertion şekilleri', () => {
  const withAssertion = (assertion: string) =>
    withReplacement(
      '        - { type: trace, rule: no_swallowed_errors }',
      `        - ${assertion}`,
    )

  it('bilinmeyen assertion tipi reddedilir', () => {
    const result = parse(withAssertion('{ type: vibes_ok }'))
    expect(result.ok).toBe(false)
  })

  it.each([
    ['{ type: trace, rule: tool_called }', 'requires tool'],
    ['{ type: trace, rule: tool_sequence }', 'requires tools'],
    ['{ type: trace, rule: tool_sequence, tools: [Write] }', 'at least two tools'],
    ['{ type: trace, rule: tool_args_valid, tool: Write }', 'requires schema'],
    ['{ type: side_effect }', 'asserts nothing'],
  ])('%s → %s', (assertion, expectedMessage) => {
    const result = parse(withAssertion(assertion))
    expect(result.ok).toBe(false)
    expect(messagesOf(result.issues)).toContain(expectedMessage)
  })

  it.each([
    '{ type: trace, rule: tool_called, tool: Write }',
    '{ type: trace, rule: tool_sequence, tools: [Read, Write] }',
    '{ type: trace, rule: tool_args_valid, tool: Write, schema: { type: object } }',
    '{ type: side_effect, network: deny }',
    '{ type: exit_code, equals: 0 }',
    '{ type: file_content_matches, path: "out/a.md", matches: "^# ", flags: m }',
    '{ type: json_schema, path: "out/a.json", schema: { type: object } }',
  ])('geçerli assertion kabul edilir: %s', (assertion) => {
    expect(errorsOf(parse(withAssertion(assertion)).issues)).toEqual([])
  })

  it('geçersiz regex taşıyan file_content_matches reddedilir', () => {
    const result = parse(
      withAssertion('{ type: file_content_matches, path: "a", matches: "([" }'),
    )
    expect(result.ok).toBe(false)
    expect(messagesOf(result.issues)).toContain('invalid regex')
  })

  it('yolsuz file_valid, aynı vakada file_exists yoksa reddedilir', () => {
    const result = parse(
      withReplacement('        - { type: file_exists, path: "out/*.docx" }\n', ''),
    )
    expect(result.ok).toBe(false)
    expect(messagesOf(result.issues)).toContain('file_valid without a path')
  })

  it('yolsuz file_valid, file_exists varsa kabul edilir', () => {
    expect(parse(VALID).ok).toBe(true)
  })
})
