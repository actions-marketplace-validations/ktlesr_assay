// K0 sahte sunucuları — tek süreçte üçü (model çağrısı yok, ücretsiz):
//  :8081 sahte Anthropic API  — /v1/messages'a gerçek biçimde SSE ya da JSON döner; gelen kimliği kaydeder
//  :8080 kimlik proxy'si      — x-api-key'i REAL_KEY ile değiştirir, yanıtı tamponlamadan geçirir
//  :3128 çıkış günlükçüsü     — CONNECT ve düz HTTP isteklerinin hedefini kaydeder, reddeder
import { setTimeout } from 'node:timers'
import { createServer, request } from 'node:http'
import { appendFileSync } from 'node:fs'

const LOG = process.env.LOG ?? '/logs/servers.jsonl'
const REAL_KEY = process.env.REAL_KEY ?? 'sk-real-key-held-by-proxy'
const log = (event) => appendFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), ...event }) + '\n')

const message = (model) => ({
  id: 'msg_k0', type: 'message', role: 'assistant', model,
  content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn', stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 1 },
})

createServer((req, res) => {
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    let parsed = {}
    try { parsed = JSON.parse(body) } catch { /* gövde JSON değilse boş kalır */ }
    const key = req.headers['x-api-key']
    log({ server: 'fakeapi', method: req.method, path: req.url, key: key === REAL_KEY ? 'REAL' : key === undefined ? 'none' : 'OTHER', stream: parsed.stream === true, bytes: body.length })
    if (req.method !== 'POST' || !String(req.url).startsWith('/v1/messages')) {
      res.writeHead(404, { 'content-type': 'application/json' })
      return res.end('{"type":"error","error":{"type":"not_found_error","message":"k0"}}')
    }
    if (key !== REAL_KEY) {
      res.writeHead(401, { 'content-type': 'application/json' })
      return res.end('{"type":"error","error":{"type":"authentication_error","message":"k0: key was not injected"}}')
    }
    const model = parsed.model ?? 'claude-haiku-4-5-20251001'
    if (parsed.stream !== true) {
      res.writeHead(200, { 'content-type': 'application/json' })
      return res.end(JSON.stringify(message(model)))
    }
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' })
    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    const m = message(model)
    send('message_start', { type: 'message_start', message: { ...m, content: [], stop_reason: null, usage: { input_tokens: 10, output_tokens: 0 } } })
    send('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })
    // Parçalı: proxy tamponlarsa bu iki olay tek parçada gelir; yakalayıcı bunu ayrı ölçüyor.
    setTimeout(() => {
      send('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'ok' } })
      send('content_block_stop', { type: 'content_block_stop', index: 0 })
      send('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } })
      send('message_stop', { type: 'message_stop' })
      res.end()
    }, 300)
  })
}).listen(8081, '0.0.0.0')

// Kimlik proxy'si: tek upstream, anahtarı enjekte eder, akışı parça parça geçirir.
createServer((req, res) => {
  const headers = { ...req.headers, host: 'fakeapi:8081' }
  const incoming = headers['x-api-key']
  delete headers['authorization']
  headers['x-api-key'] = REAL_KEY
  const chunks = []
  const up = request({ host: '127.0.0.1', port: 8081, method: req.method, path: req.url, headers }, (upRes) => {
    res.writeHead(upRes.statusCode ?? 502, upRes.headers)
    upRes.on('data', (c) => { chunks.push(Date.now()); res.write(c) })
    upRes.on('end', () => { log({ server: 'credproxy', path: req.url, incomingKey: incoming === REAL_KEY ? 'REAL' : incoming ? 'fake' : 'none', status: upRes.statusCode, chunks: chunks.length, spreadMs: chunks.length > 1 ? chunks.at(-1) - chunks[0] : 0 }); res.end() })
  })
  up.on('error', (e) => { res.writeHead(502); res.end(String(e)) })
  req.pipe(up)
}).listen(8080, '0.0.0.0')

// Çıkış günlükçüsü: host'un proxy'ye söylediği her hedef.
const egress = createServer((req, res) => {
  log({ server: 'egress', kind: 'http', target: req.url })
  res.writeHead(403); res.end('k0 egress blocked')
})
egress.on('connect', (req, socket) => {
  socket.on('error', () => undefined)
  log({ server: 'egress', kind: 'connect', target: req.url })
  socket.end('HTTP/1.1 403 Forbidden\r\n\r\n')
})
// Kopan bir bağlantı sunucuyu düşürmesin (ilk denemede düşürdü).
process.on('uncaughtException', (e) => log({ server: 'process', error: String(e) }))
egress.listen(3128, '0.0.0.0')
console.log('k0 servers up')
