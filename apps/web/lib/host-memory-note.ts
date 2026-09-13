import type { Run } from '@ktlsr/assay-core'
import exposure from './host-memory-exposure.json'

/**
 * Host CLAUDE.md sızıntısına maruz kalmış bir kaydın künye notu (0.4.5).
 *
 * 0.4.4'e kadar Windows'ta çalışma dizini ev dizininin altındaydı ve host
 * oradan köke kadar yürüyüp ölçümü yapan makinenin `~/.claude/CLAUDE.md`'sini
 * yüklüyordu. Hangi dosyaların bağlama girdiği o kayıtlarda ölçülmedi.
 *
 * Veri `host-memory-exposure.json`: elle yazılmadı, kayıtlardan üretildi —
 *   node tools/host-memory-exposure.mjs ../assay-example/.assay/runs,.assay/runs \
 *     graphify --json apps/web/lib/host-memory-exposure.json
 * Yalnızca yolu ev altında görünen kayıtlar orada; maruziyeti kayıttan
 * okunamayan bir kayda not düşülmez (künyede "not measured" yine yazıyor).
 *
 * Ölçülmüş bir kayıtta (`environment.memory` var) not yok: orada ne yüklendiği
 * künyenin kendisinde yazıyor.
 */
export interface HostMemoryNote {
  /** Dosyadaki ayırt edici ad; iz bunun geçtiği denemeler. */
  marker: string
  attempts: number
  /** Adın modelin metninde ya da araç argümanında geçtiği deneme sayısı. */
  traces: number
}

const runs: Readonly<Record<string, { attempts: number; traces: number }>> = exposure.runs

export function hostMemoryNote(run: Pick<Run, 'id' | 'environment'>): HostMemoryNote | null {
  if (run.environment?.memory !== undefined) return null
  const entry = runs[run.id]
  return entry === undefined ? null : { marker: exposure.marker, ...entry }
}
