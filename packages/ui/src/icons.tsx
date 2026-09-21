import type { SVGProps } from 'react'

/**
 * Çizilmiş ikon seti.
 *
 * Unicode glifleri (●, ✕, ◐, →) ikon değildir: her yazı tipinde farklı boyda,
 * farklı ağırlıkta ve farklı taban çizgisinde otururlar. Buradaki her ikon
 * 16×16 ızgarada, 1.5 birim tek bir kalem kalınlığıyla ve `currentColor` ile
 * çizildi; hepsi aynı elden çıkma görünür.
 *
 * Verdict işaretleri tek bir aileden: aynı çember, içi farklı.
 *   pass    → çember dolu
 *   fail    → çember içinde çarpı
 *   unknown → çemberin yarısı dolu
 * Renk kaldırıldığında bile üçü ayrışır (bağlayıcı kısıt).
 */

export type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Icon({ size = 16, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------

export function IconPass(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="6.25" />
      <circle cx="8" cy="8" r="3.25" fill="currentColor" stroke="none" />
    </Icon>
  )
}

export function IconFail(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M5.6 5.6 10.4 10.4M10.4 5.6 5.6 10.4" />
    </Icon>
  )
}

export function IconUnknown(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="6.25" />
      {/* Yarısı dolu: "kısmen bilinen". */}
      <path d="M8 1.75a6.25 6.25 0 0 0 0 12.5z" fill="currentColor" stroke="none" />
    </Icon>
  )
}

// ---------------------------------------------------------------------------
// Tema
// ---------------------------------------------------------------------------

export function IconSun(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="3.1" />
      <path d="M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1M12.95 3.05l-1.13 1.13M4.18 11.82l-1.13 1.13M12.95 12.95l-1.13-1.13M4.18 4.18 3.05 3.05" />
    </Icon>
  )
}

export function IconMoon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M13.2 9.6A5.7 5.7 0 0 1 6.4 2.8a5.7 5.7 0 1 0 6.8 6.8z" />
    </Icon>
  )
}

/** Sistem tercihi — ekranın kendisi. Herkesin tanıdığı biçim. */
export function IconSystem(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="1.75" y="3" width="12.5" height="8.5" rx="1" />
      <path d="M5.75 14h4.5" />
    </Icon>
  )
}

// ---------------------------------------------------------------------------
// İz
// ---------------------------------------------------------------------------

/** Araç çağrısı — dışarı giden istek. */
export function IconCall(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 8h9M8.5 4.75 11.75 8 8.5 11.25" />
      <path d="M14 3.5v9" />
    </Icon>
  )
}

/** Araç sonucu — geri dönen cevap. */
export function IconResult(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M13.5 8h-9M7.5 4.75 4.25 8l3.25 3.25" />
      <path d="M2 3.5v9" />
    </Icon>
  )
}

/** Asistan mesajı — metin. */
export function IconMessage(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.75 4h10.5M2.75 8h7.5M2.75 12h5" />
    </Icon>
  )
}

/** Skill tetiklendi — ölçümün konusu. Dolu eşkenar dörtgen. */
export function IconSkill(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 1.5 14.5 8 8 14.5 1.5 8z" fill="currentColor" stroke="none" />
    </Icon>
  )
}

/**
 * Hook — host'un koşuma iliştirdiği kanca.
 *
 * Skill'in kendisi değil, ölçümün etrafındaki bir şey: bu yüzden dolu değil,
 * çizgisel ve akışın yanına asılı duran bir biçim.
 */
export function IconHook(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 2.5v6a2.75 2.75 0 0 1-5.5 0" />
      <path d="M8 2.5h5.5" />
      <path d="M11.5 12.5h3" />
    </Icon>
  )
}

/** Oturum bitti. */
export function IconEnd(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="10" height="10" rx="1" fill="currentColor" stroke="none" />
    </Icon>
  )
}

// ---------------------------------------------------------------------------
// Arayüz
// ---------------------------------------------------------------------------

export function IconArrow(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 8h10M9.25 4.25 13 8l-3.75 3.75" />
    </Icon>
  )
}

export function IconInfo(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 7.25v4" />
      <circle cx="8" cy="4.9" r="0.85" fill="currentColor" stroke="none" />
    </Icon>
  )
}

export function IconAlert(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 1.9 15 13.6H1z" />
      <path d="M8 6.4v3.2" />
      <circle cx="8" cy="11.6" r="0.8" fill="currentColor" stroke="none" />
    </Icon>
  )
}

export function IconClose(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </Icon>
  )
}

/** Sıralama yönü — sütun başlığında. */
export function IconSort({ direction, ...props }: IconProps & { direction?: 'asc' | 'desc' }) {
  return (
    <Icon {...props}>
      {direction !== 'desc' ? <path d="M5 6.5 8 3.5l3 3" /> : null}
      {direction !== 'asc' ? <path d="M5 9.5 8 12.5l3-3" /> : null}
      {direction === undefined ? null : <path d="M8 3.5v9" />}
    </Icon>
  )
}
