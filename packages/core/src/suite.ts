/**
 * Vaka seti (suite) şeması ve doğrulayıcısı.
 *
 * Girdi bir YAML *metnidir*, dosya yolu değil: core I/O yapmaz. Dosyayı okumak
 * runner'ın işi.
 *
 * Doğrulama iki katman:
 *  1. Zod — biçim. Alan var mı, tipi doğru mu.
 *  2. Anlamsal geçiş — docs/invariants.md'nin dayattığı kurallar. Hata
 *     mesajları burada, çünkü zod'un ürettiği birleşim hataları eyleme dönük
 *     değil.
 *
 * Kullanıcıya görünen tüm metinler İngilizce: SDK Apache-2.0 ve uluslararası
 * skill yazarlarına hitap ediyor. Kod yorumları Türkçe (bkz. docs/decisions.md).
 */

import { parse as parseYaml } from 'yaml'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Şema
// ---------------------------------------------------------------------------

/**
 * Hiyerarşik vaka kimliği: `trigger.negative.near_neighbor.pdf`,
 * `collide.copy-editing.tighten_paragraph`.
 *
 * 0.4.0: tire her segmentte serbest. Skill adları çoğunlukla tireli
 * (`copy-editing`, `cold-email`) ve çakışma suite'i skill'in adını id'ye
 * yazamıyordu. Eski desenin tam üst kümesi: ilk segment harf/rakamla, sonrakiler
 * eskisi gibi `_` ile de başlayabilir; hiçbiri tireyle başlayamaz.
 */
const CASE_ID = /^[a-z0-9][a-z0-9_-]*(?:\.[a-z0-9_][a-z0-9_-]*)+$/

/**
 * Geçersiz bir id'nin neden geçersiz olduğu.
 *
 * Eski mesaj yalnızca "hierarchical and lowercase" diyordu; 20 tireli id için
 * 20 kez aynı cümle basıldı ve hiçbiri sorunun tire olduğunu söylemedi.
 */
function caseIdProblem(id: string): string {
  const illegal = [...id].find((ch) => !/[a-z0-9_.-]/.test(ch))
  if (illegal !== undefined) {
    return /[A-Z]/.test(illegal)
      ? `case id "${id}" contains "${illegal}": ids are lowercase`
      : `case id "${id}" contains "${illegal}": segments may use a-z, 0-9, "_" and "-"`
  }
  if (!id.includes('.')) {
    return `case id "${id}" has one segment: ids are hierarchical, e.g. "trigger.positive.explicit"`
  }
  return `case id "${id}" has an empty segment or one that starts with "-": each segment starts with a letter or digit ("_" is also allowed after the first)`
}

/** `near_neighbor` segmenti taşıyan negatif vaka, tetiklenme suite'inin asıl sinyali. */
const NEAR_NEIGHBOR_SEGMENT = 'near_neighbor'

export const FILE_FORMATS = ['docx', 'pdf', 'xlsx', 'json', 'yaml'] as const
export const TRACE_RULES = [
  'no_swallowed_errors',
  'tool_called',
  'tool_sequence',
  'tool_args_valid',
] as const

const caseIdSchema = z.string().superRefine((id, ctx) => {
  if (!CASE_ID.test(id)) ctx.addIssue({ code: 'custom', message: caseIdProblem(id) })
})

const assertionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('file_exists'),
    /** Glob. `out/*.docx` gibi. */
    path: z.string().min(1),
  }),
  z.object({
    type: z.literal('file_valid'),
    /** Verilmezse, aynı vakadaki file_exists ile eşleşen tüm dosyalara uygulanır. */
    path: z.string().min(1).optional(),
    format: z.enum(FILE_FORMATS),
  }),
  z.object({
    type: z.literal('json_schema'),
    path: z.string().min(1),
    schema: z.record(z.string(), z.unknown()),
  }),
  z.object({
    type: z.literal('exit_code'),
    equals: z.number().int(),
  }),
  z.object({
    type: z.literal('file_content_matches'),
    path: z.string().min(1),
    /** JavaScript regex kaynağı. */
    matches: z.string().min(1),
    flags: z.string().optional(),
  }),
  z.object({
    type: z.literal('trace'),
    rule: z.enum(TRACE_RULES),
    tool: z.string().min(1).optional(),
    tools: z.array(z.string().min(1)).optional(),
    schema: z.record(z.string(), z.unknown()).optional(),
    min_times: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal('side_effect'),
    writes_within: z.array(z.string().min(1)).optional(),
    network: z.enum(['allow', 'deny']).optional(),
  }),
])

