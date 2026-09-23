import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Host'un ikilisi bir `postinstall`dan geliyor ve npm 12 install script'lerini
 * varsayılan olarak engelliyor (2026-07-08 changelog). Ölçüldü: npm 12.1.0 ile
 * `npm install @anthropic-ai/claude-code` "added 2 packages" diyor, script
 * engelleniyor ve `claude --version` "native binary not installed" veriyor.
 *
 * Bu sessiz bir arıza: kurulum başarılı görünür, host açılmaz ve her deneme
 * `unknown` olur — yani ölçüm aracı ölçemediğini ancak koşum sonunda söyler.
 * Bu yüzden host'u kuran iki yer de kurulumdan SONRA ikiliyi doğruluyor ve
 * doğrulayamazsa duruyor.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path: string) => readFileSync(join(root, path), 'utf8')

const PLACES = [
  ['action.yml', 'the GitHub Action'],
  ['tools/runner-env/Dockerfile', 'the attempt image'],
] as const

describe('host kurulumu doğrulanıyor — npm 12 install script\'leri engelliyor', () => {
  for (const [path, what] of PLACES) {
    it(`${what} kurduğu host'u doğruluyor`, () => {
      const text = read(path)
      expect(text, `${path} installs the host`).toMatch(/npm install -g "?@anthropic-ai\/claude-code/)
      // Doğrulama: `claude --version` çağrısı var ve sonucu yutulmuyor.
      expect(text).toContain('claude --version')
      expect(text, `${path} must not swallow the check`).not.toContain('claude --version || true')
      // Onarım: engellenen postinstall elle koşuluyor.
      expect(text, `${path} repairs a blocked postinstall`).toContain(
        '@anthropic-ai/claude-code/install.cjs',
      )
    })
  }

  it('eylem doğrulama düşerse adımı hatayla durduruyor', () => {
    const text = read('action.yml')
    expect(text).toMatch(/if ! claude --version; then[\s\S]*::error::[\s\S]*exit 1/)
  })
})
