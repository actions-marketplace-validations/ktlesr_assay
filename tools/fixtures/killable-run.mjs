/**
 * Öldürülebilir bir koşum — `packages/runner/src/journal.test.ts` bunu ayrı bir
 * süreç olarak başlatıp SIGKILL ile öldürüyor.
 *
 * Amaç, "süreç koşum ortasında öldü" senaryosunu taklit etmek değil GERÇEKTEN
 * yaşamak: journal'ın diskte ne bıraktığı, ancak yazan süreç haber vermeden
 * öldüğünde görülür.
 *
 * Kullanım:
 *   node tools/fixtures/killable-run.mjs <store-dizini> <skill-dizini>
 *
 * Her deneme arasında biraz bekliyor ki testin öldürecek zamanı olsun.
 * Derlenmiş `dist`ten içe aktarıyor: bir çocuk süreçte TS kaynağını koşturmak
 * ek bir yükleyici ister ve o yükleyicinin kendisi testin kırılma sebebi
 * olabilirdi.
 */
import { parseSuite } from '@ktlsr/assay-core'
import { runSuite } from '@ktlsr/assay-runner'
import { MockAdapter } from '@ktlsr/assay-runner/testing'

const [storeDir, skillDir] = process.argv.slice(2)

const SUITE = `
version: 1
target: { skill: widget, source: local@abc123 }
environment:
  host: mock
  model: test-model-1
  system_prompt_hash: sha256:aaa
runs: 6
cases:
  - id: trigger.positive.explicit
    prompt: Turn this draft into a widget.
    expect: { triggered: true }
  - id: trigger.negative.near_neighbor.readme
    prompt: Turn this draft into a README.
    expect: { triggered: false }
`

const parsed = parseSuite(SUITE)
if (!parsed.ok) throw new Error(parsed.issues.map((i) => i.message).join('; '))

class SlowMockAdapter extends MockAdapter {
  async finalize(session) {
    // Testin öldürecek penceresi olsun. Gerçek bir koşumda bu boşluk zaten
    // dakikalarca sürüyor.
    await new Promise((resolve) => setTimeout(resolve, 250))
    return super.finalize(session)
  }
}

const scenario = {
  trigger: {
    available: true,
    triggered: true,
    skills: ['widget'],
    refused: false,
    refusals: [],
    complete: true,
    via: 'mock',
  },
  trace: [{ seq: 1, kind: 'session_end', outcome: 'completed' }],
  result: { environmentHash: 'sha256:env', permissionMode: 'acceptEdits' },
}

await runSuite(parsed.suite, new SlowMockAdapter({ scenarios: [scenario] }), {
  source: SUITE,
  skillPath: skillDir,
  journalDir: storeDir,
  onProgress: (event) => {
    // Test bunu okuyup "yeter, öldür" diyor.
    process.stdout.write(`attempt ${event.caseId} ${event.attempt}\n`)
  },
})

process.stdout.write('finished\n')
