/**
 * Sır maskeleme.
 *
 * Koşum kayıtları izleri saklıyor ve CI'da artefakt olarak yükleniyor. Ölçülen
 * skill bir ortam değişkenini ekrana basarsa o değer kaydın içine, oradan da
 * artefakta girer. Kayıt yazılmadan önce bilinen sır biçimleri maskelenir.
 *
 * Tavan: yalnızca tanınan biçimler yakalanır. Özel bir şirket içi token biçimi
 * geçerse görülmez — bu yüzden maskeleme, ortam değişkenlerini ajana hiç
 * vermemenin yerine geçmez, ikinci savunma hattıdır.
 *
 * Sırlar tek sızıntı türü değil. Ev dizini yolları işletim sistemi kullanıcı
 * adını taşıyor ve iz metinleri bu yollarla dolu: ajan her dosyayı mutlak
 * yolla açıyor. Kayıt CI artefaktı olarak yükleniyor, HTML raporuna basılıyor
 * ve hosted tarafta yayımlanabiliyor — yani bir skill yazarı kendi koşumunu
 * paylaştığında makine kullanıcı adını da paylaşmış oluyor. Kimlik, sır kadar
 * kişisel bir veri.
 */

/** Tanınan sır biçimleri. Maskeleme yalnızca değeri siler, varlığını değil. */
const SECRET_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
  ['anthropic-api-key', /sk-ant-api\w{2}-[\w-]{20,}/g],
  ['anthropic-oauth-token', /sk-ant-oat\w{2}-[\w-]{20,}/g],
  ['openai-key', /\bsk-proj-[\w-]{20,}/g],
  ['openai-legacy-key', /\bsk-[A-Za-z0-9]{32,}/g],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9]{30,}/g],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/g],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{30,}/g],
  ['slack-token', /\bxox[baprs]-[0-9A-Za-z-]{10,}/g],
  ['private-key', /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g],
]

/**
 * Ev dizini yolları — kullanıcı adı maskelenir, yolun biçimi korunur.
 *
 * `C:\Users\ada\...` → `C:\Users\<user>\...`. Yolu tamamen silmek
 * ölçümün okunabilirliğini bozardı: hangi dosyanın açıldığı bir iz sinyali.
 * Silinen tek şey kimlik.
 *
 * Üç platform da kapsanıyor ve Windows'ta iki ayırıcı da: ajan bazen `/`
 * bazen `\` yazıyor, ikisi de aynı yola çözülüyor.
 */
/** Yol ayırıcıları, karakter sınıfı içinde kullanılmak üzere: `/` ve `\`. */
const SEP = '/\\\\'
/** Bir yol parçasında bulunamayan karakterler; kullanıcı adı bunlarda biter. */
const STOP = `${SEP}\\s"'<>|:*?`

/**
 * Ters bölüleri yenmiş bir yolda adın bittiği yer. Kabuk `C:\Users\ada\AppData`
 * yazımını `C:UsersadaAppData`ya çeviriyor (0.4.1-b, gerçek kayıtta görüldü);
 * ayırıcı yok, ad bir Windows profil klasörüyle ya da yolun sonuyla bitiyor
 * sayılıyor. Liste dışı bir klasörde maske yolun sonuna kadar uzar — fazla
 * maskelemek, adı bırakmaktan iyidir.
 */
const PROFILE_DIRS =
  'AppData|Desktop|Documents|Downloads|OneDrive|Pictures|Music|Videos|Favorites|Links|source|repos'

const HOME_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
  // Ayırıcı birden çok olabilir: ajanın yazdığı kod dizgelerinde `\\` kaçışı.
  ['windows-home', new RegExp(`([A-Za-z]:[${SEP}]+Users[${SEP}]+)([^${STOP}]+)`, 'g')],
  [
    'windows-home-flattened',
    new RegExp(`([A-Za-z]:Users)([^${STOP}]+?)(?=${PROFILE_DIRS}|[${STOP}]|$)`, 'g'),
  ],
  // Claude Code'un proje dizini adı: `C:\Users\ada` → `C--Users-ada`. Ad
  // tire içeriyorsa yalnızca ilk parçası maskelenir; bilinen adlar (aşağıda)
  // bu tavanı yerel kullanıcı için kapatıyor.
  ['claude-project-slug', new RegExp(`([A-Za-z]--Users-)([^-${STOP}]+)`, 'g')],
  ['macos-home', new RegExp(`(/Users/)([^${STOP}]+)`, 'g')],
  ['linux-home', new RegExp(`(/home/)([^${STOP}]+)`, 'g')],
]

