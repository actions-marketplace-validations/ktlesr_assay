// Temiz koşum ortamının doğrulaması — ücretsiz, model çağrısı yok (docs/runner-environment.md,
// "K1 sonuçları", "K2 sonuçları").
//
//   pnpm build   (runner, core ve adaptörün dist'i konteynere bağlanıyor)
//   docker build -t assay-attempt tools/runner-env
//   node tools/runner-env/verify.mjs
//
// K1: imajın kendisi ve izin listesi, elle kurulan bir iç ağda.
// K2: runner'ın kendi kurduğu düzen (runSuite + container), konteynerin içinden
//     bakan bir sonda adaptörüyle ve sahte API'ye konuşan gerçek Claude Code'la.
// Sahte API K0'ın sunucusu: :8080 kimlik proxy'si (gerçek anahtarı o enjekte
// ediyor), :8081 sahte Anthropic. Beklenmeyen her sonuç çıkış kodu 1.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseAllow } from './egress.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..', '..')
const k0 = join(here, '..', 'k0')
const IMAGE = 'assay-attempt'
const NET = 'assay-verify-int'
const EGRESS = 'assay-verify-egress'
const API = 'assay-verify-api'
const docker = (...args) => spawnSync('docker', args, { encoding: 'utf8', env: { ...process.env, MSYS_NO_PATHCONV: '1' } })

const runner = await import(pathToFileURL(join(repo, 'packages/runner/dist/index.js')).href)
const core = await import(pathToFileURL(join(repo, 'packages/core/dist/index.js')).href)
const ALLOW = parseAllow(runner.DEFAULT_EGRESS.join(','))

let failed = 0
const check = (name, pass, detail = '') => {
  if (!pass) failed += 1
  console.log(`${pass ? 'ok  ' : 'FAIL'}  ${name}`)
  if (!pass && detail) console.log(`      ${String(detail).trim().split('\n').slice(-6).join('\n      ')}`)
}

const teardown = () => {
  docker('rm', '-f', EGRESS, API)
  docker('network', 'rm', NET)
}

// ---------------------------------------------------------------------------
// K1 — imaj ve izin listesi
// ---------------------------------------------------------------------------

const PKG = '{"private":true,"dependencies":{"react":"19.0.0","react-dom":"19.0.0","react-router":"7.1.1","vite":"6.0.7"}}'
const LAUNCH = "const{chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage();await p.setContent('<title>k1-chromium</title>');console.log(await p.title());await b.close()})()"

function k1() {
  console.log('K1 — image and egress allowlist')
  const inAttempt = (cmd) =>
    docker('run', '--rm', '--network', NET, '--cap-drop', 'ALL', '-e', `HTTPS_PROXY=http://${EGRESS}:3128`, IMAGE, 'sh', '-c', cmd)
  docker('network', 'create', '--internal', NET)
  docker('run', '-d', '--name', EGRESS, '-e', `ASSAY_EGRESS_ALLOW=${ALLOW.join(',')}`, IMAGE, 'node', '/opt/assay/egress.mjs')
  docker('network', 'connect', NET, EGRESS)

  const checks = [
    ['instruction check passes in the image', 'assay-check-instructions', (r) => r.status === 0],
    ['external names do not resolve (no DNS channel)', 'getent hosts example.com', (r) => r.status !== 0],
    ['no route out without the proxy', "curl --noproxy '*' -m 8 -sS https://registry.npmjs.org/-/ping", (r) => r.status !== 0],
    ['no route out to a bare IP', "curl --noproxy '*' -m 8 -sSk https://1.1.1.1", (r) => r.status !== 0],
    ['npm registry through the proxy', "curl -m 20 -sS -o /dev/null -w '%{http_code}' https://registry.npmjs.org/-/ping", (r) => r.stdout === '200'],
    ['Playwright CDN through the proxy', "curl -m 20 -sS -o /dev/null -w '%{http_code}' https://cdn.playwright.dev/", (r) => r.status === 0],
    ['other hosts refused by the proxy', 'curl -m 20 -sS https://example.com', (r) => r.status === 56 && /403/.test(r.stderr)],
    ['api.anthropic.com refused (credentials go via the credential proxy)', 'curl -m 20 -sS https://api.anthropic.com/', (r) => r.status === 56 && /403/.test(r.stderr)],
    [
      'npm install (vite, react) and a Chromium launch from the image, capabilities dropped',
      `cd /work && printf '%s' '${PKG}' > package.json && npm install --no-audit --no-fund --loglevel=error && npm install --no-save --no-audit --no-fund --loglevel=error playwright@1.63.0 && node -e "${LAUNCH}"`,
      (r) => r.status === 0 && r.stdout.includes('k1-chromium'),
    ],
  ]
  for (const [name, cmd, ok] of checks) {
    const r = inAttempt(cmd)
    check(name, ok(r), `exit ${r.status}\n${r.stdout}${r.stderr}`)
  }
  const events = docker('logs', EGRESS).stdout.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
  const listening = events.find((e) => e.kind === 'listening')
  check('the proxy reports the allowlist it was given', listening !== undefined && listening.allow.join(',') === ALLOW.join(','))
  const cdn = events.filter((e) => e.allowed && e.target.startsWith('cdn.playwright.dev')).length
  check('no browser was downloaded (the only CDN connect is the curl check)', cdn === 1, `${cdn} CDN connects`)
  const leaked = events.filter((e) => e.allowed && !ALLOW.includes(e.target.split(':')[0]))
  check('nothing outside the allowlist was let through', leaked.length === 0, JSON.stringify(leaked))
  teardown()
}

