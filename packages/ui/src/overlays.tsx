'use client'

import * as RadixAlertDialog from '@radix-ui/react-alert-dialog'
import * as RadixDialog from '@radix-ui/react-dialog'
import * as RadixDropdown from '@radix-ui/react-dropdown-menu'
import * as RadixPopover from '@radix-ui/react-popover'
import * as RadixToast from '@radix-ui/react-toast'
import * as RadixTooltip from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'
import { IconClose } from './icons'

/**
 * Katman bileşenleri.
 *
 * Radix üzerine kuruldu: odak tuzağı, kaçış tuşu, dışarı tıklama, `aria-*`
 * ilişkileri ve ekran okuyucu duyuruları elle doğru yazılması zor şeyler ve
 * erişilebilirlik "sadeleştirilmeyecekler" listesinde. Radix'in *görünümü*
 * kullanılmıyor; her yüzey tasarım tokenlarıyla yeniden çizildi.
 *
 * Yasaklar burada da geçerli: gradient yok, yumuşak gölge yok. Katmanlar
 * zeminden gölgeyle değil, hairline ve daha koyu/açık bir yüzeyle ayrılıyor.
 */

/*
 * Katmanlar `z-50`: `main` kendi yığın bağlamını kuruyor (z-index 1, arka plan
 * alanının üstünde kalmak için) ve başlık 20'de. Portal içeriği z-index'siz
 * kaldığında sayfanın ALTINDA çiziliyordu — onay penceresinin metni arkadaki
 * satırların içinden okunuyordu (0.4.1-n). Saydamlık değil, yığın sırası.
 */
const LAYER = 'z-50'

const OVERLAY = `${LAYER} fixed inset-0 bg-surface-sunken/70 data-[state=open]:animate-[fade_150ms_ease-out]`

const PANEL =
  `${LAYER} fixed left-1/2 top-1/2 w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 ` +
  'border border-rule-strong bg-surface-raised p-6'

const SURFACE = `${LAYER} border border-rule bg-surface-raised p-1`

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

export function Dialog({
  trigger,
  title,
  description,
  children,
  footer,
}: {
  trigger: ReactNode
  title: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
}) {
  return (
    <RadixDialog.Root>
      <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={OVERLAY} />
        <RadixDialog.Content className={PANEL}>
          <RadixDialog.Title className="font-display text-xl">{title}</RadixDialog.Title>
          {description === undefined ? null : (
            <RadixDialog.Description className="mt-2 text-sm text-text-muted">
              {description}
            </RadixDialog.Description>
          )}
          {children === undefined ? null : <div className="mt-4">{children}</div>}
          <div className="mt-6 flex justify-end gap-2">
            {footer ?? (
              <RadixDialog.Close asChild>
                <Button>Close</Button>
              </RadixDialog.Close>
            )}
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

/**
 * Yıkıcı işlem onayı.
 *
 * `AlertDialog` kullanılıyor çünkü kaçış tuşuyla kapansa bile odak geri döner
 * ve ekran okuyucu bunu bir uyarı olarak duyurur. Onay metni eylemi adıyla
 * söyler — "Are you sure?" değil, "Delete the run" gibi.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
  tone = 'danger',
}: {
  trigger: ReactNode
  title: string
  description: string
  confirmLabel: string
  onConfirm?: (() => void) | undefined
  /** Geri alınamayan eylem `danger`; yalnızca onay isteyen eylem `default`. */
  tone?: 'danger' | 'default'
}) {
  return (
    <RadixAlertDialog.Root>
      <RadixAlertDialog.Trigger asChild>{trigger}</RadixAlertDialog.Trigger>
      <RadixAlertDialog.Portal>
        <RadixAlertDialog.Overlay className={OVERLAY} />
        <RadixAlertDialog.Content className={PANEL}>
          <RadixAlertDialog.Title
            className={`font-display text-xl ${tone === 'danger' ? 'text-fail' : 'text-text'}`}
          >
            {title}
          </RadixAlertDialog.Title>
          <RadixAlertDialog.Description className="mt-2 max-w-[52ch] text-sm text-text-muted">
            {description}
          </RadixAlertDialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <RadixAlertDialog.Cancel asChild>
              <Button>Cancel</Button>
            </RadixAlertDialog.Cancel>
            <RadixAlertDialog.Action asChild>
              <Button tone={tone === 'danger' ? 'danger' : 'default'} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </RadixAlertDialog.Action>
          </div>
        </RadixAlertDialog.Content>
      </RadixAlertDialog.Portal>
    </RadixAlertDialog.Root>
  )
}

