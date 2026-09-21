import { Specimens } from './specimens'

/**
 * Bileşen kataloğu.
 *
 * Her bileşen iki temada yan yana gösterilir: koyu tema sonradan eklenmiş
 * gibi durmasın diye ikisini aynı ekranda görmek şart. Sayfanın kendisi
 * sabit temalı iki panelden oluşuyor; üstteki tema seçicisi bu sayfayı
 * etkilemiyor, çünkü karşılaştırmanın anlamı ikisini birlikte görmek.
 */
export const metadata = { title: 'Components — Assay' }

export default function ComponentsPage() {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-rule px-6 py-5">
        <p className="font-display text-2xl leading-none">Component specimens</p>
        <p className="mt-1 text-sm text-text-muted">
          Every component in both themes, side by side. The values shown are real
          measurements from the phase&nbsp;1 dogfooding runs.
        </p>
      </header>

      {/*
        `<main>`: uygulama sayfalarındaki yığın koşulu burada da olsun (global
        `main` kuralı, z-index 1). Katalog `div` iken portal katmanları hep
        üstte göründü ve onay penceresinin sayfanın altında kalması (0.4.1-n)
        burada hiç görülemedi — kusur yalnızca admin panelinde çıktı.
      */}
      <main className="grid lg:grid-cols-2">
        <section data-theme="light" className="bg-surface px-6 py-8 text-text">
          <p className="rule-label mb-8">Light</p>
          <Specimens />
        </section>
        <section
          data-theme="dark"
          className="border-t border-rule bg-surface px-6 py-8 text-text lg:border-l lg:border-t-0"
        >
          <p className="rule-label mb-8">Dark</p>
          <Specimens />
        </section>
      </main>
    </div>
  )
}
