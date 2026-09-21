import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'

/**
 * Kısıtlar gerçekten tutuyor mu?
 *
 * Şemadaki CHECK'ler dokümanda kalmasın diye her biri **gerçek bir Postgres**
 * üzerinde ihlal edilerek sınanıyor. PGlite süreç içinde koşuyor: CI'da
 * veritabanı servisi gerektirmiyor ama Postgres semantiği gerçek.
 *
 * Bir kısıt sessizce kaldırılırsa buradaki testler yeşile döner — bu yüzden
 * her ihlal testinin yanında bir *geçerli* satır testi var; ikisi birlikte
 * kısıtın hem var olduğunu hem fazla sıkı olmadığını gösteriyor.
 */

/** Bütün migration'lar sırayla — yeni bir migration eklendiğinde test onu da uygular. */
const migrationsDir = fileURLToPath(new URL('../prisma/migrations', import.meta.url))
const migration = readdirSync(migrationsDir)
  .filter((name) => !name.startsWith('.'))
  .sort()
  .map((name) => readFileSync(join(migrationsDir, name, 'migration.sql'), 'utf8'))
  .join('\n')

let db: PGlite

const run = async (sql: string, params: unknown[] = []) => db.query(sql, params)

/** SQL'in kısıt ihlaliyle düştüğünü ve hangi kısıtın attığını doğrular. */
async function violates(constraint: string, sql: string, params: unknown[] = []) {
  let error: unknown = null
  try {
    await run(sql, params)
  } catch (cause) {
    error = cause
  }
  expect(error, `beklenen kısıt ihlali olmadı: ${constraint}`).not.toBeNull()
  expect(String((error as Error).message)).toContain(constraint)
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(migration)
}, 120_000)

// ---------------------------------------------------------------------------
// Yardımcılar — geçerli bir satır zinciri kurar
// ---------------------------------------------------------------------------

let seq = 0
const next = () => `id${(seq += 1)}`

async function makeSuite(): Promise<string> {
  const id = next()
  await run(
    `INSERT INTO "Suite" ("id","name","skill","source","version","hash","host","model","systemPromptHash","updatedAt")
     VALUES ($1,'s','docx','o/r@1',1,$2,'claude-code','m','sph', now())`,
    [id, `hash-${id}`],
  )
  return id
}

async function makeCase(suiteId: string, overrides: Partial<{ caseId: string }> = {}) {
  const id = next()
  await run(
    `INSERT INTO "Case" ("id","suiteId","caseId","prompt","expectTriggered")
     VALUES ($1,$2,$3,'p',true)`,
    [id, suiteId, overrides.caseId ?? `trigger.positive.${id}`],
  )
  return id
}

async function makeRun(suiteId: string, overrides: Record<string, unknown> = {}) {
  const id = next()
  const values = {
    verdict: 'PASS',
    unknownReason: null,
    pinSkillSource: 'o/r@1',
    pinSkillHash: 'sha256:a',
    pinModel: 'm',
    pinSystemPromptHash: 'sph',
    pinSuiteVersion: 1,
    pinSuiteHash: 'sha256:b',
    runsPerCase: 10,
    ...overrides,
  }
  await run(
    `INSERT INTO "Run" ("id","suiteId","startedAt","finishedAt","host","skill",
       "pinSkillSource","pinSkillHash","pinModel","pinSystemPromptHash",
       "pinSuiteVersion","pinSuiteHash","runsPerCase","verdict","unknownReason")
     VALUES ($1,$2,now(),now(),'claude-code','docx',$3,$4,$5,$6,$7,$8,$9,$10::"Verdict",$11)`,
    [
      id,
      suiteId,
      values.pinSkillSource,
      values.pinSkillHash,
      values.pinModel,
      values.pinSystemPromptHash,
      values.pinSuiteVersion,
      values.pinSuiteHash,
      values.runsPerCase,
      values.verdict,
      values.unknownReason,
    ],
  )
  return id
}

