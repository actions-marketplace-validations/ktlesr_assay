/**
 * @ktlsr/assay-ui — tema, tokenlar ve paylaşılan bileşenler.
 *
 * Tokenlar `@ktlsr/assay-ui/tokens.css`. Bu paket hiçbir Assay paketine bağlanmaz;
 * `Measurement` tipi `@ktlsr/assay-core`'daki `Proportion` ile yapısal olarak
 * uyumludur ve uyum `tools/ui-contract.test.ts` ile denetlenir.
 */

export {
  applyTheme,
  readTheme,
  resolvedTheme,
  themeScript,
  THEME_KEY,
  type Theme,
} from './theme'

/*
 * Saf metin yardımcıları istemci modülünün dışında: `measurement.tsx`
 * `'use client'` ve oradan dışa verilen bir fonksiyon sunucu bileşeninden
 * çağrılamıyor. Sayfa sunucuda da aynı cümleyi üretebilsin diye ayrıldı.
 */
export {
  countSentence,
  formatBounds,
  formatMeasurement,
  intervalGloss,
  type Measurement,
} from './format'

export {
  Badge,
  BreakableName,
  Callout,
  Determination,
  EmptyState,
  ErrorState,
  IntervalRule,
  MeasurementBlock,
  MetricValue,
  RateFigure,
  type CalloutTone,
  type VerdictKind,
} from './measurement'

export {
  IconAlert,
  IconArrow,
  IconCall,
  IconClose,
  IconEnd,
  IconHook,
  IconFail,
  IconInfo,
  IconMessage,
  IconMoon,
  IconPass,
  IconResult,
  IconSkill,
  IconSort,
  IconSun,
  IconSystem,
  IconUnknown,
  type IconProps,
} from './icons'

export {
  Button,
  ConfirmDialog,
  Dialog,
  DropdownMenu,
  Popover,
  Toast,
  ToastProvider,
  ToastViewport,
  Tooltip,
  TooltipProvider,
  type MenuItem,
} from './overlays'

export { Table, TraceViewer, type Column, type TraceStep } from './data'
