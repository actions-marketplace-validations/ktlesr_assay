import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { parseSuite, proportion, type Attempt, type Run } from '@ktlsr/assay-core'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  assertSuiteStorable,
  fromAttemptRow,
  fromCaseResultRow,
  fromRunRow,
  fromTraceEventRow,
  isNearNeighbour,
  suiteWarnings,
  toAttemptRow,
  toCaseResultRow,
  toCaseRow,
  toEnvDiffRow,
  toRunRow,
  toSuiteRow,
  toTraceEventRow,
} from './mapping.js'

/**
 * Yerel dosya store ile hosted veritabanı **aynı kanonik modeli** paylaşıyor
 * mu?
 *
 * Alan adlarını karşılaştırmak yetmez; ayrışma sessizce dönüşümde olur. Bu
 * yüzden test gerçek bir gidiş-dönüş yapıyor: kanonik `Run` → satırlar →
 * Postgres → satırlar → kanonik `Run`. İki uç eşit değilse hosted taraf
 * SDK'nın ürettiği kaydı sadakatle saklamıyor demektir.
 */

const migration = readFileSync(
  fileURLToPath(
    new URL('../prisma/migrations/20260831000000_init/migration.sql', import.meta.url),
  ),
  'utf8',
)

let db: PGlite

beforeAll(async () => {
  db = new PGlite()
  await db.exec(migration)
}, 120_000)

// ---------------------------------------------------------------------------
// Örnek kanonik kayıt — gerçek bir koşumun taşıdığı her alanı içerir
// ---------------------------------------------------------------------------

const SUITE_SOURCE = `
version: 3
target: { skill: docx, source: anthropics/skills@abc }
environment:
  host: claude-code
  model: claude-haiku-4-5-20251001
  system_prompt_hash: not-provided-by-host
  active_skills: [docx, pdf]
runs: 10
cases:
  - id: trigger.positive.explicit
    prompt: Turn this into a Word document.
    expect: { triggered: true }
  - id: trigger.negative.near_neighbor.pdf
    prompt: Export this as a PDF.
    expect: { triggered: false }
  - id: complete.writes_file
    prompt: Produce the report.
    expect:
      assertions:
        - { type: file_exists, path: 'out/*.docx' }
`

const parsed = parseSuite(SUITE_SOURCE)
if (!parsed.ok) throw new Error(parsed.issues.map((i) => i.message).join('; '))
const suite = parsed.suite

const attempt = (
  index: number,
  verdict: Attempt['verdict'],
  available: boolean,
): Attempt => ({
  index,
  caseId: 'trigger.positive.explicit',
  startedAt: '2026-08-31T10:00:00.000Z',
  finishedAt: '2026-08-31T10:00:05.000Z',
  trigger: available
    ? {
        available: true,
        triggered: verdict === 'pass',
        skills: ['docx'],
        refused: false,
        refusals: [],
        complete: true,
        via: 'confirmed Skill activation in stream-json',
      }
    : { available: false, reason: 'the host emitted no skill marker' },
  assertions: [],
  verdict,
  reason: verdict === 'unknown' ? 'the trigger signal could not be read' : 'ok',
  latencyMs: 4016,
  cost: { inputTokens: 10, outputTokens: 42, usd: 0.0277 },
  trace: [
    {
      seq: 1,
      kind: 'tool_call',
      id: 'toolu_1',
      tool: 'Skill',
      args: { skill: 'docx', args: 'x' },
    },
    { seq: 2, kind: 'skill_trigger', skill: 'docx' },
    {
      seq: 3,
      kind: 'tool_result',
      callId: 'toolu_1',
      tool: 'Skill',
      isError: true,
      error: 'EACCES: denied',
    },
    { seq: 4, kind: 'assistant_message', text: 'The Write step failed.' },
    { seq: 5, kind: 'session_end', outcome: 'completed', at: '2026-08-31T10:00:05.000Z' },
  ],
  env: {
    writes: ['out/report.docx'],
    deletes: [],
    network: [{ host: 'api.example.com', blocked: true }],
    unobserved: ['Bash'],
  },
})