const expectSchema = z.object({
  triggered: z.boolean().optional(),
  /**
   * Coexistence: bu vakada tetiklenmemesi gereken diğer skill'ler.
   * v0'da opsiyonel; şemada bugün var, çünkü sonradan eklemek mevcut suite
   * dosyalarını bozar.
   */
  not_triggered: z.array(z.string().min(1)).optional(),
  /**
   * Çakışma: bu vakada **ilk tetiklenmesi** gereken skill (0.4.0).
   *
   * `winner: <skill>` — o skill ilk doğrulanmış aktivasyon olmalı.
   * `winner: [a, b]` — tartışmalı vaka: ikisinden biri ilk olursa geçer.
   * `winner: none` — hiçbir aktif skill tetiklenmemeli (çakışma negatifi).
   *
   * `not_triggered`in pozitif karşılığı. O alan yalnız "şunlar tetiklenmesin"
   * diyebildiği için hiçbir şeyin tetiklenmediği bir koşum da onu sağlıyordu;
   * marketingskills koşumunda 100 pozitif deneme böyle `pass` sayıldı.
   */
  winner: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]).optional(),
  assertions: z.array(assertionSchema).optional(),
})

/**
 * Değişmez #5'in "negatif vaka" tanımı — TEK yer.
 *
 * `triggered: false` ya da `winner: none`. Bu tanım eskiden iki yerde yazılıydı
 * (doğrulayıcı ve veritabanı katmanı); 0.4.0'da biri güncellenip öteki
 * unutulunca bir çakışma suite'i doğrulamadan geçip hosted tarafa yüklenemedi.
 */
export function isNegativeCase(c: { expect: { triggered?: boolean | undefined; winner?: string | readonly string[] | undefined } }): boolean {
  if (c.expect.triggered === false) return true
  const winner = expectedWinnerOf(c.expect)
  return winner !== undefined && winner.length === 0
}

/** `winner: none` — ayrılmış sözcük; bir skill adı değil. */
export const WINNER_NONE = 'none'

/**
 * Vakanın beklenen kazananı, kayda gidecek biçimde.
 *
 * `undefined` — vaka kazanan iddiasında bulunmuyor. `[]` — hiçbir skill
 * tetiklenmemeli (`winner: none`). Aksi hâlde ilk tetiklenmesi kabul edilen
 * skill'ler; birden fazlaysa biri yeter.
 */
export function expectedWinnerOf(
  expect: { winner?: string | readonly string[] | undefined },
): readonly string[] | undefined {
  if (expect.winner === undefined) return undefined
  const list = typeof expect.winner === 'string' ? [expect.winner] : [...expect.winner]
  return list.length === 1 && list[0] === WINNER_NONE ? [] : list
}

const caseSchema = z.object({
  id: caseIdSchema,
  prompt: z.string().min(1, 'case prompt cannot be empty'),
  setup: z
    .object({
      fixtures: z.string().min(1).optional(),
      cwd: z.string().min(1).optional(),
    })
    .optional(),
  expect: expectSchema,
})

const environmentSchema = z.object({
  host: z.string().min(1, 'environment.host is required: which host runs this suite'),
  /** Pin 2 — tam model kimliği, "en son" değil. */
  model: z
    .string()
    .min(
      1,
      'environment.model is required (pin 2 of 4): use the exact model id, never "latest"',
    ),
  /** Pin 3 — host'un verdiği sistem promptunun hash'i. */
  system_prompt_hash: z
    .string()
    .min(1, 'environment.system_prompt_hash is required (pin 3 of 4)'),
  /** Coexistence için. v0'da opsiyonel. */
  active_skills: z.array(z.string().min(1)).optional(),
})

