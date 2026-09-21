import { containsHomePath, containsName, containsSecret } from '@ktlsr/assay-core'

/**
 * Yüklemeden önce kişisel veri taraması (0.4.1-c).
 *
 * `push`un gönderdiği kayıt store'dan okunurken zaten maskeleniyor. Bu tarama
 * maskenin bıraktığını arıyor: yol dışında geçen yerel kullanıcı adı (ör. bir
 * commit'in yazar satırı) maskelenmiyor, çünkü orada adın kimlik mi sıradan
 * bir sözcük mü olduğu bilinemez. Sır ve ev dizini denetimi ise ikinci bir
 * savunma hattı: maske bir gün kaçırırsa yükleme yine durur.
 */
export interface Finding {
  path: string
  kind: 'secret' | 'home path' | 'username'
}

export function findPersonalData(
  value: unknown,
  names: readonly string[],
  path = 'run',
): Finding[] {
  if (typeof value === 'string') {
    const kind = containsSecret(value)
      ? 'secret'
      : containsHomePath(value, { names })
        ? 'home path'
        : containsName(value, names)
          ? 'username'
          : null
    return kind === null ? [] : [{ path, kind }]
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      findPersonalData(item, names, `${path}[${index}]`),
    )
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, item]) =>
      findPersonalData(item, names, `${path}.${key}`),
    )
  }
  return []
}

/** Maskenin yüklenen kopyada kaç yeri değiştirdiği — diskteki dosya değişmiyor. */
export function maskedCount(raw: unknown, masked: unknown): number {
  const count = (text: string) => (text.match(/<user>|\[redacted:/g) ?? []).length
  return count(JSON.stringify(masked)) - count(JSON.stringify(raw))
}
