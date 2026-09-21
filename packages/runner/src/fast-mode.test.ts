/**
 * 0.3.0-e — hızlı mod.
 *
 * Kural: **yarım vaka üretme.** Hızlı mod dar bir ölçüm, eksik bir ölçüm
 * değil. Sınananlar:
 *   - ölçülen katmanlar kayda yazılıyor
 *   - yalnızca artefakt ölçen vaka hiç koşulmuyor ve sebebiyle kayda giriyor
 *   - koşulan vakada assertion'lar `unknown`a çevrilmiyor, ayrı listede
 *   - bütçe tavanı dolunca kalan vakalar sebebiyle kayda giriyor
 *
 * Her iddianın yanında bir **pozitif kontrol** var: "atlandı" diyen bir test,
 * hiçbir şey koşulmadığında da yeşil kalabilir. Bu tuzağa 0.3.0-c ve -d'de iki
 * kez düşüldü; burada baştan kapatılıyor.
 */

import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseSuite, type Suite } from '@ktlsr/assay-core'
import { beforeAll, describe, expect, it } from 'vitest'
import { runSuite } from './run.js'
import { MockAdapter, type MockScenario } from './testing/mock-adapter.js'

/**
 * Üç vaka: tetiklenme + assertion, yalnız tetiklenme, yalnız assertion.
 * Üçüncüsü hızlı modda ölçülecek hiçbir şey taşımıyor.
 */
const SUITE_SOURCE = `
version: 1
target: { skill: widget, source: local@abc123 }
environment:
  host: mock
  model: test-model-1
  system_prompt_hash: sha256:aaa
runs: 5
cases:
  - id: trigger.positive.explicit
    prompt: one
    expect:
      triggered: true
      assertions:
        - { type: file_exists, path: 'out/*' }
        - { type: side_effect, network: deny }
  - id: trigger.negative.near_neighbor.readme
    prompt: two
    expect: { triggered: false }
  - id: complete.only_artifact
    prompt: three
    expect:
      assertions:
        - { type: file_exists, path: 'out/manifest.json' }
`

const triggered = (): MockScenario => ({
  trigger: {
    available: true,
    triggered: true,
    skills: ['widget'],
    refused: false,
    refusals: [],
    complete: true,
    via: 'mock',
  },
  trace: [{ seq: 1, kind: 'session_end', outcome: 'completed' }],
})

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const envAdapter = join(repoRoot, 'tools/fixtures/env-adapter.mjs')

let suite: Suite
let skillPath: string

beforeAll(async () => {
  const parsed = parseSuite(SUITE_SOURCE)
  if (!parsed.ok) throw new Error(parsed.issues.map((i) => i.message).join('; '))
  suite = parsed.suite
  skillPath = await mkdtemp(join(tmpdir(), 'assay-skill-'))
  await writeFile(join(skillPath, 'SKILL.md'), '# widget\n')
  // Worker derlenmiş `dist`ten koşuyor; bayat `dist` eski kodu ölçer.
  execFileSync(process.execPath, [join(repoRoot, 'node_modules/typescript/bin/tsc'), '-b'], {
    cwd: repoRoot,
    stdio: 'inherit',
  })
}, 180_000)

const fastRun = (extra: Record<string, unknown> = {}) =>
  runSuite(suite, new MockAdapter({ scenarios: [triggered()] }), {
    source: SUITE_SOURCE,
    skillPath,
    repeat: 3,
    layers: ['trigger'],
    ...extra,
  })

describe('ölçülen katman kayda giriyor', () => {
  it('hizli modda layers yaziliyor, tam modda yazilmiyor', async () => {
    const fast = await fastRun()
    expect(fast.layers).toEqual(['trigger'])

    // Pozitif kontrol: tam modda alan yok, yani `layers` gerçekten moda bağlı.
    const full = await runSuite(suite, new MockAdapter({ scenarios: [triggered()] }), {
      source: SUITE_SOURCE,
      skillPath,
      repeat: 2,
    })
    expect(full.layers).toBeUndefined()
  })
})