const targetSchema = z.object({
  skill: z.string().min(1, 'target.skill is required: which skill is under test'),
  /** Pin 1 — skill sürümü. `owner/repo@<commit-sha>` veya içerik hash'i. */
  source: z
    .string()
    .min(
      1,
      'target.source is required (pin 1 of 4): pin the skill version, e.g. "anthropics/skills@<commit-sha>"',
    ),
})

export const suiteSchema = z.object({
  /**
   * Pin 4 — vaka seti sürümü. Vakalar değiştiğinde artırılır.
   * Runner ayrıca suite kaynağının içerik hash'ini kaydeder; beyan edilen sürüm
   * unutulduğunda kayma bu hash'ten görülür.
   */
  version: z
    .number()
    .int()
    .positive(
      'version is required (pin 4 of 4): the case set version, bumped whenever cases change',
    ),
  target: targetSchema,
  environment: environmentSchema,
  /** Değişmez #3: tekrar varsayılanı asla 1 değil. */
  runs: z
    .number()
    .int()
    .min(
      2,
      'runs must be at least 2: a single attempt is an observation, not a measurement (invariant: the repeat count is never 1)',
    ),
  cases: z.array(caseSchema).min(1, 'cases cannot be empty'),
})

export type Suite = z.infer<typeof suiteSchema>
export type SuiteCase = z.infer<typeof caseSchema>
export type Assertion = z.infer<typeof assertionSchema>
export type TraceRule = (typeof TRACE_RULES)[number]
export type FileFormat = (typeof FILE_FORMATS)[number]

// ---------------------------------------------------------------------------
// Sonuç tipleri
// ---------------------------------------------------------------------------

export interface SuiteIssue {
  level: 'error' | 'warning'
  /** YAML içindeki konum: `cases[2].expect.assertions[0].tool` */
  path: string
  message: string
}

export type SuiteParseResult =
  | { ok: true; suite: Suite; issues: SuiteIssue[] }
  | { ok: false; suite?: undefined; issues: SuiteIssue[] }

// ---------------------------------------------------------------------------
// Anlamsal kurallar
// ---------------------------------------------------------------------------

const error = (path: string, message: string): SuiteIssue => ({
  level: 'error',
  path,
  message,
})
const warning = (path: string, message: string): SuiteIssue => ({
  level: 'warning',
  path,
  message,
})

/** Trace kuralı başına zorunlu alanlar. Zod birleşimi yerine burada: mesajlar eyleme dönük. */
const TRACE_REQUIREMENTS: Record<TraceRule, { field?: 'tool' | 'tools'; hint: string }> =
  {
    no_swallowed_errors: { hint: '' },
    tool_called: {
      field: 'tool',
      hint: 'name the tool that must be called, e.g. tool: Write',
    },
    tool_sequence: {
      field: 'tools',
      hint: 'list the tools in the order they must appear, e.g. tools: [Read, Write]',
    },
    tool_args_valid: { field: 'tool', hint: 'name the tool whose arguments are checked' },
  }

function checkAssertions(c: SuiteCase, index: number, issues: SuiteIssue[]): void {
  const assertions = c.expect.assertions ?? []
  const hasFileExists = assertions.some((a) => a.type === 'file_exists')

  assertions.forEach((assertion, i) => {
    const at = `cases[${index}].expect.assertions[${i}]`

    if (
      assertion.type === 'file_valid' &&
      assertion.path === undefined &&
      !hasFileExists
    ) {
      issues.push(
        error(
          `${at}.path`,
          "file_valid without a path falls back to the files matched by this case's file_exists assertions, but this case has none: add a path or a file_exists assertion",
        ),
      )
    }

    if (assertion.type === 'trace') {
      const requirement = TRACE_REQUIREMENTS[assertion.rule]
      const field = requirement.field
      if (field !== undefined && assertion[field] === undefined) {
        issues.push(
          error(
            `${at}.${field}`,
            `trace rule "${assertion.rule}" requires ${field}: ${requirement.hint}`,
          ),
        )
      }
      if (assertion.rule === 'tool_args_valid' && assertion.schema === undefined) {
        issues.push(
          error(
            `${at}.schema`,
            'trace rule "tool_args_valid" requires schema: a JSON Schema for the tool arguments',
          ),
        )
      }
      if (assertion.rule === 'tool_sequence' && (assertion.tools?.length ?? 0) < 2) {
        issues.push(
          error(
            `${at}.tools`,
            'trace rule "tool_sequence" needs at least two tools to describe an order',
          ),
        )
      }
    }

    if (assertion.type === 'file_content_matches') {
      try {
        new RegExp(assertion.matches, assertion.flags)
      } catch (cause) {
        issues.push(
          error(
            `${at}.matches`,
            `file_content_matches carries an invalid regex: ${(cause as Error).message}`,
          ),
        )
      }
    }

    if (
      assertion.type === 'side_effect' &&
      assertion.writes_within === undefined &&
      assertion.network === undefined
    ) {
      issues.push(
        error(at, 'side_effect asserts nothing: set writes_within, network, or both'),
      )
    }
  })
}

