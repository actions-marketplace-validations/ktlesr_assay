/**
 * Öldürülmeye uygun bir sahte adaptör — `supervisor.test.ts` için.
 *
 * Worker sürecinde kuruluyor (adaptör tarifiyle), o yüzden ayrı bir dosya ve
 * düz JS olmak zorunda: süreç sınırından nesne değil tarif geçiyor.
 *
 * İki numarası var:
 *  - `ASSAY_TEST_SLOW_MS` kadar bekliyor, böylece testin öldürecek zamanı olur.
 *  - `ASSAY_TEST_ORPHAN_PORT` verilirse, ajanın yaptığı şeyi yapıyor: kendi
 *    çocuğu olan ve kendisinden sonra da yaşayacak bir süreç başlatıyor.
 *    Süreç ağacı kapatılmazsa o çocuk ortada kalır — 4.2.2'de portu meşgul
 *    eden yetimlerin kaynağı buydu.
 */
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const slowMs = Number(process.env['ASSAY_TEST_SLOW_MS'] ?? '0')
const orphanPort = process.env['ASSAY_TEST_ORPHAN_PORT']
const pidFile = process.env['ASSAY_TEST_PID_FILE']
const orphanPidFile = process.env['ASSAY_TEST_ORPHAN_PID_FILE']

export class SlowMockAdapter {
  id = 'mock'

  async start(config) {
    if (pidFile !== undefined) writeFileSync(pidFile, String(process.pid), 'utf8')

    if (orphanPort !== undefined) {
      // Ajanın dev sunucusunun karşılığı: bu süreçten sonra da yaşamak ister.
      /*
       * `detached: true` şart.
       *
       * Detached olmayan bir çocuk Windows'ta Node'un (libuv'un) kurduğu job
       * object'e giriyor ve ebeveyn ölünce kendiliğinden ölüyor — yani testi
       * geçiren şey bizim ağaç kapatmamız değil, Node'un kendi temizliği
       * olurdu. Ters çevirme bunu yakaladı: ağaç kapatma kaldırıldığında test
       * hâlâ yeşildi. Gerçek bir dev sunucu genellikle kabuk üzerinden ve
       * ebeveyninden bağımsız başlar; ölçmek istediğimiz durum bu.
       */
      const child = spawn(
        process.execPath,
        ['-e', `require('node:http').createServer().listen(${orphanPort});setTimeout(()=>{},600000)`],
        { stdio: 'ignore', detached: true },
      )
      child.unref()
      // PID'i yazıyoruz: test yetimin ÖLDÜĞÜNÜ ölçmeli. Porta bakmak zayıf bir
      // vekildi — sunucu daha dinlemeye başlamadan port boş görünüyor ve test
      // yanlış sebeple geçiyordu (ters çevirme yakaladı).
      if (orphanPidFile !== undefined) writeFileSync(orphanPidFile, String(child.pid), 'utf8')
    }

    if (slowMs > 0) await new Promise((resolve) => setTimeout(resolve, slowMs))

    return {
      id: `mock-${config.caseId}-${config.attempt}`,
      adapter: 'mock',
      startedAt: new Date().toISOString(),
    }
  }

  async readTriggerSignal() {
    return {
      available: true,
      triggered: true,
      skills: ['widget'],
      refused: false,
      refusals: [],
      complete: true,
      via: 'mock',
    }
  }

  async readTrace() {
    return [{ seq: 1, kind: 'session_end', outcome: 'completed' }]
  }

  async finalize() {
    return {
      outcome: 'completed',
      finishedAt: new Date().toISOString(),
      latencyMs: 1,
      environmentHash: 'sha256:env',
      permissionMode: 'acceptEdits',
      files: [],
      env: { writes: [], deletes: [], network: [], unobserved: [] },
    }
  }
}