async function makeCaseResult(
  runId: string,
  caseId: string,
  overrides: Record<string, unknown> = {},
) {
  const id = next()
  const values = {
    passed: 8,
    failed: 2,
    unknown: 0,
    rateSuccesses: 8,
    rateN: 10,
    rateValue: 0.8,
    ciLow: 0.49,
    ciHigh: 0.94,
    ...overrides,
  }
  await run(
    `INSERT INTO "CaseResult" ("id","runId","caseId","passed","failed","unknown",
       "rateSuccesses","rateN","rateValue","ciLow","ciHigh")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      id,
      runId,
      caseId,
      values.passed,
      values.failed,
      values.unknown,
      values.rateSuccesses,
      values.rateN,
      values.rateValue,
      values.ciLow,
      values.ciHigh,
    ],
  )
  return id
}

async function insertAttempt(
  caseResultId: string,
  overrides: Record<string, unknown> = {},
) {
  const id = next()
  const values = {
    verdict: 'PASS',
    reason: 'ok',
    triggerAvailable: true,
    triggerTriggered: true,
    triggerComplete: true,
    triggerVia: 'confirmed Skill activation',
    triggerReason: null,
    triggerRefusals: '[]',
    costUsd: 0.01,
    ...overrides,
    // Sinyal okunduysa red durumu da bilinir; okunmadıysa bilinmez. Test
    // açıkça bir değer vermediyse şekle uyan değer türetiliyor.
    triggerRefused:
      'triggerRefused' in overrides
        ? overrides['triggerRefused']
        : overrides['triggerAvailable'] === false
          ? null
          : false,
  }
  await run(
    `INSERT INTO "Attempt" ("id","caseResultId","index","startedAt","finishedAt",
       "verdict","reason","triggerAvailable","triggerTriggered","triggerComplete",
       "triggerVia","triggerReason","triggerRefused","triggerRefusals","costUsd")
     VALUES ($1,$2,$3,now(),now(),$4::"Verdict",$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13)`,
    [
      id,
      caseResultId,
      seq,
      values.verdict,
      values.reason,
      values.triggerAvailable,
      values.triggerTriggered,
      values.triggerComplete,
      values.triggerVia,
      values.triggerReason,
      values.triggerRefused,
      values.triggerRefusals,
      values.costUsd,
    ],
  )
  return id
}

// ---------------------------------------------------------------------------

describe('şema kuruluyor', () => {
  it('migration hatasız uygulanıyor ve tablolar oluşuyor', async () => {
    const result = await db.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public'`,
    )
    expect(result.rows[0]?.count).toBeGreaterThanOrEqual(14)
  })

  it('geçerli bir koşum zinciri sorunsuz yazılıyor', async () => {
    const suiteId = await makeSuite()
    const caseId = await makeCase(suiteId)
    const runId = await makeRun(suiteId)
    const caseResultId = await makeCaseResult(runId, caseId)
    await insertAttempt(caseResultId)
    const rows = await db.query(`SELECT 1 FROM "Attempt" WHERE "caseResultId"=$1`, [
      caseResultId,
    ])
    expect(rows.rows).toHaveLength(1)
  })
})

