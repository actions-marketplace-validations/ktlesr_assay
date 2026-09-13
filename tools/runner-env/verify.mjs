// K1 doğrulaması — ücretsiz, model çağrısı yok (docs/runner-environment.md, "K1 sonuçları").
//
//   docker build -t assay-egress --target egress tools/runner-env
//   docker build -t assay-attempt tools/runner-env
//   node tools/runner-env/verify.mjs
//
// Düzenek: `internal: true` bir ağ; komşuları çıkış proxy'si (dışa da bağlı) ve
// K0'ın sahte Anthropic API'si. Deneme konteyneri yalnızca iç ağda, HTTPS_PROXY ile.
// Beklenmeyen her sonuç çıkış kodu 1.
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ALLOW } from './egress.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const k0 = join(here, '..', 'k0')
const NET = 'assay-k1-int'
const docker = (...args) =>
  spawnSync('docker', args, { encoding: 'utf8', env: { ...process.env, MSYS_NO_PATHCONV: '1' } })
const inAttempt = (cmd, env = []) =>
  docker('run', '--rm', '--network', NET, '-e', 'HTTPS_PROXY=http://assay-k1-egress:3128', ...env, 'assay-attempt', 'sh', '-c', cmd)

// Fixture'ın (impeccable-app) bağımlılıkları: vite esbuild ve rollup'ın platform
// paketlerini de çekiyor, yani gerçek bir `npm install`in bütün adresleri.
const PKG = '{"private":true,"dependencies":{"react":"19.0.0","react-dom":"19.0.0","react-router":"7.1.1","vite":"6.0.7"}}'
const LAUNCH = "const{chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage();await p.setContent('<title>k1-chromium</title>');console.log(await p.title());await b.close()})()"
const SUITE = [
  'version: 1',
  'target: { skill: probe, source: k1 }',
  'environment: { host: claude-code, model: claude-haiku-4-5-20251001, system_prompt_hash: not-provided-by-host, active_skills: [probe] }',
  'runs: 2',
  'cases:',
  '  - { id: trigger.positive.hello, prompt: hello, expect: { triggered: true } }',
  '  - { id: trigger.negative.unrelated.weather, prompt: weather, expect: { triggered: false } }',
].join('\n')
const SUMMARY = "const fs=require('fs'),d='/tmp/s/store/runs',f=fs.readdirSync(d).find(n=>n.endsWith('.json')),r=JSON.parse(fs.readFileSync(d+'/'+f,'utf8')),run=r.run??r;console.log(JSON.stringify({memory:run.environment?.memory??'not measured',verdicts:run.cases.flatMap(c=>c.attempts.map(a=>a.verdict))}))"

const checks = [
  ['external names do not resolve (no DNS channel)', 'getent hosts example.com', (r) => r.status !== 0],
  ['no route out without the proxy', "curl --noproxy '*' -m 8 -sS https://registry.npmjs.org/-/ping", (r) => r.status !== 0],
  ['no route out to a bare IP', "curl --noproxy '*' -m 8 -sSk https://1.1.1.1", (r) => r.status !== 0],
  ['npm registry through the proxy', "curl -m 20 -sS -o /dev/null -w '%{http_code}' https://registry.npmjs.org/-/ping", (r) => r.stdout === '200'],
  ['Playwright CDN through the proxy', "curl -m 20 -sS -o /dev/null -w '%{http_code}' https://cdn.playwright.dev/", (r) => r.status === 0],
  ['other hosts refused by the proxy', 'curl -m 20 -sS https://example.com', (r) => r.status === 56 && /403/.test(r.stderr)],
  ['api.anthropic.com refused (credentials go via the credential proxy)', 'curl -m 20 -sS https://api.anthropic.com/', (r) => r.status === 56 && /403/.test(r.stderr)],
  [
    'npm install (vite, react) and Chromium launch from the image',
    `cd /work && printf '%s' '${PKG}' > package.json && npm install --no-audit --no-fund --loglevel=error && npm install --no-save --no-audit --no-fund --loglevel=error playwright@1.63.0 && node -e "${LAUNCH}"`,
    (r) => r.status === 0 && r.stdout.includes('k1-chromium'),
  ],
  [
    'assay run completes behind the proxy; host memory measured clean',
    `mkdir -p /tmp/s/skill && printf -- '---\\nname: probe\\ndescription: k1 probe skill\\n---\\nReply ok.\\n' > /tmp/s/skill/SKILL.md && printf '%s\\n' '${SUITE}' > /tmp/s/k1.suite.yaml && cd /tmp/s && assay run k1.suite.yaml --skill /tmp/s/skill --repeat 1 --store /tmp/s/store >/dev/null 2>&1; node -e "${SUMMARY}"`,
    (r) => {
      const s = JSON.parse(r.stdout.trim().split('\n').at(-1) ?? '{}')
      return Array.isArray(s.memory) && s.memory.length === 0 && s.verdicts.length === 2 && !s.verdicts.includes('unknown')
    },
    // NO_PROXY şart: Claude Code http:// base URL'yi de HTTPS_PROXY'ye gönderiyor (ölçüldü).
    ['-e', 'ANTHROPIC_BASE_URL=http://assay-k1-api:8080', '-e', 'ANTHROPIC_API_KEY=sk-fake-in-container', '-e', 'NO_PROXY=assay-k1-api'],
  ],
]

const teardown = () => {
  docker('rm', '-f', 'assay-k1-egress', 'assay-k1-api')
  docker('network', 'rm', NET)
}
teardown()
let failed = 0
try {
  docker('network', 'create', '--internal', NET)
  docker('run', '-d', '--name', 'assay-k1-egress', 'assay-egress')
  docker('network', 'connect', NET, 'assay-k1-egress')
  docker('run', '-d', '--name', 'assay-k1-api', '--network', NET, '-e', 'LOG=/dev/stdout', '-v', `${k0}:/k0:ro`, 'assay-egress', 'node', '/k0/servers.mjs')

  for (const [name, cmd, ok, env] of checks) {
    let r
    let pass = false
    try {
      r = inAttempt(cmd, env)
      pass = ok(r)
    } catch {
      pass = false
    }
    if (!pass) failed += 1
    console.log(`${pass ? 'ok  ' : 'FAIL'}  ${name}`)
    if (!pass && r) console.log(`      exit ${r.status}\n      ${(r.stdout + r.stderr).trim().split('\n').slice(-6).join('\n      ')}`)
  }

  // Proxy'nin gördüğü her hedef: izin verilenlerin hepsi listede mi.
  const events = docker('logs', 'assay-k1-egress').stdout.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
  const tally = new Map()
  for (const e of events) tally.set(`${e.allowed ? 'allowed' : 'refused'} ${e.target}`, (tally.get(`${e.allowed ? 'allowed' : 'refused'} ${e.target}`) ?? 0) + 1)
  console.log('\negress log:')
  for (const [k, n] of [...tally].sort()) console.log(`  ${String(n).padStart(3)}  ${k}`)
  const leaked = events.filter((e) => e.allowed && !ALLOW.includes(e.target.split(':')[0]))
  if (leaked.length > 0) {
    failed += 1
    console.log(`FAIL  ${leaked.length} allowed target(s) outside the allowlist`)
  }
} finally {
  teardown()
}
console.log(failed === 0 ? '\nall checks passed' : `\n${failed} check(s) failed`)
process.exit(failed === 0 ? 0 : 1)