// ---------------------------------------------------------------------------
// Tooltip / Popover / Dropdown
// ---------------------------------------------------------------------------

export const TooltipProvider = RadixTooltip.Provider

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <RadixTooltip.Root delayDuration={200}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          sideOffset={6}
          className={`${LAYER} border border-rule-strong bg-surface-raised px-2 py-1 text-xs text-text`}
        >
          {label}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  )
}

export function Popover({
  trigger,
  children,
}: {
  trigger: ReactNode
  children: ReactNode
}) {
  return (
    <RadixPopover.Root>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          sideOffset={6}
          className={`${LAYER} w-72 border border-rule-strong bg-surface-raised p-4 text-sm`}
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  )
}

export interface MenuItem {
  label: string
  onSelect?: (() => void) | undefined
  tone?: 'default' | 'danger' | undefined
}

export function DropdownMenu({
  trigger,
  items,
}: {
  trigger: ReactNode
  items: readonly MenuItem[]
}) {
  return (
    <RadixDropdown.Root>
      <RadixDropdown.Trigger asChild>{trigger}</RadixDropdown.Trigger>
      <RadixDropdown.Portal>
        <RadixDropdown.Content sideOffset={4} className={`${SURFACE} min-w-44`}>
          {items.map((item) => (
            <RadixDropdown.Item
              key={item.label}
              {...(item.onSelect === undefined ? {} : { onSelect: item.onSelect })}
              className={`cursor-default px-3 py-1.5 text-sm outline-none data-[highlighted]:bg-surface-sunken ${
                item.tone === 'danger' ? 'text-fail' : 'text-text'
              }`}
            >
              {item.label}
            </RadixDropdown.Item>
          ))}
        </RadixDropdown.Content>
      </RadixDropdown.Portal>
    </RadixDropdown.Root>
  )
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

export const ToastProvider = RadixToast.Provider

export function ToastViewport() {
  return (
    <RadixToast.Viewport className="fixed bottom-4 right-4 z-50 flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2 outline-none" />
  )
}

export function Toast({
  open,
  onOpenChange,
  title,
  description,
  tone = 'info',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  tone?: 'info' | 'danger'
}) {
  return (
    <RadixToast.Root
      open={open}
      onOpenChange={onOpenChange}
      className={`border bg-surface-raised p-4 ${
        tone === 'danger' ? 'border-fail-rule' : 'border-rule-strong'
      }`}
    >
      <RadixToast.Title
        className={`mark ${tone === 'danger' ? 'text-fail' : 'text-text'}`}
      >
        {title}
      </RadixToast.Title>
      {description === undefined ? null : (
        <RadixToast.Description className="mt-1 text-sm text-text-muted">
          {description}
        </RadixToast.Description>
      )}
      <RadixToast.Close
        className="absolute right-2 top-2 p-1 text-text-faint transition-colors hover:text-text"
        aria-label="Dismiss"
      >
        <IconClose size={14} />
      </RadixToast.Close>
    </RadixToast.Root>
  )
}

// ---------------------------------------------------------------------------
// Buton
// ---------------------------------------------------------------------------

/**
 * Buton.
 *
 * Dolgu yok: hairline çerçeve ve metin. Vurgu rengi yalnızca odak halkasında.
 * Yıkıcı eylem rengiyle değil, sözcüğüyle ayrışır — renk ikinci taşıyıcı.
 */
export function Button({
  children,
  tone = 'default',
  onClick,
  type = 'button',
  ...rest
}: {
  children: ReactNode
  tone?: 'default' | 'danger' | 'quiet' | undefined
  onClick?: (() => void) | undefined
  type?: 'button' | 'submit' | undefined
} & Record<string, unknown>) {
  const tones = {
    default: 'border-rule-strong text-text hover:bg-surface-sunken',
    danger: 'border-fail-rule text-fail hover:bg-surface-sunken',
    quiet: 'border-transparent text-text-muted hover:text-text',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      className={`border px-3 py-1.5 text-xs uppercase tracking-[0.09em] transition-colors ${tones[tone]}`}
      {...rest}
    >
      {children}
    </button>
  )
}