const run: Run = {
  id: 'run-2026-08-31T10-00-00-000Z-abcd1234',
  startedAt: '2026-08-31T10:00:00.000Z',
  finishedAt: '2026-08-31T10:05:00.000Z',
  host: 'claude-code',
  skill: 'docx',
  pins: {
    skillSource: 'anthropics/skills@abc',
    skillHash: 'sha256:skill',
    model: 'claude-haiku-4-5-20251001',
    systemPromptHash: 'not-provided-by-host',
    suiteVersion: 3,
    suiteHash: 'sha256:suite',
  },
  runs: 10,
  cases: [
    {
      caseId: 'trigger.positive.explicit',
      expectedTrigger: true,
      attempts: [attempt(0, 'pass', true), attempt(1, 'fail', true)],
      passRate: proportion(1, 2),
      passed: 1,
      failed: 1,
      unknown: 0,
    },
    {
      caseId: 'trigger.negative.near_neighbor.pdf',
      expectedTrigger: false,
      attempts: [attempt(0, 'unknown', false)],
      passRate: proportion(0, 0),
      passed: 0,
      failed: 0,
      unknown: 1,
    },
  ],
  verdict: 'unknown',
}

// ---------------------------------------------------------------------------

describe('gidiş-dönüş: kanonik → Postgres → kanonik', () => {
  let restored: Run

  beforeAll(async () => {
    const suiteRow = toSuiteRow(suite, run.pins.suiteHash)
    await db.query(
      `INSERT INTO "Suite" ("id","name","skill","source","version","hash","host","model","systemPromptHash","activeSkills","updatedAt")
       VALUES ('s1',$1,$2,$3,$4,$5,$6,$7,$8,$9, now())`,
      [
        suiteRow.name,
        suiteRow.skill,
        suiteRow.source,
        suiteRow.version,
        suiteRow.hash,
        suiteRow.host,
        suiteRow.model,
        suiteRow.systemPromptHash,
        suiteRow.activeSkills,
      ],
    )

    const caseIds = new Map<string, string>()
    for (const [index, testCase] of suite.cases.entries()) {
      const row = toCaseRow(testCase)
      const id = `c${index}`
      caseIds.set(row.caseId, id)
      await db.query(
        `INSERT INTO "Case" ("id","suiteId","caseId","prompt","expectTriggered","notTriggered","assertions","nearNeighbour")
         VALUES ($1,'s1',$2,$3,$4,$5,$6::jsonb,$7)`,
        [
          id,
          row.caseId,
          row.prompt,
          row.expectTriggered,
          row.notTriggered,
          JSON.stringify(row.assertions),
          row.nearNeighbour,
        ],
      )
    }

    const runRow = toRunRow(run)
    await db.query(
      `INSERT INTO "Run" ("id","suiteId","startedAt","finishedAt","host","skill",
         "pinSkillSource","pinSkillHash","pinModel","pinSystemPromptHash",
         "pinSuiteVersion","pinSuiteHash","runsPerCase","verdict","unknownReason")
       VALUES ($1,'s1',$2,$3,$4,$14,$5,$6,$7,$8,$9,$10,$11,$12::"Verdict",$13)`,
      [
        runRow.id,
        runRow.startedAt,
        runRow.finishedAt,
        runRow.host,
        runRow.pinSkillSource,
        runRow.pinSkillHash,
        runRow.pinModel,
        runRow.pinSystemPromptHash,
        runRow.pinSuiteVersion,
        runRow.pinSuiteHash,
        runRow.runsPerCase,
        runRow.verdict,
        runRow.unknownReason,
        runRow.skill,
      ],
    )

    for (const [caseIndex, caseResult] of run.cases.entries()) {
      const row = toCaseResultRow(caseResult)
      const caseRowId = caseIds.get(row.caseId)
      const crId = `cr${caseIndex}`
      await db.query(
        `INSERT INTO "CaseResult" ("id","runId","caseId","passed","failed","unknown",
           "rateSuccesses","rateN","rateValue","ciLow","ciHigh","expectTriggered")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          crId,
          run.id,
          caseRowId,
          row.passed,
          row.failed,
          row.unknown,
          row.rateSuccesses,
          row.rateN,
          row.rateValue,
          row.ciLow,
          row.ciHigh,
          row.expectTriggered,
        ],
      )

      for (const [attemptIndex, a] of caseResult.attempts.entries()) {
        const ar = toAttemptRow(a)
        const aId = `a${caseIndex}-${attemptIndex}`
        await db.query(
          `INSERT INTO "Attempt" ("id","caseResultId","index","startedAt","finishedAt",
             "verdict","reason","triggerAvailable","triggerTriggered","triggerComplete",
             "triggerVia","triggerReason","triggerSkills","latencyMs","inputTokens","outputTokens","costUsd")
           VALUES ($1,$2,$3,$4,$5,$6::"Verdict",$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
          [
            aId,
            crId,
            ar.index,
            ar.startedAt,
            ar.finishedAt,
            ar.verdict,
            ar.reason,
            ar.triggerAvailable,
            ar.triggerTriggered,
            ar.triggerComplete,
            ar.triggerVia,
            ar.triggerReason,
            ar.triggerSkills,
            ar.latencyMs,
            ar.inputTokens,
            ar.outputTokens,
            ar.costUsd,
          ],
        )

        for (const event of a.trace ?? []) {
          const er = toTraceEventRow(event)
          await db.query(
            `INSERT INTO "TraceEvent" ("id","attemptId","seq","kind","at","callId","callRef",
               "tool","args","isError","error","text","acknowledgesError","skill","outcome")
             VALUES (gen_random_uuid()::text,$1,$2,$3::"TraceEventKind",$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14::"SessionOutcome")`,
            [
              aId,
              er.seq,
              er.kind,
              er.at,
              er.callId,
              er.callRef,
              er.tool,
              er.args === null ? null : JSON.stringify(er.args),
              er.isError,
              er.error,
              er.text,
              er.acknowledgesError,
              er.skill,
              er.outcome,
            ],
          )
        }

        if (a.env !== undefined) {
          const en = toEnvDiffRow(a.env)
          await db.query(
            `INSERT INTO "EnvDiff" ("id","attemptId","writes","deletes","network","unobserved")
             VALUES (gen_random_uuid()::text,$1,$2,$3,$4::jsonb,$5)`,
            [aId, en.writes, en.deletes, JSON.stringify(en.network), en.unobserved],
          )
        }
      }
    }

    // --- geri oku -----------------------------------------------------------
    const runRows = await db.query<Record<string, unknown>>(
      `SELECT * FROM "Run" WHERE "id"=$1`,
      [run.id],
    )
    const caseRows = await db.query<Record<string, unknown>>(
      `SELECT cr.*, c."caseId" AS "caseKey" FROM "CaseResult" cr
       JOIN "Case" c ON c."id" = cr."caseId"
       WHERE cr."runId"=$1 ORDER BY cr."id"`,
      [run.id],
    )

    const cases = []
    for (const cr of caseRows.rows) {
      const attemptRows = await db.query<Record<string, unknown>>(
        `SELECT * FROM "Attempt" WHERE "caseResultId"=$1 ORDER BY "index"`,
        [cr['id']],
      )
      const attempts = []
      for (const ar of attemptRows.rows) {
        const events = await db.query<Record<string, unknown>>(
          `SELECT * FROM "TraceEvent" WHERE "attemptId"=$1 ORDER BY "seq"`,
          [ar['id']],
        )
        const envRows = await db.query<Record<string, unknown>>(
          `SELECT * FROM "EnvDiff" WHERE "attemptId"=$1`,
          [ar['id']],
        )
        attempts.push(
          fromAttemptRow(
            ar as never,
            cr['caseKey'] as string,
            events.rows.length > 0 ? (events.rows as never) : undefined,
            envRows.rows[0] === undefined ? undefined : (envRows.rows[0] as never),
          ),
        )
      }
      const caseResultRow = { ...cr, caseId: cr['caseKey'] as string }
      cases.push(fromCaseResultRow(caseResultRow as never, attempts))
    }
    restored = fromRunRow(runRows.rows[0] as never, cases)
  }, 120_000)

  it('koşum kimliği, skill, host ve verdict korunur', () => {
    expect(restored.id).toBe(run.id)
    expect(restored.skill).toBe(run.skill)
    expect(restored.host).toBe(run.host)
    expect(restored.verdict).toBe(run.verdict)
    expect(restored.runs).toBe(run.runs)
  })

  it('dört pin ve iki denetçisi bire bir korunur', () => {
    expect(restored.pins).toEqual(run.pins)
  })

  it('oranlar aynı — N, değer ve aralık', () => {
    expect(restored.cases.map((c) => c.passRate)).toEqual(
      run.cases.map((c) => c.passRate),
    )
  })

  it('N=0 olan vaka geri okunduğunda da oransız kalır', () => {
    const empty = restored.cases.find((c) => c.caseId.includes('near_neighbor'))
    expect(empty?.passRate.rate).toBeNull()
    expect(empty?.passRate.ci).toBeNull()
  })

  it('okunamayan tetiklenme sinyali "tetiklenmedi"ye dönüşmez', () => {
    const trigger = restored.cases
      .flatMap((c) => c.attempts)
      .map((a) => a.trigger)
      .find((t) => !t.available)
    expect(trigger).toBeDefined()
    expect(trigger).not.toHaveProperty('triggered')
    expect(trigger?.available === false && trigger.reason).toContain('no skill marker')
  })

  it('iz olayları sırayla ve tüm alanlarıyla korunur', () => {
    const original = run.cases[0]?.attempts[0]?.trace ?? []
    const back = restored.cases[0]?.attempts[0]?.trace ?? []
    expect(back).toEqual(original)
  })

  it('ortam farkı ve gözlenemeyen araçlar korunur', () => {
    expect(restored.cases[0]?.attempts[0]?.env).toEqual(run.cases[0]?.attempts[0]?.env)
  })

  it('maliyet ve gecikme korunur', () => {
    expect(restored.cases[0]?.attempts[0]?.cost).toEqual(run.cases[0]?.attempts[0]?.cost)
    expect(restored.cases[0]?.attempts[0]?.latencyMs).toBe(4016)
  })

  it('unknown koşum gerekçesi kaydedildi — kısıt bunu zorunlu kılıyor', async () => {
    const rows = await db.query<{ unknownReason: string }>(
      `SELECT "unknownReason" FROM "Run" WHERE "id"=$1`,
      [run.id],
    )
    expect(rows.rows[0]?.unknownReason).toContain('could not be read')
  })
})

