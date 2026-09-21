import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      'packages/*/src/**/*.test.ts',
      'tools/**/*.test.ts',
      'apps/web/lib/**/*.test.ts',
    ],
    alias: {
      '@ktlsr/assay-core': new URL('./packages/core/src/index.ts', import.meta.url).pathname,
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['packages/*/src/**/*.ts'],
      // `adapter.ts` dosyaları yalnızca tip ve arayüz tanımı; çalıştırılacak
      // satırları yok, kapsam sayısını yanıltıyorlar.
      //
      // `worker.ts` ise tersine: satırları var ama YALNIZCA çocuk süreçte
      // koşuyor ve v8 kapsamı süreç içi — onu yapısal olarak göremez (%12.5
      // gösteriyordu). Sınanmıyor değil: supervisor ve fast-mode testleri onu
      // gerçek bir süreç olarak başlatıp öldürüyor. Sayıya girseydi eşik, düşen
      // bir kapsamı değil ölçülemeyen bir yüzeyi raporlardı.
      exclude: [
        '**/*.test.ts',
        '**/index.ts',
        'packages/core/src/adapter.ts',
        'packages/runner/src/adapter.ts',
        'packages/runner/src/worker.ts',
      ],
      /*
       * Eşikler bugünkü sayının biraz altında: amaç sayıyı yükseltmek değil,
       * düşmesini fark etmek. Ölçüm motoru (`packages/core`) ayrı ve sıkı
       * tutuluyor — assertion, skorlama ve karşılaştırma mantığı ürünün
       * iddiasının tamamı.
       */
      thresholds: {
        statements: 88,
        branches: 84,
        functions: 92,
        lines: 88,
        'packages/core/src/**': {
          statements: 98,
          branches: 92,
          functions: 100,
          lines: 98,
        },
      },
    },
  },
})