/**
 * `expect.winner`in tutarlılığı (0.4.0).
 *
 * Kazanan, kurulu skill'lerden biri olmalı; yoksa vaka hiçbir koşumda
 * geçemez ve bu, ölçümden önce söylenmeli.
 */
function checkWinner(
  suite: Suite,
  c: SuiteCase,
  at: string,
  winner: readonly string[],
  activeSkills: ReadonlySet<string>,
  issues: SuiteIssue[],
): void {
  const path = `${at}.expect.winner`
  const raw = c.expect.winner
  const declared = typeof raw === 'string' ? [raw] : [...(raw ?? [])]

  if (activeSkills.size === 0) {
    issues.push(
      error(
        path,
        `case "${c.id}" names a winner, but environment.active_skills is empty: declare the skills installed together`,
      ),
    )
    return
  }
  if (activeSkills.has(WINNER_NONE)) {
    issues.push(
      error(
        'environment.active_skills',
        `"${WINNER_NONE}" is reserved for expect.winner and cannot be a skill name`,
      ),
    )
  }
  if (declared.length > 1 && declared.includes(WINNER_NONE)) {
    issues.push(
      error(path, `case "${c.id}": "${WINNER_NONE}" cannot be combined with other winners`),
    )
    return
  }
  for (const skill of winner) {
    if (!activeSkills.has(skill)) {
      issues.push(
        error(
          path,
          `case "${c.id}" expects "${skill}" to win, but it is not listed in environment.active_skills`,
        ),
      )
    }
  }
  const excluded = winner.filter((skill) => c.expect.not_triggered?.includes(skill))
  if (excluded.length > 0) {
    issues.push(
      error(
        path,
        `case "${c.id}" expects ${excluded.join(', ')} to win and also lists it in not_triggered`,
      ),
    )
  }
  const target = suite.target.skill
  if (c.expect.triggered === false && winner.length === 1 && winner[0] === target) {
    issues.push(
      error(path, `case "${c.id}" expects "${target}" to win but also expects it not to trigger`),
    )
  }
  if (c.expect.triggered === true && winner.length === 0) {
    issues.push(
      error(
        path,
        `case "${c.id}" expects "${target}" to trigger but also expects no skill to trigger`,
      ),
    )
  }
}

