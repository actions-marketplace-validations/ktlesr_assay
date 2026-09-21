/**
 * Sürüm PR'ında eylemin `assay-version` pinini CLI manifestine eşitler.
 *
 * `changeset version` yalnızca paket manifestlerini yükseltiyor; `action.yml`
 * onun bilmediği bir dosya. 0.2.0'da pin elle, sürüm PR'ının dalına ayrı bir
 * commit'le yükseltildi — ve changesets o dalı her `main` push'unda yeniden
 * ürettiği için elle eklenen commit düşebiliyordu. Unutulan pin, eylemin
 * deponun ürettiğinden ESKİ bir CLI kurması demek (decisions.md, 2026-09-05).
 *
 * Kanıtı `tools/action-metadata.test.ts`: `pin >= manifest`. Bu betik bir gün
 * eşleşmeyi kaçırırsa sürüm PR'ının CI'ı kırmızıya döner.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const version = JSON.parse(readFileSync('packages/cli/package.json', 'utf8')).version
const path = 'action.yml'
const source = readFileSync(path, 'utf8')
// `assay-version:` bloğundaki ilk `default:` — aradaki yorumlar atlanıyor.
const pattern = /(assay-version:[\s\S]*?\n\s*default:\s*')[^']+(')/
if (!pattern.test(source)) {
  console.error(`${path}: assay-version default not found`)
  process.exit(1)
}
writeFileSync(path, source.replace(pattern, `$1${version}$2`))
console.log(`${path}: assay-version -> ${version}`)
