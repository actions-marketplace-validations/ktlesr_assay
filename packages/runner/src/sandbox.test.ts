import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TraceEvent } from '@ktlsr/assay-core'
import { describe, expect, it } from 'vitest'
import {
  capture,
  captureFiles,
  createWorkspace,
  destroyWorkspace,
  envDiff,
  resolveFixtures,
  snapshot,
} from './sandbox.js'

describe('resolveFixtures', () => {
  it('suite yalın dosya adıyla verilince de dizinini doğru bulur (K0 kusuru)', () => {
    expect(resolveFixtures('../fixtures/app', 'x.suite.yaml')).toBe(join('..', 'fixtures', 'app'))
  })

  it('suite dizinine göre çözer; mutlak yolu ve suite\'siz yolu olduğu gibi bırakır', () => {
    expect(resolveFixtures('./fixtures/app', join('suites', 'x.suite.yaml'))).toBe(
      join('suites', 'fixtures', 'app'),
    )
    expect(resolveFixtures('/assay/fixtures', join('suites', 'x.suite.yaml'))).toBe('/assay/fixtures')
    expect(resolveFixtures('fixtures/app')).toBe('fixtures/app')
    expect(resolveFixtures(undefined, 'x.suite.yaml')).toBeUndefined()
  })
})

const scratch = () => mkdtemp(join(tmpdir(), 'assay-sbtest-'))

describe('createWorkspace', () => {
  it('boş, izole bir dizin verir', async () => {
    const workspace = await createWorkspace({})
    expect(workspace.before.size).toBe(0)
    await destroyWorkspace(workspace)
  })

  it('iki çağrı farklı dizinler verir', async () => {
    const a = await createWorkspace({})
    const b = await createWorkspace({})
    expect(a.dir).not.toBe(b.dir)
    await destroyWorkspace(a)
    await destroyWorkspace(b)
  })

  it('fixture dizinini kopyalar ve anlık görüntüye alır', async () => {
    const fixtures = await scratch()
    await writeFile(join(fixtures, 'draft.md'), '# hello\n', 'utf8')
    await mkdir(join(fixtures, 'nested'), { recursive: true })
    await writeFile(join(fixtures, 'nested', 'a.txt'), 'x', 'utf8')

    const workspace = await createWorkspace({ fixtures })
    expect([...workspace.before.keys()].sort()).toEqual(['draft.md', 'nested/a.txt'])
    await destroyWorkspace(workspace)
    await rm(fixtures, { recursive: true, force: true })
  })

  it('olmayan fixture yolu sessizce yutulmaz', async () => {
    await expect(
      createWorkspace({ fixtures: join(tmpdir(), 'yok-boyle-bir-yol') }),
    ).rejects.toThrow('does not exist')
  })

  it('destroyWorkspace dizini siler', async () => {
    const workspace = await createWorkspace({})
    await writeFile(join(workspace.dir, 'a.txt'), 'x', 'utf8')
    await destroyWorkspace(workspace)
    expect((await snapshot(workspace.dir)).size).toBe(0)
  })
})

describe('snapshot', () => {
  it('içerik değişince hash değişir', async () => {
    const dir = await scratch()
    await writeFile(join(dir, 'a.txt'), 'one', 'utf8')
    const first = await snapshot(dir)
    await writeFile(join(dir, 'a.txt'), 'two', 'utf8')
    const second = await snapshot(dir)
    expect(second.get('a.txt')).not.toBe(first.get('a.txt'))
  })

  it('yollar POSIX ayırıcısıyla normalize edilir', async () => {
    const dir = await scratch()
    await mkdir(join(dir, 'out'), { recursive: true })
    await writeFile(join(dir, 'out', 'r.docx'), 'x', 'utf8')
    expect([...(await snapshot(dir)).keys()]).toEqual(['out/r.docx'])
  })

  it('olmayan dizin boş görüntü verir, patlamaz', async () => {
    expect((await snapshot(join(tmpdir(), 'yok-123'))).size).toBe(0)
  })
})

describe('captureFiles', () => {
  it('dosyaları bayt olarak yakalar — assertion motorunun kanıtı', async () => {
    const dir = await scratch()
    await mkdir(join(dir, 'out'), { recursive: true })
    await writeFile(join(dir, 'out', 'a.json'), '{"ok":true}', 'utf8')
    const files = await captureFiles(dir)
    expect(files).toHaveLength(1)
    expect(files[0]?.path).toBe('out/a.json')
    expect(new TextDecoder().decode(files[0]?.bytes)).toBe('{"ok":true}')
  })
})