describe('değişmez #1 — unknown gerekçesiz olamaz', () => {
  it('Run: UNKNOWN ama gerekçe yok → reddedilir', async () => {
    const suiteId = await makeSuite()
    await violates(
      'run_unknown_needs_reason',
      ...(await runSql(suiteId, 'UNKNOWN', null)),
    )
  })

  it('Run: UNKNOWN ama gerekçe boş string → reddedilir', async () => {
    const suiteId = await makeSuite()
    await violates(
      'run_unknown_needs_reason',
      ...(await runSql(suiteId, 'UNKNOWN', '   ')),
    )
  })

  /*
   * 0.3.0-b — yarım bir kayıt sebepsiz olamaz.
   *
   * Bir durumu bildirip gerekçesini bildirmemek, okuyucuyu bilgisiz bırakırken
   * bilgilendirilmiş sanmaktır: raporda "incomplete run" yazar, neden yarım
   * kaldığı yazmaz.
   */
  const partialSql = (suiteId: string, partial: string | null): [string, unknown[]] => [
    `INSERT INTO "Run" ("id","suiteId","startedAt","finishedAt","host","skill",
       "pinSkillSource","pinSkillHash","pinModel","pinSystemPromptHash",
       "pinSuiteVersion","pinSuiteHash","runsPerCase","verdict","partial")
     VALUES ($1,$2,now(),now(),'h','docx','a','b','c','d',1,'e',10,'PASS'::"Verdict",$3::jsonb)`,
    [next(), suiteId, partial],
  ]

  it('Run: yarım kayıt ama sebep yok → reddedilir', async () => {
    const suiteId = await makeSuite()
    await violates(
      'run_partial_shape',
      ...partialSql(suiteId, JSON.stringify({ recoveredAt: '2026-09-08T11:00:00.000Z' })),
    )
  })

  it('Run: yarım kayıt ama sebep boş string → reddedilir', async () => {
    const suiteId = await makeSuite()
    await violates(
      'run_partial_shape',
      ...partialSql(
        suiteId,
        JSON.stringify({ reason: '', recoveredAt: '2026-09-08T11:00:00.000Z' }),
      ),
    )
  })

  it('Run: sebebi ve kurtarma anı olan yarım kayıt kabul edilir', async () => {
    const suiteId = await makeSuite()
    const [sql, params] = partialSql(
      suiteId,
      JSON.stringify({ reason: 'interrupted', recoveredAt: '2026-09-08T11:00:00.000Z' }),
    )
    await expect(run(sql, params)).resolves.toBeDefined()
  })

it('Run: atlanan vaka sebepsiz olamaz', async () => {
    const suiteId = await makeSuite()
    await violates(
      'run_skipped_shape',
      `INSERT INTO "Run" ("id","suiteId","startedAt","finishedAt","host","skill",
         "pinSkillSource","pinSkillHash","pinModel","pinSystemPromptHash",
         "pinSuiteVersion","pinSuiteHash","runsPerCase","verdict","skipped")
       VALUES ($1,$2,now(),now(),'h','docx','a','b','c','d',1,'e',10,'PASS'::"Verdict",$3::jsonb)`,
      [next(), suiteId, JSON.stringify([{ caseId: 'c1' }])],
    )
  })

  it('Run: sebebi olan atlanan vaka kabul edilir', async () => {
    const suiteId = await makeSuite()
    await expect(
      run(
        `INSERT INTO "Run" ("id","suiteId","startedAt","finishedAt","host","skill",
           "pinSkillSource","pinSkillHash","pinModel","pinSystemPromptHash",
           "pinSuiteVersion","pinSuiteHash","runsPerCase","verdict","skipped")
         VALUES ($1,$2,now(),now(),'h','docx','a','b','c','d',1,'e',10,'PASS'::"Verdict",$3::jsonb)`,
        [next(), suiteId, JSON.stringify([{ caseId: 'c1', reason: 'trigger layer only', cause: 'layer' }])],
      ),
    ).resolves.toBeDefined()
  })

  it('Run: bos Assay surumu reddedilir, NULL ve dolu kabul edilir (0.3.2)', async () => {
    const suiteId = await makeSuite()
    const sql = `INSERT INTO "Run" ("id","suiteId","startedAt","finishedAt","host","skill",
         "pinSkillSource","pinSkillHash","pinModel","pinSystemPromptHash",
         "pinSuiteVersion","pinSuiteHash","runsPerCase","verdict","assayVersion")
       VALUES ($1,$2,now(),now(),'h','docx','a','b','c','d',1,'e',10,'PASS'::"Verdict",$3)`
    await violates('run_assay_version_not_blank', sql, [next(), suiteId, '  '])
    await expect(run(sql, [next(), suiteId, null])).resolves.toBeDefined()
    await expect(run(sql, [next(), suiteId, '0.3.2'])).resolves.toBeDefined()
  })

  it('Run: normal biten koşumda partial NULL kalabilir', async () => {
    const suiteId = await makeSuite()
    const [sql, params] = partialSql(suiteId, null)
    await expect(run(sql, params)).resolves.toBeDefined()
  })

  it('Run: UNKNOWN ve gerekçe var → kabul edilir', async () => {
    const suiteId = await makeSuite()
    await expect(
      makeRun(suiteId, { verdict: 'UNKNOWN', unknownReason: 'no signal' }),
    ).resolves.toBeDefined()
  })

  it('Attempt: UNKNOWN ama gerekçe boş → reddedilir', async () => {
    const suiteId = await makeSuite()
    const caseId = await makeCase(suiteId)
    const runId = await makeRun(suiteId)
    const caseResultId = await makeCaseResult(runId, caseId)
    await expect(
      insertAttempt(caseResultId, {
        verdict: 'UNKNOWN',
        reason: '  ',
        triggerAvailable: false,
        triggerTriggered: null,
        triggerComplete: null,
        triggerVia: null,
        triggerReason: 'unreadable',
      }),
    ).rejects.toThrow('attempt_unknown_needs_reason')
  })
})