describe('yakın komşu işaretlemesi', () => {
  it.each([
    ['trigger.negative.near_neighbor.pdf', true],
    ['trigger.negative.unrelated', false],
    ['trigger.positive.explicit', false],
  ])('%s → %s', (caseId, expected) => {
    expect(isNearNeighbour(caseId)).toBe(expected)
  })
})

describe('uygulama katmanı kuralı — değişmez #5', () => {
  it('negatif vakası olan suite kaydedilebilir', () => {
    expect(() => assertSuiteStorable(suite)).not.toThrow()
  })

  it('negatif vakası olmayan suite reddedilir', () => {
    const positiveOnly = {
      ...suite,
      cases: suite.cases.filter((c) => c.expect.triggered !== false),
    }
    expect(() => assertSuiteStorable(positiveOnly)).toThrow('without a negative case')
  })

  it('yakın komşu yoksa uyarı verilir ama kayıt engellenmez', () => {
    const noNearNeighbour = {
      ...suite,
      cases: suite.cases.map((c) =>
        c.id.includes('near_neighbor') ? { ...c, id: 'trigger.negative.other' } : c,
      ),
    }
    expect(() => assertSuiteStorable(noNearNeighbour)).not.toThrow()
    expect(suiteWarnings(noNearNeighbour)[0]).toContain('near-neighbour')
  })

  it('yakın komşu varsa uyarı yok', () => {
    expect(suiteWarnings(suite)).toEqual([])
  })
})