// ---------------------------------------------------------------------------
// K2 — runner'ın kurduğu düzen
// ---------------------------------------------------------------------------

const suiteOf = (cases, skill = 'probe') =>
  core.parseSuite(
    [
      'version: 1',
      `target: { skill: ${skill}, source: k2 }`,
      `environment: { host: claude-code, model: claude-haiku-4-5-20251001, system_prompt_hash: not-provided-by-host, active_skills: [${skill}] }`,
      'runs: 2',
      'cases:',
      ...cases,
    ].join('\n'),
  )

function skillDir() {
  const dir = mkdtempSync(join(tmpdir(), 'assay-verify-skill-'))
  writeFileSync(join(dir, 'SKILL.md'), '---\nname: probe\ndescription: k2 probe skill\n---\nReply ok.\n')
  return dir
}

const leftovers = () =>
  [
    ...docker('ps', '-a', '--filter', 'name=assay-attempt-', '--format', '{{.Names}}').stdout.split('\n'),
    ...docker('ps', '-a', '--filter', 'name=assay-egress-', '--format', '{{.Names}}').stdout.split('\n'),
    ...docker('network', 'ls', '--filter', 'name=assay-net-', '--format', '{{.Name}}').stdout.split('\n'),
  ].filter(Boolean)

async function k2Probe(imageId) {
  console.log('\nK2 — attempts in containers, seen from inside (probe adapter)')
  const parsed = suiteOf([
    '  - { id: trigger.positive.probe, prompt: probe, expect: { triggered: true } }',
    '  - { id: trigger.positive.kill, prompt: kill, expect: { triggered: true } }',
    '  - { id: trigger.positive.orphan, prompt: orphan, expect: { triggered: true } }',
    '  - { id: trigger.positive.slow, prompt: slow, expect: { triggered: true } }',
    '  - { id: trigger.negative.unrelated.none, prompt: none, expect: { triggered: false } }',
  ])
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues))
  let egressLog = []
  const skill = skillDir()
  const run = await runner.runSuite(parsed.suite, { id: 'mock' }, {
    source: 'k2',
    skillPath: skill,
    repeat: 1,
    attemptTimeoutMs: 20_000,
    isolate: { module: pathToFileURL(join(here, 'probe-adapter.mjs')).href, export: 'ProbeAdapter' },
    container: { image: IMAGE, api: `${API}:8080`, onEgressLog: (lines) => (egressLog = lines) },
  })
  rmSync(skill, { recursive: true, force: true })
  const attempt = (id) => run.cases.find((c) => c.caseId === id)?.attempts[0]

  const probe = attempt('trigger.positive.probe')
  const seen = JSON.parse(probe?.trace?.find((e) => e.kind === 'assistant_message')?.text ?? '{}')
  const allowedProcs = new Set(['docker-init', 'timeout', 'node', 'sh', 'ps'])
  console.log(`      seen from inside: ${JSON.stringify({ ...seen, envKeys: seen.envKeys?.length })}`)
  check('the agent sees only its own container (no supervisor, no host)', Array.isArray(seen.processes) && seen.processes.every((p) => allowedProcs.has(p)), JSON.stringify(seen.processes))
  check('it runs as uid 1000', seen.id === '1000', seen.id)
  check('the only key it sees is the placeholder', seen.credential?.apiKey === runner.API_KEY_PLACEHOLDER && seen.credential?.oauth === null, JSON.stringify(seen.credential))
  const hostOnly = ['ASSAY_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN', 'USERPROFILE', 'USERNAME', 'APPDATA', 'GITHUB_TOKEN']
  check('no host variable reaches the container', Array.isArray(seen.envKeys) && !seen.envKeys.some((k) => hostOnly.includes(k)), JSON.stringify(seen.envKeys))
  check('the runner-built network: no DNS, no direct route, registry via proxy, others refused', seen.dns !== 0 && seen.direct !== 0 && seen.registry === '200' && seen.other === 56, JSON.stringify(seen))
  check('the host is unreachable (host.docker.internal)', seen.hostDocker !== 0, seen.hostDocker)
  check('the workdir is outside any home directory', typeof seen.workdir === 'string' && seen.workdir.startsWith('/tmp/'), seen.workdir)

  const killed = attempt('trigger.positive.kill')
  check('a killed attempt is unknown and says why', killed?.verdict === 'unknown' && /killed by SIGKILL inside its container/.test(killed?.reason ?? ''), killed?.reason)
  const slow = attempt('trigger.positive.slow')
  check('an attempt past the timeout is unknown and closed', slow?.verdict === 'unknown' && /still running at the timeout/.test(slow?.reason ?? ''), slow?.reason)
  check('the orphan-starting attempt completed', attempt('trigger.positive.orphan')?.verdict === 'pass')
  check('no container, egress proxy or network is left behind', leftovers().length === 0, leftovers().join(', '))

  const container = run.environment?.container
  check(
    'the record carries the container: image digest, platform, egress, limits',
    container?.image === imageId && container?.platform === 'linux/amd64' && container?.egress.join(',') === ALLOW.join(',') && /memory 2g, cpus 2, pids 512/.test(container?.limits ?? ''),
    JSON.stringify(container),
  )
  check('the environment hash is the container one, not the host one', typeof run.pins.environmentHash === 'string' && run.pins.environmentHash !== 'sha256:probe-host-environment', run.pins.environmentHash)
  const events = egressLog.map((l) => JSON.parse(l))
  check('the egress log shows the allowlist and the refusal', events.some((e) => e.kind === 'listening') && events.some((e) => e.target === 'example.com:443' && e.allowed === false))
}