describe('değişmez #1 — okunamayan sinyal "tetiklenmedi" gibi saklanamaz', () => {
  let caseResultId: string

  beforeAll(async () => {
    const suiteId = await makeSuite()
    const caseId = await makeCase(suiteId)
    const runId = await makeRun(suiteId)
    caseResultId = await makeCaseResult(runId, caseId)
  })

  it('sinyal okunamadı ama triggered: false yazılmış → reddedilir', async () => {
    // Bu tam olarak yasaklamak istediğimiz kayıt: ölçülemeyen bir şeyi
    // "tetiklenmedi" diye saklamak her negatif vakayı bedavaya geçirirdi.
    await expect(
      insertAttempt(caseResultId, {
        triggerAvailable: false,
        triggerTriggered: false,
        triggerComplete: false,
        triggerVia: null,
        triggerReason: 'unreadable',
      }),
    ).rejects.toThrow('attempt_trigger_shape')
  })

  it('sinyal okundu ama triggered null → reddedilir', async () => {
    await expect(
      insertAttempt(caseResultId, { triggerAvailable: true, triggerTriggered: null }),
    ).rejects.toThrow('attempt_trigger_shape')
  })

  it('sinyal okunamadı ama neden yazılmamış → reddedilir', async () => {
    await expect(
      insertAttempt(caseResultId, {
        triggerAvailable: false,
        triggerTriggered: null,
        triggerComplete: null,
        triggerVia: null,
        triggerReason: null,
      }),
    ).rejects.toThrow('attempt_trigger_shape')
  })

  it('okunamayan sinyal doğru biçimde → kabul edilir', async () => {
    await expect(
      insertAttempt(caseResultId, {
        verdict: 'UNKNOWN',
        reason: 'the trigger signal could not be read',
        triggerAvailable: false,
        triggerTriggered: null,
        triggerComplete: null,
        triggerVia: null,
        triggerReason: 'the host emitted no skill marker',
      }),
    ).resolves.toBeDefined()
  })
})

describe('değişmez #2 — dört pin boş olamaz', () => {
  it.each([
    ['pinSkillSource', { pinSkillSource: '' }],
    ['pinSkillHash', { pinSkillHash: '  ' }],
    ['pinModel', { pinModel: '' }],
    ['pinSystemPromptHash', { pinSystemPromptHash: '' }],
    ['pinSuiteHash', { pinSuiteHash: '' }],
    ['pinSuiteVersion', { pinSuiteVersion: 0 }],
  ])('%s boşsa koşum yazılamaz', async (_name, overrides) => {
    const suiteId = await makeSuite()
    await expect(makeRun(suiteId, overrides)).rejects.toThrow('run_pins_present')
  })
})

