/**
 * Sayfanın konum izi (breadcrumb) — üst çubuktan sayfaya taşındı.
 *
 * Üst çubuk hem gezinmeyi hem konumu taşıyordu; ikisi görsel olarak
 * ayrışmıyordu ve derin sayfalarda kırıntılar "R…", "ATTE…" diye kırpılıyordu.
 * Artık üst çubuk yalnızca gezinme; iz sayfanın başlık alanında, kırpılmadan.
 *
 * İz yalnızca gidilecek bir üst yer varsa çizilir: tek öğeli, bağlantısız bir
 * iz ("skills") sayfanın kendi başlığını tekrarlamaktan başka bir şey yapmaz.
 */
export interface Crumb {
  label: string
  href?: string
}

export function visibleTrail(crumbs: readonly Crumb[]): readonly Crumb[] | null {
  return crumbs.some((crumb) => crumb.href !== undefined) ? crumbs : null
}