async function k2Claude() {
  console.log('\nK2 — Claude Code in a container against the fake API')
  const parsed = suiteOf([
    '  - { id: trigger.positive.hello, prompt: hello, expect: { triggered: true } }',
    '  - { id: trigger.negative.unrelated.weather, prompt: weather, expect: { triggered: false } }',
  ])
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues))
  let egressLog = []
  const skill = skillDir()
  const run = await runner.runSuite(parsed.suite, { id: 'claude-code' }, {
    source: 'k2-claude',
    skillPath: skill,
    repeat: 1,
    isolate: { module: pathToFileURL(join(repo, 'packages/adapters/dist/index.js')).href, export: 'ClaudeCodeAdapter' },
    container: { image: IMAGE, api: `${API}:8080`, onEgressLog: (lines) => (egressLog = lines) },
  })
  rmSync(skill, { recursive: true, force: true })
  const verdicts = run.cases.flatMap((c) => c.attempts.map((a) => a.verdict))
  check('both sessions completed (model call reached the API: NO_PROXY)', verdicts.length === 2 && !verdicts.includes('unknown'), JSON.stringify(run.cases.flatMap((c) => c.attempts.map((a) => a.reason))))
  check('host memory measured clean in the container', Array.isArray(run.environment?.memory) && run.environment.memory.length === 0, JSON.stringify(run.environment?.memory))
  check('the record carries the container', run.environment?.container?.image?.startsWith('sha256:') === true)
  const anthropic = egressLog.map((l) => JSON.parse(l)).filter((e) => String(e.target).startsWith('api.anthropic.com'))
  check('no non-essential traffic (CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC reached the host)', anthropic.length === 0, `${anthropic.length} connects to api.anthropic.com`)
  const api = docker('logs', API).stdout.trim().split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l))
  const proxied = api.filter((e) => e.server === 'credproxy')
  check('the credential proxy saw only the placeholder and injected the key', proxied.length > 0 && proxied.every((e) => e.incomingKey === 'fake') && api.filter((e) => e.server === 'fakeapi').every((e) => e.key === 'REAL'), JSON.stringify(proxied.slice(0, 2)))
}

