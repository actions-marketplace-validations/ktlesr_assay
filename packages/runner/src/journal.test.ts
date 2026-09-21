/**
 * 0.3.0-b — öldürülen koşum ölçtüğünü kaybetmesin.
 *
 * Buradaki asıl test taklit değil: gerçek bir çocuk süreç başlatılıyor, koşum
 * ortasında SIGKILL ile öldürülüyor ve journal'ın diskte ne bıraktığına
 * bakılıyor. Kaybın nasıl olduğu ancak yazan süreç haber vermeden öldüğünde
 * görülür; `try/finally` ile taklit edilen bir "çökme" tam da bu yüzden
 * yeterli değil.
 */

import { execFileSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { appendFile, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  findJournals,
  readJournal,
  recoverJournal,
  RunJournal,
  JOURNAL_SUFFIX,
} from './journal.js'
import { verdictOf } from './assemble.js'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../..')
const harness = join(repoRoot, 'tools/fixtures/killable-run.mjs')

let skillPath: string

beforeAll(async () => {
  skillPath = await mkdtemp(join(tmpdir(), 'assay-skill-'))
  await writeFile(join(skillPath, 'SKILL.md'), '# widget\n')

  /*
   * Çocuk süreç derlenmiş `dist`ten içe aktarıyor, o yüzden HER koşumda
   * derleniyor.
   *
   * "dist varsa atla" yetmiyor: bayat bir `dist` ile bu test eski kodu
   * ölçer ve yeşil görünür — ölçtüğünü sandığı şeyi ölçmemenin ta kendisi.
   * Bu tuzağa bir kez düşüldü (kaynak geri yüklendi, `tsc -b` zaman damgasına
   * bakıp derlemeyi atladı, test eski `dist`i koştu).
   *
   * Güncelken maliyeti ölçüldü: ~100 ms.
   */
  execFileSync(process.execPath, [join(repoRoot, 'node_modules/typescript/bin/tsc'), '-b'], {
    cwd: repoRoot,
    stdio: 'inherit',
  })
  if (!existsSync(join(repoRoot, 'packages/runner/dist/index.js'))) {
    throw new Error('the runner was not built; the child process has nothing to import')
  }
}, 180_000)

// ---------------------------------------------------------------------------
// Gerçek senaryo: süreç koşum ortasında öldürülüyor
// ---------------------------------------------------------------------------

describe('koşum ortasında öldürülen süreç', () => {
  it('tamamlanmış denemeler journal da kalir ve recover onlari toplar', async () => {
    const storeDir = await mkdtemp(join(tmpdir(), 'assay-store-'))
    const child = spawn(process.execPath, [harness, storeDir, skillPath], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    // Üç deneme bitene kadar bekle, sonra öldür. Ölçülen ajanın runner'ı
    // porta göre öldürdüğü gerçek durum da tam olarak böyle: haber yok,
    // temizlik yok, `finally` yok.
    const killed = await new Promise<number>((resolveDone, rejectDone) => {
      let completed = 0
      const timer = setTimeout(() => rejectDone(new Error('child never reported an attempt')), 60_000)
      child.stdout.setEncoding('utf8')
      child.stdout.on('data', (chunk: string) => {
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('attempt ')) continue
          completed += 1
          if (completed === 3) {
            clearTimeout(timer)
            child.kill('SIGKILL')
            child.on('close', () => resolveDone(completed))
          }
        }
      })
      child.on('error', rejectDone)
    })
    expect(killed).toBe(3)

    // 1. Journal diskte duruyor ve tamamlanmış denemeleri taşıyor.
    const journals = await findJournals(storeDir)
    expect(journals).toHaveLength(1)
    const contents = await readJournal(journals[0] as string)
    expect(contents?.attempts.length).toBeGreaterThanOrEqual(3)

    // 2. Kurtarma onları kanonik bir kayda çeviriyor.
    const recovered = await recoverJournal(journals[0] as string)
    expect(recovered).not.toBeNull()
    const run = recovered?.run
    const attempts = run?.cases.reduce((sum, c) => sum + c.attempts.length, 0) ?? 0
    expect(attempts).toBeGreaterThanOrEqual(3)

    // 3. Kayıt yarım olduğunu SÖYLÜYOR. `runs: 6` beyan edilen tekrar sayısı;
    //    okuyucu vaka başına 6 deneme sanmamalı.
    expect(run?.partial?.reason).toContain('interrupted')
    expect(run?.runs).toBe(6)
    expect(run?.cases[0]?.passRate.n).toBeLessThan(6)

    // 4. Oranlar hâlâ N ve aralıklarıyla (değişmez #4) — yarım kayıt daha az
    //    şey biliyor, yanlış bir şey söylemiyor.
    expect(run?.cases[0]?.passRate.ci).not.toBeNull()

    // 5. Pinler koşum başında yazıldığı için kurtarılan kayıtta da tam.
    expect(run?.pins.model).toBe('test-model-1')
    expect(run?.pins.suiteHash).toMatch(/^sha256:/)
    expect(run?.pins.environmentHash).toBe('sha256:env')
    expect(run?.permissionMode).toBe('acceptEdits')

    // 6. (0.3.1-b) Koşumun hiç ulaşmadığı negatif vaka ADIYLA kayıtta. 0.3.0'da
    //    ölçüldü: bu vaka ne `cases`'te ne `skipped`'da görünüyordu.
    expect(run?.cases.map((c) => c.caseId)).toEqual(['trigger.positive.explicit'])
    expect(run?.skipped).toEqual([
      {
        caseId: 'trigger.negative.near_neighbor.readme',
        reason: 'the run was interrupted before this case started',
        cause: 'interrupted',
      },
    ])

    // 7. (0.3.1-b) Ve kayıt `pass` vermiyor. Pozitif kontrol önce: ölçülen her
    //    deneme geçti — verdict'i düşüren bir `fail`/`unknown` deneme yok.
    expect(run?.cases.flatMap((c) => c.attempts).every((a) => a.verdict === 'pass')).toBe(true)
    expect(run?.verdict).toBe('unknown')

    // 8. (0.3.2) Kurtarılan kayıt, journal'ı yazan runner'ın sürümünü taşıyor.
    const version = (
      JSON.parse(await readFile(join(repoRoot, 'packages/runner/package.json'), 'utf8')) as {
        version: string
      }
    ).version
    expect(run?.assayVersion).toBe(version)
  }, 120_000)
})