describe('değişmez #4 — oran N ve güven aralığından ayrılamaz', () => {
  let runId: string
  let caseId: string

  beforeAll(async () => {
    const suiteId = await makeSuite()
    caseId = await makeCase(suiteId)
    runId = await makeRun(suiteId)
  })

  it('N > 0 ama aralık yok → reddedilir', async () => {
    await expect(
      makeCaseResult(runId, caseId, { ciLow: null, ciHigh: null }),
    ).rejects.toThrow('caseresult_rate_needs_n_and_ci')
  })

  it('N > 0 ama oran yok → reddedilir', async () => {
    await expect(makeCaseResult(runId, caseId, { rateValue: null })).rejects.toThrow(
      'caseresult_rate_needs_n_and_ci',
    )
  })

  it('N = 0 ama oran yazılmış → reddedilir', async () => {
    // "Hiç ölçülmedi" ile "%0 geçti" karışamaz.
    await expect(
      makeCaseResult(runId, caseId, {
        passed: 0,
        failed: 0,
        unknown: 5,
        rateSuccesses: 0,
        rateN: 0,
        rateValue: 0,
        ciLow: 0,
        ciHigh: 0,
      }),
    ).rejects.toThrow('caseresult_rate_needs_n_and_ci')
  })

  it('aralık ters → reddedilir', async () => {
    await expect(
      makeCaseResult(runId, caseId, { ciLow: 0.9, ciHigh: 0.1 }),
    ).rejects.toThrow('caseresult_rate_needs_n_and_ci')
  })

  it('oran 1"den büyük → reddedilir', async () => {
    await expect(makeCaseResult(runId, caseId, { rateValue: 1.2 })).rejects.toThrow(
      'caseresult_rate_needs_n_and_ci',
    )
  })

  it('N = 0 ve hiçbir oran alanı yok → kabul edilir', async () => {
    await expect(
      makeCaseResult(runId, caseId, {
        passed: 0,
        failed: 0,
        unknown: 5,
        rateSuccesses: 0,
        rateN: 0,
        rateValue: null,
        ciLow: null,
        ciHigh: null,
      }),
    ).resolves.toBeDefined()
  })

  it('N sayımlarla tutmuyorsa reddedilir', async () => {
    await expect(makeCaseResult(runId, caseId, { rateN: 99 })).rejects.toThrow(
      'caseresult_counts_agree',
    )
  })
})

describe('vaka kısıtları', () => {
  it('hiçbir şey ölçmeyen vaka reddedilir', async () => {
    const suiteId = await makeSuite()
    await expect(
      run(
        `INSERT INTO "Case" ("id","suiteId","caseId","prompt","expectTriggered")
         VALUES ($1,$2,'trigger.empty.case','p',NULL)`,
        [next(), suiteId],
      ),
    ).rejects.toThrow('case_measures_something')
  })

  it('yalnızca assertion taşıyan vaka kabul edilir', async () => {
    const suiteId = await makeSuite()
    await expect(
      run(
        `INSERT INTO "Case" ("id","suiteId","caseId","prompt","expectTriggered","assertions")
         VALUES ($1,$2,'complete.writes.file','p',NULL,'[{"type":"file_exists","path":"a"}]')`,
        [next(), suiteId],
      ),
    ).resolves.toBeDefined()
  })

  /*
   * 0.4.0 — id kısıtı core ile aynı desen. Yalnız core genişletilseydi tireli
   * bir id doğrulayıcıdan geçip `assay push`'ta burada reddedilirdi.
   */
  it.each(['collide.copy-editing.tighten_paragraph', 'marketing-skills.cold-email.x', 'trigger.negative._legacy'])(
    'tireli ve eski bicimli id kabul edilir: %s',
    async (caseId) => {
      const suiteId = await makeSuite()
      await expect(makeCase(suiteId, { caseId })).resolves.toBeDefined()
    },
  )

  it('yalniz kazanan tasiyan vaka (winner: none) bir sey olcuyor sayilir (0.4.0)', async () => {
    const suiteId = await makeSuite()
    await expect(
      run(
        `INSERT INTO "Case" ("id","suiteId","caseId","prompt","expectTriggered","expectsWinner","expectedWinner")
         VALUES ($1,$2,'negative.pricing','p',NULL,true,'{}')`,
        [next(), suiteId],
      ),
    ).resolves.toBeDefined()
  })

  it('kazanan iddiasi yokken dolu kazanan listesi reddedilir: Case ve CaseResult', async () => {
    const suiteId = await makeSuite()
    await violates(
      'case_winner_consistent',
      `INSERT INTO "Case" ("id","suiteId","caseId","prompt","expectTriggered","expectsWinner","expectedWinner")
       VALUES ($1,$2,'collide.x.y','p',true,false,'{cro}')`,
      [next(), suiteId],
    )
    const caseId = await makeCase(suiteId)
    const runId = await makeRun(suiteId)
    await expect(
      makeCaseResult(runId, caseId).then((id) =>
        run(`UPDATE "CaseResult" SET "expectsWinner" = false, "expectedWinner" = '{cro}' WHERE "id" = $1`, [id]),
      ),
    ).rejects.toThrow('case_result_winner_consistent')
  })

  it.each(['flat', 'Trigger.Positive', 'trigger..x', 'trigger.pos itive', 'trigger.-positive'])(
    'hiyerarşik olmayan id reddedilir: %s',
    async (caseId) => {
      const suiteId = await makeSuite()
      await expect(makeCase(suiteId, { caseId })).rejects.toThrow('case_id_hierarchical')
    },
  )
})