describe('envDiff — dosya sistemi', () => {
  const empty = new Map<string, string>()

  it('yeni dosya yazım sayılır', () => {
    const diff = envDiff({
      workdir: '/w',
      before: empty,
      after: new Map([['out/a.docx', 'h1']]),
      trace: undefined,
    })
    expect(diff.writes).toEqual(['out/a.docx'])
    expect(diff.deletes).toEqual([])
  })

  it('içeriği değişen dosya yazım sayılır', () => {
    const diff = envDiff({
      workdir: '/w',
      before: new Map([['a.txt', 'h1']]),
      after: new Map([['a.txt', 'h2']]),
      trace: undefined,
    })
    expect(diff.writes).toEqual(['a.txt'])
  })

  it('değişmeyen dosya yazım sayılmaz', () => {
    const same = new Map([['a.txt', 'h1']])
    expect(
      envDiff({ workdir: '/w', before: same, after: same, trace: undefined }).writes,
    ).toEqual([])
  })

  it('kaybolan dosya silme sayılır', () => {
    const diff = envDiff({
      workdir: '/w',
      before: new Map([['a.txt', 'h1']]),
      after: empty,
      trace: undefined,
    })
    expect(diff.deletes).toEqual(['a.txt'])
  })
})

describe('envDiff — izden gelen yazımlar', () => {
  const write = (path: string): TraceEvent => ({
    seq: 1,
    kind: 'tool_call',
    tool: 'Write',
    args: { file_path: path },
  })
  const empty = new Map<string, string>()

  it('çalışma dizini dışına yazım izden yakalanır', () => {
    // Anlık görüntü farkı bunu göremez; sandbox'ın tek gözü iz.
    const diff = envDiff({
      workdir: '/w',
      before: empty,
      after: empty,
      trace: [write('/etc/passwd')],
    })
    expect(diff.writes).toEqual(['/etc/passwd'])
  })

  it('çalışma dizini içindeki mutlak yol göreliye çevrilir', () => {
    const diff = envDiff({
      workdir: '/w',
      before: empty,
      after: empty,
      trace: [write('/w/out/a.docx')],
    })
    expect(diff.writes).toEqual(['out/a.docx'])
  })

  it('yazmayan araçlar yazım üretmez', () => {
    const diff = envDiff({
      workdir: '/w',
      before: empty,
      after: empty,
      trace: [
        { seq: 1, kind: 'tool_call', tool: 'Read', args: { file_path: '/etc/hosts' } },
      ],
    })
    expect(diff.writes).toEqual([])
  })
})

describe('envDiff — reddedilen çağrılar yan etki sayılmaz', () => {
  const empty = new Map<string, string>()

  it('izin reddedilen Write yazım üretmez', () => {
    // Canlı koşumda görüldü: ajan sandbox dışına yazmayı denedi, host reddetti.
    // Denenmiş ama gerçekleşmemiş bir yazımı kaydetmek yalan olurdu.
    const diff = envDiff({
      workdir: '/w',
      before: empty,
      after: empty,
      trace: [
        {
          seq: 1,
          kind: 'tool_call',
          tool: 'Write',
          id: 't1',
          args: { file_path: '/etc/x' },
        },
        {
          seq: 2,
          kind: 'tool_result',
          tool: 'Write',
          callId: 't1',
          isError: true,
          error: 'denied',
        },
      ],
    })
    expect(diff.writes).toEqual([])
  })

  it('başarılı Write yazım üretir', () => {
    const diff = envDiff({
      workdir: '/w',
      before: empty,
      after: empty,
      trace: [
        {
          seq: 1,
          kind: 'tool_call',
          tool: 'Write',
          id: 't1',
          args: { file_path: 'out/a.json' },
        },
        { seq: 2, kind: 'tool_result', tool: 'Write', callId: 't1' },
      ],
    })
    expect(diff.writes).toEqual(['out/a.json'])
  })

  it('reddedilen ağ çağrısı blocked işaretlenir', () => {
    const diff = envDiff({
      workdir: '/w',
      before: empty,
      after: empty,
      trace: [
        {
          seq: 1,
          kind: 'tool_call',
          tool: 'WebFetch',
          id: 'n1',
          args: { url: 'https://x.test/a' },
        },
        {
          seq: 2,
          kind: 'tool_result',
          tool: 'WebFetch',
          callId: 'n1',
          isError: true,
          error: 'denied',
        },
      ],
    })
    expect(diff.network).toEqual([{ host: 'x.test', blocked: true }])
  })

  it('sonucu bilinmeyen çağrı gerçekleşmiş sayılır — sessizce yok sayılmaz', () => {
    const diff = envDiff({
      workdir: '/w',
      before: empty,
      after: empty,
      trace: [
        {
          seq: 1,
          kind: 'tool_call',
          tool: 'Write',
          id: 't1',
          args: { file_path: 'out/a.json' },
        },
      ],
    })
    expect(diff.writes).toEqual(['out/a.json'])
  })
})

