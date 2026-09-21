import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { closedInPublicMode } from './lib/public-mode'

/**
 * Yayın modu: yalnızca tanıtım sayfası ve yayımlanmış ölçümler.
 *
 * `ASSAY_PUBLIC_SITE=true` iken uygulamanın yarısı kapatılır. Sebep ürünle
 * ilgili: assayctl.dev'e gelen kişi bir SaaS'a değil, bir ölçüm aracının
 * tanıtımına ve gerçek bir koşum çıktısına bakıyor. Yarım kalmış bir
 * dashboard'a, boş bir admin paneline veya kimse için çalışmayan bir giriş
 * ekranına rastlamamalı.
 *
 * Kapalı rotaların listesi ve gerekçesi `lib/public-mode.ts`te; orada
 * sınanıyor.
 *
 * `/signin`, `/admin` ve `/settings` KAPATILMIYOR: üçü de zaten kimlik
 * doğrulama arkasında (`requireUser` / `requireAdmin`, apps/web/lib/guard.ts).
 * Yetkisiz ziyaretçi yalnızca giriş ekranını görür, ötesini göremez.
 * Kapatılsalardı sitenin yönetimi iki fazladan dağıtım isterdi: yayın modunu
 * kapat, dağıt, işini yap, aç, tekrar dağıt.
 *
 * `/api/runs` da kapalı değil: token ile korunuyor ve kapatılırsa siteye yeni
 * ölçüm yüklenemez. `/runs`, `/suites` ve `/compare` açık, ama sorgu katmanı
 * oturumsuz ziyaretçiye yalnızca `public: true` vaka setlerini veriyor
 * (RunScope).
 */
export function middleware(request: NextRequest) {
  if (process.env['ASSAY_PUBLIC_SITE'] !== 'true') return NextResponse.next()

  const { pathname } = request.nextUrl
  if (!closedInPublicMode(pathname)) {
    return NextResponse.next()
  }

  // Yönlendirme değil 404: bu dağıtımda o rota gerçekten yok. Yönlendirme,
  // olmayan bir şeyin var olduğunu ima ederdi.
  //
  // Boş gövdeli bir 404 yerine uygulamanın kendi `not-found.tsx`'i render
  // ediliyor: ziyaretçi tarayıcının çıplak hata sayfasını değil, sitenin
  // kendi dilinde bir sayfa görüyor. `rewrite` durum kodunu 404 bırakıyor.
  const notFound = request.nextUrl.clone()
  notFound.pathname = '/_not-found'
  return NextResponse.rewrite(notFound, { status: 404 })
}

export const config = {
  // Statik varlıklar ve Next'in kendi yolları eşleşmenin dışında.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