describe('iz olayı dönüşümü', () => {
  it('bilinmeyen tür sessizce yutulmaz', () => {
    expect(() => fromTraceEventRow({ seq: 1, kind: 'NOPE' } as never)).toThrow(
      'unknown trace event kind',
    )
  })
})

/**
 * 0.2.0 — yeni alanlar gidiş-dönüşte kaybolmuyor.
 *
 * Hosted taraf kaydı **alır**, kendi formatını dayatmaz: bir alan eşlemede
 * düşerse ölçümün koşulu sessizce kaybolur. `pinEnvironmentHash` bunun canlı
 * örneğiydi — yerel kayıtta vardı, veritabanında hiç saklanmıyordu ve pin 3
 * yüklenen her koşumda "ölçülemedi" kalıyordu.
 */
describe('0.2.0 alanları — eşleme', () => {
  const bareRun = (overrides: Partial<Run> = {}): Run => ({
    id: 'r1',
    skill: 'docx',
    startedAt: '2026-09-05T00:00:00.000Z',
    finishedAt: '2026-09-05T00:00:10.000Z',
    host: 'claude-code',
    pins: {
      skillSource: 'o/r@1',
      skillHash: 'sha256:a',
      model: 'm',
      systemPromptHash: 'not-provided-by-host',
      suiteVersion: 1,
      suiteHash: 'sha256:b',
    },
    runs: 10,
    cases: [],
    verdict: 'pass',
    ...overrides,
  })

  it('reddedilen aktivasyon satıra ve geri kanonik hâle döner', () => {
    const refusals = [{ skill: 'docx', reason: 'the host denied permission' }]
    const row = toAttemptRow({
      ...attempt(0, 'unknown', true),
      trigger: {
        available: true,
        triggered: false,
        skills: [],
        refused: true,
        refusals,
        complete: true,
        via: 'confirmed Skill activation in stream-json',
      },
    })
    expect(row.triggerRefused).toBe(true)
    expect(row.triggerRefusals).toEqual(refusals)

    const back = fromAttemptRow(row, 'c', undefined, undefined)
    expect(back.trigger.available === true && back.trigger.refused).toBe(true)
    expect(back.trigger.available === true && back.trigger.refusals).toEqual(refusals)
  })

  it('sinyal okunamadıysa red durumu da null — "reddedilmedi" yazılmaz', () => {
    const row = toAttemptRow({
      ...attempt(0, 'unknown', false),
      trigger: { available: false, reason: 'no signal' },
    })
    expect(row.triggerRefused).toBeNull()
    expect(row.triggerRefusals).toEqual([])
  })

  it('hook olayı izde korunur', () => {
    const hook = {
      name: 'SessionStart:startup',
      event: 'SessionStart',
      phase: 'response' as const,
      exitCode: 1,
      outcome: 'cancelled',
      stdout: 'x',
    }
    const row = toTraceEventRow({ seq: 1, kind: 'hook', hook })
    expect(row.kind).toBe('HOOK')
    expect(row.hook).toEqual(hook)
    expect(fromTraceEventRow(row)).toEqual({ seq: 1, kind: 'hook', hook })
  })

  it('izin reddi araç sonucunda korunur', () => {
    const event = {
      seq: 2,
      kind: 'tool_result' as const,
      callId: 't1',
      tool: 'Skill',
      isError: true,
      error: 'denied',
      refusal: 'the host denied permission to use Skill',
    }
    expect(fromTraceEventRow(toTraceEventRow(event))).toEqual(event)
  })

  it('izin modu ve ortam hash"i koşum satırında durur', () => {
    const run = bareRun({
      pins: {
        skillSource: 'o/r@1',
        skillHash: 'sha256:a',
        model: 'm',
        systemPromptHash: 'not-provided-by-host',
        suiteVersion: 1,
        suiteHash: 'sha256:b',
        environmentHash: 'sha256:env',
      },
      permissionMode: 'acceptEdits',
    })
    const row = toRunRow(run)
    expect(row.permissionMode).toBe('acceptEdits')
    expect(row.pinEnvironmentHash).toBe('sha256:env')

    const back = fromRunRow(row, [])
    expect(back.permissionMode).toBe('acceptEdits')
    expect(back.pins.environmentHash).toBe('sha256:env')
  })

  it('beklenen kazanan: iddia yok, none ve liste ayri kaliyor (0.4.0)', () => {
    const base = run.cases[0] as NonNullable<(typeof run.cases)[number]>
    for (const expectedWinner of [undefined, [], ['a'], ['a', 'b']]) {
      const result = { ...base, ...(expectedWinner === undefined ? {} : { expectedWinner }) }
      const row = toCaseResultRow(result)
      expect(row.expectsWinner).toBe(expectedWinner !== undefined)
      const back = fromCaseResultRow(row, result.attempts)
      if (expectedWinner === undefined) expect('expectedWinner' in back).toBe(false)
      else expect(back.expectedWinner).toEqual(expectedWinner)
    }
  })

  it('vaka tanimi kazanan iddiasini tasiyor; none bayrak acik + bos liste (0.4.0)', () => {
    const parsed = parseSuite(`
version: 1
target: { skill: cro, source: o/r@1 }
environment: { host: h, model: m, system_prompt_hash: x, active_skills: [cro, signup] }
runs: 2
cases:
  - id: collide.signup.a
    prompt: p
    expect: { winner: signup }
  - id: negative.b
    prompt: p
    expect: { winner: none }
`)
    if (!parsed.ok) throw new Error(parsed.issues.map((i) => i.message).join('; '))
    const [a, b] = parsed.suite.cases.map(toCaseRow)
    expect([a?.expectsWinner, a?.expectedWinner]).toEqual([true, ['signup']])
    expect([b?.expectsWinner, b?.expectedWinner]).toEqual([true, []])
  })

  it('butce kesmesiyle unknown olan kosumun gerekcesi kesmeyi soyluyor', () => {
    // Bütçe kesmesi hiçbir denemeyi `unknown` yapmıyor; gerekçe denemelerden
    // türetilseydi yedek cümleye düşer ve "hiçbir deneme açıklamadı" derdi.
    const run = bareRun({
      verdict: 'unknown',
      skipped: [{ caseId: 'trigger.negative.x', reason: 'the attempt budget of 3 was reached', cause: 'budget' }],
    })
    const row = toRunRow(run)
    expect(row.unknownReason).toContain('the attempt budget cut 1 case(s)')
    expect(row.unknownReason).not.toContain('no attempt explained why')
    expect(fromRunRow(row, []).skipped).toEqual(run.skipped)
  })

  it('yarim kaydin gerekcesi kesilmeyi ve ulasilamayan vakalari soyluyor', () => {
    // Yarım kayıt hiçbir denemeyi `unknown` yapmadan `unknown`: gerekçe
    // denemelerden türetilseydi yedek cümleye düşerdi.
    const run = bareRun({
      verdict: 'unknown',
      partial: { reason: 'the run was interrupted', recoveredAt: '2026-09-10T00:00:00.000Z' },
      skipped: [
        { caseId: 'trigger.negative.x', reason: 'the run was interrupted before this case started', cause: 'interrupted' },
      ],
    })
    const row = toRunRow(run)
    expect(row.unknownReason).toContain('interrupted before 1 case(s) started')
    expect(row.unknownReason).toContain('the record is incomplete, so it cannot pass')
    expect(row.unknownReason).not.toContain('no attempt explained why')
    expect(fromRunRow(row, []).skipped).toEqual(run.skipped)
  })

  it('Assay surumu kosum satirinda durur; yoksa geri NULL degil alansiz gelir (0.3.2)', () => {
    const stamped = bareRun({ assayVersion: '0.3.2' })
    const row = toRunRow(stamped)
    expect(row.assayVersion).toBe('0.3.2')
    expect(fromRunRow(row, []).assayVersion).toBe('0.3.2')

    // Eski satır: sütun NULL. Kayda `assayVersion: null` olarak sızmıyor;
    // okuma tarafı etiketini `assayVersionLabel`dan alıyor.
    const old = fromRunRow(toRunRow(bareRun()), [])
    expect('assayVersion' in old).toBe(false)
  })

  it('ortam kaydi kosum satirinda durur ve geri okunur', () => {
    const environment = {
      model: 'claude-haiku-4-5-20251001',
      version: '2.1.263',
      permissionMode: 'bypassPermissions',
      tools: ['Bash', 'Read'],
      skills: ['impeccable'],
      agents: [],
      plugins: ['impeccable@4.2.2'],
    }
    const row = toRunRow(bareRun({ environment }))
    expect(row.environment).toEqual(environment)
    expect(fromRunRow(row, []).environment).toEqual(environment)
  })

  it('sekli tutmayan bir jsonb degeri ortam sayilmaz', () => {
    // Sütun jsonb; oraya ne yazıldığı çalışma zamanında bilinmiyor. Şekli
    // tutmayan bir değeri Environment diye geçirmek, karşılaştırmanın kayan
    // alanı yanlış okuması demek olurdu — düzeltilen kusurun bir katman
    // aşağıdaki hâli.
    const row = { ...toRunRow(bareRun({})), environment: { model: 'm' } }
    expect(fromRunRow(row, []).environment).toBeUndefined()
  })

  it('ortam yoksa alan hic yazilmaz — uydurulmaz', () => {
    const row = toRunRow(bareRun({}))
    expect(row.environment).toBeNull()
    expect(fromRunRow(row, []).environment).toBeUndefined()
  })

  it('host mod bildirmediyse alan geri okumada da yok — uydurulmaz', () => {
    const row = toRunRow(bareRun())
    expect(row.permissionMode).toBeNull()
    expect(fromRunRow(row, [])).not.toHaveProperty('permissionMode')
  })
})
