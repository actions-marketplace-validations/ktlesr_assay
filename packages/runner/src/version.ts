/**
 * Bu runner'ın sürümü — koşum kaydına damgalanan değer (0.3.2).
 *
 * Paketin kendi `package.json`'undan okunuyor: `src/` ve `dist/` ikisi de
 * paket kökünün bir altında, ve yayımlanan tarball `package.json`'u her zaman
 * taşıyor. Elle yazılmış bir sabit, sürüm PR'ında unutulacak bir satır olurdu.
 */

import { createRequire } from 'node:module'

export const ASSAY_VERSION: string = (
  createRequire(import.meta.url)('../package.json') as { version: string }
).version
