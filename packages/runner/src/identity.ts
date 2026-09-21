import { userInfo } from 'node:os'

/**
 * Bu makinenin hesap adları — kaydı yazan ya da okuyan kullanıcının kimliği.
 *
 * Core işletim sistemine bakamıyor; maskeleme bu adları runner'dan alıyor
 * (`RedactOptions.names`). Ortam değişkenleri de okunuyor: CI'da ve bazı
 * kapsayıcılarda `userInfo()` hata veriyor ya da başka bir hesabı söylüyor.
 */
export function localNames(): string[] {
  const names = new Set<string>()
  try {
    names.add(userInfo().username)
  } catch {
    // ponytail: hesabı çözülemeyen ortam; aşağıdaki değişkenler yeter.
  }
  for (const key of ['USERNAME', 'USER', 'LOGNAME']) {
    const value = process.env[key]
    if (value !== undefined && value !== '') names.add(value)
  }
  return [...names]
}