describe('yalnızca artefakt ölçen vaka koşulmuyor', () => {
  it('atlanan vaka sebebiyle kayda giriyor; digerleri KOSULUYOR', async () => {
    const record = await fastRun()

    // Pozitif kontrol önce: bir şeyler gerçekten koşmuş olmalı. Bu satır
    // olmadan "hiçbir şey koşmadı" hâli de testi geçerdi.
    expect(record.cases.map((c) => c.caseId)).toEqual([
      'trigger.positive.explicit',
      'trigger.negative.near_neighbor.readme',
    ])
    expect(record.cases.every((c) => c.attempts.length === 3)).toBe(true)

    // Ve atlanan vaka kayıtta, sebebiyle.
    expect(record.skipped).toEqual([
      {
        caseId: 'complete.only_artifact',
        reason:
          'the case only declares assertions, and this run measured the trigger layer only',
        cause: 'layer',
      },
    ])
  })

  it('atlanan vaka cases icinde SIFIR denemeyle gorunmuyor', async () => {
    // "Koşulmadı" ile "koşuldu, karar çıkmadı" ayrı şeyler; N=0'lık bir satır
    // ikincisi gibi okunurdu.
    const record = await fastRun()
    expect(record.cases.some((c) => c.caseId === 'complete.only_artifact')).toBe(false)
  })

  it('tam modda o vaka da kosuluyor', async () => {
    // Pozitif kontrol: vakayı eleyen şey hızlı mod, vakanın kendisi değil.
    const full = await runSuite(suite, new MockAdapter({ scenarios: [triggered()] }), {
      source: SUITE_SOURCE,
      skillPath,
      repeat: 2,
    })
    expect(full.cases.map((c) => c.caseId)).toContain('complete.only_artifact')
    expect(full.skipped).toBeUndefined()
  })
})

describe('assertionlar unknowna çevrilmiyor', () => {
  it('degerlendirilmeyen assertionlar ayri listede ve verdict unknown DEGIL', async () => {
    const record = await fastRun()
    const withAssertions = record.cases.find(
      (c) => c.caseId === 'trigger.positive.explicit',
    )
    const attempt = withAssertions?.attempts[0]

    // Beyan edilen iki assertion listeleniyor…
    expect(attempt?.notEvaluated?.map((a) => a.type)).toEqual([
      'file_exists',
      'side_effect',
    ])
    // …sonuç listesinde değiller…
    expect(attempt?.assertions).toEqual([])
    // …ve koşum ölçülemez ilan edilmiyor: hiçbir deneme `unknown` değil.
    expect(attempt?.verdict).toBe('pass')
    expect(record.cases.every((c) => c.unknown === 0)).toBe(true)

    /*
     * Pozitif kontrol: koşum gerçekten ölçüm yapıyor.
     *
     * Sahte adaptör her vakada tetikliyor, yani negatif vaka DÜŞMELİ. Koşum
     * verdict'i `fail` — ve bu iyi haber: `unknown` olmaması, hiçbir şey
     * ölçülmediği için değil, ölçülüp karar verildiği için.
     */
    expect(record.verdict).toBe('fail')
    const negative = record.cases.find(
      (c) => c.caseId === 'trigger.negative.near_neighbor.readme',
    )
    expect(negative?.failed).toBe(3)
  })

  it('tam modda ayni assertionlar degerlendiriliyor', async () => {
    // Pozitif kontrol: `notEvaluated` moda bağlı, assertion'ın kendisine değil.
    const full = await runSuite(suite, new MockAdapter({ scenarios: [triggered()] }), {
      source: SUITE_SOURCE,
      skillPath,
      repeat: 1,
    })
    const attempt = full.cases[0]?.attempts[0]
    expect(attempt?.notEvaluated).toBeUndefined()
    expect(attempt?.assertions.length).toBe(2)
  })
})

describe('bütçe tavanı', () => {
  it('tavan dolunca kalan vaka sebebiyle kayda giriyor', async () => {
    // Tavan 3: ilk vaka (3 deneme) koşar, ikincisi sığmaz.
    const record = await fastRun({ maxAttempts: 3 })
    expect(record.cases.map((c) => c.caseId)).toEqual(['trigger.positive.explicit'])
    expect(record.skipped?.map((s) => s.caseId)).toContain(
      'trigger.negative.near_neighbor.readme',
    )
    expect(record.skipped?.find((s) => s.caseId === 'trigger.negative.near_neighbor.readme')?.reason).toContain(
      'attempt budget of 3',
    )
  })

  it('tavan genisse hicbir vaka bu sebeple atlanmiyor', async () => {
    // Pozitif kontrol: tavan gerçekten sınır, sabit bir davranış değil.
    const record = await fastRun({ maxAttempts: 100 })
    expect(record.skipped?.every((s) => s.cause !== 'budget')).toBe(true)
  })
})

