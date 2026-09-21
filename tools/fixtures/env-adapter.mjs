/**
 * Gördüğü port kirasını rapora yazan sahte adaptör — `concurrency.test.ts`
 * için.
 *
 * Worker sürecinde kuruluyor ve `process.env`den okuyor: sınanan şey, kiranın
 * gerçekten worker'a (dolayısıyla ajanın ortamına) ulaşıp ulaşmadığı.
 */
export class EnvReportingAdapter {
  id = 'mock'

  async start(config) {
    return {
      id: `env-${config.caseId}-${config.attempt}`,
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
      // Gerekçe metni testin okuduğu yer: kira buradan görünür.
      via: `PORT=${process.env['PORT']} ASSAY_PORT_RANGE=${process.env['ASSAY_PORT_RANGE']}`,
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
      files: [],
      env: { writes: [], deletes: [], network: [], unobserved: [] },
    }
  }
}
