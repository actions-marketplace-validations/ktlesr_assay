/**
 * Yerel koşum store'u.
 *
 * `.assay/runs/<run-id>.json` — sürümlü JSON. Sorgu motoru yok; Faz 1'in
 * ihtiyacı dört pin ve N tekrarın kaydı ve tekrar okunması
 * ([decisions.md](../../../docs/decisions.md)).
 *
 * Kayıtlar `@ktlsr/assay-core`'daki kanonik `Run` tipini olduğu gibi taşır. Faz 2'de
 * Postgres aynı tipin ikinci kalıcılık hedefi olacak; burada kendi formatımızı
 * uydurmuyoruz ki iki taraf ayrışmasın.
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { redactDeep, type Run } from '@ktlsr/assay-core'
import { localNames } from './identity.js'

/**
 * Dosya biçimi sürümü.
 *
 * Kanonik `Run` tipi değiştiğinde artırılır. Okuyucu tanımadığı sürümü
 * sessizce yorumlamaz — hata verir.
 */
export const STORE_VERSION = 2

export interface StoredRun {
  storeVersion: number
  run: Run
}

export interface StoreOptions {
  /** Kök dizin. Varsayılan: çalışma dizinindeki `.assay`. */
  root?: string
}

export class RunStore {
  readonly #dir: string

  constructor(options: StoreOptions = {}) {
    this.#dir = join(options.root ?? '.assay', 'runs')
  }

  get directory(): string {
    return this.#dir
  }

  async save(run: Run): Promise<string> {
    await mkdir(this.#dir, { recursive: true })
    const path = join(this.#dir, `${run.id}.json`)
    const payload: StoredRun = { storeVersion: STORE_VERSION, run }
    await writeFile(path, `${JSON.stringify(payload, replacer, 2)}\n`, 'utf8')
    return path
  }

  async load(runId: string): Promise<Run> {
    const path = join(this.#dir, `${runId}.json`)
    const raw = await readFile(path, 'utf8')
    return parseStored(raw, path)
  }

  /** Kayıtlı koşum kimlikleri, yeniden eskiye. */
  async list(): Promise<string[]> {
    const entries = await readdir(this.#dir).catch(() => [])
    return entries
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.slice(0, -'.json'.length))
      .sort()
      .reverse()
  }

  /** En son koşum, yoksa `null`. */
  async latest(): Promise<Run | null> {
    const [id] = await this.list()
    return id === undefined ? null : this.load(id)
  }
}

/** `Uint8Array` JSON'a düz nesne olarak sızmasın; kanıt dosyaları kayda girmez. */
function replacer(_key: string, value: unknown): unknown {
  return value instanceof Uint8Array ? `<${value.byteLength} bytes>` : value
}

export function parseStored(raw: string, source = '<memory>'): Run {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (cause) {
    throw new Error(`${source} is not valid JSON: ${(cause as Error).message}`)
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`${source} does not contain a run record`)
  }
  const record = parsed as Partial<StoredRun>
  if (record.storeVersion !== STORE_VERSION) {
    throw new Error(
      `${source} was written by store version ${String(record.storeVersion)}, this build reads version ${STORE_VERSION}`,
    )
  }
  if (record.run === undefined) throw new Error(`${source} carries no run`)
  /*
   * Okurken de maskeleniyor.
   *
   * Yazarken maskelemek yalnızca bundan SONRA yazılan kayıtları koruyor;
   * diskte duran eski kayıtlar hâlâ ev dizini yollarını taşıyor ve `report`,
   * `--html` ve `push` hepsi buradan geçiyor. Maskelemeyi okuma yoluna da
   * koymak, tek bir kaydın bile maskelenmemiş bir yolu ekrana ya da bir
   * dosyaya taşımasını engelliyor.
   */
  return redactDeep(record.run, { names: localNames() })
}
