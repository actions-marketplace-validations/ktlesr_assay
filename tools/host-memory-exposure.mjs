/**
 * Geçmiş koşum kayıtları host talimat dosyası sızıntısına maruz kaldı mı (0.4.5)?
 *
 * Her kayıt için iki ayrı soru:
 *  1. **Maruziyet** — çalışma dizini ev dizininin altında mıydı? Öyleyse host
 *     `~/.claude/CLAUDE.md`'yi (ve üst dizinlerdeki diğer talimat dosyalarını)
 *     her denemede yüklüyordu. Kayıtlardaki yollardan okunur (`assay-work-`
 *     dizininin önü). Kayıt `environment.memory` taşıyorsa (0.4.5+) ölçülmüş
 *     değer ondan okunur.
 *  2. **Görünür iz** — işaret metinleri modelin ürettiği metinde ya da araç
 *     argümanlarında kaç denemede geçiyor. Bu bir alt sınır: dosya bağlama
 *     girip hiçbir iz bırakmamış olabilir. İzin olmaması etkinin olmadığını
 *     kanıtlamaz.
 *
 * Kullanım: node tools/host-memory-exposure.mjs <runs dizini[,dizin...]> <işaret> [...] [--json <çıktı>]
 * Örnek:   node tools/host-memory-exposure.mjs ../assay-example/.assay/runs,.assay/runs graphify \
 *            --json apps/web/lib/host-memory-exposure.json
 *
 * `--json`: hosted künyedeki notun verisi (maruz kalmış kayıtlar, deneme ve iz
 * sayılarıyla). Sayı elle yazılmıyor, bu komutla üretiliyor.
 *
 * İşaret ayırt edici olmalı: "knowledge graph" gibi alanın kendi terimi olan
 * bir ifade ilgisiz vakalarda da geçer (ai-seo'da geçti) ve yanlış iz sayılır.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const jsonAt = args.indexOf('--json')
const jsonOut = jsonAt === -1 ? undefined : args.splice(jsonAt, 2)[1]
const [dirs, ...markers] = args
if (dirs === undefined || markers.length === 0) {
  console.error('kullanım: node tools/host-memory-exposure.mjs <runs dizini[,dizin...]> <işaret> [...] [--json <çıktı>]')
  process.exit(2)
}

const lower = markers.map((m) => m.toLowerCase())
const rows = []
const files = dirs
  .split(',')
  .flatMap((dir) => readdirSync(dir).filter((f) => /^run-.*\.json$/.test(f)).map((f) => join(dir, f)))
  .sort()
for (const path of files) {
  const raw = readFileSync(path, 'utf8')
  const record = JSON.parse(raw)
  const run = record.run ?? record
  const attempts = run.cases.flatMap((c) => c.attempts.map((a) => ({ caseId: c.caseId, a })))

  // Geçici dizinin yeri: kayıttaki `…\assay-work-XXXX`, `assay-skill-XXXX` ya da
  // `assay-cc-XXXX` yollarının önü. 0.4.5 öncesinde üçü de aynı geçici dizinde
  // açılıyordu; çalışma dizini nadiren yazılıyor, skill kopyası ("Base directory
  // for this skill") skill tetiklendiğinde yazılıyor.
  const roots = new Set()
  for (const m of raw.matchAll(/([A-Za-z]:(?:\\\\|\\|\/)[^"\s]*?)(?:\\\\|\\|\/)assay-(?:work|skill|cc)-[A-Za-z0-9]+/g)) {
    roots.add(m[1].replace(/\\\\/g, '\\'))
  }
  const underHome = [...roots].some((r) => /^[A-Za-z]:[\\/]Users[\\/]|^\/(home|Users)\//i.test(r))

  let seen = 0
  const cases = new Set()
  for (const { caseId, a } of attempts) {
    const text = JSON.stringify(a).toLowerCase()
    if (lower.some((m) => text.includes(m))) {
      seen += 1
      cases.add(caseId)
    }
  }
  rows.push({
    runId: run.id,
    id: run.id.slice(-8),
    date: run.startedAt.slice(0, 10),
    skill: run.skill ?? run.pins?.skillSource ?? '?',
    assay: run.assayVersion ?? '≤0.3.1',
    attempts: attempts.length,
    workdir: roots.size === 0 ? '(no path in record)' : [...roots].join(' | '),
    exposed:
      run.environment?.memory !== undefined
        ? run.environment.memory.some((e) => !/^\S+ \.\//.test(e)) ? 'measured: yes' : 'measured: no'
        : underHome ? 'yes (workdir under home)' : roots.size === 0 ? 'unknown' : 'no',
    seen,
    cases: [...cases].sort(),
  })
}

console.log(`markers: ${markers.map((m) => JSON.stringify(m)).join(', ')}`)
console.log('record    date        skill                                  assay   attempts  exposed                    attempts with a trace')
for (const r of rows) {
  console.log(
    `${r.id}  ${r.date}  ${r.skill.padEnd(38).slice(0, 38)} ${String(r.assay).padEnd(7)} ${String(r.attempts).padStart(8)}  ${r.exposed.padEnd(26)} ${r.seen}${r.seen > 0 ? ` (${r.cases.join(', ')})` : ''}`,
  )
}
const exposed = rows.filter((r) => r.exposed.startsWith('yes') || r.exposed === 'measured: yes')
console.log(`\n${rows.length} records · ${exposed.length} exposed · ${rows.filter((r) => r.seen > 0).length} with a visible trace`)
const unknown = rows.filter((r) => r.exposed === 'unknown')
if (unknown.length > 0) console.log(`no working-directory path recorded (exposure unknown): ${unknown.map((r) => r.id).join(', ')}`)

if (jsonOut !== undefined) {
  // Yalnızca yolu ev altında görünen (maruz kalmış) kayıtlar: künyede not
  // bunlara düşüyor. Maruziyeti kayıttan okunamayanlar nota girmez.
  const runs = Object.fromEntries(
    rows
      .filter((r) => r.exposed.startsWith('yes'))
      .sort((a, b) => (a.runId < b.runId ? -1 : 1))
      .map((r) => [r.runId, { attempts: r.attempts, traces: r.seen }]),
  )
  writeFileSync(jsonOut, `${JSON.stringify({ marker: markers.join(', '), runs }, null, 2)}\n`)
  console.log(`wrote ${Object.keys(runs).length} exposed records to ${jsonOut}`)
}
