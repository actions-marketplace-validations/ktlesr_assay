/**
 * Konteynerin içinden bakan sahte adaptör — yalnızca `verify.mjs` için (K2).
 *
 * Worker'da, deneme konteynerinin içinde kuruluyor ve istemin ilk sözcüğüne göre
 * ajanın yapabileceği bir şeyi yapıyor. Gözlediğini `assistant_message` olarak
 * ize yazıyor; doğrulama betiği kaydı okuyor. Model çağrısı yok, ücretsiz.
 *
 *  probe  — süreç listesi, kullanıcı, ortam, ağ: supervisor görünüyor mu,
 *           gerçek bir kimlik bilgisi var mı, izin listesi dışına çıkılabiliyor mu
 *  kill   — worker'ı (bu süreci) SIGKILL ile öldürür: ajanın yapabildiği şey
 *  orphan — kendinden sonra da yaşamak isteyen bir süreç başlatır
 *  slow   — zaman aşımını geçecek kadar bekler
 *
 * Düz JS ve yalnızca Node yerleşikleri: konteynere tek dosya olarak bağlanıyor.
 */
import { execFileSync, spawn } from 'node:child_process'
import { setTimeout } from 'node:timers'

const sh = (cmd) => {
  try {
    return { code: 0, out: execFileSync('sh', ['-c', cmd], { encoding: 'utf8', timeout: 30_000 }).trim() }
  } catch (e) {
    return { code: e.status ?? -1, out: `${e.stdout ?? ''}${e.stderr ?? ''}`.trim() }
  }
}

export class ProbeAdapter {
  id = 'mock'

  async start(config) {
    const verb = config.prompt.trim().split(/\s+/)[0]
    const notes = []
    if (verb === 'kill') process.kill(process.pid, 'SIGKILL')
    if (verb === 'slow') await new Promise((resolve) => setTimeout(resolve, 600_000))
    if (verb === 'orphan') {
      spawn('sh', ['-c', 'sleep 600'], { stdio: 'ignore', detached: true }).unref()
      notes.push(`orphan started`)
    }
    if (verb === 'probe') {
      const env = process.env
      const observed = {
        id: sh('id -u').out,
        processes: sh('ps -A -o comm=').out.split('\n').filter(Boolean),
        credential: {
          apiKey: env['ANTHROPIC_API_KEY'] ?? null,
          oauth: env['CLAUDE_CODE_OAUTH_TOKEN'] === undefined ? null : 'present',
        },
        envKeys: Object.keys(env).sort(),
        dns: sh('getent hosts example.com').code,
        direct: sh("curl --noproxy '*' -m 8 -sS https://registry.npmjs.org/-/ping").code,
        registry: sh("curl -m 20 -sS -o /dev/null -w '%{http_code}' https://registry.npmjs.org/-/ping").out,
        other: sh('curl -m 20 -sS https://example.com').code,
        hostDocker: sh("curl -m 8 -sS --noproxy '*' http://host.docker.internal:3100/").code,
        workdir: config.workdir,
      }
      notes.push(JSON.stringify(observed))
    }
    return {
      id: `probe-${config.caseId}-${config.attempt}`,
      adapter: 'mock',
      startedAt: new Date().toISOString(),
      notes,
    }
  }

  async readTriggerSignal() {
    return { available: true, triggered: true, skills: ['probe'], refused: false, refusals: [], complete: true, via: 'mock' }
  }

  async readTrace(session) {
    return [
      ...session.notes.map((text, i) => ({ seq: i + 1, kind: 'assistant_message', text })),
      { seq: session.notes.length + 1, kind: 'session_end', outcome: 'completed' },
    ]
  }

  async finalize() {
    // Gerçek adaptör gibi bir ortam bildiriyor: konteyner koşulu bunun üstüne işleniyor.
    return {
      outcome: 'completed',
      finishedAt: new Date().toISOString(),
      latencyMs: 1,
      environmentHash: 'sha256:probe-host-environment',
      environment: { model: 'probe', version: '0', tools: [], skills: ['probe'], agents: [], plugins: [], memory: [] },
      permissionMode: 'acceptEdits',
      files: [],
      env: { writes: [], deletes: [], network: [], unobserved: [] },
    }
  }
}