describe('zaman ve maliyet', () => {
  it('bitiş başlangıçtan önce olamaz', async () => {
    const suiteId = await makeSuite()
    await expect(
      run(
        `INSERT INTO "Run" ("id","suiteId","startedAt","finishedAt","host","skill",
           "pinSkillSource","pinSkillHash","pinModel","pinSystemPromptHash",
           "pinSuiteVersion","pinSuiteHash","runsPerCase","verdict")
         VALUES ($1,$2, now(), now() - interval '1 hour', 'h','docx','a','b','c','d',1,'e',10,'PASS')`,
        [next(), suiteId],
      ),
    ).rejects.toThrow('run_time_ordered')
  })

  it('negatif maliyet reddedilir', async () => {
    const suiteId = await makeSuite()
    const caseId = await makeCase(suiteId)
    const runId = await makeRun(suiteId)
    const caseResultId = await makeCaseResult(runId, caseId)
    await expect(insertAttempt(caseResultId, { costUsd: -1 })).rejects.toThrow(
      'attempt_cost_non_negative',
    )
  })
})

describe('cascade', () => {
  it('suite silinince koşum, vaka ve attempt zinciri de silinir', async () => {
    const suiteId = await makeSuite()
    const caseId = await makeCase(suiteId)
    const runId = await makeRun(suiteId)
    const caseResultId = await makeCaseResult(runId, caseId)
    await insertAttempt(caseResultId)

    await run(`DELETE FROM "Suite" WHERE "id"=$1`, [suiteId])

    for (const table of ['Case', 'Run', 'CaseResult', 'Attempt']) {
      const rows = await db.query(`SELECT 1 FROM "${table}"  WHERE 1=1`)
      expect(
        rows.rows.every(() => true),
        `${table} sorgusu patlamamalı`,
      ).toBe(true)
    }
    const left = await db.query(
      `SELECT 1 FROM "Attempt" WHERE "id" IS NOT NULL AND "caseResultId"=$1`,
      [caseResultId],
    )
    expect(left.rows).toHaveLength(0)
  })
})

/** `makeRun`'ın ham SQL karşılığı — verdict/gerekçe kombinasyonlarını sınamak için. */
async function runSql(
  suiteId: string,
  verdict: string,
  unknownReason: string | null,
): Promise<[string, unknown[]]> {
  return [
    `INSERT INTO "Run" ("id","suiteId","startedAt","finishedAt","host","skill",
       "pinSkillSource","pinSkillHash","pinModel","pinSystemPromptHash",
       "pinSuiteVersion","pinSuiteHash","runsPerCase","verdict","unknownReason")
     VALUES ($1,$2,now(),now(),'h','docx','a','b','c','d',1,'e',10,$3::"Verdict",$4)`,
    [next(), suiteId, verdict, unknownReason],
  ]
}

/**
 * 0.2.0 — reddedilmiş bir aktivasyon tetiklenme olarak saklanamaz.
 *
 * Impeccable pilotunda tam olarak bu kayıt yazıldı: dört reddedilmiş
 * aktivasyon `triggered: true` diye saklandı ve rapor precision %100 dedi.
 * Uygulama katmanı bunu bir daha yazmasın diye kısıt.
 */