// ---------------------------------------------------------------------------
// Journal'ın kendisi
// ---------------------------------------------------------------------------

describe('journal', () => {
  const header = {
    id: 'run-x',
    startedAt: '2026-09-08T10:00:00.000Z',
    host: 'mock',
    skill: 'widget',
    runs: 3,
    pins: {
      skillSource: 'local@abc',
      skillHash: 'sha256:s',
      model: 'm',
      systemPromptHash: 'not-provided-by-host',
      suiteVersion: 1,
      suiteHash: 'sha256:q',
    },
  }

  const attempt = (index: number, verdict: 'pass' | 'fail' | 'unknown' = 'pass') => ({
    caseId: 'trigger.positive.explicit',
    expectedTrigger: true,
    attempt: {
      index,
      caseId: 'trigger.positive.explicit',
      startedAt: '2026-09-08T10:00:01.000Z',
      finishedAt: '2026-09-08T10:00:02.000Z',
      trigger: { available: false as const, reason: 'mock' },
      assertions: [],
      verdict,
      reason: 'mock',
      latencyMs: 10,
    },
  })

  it('normal bitiste journal siliniyor', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'assay-journal-'))
    const journal = await RunJournal.open(dir, header)
    journal.append(attempt(0))
    expect(await findJournals(dir)).toHaveLength(1)
    await journal.finish()
    expect(await findJournals(dir)).toHaveLength(0)
  })

  it('ayni kimlikle ikinci bir journal acilamaz', async () => {
    // Üstüne yazmak, kurtarılacak veriyi yok etmek olurdu.
    const dir = await mkdtemp(join(tmpdir(), 'assay-journal-'))
    await RunJournal.open(dir, header)
    await expect(RunJournal.open(dir, header)).rejects.toThrow()
  })

  it('yarim yazilmis son satir atiliyor ve SAYILIYOR', async () => {
    // SIGKILL bir satırın ortasında gelebilir. Sessizce yutmak, kaç denemenin
    // kaybolduğunu gizlemek olurdu.
    const dir = await mkdtemp(join(tmpdir(), 'assay-journal-'))
    const journal = await RunJournal.open(dir, header)
    journal.append(attempt(0))
    journal.append(attempt(1))
    await appendFile(journal.path, '{"kind":"attempt","caseId":"trig')

    const contents = await readJournal(journal.path)
    expect(contents?.attempts).toHaveLength(2)
    expect(contents?.droppedLines).toBe(1)

    const recovered = await recoverJournal(journal.path)
    expect(recovered?.run.partial?.droppedLines).toBe(1)
  })

  it('kurtarilan kosum planlanan kapsami tasiyor ve butce kesmesiyle PASS vermiyor', async () => {
    // Başlık kapsamı taşımasaydı öldürülüp kurtarılan bir hızlı mod koşumu tam
    // ölçüm gibi okunur, bütçe kesmesi kaybolur ve verdict `pass`e dönerdi.
    const dir = await mkdtemp(join(tmpdir(), 'assay-journal-'))
    const journal = await RunJournal.open(dir, {
      ...header,
      id: 'run-scope',
      layers: ['trigger'],
      skipped: [
        { caseId: 'trigger.negative.x', reason: 'the attempt budget of 1 was reached', cause: 'budget' },
      ],
    })
    journal.append(attempt(0, 'pass'))

    const recovered = await recoverJournal(journal.path)
    expect(recovered?.run.layers).toEqual(['trigger'])
    expect(recovered?.run.skipped?.map((s) => s.cause)).toEqual(['budget'])
    // Pozitif kontrol: tek deneme geçti; düşüren kesme.
    expect(recovered?.run.cases[0]?.passed).toBe(1)
    expect(recovered?.run.verdict).toBe('unknown')
  })

  /*
   * 0.3.1-b — iki kural, ayrı ayrı sınanıyor: (a) yarım kayıt `pass` veremez,
   * (b) kurtarma ulaşamadığı vakaları adıyla yazar. İkisi aynı testte olsaydı
   * birini kaldıran mutasyon ötekinin arkasına saklanabilirdi.
   */
  it('yarim kayit, hicbir vakayi tamamen kacirmasa bile PASS vermez', async () => {
    // Plandaki tek vakaya ulaşılmış: `skipped` boş. Eksik olan denemeler —
    // kural bunu da kapsamalı, yalnızca atlanan vakayı değil.
    const dir = await mkdtemp(join(tmpdir(), 'assay-journal-'))
    const journal = await RunJournal.open(dir, {
      ...header,
      id: 'run-partial-only',
      planned: ['trigger.positive.explicit'],
    })
    journal.append(attempt(0, 'pass'))

    const recovered = await recoverJournal(journal.path)
    expect(recovered?.run.skipped).toBeUndefined()
    expect(recovered?.run.cases[0]?.passed).toBe(1)
    expect(recovered?.run.verdict).toBe('unknown')
  })

  it('olculmus bir fail yarim kayitta da fail kalir', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'assay-journal-'))
    const journal = await RunJournal.open(dir, { ...header, id: 'run-partial-fail' })
    journal.append(attempt(0, 'fail'))
    expect((await recoverJournal(journal.path))?.run.verdict).toBe('fail')
  })

  it('ulasilamayan vakalar plandan adiyla kayda giriyor, ulasilan girmiyor', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'assay-journal-'))
    const journal = await RunJournal.open(dir, {
      ...header,
      id: 'run-unreached',
      planned: ['trigger.positive.explicit', 'trigger.negative.a', 'trigger.negative.b'],
    })
    journal.append(attempt(0, 'pass'))

    const run = (await recoverJournal(journal.path))?.run
    expect(run?.skipped?.map((s) => [s.caseId, s.cause])).toEqual([
      ['trigger.negative.a', 'interrupted'],
      ['trigger.negative.b', 'interrupted'],
    ])
  })

  it('katman disi her atlama, yarim kayit kuralindan bagimsiz olarak da PASS i engeller', () => {
    // Kurtarma `interrupted`i hep `partial` ile birlikte koyuyor, yani bu kol
    // kurtarma yolundan gözlenemez — doğrudan sınanıyor. İleride eklenecek bir
    // sebep varsayılan olarak "ölçülmedi" sayılsın; yalnız `layer` beyan edilmiş
    // kapsam.
    const passed = [attempt(0, 'pass').attempt]
    const skip = (cause: 'layer' | 'budget' | 'interrupted') => [
      { caseId: 'c', reason: 'r', cause },
    ]
    expect(verdictOf(passed, skip('interrupted'))).toBe('unknown')
    expect(verdictOf(passed, skip('budget'))).toBe('unknown')
    // Pozitif kontrol: katman elemesi ve hiç atlama olmaması `pass`.
    expect(verdictOf(passed, skip('layer'))).toBe('pass')
    expect(verdictOf(passed)).toBe('pass')
  })

  it('kurtarilan kayit journal i YAZAN surumu tasiyor, kurtarani degil (0.3.2)', async () => {
    // Denemeler yazan sürümün kurallarıyla yargılandı. Kurtaran sürümü basmak,
    // kaydı hiç koşmadığı bir sürümün ürünü gibi gösterirdi.
    const dir = await mkdtemp(join(tmpdir(), 'assay-journal-'))
    const journal = await RunJournal.open(dir, {
      ...header,
      id: 'run-writer-version',
      assayVersion: '0.0.1-writer',
    })
    journal.append(attempt(0, 'pass'))
    expect((await recoverJournal(journal.path))?.run.assayVersion).toBe('0.0.1-writer')
  })

  it('surumsuz eski journal dan kurtarilan kayit da surumsuz kalir', async () => {
    // Tahmin yok: bilinmeyen sürüm bilinmeyen kalır, okuma tarafı etiketler.
    const dir = await mkdtemp(join(tmpdir(), 'assay-journal-'))
    const journal = await RunJournal.open(dir, { ...header, id: 'run-no-version' })
    journal.append(attempt(0, 'pass'))
    const run = (await recoverJournal(journal.path))?.run
    expect(run !== undefined && 'assayVersion' in run).toBe(false)
  })

  it('plansiz eski journal ulasilamayani adlandiramaz ama PASS da vermez', async () => {
    // 0.3.1 öncesi başlıklarda `planned` yok: dürüst cevap "bilmiyorum".
    const dir = await mkdtemp(join(tmpdir(), 'assay-journal-'))
    const journal = await RunJournal.open(dir, { ...header, id: 'run-old-header' })
    journal.append(attempt(0, 'pass'))
    const run = (await recoverJournal(journal.path))?.run
    expect(run?.skipped).toBeUndefined()
    expect(run?.verdict).toBe('unknown')
  })

  it('tanimadigi journal surumu sessizce yorumlanmaz', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'assay-journal-'))
    const path = join(dir, `run-y${JOURNAL_SUFFIX}`)
    await writeFile(path, `${JSON.stringify({ ...header, journalVersion: 99, kind: 'run' })}\n`)
    await expect(readJournal(path)).rejects.toThrow(/journal version 99/)
  })

  it('basliksiz journal kayda cevrilmez ve dosya yerinde birakilir', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'assay-journal-'))
    const path = join(dir, `run-z${JOURNAL_SUFFIX}`)
    await writeFile(path, `${JSON.stringify({ kind: 'attempt', caseId: 'c', attempt: {} })}\n`)
    expect(await recoverJournal(path)).toBeNull()
    expect(existsSync(path)).toBe(true)
  })

  it('denemesiz journal kayit uretmez', async () => {
    // Sıfır denemelik bir "koşum" ölçüm değil, gürültü.
    const dir = await mkdtemp(join(tmpdir(), 'assay-journal-'))
    const journal = await RunJournal.open(dir, header)
    expect(await recoverJournal(journal.path)).toBeNull()
  })

  it('kurtarilan kayit verdict i denemelerden aliyor', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'assay-journal-'))
    const journal = await RunJournal.open(dir, header)
    journal.append(attempt(0, 'pass'))
    journal.append(attempt(1, 'fail'))
    const recovered = await recoverJournal(journal.path)
    expect(recovered?.run.verdict).toBe('fail')
    expect(recovered?.run.cases[0]?.passRate.n).toBe(2)
  })

  it('kurtarilan kaydin bitis ani son tamamlanan denemenin bitisidir', async () => {
    // Kurtarma anını yazmak, ölçümün o ana kadar sürdüğü izlenimini verirdi.
    const dir = await mkdtemp(join(tmpdir(), 'assay-journal-'))
    const journal = await RunJournal.open(dir, header)
    journal.append(attempt(0))
    const recovered = await recoverJournal(journal.path)
    expect(recovered?.run.finishedAt).toBe('2026-09-08T10:00:02.000Z')
    expect(recovered?.run.partial?.recoveredAt).not.toBe(recovered?.run.finishedAt)
  })

  it('journal satirlari her deneme bittiginde diske gidiyor', async () => {
    // Asenkron bir yazımın kuyrukta beklerken kaybolması, engellenmek istenen
    // şeyin ta kendisi olurdu.
    const dir = await mkdtemp(join(tmpdir(), 'assay-journal-'))
    const journal = await RunJournal.open(dir, header)
    journal.append(attempt(0))
    const raw = await readFile(journal.path, 'utf8')
    expect(raw.split('\n').filter((l) => l.trim() !== '')).toHaveLength(2)
  })
})