/**
 * Bilinen kullanıcı adları — genellikle kaydı yazan ya da okuyan makinenin
 * hesabı. Core işletim sistemine bakamıyor; adı çağıran (runner, CLI) veriyor.
 * Desenler adı yolun biçiminden tahmin ediyor; bilinen ad o tahmine gerek
 * bırakmıyor ve desenlerin tavanlarını (tireli ad, noktalı ad) kapatıyor.
 */
export interface RedactOptions {
  names?: readonly string[] | undefined
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Adın yol içindeki biçimleri: olduğu gibi ve Claude Code'un tireli hâli. */
function namePatterns(names: readonly string[] | undefined): RegExp[] {
  const variants = new Set<string>()
  for (const name of names ?? []) {
    if (name.length < 2 || GENERIC_HOME_SEGMENTS.has(name.toLowerCase())) continue
    variants.add(name)
    variants.add(name.replace(/[^A-Za-z0-9]/g, '-'))
  }
  return [...variants].map(
    (name) => new RegExp(`((?:Users|home)(?:[${SEP}]+|-)?)(${escapeRegExp(name)})`, 'gi'),
  )
}

/** Maskelenmeyen kullanıcı adları: gerçek bir kimlik taşımıyorlar. */
const GENERIC_HOME_SEGMENTS = new Set([
  '<user>',
  'user',
  'runner',
  'root',
  'shared',
  'public',
  'default',
])

/**
 * Metindeki bilinen sırları maskeler.
 *
 * Maskeleme yerine geçen etiket, hangi tür sırrın bulunduğunu söyler — silinen
 * şeyin ne olduğunu bilmek, hiçbir iz bırakmamaktan iyidir.
 */
export function redact(text: string, options: RedactOptions = {}): string {
  let out = text
  for (const [label, pattern] of SECRET_PATTERNS) {
    out = out.replace(pattern, `[redacted:${label}]`)
  }
  for (const pattern of namePatterns(options.names)) {
    out = out.replace(pattern, (_match, prefix: string) => `${prefix}<user>`)
  }
  for (const [, pattern] of HOME_PATTERNS) {
    out = out.replace(pattern, (match, prefix: string, name: string) =>
      GENERIC_HOME_SEGMENTS.has(name.toLowerCase()) ? match : `${prefix}<user>`,
    )
  }
  return out
}

/** Bir değerde sır var mı. Maskelemeden önce kontrol etmek isteyen için. */
export function containsSecret(text: string): boolean {
  return SECRET_PATTERNS.some(([, pattern]) => new RegExp(pattern.source).test(text))
}

/** Metinde maskelenmemiş bir ev dizini kullanıcı adı var mı. */
export function containsHomePath(text: string, options: RedactOptions = {}): boolean {
  if (
    namePatterns(options.names).some((pattern) =>
      new RegExp(pattern.source, 'i').test(text),
    )
  ) {
    return true
  }
  return HOME_PATTERNS.some(([, pattern]) => {
    const match = new RegExp(pattern.source).exec(text)
    return match !== null && !GENERIC_HOME_SEGMENTS.has((match[2] ?? '').toLowerCase())
  })
}

/**
 * Bilinen bir ad, yol dışında da geçiyor mu — ör. ajanın yazdığı bir commit'in
 * yazar satırında. Maskelenmiyor: yol dışında adın bir kimlik mi yoksa sıradan
 * bir sözcük mü olduğu bilinemez. `push` bunu yüklemeden önce soruyor.
 */
export function containsName(text: string, names: readonly string[]): boolean {
  return names.some(
    (name) =>
      name.length >= 3 &&
      !GENERIC_HOME_SEGMENTS.has(name.toLowerCase()) &&
      new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(name)}(?![A-Za-z0-9])`, 'i').test(text),
  )
}

/**
 * Bir nesnenin içindeki tüm metinleri özyinelemeli maskeler.
 *
 * Araç argümanları ve iz metinleri iç içe nesneler olabiliyor; yalnızca üst
 * seviyeyi maskelemek eksik olurdu.
 */
export function redactDeep<T>(value: T, options: RedactOptions = {}): T {
  if (typeof value === 'string') return redact(value, options) as T
  if (Array.isArray(value)) return value.map((item) => redactDeep(item, options)) as T
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) out[key] = redactDeep(item, options)
    return out as T
  }
  return value
}
