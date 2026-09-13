// K0 kapasite ölçümü: 1, 2 ve 4 paralel deneme konteyneri; CPU, bellek, pid ve disk.
//
// Her konteyner yayımlanmış @ktlsr/assay 0.4.5 ile iki vakalık suite'i koşar
// (ağır: hero_direction, hafif: slow_query), --repeat 1, bypassPermissions (en kötü
// durum). docker stats 2 sn'de bir örneklenir; konteyner bitince yazılabilir katmanın
// boyutu (`docker ps -s`) okunur, sonra silinir. Kayıtlar /out'a yazılır, YÜKLENMEZ.
//
// Kullanım: node capacity.mjs <mode: fake|real> <seviyeler, ör. 1,2,4>
//   fake: iç ağ + sahte model (ücretsiz; düzeneğin kendisini sınar)
//   real: varsayılan köprü ağı (npm/Playwright için internet) + OAUTH_ENV_FILE'daki
//         abonelik token'ı. Token yalnızca --env-file ile konteynere gider, yazdırılmaz.
import { setTimeout } from 'node:timers'
import { spawn, execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'

const [mode = 'fake', levelsArg = '1,2,4'] = process.argv.slice(2)
const levels = levelsArg.split(',').map(Number)
const here = process.cwd().split('\\').join('/')
const measurements = 'D:/assay-example'
const out = `${here}/cap-${mode}`
mkdirSync(`${out}/stores`, { recursive: true })
const samples = `${out}/samples.csv`
writeFileSync(samples, 'level,t_s,container,cpu_pct,mem_mib,pids\n')

const docker = (args) => execFileSync('docker', args, { encoding: 'utf8', env: { ...process.env, MSYS_NO_PATHCONV: '1' } })
const mib = (s) => {
  const m = /([\d.]+)\s*([KMG]i?B)/.exec(s)
  if (!m) return 0
  const v = Number(m[1])
  return m[2].startsWith('G') ? v * 1024 : m[2].startsWith('K') ? v / 1024 : v
}

const inner = [
  'set -e',
  'mkdir -p /tmp/m/suites /tmp/m/fixtures /tmp/m/skills',
  'cp -r /m/fixtures/impeccable-app /tmp/m/fixtures/',
  'cp -r /m/skills/impeccable /tmp/m/skills/',
  'cp /k0/k0-capacity.suite.yaml /tmp/m/suites/',
  'cd /tmp/m/suites',
  'start=$(date +%s)',
  'assay run /tmp/m/suites/k0-capacity.suite.yaml --skill /tmp/m/skills/impeccable --repeat 1 --permission-mode bypassPermissions --allow-bypass-permissions --store /out/runs > /out/run.log 2>&1 || true',
  'echo "wall_s=$(( $(date +%s) - start ))" >> /out/run.log',
].join(' && ')

const summary = []
for (const level of levels) {
  const names = []
  const started = Date.now()
  const procs = []
  for (let i = 0; i < level; i += 1) {
    const name = `k0cap-${mode}-p${level}-${i}`
    names.push(name)
    const store = `${out}/stores/p${level}-${i}`
    mkdirSync(store, { recursive: true })
    try { docker(['rm', '-f', name]) } catch { /* yoksa zaten yok */ }
    const net = mode === 'fake'
      ? ['--network', 'k0int', '-e', 'ANTHROPIC_BASE_URL=http://k0srv:8080', '-e', 'ANTHROPIC_API_KEY=sk-fake-in-container']
      : ['--env-file', process.env.OAUTH_ENV_FILE]
    const args = ['run', '--name', name, ...net,
      '-e', 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1',
      '-v', `${measurements}:/m:ro`, '-v', `${here}:/k0:ro`, '-v', `${store}:/out`,
      'assay-k0:attempt', 'sh', '-c', inner]
    procs.push(new Promise((ok) => spawn('docker', args, { stdio: 'ignore', env: { ...process.env, MSYS_NO_PATHCONV: '1' } }).on('close', ok)))
  }
  const peak = Object.fromEntries(names.map((n) => [n, { cpu: 0, mem: 0, pids: 0 }]))
  let totalPeak = { cpu: 0, mem: 0 }
  let done = false
  const sampler = (async () => {
    while (!done) {
      let text = ''
      try { text = docker(['stats', '--no-stream', '--format', '{{.Name}},{{.CPUPerc}},{{.MemUsage}},{{.PIDs}}', ...names]) } catch { /* yoksa zaten yok */ }
      const t = ((Date.now() - started) / 1000).toFixed(0)
      let cpuSum = 0, memSum = 0
      for (const line of text.trim().split('\n').filter(Boolean)) {
        const [name, cpu, memUsage, pids] = line.split(',')
        if (!peak[name]) continue
        const c = Number.parseFloat(cpu), m = mib(memUsage.split('/')[0]), p = Number(pids)
        if (Number.isFinite(c)) { peak[name].cpu = Math.max(peak[name].cpu, c); cpuSum += c }
        peak[name].mem = Math.max(peak[name].mem, m); memSum += m
        peak[name].pids = Math.max(peak[name].pids, p || 0)
        appendFileSync(samples, `${level},${t},${name},${c},${m.toFixed(0)},${p}\n`)
      }
      totalPeak = { cpu: Math.max(totalPeak.cpu, cpuSum), mem: Math.max(totalPeak.mem, memSum) }
      await new Promise((r) => setTimeout(r, 2000))
    }
  })()
  await Promise.all(procs)
  done = true
  await sampler
  const sizes = {}
  for (const n of names) {
    try { sizes[n] = docker(['ps', '-a', '-s', '--filter', `name=^${n}$`, '--format', '{{.Size}}']).trim() } catch { /* yoksa zaten yok */ }
    try { docker(['rm', '-f', n]) } catch { /* yoksa zaten yok */ }
  }
  const wall = ((Date.now() - started) / 1000).toFixed(0)
  const row = { level, wall_s: Number(wall), total_peak_cpu_pct: Math.round(totalPeak.cpu), total_peak_mem_mib: Math.round(totalPeak.mem), containers: names.map((n) => ({ name: n, peak_cpu_pct: Math.round(peak[n].cpu), peak_mem_mib: Math.round(peak[n].mem), peak_pids: peak[n].pids, disk: sizes[n] })) }
  summary.push(row)
  console.log(JSON.stringify(row))
}
writeFileSync(`${out}/summary.json`, JSON.stringify(summary, null, 2))