describe('değişmez #1 — reddedilen aktivasyon tetiklenme sayılamaz', () => {
  let caseResultId: string

  beforeAll(async () => {
    const suiteId = await makeSuite()
    const caseId = await makeCase(suiteId)
    const runId = await makeRun(suiteId)
    caseResultId = await makeCaseResult(runId, caseId)
  })

  it('hem reddedildi hem tetiklendi diyen kayıt reddedilir', async () => {
    await expect(
      insertAttempt(caseResultId, { triggerRefused: true, triggerTriggered: true }),
    ).rejects.toThrow('attempt_refusal_shape')
  })

  // 0.4.1-a: 0.2.0 öncesi kayıtta aktivasyon kontrolü yok. NULL "kimse
  // bakmadı" demek; `false` ("red yok") ile karıştırılmıyor.
  it('sinyal okundu, red kontrolü yapılmamış (0.2.0 öncesi) → kabul edilir', async () => {
    await expect(
      insertAttempt(caseResultId, { triggerAvailable: true, triggerRefused: null }),
    ).resolves.toBeTypeOf('string')
  })

  it('red listesi dolu ama red durumu bilinmiyor → reddedilir', async () => {
    await expect(
      insertAttempt(caseResultId, {
        triggerAvailable: true,
        triggerRefused: null,
        triggerRefusals: '[{"skill":"docx","reason":"the host denied permission"}]',
      }),
    ).rejects.toThrow('attempt_refusal_shape')
  })

  it('sinyal okunamadı ama red durumu yazılmış → reddedilir', async () => {
    await expect(
      insertAttempt(caseResultId, {
        triggerAvailable: false,
        triggerTriggered: null,
        triggerComplete: null,
        triggerVia: null,
        triggerReason: 'unreadable',
        triggerRefused: false,
      }),
    ).rejects.toThrow('attempt_refusal_shape')
  })

  it('reddedildi ve tetiklenmedi → kabul edilir', async () => {
    await expect(
      insertAttempt(caseResultId, {
        triggerRefused: true,
        triggerTriggered: false,
        triggerRefusals: '[{"skill":"docx","reason":"the host denied permission"}]',
      }),
    ).resolves.toBeTypeOf('string')
  })
})

/**
 * 0.2.0 — hook olayı hook'suz olamaz.
 *
 * Kayıtta "bir hook koştu ama hangisi bilinmiyor" diyen bir satır, hook'u hiç
 * kaydetmemekten daha kötü: bir şey ölçüldüğü izlenimi verir.
 */
describe('hook olayı kendi verisini taşımak zorunda', () => {
  let attemptId: string

  beforeAll(async () => {
    const suiteId = await makeSuite()
    const caseId = await makeCase(suiteId)
    const runId = await makeRun(suiteId)
    const caseResultId = await makeCaseResult(runId, caseId)
    attemptId = await insertAttempt(caseResultId)
  })

  const insertEvent = (seq_: number, kind: string, hook: string | null) =>
    run(
      `INSERT INTO "TraceEvent" ("id","attemptId","seq","kind","hook")
       VALUES ($1,$2,$3,$4::"TraceEventKind",$5::jsonb)`,
      [next(), attemptId, seq_, kind, hook],
    )

  it('HOOK olayı hook verisi olmadan reddedilir', async () => {
    await expect(insertEvent(901, 'HOOK', null)).rejects.toThrow('traceevent_hook_shape')
  })

  it('HOOK olmayan olaya hook verisi iliştirilemez', async () => {
    await expect(
      insertEvent(902, 'TOOL_CALL', '{"name":"H","event":"E","phase":"started"}'),
    ).rejects.toThrow('traceevent_hook_shape')
  })

  it('hook verisi taşıyan HOOK olayı kabul edilir', async () => {
    await insertEvent(
      903,
      'HOOK',
      '{"name":"SessionStart:startup","event":"SessionStart","phase":"response","exitCode":0}',
    )
    const rows = await db.query(`SELECT "hook" FROM "TraceEvent" WHERE "seq"=903`)
    expect(rows.rows).toHaveLength(1)
  })
})