function k2Compare() {
  console.log('\nK2 — a container run does not compare with a run on this machine')
  const store = mkdtempSync(join(tmpdir(), 'assay-verify-store-'))
  const skill = skillDir()
  const suitePath = join(store, 'k2.suite.yaml')
  writeFileSync(
    suitePath,
    [
      'version: 1',
      'target: { skill: probe, source: k2 }',
      'environment: { host: claude-code, model: claude-haiku-4-5-20251001, system_prompt_hash: not-provided-by-host, active_skills: [probe] }',
      'runs: 2',
      'cases:',
      '  - { id: trigger.positive.hello, prompt: hello, expect: { triggered: true } }',
      '  - { id: trigger.negative.unrelated.weather, prompt: weather, expect: { triggered: false } }',
    ].join('\n'),
  )
  const cli = (args, env = {}) =>
    spawnSync(process.execPath, [join(repo, 'packages/cli/dist/bin.js'), ...args], {
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_CODE_OAUTH_TOKEN: '', ...env },
    })
  const common = ['run', suitePath, '--skill', skill, '--repeat', '1', '--store', store]
  const host = cli(common, { ANTHROPIC_BASE_URL: 'http://127.0.0.1:18080', ANTHROPIC_API_KEY: 'sk-fake-on-host' })
  const inContainer = cli([...common, '--container', IMAGE, '--container-api', `${API}:8080`])
  check('the CLI runs with --container and prints the container line', inContainer.status === 0 && /container sha256:/.test(inContainer.stdout + inContainer.stderr), inContainer.stderr)
  const ids = readdirSync(join(store, 'runs')).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort()
  const cmp = ids.length === 2 ? cli(['compare', ids[0], ids[1], '--store', store]) : { status: -1, stdout: '', stderr: 'expected two runs' }
  check(
    'compare refuses and names the container as a changed condition',
    host.status === 0 && cmp.status === 3 && /container/.test(cmp.stdout) && /none \(a process on the host\)/.test(cmp.stdout),
    `${host.stderr}\n${cmp.stdout}${cmp.stderr}`,
  )
  const noApi = cli([...common, '--container', IMAGE])
  check('--container without --container-api is a usage error', noApi.status === 2)
  rmSync(store, { recursive: true, force: true })
  rmSync(skill, { recursive: true, force: true })
}

teardown()
try {
  if (!existsSync(join(repo, 'packages/runner/dist/container.js'))) throw new Error('build first: pnpm build')
  k1()
  const imageId = docker('image', 'inspect', '--format', '{{.Id}}', IMAGE).stdout.trim()
  docker('run', '-d', '--name', API, '-p', '127.0.0.1:18080:8080', '-e', 'LOG=/dev/stdout', '-v', `${k0}:/k0:ro`, IMAGE, 'node', '/k0/servers.mjs')
  await k2Probe(imageId)
  await k2Claude()
  k2Compare()
} finally {
  teardown()
}
console.log(failed === 0 ? '\nall checks passed' : `\n${failed} check(s) failed`)
process.exit(failed === 0 ? 0 : 1)