function checkCases(suite: Suite, issues: SuiteIssue[]): void {
  const seen = new Map<string, number>()
  const activeSkills = new Set(suite.environment.active_skills ?? [])
  let negatives = 0
  let nearNeighbours = 0

  suite.cases.forEach((c, index) => {
    const at = `cases[${index}]`

    const firstSeen = seen.get(c.id)
    if (firstSeen !== undefined) {
      issues.push(
        error(
          `${at}.id`,
          `duplicate case id "${c.id}", first defined at cases[${firstSeen}]: ids must be unique`,
        ),
      )
    } else {
      seen.set(c.id, index)
    }

    const { triggered, not_triggered: notTriggered, assertions } = c.expect
    const winner = expectedWinnerOf(c.expect)

    if (
      triggered === undefined &&
      winner === undefined &&
      (assertions?.length ?? 0) === 0 &&
      (notTriggered?.length ?? 0) === 0
    ) {
      issues.push(
        error(
          `${at}.expect`,
          `case "${c.id}" measures nothing: set expect.triggered, or add assertions`,
        ),
      )
    }

    /*
     * 0.4.0 — yalnız `not_triggered` taşıyan vaka hiçbir şey tetiklenmediğinde
     * de geçer. Tek hedefli suite'te bu meşru ("komşular tetiklenmesin"); çakışma
     * suite'inde ise tam da 100 sahte `pass`in kaynağıydı. Hata değil uyarı.
     */
    if (
      triggered === undefined &&
      winner === undefined &&
      (assertions?.length ?? 0) === 0 &&
      (notTriggered?.length ?? 0) > 0
    ) {
      issues.push(
        warning(
          `${at}.expect`,
          `case "${c.id}" only lists skills that must not trigger, so it also passes when no skill triggers at all — if you mean one skill should win, use expect.winner`,
        ),
      )
    }

    // `winner: none` çakışma suite'inin negatifi: değişmez #5 onu da sayar.
    if (isNegativeCase(c)) {
      negatives += 1
      if (c.id.split('.').includes(NEAR_NEIGHBOR_SEGMENT)) nearNeighbours += 1
    }

    if (winner !== undefined) checkWinner(suite, c, at, winner, activeSkills, issues)

    if (notTriggered !== undefined && notTriggered.length > 0) {
      if (activeSkills.size === 0) {
        issues.push(
          error(
            `${at}.expect.not_triggered`,
            `case "${c.id}" asserts other skills must not trigger, but environment.active_skills is empty: declare the skills installed alongside "${suite.target.skill}"`,
          ),
        )
      } else {
        for (const skill of notTriggered) {
          if (!activeSkills.has(skill)) {
            issues.push(
              error(
                `${at}.expect.not_triggered`,
                `case "${c.id}" expects "${skill}" not to trigger, but it is not listed in environment.active_skills`,
              ),
            )
          }
        }
      }
    }

    checkAssertions(c, index, issues)
  })

  // Değişmez #5: negatif vakası olmayan tetiklenme suite'i geçersizdir.
  if (negatives === 0) {
    issues.push(
      error(
        'cases',
        'no negative case: a suite where every case expects triggered: true cannot detect a skill that triggers on everything — add at least one case with expect.triggered: false',
      ),
    )
  } else if (nearNeighbours === 0) {
    issues.push(
      warning(
        'cases',
        `no near-neighbour case: negative cases exist but none is marked "${NEAR_NEIGHBOR_SEGMENT}" in its id — an unrelated negative is easy to pass, the discriminating signal comes from requests that resemble the skill's scope`,
      ),
    )
  }
}

// ---------------------------------------------------------------------------
// Giriş noktaları
// ---------------------------------------------------------------------------

/** Zod hata yolunu `cases[2].expect.triggered` biçimine çevirir. */
function formatPath(path: ReadonlyArray<PropertyKey>): string {
  return path.reduce<string>((acc, segment) => {
    if (typeof segment === 'number') return `${acc}[${segment}]`
    return acc === '' ? String(segment) : `${acc}.${String(segment)}`
  }, '')
}

/** Şemadan geçmiş bir nesneyi anlamsal kurallara sokar. */
export function validateSuite(suite: Suite): SuiteIssue[] {
  const issues: SuiteIssue[] = []
  checkCases(suite, issues)
  return issues
}

/**
 * YAML metnini okur, şemadan ve anlamsal kurallardan geçirir.
 *
 * `ok: true` yalnızca hiç `error` seviyesinde sorun yoksa döner; uyarılar
 * `issues` içinde taşınır ve koşumu engellemez.
 */
export function parseSuite(source: string): SuiteParseResult {
  let raw: unknown
  try {
    raw = parseYaml(source)
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    return { ok: false, issues: [error('', `suite is not valid YAML: ${message}`)] }
  }

  if (raw === null || raw === undefined) {
    return { ok: false, issues: [error('', 'suite is empty')] }
  }

  const parsed = suiteSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) =>
        error(formatPath(issue.path), issue.message),
      ),
    }
  }

  const issues = validateSuite(parsed.data)
  if (issues.some((issue) => issue.level === 'error')) {
    return { ok: false, issues }
  }
  return { ok: true, suite: parsed.data, issues }
}
