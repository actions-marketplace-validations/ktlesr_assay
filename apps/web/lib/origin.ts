/**
 * İsteğin geldiği kök adres — kullanıcıya gösterilen komutlar için (0.4.1-g).
 *
 * Token sayfası `assay push --url http://localhost:3000` öneriyordu; üretimde
 * yanlış komut. Traefik arkasında `host` gerçek alan adını, `x-forwarded-proto`
 * şemayı taşıyor. Başlık yoksa yerel geliştirme varsayılır.
 */
export function originFrom(headers: Pick<Headers, 'get'>): string {
  const host = headers.get('x-forwarded-host') ?? headers.get('host') ?? 'localhost:3000'
  const proto = headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ?? 'http'
  return `${proto}://${host}`
}
