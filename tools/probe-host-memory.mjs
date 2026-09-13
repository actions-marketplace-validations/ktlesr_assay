/**
 * Talimat dosyası sızıntısı — gerçek host'la, ücretsiz uçtan uca sonda (0.4.5).
 *
 * Gerçek `ClaudeCodeAdapter` gerçek `claude` ikilisini koşturur; ama kimlik
 * bilgisi sahte bir API anahtarıdır ve `ANTHROPIC_BASE_URL` yerel bir
 * yakalayıcıya çevrilir. İstek Anthropic'e hiç gitmez ve para harcanmaz; host
 * yine de sistem istemini kurar, talimat dosyalarını yükler ve isteği gönderir.
 * Yakalayıcı isteğin gövdesini okur.
 *
 * İki şeyi ayrı ayrı söyler:
 *  - host'un gönderdiği istekte işaret metni geçiyor mu (gerçek bağlam),
 *  - kayda ne yazıldı (`environment.memory`, host'un InstructionsLoaded raporu).
 * İkisi uyuşmazsa ölçüm yanlış demektir.
 *
 * Kullanım:
 *   node tools/probe-host-memory.mjs [--marker <metin>] [--workdir-root <dizin>]
 *
 * `--marker`: ev dizinindeki talimat dosyasında geçen, istekte aranacak metin.
 * Verilmezse `~/.claude/CLAUDE.md`'nin ilk başlık satırından türetilir.
 * `--workdir-root`: çalışma dizinini bilerek başka bir kökte aç (ör. `%TEMP%`,
 * eski davranış) — kesimin tek başına tutup tutmadığını görmek için.
 *
 * Önce `npx tsc -b` (derlenmiş çıktıdan içe aktarır).
 */
import { createServer } from 'node:http'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { ClaudeCodeAdapter } from '../packages/adapters/dist/index.js'
import { createWorkspace, destroyWorkspace } from '../packages/runner/dist/index.js'

const arg = (name) => {
  const at = process.argv.indexOf(name)
  return at === -1 ? undefined : process.argv[at + 1]
}

const homeMemory = join(homedir(), '.claude', 'CLAUDE.md')
const marker =
  arg('--marker') ??
  (existsSync(homeMemory)
    ? (readFileSync(homeMemory, 'utf8').split(/\r?\n/).find((l) => l.trim() !== '') ?? '').replace(/^#+\s*/, '').trim()
    : '')
if (marker === '') {
  console.error('işaret yok: --marker ver ya da ~/.claude/CLAUDE.md oluştur')
  process.exit(2)
}

const bodies = []
const server = createServer((req, res) => {
  let body = ''
  req.on('data', (chunk) => (body += chunk))
  req.on('end', () => {
    bodies.push(body)
    res.writeHead(400, { 'content-type': 'application/json' })
    res.end('{"type":"error","error":{"type":"invalid_request_error","message":"assay host-memory probe"}}')
  })
})
await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
process.env['ANTHROPIC_BASE_URL'] = `http://127.0.0.1:${server.address().port}`

const root = arg('--workdir-root')
const workspace = root === undefined ? await createWorkspace({}) : { dir: mkdtempSync(join(resolve(root), 'assay-work-')) }
const adapter = new ClaudeCodeAdapter({ credentials: { apiKey: 'sk-ant-assay-probe-not-a-key' } })
try {
  const session = await adapter.start({
    caseId: 'probe.host_memory',
    attempt: 0,
    prompt: 'say ok',
    skill: { name: 'widget-manifest', source: 'local', path: resolve('examples/widget-manifest/skills/widget-manifest') },
    model: 'claude-haiku-4-5-20251001',
    activeSkills: ['widget-manifest'],
    workdir: workspace.dir,
    timeoutMs: 60_000,
  })
  const result = await adapter.finalize(session)
  const sent = bodies.join(' ')
  const hits = sent.split(marker).length - 1
  console.log(`workdir            ${workspace.dir}`)
  console.log(`marker             ${JSON.stringify(marker)}`)
  console.log(`requests captured  ${bodies.length}`)
  console.log(`marker in request  ${hits}`)
  console.log(`recorded memory    ${result.environment?.memory === undefined ? 'not measured' : JSON.stringify(result.environment.memory)}`)
  process.exitCode = bodies.length === 0 ? 3 : hits > 0 ? 1 : 0
} finally {
  server.close()
  if (root === undefined) await destroyWorkspace(workspace)
}
