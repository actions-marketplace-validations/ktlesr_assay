// Deneme konteynerinin tek dış çıkışı: izin listesindeki adreslere HTTPS tüneli.
//
// Deneme konteyneri `internal: true` bir Docker ağında; dışarıya giden tek yol bu
// proxy (HTTPS_PROXY). Uymayan bir istemci (Node'un kendi fetch'i, ham soket) zaten
// dışarı çıkamıyor — izin listesini ağ zorluyor, istemcinin iyi niyeti değil.
// Kimlik taşımıyor; Anthropic çağrısı kimlik proxy'sine gidiyor (K3).
//
// Liste ASSAY_EGRESS_ALLOW'dan (virgülle ayrılmış) geliyor ve runner onu veriyor.
// Proxy başlarken dinlediğini ve listeyi tek bir JSON satırıyla bildiriyor; runner
// kayda o satırdaki listeyi yazıyor, kendi verdiğini değil (K2).
//
// Tavan: ana makine adına göre süzüyor, içeriğe bakmıyor. İzinli bir adrese giden
// istek (ör. registry'de olmayan bir paketin adı) veri taşıyabilir; konteynerde
// sızdırılacak bir sır olmaması bu yüzden ayrı bir koşul (docs/runner-environment.md).
import { createServer } from 'node:http'
import { connect } from 'node:net'
import { pathToFileURL } from 'node:url'

/** CONNECT hedefi (`host:port`) izinli mi: listede birebir ad ve yalnızca 443. */
export function allows(target, allow) {
  const m = /^([a-z0-9.-]+):(\d+)$/i.exec(String(target))
  return m !== null && m[2] === '443' && allow.includes(m[1].toLowerCase())
}

/** `a,b` → sıralı, küçük harf, tekrarsız liste. */
export function parseAllow(value) {
  return [...new Set(String(value ?? '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean))].sort()
}

const log = (event) => console.log(JSON.stringify({ at: new Date().toISOString(), ...event }))

export function start(allow, port = 3128) {
  // Düz HTTP ile proxy'lenen her istek reddedilir: izinli adreslerin hepsi HTTPS.
  const server = createServer((req, res) => {
    log({ kind: 'http', target: req.url, allowed: false })
    res.writeHead(403).end('assay egress: not on the allowlist\n')
  })
  server.on('connect', (req, client, head) => {
    client.on('error', () => undefined)
    const allowed = allows(req.url, allow)
    log({ kind: 'connect', target: req.url, allowed })
    if (!allowed) return client.end('HTTP/1.1 403 Forbidden\r\n\r\n')
    const up = connect(443, req.url.split(':')[0].toLowerCase(), () => {
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n')
      up.write(head)
      up.pipe(client)
      client.pipe(up)
    })
    up.on('error', () => client.destroy())
    client.on('close', () => up.destroy())
  })
  return server.listen(port, '0.0.0.0', () => log({ kind: 'listening', port, allow }))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const allow = parseAllow(process.env['ASSAY_EGRESS_ALLOW'])
  // Boş listeyle başlamak "her şey kapalı" demek olurdu ama büyük ihtimalle bir
  // kurulum hatası; sessizce çalışmak yerine söylüyor.
  if (allow.length === 0) {
    console.error('assay egress: ASSAY_EGRESS_ALLOW is empty; refusing to start')
    process.exit(2)
  }
  start(allow)
}
