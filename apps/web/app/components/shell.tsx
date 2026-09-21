import Link from 'next/link'
import type { ReactNode } from 'react'
import { Footer } from './footer'
import { Mark } from './mark'
import { ThemeToggle } from './theme-toggle'
import { UserMenu } from './user-menu'
import { visibleTrail, type Crumb } from '../../lib/trail'

/**
 * Sayfa kabuğu.
 *
 * Sertifikanın antetli kâğıdı: marka, gezinme, oturum ve tema seçici. Altında
 * tek bir hairline; kutu ya da gölge yok.
 *
 * Konum izi başlıkta DEĞİL: sayfanın kendi başlık alanında, `<main>`'in ilk
 * satırı (lib/trail.ts). Başlıkta ikisi karışıyordu ve derin sayfalarda iz
 * okunamayacak kadar kırpılıyordu.
 */
export function Shell({
  breadcrumbs = [],
  children,
}: {
  breadcrumbs?: readonly Crumb[]
  children: ReactNode
}) {
  const trail = visibleTrail(breadcrumbs)
  return (
    <div className="min-h-dvh">
      <header className="page-head">
        <div className="page-head-inner">
          <div className="head-nav flex min-w-0 items-center gap-4">
            <Link href="/" className="wordmark">
              <Mark size={18} />
              <span>Assay</span>
            </Link>
            {/*
              Metodoloji yazısı başlıkta duruyor, tanıtım sayfasının dibinde
              değil: sayfanın konusu ürünün tek satılabilir iddiası ve her
              ekrandan bir tık uzakta olmalı.
            */}
            <Link href="/methodology" className="head-link">
              Method
            </Link>
            {/*
              Bir koşum sayfasına doğrudan gelen ziyaretçi — issue'lardan gelen
              herkes — diğer ölçümlere buradan ulaşıyor (0.4.1-o). Adres
              `/suites`, etiket sitenin kendi dili: "measurement".
            */}
            <Link href="/suites" className="head-link">
              Measurements
            </Link>
          </div>
          <div className="head-tools flex items-center gap-5">
            <UserMenu />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[var(--page)] px-6 pb-24 pt-10">
        {trail === null ? null : (
          <nav aria-label="Breadcrumb" className="trail">
            <ol>
              {trail.map((crumb, index) => (
                <li key={`${index}:${crumb.label}`}>
                  {crumb.href === undefined ? (
                    <span aria-current={index === trail.length - 1 ? 'page' : undefined}>
                      {crumb.label}
                    </span>
                  ) : (
                    <Link href={crumb.href}>{crumb.label}</Link>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        {children}
      </main>
      <Footer />
    </div>
  )
}