/**
 * Bütçenin kestiği koşum `pass` veremez.
 *
 * Gerçek hostta ölçüldü (2026-09-10): `--max-attempts 3` hiçbir negatif vakayı
 * koşturmadan doldu ve koşum yalnız pozitiflerle PASS dedi. Buradaki ilk test
 * tam o durumu kuruyor: tavan yalnız pozitife yetiyor, negatif hiç koşmuyor.
 */
describe('bütçe kesmesi ve verdict', () => {
  const notTriggered = (): MockScenario => ({
    trigger: {
      available: true,
      triggered: false,
      skills: [],
      refused: false,
      refusals: [],
      complete: true,
      via: 'mock',
    },
    trace: [{ seq: 1, kind: 'session_end', outcome: 'completed' }],
  })

  it('negatifleri kesen tavanla, olculen her deneme gecse bile kosum PASS DEGIL', async () => {
    const record = await fastRun({ maxAttempts: 3 })
    // Pozitif kontrol: ölçülen denemelerin hepsi geçti — verdict'i düşüren
    // bir `unknown` ya da `fail` deneme yok, düşüren tek şey bütçe kesmesi.
    const attempts = record.cases.flatMap((c) => c.attempts)
    expect(attempts).toHaveLength(3)
    expect(attempts.every((a) => a.verdict === 'pass')).toBe(true)
    expect(record.skipped?.some((s) => s.cause === 'budget')).toBe(true)

    expect(record.verdict).toBe('unknown')
  })

  it('olculmus bir fail bütçe kesmesine ragmen fail kalir', async () => {
    // Ajan hiç tetiklenmiyor: pozitif ölçülüp düşüyor, tavan (3) negatifi kesiyor.
    const record = await runSuite(suite, new MockAdapter({ scenarios: [notTriggered()] }), {
      source: SUITE_SOURCE,
      skillPath,
      repeat: 3,
      layers: ['trigger'],
      maxAttempts: 3,
    })
    expect(record.skipped?.some((s) => s.cause === 'budget')).toBe(true)
    expect(record.cases[0]?.failed).toBe(3)
    expect(record.verdict).toBe('fail')
  })

  it('katman elemesi tek basina verdict i dusurmez', async () => {
    // Pozitif tetikleniyor, negatif tetiklenmiyor: ölçülen her şey geçiyor.
    // Tek atlanan vaka yalnız-artefakt vakası — kullanıcının beyan ettiği kapsam.
    const record = await runSuite(
      suite,
      new MockAdapter({ scenarios: [triggered(), notTriggered()] }),
      { source: SUITE_SOURCE, skillPath, repeat: 1, layers: ['trigger'] },
    )
    expect(record.skipped?.map((s) => s.cause)).toEqual(['layer'])
    expect(record.cases.flatMap((c) => c.attempts).every((a) => a.verdict === 'pass')).toBe(true)
    expect(record.verdict).toBe('pass')
  })

  it('journal basligi planlanan kapsami tasiyor — kurtarilan kosum da bilsin', async () => {
    // Koşum bitince journal siliniyor; başlık, ilk deneme bittiği anda okunuyor.
    const journalDir = await mkdtemp(join(tmpdir(), 'assay-journal-'))
    let header: Record<string, unknown> | undefined
    await fastRun({
      maxAttempts: 3,
      journalDir,
      onProgress: () => {
        if (header !== undefined) return
        const file = readdirSync(journalDir).find((name) => name.endsWith('.partial.jsonl'))
        if (file === undefined) return
        header = JSON.parse(readFileSync(join(journalDir, file), 'utf8').split('\n')[0] as string)
      },
    })
    expect(header?.['layers']).toEqual(['trigger'])
    expect((header?.['skipped'] as { cause: string }[]).map((s) => s.cause)).toEqual([
      'budget',
      'layer',
    ])
  })
})

