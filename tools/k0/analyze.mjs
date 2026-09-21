// K0 kapasite sonuçları: summary.json + samples.csv + konteynerlerin kayıtları.
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2] ?? 'cap-real'
const summary = JSON.parse(readFileSync(join(dir, 'summary.json'), 'utf8'))
const samples = readFileSync(join(dir, 'samples.csv'), 'utf8').trim().split('\n').slice(1).map((l) => {
  const [level, t, container, cpu, mem, pids] = l.split(',')
  return { level: +level, t: +t, container, cpu: +cpu, mem: +mem, pids: +pids }
})

const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0 }

for (const row of summary) {
  const own = samples.filter((s) => s.level === row.level)
  // Seviye toplamı: aynı zaman damgasındaki konteynerlerin toplamı.
  const byT = new Map()
  for (const s of own) {
    const k = s.t
    const v = byT.get(k) ?? { cpu: 0, mem: 0 }
    v.cpu += Number.isFinite(s.cpu) ? s.cpu : 0
    v.mem += s.mem
    byT.set(k, v)
  }
  const totals = [...byT.values()]
  console.log(`\n== P=${row.level}  wall ${row.wall_s}s`)
  console.log(`   total CPU  peak ${Math.round(Math.max(...totals.map((v) => v.cpu)))}%  p95 ${Math.round(pct(totals.map((v) => v.cpu), 0.95))}%  median ${Math.round(pct(totals.map((v) => v.cpu), 0.5))}%   (100% = 1 core)`)
  console.log(`   total MEM  peak ${Math.round(Math.max(...totals.map((v) => v.mem)))} MiB  p95 ${Math.round(pct(totals.map((v) => v.mem), 0.95))} MiB`)
  for (const c of row.containers) {
    const i = c.name.split('-').pop()
    const store = join(dir, 'stores', `p${row.level}-${i}`, 'runs', 'runs')
    const files = existsSync(store) ? readdirSync(store).filter((f) => f.endsWith('.json')) : []
    const attempts = []
    let memory = 'no record'
    for (const f of files) {
      const r = JSON.parse(readFileSync(join(store, f), 'utf8'))
      const run = r.run ?? r
      memory = JSON.stringify(run.environment?.memory ?? 'not measured')
      for (const cs of run.cases) for (const a of cs.attempts) attempts.push(`${cs.caseId.split('.').pop()}:${a.verdict}:${Math.round((a.latencyMs ?? 0) / 1000)}s:$${(a.cost?.usd ?? 0).toFixed(3)}`)
    }
    console.log(`   ${c.name}  peak CPU ${c.peak_cpu_pct}%  peak MEM ${c.peak_mem_mib} MiB  pids ${c.peak_pids}  disk ${c.disk}  memory=${memory}`)
    console.log(`      ${attempts.join('  ')}`)
  }
}