describe('envDiff — ağ', () => {
  const empty = new Map<string, string>()
  const fetch = (url: string): TraceEvent => ({
    seq: 1,
    kind: 'tool_call',
    tool: 'WebFetch',
    args: { url },
  })

  it('ağ çağrısı host adıyla kaydedilir', () => {
    const diff = envDiff({
      workdir: '/w',
      before: empty,
      after: empty,
      trace: [fetch('https://api.example.com/x')],
    })
    expect(diff.network).toEqual([{ host: 'api.example.com', blocked: false }])
  })

  it('host tarafından reddedilen araç blocked işaretlenir', () => {
    const diff = envDiff({
      workdir: '/w',
      before: empty,
      after: empty,
      trace: [fetch('https://api.example.com/x')],
      deniedTools: ['WebFetch'],
    })
    expect(diff.network[0]?.blocked).toBe(true)
  })

  it('bozuk URL ham hâliyle kaydedilir, çağrı kaybolmaz', () => {
    const diff = envDiff({
      workdir: '/w',
      before: empty,
      after: empty,
      trace: [fetch('not a url')],
    })
    expect(diff.network).toEqual([{ host: 'not a url', blocked: false }])
  })

  it('iz yoksa ağ listesi boş — "ağa çıkılmadı" iddiası değil', () => {
    const diff = envDiff({ workdir: '/w', before: empty, after: empty, trace: undefined })
    expect(diff.network).toEqual([])
  })
})

describe('capture — kaynak tüketimi sınırı', () => {
  it('sınırı aşan dosya atlanır ve adı kaydedilir, sessizce yok sayılmaz', async () => {
    const dir = await scratch()
    await writeFile(join(dir, 'big.bin'), 'x'.repeat(2048), 'utf8')
    await writeFile(join(dir, 'small.txt'), 'ok', 'utf8')

    const result = await capture(dir, { perFileBytes: 100, totalBytes: 1_000_000 })
    expect(result.files.map((f) => f.path)).toEqual(['small.txt'])
    expect(result.skipped).toEqual(['big.bin'])
  })

  it('toplam sınır aşılınca kalan dosyalar atlanır', async () => {
    const dir = await scratch()
    await writeFile(join(dir, 'a.txt'), 'x'.repeat(600), 'utf8')
    await writeFile(join(dir, 'b.txt'), 'y'.repeat(600), 'utf8')

    const result = await capture(dir, { perFileBytes: 10_000, totalBytes: 1000 })
    expect(result.files).toHaveLength(1)
    expect(result.skipped).toHaveLength(1)
  })

  it('sınır içinde her şey yakalanır', async () => {
    const dir = await scratch()
    await writeFile(join(dir, 'a.txt'), 'ok', 'utf8')
    const result = await capture(dir)
    expect(result.skipped).toEqual([])
    expect(result.files).toHaveLength(1)
  })
})

describe('envDiff — gözlenemeyen yan etki yüzeyi', () => {
  const empty = new Map<string, string>()

  it('kabuk çağrısı unobserved listesine girer', () => {
    const diff = envDiff({
      workdir: '/w',
      before: empty,
      after: empty,
      trace: [{ seq: 1, kind: 'tool_call', tool: 'Bash', args: { command: 'curl x' } }],
    })
    expect(diff.unobserved).toEqual(['Bash'])
  })

  it('reddedilen kabuk çağrısı gözlenemeyen sayılmaz — çalışmadı', () => {
    const diff = envDiff({
      workdir: '/w',
      before: empty,
      after: empty,
      trace: [
        { seq: 1, kind: 'tool_call', tool: 'Bash', id: 'b1', args: { command: 'x' } },
        {
          seq: 2,
          kind: 'tool_result',
          tool: 'Bash',
          callId: 'b1',
          isError: true,
          error: 'denied',
        },
      ],
    })
    expect(diff.unobserved).toEqual([])
  })

  it('kabuk çağrısı yoksa liste boş', () => {
    const diff = envDiff({
      workdir: '/w',
      before: empty,
      after: empty,
      trace: [{ seq: 1, kind: 'tool_call', tool: 'Write', args: { file_path: 'a' } }],
    })
    expect(diff.unobserved).toEqual([])
  })
})
