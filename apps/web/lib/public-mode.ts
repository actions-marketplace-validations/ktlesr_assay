/**
 * Yayın modunda (`ASSAY_PUBLIC_SITE=true`) kapalı rotalar.
 *
 * Kapatma yol eşleşmesiyle, kimlik doğrulamayla değil: middleware kenar
 * çalışma zamanında koşuyor ve orada Prisma yok. Yol eşleşmesi hiçbir şeye
 * bağlı değil, bu yüzden sessizce bozulamaz.
 *
 * `/compare` 0.4.1'e kadar buradaydı ("kimlik doğrulama istemiyor ve koşum
 * kimliği olmadan boş bir form"). Ama koşum ve suite sayfaları "vs previous"
 * ile ona bağlanıyordu: ziyaretçi her karşılaştırma bağlantısında 404 alıyordu
 * ve karşılaştırma — hosted tarafın varlık sebebi — sitede hiç yapılamıyordu.
 * Açmak bir şey sızdırmıyor: sayfa koşumları görünürlük kapsamıyla okuyor,
 * yayımlanmamış bir koşum "One of those runs is missing" der.
 */
const CLOSED_IN_PUBLIC_MODE = [
  // Bileşen kataloğu: ziyaretçiye yarım kalmış bir uygulama gibi görünür.
  /^\/dev(\/|$)/,
  // Kurulum ucu: işini bitirdi, yayın modunda hiç var olmamalı.
  /^\/api\/bootstrap(\/|$)/,
]

export function closedInPublicMode(pathname: string): boolean {
  return CLOSED_IN_PUBLIC_MODE.some((pattern) => pattern.test(pathname))
}