/**
 * 0.3.2 — kayıt onu üreten Assay sürümünü taşır.
 *
 * Değer runner'ın kendi `package.json`'undan; test onu diskten ayrıca okuyup
 * karşılaştırıyor. Elle yazılmış bir sabit, sürüm PR'ında unutulurdu.
 */
describe('Assay sürümü damgası', () => {
  const version = (
    JSON.parse(readFileSync(join(repoRoot, 'packages/runner/package.json'), 'utf8')) as {
      version: string
    }
  ).version

  it('kosum kaydi runner paketinin surumunu tasiyor', async () => {
    const record = await fastRun()
    expect(version).toMatch(/^\d+\.\d+\.\d+/)
    expect(record.assayVersion).toBe(version)
  })
})

/**
 * Süreç sınırını geçen hızlı mod.
 *
 * Bu testin varlık sebebi gerçek bir kusur: `layers` worker payload'ında yoktu
 * ve izole koşumda (CLI'ın varsayılanı) assertion'lar yine değerlendiriliyordu.
 * Süreç içi birim testleri sınırı geçmediği için hepsi yeşildi; kusuru uçtan
 * uca duman testi gösterdi. Artık burada kilitli.
 */
describe('hızlı mod izolasyonla birlikte', () => {
  it('worker da katman filtresini uyguluyor', async () => {
    const record = await runSuite(suite, new MockAdapter({ scenarios: [triggered()] }), {
      source: SUITE_SOURCE,
      skillPath,
      repeat: 1,
      layers: ['trigger'],
      isolate: { module: envAdapter, export: 'EnvReportingAdapter' },
      attemptTimeoutMs: 60_000,
    })

    const withAssertions = record.cases.find(
      (c) => c.caseId === 'trigger.positive.explicit',
    )
    const attempt = withAssertions?.attempts[0]
    // Pozitif kontrol: deneme gerçekten worker'da koştu (fixture adaptörün izi).
    expect(attempt?.trigger.available && attempt.trigger.via).toContain('PORT=')
    // Ve assertion'lar değerlendirilmedi.
    expect(attempt?.assertions).toEqual([])
    expect(attempt?.notEvaluated?.map((a) => a.type)).toEqual(['file_exists', 'side_effect'])
  }, 120_000)
})

/**
 * 0.4.3: kazanan beyanı bir tetiklenme iddiası. Gerçek çakışma koşumunda
 * (2026-09-11) yalnızca `winner` taşıyan tartışmalı vaka hızlı modda "only
 * declares assertions" diye atlandı ve hiç ölçülmedi.
 */
describe('hızlı mod ve kazanan beyanı', () => {
  const COLLISION_SOURCE = `
version: 1
target: { skill: widget, source: local@abc123 }
environment:
  host: mock
  model: test-model-1
  system_prompt_hash: sha256:aaa
  active_skills: [widget, other]
runs: 5
cases:
  - id: contested.widget_or_other
    prompt: one
    expect:
      winner: [widget, other]
  - id: trigger.negative.unrelated
    prompt: two
    expect: { winner: none }
`

  it('yalnızca kazanan beyan eden vaka hızlı modda koşuluyor ve kazanan kuralıyla ölçülüyor', async () => {
    const parsed = parseSuite(COLLISION_SOURCE)
    if (!parsed.ok) throw new Error(parsed.issues.map((i) => i.message).join('; '))
    const result = await runSuite(parsed.suite, new MockAdapter({ scenarios: [triggered()] }), {
      source: COLLISION_SOURCE,
      skillPath,
      repeat: 3,
      layers: ['trigger'],
    })
    expect(result.skipped ?? []).toEqual([])
    const contested = result.cases.find((c) => c.caseId === 'contested.widget_or_other')
    expect(contested?.attempts).toHaveLength(3)
    // Pozitif kontrol: koşuldu VE kazanan kuralı uygulandı (widget ilk tetiklendi).
    expect(contested?.attempts[0]?.triggerCheck?.verdict).toBe('pass')
    expect(contested?.attempts[0]?.triggerCheck?.reason).toContain('triggered first')
  })
})
